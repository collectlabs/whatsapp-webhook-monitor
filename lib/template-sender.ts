/**
 * Módulo para envio de mensagens de template via WhatsApp Cloud API
 */

// Tipos para header do template
export interface TemplateHeaderText {
  type: 'text';
  parameters: string[];
}

export interface TemplateHeaderMedia {
  type: 'image' | 'video' | 'document';
  url: string;
  filename?: string; // Apenas para document
}

export type TemplateHeader = TemplateHeaderText | TemplateHeaderMedia;

// Tipos para parâmetros de botão
export interface ButtonParameter {
  index: number;
  text: string;
}

// Parâmetros de entrada simplificados
export interface SendTemplateParams {
  to: string;
  template_name: string;
  language?: string;
  header?: TemplateHeader;
  body_parameters?: string[];
  button_parameters?: ButtonParameter[];
}

// Tipos para resposta da API do WhatsApp
interface WhatsAppApiResponse {
  messaging_product: string;
  contacts?: Array<{
    input: string;
    wa_id: string;
  }>;
  messages?: Array<{
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

// Tipos para componentes do template na API da Meta
interface MetaTemplateParameter {
  type: 'text' | 'image' | 'video' | 'document';
  text?: string;
  image?: { link: string };
  video?: { link: string };
  document?: { link: string; filename?: string };
}

interface MetaTemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'url' | 'quick_reply';
  index?: number;
  parameters: MetaTemplateParameter[];
}

interface MetaTemplatePayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components?: MetaTemplateComponent[];
  };
}

/**
 * Constrói os componentes do template no formato da Meta API
 */
function buildTemplateComponents(params: SendTemplateParams): MetaTemplateComponent[] {
  const components: MetaTemplateComponent[] = [];

  // Header (se existir)
  if (params.header) {
    if (params.header.type === 'text' && params.header.parameters?.length > 0) {
      components.push({
        type: 'header',
        parameters: params.header.parameters.map((text) => ({
          type: 'text',
          text,
        })),
      });
    } else if (params.header.type === 'image') {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'image',
            image: { link: (params.header as TemplateHeaderMedia).url },
          },
        ],
      });
    } else if (params.header.type === 'video') {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'video',
            video: { link: (params.header as TemplateHeaderMedia).url },
          },
        ],
      });
    } else if (params.header.type === 'document') {
      const docHeader = params.header as TemplateHeaderMedia;
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'document',
            document: {
              link: docHeader.url,
              filename: docHeader.filename,
            },
          },
        ],
      });
    }
  }

  // Body parameters
  if (params.body_parameters && params.body_parameters.length > 0) {
    components.push({
      type: 'body',
      parameters: params.body_parameters.map((text) => ({
        type: 'text',
        text,
      })),
    });
  }

  // Button parameters
  if (params.button_parameters && params.button_parameters.length > 0) {
    for (const button of params.button_parameters) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: button.index,
        parameters: [
          {
            type: 'text',
            text: button.text,
          },
        ],
      });
    }
  }

  return components;
}

/**
 * Envia uma mensagem de template via WhatsApp Cloud API
 * @param params Parâmetros para envio do template
 * @returns Resposta da API do WhatsApp ou erro
 */
export async function sendWhatsAppTemplate(
  params: SendTemplateParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, template_name, language = 'pt_BR' } = params;

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Log de debug (sem expor token completo)
  console.log('[TEMPLATE_SENDER] Iniciando envio de template:', {
    to,
    template_name,
    language,
    hasHeader: !!params.header,
    bodyParamsCount: params.body_parameters?.length || 0,
    buttonParamsCount: params.button_parameters?.length || 0,
    hasAccessToken: !!accessToken,
    phoneNumberId,
  });

  // Validar credenciais
  if (!accessToken || !phoneNumberId) {
    console.error('[TEMPLATE_SENDER] Credenciais não configuradas');
    return {
      success: false,
      error: 'Credenciais do WhatsApp não configuradas (WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID)',
    };
  }

  // Validar parâmetros obrigatórios
  if (!to || !template_name) {
    console.error('[TEMPLATE_SENDER] Parâmetros obrigatórios faltando:', { to: !!to, template_name: !!template_name });
    return {
      success: false,
      error: 'Parâmetros obrigatórios: to, template_name',
    };
  }

  // Endpoint da WhatsApp Cloud API v24.0
  const apiVersion = 'v24.0';
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  // Construir componentes do template
  const components = buildTemplateComponents(params);

  // Payload da requisição
  const payload: MetaTemplatePayload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template_name,
      language: { code: language },
    },
  };

  // Adicionar componentes apenas se existirem
  if (components.length > 0) {
    payload.template.components = components;
  }

  console.log('[TEMPLATE_SENDER] Payload construído:', JSON.stringify(payload, null, 2));

  try {
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
      console.error('[TEMPLATE_SENDER] Erro ao parsear resposta:', responseText.substring(0, 500));
      return {
        success: false,
        error: `Resposta inválida da API: ${responseText.substring(0, 200)}`,
      };
    }

    if (!response.ok || data.error) {
      const errorMessage = data.error?.message || `HTTP ${response.status}`;
      console.error('[TEMPLATE_SENDER] Erro ao enviar template:', {
        status: response.status,
        error: data.error,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }

    const messageId = data.messages?.[0]?.id;
    console.log('[TEMPLATE_SENDER] Template enviado com sucesso:', {
      messageId,
      to,
      template_name,
    });

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[TEMPLATE_SENDER] Erro inesperado:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
