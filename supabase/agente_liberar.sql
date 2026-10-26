-- 1º CONTATO: devolver o lead para a fila quando o agente foi desligado no meio do caminho
-- (o Inmovya Scale confere se o 1º contato ainda está ligado logo antes de enviar; se não estiver, chama isto).
-- O lead volta como "erro" sem gastar tentativa e já pronto para sair assim que você ligar de novo.
-- Rode no SQL Editor → colar tudo → Run.
create or replace function public.agente_liberar(p_token text, p_lead uuid)
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
  update public.leads
  set primeiro_contato_status = 'erro',
      primeiro_contato_erro = '1º contato desligado antes do envio — sai quando ligar de novo',
      primeiro_contato_tentativas = greatest(coalesce(primeiro_contato_tentativas, 1) - 1, 0),
      primeiro_contato_em = now() - interval '6 minutes'
  where id = p_lead and user_id = v_uid and primeiro_contato_status = 'enviando';
  return json_build_object('ok', found);
end;
$$;
grant execute on function public.agente_liberar(text, uuid) to anon, authenticated;
notify pgrst, 'reload schema';
