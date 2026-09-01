CREATE TABLE IF NOT EXISTS public.powerbi_funnel_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  period TEXT NOT NULL,
  visitas INTEGER DEFAULT 0,
  documentacao INTEGER DEFAULT 0,
  negociacao INTEGER DEFAULT 0,
  venda INTEGER DEFAULT 0,
  interacao_ajuste INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, period)
);

ALTER TABLE public.powerbi_funnel_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own metrics" ON public.powerbi_funnel_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own metrics" ON public.powerbi_funnel_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own metrics" ON public.powerbi_funnel_metrics
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own metrics" ON public.powerbi_funnel_metrics
  FOR DELETE USING (auth.uid() = user_id);
