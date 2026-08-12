-- Remover o registro antigo com user_id 'admin'
DELETE FROM configuracoes WHERE user_id = 'admin';

-- Verificar se a constraint existe e recriá-la se necessário
ALTER TABLE configuracoes DROP CONSTRAINT IF EXISTS unique_user_config;
ALTER TABLE configuracoes ADD CONSTRAINT unique_user_config UNIQUE (user_id);