-- Criar tabela para armazenar contatos individuais das listas de mailing
CREATE TABLE public.contatos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lista_id UUID REFERENCES public.listas_contatos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'bloqueado')),
  dados_extras JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_contatos_lista_id ON public.contatos(lista_id);
CREATE INDEX idx_contatos_telefone ON public.contatos(telefone);
CREATE INDEX idx_contatos_status ON public.contatos(status);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contatos_updated_at
  BEFORE UPDATE ON public.contatos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Allow all for contatos" 
  ON public.contatos 
  FOR ALL 
  USING (true);

-- Inserir alguns contatos de exemplo na lista existente
INSERT INTO public.contatos (lista_id, nome, telefone, email) 
SELECT 
  id,
  'Estevão Garcia',
  '11987654321', 
  'estevao.v.garcia10@gmail.com'
FROM public.listas_contatos 
WHERE nome = 'teste inmovya'
LIMIT 1;