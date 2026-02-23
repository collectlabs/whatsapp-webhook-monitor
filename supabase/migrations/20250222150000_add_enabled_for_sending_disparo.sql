-- Coluna enabled_for_sending para controle hierárquico de disparo (BM, WABA, número).
-- Só números com os três níveis em true aparecem na API phone-numbers e podem ser usados no send-template.

-- bms: se false, nenhuma WABA/número dessa BM pode disparar
ALTER TABLE bms ADD COLUMN IF NOT EXISTS enabled_for_sending BOOLEAN NOT NULL DEFAULT true;
COMMENT ON COLUMN bms.enabled_for_sending IS 'Se true, a BM pode ser usada para disparo; se false, bloqueia toda a hierarquia abaixo.';

-- wabas: se false, nenhum número dessa WABA pode disparar
ALTER TABLE wabas ADD COLUMN IF NOT EXISTS enabled_for_sending BOOLEAN NOT NULL DEFAULT true;
COMMENT ON COLUMN wabas.enabled_for_sending IS 'Se true, a WABA pode ser usada para disparo; se false, bloqueia todos os números da WABA.';

-- phone_numbers: se false, esse número não pode disparar
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS enabled_for_sending BOOLEAN NOT NULL DEFAULT true;
COMMENT ON COLUMN phone_numbers.enabled_for_sending IS 'Se true, o número pode ser usado para disparo (respeitando BM e WABA).';
