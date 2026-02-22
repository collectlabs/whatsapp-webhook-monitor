/**
 * Serviço de resposta automática para mensagens do WhatsApp
 * Configuração por número (auto_reply_phone_config): ativar/desativar e mensagem.
 * Suporta respostas via IA (OpenAI Agents) ou mensagem fixa por número.
 */

import { WhatsAppMessageData } from '@/types/webhook';
import { getResponseConfig } from './response-config';
import { getAutoReplyConfigForPhone } from './auto-reply-phone-config';
import { getCredentialsByPhoneId } from './whatsapp-accounts';
import { sendWhatsAppMessage } from './whatsapp-sender';
import { generateAIResponse, isAIEnabled } from './openai-agent';

// APENAS estes tipos disparam resposta automática
const REPLY_MESSAGE_TYPES = ['text', 'button', 'audio'];

/**
 * Verifica se a mensagem tem tipo e remetente válidos para resposta automática.
 * A decisão "este número tem auto-reply habilitado?" é feita em processAutoReply via auto_reply_phone_config.
 */
export function shouldSendAutoReply(messageData: WhatsAppMessageData): boolean {
  const { message_type, from_number, to_number } = messageData;

  console.log('[AUTO_REPLY] Verificando mensagem:', {
    message_type,
    from_number,
    to_number,
  });

  if (!REPLY_MESSAGE_TYPES.includes(message_type)) {
    console.log('[AUTO_REPLY] Ignorando - tipo não é text/button/audio:', message_type);
    return false;
  }

  if (!from_number || from_number === 'unknown' || from_number.length < 10) {
    console.log('[AUTO_REPLY] Ignorando - from_number inválido:', from_number);
    return false;
  }

  if (!to_number || to_number === 'unknown') {
    console.log('[AUTO_REPLY] Ignorando - to_number (phone_number_id) ausente');
    return false;
  }

  console.log('[AUTO_REPLY] Mensagem candidata a resposta automática (config por número será verificada)');
  return true;
}

/**
 * Processa uma mensagem e envia resposta automática se necessário
 * Usa IA (OpenAI Agents) quando disponível, com fallback para resposta fixa
 */
export async function processAutoReply(messageData: WhatsAppMessageData): Promise<void> {
  const startTime = Date.now();

  console.log('[AUTO_REPLY] Processando mensagem:', {
    message_id: messageData.message_id,
    message_type: messageData.message_type,
    from_number: messageData.from_number,
  });

  if (!shouldSendAutoReply(messageData)) {
    console.log('[AUTO_REPLY] Mensagem não requer resposta automática');
    return;
  }

  // Config por número: ativar/desativar e mensagem (auto_reply_phone_config)
  const phoneConfig = await getAutoReplyConfigForPhone(messageData.to_number);
  if (!phoneConfig || !phoneConfig.enabled) {
    console.log('[AUTO_REPLY] Número sem resposta automática habilitada:', messageData.to_number);
    return;
  }

  // Credenciais para enviar a partir do mesmo número que recebeu (qualquer WABA)
  const credentials = await getCredentialsByPhoneId(messageData.to_number);
  if (!credentials) {
    console.error('[AUTO_REPLY] Credenciais não encontradas para phone_number_id:', messageData.to_number);
    return;
  }

  // Mensagem: usar a configurada para o número; fallback para response_config se vazia
  const fallbackMessage = phoneConfig.message?.trim() || (await getResponseConfig())?.default_message || 'Olá, em breve responderemos.';
  let responseMessage: string;
  let responseSource: 'ai' | 'fallback';

  if (isAIEnabled()) {
    console.log('[AUTO_REPLY] Usando IA para gerar resposta...');
    try {
      responseMessage = await generateAIResponse(
        messageData.from_number,
        messageData.message_body,
        messageData.message_type
      );
      responseSource = 'ai';
      console.log('[AUTO_REPLY] Resposta gerada pela IA:', { from_number: messageData.from_number, responseLength: responseMessage.length });
    } catch (error) {
      console.error('[AUTO_REPLY] Erro ao gerar resposta com IA, usando fallback:', error instanceof Error ? error.message : 'Erro desconhecido');
      responseMessage = fallbackMessage;
      responseSource = 'fallback';
    }
  } else {
    responseMessage = fallbackMessage;
    responseSource = 'fallback';
  }

  console.log('[AUTO_REPLY] Enviando resposta automática para:', messageData.from_number, 'a partir do número', messageData.to_number);

  const result = await sendWhatsAppMessage({
    to: messageData.from_number,
    message: responseMessage,
    credentials,
  });

  const duration = Date.now() - startTime;

  if (result.success) {
    console.log('[AUTO_REPLY] Resposta automática enviada com sucesso:', {
      to: messageData.from_number,
      messageId: result.messageId,
      duration: `${duration}ms`,
      source: responseSource,
    });
  } else {
    console.error('[AUTO_REPLY] Falha ao enviar resposta automática:', {
      to: messageData.from_number,
      error: result.error,
      duration: `${duration}ms`,
      source: responseSource,
    });
  }
}
