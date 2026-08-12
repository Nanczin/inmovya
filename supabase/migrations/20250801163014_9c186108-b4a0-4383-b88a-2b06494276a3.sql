-- Corrigir função para definir search_path seguro
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';