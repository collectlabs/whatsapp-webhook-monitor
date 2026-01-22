import {
  WhatsAppWebhookPayload,
  WhatsAppMessage,
  WhatsAppMessageData,
} from '@/types/webhook';

/**
 * Extrai dados estruturados de uma mensagem do webhook
 */
export function extractMessageData(
  message: WhatsAppMessage,
  phoneNumberId: string,
  rawPayload: WhatsAppWebhookPayload
): WhatsAppMessageData {
  // Extrair o corpo da mensagem baseado no tipo
  let messageBody: string | null = null;

  if (message.type === 'text' && message.text) {
    messageBody = message.text.body;
  } else if (message.type === 'image' && message.image?.caption) {
    messageBody = message.image.caption;
  } else if (message.type === 'video' && message.video?.caption) {
    messageBody = message.video.caption;
  } else if (message.type === 'document' && message.document?.caption) {
    messageBody = message.document.caption;
  } else if (message.type === 'location' && message.location) {
    messageBody = `Location: ${message.location.latitude}, ${message.location.longitude}`;
    if (message.location.name) {
      messageBody += ` - ${message.location.name}`;
    }
  }

  return {
    message_id: message.id,
    from_number: message.from,
    to_number: phoneNumberId,
    timestamp: parseInt(message.timestamp),
    message_type: message.type,
    message_body: messageBody,
    raw_payload: rawPayload,
  };
}

/**
 * Processa o payload do webhook e extrai todas as mensagens
 */
export function processWebhookPayload(
  payload: WhatsAppWebhookPayload
): WhatsAppMessageData[] {
  const messages: WhatsAppMessageData[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      // Processar apenas webhooks do tipo "messages", ignorar "statuses"
      if (change.field === 'messages' && change.value.messages) {
        const phoneNumberId = change.value.metadata.phone_number_id;

        for (const message of change.value.messages) {
          const messageData = extractMessageData(
            message,
            phoneNumberId,
            payload
          );
          messages.push(messageData);
        }
      }
    }
  }

  return messages;
}
