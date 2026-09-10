ALTER TABLE public.powerbi_funnel_metrics
  ADD COLUMN IF NOT EXISTS ligacoes INTEGER NOT NULL DEFAULT 0;
