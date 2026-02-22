-- Padronização PARTE 3/3: Tabelas secundárias (meta_waba_id, meta_phone_number_id, meta_bm_id).
-- Rode após 20250222140001.

-- ========== 10. Tabelas secundárias: renomear colunas para meta_* e tipo VARCHAR ==========

-- webhook_messages
ALTER TABLE webhook_messages RENAME COLUMN waba_id TO meta_waba_id;
ALTER TABLE webhook_messages RENAME COLUMN phone_number_id TO meta_phone_number_id;
ALTER TABLE webhook_messages RENAME COLUMN bm_id TO meta_bm_id;
ALTER TABLE webhook_messages ALTER COLUMN meta_waba_id TYPE VARCHAR(255);
ALTER TABLE webhook_messages ALTER COLUMN meta_phone_number_id TYPE VARCHAR(255);
ALTER TABLE webhook_messages ALTER COLUMN meta_bm_id TYPE VARCHAR(255);

-- webhook_alerts
ALTER TABLE webhook_alerts RENAME COLUMN waba_id TO meta_waba_id;
ALTER TABLE webhook_alerts RENAME COLUMN bm_id TO meta_bm_id;
ALTER TABLE webhook_alerts ALTER COLUMN meta_waba_id TYPE VARCHAR(255);
ALTER TABLE webhook_alerts ALTER COLUMN meta_bm_id TYPE VARCHAR(255);

-- messages
ALTER TABLE messages RENAME COLUMN waba_id TO meta_waba_id;
ALTER TABLE messages RENAME COLUMN phone_number_id TO meta_phone_number_id;
ALTER TABLE messages RENAME COLUMN bm_id TO meta_bm_id;
ALTER TABLE messages ALTER COLUMN meta_waba_id TYPE VARCHAR(255);
ALTER TABLE messages ALTER COLUMN meta_phone_number_id TYPE VARCHAR(255);
ALTER TABLE messages ALTER COLUMN meta_bm_id TYPE VARCHAR(255);

-- phone_number_meta (só se a tabela existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'phone_number_meta') THEN
    ALTER TABLE phone_number_meta RENAME COLUMN phone_number_id TO meta_phone_number_id;
    ALTER TABLE phone_number_meta RENAME COLUMN waba_id TO meta_waba_id;
    ALTER TABLE phone_number_meta RENAME COLUMN bm_id TO meta_bm_id;
    ALTER TABLE phone_number_meta ALTER COLUMN meta_phone_number_id TYPE VARCHAR(255);
    ALTER TABLE phone_number_meta ALTER COLUMN meta_waba_id TYPE VARCHAR(255);
    ALTER TABLE phone_number_meta ALTER COLUMN meta_bm_id TYPE VARCHAR(255);
  END IF;
END $$;

-- waba_health_status
ALTER TABLE waba_health_status RENAME COLUMN waba_id TO meta_waba_id;
ALTER TABLE waba_health_status RENAME COLUMN bm_id TO meta_bm_id;
ALTER TABLE waba_health_status ALTER COLUMN meta_waba_id TYPE VARCHAR(255);
ALTER TABLE waba_health_status ALTER COLUMN meta_bm_id TYPE VARCHAR(255);

-- auto_reply_phone_config
ALTER TABLE auto_reply_phone_config RENAME COLUMN phone_number_id TO meta_phone_number_id;
ALTER TABLE auto_reply_phone_config ALTER COLUMN meta_phone_number_id TYPE VARCHAR(255);

-- Comentários finais
COMMENT ON TABLE bms IS 'Business Managers. meta_bm_id = id da Meta (PK); bm_uuid = UUID interno para FKs.';
COMMENT ON TABLE wabas IS 'WABAs por BM. meta_waba_id = id da Meta (PK); waba_uuid = UUID para FKs; bm_uuid FK para bms(bm_uuid).';
