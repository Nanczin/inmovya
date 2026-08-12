-- Corrigir função para definir search_path seguro
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- Verificar se a função está correta agora
SELECT routine_name, security_type, search_path 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'update_updated_at_column';