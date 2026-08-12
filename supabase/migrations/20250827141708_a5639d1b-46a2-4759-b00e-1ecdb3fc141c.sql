-- Criar tabela para materiais
CREATE TABLE public.materiais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  empreendimento_id UUID REFERENCES public.empreendimentos(id),
  descricao TEXT,
  tags TEXT[] DEFAULT '{}',
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tamanho BIGINT,
  arquivo_tipo TEXT,
  downloads INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view all materials" 
ON public.materiais 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own materials" 
ON public.materiais 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own materials" 
ON public.materiais 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own materials" 
ON public.materiais 
FOR DELETE 
USING (auth.uid() = user_id);

-- Criar bucket para storage de materiais
INSERT INTO storage.buckets (id, name, public) VALUES ('materiais', 'materiais', false);

-- Políticas de storage para materiais
CREATE POLICY "Users can view materials files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'materiais');

CREATE POLICY "Users can upload materials files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'materiais' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own materials files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'materiais' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own materials files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'materiais' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_materiais_updated_at
BEFORE UPDATE ON public.materiais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();