-- Criar tabela para timeline de eventos dos leads
CREATE TABLE public.lead_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note', 'status_change')),
  title TEXT NOT NULL,
  description TEXT,
  author TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.lead_timeline ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Users can view lead timeline events" 
ON public.lead_timeline 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create lead timeline events" 
ON public.lead_timeline 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update lead timeline events" 
ON public.lead_timeline 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete lead timeline events" 
ON public.lead_timeline 
FOR DELETE 
USING (true);

-- Criar trigger para timestamp automático
CREATE TRIGGER update_lead_timeline_updated_at
BEFORE UPDATE ON public.lead_timeline
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar índice para performance
CREATE INDEX idx_lead_timeline_lead_id ON public.lead_timeline(lead_id);
CREATE INDEX idx_lead_timeline_created_at ON public.lead_timeline(created_at DESC);