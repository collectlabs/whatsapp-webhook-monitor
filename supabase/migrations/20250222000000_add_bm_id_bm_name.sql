-- BM como entidade principal: adicionar bm_id e bm_name nas tabelas que têm waba_id.
-- Estrutura: BM >> WABA >> NUMBER_ID; token vinculado à BM.

ALTER TABLE webhook_messages
  ADD COLUMN IF NOT EXISTS bm_id TEXT,
  ADD COLUMN IF NOT EXISTS bm_name TEXT;

ALTER TABLE webhook_alerts
  ADD COLUMN IF NOT EXISTS bm_id TEXT,
  ADD COLUMN IF NOT EXISTS bm_name TEXT;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS bm_id TEXT,
  ADD COLUMN IF NOT EXISTS bm_name TEXT;

-- Opcional: phone_number_meta (só altera se a tabela existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'phone_number_meta') THEN
    ALTER TABLE phone_number_meta
      ADD COLUMN IF NOT EXISTS bm_id TEXT,
      ADD COLUMN IF NOT EXISTS bm_name TEXT;
  END IF;
END $$;

-- waba_health_status já possui bm_id; adicionar bm_name se não existir
ALTER TABLE waba_health_status
  ADD COLUMN IF NOT EXISTS bm_name TEXT;
