-- Remove registros duplicados, mantendo apenas o mais recente
DELETE FROM configuracoes 
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id 
  FROM configuracoes 
  ORDER BY user_id, updated_at DESC
);

-- Adicionar constraint única para prevenir duplicatas futuras
ALTER TABLE configuracoes ADD CONSTRAINT unique_user_config UNIQUE (user_id);