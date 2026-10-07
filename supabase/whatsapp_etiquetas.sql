-- ETIQUETAS DO WHATSAPP (Inmovya -> WhatsApp)
-- Guarda quais etiquetas do funil já foram colocadas na conversa de cada lead,
-- para o botão "Sincronizar etiquetas" saber quem está desatualizado.
-- Clique em Run uma única vez.

alter table public.leads add column if not exists wa_etiqueta text;

notify pgrst, 'reload schema';
