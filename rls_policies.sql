-- RLS Policies for Inmovya
-- Run this in your Supabase SQL Editor to enforce rigorous data isolation at the database level.

-- Enable Row Level Security on all tables
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
CREATE POLICY "Users can only see their own leads" 
ON leads FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own leads" 
ON leads FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads" 
ON leads FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads" 
ON leads FOR DELETE 
USING (auth.uid() = user_id);

-- 2. Policies for EMPREENDIMENTOS
CREATE POLICY "Users can only see their own empreendimentos" 
ON empreendimentos FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own empreendimentos" 
ON empreendimentos FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own empreendimentos" 
ON empreendimentos FOR UPDATE 
USING (auth.uid() = user_id);

-- 3. Policies for LISTAS_CONTATOS
CREATE POLICY "Users can only see their own lists" 
ON listas_contatos FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lists" 
ON listas_contatos FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 4. Policies for CONTATOS
-- Note: Contatos usually belong to a list, and the list belongs to a user.
-- Assuming 'contatos' table has user_id just like others (if not, you need to join with listas_contatos)
-- For simplicity, if contatos has user_id:
CREATE POLICY "Users can only see their own contatos" 
ON contatos FOR SELECT 
USING (auth.uid() = user_id);
-- If contatos does NOT have user_id, you rely on the list ownership:
-- CREATE POLICY "Users can see contatos in their lists" ON contatos FOR SELECT USING (lista_id IN (SELECT id FROM listas_contatos WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own contatos" 
ON contatos FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contatos"
ON contatos FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own contatos"
ON contatos FOR UPDATE
USING (auth.uid() = user_id);


-- 5. Policies for LIGACOES
CREATE POLICY "Users can only see their own ligacoes" 
ON ligacoes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ligacoes" 
ON ligacoes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 6. Policies for CAMPAIGNS & EMAIL LOGS
CREATE POLICY "Users can see their own campaigns" 
ON campanhas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own campaigns" ON campanhas FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can see their own email logs" 
ON email_logs FOR SELECT USING (auth.uid() = user_id);

-- 7. Policies for GMAIL ACCOUNTS & TEMPLATES
CREATE POLICY "Users can see their own gmail accounts" 
ON gmail_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own gmail accounts" ON gmail_accounts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can see their own templates" 
ON mensagem_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own templates" ON mensagem_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own templates" ON mensagem_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own templates" ON mensagem_templates FOR DELETE USING (auth.uid() = user_id);

-- 8. Policies for TIMELINE
-- Assuming timeline items belong to a lead, and lead belongs to user.
-- Join-based policy:
CREATE POLICY "Users can see timeline for their leads" 
ON lead_timeline FOR SELECT 
USING (
  lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert timeline for their leads" 
ON lead_timeline FOR INSERT 
WITH CHECK (
  lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid())
);
