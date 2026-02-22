-- Vincula waba_health_status à nossa tabela bms para consultas e dashboards.
ALTER TABLE waba_health_status
  ADD COLUMN IF NOT EXISTS bm_uuid UUID REFERENCES bms(id);

CREATE INDEX IF NOT EXISTS idx_waba_health_status_bm_uuid ON waba_health_status(bm_uuid);

COMMENT ON COLUMN waba_health_status.bm_uuid IS 'FK para bms.id; preenchido ao salvar saúde para JOIN com bms.';
