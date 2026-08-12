-- Comprehensive Database Fix Script
-- This script does 3 things:
-- 1. Adds the 'user_id' column to all tables that might be missing it.
-- 2. Links 'user_id' to the auth.users table for reference integrity.
-- 3. Drops old policies and Re-applies the RLS policies safely.

-- PART 1: ADD MISSING COLUMNS
-- We use a DO block to check existence before adding to avoid errors if column exists.

DO $$ 
BEGIN 
    -- 1. leads
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'user_id') THEN 
        ALTER TABLE leads ADD COLUMN user_id UUID REFERENCES auth.users(id); 
    END IF;

    -- 2. empreendimentos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'empreendimentos' AND column_name = 'user_id') THEN 
        ALTER TABLE empreendimentos ADD COLUMN user_id UUID REFERENCES auth.users(id); 
    END IF;

    -- 3. listas_contatos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'listas_contatos' AND column_name = 'user_id') THEN 
        ALTER TABLE listas_contatos ADD COLUMN user_id UUID REFERENCES auth.users(id); 
    END IF;

    -- 4. contatos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contatos' AND column_name = 'user_id') THEN 
        ALTER TABLE contatos ADD COLUMN user_id UUID REFERENCES auth.users(id); 
    END IF;

    -- 5. ligacoes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ligacoes' AND column_name = 'user_id') THEN 
        ALTER TABLE ligacoes ADD COLUMN user_id UUID REFERENCES auth.users(id); 
    END IF;

    -- 6. campanhas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campanhas' AND column_name = 'user_id') THEN 
        ALTER TABLE campanhas ADD COLUMN user_id UUID REFERENCES auth.users(id); 
    END IF;

    -- 7. email_logs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_logs' AND column_name = 'user_id') THEN 
        ALTER TABLE email_logs ADD COLUMN user_id UUID REFERENCES auth.users(id); 
    END IF;

    -- 8. gmail_accounts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gmail_accounts' AND column_name = 'user_id') THEN 
        ALTER TABLE gmail_accounts ADD COLUMN user_id UUID REFERENCES auth.users(id); 
    END IF;

    -- 9. mensagem_templates
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mensagem_templates' AND column_name = 'user_id') THEN 
        ALTER TABLE mensagem_templates ADD COLUMN user_id UUID REFERENCES auth.users(id); 
    END IF;
END $$;


-- PART 2: ENABLE RLS
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


-- PART 3: APPLY POLICIES (Drop first to avoid confusion)

-- LEADS
DROP POLICY IF EXISTS "Users can only see their own leads" ON leads;
CREATE POLICY "Users can only see their own leads" ON leads FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own leads" ON leads;
CREATE POLICY "Users can insert their own leads" ON leads FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own leads" ON leads;
CREATE POLICY "Users can update their own leads" ON leads FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own leads" ON leads;
CREATE POLICY "Users can delete their own leads" ON leads FOR DELETE USING (auth.uid() = user_id);

-- EMPREENDIMENTOS
DROP POLICY IF EXISTS "Users can only see their own empreendimentos" ON empreendimentos;
CREATE POLICY "Users can only see their own empreendimentos" ON empreendimentos FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own empreendimentos" ON empreendimentos;
CREATE POLICY "Users can insert their own empreendimentos" ON empreendimentos FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own empreendimentos" ON empreendimentos;
CREATE POLICY "Users can update their own empreendimentos" ON empreendimentos FOR UPDATE USING (auth.uid() = user_id);

-- LISTAS_CONTATOS
DROP POLICY IF EXISTS "Users can only see their own lists" ON listas_contatos;
CREATE POLICY "Users can only see their own lists" ON listas_contatos FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own lists" ON listas_contatos;
CREATE POLICY "Users can insert their own lists" ON listas_contatos FOR INSERT WITH CHECK (auth.uid() = user_id);

-- CONTATOS
DROP POLICY IF EXISTS "Users can only see their own contatos" ON contatos;
CREATE POLICY "Users can only see their own contatos" ON contatos FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own contatos" ON contatos;
CREATE POLICY "Users can insert their own contatos" ON contatos FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own contatos" ON contatos;
CREATE POLICY "Users can update their own contatos" ON contatos FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own contatos" ON contatos;
CREATE POLICY "Users can delete their own contatos" ON contatos FOR DELETE USING (auth.uid() = user_id);

-- LIGACOES
DROP POLICY IF EXISTS "Users can only see their own ligacoes" ON ligacoes;
CREATE POLICY "Users can only see their own ligacoes" ON ligacoes FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own ligacoes" ON ligacoes;
CREATE POLICY "Users can insert their own ligacoes" ON ligacoes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- CAMPAIGNS & EMAIL LOGS
DROP POLICY IF EXISTS "Users can see their own campaigns" ON campanhas;
CREATE POLICY "Users can see their own campaigns" ON campanhas FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON campanhas;
CREATE POLICY "Users can insert their own campaigns" ON campanhas FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can see their own email logs" ON email_logs;
CREATE POLICY "Users can see their own email logs" ON email_logs FOR SELECT USING (auth.uid() = user_id);

-- GMAIL ACCOUNTS & TEMPLATES
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

-- TIMELINE
DROP POLICY IF EXISTS "Users can see timeline for their leads" ON lead_timeline;
CREATE POLICY "Users can see timeline for their leads" ON lead_timeline FOR SELECT USING (lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert timeline for their leads" ON lead_timeline;
CREATE POLICY "Users can insert timeline for their leads" ON lead_timeline FOR INSERT WITH CHECK (lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid()));
