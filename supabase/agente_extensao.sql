-- 1º CONTATO AUTOMÁTICO DENTRO DO INMOVYA SCALE (funciona com o Inmovya fechado).
-- Precisa do primeiro_contato.sql (já rodado). Clique em Run uma única vez.
--
-- A extensão não tem login do Inmovya: ela usa um TOKEN secreto do agente (gerado na tela
-- Esteiras → 1º contato) e só consegue chamar as funções abaixo, sempre presas ao dono do token.

create table if not exists public.agente_config (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  ativo boolean not null default false,
  ativado_em timestamptz,
  usar_ia boolean not null default true,
  quais text not null default 'captura',          -- captura | todos
  instrucoes text,
  mensagem_reserva text,
  meu_nome text,
  gemini_key text,
  token text unique,
  ultimo_sinal timestamptz,                        -- última vez que a extensão conferiu
  aviso text,                                      -- problema que a extensão encontrou (ou null)
  updated_at timestamptz not null default now()
);

alter table public.agente_config enable row level security;
drop policy if exists "agente_config do dono" on public.agente_config;
create policy "agente_config do dono" on public.agente_config
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- dono do token (uso interno)
create or replace function public.agente_usuario(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.agente_config where token = p_token and length(coalesce(p_token, '')) >= 32 limit 1;
$$;
revoke execute on function public.agente_usuario(text) from public, anon, authenticated;

-- A extensão pergunta (a cada minuto): está ligado? quais leads esperam o 1º contato?
create or replace function public.agente_pendentes(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
  v_cfg public.agente_config;
  v_leads json;
begin
  if v_uid is null then
    raise exception 'token do agente inválido' using errcode = '28000';
  end if;
  update public.agente_config set ultimo_sinal = now() where user_id = v_uid returning * into v_cfg;
  if not found or not coalesce(v_cfg.ativo, false) then
    return json_build_object('ativo', false);
  end if;

  select coalesce(json_agg(x order by x.created_at), '[]'::json) into v_leads
  from (
    select l.id, l.nome, l.telefone, l.origem, l.tags, l.observacoes, l.status, l.created_at,
           l.primeiro_contato_tentativas as tentativas
    from public.leads l
    where l.user_id = v_uid
      and l.created_at >= greatest(coalesce(v_cfg.ativado_em, now()), now() - interval '3 days')
      and (
        l.primeiro_contato_status is null
        or (l.primeiro_contato_status = 'erro' and l.primeiro_contato_tentativas < 3 and l.primeiro_contato_em < now() - interval '5 minutes')
        or (l.primeiro_contato_status = 'enviando' and l.primeiro_contato_tentativas < 3 and l.primeiro_contato_em < now() - interval '15 minutes')
      )
      and (
        v_cfg.quais = 'todos'
        or exists (select 1 from unnest(coalesce(l.tags, '{}'::text[])) t where lower(t) in ('meta ads', 'bitrix', 'roleta'))
        or lower(coalesce(l.origem, '')) in ('roleta', 'facebook', 'instagram', 'formulário', 'formulario')
      )
    order by l.created_at
    limit 10
  ) x;

  return json_build_object(
    'ativo', true,
    'config', json_build_object(
      'usar_ia', v_cfg.usar_ia,
      'instrucoes', v_cfg.instrucoes,
      'mensagem_reserva', v_cfg.mensagem_reserva,
      'meu_nome', v_cfg.meu_nome,
      'gemini_key', v_cfg.gemini_key
    ),
    'leads', v_leads
  );
end;
$$;

-- Reserva o lead para UM envio só e diz se o mesmo número já recebeu o 1º contato em outro lead.
create or replace function public.agente_reservar(p_token text, p_lead uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
  v_tel text;
  v_k text;
  v_outro text;
begin
  if v_uid is null then
    raise exception 'token do agente inválido' using errcode = '28000';
  end if;
  update public.leads
  set primeiro_contato_status = 'enviando',
      primeiro_contato_em = now(),
      primeiro_contato_erro = null,
      primeiro_contato_tentativas = primeiro_contato_tentativas + 1
  where id = p_lead
    and user_id = v_uid
    and (
      primeiro_contato_status is null
      or (primeiro_contato_status = 'erro' and primeiro_contato_tentativas < 3)
      or (primeiro_contato_status = 'enviando' and primeiro_contato_em < now() - interval '15 minutes' and primeiro_contato_tentativas < 3)
    )
  returning telefone into v_tel;
  if not found then
    return json_build_object('ok', false);
  end if;

  v_k := right(regexp_replace(coalesce(v_tel, ''), '\D', '', 'g'), 8);
  if length(v_k) = 8 then
    select coalesce(nome, id::text) into v_outro
    from public.leads
    where user_id = v_uid and id <> p_lead and primeiro_contato_status = 'enviado'
      and right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 8) = v_k
    limit 1;
  end if;
  return json_build_object('ok', true, 'outro', v_outro);
end;
$$;

-- Grava o resultado. Enviado: tag, histórico, Validação → Primeiro impacto (regra do Negócios põe na esteira
-- da coluna) e o D1 dessa esteira fica para amanhã (ele acabou de receber o 1º contato).
create or replace function public.agente_resultado(p_token text, p_lead uuid, p_status text, p_msg text, p_erro text, p_via text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
  v_antes text;
  v_mover boolean := false;
  v_est uuid;
  v_passo int;
  v_est_nome text;
begin
  if v_uid is null then
    raise exception 'token do agente inválido' using errcode = '28000';
  end if;
  if p_status not in ('enviado', 'pulado', 'erro') then
    raise exception 'status inválido: %', p_status;
  end if;

  if p_status <> 'enviado' then
    update public.leads
    set primeiro_contato_status = p_status, primeiro_contato_erro = p_erro, primeiro_contato_em = now()
    where id = p_lead and user_id = v_uid;
    return json_build_object('ok', found);
  end if;

  select status into v_antes from public.leads where id = p_lead and user_id = v_uid;
  if not found then
    return json_build_object('ok', false);
  end if;
  v_mover := v_antes is null or lower(trim(v_antes)) in ('', 'validação', 'validacao', 'novo', 'pendente', 'nenhuma');

  update public.leads
  set primeiro_contato_status = 'enviado',
      primeiro_contato_em = now(),
      primeiro_contato_msg = p_msg,
      primeiro_contato_erro = null,
      tags = case when '1º contato automático' = any(coalesce(tags, '{}'::text[])) then tags
                  else coalesce(tags, '{}'::text[]) || array['1º contato automático'] end,
      ultimo_contato = now(),
      status = case when v_mover then 'Primeiro impacto' else status end
  where id = p_lead and user_id = v_uid
  returning esteira_id, esteira_passo into v_est, v_passo;

  if v_mover and v_est is not null and coalesce(v_passo, 0) = 0 then
    update public.leads
    set esteira_proximo = (((now() at time zone 'America/Sao_Paulo')::date + 1)::timestamp at time zone 'America/Sao_Paulo')
    where id = p_lead;
    select nome into v_est_nome from public.esteiras where id = v_est;
  end if;

  insert into public.lead_timeline (lead_id, type, title, description, author)
  values (
    p_lead, 'note', '1º contato automático enviado no WhatsApp',
    coalesce(p_msg, '') || E'\n\n— escrito por: ' || coalesce(p_via, 'agente')
      || case when v_mover then E'\nEtapa em Negócios: ' || coalesce(nullif(v_antes, ''), 'sem etapa') || ' → Primeiro impacto' else '' end
      || case when v_est_nome is not null then E'\nEsteira ' || v_est_nome || ': D1 amanhã' else '' end,
    'Agente'
  );

  return json_build_object('ok', true, 'movido', v_mover, 'esteira', v_est_nome);
end;
$$;

-- A extensão avisa um problema (ex.: WhatsApp desconectado) ou limpa o aviso (null).
create or replace function public.agente_aviso(p_token text, p_aviso text)
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
  update public.agente_config set aviso = p_aviso, ultimo_sinal = now() where user_id = v_uid;
end;
$$;

grant execute on function public.agente_pendentes(text) to anon, authenticated;
grant execute on function public.agente_reservar(text, uuid) to anon, authenticated;
grant execute on function public.agente_resultado(text, uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.agente_aviso(text, text) to anon, authenticated;
