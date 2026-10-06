-- ANEXOS NAS ESTEIRAS (PDF, vídeo, imagem, áudio, documentos)
-- Os arquivos ficam no computador; o banco guarda só o nome de cada anexo.
-- Clique em Run uma única vez.

alter table public.esteira_passos add column if not exists anexos jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
