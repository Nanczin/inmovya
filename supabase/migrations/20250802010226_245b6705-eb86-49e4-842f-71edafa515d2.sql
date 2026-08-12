-- Criar bucket para armazenar áudios gerados
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('audios', 'audios', true, 10485760, ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg']);

-- Criar políticas para o bucket de áudios
CREATE POLICY "Qualquer um pode visualizar áudios públicos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'audios');

CREATE POLICY "Usuários autenticados podem fazer upload de áudios" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'audios' AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem atualizar seus próprios áudios" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'audios' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuários podem deletar seus próprios áudios" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'audios' AND auth.uid()::text = (storage.foldername(name))[1]);