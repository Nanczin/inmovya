-- Criar bucket para imagens dos empreendimentos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('empreendimentos', 'empreendimentos', true);

-- Criar políticas para o bucket empreendimentos
CREATE POLICY "Qualquer um pode visualizar imagens dos empreendimentos"
ON storage.objects FOR SELECT
USING (bucket_id = 'empreendimentos');

CREATE POLICY "Usuários autenticados podem fazer upload de imagens"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'empreendimentos');

CREATE POLICY "Usuários autenticados podem atualizar imagens"
ON storage.objects FOR UPDATE
USING (bucket_id = 'empreendimentos');

CREATE POLICY "Usuários autenticados podem deletar imagens"
ON storage.objects FOR DELETE
USING (bucket_id = 'empreendimentos');