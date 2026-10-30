-- DINHEIRO NA MESA (Inmovya Scale, dentro do WhatsApp Web)
-- Oferta ativa em cima de uma ETIQUETA do WhatsApp: a extensão extrai os contatos da etiqueta e você liga um por um,
-- classificando como na Oferta Ativa do Inmovya. Cada classificação chama esta função (com o token do agente):
--   • grava a ligação em "ligacoes" (conta nas ligações do dia, nas metas e nos relatórios, igual à Oferta Ativa)
--   • lead que já existe (mesmo telefone): anotação na linha do tempo + observações; "Deny List" põe a tag deny list;
--     etapa escolhida muda a etapa
--   • "Cliente Interessado" de quem ainda não é lead: cadastra o lead (origem "Dinheiro na Mesa", tag "dinheiro na mesa")
-- Nada é apagado. Rode no SQL Editor → colar tudo → Run.

create or replace function public.agente_dnm_registrar(
  p_token text,
  p_nome text,
  p_telefone text,
  p_etiqueta text,
  p_classificacao text,
  p_nota text,
  p_etapa text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
  v_d text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_tel text;
  v_lead public.leads;
  v_interessado boolean := p_classificacao in ('Cliente Interessado', 'Interessado e Interação Efetiva');
  v_texto text;
  v_acao text := 'so_ligacao';
  v_etapa text := nullif(trim(coalesce(p_etapa, '')), '');
  v_etiqueta text := nullif(trim(coalesce(p_etiqueta, '')), '');
begin
  if v_uid is null then
    raise exception 'token do agente inválido' using errcode = '28000';
  end if;
  if coalesce(p_classificacao, '') not in ('Cliente Interessado', 'Caixa Postal/Cliente Não Atendeu', 'Número não existe', 'Deny List') then
    raise exception 'classificação inválida: %', p_classificacao;
  end if;
  if v_etapa is not null and v_etapa not in ('20%', '50%', '70%', 'Fechado') then v_etapa := null; end if;

  if (length(v_d) in (12, 13)) and left(v_d, 2) = '55' then v_d := substr(v_d, 3); end if;
  v_tel := case
    when length(v_d) = 11 then '(' || substr(v_d, 1, 2) || ') ' || substr(v_d, 3, 5) || '-' || substr(v_d, 8)
    when length(v_d) = 10 then '(' || substr(v_d, 1, 2) || ') ' || substr(v_d, 3, 4) || '-' || substr(v_d, 7)
    else coalesce(nullif(trim(p_telefone), ''), 'sem telefone') end;

  if length(v_d) >= 8 then
    select * into v_lead from public.leads l
    where l.user_id = v_uid
      and length(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g')) >= 8
      and right(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g'), 8) = right(v_d, 8)
    order by l.created_at desc
    limit 1;
  end if;

  v_texto := 'Dinheiro na Mesa' || coalesce(' (etiqueta ' || v_etiqueta || ')', '') || ': ' || p_classificacao
             || coalesce(E'\n' || nullif(trim(coalesce(p_nota, '')), ''), '');

  if v_lead.id is not null then
    update public.leads set
      observacoes = concat_ws(E'\n', nullif(observacoes, ''),
                    '[' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '] ' || v_texto),
      ultimo_contato = now(),
      status = coalesce(v_etapa, status),
      tags = case when p_classificacao = 'Deny List'
                  then (select array_agg(distinct t) from unnest(coalesce(tags, '{}'::text[]) || array['deny list']) t)
                  else tags end
    where id = v_lead.id;
    insert into public.lead_timeline (lead_id, type, title, description, author, metadata)
    values (v_lead.id, 'call', 'Ligação — Dinheiro na Mesa', v_texto, 'Dinheiro na Mesa',
            jsonb_build_object('classificacao', p_classificacao, 'etiqueta', v_etiqueta));
    v_acao := 'lead_atualizado';
  elsif v_interessado then
    insert into public.leads (nome, telefone, email, status, origem, observacoes, tags, wa_etiqueta, ultimo_contato, user_id)
    values (coalesce(nullif(trim(p_nome), ''), 'Lead sem nome'), v_tel,
            case when length(v_d) >= 10 then v_d || '@semEmail.com' else null end,
            coalesce(v_etapa, '20%'), 'Dinheiro na Mesa',
            '[' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '] ' || v_texto,
            array['dinheiro na mesa'], v_etiqueta, now(), v_uid)
    returning * into v_lead;
    insert into public.lead_timeline (lead_id, type, title, description, author, metadata)
    values (v_lead.id, 'call', 'Ligação — Dinheiro na Mesa', v_texto, 'Dinheiro na Mesa',
            jsonb_build_object('classificacao', p_classificacao, 'etiqueta', v_etiqueta));
    v_acao := 'lead_criado';
  end if;

  -- a ligação (mesma tabela da Oferta Ativa: conta nas ligações do dia, metas e relatórios)
  insert into public.ligacoes (lead_id, numero_telefone, status, resultado, duracao, data_ligacao, user_id)
  values (v_lead.id, v_tel, case when v_interessado then 'interacao' else 'realizada' end, p_classificacao, 0, now(), v_uid);

  return json_build_object('ok', true, 'acao', v_acao, 'lead_id', v_lead.id, 'lead_nome', v_lead.nome);
end;
$$;

-- Ligações de hoje (para o placar da tela, igual à Oferta Ativa)
create or replace function public.agente_dnm_placar(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'ligacoes_hoje', count(*),
    'interacoes_hoje', count(*) filter (where status = 'interacao')
  )
  from public.ligacoes
  where user_id = public.agente_usuario(p_token)
    and data_ligacao >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
$$;

grant execute on function public.agente_dnm_registrar(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.agente_dnm_placar(text) to anon, authenticated;

notify pgrst, 'reload schema';
