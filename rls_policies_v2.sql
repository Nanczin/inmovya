-- RLS Policies for Inmovya (Updated to handle existing policies)
-- Run this in your Supabase SQL Editor.
-- This script first DROPS existing policies to avoid "policy already exists" errors, then recreating them.

-- Enable Row Level Security on all tables (idempotent, harmless if already enabled)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE empreendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE listas_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ligacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagem_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_timeline ENABLE ROW LEVEL SECURITY;

-- 1. Policies for LEADS
DROP POLICY IF EXISTS "Users can only see their own leads" ON leads;
CREATE POLICY "Users can only see their own leads" ON leads FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own leads" ON leads;
CREATE POLICY "Users can insert their own leads" ON leads FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own leads" ON leads;
CREATE POLICY "Users can update their own leads" ON leads FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own leads" ON leads;
CREATE POLICY "Users can delete their own leads" ON leads FOR DELETE USING (auth.uid() = user_id);

-- 2. Policies for EMPREENDIMENTOS
DROP POLICY IF EXISTS "Users can only see their own empreendimentos" ON empreendimentos;
CREATE POLICY "Users can only see their own empreendimentos" ON empreendimentos FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own empreendimentos" ON empreendimentos;
CREATE POLICY "Users can insert their own empreendimentos" ON empreendimentos FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own empreendimentos" ON empreendimentos;
CREATE POLICY "Users can update their own empreendimentos" ON empreendimentos FOR UPDATE USING (auth.uid() = user_id);

-- 3. Policies for LISTAS_CONTATOS
DROP POLICY IF EXISTS "Users can only see their own lists" ON listas_contatos;
CREATE POLICY "Users can only see their own lists" ON listas_contatos FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own lists" ON listas_contatos;
CREATE POLICY "Users can insert their own lists" ON listas_contatos FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Policies for CONTATOS
DROP POLICY IF EXISTS "Users can only see their own contatos" ON contatos;
CREATE POLICY "Users can only see their own contatos" ON contatos FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own contatos" ON contatos;
CREATE POLICY "Users can insert their own contatos" ON contatos FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own contatos" ON contatos;
CREATE POLICY "Users can delete their own contatos" ON contatos FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own contatos" ON contatos;
CREATE POLICY "Users can update their own contatos" ON contatos FOR UPDATE USING (auth.uid() = user_id);

-- 5. Policies for LIGACOES
DROP POLICY IF EXISTS "Users can only see their own ligacoes" ON ligacoes;
CREATE POLICY "Users can only see their own ligacoes" ON ligacoes FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own ligacoes" ON ligacoes;
CREATE POLICY "Users can insert their own ligacoes" ON ligacoes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Policies for CAMPAIGNS & EMAIL LOGS
DROP POLICY IF EXISTS "Users can see their own campaigns" ON campanhas;
CREATE POLICY "Users can see their own campaigns" ON campanhas FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own campaigns" ON campanhas;
CREATE POLICY "Users can insert their own campaigns" ON campanhas FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can see their own email logs" ON email_logs;
CREATE POLICY "Users can see their own email logs" ON email_logs FOR SELECT USING (auth.uid() = user_id);

-- 7. Policies for GMAIL ACCOUNTS & TEMPLATES
DROP POLICY IF EXISTS "Users can see their own gmail accounts" ON gmail_accounts;
CREATE POLICY "Users can see their own gmail accounts" ON gmail_accounts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own gmail accounts" ON gmail_accounts;
CREATE POLICY "Users can update their own gmail accounts" ON gmail_accounts FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can see their own templates" ON mensagem_templates;
CREATE POLICY "Users can see their own templates" ON mensagem_templates FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own templates" ON mensagem_templates;
CREATE POLICY "Users can insert their own templates" ON mensagem_templates FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own templates" ON mensagem_templates;
CREATE POLICY "Users can update their own templates" ON mensagem_templates FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own templates" ON mensagem_templates;
CREATE POLICY "Users can delete their own templates" ON mensagem_templates FOR DELETE USING (auth.uid() = user_id);

-- 8. Policies for TIMELINE
DROP POLICY IF EXISTS "Users can see timeline for their leads" ON lead_timeline;
CREATE POLICY "Users can see timeline for their leads" ON lead_timeline FOR SELECT USING (lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert timeline for their leads" ON lead_timeline;
CREATE POLICY "Users can insert timeline for their leads" ON lead_timeline FOR INSERT WITH CHECK (lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid()));
