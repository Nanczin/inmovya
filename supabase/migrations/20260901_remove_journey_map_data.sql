-- Limpa a coluna journey_map_data de todos os leads para liberar espaço
UPDATE public.leads SET journey_map_data = NULL;

-- Remove a tabela de templates da jornada do lead
DROP TABLE IF EXISTS public.journey_node_templates;
