-- 1. CORRIGIR CHAVES ESTRANGEIRAS DE EMPREENDIMENTOS
-- Corrigir a tabela 'materiais' para apagar junto (CASCADE)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'materiais_empreendimento_id_fkey') THEN
    ALTER TABLE materiais DROP CONSTRAINT materiais_empreendimento_id_fkey;
  END IF;
END $$;

ALTER TABLE materiais
  ADD CONSTRAINT materiais_empreendimento_id_fkey
  FOREIGN KEY (empreendimento_id) REFERENCES empreendimentos(id) ON DELETE CASCADE;

-- Corrigir a tabela 'leads' para NÃO apagar o lead, apenas setar NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'leads_empreendimento_id_fkey') THEN
    ALTER TABLE leads DROP CONSTRAINT leads_empreendimento_id_fkey;
  END IF;
END $$;

ALTER TABLE leads
  ADD CONSTRAINT leads_empreendimento_id_fkey
  FOREIGN KEY (empreendimento_id) REFERENCES empreendimentos(id) ON DELETE SET NULL;


-- 2. CORRIGIR CHAVES ESTRANGEIRAS DE PASTAS (FOLDERS)
-- Se uma pasta for apagada, apagar também as subpastas (CASCADE)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'material_folders_parent_id_fkey') THEN
    ALTER TABLE material_folders DROP CONSTRAINT material_folders_parent_id_fkey;
  END IF;
END $$;

ALTER TABLE material_folders
  ADD CONSTRAINT material_folders_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES material_folders(id) ON DELETE CASCADE;

-- Se uma pasta for apagada, apagar também os materiais que estão dentro dela (CASCADE)
-- (Isso previne o erro 23503 direto no banco)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'materiais_folder_id_fkey') THEN
    ALTER TABLE materiais DROP CONSTRAINT materiais_folder_id_fkey;
  END IF;
END $$;

ALTER TABLE materiais
  ADD CONSTRAINT materiais_folder_id_fkey
  FOREIGN KEY (folder_id) REFERENCES material_folders(id) ON DELETE CASCADE;
