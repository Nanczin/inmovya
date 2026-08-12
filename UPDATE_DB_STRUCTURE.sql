-- Atualização da tabela email_queue para suportar anexos
-- Adiciona a coluna 'attachments' do tipo JSONB caso ela não exista

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_queue' AND column_name = 'attachments') THEN 
        ALTER TABLE email_queue ADD COLUMN attachments JSONB DEFAULT '[]'::JSONB; 
    END IF; 
END $$;

-- Atualização da tabela mensagem_templates (caso ainda não tenha sido criada ou atualizada)
-- Garante que as colunas de arquivo existam
CREATE TABLE IF NOT EXISTS mensagem_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('whatsapp', 'email')),
  conteudo TEXT NOT NULL,
  assunto TEXT,
  categoria TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Se a tabela já existia mas sem as colunas novas, adiciona elas:
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mensagem_templates' AND column_name = 'arquivo_url') THEN 
        ALTER TABLE mensagem_templates ADD COLUMN arquivo_url TEXT; 
    END IF; 

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mensagem_templates' AND column_name = 'arquivo_nome') THEN 
        ALTER TABLE mensagem_templates ADD COLUMN arquivo_nome TEXT; 
    END IF; 
END $$;
