-- Foreign keys entre bm, waba e phone_numbers.
-- bm -> waba: wabas.bm_id REFERENCES bms(id) (já definido em 20250222100000).
-- waba -> phone_numbers: phone_numbers.waba_id REFERENCES wabas(id) (id da wabas é UUID).

-- 1) Remover coluna uuid da wabas se tiver sido criada (manter apenas id como UUID)
ALTER TABLE wabas
  DROP COLUMN IF EXISTS uuid;

-- 1.0) Garantir coluna meta_waba_id (id da Meta) para compatibilidade com código que usa id UUID
ALTER TABLE wabas
  ADD COLUMN IF NOT EXISTS meta_waba_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS wabas_meta_waba_id_key ON wabas (meta_waba_id) WHERE meta_waba_id IS NOT NULL;

-- 1.1) Garantir que wabas.id tenha restrição UNIQUE (exigida para a FK de phone_numbers)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND a.attisdropped = false
    WHERE c.conrelid = 'public.wabas'::regclass AND a.attname = 'id' AND (c.contype = 'p' OR c.contype = 'u')
  ) THEN
    ALTER TABLE public.wabas ADD CONSTRAINT wabas_id_key UNIQUE (id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL; -- constraint já existe
END $$;

-- 2) Criar tabela phone_numbers se não existir (waba_id referencia wabas.id)
CREATE TABLE IF NOT EXISTS phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waba_id UUID NOT NULL REFERENCES wabas(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  display_phone_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(waba_id, phone_number_id)
);

CREATE INDEX IF NOT EXISTS idx_phone_numbers_waba_id ON phone_numbers(waba_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_phone_number_id ON phone_numbers(phone_number_id);

COMMENT ON TABLE phone_numbers IS 'Números de telefone por WABA. waba_id referencia wabas.id (UUID).';

-- 3) Garantir FK em phone_numbers para wabas(id) (remove FK antiga se apontava para wabas.uuid)
ALTER TABLE phone_numbers
  DROP CONSTRAINT IF EXISTS fk_phone_numbers_waba_id,
  DROP CONSTRAINT IF EXISTS phone_numbers_waba_id_fkey;
ALTER TABLE phone_numbers
  ADD CONSTRAINT fk_phone_numbers_waba_id
  FOREIGN KEY (waba_id) REFERENCES wabas(id) ON DELETE CASCADE;
