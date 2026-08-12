-- Garantir que o bucket audios existe e está configurado corretamente
DO $$
BEGIN
  -- Inserir o bucket apenas se não existir
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'audios') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('audios', 'audios', true);
  END IF;
END $$;

-- Remover políticas existentes se existirem
DROP POLICY IF EXISTS "Permitir acesso público aos áudios" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload de áudios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload de áudios via API" ON storage.objects;

-- Criar políticas para o bucket audios (permitir acesso público)
CREATE POLICY "Permitir acesso público aos áudios" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'audios');

-- Permitir upload para usuários autenticados
CREATE POLICY "Permitir upload de áudios autenticados" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'audios' AND auth.uid() IS NOT NULL);

-- Permitir upload via service role (para API externa)
CREATE POLICY "Permitir upload de áudios via service role" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'audios');