-- 1º CONTATO NA NUVEM (reserva): quando o seu computador está desligado, um servidor gratuito faz o 1º contato.
-- Regra: se a extensão (PC) deu sinal nos últimos 3 minutos, a nuvem NÃO faz nada. A reserva do lead
-- (agente_reservar) garante que um lead nunca recebe duas mensagens, mesmo se os dois tentarem juntos.
-- Rode uma vez no SQL Editor do Supabase. Não apaga nem muda nada que já existe.

alter table public.agente_config add column if not exists ultimo_sinal_nuvem timestamptz;   -- última vez que a nuvem conferiu
alter table public.agente_config add column if not exists etiquetas_origem jsonb;           -- etiquetas do WhatsApp por origem (o Inmovya grava)

-- A nuvem pergunta: o PC está ligado? Se não, quais leads esperam o 1º contato? (sem mexer no sinal do PC)
create or replace function public.agente_pendentes_nuvem(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.agente_usuario(p_token);
  v_sinal timestamptz;
  v_etq jsonb;
  v_r json;
begin
  if v_uid is null then
    raise exception 'token do agente inválido' using errcode = '28000';
  end if;
  select ultimo_sinal, etiquetas_origem into v_sinal, v_etq from public.agente_config where user_id = v_uid;
  update public.agente_config set ultimo_sinal_nuvem = now() where user_id = v_uid;
  if v_sinal is not null and v_sinal > now() - interval '3 minutes' then
    return json_build_object('ativo', false, 'pc_online', true, 'etiquetas', v_etq);
  end if;
  v_r := public.agente_pendentes(p_token);
  -- agente_pendentes marca o sinal do PC: devolve o valor antigo (o PC continua "desligado")
  update public.agente_config set ultimo_sinal = v_sinal where user_id = v_uid;
  return (v_r::jsonb || jsonb_build_object('pc_online', false, 'etiquetas', v_etq))::json;
end;
$$;
grant execute on function public.agente_pendentes_nuvem(text) to anon, authenticated;

notify pgrst, 'reload schema';
