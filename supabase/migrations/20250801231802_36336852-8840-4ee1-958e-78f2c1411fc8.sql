-- Criar tabela para listas de contatos (mailings)
CREATE TABLE public.listas_contatos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  origem text NOT NULL DEFAULT 'Manual',
  total_contatos integer NOT NULL DEFAULT 0,
  validados integer NOT NULL DEFAULT 0,
  duplicados integer NOT NULL DEFAULT 0,
  invalidos integer NOT NULL DEFAULT 0,
  campanhas_ativas integer NOT NULL DEFAULT 0,
  taxa_entrega numeric(5,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'Ativa',
  configuracoes jsonb,
  metadados jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.listas_contatos ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view listas_contatos" 
ON public.listas_contatos 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create listas_contatos" 
ON public.listas_contatos 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update listas_contatos" 
ON public.listas_contatos 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete listas_contatos" 
ON public.listas_contatos 
FOR DELETE 
USING (true);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_listas_contatos_updated_at
BEFORE UPDATE ON public.listas_contatos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();