import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import {
  sendWhatsAppTemplate,
  SendTemplateParams,
  TemplateHeader,
  ButtonParameter,
} from '@/lib/template-sender';

/**
 * Interface para o body do request simplificado
 */
interface SendTemplateRequestBody {
  to: string;
  template_name: string;
  language?: string;
  header?: TemplateHeader;
  body_parameters?: string[];
  button_parameters?: ButtonParameter[];
}

/**
 * Valida a API Key no header da requisição
 */
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  const configuredApiKey = process.env.API_KEY;

  if (!configuredApiKey) {
    console.error('[SEND_TEMPLATE] API_KEY não configurada nas variáveis de ambiente');
    return false;
  }

  return apiKey === configuredApiKey;
}

/**
 * Valida os campos obrigatórios do body
 */
function validateRequestBody(body: SendTemplateRequestBody): { valid: boolean; error?: string } {
  if (!body.to) {
    return { valid: false, error: 'Campo obrigatório "to" não informado' };
  }

  if (!body.template_name) {
    return { valid: false, error: 'Campo obrigatório "template_name" não informado' };
  }

  // Validar formato do número (deve conter apenas números)
  const phoneRegex = /^\d+$/;
  if (!phoneRegex.test(body.to)) {
    return { valid: false, error: 'Campo "to" deve conter apenas números (ex: 5521999999999)' };
  }

  return { valid: true };
}

/**
 * POST - Envia mensagem de template via WhatsApp
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Validar API Key
    if (!validateApiKey(request)) {
      console.warn('[SEND_TEMPLATE] Tentativa de acesso com API Key inválida');
      return NextResponse.json(
        { success: false, error: 'API Key inválida ou não fornecida' },
        { status: 401 }
      );
    }

    // 2. Parsear body
    let body: SendTemplateRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Body inválido - JSON mal formatado' },
        { status: 400 }
      );
    }

    console.log('[SEND_TEMPLATE] Request recebido:', {
      to: body.to,
      template_name: body.template_name,
      language: body.language,
      hasHeader: !!body.header,
      bodyParamsCount: body.body_parameters?.length || 0,
      buttonParamsCount: body.button_parameters?.length || 0,
    });

    // 3. Validar campos obrigatórios
    const validation = validateRequestBody(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // 4. Criar registro inicial no Supabase com status 'pending'
    const supabase = getSupabaseClient();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

    const messageContent = JSON.stringify({
      header: body.header,
      body_parameters: body.body_parameters,
      button_parameters: body.button_parameters,
    });

    const { data: insertedMessage, error: insertError } = await supabase
      .from('messages')
      .insert({
        phone_number_id: phoneNumberId,
        recipient_phone: body.to,
        message_type: 'template',
        template_name: body.template_name,
        message_content: messageContent,
        status: 'pending',
        metadata: {
          language: body.language || 'pt_BR',
          header: body.header,
          body_parameters: body.body_parameters,
          button_parameters: body.button_parameters,
          request_timestamp: new Date().toISOString(),
        },
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[SEND_TEMPLATE] Erro ao criar registro no Supabase:', insertError);
      return NextResponse.json(
        { success: false, error: 'Erro ao registrar mensagem no banco de dados' },
        { status: 500 }
      );
    }

    const messageId = insertedMessage.id;
    console.log('[SEND_TEMPLATE] Registro criado no Supabase:', { messageId });

    // 5. Preparar parâmetros e enviar template
    const templateParams: SendTemplateParams = {
      to: body.to,
      template_name: body.template_name,
      language: body.language || 'pt_BR',
      header: body.header,
      body_parameters: body.body_parameters,
      button_parameters: body.button_parameters,
    };

    const result = await sendWhatsAppTemplate(templateParams);

    // 6. Atualizar registro com resultado
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (result.success) {
      updateData.status = 'sent';
      updateData.whatsapp_message_id = result.messageId;
      updateData.sent_at = new Date().toISOString();
    } else {
      updateData.status = 'failed';
      updateData.error_message = result.error;
    }

    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', messageId);

    if (updateError) {
      console.error('[SEND_TEMPLATE] Erro ao atualizar registro:', updateError);
      // Não retornar erro aqui, pois a mensagem já foi enviada (ou não)
    }

    const duration = Date.now() - startTime;
    console.log('[SEND_TEMPLATE] Processamento concluído:', {
      messageId,
      success: result.success,
      whatsappMessageId: result.messageId,
      duration: `${duration}ms`,
    });

    // 7. Retornar resposta
    if (result.success) {
      return NextResponse.json({
        success: true,
        message_id: messageId,
        whatsapp_message_id: result.messageId,
        status: 'sent',
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message_id: messageId,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[SEND_TEMPLATE] Erro inesperado:', errorMessage);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET - Retorna informações sobre o endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/send-template',
    method: 'POST',
    description: 'Envia mensagens de template via WhatsApp Cloud API',
    authentication: 'API Key via header X-API-Key',
    body_format: {
      to: 'string (obrigatório) - Número do destinatário com código do país',
      template_name: 'string (obrigatório) - Nome do template aprovado na Meta',
      language: 'string (opcional, default: pt_BR) - Código do idioma',
      header: 'object (opcional) - Parâmetros do header',
      body_parameters: 'array (opcional) - Array de strings para variáveis do body',
      button_parameters: 'array (opcional) - Array de objetos { index, text } para botões',
    },
    header_options: {
      text: '{ type: "text", parameters: ["valor"] }',
      image: '{ type: "image", url: "https://..." }',
      video: '{ type: "video", url: "https://..." }',
      document: '{ type: "document", url: "https://...", filename: "arquivo.pdf" }',
    },
  });
}
