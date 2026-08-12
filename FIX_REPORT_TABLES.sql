-- Garante que as tabelas necessárias para os relatórios existam

-- Tabela email_logs (Histórico de disparos)
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    provider TEXT DEFAULT 'gmail',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    error_message TEXT,
    subject TEXT,
    campaign_id UUID
);

-- Tabela campanhas (Campanhas de Marketing)
CREATE TABLE IF NOT EXISTS campanhas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'concluida', 'rascunho')),
    tipo TEXT DEFAULT 'email' CHECK (tipo IN ('email', 'whatsapp', 'misto')),
    data_inicio TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    descricao TEXT
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_ligacoes_data_ligacao ON ligacoes(data_ligacao);
