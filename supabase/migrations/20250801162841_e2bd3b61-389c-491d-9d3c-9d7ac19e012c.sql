-- Criar tabela de empreendimentos
CREATE TABLE public.empreendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  descricao TEXT,
  status TEXT DEFAULT 'ativo',
  valor_inicial DECIMAL,
  valor_final DECIMAL,
  data_lancamento DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  status TEXT DEFAULT 'novo',
  origem TEXT,
  empreendimento_id UUID REFERENCES public.empreendimentos(id),
  observacoes TEXT,
  data_contato TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de campanhas
CREATE TABLE public.campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT DEFAULT 'email',
  status TEXT DEFAULT 'rascunho',
  empreendimento_id UUID REFERENCES public.empreendimentos(id),
  conteudo JSONB,
  data_inicio TIMESTAMP WITH TIME ZONE,
  data_fim TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de configurações
CREATE TABLE public.configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tasker JSONB,
  ia JSONB,
  automacao JSONB,
  seguranca JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de vozes
CREATE TABLE public.vozes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'sintetica',
  arquivo_url TEXT,
  configuracoes JSONB,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de ligações
CREATE TABLE public.ligacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id),
  numero_telefone TEXT NOT NULL,
  status TEXT DEFAULT 'pendente',
  duracao INTEGER,
  gravacao_url TEXT,
  transcricao TEXT,
  resultado TEXT,
  data_ligacao TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.empreendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vozes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ligacoes ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS (permitindo acesso total por enquanto)
CREATE POLICY "Allow all for empreendimentos" ON public.empreendimentos FOR ALL USING (true);
CREATE POLICY "Allow all for leads" ON public.leads FOR ALL USING (true);
CREATE POLICY "Allow all for campanhas" ON public.campanhas FOR ALL USING (true);
CREATE POLICY "Allow all for configuracoes" ON public.configuracoes FOR ALL USING (true);
CREATE POLICY "Allow all for vozes" ON public.vozes FOR ALL USING (true);
CREATE POLICY "Allow all for ligacoes" ON public.ligacoes FOR ALL USING (true);

-- Criar função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers para updated_at
CREATE TRIGGER update_empreendimentos_updated_at
  BEFORE UPDATE ON public.empreendimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campanhas_updated_at
  BEFORE UPDATE ON public.campanhas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_configuracoes_updated_at
  BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vozes_updated_at
  BEFORE UPDATE ON public.vozes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ligacoes_updated_at
  BEFORE UPDATE ON public.ligacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir dados iniciais para empreendimentos
INSERT INTO public.empreendimentos (nome, endereco, cidade, estado, descricao, status, valor_inicial, valor_final, data_lancamento) VALUES
('Residencial Jardim das Flores', 'Rua das Palmeiras, 100', 'São Paulo', 'SP', 'Condomínio residencial com 120 apartamentos', 'ativo', 280000, 450000, '2024-01-15'),
('Edifício Central Plaza', 'Av. Paulista, 1500', 'São Paulo', 'SP', 'Empreendimento comercial no centro da cidade', 'ativo', 350000, 650000, '2024-02-01'),
('Vila Verde Condomínio', 'Rua Verde, 250', 'Campinas', 'SP', 'Casas em condomínio fechado', 'lancamento', 320000, 520000, '2024-03-01');

-- Inserir dados iniciais para vozes
INSERT INTO public.vozes (nome, tipo, configuracoes, ativa) VALUES
('Maria Santos', 'sintetica', '{"velocidade": 1.0, "tom": "feminino", "idioma": "pt-BR"}', true),
('João Silva', 'sintetica', '{"velocidade": 0.9, "tom": "masculino", "idioma": "pt-BR"}', true),
('Ana Costa', 'sintetica', '{"velocidade": 1.1, "tom": "feminino", "idioma": "pt-BR"}', false);