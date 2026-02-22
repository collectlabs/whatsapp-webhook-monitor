-- Tabela de Business Managers (BM). Token fica no .env como WHATSAPP_ACCESS_TOKEN_<name>.
CREATE TABLE IF NOT EXISTS bms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  meta_bm_id TEXT
);

-- Tabela de WABAs (WhatsApp Business Accounts). id = UUID interno; meta_waba_id = id da Meta.
CREATE TABLE IF NOT EXISTS wabas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_waba_id TEXT UNIQUE,
  name TEXT NOT NULL,
  bm_id UUID NOT NULL REFERENCES bms(id) ON DELETE CASCADE,
  phone_ids JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Se wabas já existia sem meta_waba_id (ex.: tabela criada antes), adiciona a coluna.
ALTER TABLE wabas ADD COLUMN IF NOT EXISTS meta_waba_id TEXT;

CREATE INDEX IF NOT EXISTS idx_wabas_bm_id ON wabas(bm_id);
CREATE INDEX IF NOT EXISTS idx_wabas_meta_waba_id ON wabas(meta_waba_id);

COMMENT ON TABLE bms IS 'Business Managers. Token em .env: WHATSAPP_ACCESS_TOKEN_<name>';
COMMENT ON TABLE wabas IS 'WABAs por BM. id = UUID interno (FK de phone_numbers); meta_waba_id = waba_id da Meta; phone_ids = array de phone_number_id';
