-- CAPTURA DE LEADS DO CRM MIDRAH → INMOVYA
-- O Inmovya Scale (no seu Chrome, com o Midrah aberto) confere os seus negócios do Midrah a cada 1 minuto
-- e cadastra no Inmovya quem é novo, igual à captura do Bitrix e da Meta:
--   • etapa Validação (aba Negócios), origem "Midrah", tag "Midrah";
--   • não duplica: se o telefone já existe, o lead existente só ganha uma anotação e a tag;
--   • o mesmo negócio do Midrah nunca é cadastrado duas vezes;
--   • entra no aviso de lead novo e no 1º contato automático (como Bitrix e Meta).
-- Precisa do agente_extensao.sql (token do 1º contato) já rodado. Rode no SQL Editor → colar tudo → Run.

create table if not exists public.captura_vistos (
  user_id uuid not null references auth.users(id) on delete cascade,
  fonte text not null,
  externo_id text not null,
  lead_id uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, fonte, externo_id)
);
alter table public.captura_vistos enable row level security;
drop policy if exists "captura_vistos do dono" on public.captura_vistos;
create policy "captura_vistos do dono" on public.captura_vistos
  for select to authenticated using (user_id = auth.uid());

-- telefone só com dígitos, sem o 55
create or replace function public.captura_chave_telefone(p text)
returns text
language sql
immutable
as $$
  select case
    when length(d) in (12, 13) and d like '55%' then substr(d, 3)
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x;
$$;

-- telefone no formato do app: (11) 99999-9999
create or replace function public.captura_formatar_telefone(p text)
returns text
language sql
immutable
as $$
  select case
    when length(k) = 11 then '(' || substr(k, 1, 2) || ') ' || substr(k, 3, 5) || '-' || substr(k, 8)
    when length(k) = 10 then '(' || substr(k, 1, 2) || ') ' || substr(k, 3, 4) || '-' || substr(k, 7)
    else coalesce(nullif(trim(p), ''), '')
  end
  from (select public.captura_chave_telefone(p) as k) x;
$$;

create or replace function public.agente_cadastrar_lead(
  p_token text,
  p_fonte text,
  p_externo text,
  p_nome text,
  p_telefone text,
  p_email text,
  p_empreendimento text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
  v_fonte text := coalesce(nullif(trim(p_fonte), ''), 'Midrah');
  v_chave text := public.captura_chave_telefone(p_telefone);
  v_tel text := public.captura_formatar_telefone(p_telefone);
  v_nota text := '[' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '] Lead recebido automaticamente via ' || v_fonte
                 || case when coalesce(trim(p_empreendimento), '') <> '' then ' — ' || trim(p_empreendimento) else '' end;
  v_exist record;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'token do agente inválido' using errcode = '28000';
  end if;
  if coalesce(trim(p_externo), '') = '' then
    raise exception 'negócio sem identificador';
  end if;

  -- o mesmo negócio nunca entra duas vezes
  insert into public.captura_vistos (user_id, fonte, externo_id)
  values (v_uid, v_fonte, p_externo)
  on conflict do nothing;
  if not found then
    return json_build_object('acao', 'ja_visto');
  end if;

  if length(v_chave) < 8 then
    return json_build_object('acao', 'sem_telefone');
  end if;

  -- mesmo telefone já cadastrado: só anota
  select l.id, l.observacoes, l.tags into v_exist
  from public.leads l
  where l.user_id = v_uid
    and (public.captura_chave_telefone(l.telefone) = v_chave
         or (length(public.captura_chave_telefone(l.telefone)) >= 10 and right(public.captura_chave_telefone(l.telefone), 8) = right(v_chave, 8)))
  limit 1;

  if found then
    update public.leads
    set observacoes = concat_ws(E'\n', nullif(v_exist.observacoes, ''), v_nota),
        tags = (select array_agg(distinct t) from unnest(coalesce(v_exist.tags, '{}'::text[]) || array[v_fonte, 'reentrada']) t),
        ultimo_contato = now()
    where id = v_exist.id;
    update public.captura_vistos set lead_id = v_exist.id where user_id = v_uid and fonte = v_fonte and externo_id = p_externo;
    return json_build_object('acao', 'duplicado_atualizado', 'id', v_exist.id);
  end if;

  insert into public.leads (nome, telefone, email, origem, observacoes, status, tags, ultimo_contato, user_id)
  values (
    coalesce(nullif(trim(p_nome), ''), 'Lead sem nome'),
    v_tel,
    coalesce(nullif(trim(p_email), ''), 'sem-email+' || v_chave || '@inmovya.local'),
    v_fonte,
    case
      when coalesce(trim(p_empreendimento), '') <> '' then 'Empreendimento: ' || trim(p_empreendimento) || E'\n' || v_nota
      else 'Lead criado automaticamente pela captura do ' || v_fonte || E'\n' || v_nota
    end,
    'Validação',
    array[v_fonte],
    now(),
    v_uid
  )
  returning id into v_id;

  update public.captura_vistos set lead_id = v_id where user_id = v_uid and fonte = v_fonte and externo_id = p_externo;
  return json_build_object('acao', 'criado', 'id', v_id);
end;
$$;

revoke all on function public.agente_cadastrar_lead(text, text, text, text, text, text, text) from public;
grant execute on function public.agente_cadastrar_lead(text, text, text, text, text, text, text) to anon, authenticated;

-- aviso de lead novo também para o Midrah
create or replace function public.notify_new_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.origem, '')) in ('roleta', 'midrah')
     or 'roleta' = any(coalesce(new.tags, '{}'::text[]))
     or 'Meta Ads' = any(coalesce(new.tags, '{}'::text[]))
     or 'Midrah' = any(coalesce(new.tags, '{}'::text[])) then
    perform net.http_post(
      url := 'https://hhtzdxtythejyykrpgqw.supabase.co/functions/v1/notify-new-lead',
      body := jsonb_build_object('lead_id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
  return new;
end;
$$;

-- 1º contato automático: só Bitrix e Meta. Leads do Midrah NÃO recebem (o próprio Midrah já faz o 1º contato)
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
          and lower(coalesce(l.origem, '')) <> 'midrah'
          and (
            v_cfg.quais = 'todos'
            or exists (select 1 from unnest(coalesce(l.tags, '{}'::text[])) t where lower(t) in ('meta ads', 'bitrix', 'roleta'))
            or lower(coalesce(l.origem, '')) in ('roleta', 'facebook', 'instagram', 'formulário', 'formulario')
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
