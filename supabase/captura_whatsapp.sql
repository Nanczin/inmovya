-- CAPTURA SÓ COM WHATSAPP (Bitrix e Meta, igual ao Midrah)
-- Os leads que chegam do Bitrix e da Meta não entram direto no Inmovya: ficam numa fila (captura_fila).
-- O Inmovya Scale (Chrome aberto com o WhatsApp Web) confere a fila a cada 1 minuto, testa o número no WhatsApp e:
--   • tem WhatsApp  → cadastra o lead (etapa Validação, mesma origem/tags de antes) e o 1º contato atende;
--   • sem WhatsApp  → descarta (fica registrado na fila como "sem_whatsapp", não volta mais).
-- Telefone que já é lead no Inmovya continua só ganhando a anotação de reentrada (não precisa conferir).
-- Rode no SQL Editor → colar tudo → Run. Precisa do captura_midrah.sql já rodado.

create table if not exists public.captura_fila (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fonte text not null,
  nome text,
  telefone text,
  email text,
  origem text,
  observacoes text,
  tags text[] not null default '{}',
  status text not null default 'pendente', -- pendente | cadastrado | duplicado | sem_whatsapp | sem_telefone
  tentativas int not null default 0,
  lead_id uuid,
  created_at timestamptz not null default now(),
  resolvido_em timestamptz
);
create index if not exists captura_fila_pendentes on public.captura_fila (user_id, created_at) where status = 'pendente';
alter table public.captura_fila enable row level security;
drop policy if exists "captura_fila do dono" on public.captura_fila;
create policy "captura_fila do dono" on public.captura_fila
  for select to authenticated using (user_id = auth.uid());

-- o Scale pega até 5 números por vez para conferir
create or replace function public.agente_fila_captura(p_token text)
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
  return coalesce((
    select json_agg(json_build_object('id', f.id, 'nome', f.nome, 'telefone', f.telefone, 'fonte', f.fonte) order by f.created_at)
    from (
      select * from public.captura_fila
      where user_id = v_uid and status = 'pendente'
      order by created_at
      limit 5
    ) f
  ), '[]'::json);
end;
$$;

-- resposta do Scale: p_tem_whatsapp = true (cadastra), false (descarta), null (não deu para conferir: tenta de novo)
create or replace function public.agente_resolver_captura(p_token text, p_id uuid, p_tem_whatsapp boolean)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
  f public.captura_fila;
  v_chave text;
  v_nota text;
  v_exist record;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'token do agente inválido' using errcode = '28000';
  end if;
  select * into f from public.captura_fila where id = p_id and user_id = v_uid for update;
  if not found or f.status <> 'pendente' then
    return json_build_object('acao', 'ja_resolvido');
  end if;

  if p_tem_whatsapp is null then
    update public.captura_fila set tentativas = tentativas + 1 where id = f.id;
    return json_build_object('acao', 'tentar_de_novo');
  end if;

  if not p_tem_whatsapp then
    update public.captura_fila set status = 'sem_whatsapp', resolvido_em = now() where id = f.id;
    return json_build_object('acao', 'sem_whatsapp');
  end if;

  v_chave := public.captura_chave_telefone(f.telefone);
  v_nota := '[' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '] Lead recebido automaticamente via ' || f.fonte
            || case when coalesce(f.observacoes, '') <> '' then ' — ' || f.observacoes else '' end;

  -- chegou outro com o mesmo telefone enquanto esperava? só anota
  select l.id, l.observacoes, l.tags into v_exist
  from public.leads l
  where l.user_id = v_uid
    and length(v_chave) >= 8
    and (public.captura_chave_telefone(l.telefone) = v_chave
         or (length(public.captura_chave_telefone(l.telefone)) >= 10 and length(v_chave) >= 10
             and right(public.captura_chave_telefone(l.telefone), 8) = right(v_chave, 8)))
  limit 1;
  if found then
    update public.leads
    set observacoes = concat_ws(E'\n', nullif(v_exist.observacoes, ''), v_nota),
        tags = (select array_agg(distinct t) from unnest(coalesce(v_exist.tags, '{}'::text[]) || f.tags || array['reentrada']) t),
        ultimo_contato = now()
    where id = v_exist.id;
    update public.captura_fila set status = 'duplicado', lead_id = v_exist.id, resolvido_em = now() where id = f.id;
    return json_build_object('acao', 'duplicado_atualizado', 'id', v_exist.id);
  end if;

  insert into public.leads (nome, telefone, email, origem, observacoes, status, tags, ultimo_contato, user_id)
  values (
    coalesce(nullif(trim(f.nome), ''), 'Lead sem nome'),
    f.telefone,
    coalesce(nullif(trim(f.email), ''), 'sem-email+' || v_chave || '@inmovya.local'),
    f.origem,
    nullif(f.observacoes, ''),
    'Validação',
    f.tags,
    now(),
    v_uid
  )
  returning id into v_id;
  update public.captura_fila set status = 'cadastrado', lead_id = v_id, resolvido_em = now() where id = f.id;
  return json_build_object('acao', 'criado', 'id', v_id);
end;
$$;

revoke all on function public.agente_fila_captura(text) from public;
revoke all on function public.agente_resolver_captura(text, uuid, boolean) from public;
grant execute on function public.agente_fila_captura(text) to anon, authenticated;
grant execute on function public.agente_resolver_captura(text, uuid, boolean) to anon, authenticated;

-- quais negócios de fora (ex.: Midrah) já foram vistos — o Scale pula sem precisar conferir no WhatsApp
create or replace function public.agente_captura_vistos(p_token text, p_fonte text, p_ids text[])
returns text[]
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
  return coalesce((
    select array_agg(externo_id) from public.captura_vistos
    where user_id = v_uid and fonte = p_fonte and externo_id = any(coalesce(p_ids, '{}'::text[]))
  ), '{}'::text[]);
end;
$$;
revoke all on function public.agente_captura_vistos(text, text, text[]) from public;
grant execute on function public.agente_captura_vistos(text, text, text[]) to anon, authenticated;

notify pgrst, 'reload schema';
