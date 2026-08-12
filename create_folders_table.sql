-- Create table for folders
CREATE TABLE IF NOT EXISTS material_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  parent_id UUID REFERENCES material_folders(id), -- For nested folders (optional implementation)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add folder_id to materiais table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materiais' AND column_name = 'folder_id') THEN
        ALTER TABLE materiais ADD COLUMN folder_id UUID REFERENCES material_folders(id);
    END IF;
END $$;

-- Enable RLS
ALTER TABLE material_folders ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can only see their own folders" ON material_folders;
CREATE POLICY "Users can only see their own folders" ON material_folders FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own folders" ON material_folders;
CREATE POLICY "Users can insert their own folders" ON material_folders FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own folders" ON material_folders;
CREATE POLICY "Users can update their own folders" ON material_folders FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own folders" ON material_folders;
CREATE POLICY "Users can delete their own folders" ON material_folders FOR DELETE USING (auth.uid() = user_id);
