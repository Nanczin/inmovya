-- MENSAGEM POR PROJETO NOS PASSOS DA ESTEIRA
-- Um passo (ex.: P1) pode ter uma versão da mensagem/anexos para cada projeto.
-- O lead recebe a versão do projeto dele; sem projeto (ou sem versão), recebe a mensagem padrão.
-- Clique em Run uma única vez.

alter table public.esteira_passos add column if not exists variantes jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
