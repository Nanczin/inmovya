-- Adicionar campo para imagem principal dos empreendimentos
ALTER TABLE public.empreendimentos 
ADD COLUMN imagem_principal TEXT;