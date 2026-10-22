-- ROBÔ DE ANÚNCIOS (OpenWA, número dedicado aos anúncios)
-- O robô roda no PC (principal) e, se o PC estiver desligado, no servidor da nuvem (reserva).
-- Este arquivo cria:
--   robo_config     → a senha do robô (guardada só como hash) e o "estou vivo" do PC e da nuvem
--   robo_conversas  → em que pergunta cada contato está (PC e nuvem enxergam a mesma conversa)
--   funções que o robô chama com a senha dele: robo_sinal, robo_conversa, robo_salvar_conversa,
--   robo_registrar_lead
-- E muda o 1º contato automático para NÃO mandar mensagem para quem já foi atendido pelo robô.
-- Nada é apagado. Rode no SQL Editor → colar tudo → Run.

create table if not exists public.robo_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null,
  ativo boolean not null default true,
  pc_sinal timestamptz,
  nuvem_sinal timestamptz,
  created_at timestamptz not null default now()
);
alter table public.robo_config enable row level security;
drop policy if exists "robo_config do dono" on public.robo_config;
create policy "robo_config do dono" on public.robo_config
  for select to authenticated using (user_id = auth.uid());

create table if not exists public.robo_conversas (
  user_id uuid not null references auth.users(id) on delete cascade,
  telefone text not null,                       -- só dígitos, com 55
  chat_id text,
  nome text,
  empreendimento text,
  etapa int not null default 0,                 -- próxima pergunta
  respostas jsonb not null default '{}'::jsonb,
  situacao text not null default 'qualificando', -- qualificando | concluido | transferido
  atendido_por text,                            -- pc | nuvem
  resultado_inmovya text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, telefone)
);
alter table public.robo_conversas enable row level security;
drop policy if exists "robo_conversas do dono" on public.robo_conversas;
create policy "robo_conversas do dono" on public.robo_conversas
  for select to authenticated using (user_id = auth.uid());

create or replace function public.robo_usuario(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.robo_config
  where length(coalesce(p_token, '')) >= 20
    and token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  limit 1;
$$;
revoke all on function public.robo_usuario(text) from public, anon, authenticated;

-- "Estou vivo". O PC sempre atende; a nuvem só atende se o PC estiver calado há mais de 3 minutos.
create or replace function public.robo_sinal(p_token text, p_quem text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.robo_usuario(p_token);
  v_cfg public.robo_config;
begin
  if v_uid is null then raise exception 'senha do robô inválida' using errcode = '28000'; end if;
  if p_quem = 'pc' then
    update public.robo_config set pc_sinal = now() where user_id = v_uid returning * into v_cfg;
    return json_build_object('ativo', v_cfg.ativo, 'atende', v_cfg.ativo);
  end if;
  update public.robo_config set nuvem_sinal = now() where user_id = v_uid returning * into v_cfg;
  return json_build_object(
    'ativo', v_cfg.ativo,
    'atende', v_cfg.ativo and (v_cfg.pc_sinal is null or v_cfg.pc_sinal < now() - interval '3 minutes'),
    'pc_sinal', v_cfg.pc_sinal
  );
end;
$$;

create or replace function public.robo_conversa(p_token text, p_telefone text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.robo_usuario(p_token);
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_row public.robo_conversas;
  v_lead boolean;
begin
  if v_uid is null then raise exception 'senha do robô inválida' using errcode = '28000'; end if;
  select * into v_row from public.robo_conversas where user_id = v_uid and telefone = v_tel;
  -- já é lead no Inmovya (de qualquer origem)? O robô não aborda quem já está em atendimento.
  select exists (
    select 1 from public.leads l
    where l.user_id = v_uid
      and length(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g')) >= 10
      and right(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g'), 8) = right(v_tel, 8)
  ) into v_lead;
  return json_build_object('conversa', case when v_row.telefone is null then null else row_to_json(v_row) end,
                           'ja_e_lead', v_lead);
end;
$$;

create or replace function public.robo_salvar_conversa(p_token text, p_telefone text, p_dados jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.robo_usuario(p_token);
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
begin
  if v_uid is null then raise exception 'senha do robô inválida' using errcode = '28000'; end if;
  if length(v_tel) < 10 then raise exception 'telefone inválido'; end if;
  insert into public.robo_conversas as c (user_id, telefone, chat_id, nome, empreendimento, etapa, respostas, situacao, atendido_por, resultado_inmovya)
  values (v_uid, v_tel, p_dados->>'chat_id', p_dados->>'nome', p_dados->>'empreendimento',
          coalesce((p_dados->>'etapa')::int, 0), coalesce(p_dados->'respostas', '{}'::jsonb),
          coalesce(p_dados->>'situacao', 'qualificando'), p_dados->>'atendido_por', p_dados->>'resultado_inmovya')
  on conflict (user_id, telefone) do update set
    chat_id = coalesce(excluded.chat_id, c.chat_id),
    nome = coalesce(excluded.nome, c.nome),
    empreendimento = coalesce(excluded.empreendimento, c.empreendimento),
    etapa = case when p_dados ? 'etapa' then excluded.etapa else c.etapa end,
    respostas = case when p_dados ? 'respostas' then excluded.respostas else c.respostas end,
    -- uma conversa encerrada nunca volta a ser "qualificando"
    situacao = case when c.situacao in ('concluido', 'transferido') then c.situacao else excluded.situacao end,
    atendido_por = coalesce(excluded.atendido_por, c.atendido_por),
    resultado_inmovya = coalesce(excluded.resultado_inmovya, c.resultado_inmovya),
    updated_at = now();
  return json_build_object('ok', true);
end;
$$;

-- Cadastro no Inmovya: mesma porta de entrada dos leads de fora (fila de conferência do WhatsApp → Validação).
create or replace function public.robo_registrar_lead(p_token text, p_nome text, p_telefone text, p_observacoes text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.robo_usuario(p_token);
  v_d text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_tel text;
  v_nota text;
  v_lead public.leads;
  v_fila uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'senha do robô inválida' using errcode = '28000'; end if;
  if (length(v_d) in (12, 13)) and left(v_d, 2) = '55' then v_d := substr(v_d, 3); end if;
  if length(v_d) not in (10, 11) then raise exception 'telefone inválido'; end if;
  v_tel := case when length(v_d) = 11
    then '(' || substr(v_d, 1, 2) || ') ' || substr(v_d, 3, 5) || '-' || substr(v_d, 8)
    else '(' || substr(v_d, 1, 2) || ') ' || substr(v_d, 3, 4) || '-' || substr(v_d, 7) end;
  v_nota := '[' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '] Robô de anúncios — '
            || coalesce(nullif(trim(p_observacoes), ''), 'sem respostas');

  -- já é lead: só acrescenta as respostas nas observações e a tag
  select * into v_lead from public.leads l
  where l.user_id = v_uid
    and right(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g'), 8) = right(v_d, 8)
    and length(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g')) >= 10
  limit 1;
  if v_lead.id is not null then
    update public.leads set
      observacoes = concat_ws(E'\n', nullif(observacoes, ''), v_nota),
      tags = (select array_agg(distinct t) from unnest(coalesce(tags, '{}'::text[]) || array['anuncio', 'robo-anuncio']) t)
    where id = v_lead.id;
    return json_build_object('acao', 'ja_cadastrado', 'id', v_lead.id, 'nome', v_lead.nome);
  end if;

  select f.id into v_fila from public.captura_fila f
  where f.user_id = v_uid and f.status = 'pendente'
    and right(regexp_replace(coalesce(f.telefone, ''), '\D', '', 'g'), 8) = right(v_d, 8)
  limit 1;
  if v_fila is not null then
    update public.captura_fila set observacoes = concat_ws(E'\n', nullif(observacoes, ''), v_nota) where id = v_fila;
    return json_build_object('acao', 'ja_na_fila', 'id', v_fila);
  end if;

  insert into public.captura_fila (user_id, fonte, nome, telefone, email, origem, observacoes, tags, status)
  values (v_uid, 'Robô de anúncios', coalesce(nullif(trim(p_nome), ''), 'Lead do anúncio'), v_tel,
          v_d || '@semEmail.com', 'anúncio', v_nota, array['anuncio', 'robo-anuncio'], 'pendente')
  returning id into v_id;
  return json_build_object('acao', 'na_fila_whatsapp', 'id', v_id);
end;
$$;

grant execute on function public.robo_sinal(text, text) to anon, authenticated;
grant execute on function public.robo_conversa(text, text) to anon, authenticated;
grant execute on function public.robo_salvar_conversa(text, text, jsonb) to anon, authenticated;
grant execute on function public.robo_registrar_lead(text, text, text, text) to anon, authenticated;

-- 1º contato automático: não manda mensagem para quem o robô de anúncios já atendeu
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

  select coalesce(json_agg(x order by x.manual desc, x.created_at), '[]'::json) into v_leads
  from (
    select l.id, l.nome, l.telefone, l.origem, l.tags, l.observacoes, l.status, l.created_at,
           l.primeiro_contato_tentativas as tentativas,
           (l.primeiro_contato_status = 'na_fila') as manual
    from public.leads l
    where l.user_id = v_uid
      and l.created_at >= now() - interval '7 days'
      and (
        l.primeiro_contato_status = 'na_fila'
        or (l.primeiro_contato_status = 'erro' and l.primeiro_contato_tentativas < 3 and l.primeiro_contato_em < now() - interval '5 minutes')
        or (l.primeiro_contato_status = 'enviando' and l.primeiro_contato_tentativas < 3 and l.primeiro_contato_em < now() - interval '15 minutes')
        or (
          l.primeiro_contato_status is null
          and l.created_at >= greatest(coalesce(v_cfg.ativado_em, now()), now() - interval '3 days')
          and (coalesce(v_cfg.incluir_midrah, false) or lower(coalesce(l.origem, '')) <> 'midrah')
          and not ('robo-anuncio' = any(coalesce(l.tags, '{}'::text[])))
          and (
            v_cfg.quais = 'todos'
            or exists (select 1 from unnest(coalesce(l.tags, '{}'::text[])) t where lower(t) in ('meta ads', 'bitrix', 'roleta'))
            or lower(coalesce(l.origem, '')) in ('roleta', 'facebook', 'instagram', 'formulário', 'formulario')
            or (coalesce(v_cfg.incluir_midrah, false) and lower(coalesce(l.origem, '')) = 'midrah')
          )
        )
      )
    order by (l.primeiro_contato_status = 'na_fila') desc, l.created_at
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

grant execute on function public.agente_pendentes(text) to anon, authenticated;

notify pgrst, 'reload schema';
