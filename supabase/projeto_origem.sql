-- Projeto de origem do lead (Bitrix e Midrah)
-- O lead que chega do Bitrix ou do Midrah já traz o projeto (empreendimento) nas observações.
-- Aqui o Inmovya passa a guardar isso em dois campos:
--   projeto_origem = nome do projeto (ex.: "The Collection - Vila Mariana")
--   projeto_sigla  = nome abreviado (ex.: "Col Vl Mariana"), que também vira TAG do lead
--                    e ETIQUETA no WhatsApp (o WhatsApp Business aceita só 20 etiquetas).
-- Vale para os leads novos (gatilho) e para os que já estão no Inmovya (no fim do arquivo).
-- Não apaga nada: só preenche os campos novos e acrescenta a tag.
-- Rode no SQL Editor → colar tudo → Run. DEPOIS rode supabase/projeto_etiqueta_existente.sql (usa as etiquetas que já existem no WhatsApp).

alter table public.leads add column if not exists projeto_origem text;
alter table public.leads add column if not exists projeto_sigla text;

-- texto sem acento e minúsculo (para comparar)
create or replace function public.projeto_sem_acento(p text)
returns text
language sql
immutable
as $$
  select lower(translate(coalesce(p, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'));
$$;

-- textos que NÃO são projeto ("Informar Empreendimento", "a definir"...)
create or replace function public.projeto_nao_eh(p text)
returns boolean
language sql
immutable
as $$
  select t = ''
      or t ~ '^(informar|informe|preencher|definir|a definir|sem|nenhum|qual|cadastrar)( o| um)? (empreendimento|empreendimentos|projeto|imovel|produto)$'
      or t ~ '^(empreendimento|projeto|imovel) (nao informado|a definir|indefinido)$'
      or t ~ '^(n a|na|n/a|nao informado|nao informou|a definir|indefinido|nenhum|sem|null|undefined|empreendimento|projeto)$'
      or t ~ '^(remarketing|retargeting|campanha|lead|leads|teste|roleta|geral|institucional|formulario|site|facebook|instagram|meta ads|google)( .*)?$'
  from (select trim(regexp_replace(public.projeto_sem_acento(p), '\s+', ' ', 'g')) as t) x;
$$;

-- Lê o projeto das observações (o mesmo jeito que a tela e o 1º contato já usam):
--  "Empreendimento: X" em qualquer linha → X
--  Bitrix "719227: Nome | The Collection - Vila Mariana | Bitrix #719227" → o pedaço do projeto
create or replace function public.projeto_do_lead(p_obs text, p_nome text)
returns text
language plpgsql
immutable
as $$
declare
  v_linha text;
  v_m text[];
  v_parte text;
  v_primeira text;
begin
  for v_linha in select trim(regexp_replace(l, '\s+', ' ', 'g')) from regexp_split_to_table(coalesce(p_obs, ''), '\r?\n') l loop
    if v_linha = '' then continue; end if;
    if v_primeira is null then v_primeira := v_linha; end if;
    v_m := regexp_match(v_linha, '^(?:empreendimentos?|projeto|im[óo]vel|interesse)\s*[:\-–]\s*(.+)$', 'i');
    if v_m is not null and not public.projeto_nao_eh(v_m[1]) then
      return trim(regexp_replace(v_m[1], '\s*\[[^\]]*\]\s*$', ''));
    end if;
  end loop;
  if v_primeira is null or v_primeira ~* '^lead (criado|recebido) automaticamente' then
    return null;
  end if;
  if position('|' in v_primeira) > 0 then
    foreach v_parte in array string_to_array(v_primeira, '|') loop
      v_parte := trim(regexp_replace(trim(v_parte), '[.;,]+$', ''));
      if v_parte = '' then continue; end if;
      if v_parte ~ '^\d+\s*:' then continue; end if;               -- "719227: Nome do lead"
      if v_parte ~* '\mbitrix\M' or v_parte ~ '#\s*\d+' then continue; end if;  -- "Bitrix #719227"
      if v_parte ~* '^campanha\s*:' then continue; end if;
      if v_parte ~ '^\d+$' then continue; end if;
      if public.projeto_sem_acento(v_parte) = public.projeto_sem_acento(trim(coalesce(p_nome, ''))) then continue; end if;
      if public.projeto_nao_eh(v_parte) then continue; end if;
      return trim(regexp_replace(v_parte, '\s*\[[^\]]*\]\s*$', ''));
    end loop;
    return null;
  end if;
  return null;
end;
$$;

-- Nome abreviado do projeto (até 20 letras), para a etiqueta do WhatsApp e a tag do Inmovya.
--  "Jardim da Hípica" → "Jd Hípica"; "Boulevard Brooklin" → "Blvd Brooklin";
--  "T.O.M. Paraíso" → "TOM Paraíso"; "The Collection - Vila Mariana [MD 2]" → "Col Vl Mariana"
create or replace function public.projeto_sigla(p text)
returns text
language plpgsql
immutable
as $$
declare
  v text := coalesce(p, '');
  v_palavras text[] := '{}';
  w text;
  k text;
  v_res text;
  i int;
begin
  v := regexp_replace(v, '\[[^\]]*\]|\([^)]*\)', ' ', 'g');   -- tira "[MD 2]", "(...)"
  v := regexp_replace(v, '[–—\-/|,;:]+', ' ', 'g');
  v := replace(v, '.', '');
  -- tudo em maiúsculas ("NURBAN VENÂNCIO")? deixa só a 1ª letra maiúscula nas palavras grandes
  if v = upper(v) then
    v := (select string_agg(case when length(x) > 3 then initcap(x) else x end, ' ') from regexp_split_to_table(trim(v), '\s+') x);
  end if;
  foreach w in array regexp_split_to_array(trim(v), '\s+') loop
    if w = '' then continue; end if;
    k := public.projeto_sem_acento(w);
    if k in ('de', 'da', 'do', 'das', 'dos', 'e', 'the', 'by', 'em', 'no', 'na', 'residencial', 'condominio', 'edificio', 'empreendimento') then
      continue;
    end if;
    w := case k
      when 'jardim' then 'Jd' when 'jardins' then 'Jds' when 'boulevard' then 'Blvd' when 'parque' then 'Pq'
      when 'vila' then 'Vl' when 'avenida' then 'Av' when 'praca' then 'Pç' when 'alameda' then 'Al'
      when 'santo' then 'Sto' when 'santa' then 'Sta' when 'sao' then 'S' when 'rua' then 'R'
      when 'apartamentos' then 'Aptos' when 'apartamento' then 'Apto'
      else w end;
    v_palavras := v_palavras || w;
  end loop;
  if coalesce(array_length(v_palavras, 1), 0) = 0 then
    return null;
  end if;
  v_res := array_to_string(v_palavras, ' ');
  -- comprido? encurta as palavras do começo (3 letras) e mantém a última inteira
  if length(v_res) > 20 then
    for i in 1 .. array_length(v_palavras, 1) - 1 loop
      if length(v_palavras[i]) > 3 then v_palavras[i] := left(v_palavras[i], 3); end if;
    end loop;
    v_res := array_to_string(v_palavras, ' ');
  end if;
  return trim(left(trim(v_res), 20));
end;
$$;

-- é lead do Bitrix ou do Midrah?
create or replace function public.projeto_eh_fonte(p_origem text, p_tags text[])
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_origem, '')) in ('roleta', 'midrah', 'bitrix')
      or exists (select 1 from unnest(coalesce(p_tags, '{}'::text[])) t where lower(t) in ('bitrix', 'roleta', 'midrah'));
$$;

-- gatilho: preenche projeto e sigla e põe a tag no lead novo (Bitrix/Midrah)
create or replace function public.leads_projeto_origem()
returns trigger
language plpgsql
as $$
declare
  v_proj text;
  v_sigla text;
begin
  if new.projeto_origem is not null or not public.projeto_eh_fonte(new.origem, new.tags) then
    return new;
  end if;
  v_proj := public.projeto_do_lead(new.observacoes, new.nome);
  if v_proj is null then
    return new;
  end if;
  v_sigla := public.projeto_sigla(v_proj);
  new.projeto_origem := v_proj;
  new.projeto_sigla := v_sigla;
  if v_sigla is not null and not (v_sigla = any(coalesce(new.tags, '{}'::text[]))) then
    new.tags := coalesce(new.tags, '{}'::text[]) || v_sigla;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_projeto_origem on public.leads;
create trigger leads_projeto_origem
before insert or update of observacoes, origem, tags on public.leads
for each row execute function public.leads_projeto_origem();

-- A extensão (Inmovya Scale) pergunta o projeto do lead para pôr a etiqueta no WhatsApp.
create or replace function public.agente_projeto_lead(p_token text, p_lead uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
  v record;
begin
  if v_uid is null then
    raise exception 'token do agente inválido' using errcode = '28000';
  end if;
  select l.projeto_origem, l.projeto_sigla into v from public.leads l where l.id = p_lead and l.user_id = v_uid;
  return json_build_object('projeto', v.projeto_origem, 'sigla', v.projeto_sigla);
end;
$$;
grant execute on function public.agente_projeto_lead(text, uuid) to anon, authenticated;

-- Leads do Bitrix e do Midrah que já estão no Inmovya: preenche agora (o gatilho faz o trabalho).
update public.leads l
set observacoes = l.observacoes
where l.projeto_origem is null
  and public.projeto_eh_fonte(l.origem, l.tags)
  and public.projeto_do_lead(l.observacoes, l.nome) is not null;

-- Ajustes (rodar de novo não estraga nada): tira o que não é projeto ("REMARKETING")
-- e atualiza a sigla quando a regra de abreviar muda (troca a tag antiga pela nova).
update public.leads l
set tags = array_remove(l.tags, l.projeto_sigla), projeto_origem = null, projeto_sigla = null
where l.projeto_origem is not null and public.projeto_nao_eh(l.projeto_origem);

update public.leads l
set tags = array_append(array_remove(l.tags, l.projeto_sigla), public.projeto_sigla(l.projeto_origem)),
    projeto_sigla = public.projeto_sigla(l.projeto_origem)
where l.projeto_origem is not null
  and l.projeto_sigla is distinct from public.projeto_sigla(l.projeto_origem);

notify pgrst, 'reload schema';
