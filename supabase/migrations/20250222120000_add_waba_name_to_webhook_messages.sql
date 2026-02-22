-- Garantir que webhook_messages tenha waba_name para exibir o nome da WABA que recebeu o webhook.
ALTER TABLE webhook_messages
  ADD COLUMN IF NOT EXISTS waba_name TEXT;

COMMENT ON COLUMN webhook_messages.waba_name IS 'Nome da WABA (conta WhatsApp Business) que recebeu o webhook; resolvido a partir de waba_id.';
