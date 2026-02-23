-- Migrar configuração de resposta automática para phone_numbers.
-- Seguro: verifica se as colunas existem antes de tentar usá-las.

-- 1. Adicionar colunas em phone_numbers
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS auto_reply_message TEXT;
COMMENT ON COLUMN phone_numbers.auto_reply_enabled IS 'Se true, o número envia resposta automática.';
COMMENT ON COLUMN phone_numbers.auto_reply_message IS 'Mensagem de resposta automática por número; null usa fallback de response_config.';

-- 2. Migrar dados de auto_reply_phone_config (se as colunas enabled/message ainda existirem)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'auto_reply_phone_config' AND column_name = 'enabled'
  ) THEN
    EXECUTE '
      UPDATE phone_numbers p
      SET
        auto_reply_enabled = COALESCE(c.enabled, false),
        auto_reply_message = NULLIF(TRIM(c.message), '''')
      FROM auto_reply_phone_config c
      WHERE c.meta_phone_number_id = p.meta_phone_number_id
    ';
    ALTER TABLE auto_reply_phone_config DROP COLUMN IF EXISTS enabled;
    ALTER TABLE auto_reply_phone_config DROP COLUMN IF EXISTS message;
  END IF;
END $$;
