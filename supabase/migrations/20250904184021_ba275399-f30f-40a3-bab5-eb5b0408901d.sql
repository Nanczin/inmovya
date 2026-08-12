-- Add user_id column to leads table for proper access control
ALTER TABLE public.leads ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Set a default user_id for existing leads (you may need to update this manually for proper ownership)
-- For now, we'll leave existing records with NULL user_id and handle them in policies

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow all for leads" ON public.leads;

-- Create secure, user-specific RLS policies for leads
CREATE POLICY "Users can view their own leads" 
  ON public.leads 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own leads" 
  ON public.leads 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads" 
  ON public.leads 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads" 
  ON public.leads 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create a policy for leads without user_id (legacy data) - temporarily allow access to authenticated users
-- You should assign proper ownership to these leads and then remove this policy
CREATE POLICY "Authenticated users can access legacy leads" 
  ON public.leads 
  FOR ALL 
  USING (user_id IS NULL AND auth.role() = 'authenticated');

-- Update the leads table to make user_id NOT NULL for future records
-- We'll leave existing records as-is for now to avoid breaking them
ALTER TABLE public.leads ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Add an index for better performance on user_id queries
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);