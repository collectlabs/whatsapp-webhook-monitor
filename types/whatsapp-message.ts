// Tipos para envio de mensagens via WhatsApp Cloud API

/**
 * Tipos de parâmetros suportados nos componentes de template
 */
export type TemplateParameterType = 'text' | 'currency' | 'date_time' | 'image' | 'video' | 'document';

/**
 * Parâmetro de template genérico
 */
export interface TemplateParameter {
  type: TemplateParameterType;
  text?: string;
  currency?: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
  date_time?: {
    fallback_value: string;
  };
  image?: {
    link?: string;
    id?: string;
  };
  video?: {
    link?: string;
    id?: string;
  };
  document?: {
    link?: string;
    id?: string;
    filename?: string;
  };
}

/**
 * Componente de header do template
 */
export interface TemplateHeaderComponent {
  type: 'header';
  parameters?: TemplateParameter[];
}

/**
 * Componente de body do template
 */
export interface TemplateBodyComponent {
  type: 'body';
  parameters?: TemplateParameter[];
}

/**
 * Componente de footer do template (não tem parâmetros)
 */
export interface TemplateFooterComponent {
  type: 'footer';
  parameters?: never;
}

/**
 * Componente de botão com quick reply
 */
export interface TemplateButtonQuickReplyComponent {
  type: 'button';
  sub_type: 'quick_reply';
  index: number;
  parameters: Array<{
    type: 'text';
    text: string;
  }>;
}

/**
 * Componente de botão com URL
 */
export interface TemplateButtonUrlComponent {
  type: 'button';
  sub_type: 'url';
  index: number;
  parameters: Array<{
    type: 'text';
    text: string;
  }>;
}

/**
 * Union type para todos os tipos de componentes
 */
export type TemplateComponent =
  | TemplateHeaderComponent
  | TemplateBodyComponent
  | TemplateFooterComponent
  | TemplateButtonQuickReplyComponent
  | TemplateButtonUrlComponent;

/**
 * Idioma do template
 */
export interface TemplateLanguage {
  code: string;
  policy?: 'deterministic';
}

/**
 * Estrutura do template
 */
export interface WhatsAppTemplate {
  name: string;
  language: TemplateLanguage;
  components?: TemplateComponent[];
}

/**
 * Mensagem do tipo template
 */
export interface TemplateMessage {
  type: 'template';
  template: WhatsAppTemplate;
}

/**
 * Payload de requisição para envio de template
 */
export interface SendTemplateRequest {
  phoneNumber: string;
  phoneNumberId: string;
  message: TemplateMessage;
}

/**
 * Resposta da API do WhatsApp ao enviar mensagem
 */
export interface WhatsAppApiResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

/**
 * Resposta do endpoint de envio de template
 */
export interface SendTemplateResponse {
  success: boolean;
  messageId?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Erro retornado pela API do WhatsApp
 */
export interface WhatsAppApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}
