-- ROBÔ DE ANÚNCIOS DENTRO DO INMOVYA SCALE (WhatsApp Business principal, pelo WhatsApp Web)
-- Precisa do agente_extensao.sql e do robo_anuncios.sql (já rodados). Rode no SQL Editor → colar tudo → Run.
--
-- O robô só fala com LEAD NOVO DE ANÚNCIO: número que nunca conversou com você, que não está no Inmovya
-- e que mandou a mensagem do anúncio ("Olá! Tenho interesse…"). Ele só trabalha quando você liga
-- no Inmovya (Esteiras → Robô de anúncios). A extensão usa o mesmo token do agente de 1º contato.
-- Nada é apagado.

create table if not exists public.robo_ext_config (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  ativo boolean not null default false,
  ativado_em timestamptz,
  ia_chave text,                                   -- chave da IA (Groq, gratuita); vazio = roteiro fixo
  ia_modelo text not null default 'openai/gpt-oss-120b',
  frases_anuncio text[] not null default array['tenho interesse', 'vi o anuncio', 'vi seu anuncio', 'vi o seu anuncio',
                                                'mais informacoes', 'gostaria de saber mais', 'quero saber mais'],
  recuperar_horas int not null default 12,         -- ao abrir o Chrome: responde quem escreveu nas últimas X horas
  numero_aviso text not null default '5511988782027', -- seu WhatsApp pessoal, recebe os avisos
  ultimo_sinal timestamptz,
  aviso text,
  updated_at timestamptz not null default now()
);
alter table public.robo_ext_config enable row level security;
drop policy if exists "robo_ext_config do dono" on public.robo_ext_config;
create policy "robo_ext_config do dono" on public.robo_ext_config
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- a conversa guarda a última mensagem do robô (para saber se VOCÊ entrou na conversa) e o histórico curto
alter table public.robo_conversas add column if not exists ultima_msg_robo text;
alter table public.robo_conversas add column if not exists msgs_robo int not null default 0;

-- Cadastro no Inmovya a partir do dono (mesma regra do robo_registrar_lead: fila de conferência → Validação)
create or replace function public.robo_registrar_lead_uid(v_uid uuid, p_nome text, p_telefone text, p_observacoes text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_d text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_tel text;
  v_nota text;
  v_lead public.leads;
  v_fila uuid;
  v_id uuid;
begin
  if (length(v_d) in (12, 13)) and left(v_d, 2) = '55' then v_d := substr(v_d, 3); end if;
  if length(v_d) not in (10, 11) then raise exception 'telefone inválido'; end if;
  v_tel := case when length(v_d) = 11
    then '(' || substr(v_d, 1, 2) || ') ' || substr(v_d, 3, 5) || '-' || substr(v_d, 8)
    else '(' || substr(v_d, 1, 2) || ') ' || substr(v_d, 3, 4) || '-' || substr(v_d, 7) end;
  v_nota := '[' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '] Robô de anúncios — '
            || coalesce(nullif(trim(p_observacoes), ''), 'sem respostas');

  select * into v_lead from public.leads l
  where l.user_id = v_uid
    and right(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g'), 8) = right(v_d, 8)
    and length(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g')) >= 10
  limit 1;
  if v_lead.id is not null then
    update public.leads set
      observacoes = concat_ws(E'\n', nullif(observacoes, ''), v_nota),
      nome = case when coalesce(nullif(trim(p_nome), ''), '') <> '' and nome in ('Lead do anúncio', '') then trim(p_nome) else nome end,
      tags = (select array_agg(distinct t) from unnest(coalesce(tags, '{}'::text[]) || array['anuncio', 'robo-anuncio']) t)
    where id = v_lead.id;
    return json_build_object('acao', 'ja_cadastrado', 'id', v_lead.id, 'nome', v_lead.nome);
  end if;

  select f.id into v_fila from public.captura_fila f
  where f.user_id = v_uid and f.status = 'pendente'
    and right(regexp_replace(coalesce(f.telefone, ''), '\D', '', 'g'), 8) = right(v_d, 8)
  limit 1;
  if v_fila is not null then
    update public.captura_fila set
      observacoes = concat_ws(E'\n', nullif(observacoes, ''), v_nota),
      nome = case when coalesce(nullif(trim(p_nome), ''), '') <> '' and nome = 'Lead do anúncio' then trim(p_nome) else nome end
    where id = v_fila;
    return json_build_object('acao', 'ja_na_fila', 'id', v_fila);
  end if;

  insert into public.captura_fila (user_id, fonte, nome, telefone, email, origem, observacoes, tags, status)
  values (v_uid, 'Robô de anúncios', coalesce(nullif(trim(p_nome), ''), 'Lead do anúncio'), v_tel,
          v_d || '@semEmail.com', 'anúncio', v_nota, array['anuncio', 'robo-anuncio'], 'pendente')
  returning id into v_id;
  return json_build_object('acao', 'na_fila_whatsapp', 'id', v_id);
end;
$$;
revoke all on function public.robo_registrar_lead_uid(uuid, text, text, text) from public, anon, authenticated;

-- A extensão pergunta (a cada minuto): o robô está ligado? com quais regras?
create or replace function public.robo_ext_estado(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
  v_cfg public.robo_ext_config;
  v_nome text;
begin
  if v_uid is null then raise exception 'token do agente inválido' using errcode = '28000'; end if;
  update public.robo_ext_config set ultimo_sinal = now() where user_id = v_uid returning * into v_cfg;
  if not found or not coalesce(v_cfg.ativo, false) then
    return json_build_object('ativo', false);
  end if;
  select meu_nome into v_nome from public.agente_config where user_id = v_uid;
  return json_build_object(
    'ativo', true,
    'ativado_em', v_cfg.ativado_em,
    'ia_chave', v_cfg.ia_chave,
    'ia_modelo', v_cfg.ia_modelo,
    'frases_anuncio', v_cfg.frases_anuncio,
    'recuperar_horas', v_cfg.recuperar_horas,
    'numero_aviso', v_cfg.numero_aviso,
    'meu_nome', coalesce(nullif(trim(v_nome), ''), 'Estevão')
  );
end;
$$;

-- Situação de um número: conversa do robô (se houver) e se já é lead/está na fila do Inmovya
create or replace function public.robo_ext_conversa(p_token text, p_telefone text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_row public.robo_conversas;
  v_lead boolean;
begin
  if v_uid is null then raise exception 'token do agente inválido' using errcode = '28000'; end if;
  if length(v_tel) < 10 then return json_build_object('conversa', null, 'ja_e_lead', false); end if;
  select * into v_row from public.robo_conversas where user_id = v_uid and right(telefone, 8) = right(v_tel, 8)
  order by updated_at desc limit 1;
  select exists (
    select 1 from public.leads l
    where l.user_id = v_uid
      and length(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g')) >= 10
      and right(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g'), 8) = right(v_tel, 8)
  ) or exists (
    select 1 from public.captura_fila f
    where f.user_id = v_uid and f.status = 'pendente'
      and right(regexp_replace(coalesce(f.telefone, ''), '\D', '', 'g'), 8) = right(v_tel, 8)
      and coalesce(f.fonte, '') <> 'Robô de anúncios'
  ) into v_lead;
  return json_build_object('conversa', case when v_row.telefone is null then null else row_to_json(v_row) end,
                           'ja_e_lead', v_lead);
end;
$$;

create or replace function public.robo_ext_salvar(p_token text, p_telefone text, p_dados jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
begin
  if v_uid is null then raise exception 'token do agente inválido' using errcode = '28000'; end if;
  if length(v_tel) < 10 then raise exception 'telefone inválido'; end if;
  insert into public.robo_conversas as c (user_id, telefone, chat_id, nome, empreendimento, etapa, respostas, situacao,
                                          atendido_por, resultado_inmovya, ultima_msg_robo, msgs_robo)
  values (v_uid, v_tel, p_dados->>'chat_id', p_dados->>'nome', p_dados->>'empreendimento',
          coalesce((p_dados->>'etapa')::int, 0), coalesce(p_dados->'respostas', '{}'::jsonb),
          coalesce(p_dados->>'situacao', 'qualificando'), 'extensao', p_dados->>'resultado_inmovya',
          p_dados->>'ultima_msg_robo', coalesce((p_dados->>'msgs_robo')::int, 0))
  on conflict (user_id, telefone) do update set
    nome = coalesce(excluded.nome, c.nome),
    empreendimento = coalesce(excluded.empreendimento, c.empreendimento),
    etapa = case when p_dados ? 'etapa' then excluded.etapa else c.etapa end,
    respostas = case when p_dados ? 'respostas' then excluded.respostas else c.respostas end,
    situacao = case when coalesce((p_dados->>'reiniciar')::boolean, false) then excluded.situacao
                    when c.situacao in ('concluido', 'transferido') then c.situacao else excluded.situacao end,
    atendido_por = 'extensao',
    resultado_inmovya = coalesce(excluded.resultado_inmovya, c.resultado_inmovya),
    ultima_msg_robo = case when p_dados ? 'ultima_msg_robo' then excluded.ultima_msg_robo else c.ultima_msg_robo end,
    msgs_robo = case when p_dados ? 'msgs_robo' then excluded.msgs_robo else c.msgs_robo end,
    updated_at = now();
  return json_build_object('ok', true);
end;
$$;

create or replace function public.robo_ext_registrar(p_token text, p_nome text, p_telefone text, p_observacoes text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
begin
  if v_uid is null then raise exception 'token do agente inválido' using errcode = '28000'; end if;
  return public.robo_registrar_lead_uid(v_uid, p_nome, p_telefone, p_observacoes);
end;
$$;

create or replace function public.robo_ext_aviso(p_token text, p_aviso text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
begin
  if v_uid is null then raise exception 'token do agente inválido' using errcode = '28000'; end if;
  update public.robo_ext_config set aviso = p_aviso, updated_at = now() where user_id = v_uid;
end;
$$;

grant execute on function public.robo_ext_estado(text) to anon, authenticated;
grant execute on function public.robo_ext_conversa(text, text) to anon, authenticated;
grant execute on function public.robo_ext_salvar(text, text, jsonb) to anon, authenticated;
grant execute on function public.robo_ext_registrar(text, text, text, text) to anon, authenticated;
grant execute on function public.robo_ext_aviso(text, text) to anon, authenticated;

-- ===== MODO TESTE (rode também esta parte) =====
-- Com um número de teste preenchido, o robô fala SÓ com ele e ignora o que aconteceu antes do início do teste.
alter table public.robo_ext_config add column if not exists teste_numero text;
alter table public.robo_ext_config add column if not exists teste_desde timestamptz;

create or replace function public.robo_ext_estado(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
  v_cfg public.robo_ext_config;
  v_nome text;
begin
  if v_uid is null then raise exception 'token do agente inválido' using errcode = '28000'; end if;
  update public.robo_ext_config set ultimo_sinal = now() where user_id = v_uid returning * into v_cfg;
  if not found or not coalesce(v_cfg.ativo, false) then
    return json_build_object('ativo', false);
  end if;
  select meu_nome into v_nome from public.agente_config where user_id = v_uid;
  return json_build_object(
    'ativo', true,
    'ativado_em', v_cfg.ativado_em,
    'ia_chave', v_cfg.ia_chave,
    'ia_modelo', v_cfg.ia_modelo,
    'frases_anuncio', v_cfg.frases_anuncio,
    'recuperar_horas', v_cfg.recuperar_horas,
    'numero_aviso', v_cfg.numero_aviso,
    'teste_numero', v_cfg.teste_numero,
    'teste_desde', v_cfg.teste_desde,
    'meu_nome', coalesce(nullif(trim(v_nome), ''), 'Estevão')
  );
end;
$$;
