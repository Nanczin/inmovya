-- Projeto de origem → ETIQUETA QUE JÁ EXISTE no WhatsApp Business
-- O Inmovya Scale manda para cá a lista das suas etiquetas do WhatsApp (a cada 10 min, com o WhatsApp Web aberto).
-- Cada lead do Bitrix/Midrah é casado com a etiqueta do projeto dele que você já tem
-- (ex.: projeto "The Collection - Vila Mariana" → etiqueta "Collection"; "Jardim da Hípica" → "Hípica").
-- Sem etiqueta parecida: o lead fica só com o "Projeto de origem" (nenhuma etiqueta nova é criada).
-- A tag do lead no Inmovya passa a ser o nome dessa etiqueta. Não apaga leads.
-- Precisa ter rodado antes: supabase/projeto_origem.sql. Rode no SQL Editor → colar tudo → Run.

alter table public.agente_config add column if not exists etiquetas_wa text[];
alter table public.agente_config add column if not exists etiquetas_wa_em timestamptz;

-- palavras do nome, sem acento, sem palavras vazias e com as abreviações por extenso
create or replace function public.projeto_palavras(p text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(w order by n), '{}')
  from (
    select n,
      case x
        when 'jd' then 'jardim' when 'jds' then 'jardins' when 'blvd' then 'boulevard' when 'pq' then 'parque'
        when 'vl' then 'vila' when 'av' then 'avenida' when 'al' then 'alameda' when 'sto' then 'santo'
        when 'sta' then 'santa' when 's' then 'sao' when 'r' then 'rua' when 'pca' then 'praca'
        else x end as w
    from regexp_split_to_table(
           trim(regexp_replace(replace(public.projeto_sem_acento(regexp_replace(coalesce(p, ''), '\[[^\]]*\]|\([^)]*\)', ' ', 'g')), '.', ''),
                               '[^a-z0-9]+', ' ', 'g')), ' ') with ordinality t(x, n)
    where x <> ''
      and x not in ('de', 'da', 'do', 'das', 'dos', 'e', 'the', 'by', 'em', 'no', 'na', 'residencial', 'condominio',
                    'edificio', 'empreendimento', 'projeto', 'imoveis', 'imovel', 'apartamentos', 'apto', 'aptos')
  ) y;
$$;

-- etiquetas que são de funil/origem, nunca de projeto
create or replace function public.etiqueta_nao_eh_projeto(p text)
returns boolean
language sql
immutable
as $$
  select t ~ '%' or t ~ '^\d+$'
      or t in ('fechado', 'vendeu', 'lead', 'leads', 'nutricao', 'bitrix', 'midrah', 'meta ads', 'meta', 'deny list', 'denylist',
               'novo cliente', 'novo pedido', 'pagamento pendente', 'pago', 'pedido finalizado', 'importante', 'follow up',
               'caixa postal', 'disparo', 'roleta', 'perdido', 'lista fria', 'interessado', 'remarketing', 'visita', 'proposta',
               'documentacao', 'documentos', 'cliente', 'clientes', 'investidor', 'moradia', 'quente', 'morno', 'frio')
  from (select trim(regexp_replace(public.projeto_sem_acento(p), '\s+', ' ', 'g')) as t) x;
$$;

-- melhor etiqueta existente para o projeto (ou null). Todas as palavras da etiqueta precisam estar no nome
-- do projeto (palavra de 4+ letras pode ser o começo: "Collect" = "Collection"); vence a que casa com o
-- começo do nome do projeto (a marca) e, empatando, a mais completa ("Nurban Sumaré" ganha de "Nurban").
create or replace function public.projeto_etiqueta(p_etiquetas text[], p_projeto text)
returns text
language sql
immutable
as $$
  with proj as (select public.projeto_palavras(p_projeto) as pw),
  cand as (
    select e as nome, public.projeto_palavras(e) as ew
    from unnest(coalesce(p_etiquetas, '{}'::text[])) e
    where not public.etiqueta_nao_eh_projeto(e)
  ),
  nota as (
    select c.nome, cardinality(c.ew) as qtd,
      -- cada palavra da etiqueta precisa aparecer no projeto (palavra curta: igual; longa: pode ser o começo)
      (select count(*) from unnest(c.ew) w
        where exists (select 1 from unnest((select pw from proj)) p
                      where p = w
                         or (length(w) >= 4 and left(p, length(w)) = w)
                         or (length(p) >= 4 and left(w, length(p)) = p))) as casou,
      -- onde no nome do projeto ela casa (a marca vem primeiro: "Collection" ganha de "Vila Mariana")
      (select min(i) from unnest((select pw from proj)) with ordinality pp(p, i)
        where exists (select 1 from unnest(c.ew) w
                      where pp.p = w
                         or (length(w) >= 4 and left(pp.p, length(w)) = w)
                         or (length(pp.p) >= 4 and left(w, length(pp.p)) = pp.p))) as posicao,
      (select string_agg(w, '') from unnest(c.ew) w) as junto
    from cand c
    where cardinality(c.ew) > 0
  )
  select n.nome
  from nota n
  where n.casou = n.qtd
  order by n.posicao, n.qtd desc, length(n.junto) desc, n.nome
  limit 1;
$$;

-- etiquetas do dono do lead
create or replace function public.etiquetas_wa_do_usuario(p_uid uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select etiquetas_wa from public.agente_config where user_id = p_uid limit 1;
$$;

-- gatilho (substitui o do projeto_origem.sql): projeto + etiqueta existente do WhatsApp
create or replace function public.leads_projeto_origem()
returns trigger
language plpgsql
as $$
declare
  v_proj text;
  v_etq text;
begin
  if new.projeto_origem is not null or not public.projeto_eh_fonte(new.origem, new.tags) then
    return new;
  end if;
  v_proj := public.projeto_do_lead(new.observacoes, new.nome);
  if v_proj is null then
    return new;
  end if;
  v_etq := public.projeto_etiqueta(public.etiquetas_wa_do_usuario(new.user_id), v_proj);
  new.projeto_origem := v_proj;
  new.projeto_sigla := v_etq;
  if v_etq is not null and not (v_etq = any(coalesce(new.tags, '{}'::text[]))) then
    new.tags := coalesce(new.tags, '{}'::text[]) || v_etq;
  end if;
  return new;
end;
$$;

-- refaz o casamento de todos os leads do usuário (quando a lista de etiquetas muda)
create or replace function public.projeto_recasar(p_uid uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etqs text[] := public.etiquetas_wa_do_usuario(p_uid);
  n int;
begin
  with novo as (
    select l.id, l.projeto_sigla as velha, public.projeto_etiqueta(v_etqs, l.projeto_origem) as nova
    from public.leads l
    where l.user_id = p_uid and l.projeto_origem is not null
  )
  update public.leads l
  set tags = case
               when novo.nova is null then array_remove(coalesce(l.tags, '{}'::text[]), novo.velha)
               when novo.nova = any(array_remove(coalesce(l.tags, '{}'::text[]), novo.velha)) then array_remove(coalesce(l.tags, '{}'::text[]), novo.velha)
               else array_append(array_remove(coalesce(l.tags, '{}'::text[]), novo.velha), novo.nova)
             end,
      projeto_sigla = novo.nova
  from novo
  where l.id = novo.id and novo.velha is distinct from novo.nova;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.projeto_recasar(uuid) from public, anon, authenticated;

-- a extensão manda a lista das etiquetas do WhatsApp
create or replace function public.agente_salvar_etiquetas(p_token text, p_nomes text[])
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
  v_lista text[];
  v_antes text[];
  n int := 0;
begin
  if v_uid is null then
    raise exception 'token do agente inválido' using errcode = '28000';
  end if;
  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}') into v_lista
  from unnest(coalesce(p_nomes, '{}'::text[])) x where trim(x) <> '';
  if cardinality(v_lista) = 0 then
    return json_build_object('ok', false, 'motivo', 'lista vazia');
  end if;
  select etiquetas_wa into v_antes from public.agente_config where user_id = v_uid;
  update public.agente_config set etiquetas_wa = v_lista, etiquetas_wa_em = now() where user_id = v_uid;
  if v_antes is distinct from v_lista then
    n := public.projeto_recasar(v_uid);
  end if;
  return json_build_object('ok', true, 'etiquetas', cardinality(v_lista), 'leads_ajustados', n);
end;
$$;
grant execute on function public.agente_salvar_etiquetas(text, text[]) to anon, authenticated;

-- Agora: tira as tags abreviadas que o projeto_origem.sql tinha criado (ainda não há lista de etiquetas;
-- quando o Scale mandar a lista, cada lead recebe a etiqueta certa).
update public.leads l
set tags = array_remove(l.tags, l.projeto_sigla), projeto_sigla = null
where l.projeto_sigla is not null
  and not exists (select 1 from public.agente_config c where c.user_id = l.user_id and c.etiquetas_wa is not null);

select public.projeto_recasar(c.user_id) from public.agente_config c where c.etiquetas_wa is not null;

notify pgrst, 'reload schema';
