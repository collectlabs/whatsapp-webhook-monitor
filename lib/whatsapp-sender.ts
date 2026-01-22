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
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:37',message:'Function entry',data:{hasParams:!!params,phoneNumberId:params?.phoneNumberId,to:params?.to,hasMessage:!!params?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  console.log('[WHATSAPP_SENDER] ⚡ Função sendWhatsAppMessage chamada!', {
    params: {
      phoneNumberId: params.phoneNumberId,
      to: params.to,
      messageLength: params.message?.length || 0,
    },
  });

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:45',message:'After console.log, before destructuring',data:{hasParams:!!params},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  const { phoneNumberId, to, message } = params;
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:50',message:'After destructuring',data:{phoneNumberId,to,hasMessage:!!message,messageLength:message?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:54',message:'Before token validation',data:{hasProcessEnv:typeof process!=='undefined',hasEnv:typeof process?.env!=='undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  // Validar token de acesso
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:60',message:'After token check',data:{hasAccessToken:!!accessToken,tokenLength:accessToken?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  if (!accessToken) {
    console.error('[WHATSAPP_SENDER] WHATSAPP_ACCESS_TOKEN não está configurado');
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:66',message:'Token missing, returning error',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
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
