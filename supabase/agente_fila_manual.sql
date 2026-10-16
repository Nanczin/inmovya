-- 1º CONTATO: você escolhe quem entra e quem sai da fila (tela Esteiras → 1º contato).
--  • "Atender"  → primeiro_contato_status = 'na_fila': entra na fila mesmo tendo chegado antes de ligar o agente
--                 ou fora da regra "só captura" (leads de até 7 dias).
--  • "Tirar da fila" → primeiro_contato_status = 'pulado' (não é chamado).
-- Precisa do agente_extensao.sql (já rodado). Clique em Run uma única vez.

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
      and (
        -- escolhidos por você na tela
        (l.primeiro_contato_status = 'na_fila' and l.created_at >= now() - interval '7 days')
        or (
          -- automáticos: chegaram depois de ligar o agente (até 3 dias) e são da regra escolhida
          l.created_at >= greatest(coalesce(v_cfg.ativado_em, now()), now() - interval '3 days')
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

-- Reserva: agora também aceita o lead que você pôs na fila ('na_fila').
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
      or primeiro_contato_status = 'na_fila'
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

grant execute on function public.agente_pendentes(text) to anon, authenticated;
grant execute on function public.agente_reservar(text, uuid) to anon, authenticated;
