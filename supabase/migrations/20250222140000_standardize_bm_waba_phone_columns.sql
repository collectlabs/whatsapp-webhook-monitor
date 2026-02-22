-- Padronização PARTE 1/3: BMS (bm_uuid, PK meta_bm_id) e WABAS (bm_uuid).
-- Rode esta parte primeiro; em seguida 20250222140001 e 20250222140002.

-- ========== 1. BMS: adicionar bm_uuid e preparar meta_bm_id como PK ==========
ALTER TABLE bms ADD COLUMN IF NOT EXISTS bm_uuid UUID;
UPDATE bms SET bm_uuid = id WHERE bm_uuid IS NULL AND id IS NOT NULL;
ALTER TABLE bms ALTER COLUMN bm_uuid SET NOT NULL;
ALTER TABLE bms ALTER COLUMN bm_uuid SET DEFAULT gen_random_uuid();

UPDATE bms SET meta_bm_id = COALESCE(NULLIF(TRIM(meta_bm_id), ''), id::text) WHERE meta_bm_id IS NULL OR TRIM(meta_bm_id) = '';
ALTER TABLE bms ALTER COLUMN meta_bm_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bms_bm_uuid_key ON bms(bm_uuid);

-- ========== 2. WABA_HEALTH_STATUS: remover FK para bms(id) (será recriada para bms(bm_uuid)) ==========
ALTER TABLE waba_health_status DROP CONSTRAINT IF EXISTS waba_health_status_bm_uuid_fkey;

-- ========== 3. WABAS: migrar de bm_id para bm_uuid ==========
ALTER TABLE wabas ADD COLUMN IF NOT EXISTS bm_uuid UUID;
UPDATE wabas w SET bm_uuid = b.bm_uuid FROM bms b WHERE b.id = w.bm_id AND w.bm_uuid IS NULL;
ALTER TABLE wabas DROP CONSTRAINT IF EXISTS wabas_bm_id_fkey;
ALTER TABLE wabas DROP COLUMN IF EXISTS bm_id;
ALTER TABLE wabas ALTER COLUMN bm_uuid SET NOT NULL;
ALTER TABLE wabas ADD CONSTRAINT wabas_bm_uuid_fkey FOREIGN KEY (bm_uuid) REFERENCES bms(bm_uuid) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_wabas_bm_uuid ON wabas(bm_uuid);

-- ========== 4. BMS: trocar PK de id para meta_bm_id e remover id ==========
ALTER TABLE bms DROP CONSTRAINT IF EXISTS bms_pkey;
ALTER TABLE bms ADD PRIMARY KEY (meta_bm_id);
ALTER TABLE bms DROP COLUMN IF EXISTS id;
ALTER TABLE bms ALTER COLUMN meta_bm_id TYPE VARCHAR(255);

-- ========== 5. WABA_HEALTH_STATUS: recriar FK para bms(bm_uuid) ==========
ALTER TABLE waba_health_status ADD CONSTRAINT waba_health_status_bm_uuid_fkey
  FOREIGN KEY (bm_uuid) REFERENCES bms(bm_uuid);
