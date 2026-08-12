-- Add missing columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS temperatura TEXT CHECK (temperatura IN ('quente', 'morno', 'frio')),
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ultimo_contato TIMESTAMP WITH TIME ZONE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_leads_temperatura ON public.leads(temperatura);
CREATE INDEX IF NOT EXISTS idx_leads_tags ON public.leads USING GIN (tags);
