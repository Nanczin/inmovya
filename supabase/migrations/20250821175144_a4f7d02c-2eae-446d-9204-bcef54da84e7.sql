-- Adicionar coluna de tags/etiquetas na tabela leads
ALTER TABLE public.leads 
ADD COLUMN tags TEXT[] DEFAULT '{}';

-- Criar índice para melhor performance nas consultas por tags
CREATE INDEX idx_leads_tags ON public.leads USING GIN(tags);