/**
 * Serviço de resposta automática para mensagens do WhatsApp
 */

import { WhatsAppMessageData } from '@/types/webhook';
import { getResponseConfig } from './response-config';
import { sendWhatsAppMessage } from './whatsapp-sender';

// APENAS estes tipos disparam resposta automática (mais restritivo)
const REPLY_MESSAGE_TYPES = ['text', 'button'];

/**
 * Verifica se uma mensagem deve receber resposta automática
 * Apenas mensagens de TEXTO ou BUTTON do cliente disparam resposta
 */
export function shouldSendAutoReply(messageData: WhatsAppMessageData): boolean {
  const { message_type, from_number, to_number } = messageData;

  console.log('[AUTO_REPLY] Verificando mensagem:', {
    message_type,
    from_number,
    to_number,
  });

  // APENAS text e button disparam resposta
  if (!REPLY_MESSAGE_TYPES.includes(message_type)) {
    console.log('[AUTO_REPLY] Ignorando - tipo não é text/button:', message_type);
    return false;
  }

  // Validar que from_number parece ser um número de telefone válido
  if (!from_number || from_number === 'unknown' || from_number.length < 10) {
    console.log('[AUTO_REPLY] Ignorando - from_number inválido:', from_number);
    return false;
  }

  // Verificar se to_number é o phone_number_id do business
  const businessPhoneId = '823349844204985'; // Hardcoded para teste
  if (to_number !== businessPhoneId) {
    console.log('[AUTO_REPLY] Ignorando - não é para o business:', { to_number, businessPhoneId });
    return false;
  }

  console.log('[AUTO_REPLY] Mensagem válida para resposta automática!');
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
