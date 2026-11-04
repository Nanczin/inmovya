-- ETIQUETAS DE PROJETO (projeto_origem → etiqueta do WhatsApp)
-- 1) Tabela projeto_etiquetas: as regras "padrão → etiqueta" (editáveis em Configurações).
--    Padrão: "collection + vila mariana" = precisa ter as duas palavras; "sarutai | saruutai" = qualquer uma;
--    "*" = qualquer outro projeto (etiqueta reserva, ex.: "Outros projetos").
--    Sem diferenciar maiúsculas, acentos e hífens.
-- 2) resolver_etiqueta_projeto(...): a ÚNICA função que transforma projeto_origem em etiqueta(s).
--    Projeto com "/" ("A / B") → uma etiqueta para cada parte. Projeto vazio → nenhuma.
-- 3) Gatilho em leads: todo lead novo ou com projeto_origem alterado (captura Bitrix, captura Midrah,
--    cadastro manual, importação CSV, edição) ganha etiqueta_projeto e fica "pendente" para o Inmovya Scale
--    pôr a etiqueta no WhatsApp. NÃO mexe em etapa, tags nem esteiras.
-- 4) Funções que a extensão usa (pendentes / resultado) e o "Sincronizar etiquetas de projeto".
-- Rode no SQL Editor → colar tudo → Run.

-- ---------- 1) regras ----------
create table if not exists public.projeto_etiquetas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  padrao text not null,
  etiqueta text not null,
  ordem int not null default 100,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.projeto_etiquetas enable row level security;
drop policy if exists projeto_etiquetas_dono on public.projeto_etiquetas;
create policy projeto_etiquetas_dono on public.projeto_etiquetas
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists projeto_etiquetas_user_idx on public.projeto_etiquetas (user_id, ordem);

-- ---------- colunas no lead ----------
alter table public.leads add column if not exists projeto_origem text;
alter table public.leads add column if not exists etiqueta_projeto text[];            -- etiqueta(s) resolvida(s)
alter table public.leads add column if not exists etiqueta_projeto_status text;        -- pendente | aplicada | ja_estava | sem_conversa | erro
alter table public.leads add column if not exists etiqueta_projeto_em timestamptz;     -- última tentativa
alter table public.leads add column if not exists etiqueta_projeto_tentativas int not null default 0;
alter table public.leads add column if not exists etiqueta_projeto_aviso text;
create index if not exists leads_etiqueta_projeto_status_idx on public.leads (user_id, etiqueta_projeto_status);

-- ---------- 2) a função única ----------
-- texto comparável: minúsculo, sem acento, hífens/traços viram espaço
create or replace function public.projeto_norm(p text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(regexp_replace(
           lower(translate(coalesce(p, ''),
             'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
             'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
           '[-_–—]+', ' ', 'g'), '\s+', ' ', 'g'));
$$;

-- o padrão casa com o texto? ("a + b" = os dois; "a | b" = qualquer um)
create or replace function public.projeto_padrao_casa(p_padrao text, p_texto text)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from unnest(string_to_array(coalesce(p_padrao, ''), '|')) alt
    where trim(alt) <> ''
      and not exists (
        select 1 from unnest(string_to_array(alt, '+')) termo
        where public.projeto_norm(termo) <> ''
          and position(public.projeto_norm(termo) in public.projeto_norm(p_texto)) = 0
      )
      and exists (select 1 from unnest(string_to_array(alt, '+')) termo where public.projeto_norm(termo) <> '')
  );
$$;

create or replace function public.resolver_etiqueta_projeto(p_uid uuid, p_projeto text)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_parte text;
  v_etq text;
  v_res text[] := '{}';
begin
  if coalesce(trim(p_projeto), '') = '' then
    return v_res;
  end if;
  foreach v_parte in array string_to_array(p_projeto, '/') loop
    if public.projeto_norm(v_parte) = '' then continue; end if;
    select r.etiqueta into v_etq
    from public.projeto_etiquetas r
    where r.user_id = p_uid and r.ativo and trim(r.padrao) <> '*'
      and public.projeto_padrao_casa(r.padrao, v_parte)
    order by r.ordem, r.created_at
    limit 1;
    if v_etq is null then
      select r.etiqueta into v_etq
      from public.projeto_etiquetas r
      where r.user_id = p_uid and r.ativo and trim(r.padrao) = '*'
      order by r.ordem, r.created_at
      limit 1;
    end if;
    if v_etq is not null and not (v_etq = any(v_res)) then
      v_res := v_res || v_etq;
    end if;
    v_etq := null;
  end loop;
  return v_res;
end;
$$;
revoke all on function public.resolver_etiqueta_projeto(uuid, text) from public, anon, authenticated;

-- para a tela do Inmovya (usuário logado): mesma função
create or replace function public.resolver_etiqueta_projeto_web(p_projeto text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select public.resolver_etiqueta_projeto(auth.uid(), p_projeto);
$$;
grant execute on function public.resolver_etiqueta_projeto_web(text) to authenticated;

-- ---------- 3) gatilho do lead (substitui o anterior) ----------
-- Preenche projeto_origem a partir das observações quando ainda está vazio ("Empreendimento: X" ou o
-- formato do Bitrix) e resolve a etiqueta. Não mexe em tags, etapa nem esteiras.
create or replace function public.leads_projeto_origem()
returns trigger
language plpgsql
as $$
declare
  v_novo text[];
  v_mudou_proj boolean;
begin
  if new.projeto_origem is null and (tg_op = 'INSERT' or new.observacoes is distinct from old.observacoes) then
    new.projeto_origem := public.projeto_do_lead(new.observacoes, new.nome);
  end if;
  if new.projeto_origem is not null and trim(new.projeto_origem) = '' then
    new.projeto_origem := null;
  end if;
  v_mudou_proj := tg_op = 'INSERT' or new.projeto_origem is distinct from old.projeto_origem;
  if not v_mudou_proj then
    return new;
  end if;
  v_novo := public.resolver_etiqueta_projeto(new.user_id, new.projeto_origem);
  new.etiqueta_projeto := nullif(v_novo, '{}'::text[]);
  if cardinality(v_novo) > 0 then
    new.etiqueta_projeto_status := 'pendente';
    new.etiqueta_projeto_tentativas := 0;
    new.etiqueta_projeto_aviso := null;
  else
    new.etiqueta_projeto_status := null;
    new.etiqueta_projeto_aviso := null;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_projeto_origem on public.leads;
create trigger leads_projeto_origem
before insert or update of observacoes, projeto_origem on public.leads
for each row execute function public.leads_projeto_origem();

-- regras mudaram (tela Configurações): recalcula a etiqueta de todos os leads; quem mudou fica pendente
create or replace function public.etiquetas_projeto_recalcular()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  n int;
begin
  if v_uid is null then raise exception 'faça login'; end if;
  with novo as (
    select l.id, nullif(public.resolver_etiqueta_projeto(v_uid, l.projeto_origem), '{}'::text[]) as e
    from public.leads l
    where l.user_id = v_uid
  )
  update public.leads l
  set etiqueta_projeto = novo.e,
      etiqueta_projeto_status = case when novo.e is null then null else 'pendente' end,
      etiqueta_projeto_tentativas = 0,
      etiqueta_projeto_aviso = null
  from novo
  where l.id = novo.id and l.etiqueta_projeto is distinct from novo.e;
  get diagnostics n = row_count;
  return json_build_object('alterados', n);
end;
$$;
grant execute on function public.etiquetas_projeto_recalcular() to authenticated;

-- botão "Sincronizar etiquetas de projeto": recalcula e põe TODOS os leads com projeto na fila
create or replace function public.etiquetas_projeto_sincronizar()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inicio timestamptz := now();
  n int;
begin
  if v_uid is null then raise exception 'faça login'; end if;
  perform public.etiquetas_projeto_recalcular();
  update public.leads l
  set etiqueta_projeto_status = 'pendente', etiqueta_projeto_tentativas = 0, etiqueta_projeto_aviso = null
  where l.user_id = v_uid and l.etiqueta_projeto is not null;
  get diagnostics n = row_count;
  return json_build_object('inicio', v_inicio, 'na_fila', n);
end;
$$;
grant execute on function public.etiquetas_projeto_sincronizar() to authenticated;

-- ---------- 4) extensão ----------
-- quem precisa de etiqueta (pendentes; sem conversa tenta de novo a cada 6 h; erro a cada 30 min)
create or replace function public.agente_etiquetas_projeto_pendentes(p_token text, p_limite int default 15)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
  v_reserva text;
  v_itens json;
begin
  if v_uid is null then
    raise exception 'token do agente inválido' using errcode = '28000';
  end if;
  select r.etiqueta into v_reserva from public.projeto_etiquetas r
  where r.user_id = v_uid and r.ativo and trim(r.padrao) = '*' order by r.ordem limit 1;
  select coalesce(json_agg(x), '[]'::json) into v_itens
  from (
    select l.id, l.nome, l.telefone, l.etiqueta_projeto as etiquetas
    from public.leads l
    where l.user_id = v_uid
      and l.etiqueta_projeto is not null
      and coalesce(l.telefone, '') <> ''
      and (
        l.etiqueta_projeto_status = 'pendente'
        or (l.etiqueta_projeto_status = 'sem_conversa' and l.etiqueta_projeto_em < now() - interval '6 hours' and l.etiqueta_projeto_tentativas < 30)
        or (l.etiqueta_projeto_status = 'erro' and l.etiqueta_projeto_em < now() - interval '30 minutes' and l.etiqueta_projeto_tentativas < 10)
      )
    order by (l.etiqueta_projeto_status = 'pendente') desc, l.created_at desc
    limit greatest(1, least(coalesce(p_limite, 15), 50))
  ) x;
  return json_build_object('reserva', v_reserva, 'itens', v_itens);
end;
$$;
grant execute on function public.agente_etiquetas_projeto_pendentes(text, int) to anon, authenticated;

create or replace function public.agente_etiqueta_projeto_resultado(p_token text, p_lead uuid, p_status text, p_aviso text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
begin
  if v_uid is null then
    raise exception 'token do agente inválido' using errcode = '28000';
  end if;
  if p_status not in ('aplicada', 'ja_estava', 'sem_conversa', 'erro') then
    raise exception 'status inválido';
  end if;
  update public.leads
  set etiqueta_projeto_status = p_status,
      etiqueta_projeto_em = now(),
      etiqueta_projeto_tentativas = case when p_status in ('aplicada', 'ja_estava') then 0 else etiqueta_projeto_tentativas + 1 end,
      etiqueta_projeto_aviso = nullif(trim(coalesce(p_aviso, '')), '')
  where id = p_lead and user_id = v_uid;
  return json_build_object('ok', found);
end;
$$;
grant execute on function public.agente_etiqueta_projeto_resultado(text, uuid, text, text) to anon, authenticated;

-- ---------- desliga o jeito antigo (casamento automático por nome e tag com o nome da etiqueta) ----------
-- A lista de etiquetas do WhatsApp continua chegando (só para a tela avisar se uma etiqueta não existe),
-- mas não mexe mais em lead nenhum.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'agente_salvar_etiquetas') then
    execute $f$
      create or replace function public.agente_salvar_etiquetas(p_token text, p_nomes text[])
      returns json
      language plpgsql
      security definer
      set search_path = public
      as $b$
      declare
        v_uid uuid := public.agente_usuario(p_token);
        v_lista text[];
      begin
        if v_uid is null then
          raise exception 'token do agente inválido' using errcode = '28000';
        end if;
        select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}') into v_lista
        from unnest(coalesce(p_nomes, '{}'::text[])) x where trim(x) <> '';
        if cardinality(v_lista) = 0 then
          return json_build_object('ok', false, 'motivo', 'lista vazia');
        end if;
        update public.agente_config set etiquetas_wa = v_lista, etiquetas_wa_em = now() where user_id = v_uid;
        return json_build_object('ok', true, 'etiquetas', cardinality(v_lista));
      end;
      $b$;
    $f$;
  end if;
end;
$$;
drop function if exists public.projeto_recasar(uuid);

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
  select l.projeto_origem, l.etiqueta_projeto into v from public.leads l where l.id = p_lead and l.user_id = v_uid;
  return json_build_object('projeto', v.projeto_origem, 'etiquetas', v.etiqueta_projeto);
end;
$$;

-- ---------- regras iniciais (só se você ainda não tiver nenhuma) ----------
insert into public.projeto_etiquetas (user_id, padrao, etiqueta, ordem)
select c.user_id, r.padrao, r.etiqueta, r.ordem
from public.agente_config c
cross join (values
  ('collection + vila mariana', 'The Collection Vila Mariana', 10),
  ('sync', 'Sync Ibirapuera', 20),
  ('sarutai | saruutai', 'Saruutaiá 45', 30),
  ('itapeva', 'RW Itapeva Paulista', 40),
  ('ousy', 'SCP Ousy Vila Mariana', 50),
  ('tom paraiso | t.o.m.', 'Tom Paraíso', 60),
  ('hipica', 'Jardim da Hípica', 70),
  ('bconnect', 'Bconnect Perdizes', 80),
  ('*', 'Outros projetos', 999)
) as r(padrao, etiqueta, ordem)
where not exists (select 1 from public.projeto_etiquetas p where p.user_id = c.user_id);

-- ---------- leads que já existem ----------
-- preenche projeto_origem (pelas observações) onde ainda está vazio
update public.leads l
set projeto_origem = public.projeto_do_lead(l.observacoes, l.nome)
where l.projeto_origem is null and public.projeto_do_lead(l.observacoes, l.nome) is not null;
-- resolve a etiqueta de todos; NÃO põe na fila (quem faz isso para os antigos é o botão "Sincronizar")
update public.leads l
set etiqueta_projeto = nullif(public.resolver_etiqueta_projeto(l.user_id, l.projeto_origem), '{}'::text[]),
    etiqueta_projeto_status = null,
    etiqueta_projeto_tentativas = 0,
    etiqueta_projeto_aviso = null;

notify pgrst, 'reload schema';

-- ---------- diagnóstico: a extensão conta como foi a última rodada (mostrado na tela de Sincronizar) ----------
alter table public.agente_config add column if not exists etiquetas_diag text;
alter table public.agente_config add column if not exists etiquetas_diag_em timestamptz;
create or replace function public.agente_etiquetas_diag(p_token text, p_texto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
begin
  if v_uid is null then
    raise exception 'token do agente inválido' using errcode = '28000';
  end if;
  update public.agente_config set etiquetas_diag = left(p_texto, 400), etiquetas_diag_em = now() where user_id = v_uid;
end;
$$;
grant execute on function public.agente_etiquetas_diag(text, text) to anon, authenticated;
notify pgrst, 'reload schema';
