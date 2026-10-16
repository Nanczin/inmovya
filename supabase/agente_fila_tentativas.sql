-- 1º CONTATO: quem já entrou na fila e falhou (erro / envio travado) tenta de novo até 3 vezes,
-- mesmo que tenha chegado antes de ligar o agente ou tenha sido escolhido por você.
-- (Antes, o lead escolhido por você que falhava uma vez saía da fila sem avisar.)
-- Precisa do agente_extensao.sql e do agente_fila_manual.sql (já rodados). Clique em Run uma única vez.

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
        -- escolhidos por você na tela
        l.primeiro_contato_status = 'na_fila'
        -- já entraram na fila e falharam: tentam de novo (até 3 vezes), seja automático ou escolhido
        or (l.primeiro_contato_status = 'erro' and l.primeiro_contato_tentativas < 3 and l.primeiro_contato_em < now() - interval '5 minutes')
        or (l.primeiro_contato_status = 'enviando' and l.primeiro_contato_tentativas < 3 and l.primeiro_contato_em < now() - interval '15 minutes')
        -- automáticos novos: chegaram depois de ligar o agente (até 3 dias) e são da regra escolhida
        or (
          l.primeiro_contato_status is null
          and l.created_at >= greatest(coalesce(v_cfg.ativado_em, now()), now() - interval '3 days')
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
