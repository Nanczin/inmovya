-- 1º CONTATO AUTOMÁTICO (agente com IA): guarda no lead se a primeira mensagem já foi enviada.
-- Clique em Run uma única vez.

alter table public.leads add column if not exists primeiro_contato_status text;      -- null | enviando | enviado | pulado | erro
alter table public.leads add column if not exists primeiro_contato_em timestamptz;
alter table public.leads add column if not exists primeiro_contato_msg text;
alter table public.leads add column if not exists primeiro_contato_erro text;
alter table public.leads add column if not exists primeiro_contato_tentativas int not null default 0;

create index if not exists leads_primeiro_contato_idx on public.leads (created_at) where primeiro_contato_status is null;

-- Reserva o lead para UM envio só. Duas abas ou dois computadores com o agente ligado
-- nunca pegam o mesmo lead: só um recebe "true".
-- Também libera de novo um envio que travou há mais de 15 minutos (aba fechada no meio)
-- e um erro com menos de 3 tentativas. Antes de mandar, o Inmovya Scale ainda confere
-- no WhatsApp se já existe mensagem sua na conversa.
create or replace function public.reservar_primeiro_contato(p_lead uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  ok boolean;
begin
  update public.leads
  set primeiro_contato_status = 'enviando',
      primeiro_contato_em = now(),
      primeiro_contato_erro = null,
      primeiro_contato_tentativas = primeiro_contato_tentativas + 1
  where id = p_lead
    and (
      primeiro_contato_status is null
      or (primeiro_contato_status = 'erro' and primeiro_contato_tentativas < 3)
      or (primeiro_contato_status = 'enviando' and primeiro_contato_em < now() - interval '15 minutes' and primeiro_contato_tentativas < 3)
    )
  returning true into ok;
  return coalesce(ok, false);
end;
$$;

grant execute on function public.reservar_primeiro_contato(uuid) to authenticated;
