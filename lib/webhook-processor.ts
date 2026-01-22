import {
  WhatsAppWebhookPayload,
  WhatsAppMessage,
  WhatsAppStatus,
  WhatsAppMessageData,
} from '@/types/webhook';

/**
 * Cria um identificador único para cada evento
 * Combina message_id + message_type + timestamp para garantir unicidade
 * Isso permite que o mesmo message_id tenha múltiplos eventos (send, delivered, read)
 */
function createUniqueEventId(
  messageId: string,
  messageType: string,
  timestamp: number
): string {
  // Criar um identificador único combinando os três valores
  // Isso garante que cada evento (send, delivered, read) tenha um ID único
  return `${messageId}_${messageType}_${timestamp}`;
}

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
  } else if (message.type === 'interactive' && message.interactive) {
    console.log('[DEBUG] Mensagem interativa detectada:', {
      messageType: message.type,
      interactiveType: message.interactive?.type,
      interactiveKeys: message.interactive ? Object.keys(message.interactive) : [],
      hasCtaReply: !!message.interactive?.cta_reply,
      hasCtaUrlReply: !!message.interactive?.cta_url_reply,
      interactiveFull: JSON.stringify(message.interactive),
    });

    // Processar mensagens interativas (cliques em botões)
    const interactive = message.interactive;
    
    if (interactive.type === 'button_reply' && interactive.button_reply) {
      // Botão de resposta rápida clicado
      messageBody = `Botão clicado: "${interactive.button_reply.title}" (ID: ${interactive.button_reply.id})`;
    } else if (interactive.type === 'cta_url') {
      // Botão CTA URL clicado - verificar ambos os nomes de campo
      const ctaReply = interactive.cta_url_reply || interactive.cta_reply;
      
      console.log('[DEBUG] Processando CTA URL:', {
        interactiveType: interactive.type,
        hasCtaReply: !!interactive.cta_reply,
        hasCtaUrlReply: !!interactive.cta_url_reply,
        ctaReplyData: ctaReply ? JSON.stringify(ctaReply) : null,
        allInteractiveKeys: Object.keys(interactive),
      });

      if (ctaReply) {
        messageBody = `CTA URL clicado: "${ctaReply.title}" (Payload: ${ctaReply.payload})`;
      } else {
        // Fallback: logar que foi detectado mas sem dados
        console.log('[DEBUG] CTA URL detectado mas sem dados de reply:', {
          interactiveType: interactive.type,
          interactiveKeys: Object.keys(interactive),
          interactiveValue: JSON.stringify(interactive),
        });
        messageBody = `CTA URL clicado (dados não disponíveis)`;
      }
    } else if (interactive.type === 'list_reply' && interactive.list_reply) {
      // Item de lista selecionado
      messageBody = `Item selecionado: "${interactive.list_reply.title}" (ID: ${interactive.list_reply.id})`;
    } else {
      // Fallback para outros tipos de interação
      console.log('[DEBUG] Tipo de interação desconhecido:', {
        interactiveType: interactive.type,
        interactiveKeys: Object.keys(interactive),
      });
      messageBody = `Interação do tipo: ${interactive.type}`;
    }
  }

  const timestamp = parseInt(message.timestamp);
  const uniqueId = createUniqueEventId(message.id, message.type, timestamp);
  
  return {
    message_id: uniqueId,
    from_number: message.from,
    to_number: phoneNumberId,
    timestamp: timestamp,
    message_type: message.type,
    message_body: messageBody,
    raw_payload: rawPayload,
  };
}

/**
 * Extrai dados estruturados de um status do webhook
 */
export function extractStatusData(
  status: WhatsAppStatus,
  phoneNumberId: string,
  rawPayload: WhatsAppWebhookPayload
): WhatsAppMessageData {
  const timestamp = parseInt(status.timestamp);
  const uniqueId = createUniqueEventId(status.id, status.status, timestamp);
  
  return {
    message_id: uniqueId,
    from_number: status.recipient_id,
    to_number: phoneNumberId,
    timestamp: timestamp,
    message_type: status.status,
    message_body: null,
    raw_payload: rawPayload,
  };
}

/**
 * Processa TODOS os eventos do webhook (messages, statuses, e qualquer outro tipo)
 * SEM FILTROS - salva tudo que chegar
 */
export function processWebhookPayload(
  payload: WhatsAppWebhookPayload
): WhatsAppMessageData[] {
  const allEvents: WhatsAppMessageData[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const phoneNumberId = change.value.metadata.phone_number_id;

      // Processar mensagens (se existirem)
      if (change.value.messages && Array.isArray(change.value.messages)) {
        console.log('[DEBUG] Processando array de mensagens:', {
          messagesCount: change.value.messages.length,
          messageTypes: change.value.messages.map((m: any) => m.type),
          interactiveMessages: change.value.messages
            .filter((m: any) => m.type === 'interactive')
            .map((m: any) => ({
              type: m.type,
              interactiveType: m.interactive?.type,
              interactiveKeys: m.interactive ? Object.keys(m.interactive) : [],
            })),
        });

        for (const message of change.value.messages) {
          const messageData = extractMessageData(
            message,
            phoneNumberId,
            payload
          );
          allEvents.push(messageData);
        }
      }

      // Processar statuses (se existirem)
      if (change.value.statuses && Array.isArray(change.value.statuses)) {
        for (const status of change.value.statuses) {
          const statusData = extractStatusData(
            status,
            phoneNumberId,
            payload
          );
          allEvents.push(statusData);
        }
      }

      // Processar qualquer outro tipo de evento que possa existir
      // Verificar se há outros campos além de messages e statuses
      const knownFields = ['messages', 'statuses', 'contacts', 'metadata', 'messaging_product'];
      const allFields = Object.keys(change.value);
      const unknownFields = allFields.filter(field => !knownFields.includes(field));
      
      // Se houver campos desconhecidos, criar eventos genéricos para eles
      for (const field of unknownFields) {
        const fieldValue = (change.value as any)[field];
        
        // Se for um array, processar cada item
        if (Array.isArray(fieldValue)) {
          for (let i = 0; i < fieldValue.length; i++) {
            const item = fieldValue[i];
            const timestamp = item?.timestamp ? parseInt(item.timestamp) : Math.floor(Date.now() / 1000);
            const baseId = item?.id || `unknown_${field}_${i}_${Date.now()}`;
            const uniqueId = createUniqueEventId(baseId, field, timestamp);
            
            const genericEvent: WhatsAppMessageData = {
              message_id: uniqueId,
              from_number: item?.from || item?.recipient_id || item?.wa_id || 'unknown',
              to_number: phoneNumberId,
              timestamp: timestamp,
              message_type: field,
              message_body: null,
              raw_payload: payload,
            };
            allEvents.push(genericEvent);
          }
        } else if (fieldValue && typeof fieldValue === 'object') {
          // Se for um objeto único, criar um evento
          const timestamp = fieldValue?.timestamp ? parseInt(fieldValue.timestamp) : Math.floor(Date.now() / 1000);
          const baseId = fieldValue?.id || `unknown_${field}_${Date.now()}`;
          const uniqueId = createUniqueEventId(baseId, field, timestamp);
          
          const genericEvent: WhatsAppMessageData = {
            message_id: uniqueId,
            from_number: fieldValue?.from || fieldValue?.recipient_id || fieldValue?.wa_id || 'unknown',
            to_number: phoneNumberId,
            timestamp: timestamp,
            message_type: field,
            message_body: null,
            raw_payload: payload,
          };
          allEvents.push(genericEvent);
        }
      }
    }
  }

  return allEvents;
}
