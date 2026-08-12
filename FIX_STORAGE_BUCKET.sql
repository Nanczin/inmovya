-- Script para corrigir o erro de Upload de Arquivos
-- Este script cria o Bucket necessário no Supabase Storage e configura as permissões.

-- 1. Criar o bucket 'template_files' (público para facilitar o acesso dos links)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('template_files', 'template_files', true, 10485760, NULL) -- Limite de 10MB
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Remover políticas antigas para evitar conflitos (opcional, mas seguro)
DROP POLICY IF EXISTS "Acesso Público Leitura" ON storage.objects;
DROP POLICY IF EXISTS "Acesso Autenticado Upload" ON storage.objects;
DROP POLICY IF EXISTS "Acesso Autenticado Delete" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert" ON storage.objects;

-- 3. Criar Política de LEITURA (Pública - qualquer pessoa com o link pode ver/baixar)
CREATE POLICY "Acesso Público Leitura"
ON storage.objects FOR SELECT
USING ( bucket_id = 'template_files' );

-- 4. Criar Política de UPLOAD (Apenas usuários logados)
CREATE POLICY "Acesso Autenticado Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'template_files' AND auth.role() = 'authenticated' );

-- 5. Criar Política de DELEÇÃO/ATUALIZAÇÃO (Apenas usuários logados)
CREATE POLICY "Acesso Autenticado Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'template_files' AND auth.role() = 'authenticated' );

CREATE POLICY "Acesso Autenticado Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'template_files' AND auth.role() = 'authenticated' );
