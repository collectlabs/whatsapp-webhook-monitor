/**
 * Serviço de resposta automática para mensagens do WhatsApp
 */

import { WhatsAppMessageData } from '@/types/webhook';
import { getResponseConfig } from './response-config';
import { sendWhatsAppMessage } from './whatsapp-sender';

// Tipos de mensagem que devem receber resposta automática
const REPLY_MESSAGE_TYPES = ['text', 'interactive', 'button', 'image', 'audio', 'video', 'document', 'location'];

// Tipos que NÃO devem receber resposta (status de entrega)
const STATUS_TYPES = ['sent', 'delivered', 'read', 'failed', 'deleted'];

/**
 * Verifica se uma mensagem deve receber resposta automática
 */
export function shouldSendAutoReply(messageData: WhatsAppMessageData): boolean {
  const { message_type, from_number, to_number } = messageData;

  // Ignorar status de entrega
  if (STATUS_TYPES.includes(message_type)) {
    console.log('[AUTO_REPLY] Ignorando status de entrega:', message_type);
    return false;
  }

  // Ignorar webhooks de raw/debug
  if (message_type === 'raw_webhook') {
    console.log('[AUTO_REPLY] Ignorando webhook raw');
    return false;
  }

  // Verificar se é um tipo de mensagem válido para resposta
  if (!REPLY_MESSAGE_TYPES.includes(message_type)) {
    console.log('[AUTO_REPLY] Tipo de mensagem não requer resposta:', message_type);
    return false;
  }

  // Verificar se from_number é diferente do número do business (evitar loop)
  const businessPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (businessPhoneId && from_number === businessPhoneId) {
    console.log('[AUTO_REPLY] Ignorando mensagem do próprio número do business');
    return false;
  }

  // Verificar se to_number (phone_number_id) corresponde ao business
  // Isso confirma que a mensagem foi enviada PARA o business (incoming)
  if (businessPhoneId && to_number !== businessPhoneId) {
    console.log('[AUTO_REPLY] Mensagem não é para o número do business:', {
      to_number,
      businessPhoneId,
    });
    return false;
  }

  // Validar que from_number parece ser um número de telefone
  if (!from_number || from_number === 'unknown' || from_number.length < 10) {
    console.log('[AUTO_REPLY] from_number inválido:', from_number);
    return false;
  }

  return true;
}

/**
 * Processa uma mensagem e envia resposta automática se necessário
 */
export async function processAutoReply(messageData: WhatsAppMessageData): Promise<void> {
  const startTime = Date.now();

  console.log('[AUTO_REPLY] Processando mensagem:', {
    message_id: messageData.message_id,
    message_type: messageData.message_type,
    from_number: messageData.from_number,
  });

  // Verificar se deve enviar resposta automática
  if (!shouldSendAutoReply(messageData)) {
    console.log('[AUTO_REPLY] Mensagem não requer resposta automática');
    return;
  }

  // Buscar configuração de resposta automática
  const config = await getResponseConfig();
  
  if (!config) {
    console.log('[AUTO_REPLY] Resposta automática desabilitada ou não configurada');
    return;
  }

  if (!config.enabled) {
    console.log('[AUTO_REPLY] Resposta automática está desabilitada na configuração');
    return;
  }

  // Enviar resposta automática
  console.log('[AUTO_REPLY] Enviando resposta automática para:', messageData.from_number);
  
  const result = await sendWhatsAppMessage({
    to: messageData.from_number,
    message: config.default_message,
  });

  const duration = Date.now() - startTime;

  if (result.success) {
    console.log('[AUTO_REPLY] Resposta automática enviada com sucesso:', {
      to: messageData.from_number,
      messageId: result.messageId,
      duration: `${duration}ms`,
    });
  } else {
    console.error('[AUTO_REPLY] Falha ao enviar resposta automática:', {
      to: messageData.from_number,
      error: result.error,
      duration: `${duration}ms`,
    });
  }
}
