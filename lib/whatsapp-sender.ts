/**
 * Módulo para envio de mensagens via WhatsApp Cloud API
 */

interface SendMessageParams {
  to: string;
  message: string;
}

interface WhatsAppApiResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Envia uma mensagem de texto via WhatsApp Cloud API
 * @param params Parâmetros para envio da mensagem
 * @returns Resposta da API do WhatsApp ou erro
 */
export async function sendWhatsAppMessage(
  params: SendMessageParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, message } = params;

  // Validar token de acesso
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('[WHATSAPP_SENDER] WHATSAPP_ACCESS_TOKEN não está configurado');
    return {
      success: false,
      error: 'WHATSAPP_ACCESS_TOKEN não está configurado',
    };
  }

  // Validar phone number ID
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    console.error('[WHATSAPP_SENDER] WHATSAPP_PHONE_NUMBER_ID não está configurado');
    return {
      success: false,
      error: 'WHATSAPP_PHONE_NUMBER_ID não está configurado',
    };
  }

  // Validar parâmetros
  if (!to || !message) {
    console.error('[WHATSAPP_SENDER] Parâmetros inválidos:', { to, hasMessage: !!message });
    return {
      success: false,
      error: 'Parâmetros inválidos para envio de mensagem',
    };
  }

  // Endpoint da WhatsApp Cloud API v19.0
  const apiVersion = 'v19.0';
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  // Payload da requisição
  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: {
      body: message,
    },
  };

  try {
    console.log('[WHATSAPP_SENDER] Enviando mensagem:', {
      to,
      messageLength: message.length,
      phoneNumberId,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    
    let data: WhatsAppApiResponse;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('[WHATSAPP_SENDER] Erro ao parsear resposta:', responseText.substring(0, 200));
      return {
        success: false,
        error: `Resposta inválida da API: ${responseText.substring(0, 100)}`,
      };
    }

    if (!response.ok || data.error) {
      const errorMessage = data.error?.message || `HTTP ${response.status}`;
      console.error('[WHATSAPP_SENDER] Erro ao enviar mensagem:', {
        status: response.status,
        error: data.error,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }

    const messageId = data.messages?.[0]?.id;
    console.log('[WHATSAPP_SENDER] Mensagem enviada com sucesso:', {
      messageId,
      to,
    });

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[WHATSAPP_SENDER] Erro inesperado:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
