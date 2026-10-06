-- LEADS IMPORTADOS DO SCALE EM 06/10 -> PRÓXIMO PASSO AMANHÃ (07/10)
-- A importação colocou todos para "agora", mas o Scale já tinha avançado o passo após o envio.
-- Só mexe em quem está numa esteira e nunca recebeu envio pelo Inmovya. Mantém o passo atual.
-- Clique em Run uma única vez.

update public.leads
set esteira_proximo = '2026-10-07 00:00:00-03'
where esteira_id is not null
  and esteira_ultimo_envio is null
  and esteira_proximo <= now()
returning nome, esteira_passo, esteira_proximo;
