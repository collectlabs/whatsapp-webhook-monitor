/**
 * Módulo para envio de mensagens via WhatsApp Cloud API
 */

interface SendMessageParams {
  phoneNumberId: string;
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
  const { phoneNumberId, to, message } = params;

  // Validar token de acesso
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('[WHATSAPP_SENDER] WHATSAPP_ACCESS_TOKEN não está configurado');
    return {
      success: false,
      error: 'WHATSAPP_ACCESS_TOKEN não está configurado',
    };
  }

  // Validar parâmetros
  if (!phoneNumberId || !to || !message) {
    console.error('[WHATSAPP_SENDER] Parâmetros inválidos:', { phoneNumberId, to, message });
    return {
      success: false,
      error: 'Parâmetros inválidos para envio de mensagem',
    };
  }

  // Endpoint da WhatsApp Cloud API
  const apiVersion = 'v18.0';
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  // Payload da requisição
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: {
      body: message,
    },
  };

  try {
    console.log('[WHATSAPP_SENDER] Preparando envio de mensagem:', {
      phoneNumberId,
      to,
      messageLength: message.length,
      url,
      hasToken: !!accessToken,
      tokenLength: accessToken?.length || 0,
    });

    console.log('[WHATSAPP_SENDER] Payload da requisição:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('[WHATSAPP_SENDER] Resposta recebida:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
    });

    const responseText = await response.text();
    console.log('[WHATSAPP_SENDER] Corpo da resposta (raw):', responseText);

    let data: WhatsAppApiResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[WHATSAPP_SENDER] Erro ao fazer parse da resposta JSON:', {
        responseText,
        error: parseError,
      });
      return {
        success: false,
        error: `Resposta inválida da API: ${responseText.substring(0, 200)}`,
      };
    }

    console.log('[WHATSAPP_SENDER] Resposta parseada:', JSON.stringify(data, null, 2));

    if (!response.ok || data.error) {
      const errorMessage = data.error?.message || `HTTP ${response.status}`;
      const errorCode = data.error?.code;
      const errorType = data.error?.type;
      
      console.error('[WHATSAPP_SENDER] Erro ao enviar mensagem:', {
        status: response.status,
        statusText: response.statusText,
        error: data.error,
        errorMessage,
        errorCode,
        errorType,
        fullResponse: data,
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
      contacts: data.contacts,
      messagingProduct: data.messaging_product,
    });

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    console.error('[WHATSAPP_SENDER] Erro inesperado ao enviar mensagem:', {
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}
