-- Padronização PARTE 2/3: WABAS (waba_uuid, PK meta_waba_id) e PHONE_NUMBERS.
-- Rode após 20250222140000; depois rode 20250222140002.

-- ========== 6. WABAS: adicionar waba_uuid e preparar meta_waba_id como PK ==========
ALTER TABLE wabas ADD COLUMN IF NOT EXISTS waba_uuid UUID;
UPDATE wabas SET waba_uuid = id WHERE waba_uuid IS NULL AND id IS NOT NULL;
ALTER TABLE wabas ALTER COLUMN waba_uuid SET NOT NULL;
ALTER TABLE wabas ALTER COLUMN waba_uuid SET DEFAULT gen_random_uuid();

UPDATE wabas SET meta_waba_id = COALESCE(NULLIF(TRIM(meta_waba_id), ''), id::text) WHERE (meta_waba_id IS NULL OR TRIM(meta_waba_id) = '') AND id IS NOT NULL;
ALTER TABLE wabas ALTER COLUMN meta_waba_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wabas_waba_uuid_key ON wabas(waba_uuid);

-- ========== 7. PHONE_NUMBERS: migrar waba_id para waba_uuid ==========
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS waba_uuid UUID;
UPDATE phone_numbers p SET waba_uuid = w.waba_uuid FROM wabas w WHERE w.id = p.waba_id AND p.waba_uuid IS NULL;
ALTER TABLE phone_numbers DROP CONSTRAINT IF EXISTS fk_phone_numbers_waba_id;
ALTER TABLE phone_numbers DROP CONSTRAINT IF EXISTS phone_numbers_waba_id_fkey;
ALTER TABLE phone_numbers DROP COLUMN IF EXISTS waba_id;
ALTER TABLE phone_numbers ALTER COLUMN waba_uuid SET NOT NULL;
ALTER TABLE phone_numbers ADD CONSTRAINT fk_phone_numbers_waba_uuid FOREIGN KEY (waba_uuid) REFERENCES wabas(waba_uuid) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_phone_numbers_waba_uuid ON phone_numbers(waba_uuid);

-- ========== 8. WABAS: trocar PK de id para meta_waba_id e remover id ==========
ALTER TABLE wabas DROP CONSTRAINT IF EXISTS wabas_pkey;
ALTER TABLE wabas ADD PRIMARY KEY (meta_waba_id);
ALTER TABLE wabas DROP COLUMN IF EXISTS id;
ALTER TABLE wabas ALTER COLUMN meta_waba_id TYPE VARCHAR(255);

-- ========== 9. PHONE_NUMBERS: PK meta_phone_number_id, remover id e phone_number_id ==========
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS meta_phone_number_id VARCHAR(255);
UPDATE phone_numbers SET meta_phone_number_id = phone_number_id WHERE meta_phone_number_id IS NULL OR meta_phone_number_id = '';
ALTER TABLE phone_numbers ALTER COLUMN meta_phone_number_id SET NOT NULL;

ALTER TABLE phone_numbers DROP CONSTRAINT IF EXISTS phone_numbers_waba_id_phone_number_id_key;
DO $$
DECLARE
  pk_name text;
  pk_on_meta boolean;
BEGIN
  SELECT c.conname INTO pk_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.phone_numbers'::regclass AND c.contype = 'p';
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND NOT a.attisdropped
    WHERE c.conrelid = 'public.phone_numbers'::regclass AND c.contype = 'p' AND a.attname = 'meta_phone_number_id'
  ) INTO pk_on_meta;
  IF pk_name IS NOT NULL AND NOT pk_on_meta THEN
    EXECUTE format('ALTER TABLE phone_numbers DROP CONSTRAINT %I', pk_name);
    ALTER TABLE phone_numbers ADD PRIMARY KEY (meta_phone_number_id);
  ELSIF pk_name IS NULL AND NOT pk_on_meta THEN
    ALTER TABLE phone_numbers ADD PRIMARY KEY (meta_phone_number_id);
  END IF;
END $$;
ALTER TABLE phone_numbers DROP COLUMN IF EXISTS id;
ALTER TABLE phone_numbers DROP COLUMN IF EXISTS phone_number_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_numbers_waba_meta ON phone_numbers(waba_uuid, meta_phone_number_id);
COMMENT ON TABLE phone_numbers IS 'Números por WABA. meta_phone_number_id = id da Meta (PK); waba_uuid FK para wabas(waba_uuid).';
