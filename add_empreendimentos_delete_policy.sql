-- Policy to allow users to delete their own empreendimentos
DROP POLICY IF EXISTS "Users can delete their own empreendimentos" ON empreendimentos;
CREATE POLICY "Users can delete their own empreendimentos" ON empreendimentos FOR DELETE USING (auth.uid() = user_id);
