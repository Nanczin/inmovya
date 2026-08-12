-- Create the mensagem_templates table if it doesn't exist
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

-- Enable Row Level Security (RLS)
ALTER TABLE mensagem_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for access control (adjust as needed for your specific auth requirements)

-- Allow read access to everyone (authenticated and anonymous) or just authenticated
CREATE POLICY "Enable read access for all users" ON mensagem_templates
    FOR SELECT USING (true);

-- Allow insert access only for authenticated users
CREATE POLICY "Enable insert access for authenticated users only" ON mensagem_templates
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow update access only for authenticated users
CREATE POLICY "Enable update access for authenticated users only" ON mensagem_templates
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow delete access only for authenticated users
CREATE POLICY "Enable delete access for authenticated users only" ON mensagem_templates
    FOR DELETE USING (auth.role() = 'authenticated');

-- If you are using Supabase Storage for files, you might also need to create a bucket
-- Uncomment the following lines if you want to set up the storage bucket via SQL (requires permissions)
-- insert into storage.buckets (id, name, public) values ('template_files', 'template_files', true);
-- create policy "Public Access" on storage.objects for select using ( bucket_id = 'template_files' );
-- create policy "Authenticated Insert" on storage.objects for insert with check ( bucket_id = 'template_files' and auth.role() = 'authenticated' );
