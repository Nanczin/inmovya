-- Garantir que o bucket audios existe e está configurado corretamente
-- Verificar se o bucket já existe antes de tentar criar
DO $$
BEGIN
  -- Inserir o bucket apenas se não existir
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'audios') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('audios', 'audios', true);
  END IF;
END $$;

-- Criar políticas para o bucket audios (permitir upload e acesso público)
CREATE POLICY IF NOT EXISTS "Permitir acesso público aos áudios" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'audios');

CREATE POLICY IF NOT EXISTS "Permitir upload de áudios autenticados" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'audios' AND auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Permitir upload de áudios via API" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'audios');