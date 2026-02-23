-- Elimina a tabela auto_reply_phone_config. Toda configuração agora está em phone_numbers.
-- Seguro: cria colunas se não existirem e verifica se a tabela source existe antes de migrar.

-- 1. Garantir que display_phone_number exista em phone_numbers
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS display_phone_number TEXT;

-- 2. Migrar dados e dropar tabela (só se auto_reply_phone_config existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'auto_reply_phone_config'
  ) THEN
    -- Migrar phone_number -> display_phone_number
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'auto_reply_phone_config' AND column_name = 'phone_number'
    ) THEN
      UPDATE phone_numbers p
      SET display_phone_number = c.phone_number
      FROM auto_reply_phone_config c
      WHERE c.meta_phone_number_id = p.meta_phone_number_id
        AND c.phone_number IS NOT NULL
        AND c.phone_number <> ''
        AND (p.display_phone_number IS NULL OR p.display_phone_number = '');
    END IF;

    -- Migrar allowed_for_sending -> enabled_for_sending (onde era false)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'auto_reply_phone_config' AND column_name = 'allowed_for_sending'
    ) THEN
      UPDATE phone_numbers p
      SET enabled_for_sending = c.allowed_for_sending
      FROM auto_reply_phone_config c
      WHERE c.meta_phone_number_id = p.meta_phone_number_id
        AND c.allowed_for_sending = false;
    END IF;

    DROP TABLE auto_reply_phone_config;
  END IF;
END $$;
