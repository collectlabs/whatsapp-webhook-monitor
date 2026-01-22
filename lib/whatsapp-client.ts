import {
  SendTemplateRequest,
  SendTemplateResponse,
  WhatsAppApiResponse,
  WhatsAppApiError,
} from '@/types/whatsapp-message';

/**
 * Valida o payload de requisição antes de enviar
 */
export function validateSendTemplateRequest(
  request: SendTemplateRequest
): { valid: boolean; error?: string } {
  // Validar phoneNumber
  if (!request.phoneNumber || typeof request.phoneNumber !== 'string') {
    return { valid: false, error: 'phoneNumber é obrigatório e deve ser uma string' };
  }

  // Validar formato básico do número (deve conter apenas dígitos)
  const phoneNumberRegex = /^\d+$/;
  if (!phoneNumberRegex.test(request.phoneNumber.replace(/\s+/g, ''))) {
    return { valid: false, error: 'phoneNumber deve conter apenas dígitos' };
  }

  // Validar phoneNumberId
  if (!request.phoneNumberId || typeof request.phoneNumberId !== 'string') {
    return { valid: false, error: 'phoneNumberId é obrigatório e deve ser uma string' };
  }

  // Validar message
  if (!request.message || typeof request.message !== 'object') {
    return { valid: false, error: 'message é obrigatório e deve ser um objeto' };
  }

  // Validar type
  if (request.message.type !== 'template') {
    return { valid: false, error: "message.type deve ser 'template'" };
  }

  // Validar template
  if (!request.message.template || typeof request.message.template !== 'object') {
    return { valid: false, error: 'message.template é obrigatório' };
  }

  // Validar template name
  if (!request.message.template.name || typeof request.message.template.name !== 'string') {
    return { valid: false, error: 'template.name é obrigatório e deve ser uma string' };
  }

  // Validar language
  if (!request.message.template.language || typeof request.message.template.language !== 'object') {
    return { valid: false, error: 'template.language é obrigatório' };
  }

  if (!request.message.template.language.code || typeof request.message.template.language.code !== 'string') {
    return { valid: false, error: 'template.language.code é obrigatório e deve ser uma string' };
  }

  // Validar components (se presente)
  if (request.message.template.components) {
    if (!Array.isArray(request.message.template.components)) {
      return { valid: false, error: 'template.components deve ser um array' };
    }

    for (const component of request.message.template.components) {
      if (!component.type) {
        return { valid: false, error: 'Cada component deve ter um type' };
      }

      // Validar botões
      if (component.type === 'button') {
        if (!component.sub_type) {
          return { valid: false, error: 'Componentes do tipo button devem ter sub_type' };
        }

        if (component.sub_type !== 'quick_reply' && component.sub_type !== 'url') {
          return { valid: false, error: 'sub_type deve ser "quick_reply" ou "url"' };
        }

        if (typeof component.index !== 'number') {
          return { valid: false, error: 'Componentes do tipo button devem ter index numérico' };
        }

        if (!Array.isArray(component.parameters)) {
          return { valid: false, error: 'Componentes do tipo button devem ter parameters array' };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Obtém as credenciais do WhatsApp das variáveis de ambiente
 */
export function getWhatsAppCredentials(): {
  accessToken: string;
  apiVersion: string;
} {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';

  if (!accessToken) {
    throw new Error(
      'WHATSAPP_ACCESS_TOKEN não está configurado nas variáveis de ambiente'
    );
  }

  return { accessToken, apiVersion };
}

/**
 * Envia uma mensagem template via WhatsApp Cloud API
 */
export async function sendTemplateMessage(
  request: SendTemplateRequest
): Promise<SendTemplateResponse> {
  try {
    // Validar payload
    const validation = validateSendTemplateRequest(request);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error || 'Erro de validação',
        },
      };
    }

    // Obter credenciais
    const { accessToken, apiVersion } = getWhatsAppCredentials();

    // Construir payload para a API do WhatsApp
    const whatsappPayload = {
      messaging_product: 'whatsapp',
      to: request.phoneNumber,
      type: 'template',
      template: {
        name: request.message.template.name,
        language: {
          code: request.message.template.language.code,
          ...(request.message.template.language.policy && {
            policy: request.message.template.language.policy,
          }),
        },
        ...(request.message.template.components && {
          components: request.message.template.components,
        }),
      },
    };

    // URL da API do WhatsApp usando phoneNumberId do request
    const apiUrl = `https://graph.facebook.com/${apiVersion}/${request.phoneNumberId}/messages`;

    console.log('[DEBUG] Enviando template via WhatsApp API:', {
      url: apiUrl,
      templateName: request.message.template.name,
      phoneNumber: request.phoneNumber,
      phoneNumberId: request.phoneNumberId,
      hasComponents: !!request.message.template.components,
      componentsCount: request.message.template.components?.length || 0,
    });

    // Fazer requisição para a API do WhatsApp
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(whatsappPayload),
    });

    const responseData = await response.json();

    // Verificar se houve erro
    if (!response.ok) {
      const error = responseData as WhatsAppApiError;
      console.error('[DEBUG] Erro ao enviar template:', {
        status: response.status,
        error: error.error,
        templateName: request.message.template.name,
        phoneNumber: request.phoneNumber,
        phoneNumberId: request.phoneNumberId,
      });

      return {
        success: false,
        error: {
          code: `WHATSAPP_API_${response.status}`,
          message: error.error?.message || `Erro ao enviar mensagem: ${response.status}`,
          details: error.error,
        },
      };
    }

    // Sucesso
    const successResponse = responseData as WhatsAppApiResponse;
    const messageId = successResponse.messages?.[0]?.id;

    console.log('[DEBUG] Template enviado com sucesso:', {
      messageId,
      templateName: request.message.template.name,
      phoneNumber: request.phoneNumber,
    });

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    console.error('[DEBUG] Erro inesperado ao enviar template:', error);

    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Erro interno ao enviar mensagem',
        details: error,
      },
    };
  }
}
