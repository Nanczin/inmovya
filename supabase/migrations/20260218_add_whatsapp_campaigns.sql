-- Create whatsapp_campaigns table
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  lista_id UUID,
  mensagem TEXT NOT NULL,
  variaveis JSONB,
  configuracao_cadencia JSONB,
  data_inicio TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'Rascunho',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE whatsapp_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for user" ON whatsapp_campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Enable insert access for user" ON whatsapp_campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update access for user" ON whatsapp_campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Enable delete access for user" ON whatsapp_campaigns FOR DELETE USING (auth.uid() = user_id);

-- Create whatsapp_campaign_messages table
CREATE TABLE IF NOT EXISTS whatsapp_campaign_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
  contato_id UUID,
  lead_id UUID,
  nome TEXT,
  telefone TEXT NOT NULL,
  mensagem_personalizada TEXT,
  status TEXT DEFAULT 'Pendente',
  erro TEXT,
  data_envio TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE whatsapp_campaign_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for user" ON whatsapp_campaign_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Enable insert access for user" ON whatsapp_campaign_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update access for user" ON whatsapp_campaign_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Enable delete access for user" ON whatsapp_campaign_messages FOR DELETE USING (auth.uid() = user_id);
