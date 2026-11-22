-- Agenda: "Ir para" no compromisso e leads feitos dentro de um bloco
-- Rode uma vez no SQL Editor do Supabase. Não apaga nem muda nada que já existe.
alter table public.tasks add column if not exists acao_tipo text;
alter table public.tasks add column if not exists acao_alvo text;
alter table public.tasks add column if not exists leads_feitos jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';
