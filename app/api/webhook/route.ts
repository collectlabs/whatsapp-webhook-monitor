import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import {
  WhatsAppWebhookPayload,
} from '@/types/webhook';
import { processWebhookPayload } from '@/lib/webhook-processor';
import { processAutoReply } from '@/lib/auto-reply-service';

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

  // Log detalhado para debug (sem expor o token completo em produção)
  console.log('Verificação do webhook:', {
    mode,
    tokenReceived: token ? `${token.substring(0, 4)}...` : 'null',
    tokenConfigured: verifyToken ? `${verifyToken.substring(0, 4)}...` : 'undefined',
    challenge: challenge ? 'presente' : 'ausente',
  });

  // Verificar se o token está configurado
  if (!verifyToken) {
    console.error('WEBHOOK_VERIFY_TOKEN não está configurado nas variáveis de ambiente');
    return new NextResponse('Server configuration error', { status: 500 });
  }

  // Verificar se todos os parâmetros necessários estão presentes
  if (!mode || !token || !challenge) {
    console.error('Parâmetros faltando:', { mode: !!mode, token: !!token, challenge: !!challenge });
    return new NextResponse('Missing required parameters', { status: 400 });
  }

  // Normalizar tokens (remover espaços em branco) e comparar
  const normalizedToken = token.trim();
  const normalizedVerifyToken = verifyToken.trim();

  // Verificar se o token corresponde
  if (mode === 'subscribe' && normalizedToken === normalizedVerifyToken) {
    console.log('Webhook verificado com sucesso');
    return new NextResponse(challenge, { 
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  // Token inválido ou modo incorreto
  console.error('Falha na verificação do webhook:', { 
    mode, 
    tokenMatch: normalizedToken === normalizedVerifyToken,
    tokenLength: normalizedToken.length,
    verifyTokenLength: normalizedVerifyToken.length,
  });
  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * POST - Receber webhooks de mensagens do WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const body: WhatsAppWebhookPayload = await request.json();

    console.log('[DEBUG] Webhook POST recebido:', {
      object: body.object,
      entriesCount: body.entry?.length || 0,
      hasEntries: !!body.entry,
      timestamp: new Date().toISOString(),
    });

    // Validar estrutura básica do payload
    if (!body.object || !body.entry || !Array.isArray(body.entry)) {
      console.error('Payload inválido:', JSON.stringify(body, null, 2));
      return new NextResponse('Invalid payload', { status: 400 });
    }

    // Processar apenas webhooks do tipo "whatsapp_business_account"
    if (body.object !== 'whatsapp_business_account') {
      console.log('Webhook ignorado - objeto não é whatsapp_business_account:', body.object);
      return new NextResponse('OK', { status: 200 });
    }

    // Log detalhado do payload para debug
    const payloadDetails = {
      entries: body.entry.map((entry) => ({
        id: entry.id,
        changes: entry.changes.map((change) => ({
          field: change.field,
          hasMessages: !!change.value?.messages,
          hasStatuses: !!change.value?.statuses,
          messagesCount: change.value?.messages?.length || 0,
          statusesCount: change.value?.statuses?.length || 0,
          allFields: Object.keys(change.value),
          // Capturar estrutura completa de mensagens interativas
          messages: change.value?.messages?.map((msg: any) => ({
            type: msg.type,
            hasInteractive: !!msg.interactive,
            interactiveType: msg.interactive?.type,
            interactiveKeys: msg.interactive ? Object.keys(msg.interactive) : [],
            // Log completo da mensagem interativa para debug
            interactiveFull: msg.interactive ? JSON.stringify(msg.interactive) : null,
          })) || [],
        })),
      })),
    };

    console.log('[DEBUG] Payload detalhado antes do processamento:', JSON.stringify(payloadDetails, null, 2));
    console.log('[DEBUG] Payload completo (raw):', JSON.stringify(body, null, 2));

    // Extrair e processar TODOS os eventos (messages, statuses, e qualquer outro tipo)
    const allEventsData = processWebhookPayload(body);

    console.log(`[DEBUG] Eventos extraídos: ${allEventsData.length}`, {
      events: allEventsData.map((event) => ({
        message_id: event.message_id,
        from: event.from_number,
        type: event.message_type,
        body: event.message_body,
      })),
    });

    // Salvar TODOS os eventos, mesmo que não haja nenhum
    // Isso garante que capturamos tudo que chegar no webhook
    if (allEventsData.length === 0) {
      console.log('[DEBUG] Nenhum evento encontrado no webhook - salvando payload bruto completo');
      console.log('[DEBUG] Estrutura do payload que não gerou eventos:', {
        entryCount: body.entry?.length,
        changes: body.entry?.flatMap(e => e.changes.map(c => ({
          field: c.field,
          valueKeys: Object.keys(c.value || {}),
          hasMessages: !!c.value?.messages,
          hasStatuses: !!c.value?.statuses,
        }))),
      });
      
      // Salvar o payload bruto completo mesmo sem eventos específicos
      const supabase = getSupabaseClient();
      const result = await supabase.from('whatsapp_messages').insert({
        message_id: `raw_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        from_number: 'unknown',
        to_number: body.entry[0]?.changes[0]?.value?.metadata?.phone_number_id || 'unknown',
        timestamp: Math.floor(Date.now() / 1000),
        message_type: 'raw_webhook',
        message_body: `Nenhum evento processado. Payload completo salvo para análise.`,
        raw_payload: body as any,
      });

      if (result.error) {
        console.error('[DEBUG] Erro ao salvar payload bruto:', result.error);
      } else {
        console.log('[DEBUG] Payload bruto salvo com sucesso no banco');
      }

      return new NextResponse('OK', { status: 200 });
    }

    // Salvar TODOS os eventos no Supabase (messages, statuses, e qualquer outro tipo)
    const supabase = getSupabaseClient();
    const insertPromises = allEventsData.map(async (eventData) => {
      console.log('[DEBUG] Tentando salvar evento no Supabase:', {
        message_id: eventData.message_id,
        message_type: eventData.message_type,
        from: eventData.from_number,
        body: eventData.message_body,
      });

      const result = await supabase.from('whatsapp_messages').insert({
        message_id: eventData.message_id,
        from_number: eventData.from_number,
        to_number: eventData.to_number,
        timestamp: eventData.timestamp,
        message_type: eventData.message_type,
        message_body: eventData.message_body,
        raw_payload: eventData.raw_payload as any, // Payload completo e bruto
      });

      console.log('[DEBUG] Resultado do insert no Supabase:', {
        message_id: eventData.message_id,
        hasError: !!result.error,
        errorMessage: result.error?.message,
        errorCode: result.error?.code,
        errorDetails: result.error?.details,
      });

      // Verificar se há erro na resposta do Supabase
      if (result.error) {
        console.error('[DEBUG] Erro ao salvar evento:', {
          message_id: eventData.message_id,
          message_type: eventData.message_type,
          error: result.error,
          errorMessage: result.error.message,
          errorDetails: result.error.details,
          errorHint: result.error.hint,
        });
        throw result.error;
      }

      // Processar resposta automática APENAS para text e button
      if (eventData.message_type === 'text' || eventData.message_type === 'button') {
        console.log('[WEBHOOK] Disparando resposta automática para:', {
          message_type: eventData.message_type,
          from_number: eventData.from_number,
        });
        processAutoReply(eventData).catch((err) => {
          console.error('[AUTO_REPLY] Erro ao processar resposta automática:', {
            message_id: eventData.message_id,
            error: err instanceof Error ? err.message : 'Erro desconhecido',
          });
        });
      }

      return result;
    });

    const results = await Promise.allSettled(insertPromises);

    // Verificar se houve erros (tanto rejected quanto errors do Supabase)
    const errors = results.filter((result) => result.status === 'rejected');
    if (errors.length > 0) {
      console.error('Erros ao salvar eventos:', errors.map((e) => 
        e.status === 'rejected' ? e.reason : 'unknown error'
      ));
    }

    // Contar sucessos (fulfilled sem erro do Supabase)
    const successCount = results.filter((result) => {
      if (result.status === 'fulfilled') {
        // Verificar se o resultado do Supabase tem erro
        return !result.value.error;
      }
      return false;
    }).length;

    const failedCount = allEventsData.length - successCount;

    console.log(
      `Webhook processado: ${successCount}/${allEventsData.length} eventos salvos${failedCount > 0 ? `, ${failedCount} falharam` : ''}`
    );

    // Sempre retornar 200 OK para a Meta, mesmo se houver erros
    // A Meta pode reenviar se retornarmos erro
    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    // Retornar 200 mesmo em caso de erro para evitar reenvios da Meta
    return new NextResponse('OK', { status: 200 });
  }
}
