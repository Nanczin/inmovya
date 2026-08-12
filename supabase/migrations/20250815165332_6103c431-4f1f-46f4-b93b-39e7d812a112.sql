-- Add field to store original launch date text
ALTER TABLE public.empreendimentos 
ADD COLUMN data_lancamento_texto TEXT;