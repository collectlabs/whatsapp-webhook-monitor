// Tipos para o payload do webhook do WhatsApp Cloud API

export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

export interface WhatsAppWebhookEntry {
  id: string;
  changes: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookChange {
  value: WhatsAppWebhookValue;
  field: string;
}

export interface WhatsAppWebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

// Tipos para mensagens interativas
export interface ButtonReply {
  id: string;
  title: string;
}

export interface CtaUrlReply {
  title: string;
  payload: string;
}

export interface Interactive {
  type: 'button_reply' | 'cta_url' | 'list_reply';
  button_reply?: ButtonReply;
  cta_reply?: CtaUrlReply;
  list_reply?: {
    id: string;
    title: string;
    description?: string;
  };
}

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  audio?: {
    id: string;
    mime_type: string;
    sha256: string;
    voice?: boolean;
  };
  video?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  document?: {
    id: string;
    mime_type: string;
    sha256: string;
    filename?: string;
    caption?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  interactive?: Interactive;
  contacts?: any[];
  [key: string]: any; // Para outros tipos de mensagem
}

export interface WhatsAppStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
}

// Tipo para dados estruturados a serem salvos no Supabase
export interface WhatsAppMessageData {
  message_id: string;
  from_number: string;
  to_number: string;
  timestamp: number;
  message_type: string;
  message_body: string | null;
  raw_payload: WhatsAppWebhookPayload;
}
