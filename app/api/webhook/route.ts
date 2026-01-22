import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import {
  WhatsAppWebhookPayload,
} from '@/types/webhook';
import { processWebhookPayload } from '@/lib/webhook-processor';

/**
 * GET - Verificação do webhook pela Meta
 * A Meta envia um GET request para verificar o webhook durante a configuração
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

  // Verificar se o token corresponde
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Webhook verificado com sucesso');
    return new NextResponse(challenge, { status: 200 });
  }

  // Token inválido ou modo incorreto
  console.error('Falha na verificação do webhook:', { mode, token });
  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * POST - Receber webhooks de mensagens do WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const body: WhatsAppWebhookPayload = await request.json();

    // Validar estrutura básica do payload
    if (!body.object || !body.entry || !Array.isArray(body.entry)) {
      console.error('Payload inválido:', body);
      return new NextResponse('Invalid payload', { status: 400 });
    }

    // Processar apenas webhooks do tipo "whatsapp_business_account"
    if (body.object !== 'whatsapp_business_account') {
      console.log('Webhook ignorado - objeto não é whatsapp_business_account:', body.object);
      return new NextResponse('OK', { status: 200 });
    }

    // Extrair e processar mensagens
    const messagesData = processWebhookPayload(body);

    if (messagesData.length === 0) {
      console.log('Nenhuma mensagem encontrada no webhook (pode ser um status update)');
      return new NextResponse('OK', { status: 200 });
    }

    // Salvar todas as mensagens no Supabase
    const supabase = getSupabaseClient();
    const insertPromises = messagesData.map((messageData) =>
      supabase.from('whatsapp_messages').insert({
        message_id: messageData.message_id,
        from_number: messageData.from_number,
        to_number: messageData.to_number,
        timestamp: messageData.timestamp,
        message_type: messageData.message_type,
        message_body: messageData.message_body,
        raw_payload: messageData.raw_payload as any,
      })
    );

    const results = await Promise.allSettled(insertPromises);

    // Verificar se houve erros
    const errors = results.filter((result) => result.status === 'rejected');
    if (errors.length > 0) {
      console.error('Erros ao salvar mensagens:', errors);
      // Continuar mesmo com erros parciais, mas logar
    }

    const successCount = results.filter(
      (result) => result.status === 'fulfilled'
    ).length;

    console.log(
      `Webhook processado: ${successCount}/${messagesData.length} mensagens salvas`
    );

    // Sempre retornar 200 OK para a Meta, mesmo se houver erros
    // A Meta pode reenviar se retornarmos erro
    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    // Retornar 200 mesmo em caso de erro para evitar reenvios da Meta
    return new NextResponse('OK', { status: 200 });
  }
}
