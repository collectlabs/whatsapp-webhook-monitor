import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import {
  WhatsAppWebhookPayload,
} from '@/types/webhook';
import { processWebhookPayload } from '@/lib/webhook-processor';
import { getResponseConfig } from '@/lib/response-config';
import { sendWhatsAppMessage } from '@/lib/whatsapp-sender';

// #region agent log
console.log('[DEBUG_IMPORT] Verificando import de sendWhatsAppMessage:', {
  hasSendWhatsAppMessage: typeof sendWhatsAppMessage !== 'undefined',
  isFunction: typeof sendWhatsAppMessage === 'function',
  type: typeof sendWhatsAppMessage,
  value: typeof sendWhatsAppMessage !== 'undefined' ? 'defined' : 'undefined',
  hypothesisId: 'A',
});
// #endregion

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
 * Processa respostas automáticas para mensagens de clientes
 * Envia resposta automática para mensagens de texto ou quick reply (button_reply)
 */
async function processAutomaticResponses(
  payload: WhatsAppWebhookPayload,
  eventsData: Array<{ message_id: string; from_number: string; to_number: string; message_type: string; message_body: string | null }>
): Promise<void> {
  try {
    console.log('[AUTO_RESPONSE] Iniciando processamento de respostas automáticas', {
      totalEvents: eventsData.length,
      hasPayload: !!payload,
      payloadEntries: payload.entry?.length || 0,
    });

    // #region agent log
    console.log('[DEBUG_BEFORE_GET_CONFIG] Antes de buscar getResponseConfig:', {
      timestamp: new Date().toISOString(),
    });
    // #endregion

    // Buscar configuração de resposta automática
    let responseConfig;
    try {
      // #region agent log
      console.log('[DEBUG_CALLING_GET_CONFIG] Chamando getResponseConfig agora:', {
        timestamp: new Date().toISOString(),
      });
      // #endregion
      
      responseConfig = await getResponseConfig();
      
      // #region agent log
      console.log('[DEBUG_AFTER_GET_CONFIG] Depois de getResponseConfig:', {
        hasResponseConfig: !!responseConfig,
        responseConfigId: responseConfig?.id,
        enabled: responseConfig?.enabled,
        hasMessage: !!responseConfig?.default_message,
        timestamp: new Date().toISOString(),
      });
      // #endregion
    } catch (configError) {
      // #region agent log
      console.error('[DEBUG_GET_CONFIG_ERROR] Erro ao buscar getResponseConfig:', {
        error: configError instanceof Error ? configError.message : String(configError),
        stack: configError instanceof Error ? configError.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      // #endregion
      throw configError;
    }
    
    if (!responseConfig) {
      console.log('[AUTO_RESPONSE] Resposta automática desabilitada ou não configurada');
      // #region agent log
      console.log('[DEBUG_NO_CONFIG] Sem configuração, retornando:', {
        timestamp: new Date().toISOString(),
      });
      // #endregion
      return;
    }

    // #region agent log
    console.log('[DEBUG_AFTER_CONFIG_CHECK] Depois da verificação de config:', {
      hasResponseConfig: !!responseConfig,
      timestamp: new Date().toISOString(),
    });
    // #endregion

    // Extrair phone_number_id do payload
    const phoneNumberId = payload.entry[0]?.changes[0]?.value?.metadata?.phone_number_id;
    
    // #region agent log
    console.log('[DEBUG_PHONE_NUMBER_ID] Verificando phone_number_id:', {
      phoneNumberId,
      hasPhoneNumberId: !!phoneNumberId,
      timestamp: new Date().toISOString(),
    });
    // #endregion
    
    if (!phoneNumberId) {
      console.warn('[AUTO_RESPONSE] phone_number_id não encontrado no payload');
      // #region agent log
      console.log('[DEBUG_NO_PHONE_ID] Sem phone_number_id, retornando:', {
        timestamp: new Date().toISOString(),
      });
      // #endregion
      return;
    }

    // Log detalhado de todos os eventos recebidos para debug
    console.log('[AUTO_RESPONSE] Eventos recebidos para análise:', {
      totalEvents: eventsData.length,
      events: eventsData.map((event) => ({
        message_type: event.message_type,
        from_number: event.from_number,
        message_body: event.message_body,
        isText: event.message_type === 'text',
        isInteractive: event.message_type === 'interactive',
        hasButtonText: event.message_body?.includes('Botão clicado'),
      })),
    });

    // Filtrar apenas mensagens de clientes (text ou interactive com button_reply)
    // Não enviar resposta para status updates (delivered, read, sent, etc.)
    const clientMessages = eventsData.filter((event) => {
      const isClientMessage = 
        event.message_type === 'text' || 
        (event.message_type === 'interactive' && event.message_body?.includes('Botão clicado'));
      
      // Excluir status updates
      const isStatusUpdate = ['sent', 'delivered', 'read', 'failed'].includes(event.message_type);
      
      const shouldProcess = isClientMessage && !isStatusUpdate;
      
      console.log('[AUTO_RESPONSE] Analisando evento:', {
        message_type: event.message_type,
        from_number: event.from_number,
        isClientMessage,
        isStatusUpdate,
        shouldProcess,
      });
      
      return shouldProcess;
    });

    if (clientMessages.length === 0) {
      console.log('[AUTO_RESPONSE] Nenhuma mensagem de cliente encontrada para resposta automática', {
        totalEvents: eventsData.length,
        eventTypes: eventsData.map(e => e.message_type),
      });
      return;
    }

    console.log(`[AUTO_RESPONSE] Processando ${clientMessages.length} mensagem(ns) de cliente(s) para resposta automática`);

    // Enviar resposta automática para cada mensagem de cliente
    // Usar Promise.allSettled para não bloquear se uma falhar
    const responsePromises = clientMessages.map(async (event) => {
      try {
        console.log('[AUTO_RESPONSE] 🔄 Iniciando processamento para evento:', {
          from: event.from_number,
          messageType: event.message_type,
          messageId: event.message_id,
        });

        console.log('[AUTO_RESPONSE] 📋 Parâmetros antes de chamar sendWhatsAppMessage:', {
          phoneNumberId,
          to: event.from_number,
          messageLength: responseConfig.default_message.length,
          messagePreview: responseConfig.default_message.substring(0, 50) + '...',
          hasResponseConfig: !!responseConfig,
          responseConfigId: responseConfig.id,
        });

        console.log('[AUTO_RESPONSE] 📞 Chamando sendWhatsAppMessage agora...');
        
        // #region agent log
        console.log('[DEBUG_BEFORE_AWAIT] Antes do await sendWhatsAppMessage:', {
          phoneNumberId,
          to: event.from_number,
          hasMessage: !!responseConfig.default_message,
          messageLength: responseConfig.default_message?.length,
          hasFunction: typeof sendWhatsAppMessage === 'function',
          functionType: typeof sendWhatsAppMessage,
          hypothesisId: 'D',
        });
        // #endregion
        
        let result;
        try {
          // #region agent log
          console.log('[DEBUG_ABOUT_TO_CALL] Prestes a chamar sendWhatsAppMessage:', {
            phoneNumberId,
            to: event.from_number,
            messagePreview: responseConfig.default_message?.substring(0, 30),
            hypothesisId: 'B',
          });
          // #endregion
          
          // #region agent log
          console.log('[DEBUG_CALLING_NOW] Chamando sendWhatsAppMessage AGORA:', {
            timestamp: new Date().toISOString(),
            hypothesisId: 'B',
          });
          // #endregion
          
          // Criar a Promise antes de await para verificar se está sendo criada
          const sendPromise = sendWhatsAppMessage({
            phoneNumberId: phoneNumberId,
            to: event.from_number,
            message: responseConfig.default_message,
          });
          
          // #region agent log
          console.log('[DEBUG_PROMISE_CREATED] Promise criada:', {
            hasPromise: !!sendPromise,
            isPromise: sendPromise instanceof Promise,
            timestamp: new Date().toISOString(),
            hypothesisId: 'C',
          });
          // #endregion
          
          result = await sendPromise;
          
          // #region agent log
          console.log('[DEBUG_AFTER_AWAIT] Depois do await sendWhatsAppMessage:', {
            hasResult: !!result,
            resultSuccess: result?.success,
            resultError: result?.error,
            resultKeys: result ? Object.keys(result) : [],
            hypothesisId: 'C',
          });
          // #endregion
        } catch (awaitError) {
          // #region agent log
          console.error('[DEBUG_AWAIT_ERROR] Erro no await sendWhatsAppMessage:', {
            errorMessage: awaitError instanceof Error ? awaitError.message : String(awaitError),
            errorType: awaitError instanceof Error ? awaitError.constructor.name : typeof awaitError,
            stack: awaitError instanceof Error ? awaitError.stack : undefined,
            hypothesisId: 'C',
          });
          // #endregion
          throw awaitError;
        }

        console.log('[AUTO_RESPONSE] ✅ sendWhatsAppMessage retornou:', {
          hasResult: !!result,
          resultType: typeof result,
          resultKeys: result ? Object.keys(result) : [],
        });

        console.log('[AUTO_RESPONSE] 📊 Resultado detalhado do envio:', {
          success: result?.success,
          messageId: result?.messageId,
          error: result?.error,
          to: event.from_number,
          fullResult: JSON.stringify(result),
        });

        if (result.success) {
          console.log('[AUTO_RESPONSE] ✅ Resposta automática enviada com sucesso:', {
            to: event.from_number,
            messageId: result.messageId,
          });
        } else {
          console.error('[AUTO_RESPONSE] ❌ Erro ao enviar resposta automática:', {
            to: event.from_number,
            error: result.error,
            phoneNumberId,
          });
        }
      } catch (error) {
        console.error('[AUTO_RESPONSE] ❌ Erro inesperado ao enviar resposta automática:', {
          to: event.from_number,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          stack: error instanceof Error ? error.stack : undefined,
          fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
      }
    });

    // Aguardar todas as respostas serem processadas (mas não bloquear o webhook)
    await Promise.allSettled(responsePromises);
    
    console.log('[AUTO_RESPONSE] Processamento de respostas automáticas concluído');
  } catch (error) {
    console.error('[AUTO_RESPONSE] Erro ao processar respostas automáticas:', error);
    // Não propagar o erro para não afetar o webhook
  }
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

    // Processar respostas automáticas para mensagens de clientes
    // Fazer de forma assíncrona para não bloquear a resposta do webhook
    // #region agent log
    console.log('[DEBUG_STARTING_PROCESS] Iniciando processAutomaticResponses:', {
      hasBody: !!body,
      eventsCount: allEventsData.length,
      timestamp: new Date().toISOString(),
    });
    // #endregion
    
    const processPromise = processAutomaticResponses(body, allEventsData);
    
    // #region agent log
    console.log('[DEBUG_PROCESS_PROMISE] Promise de processAutomaticResponses criada:', {
      hasPromise: !!processPromise,
      isPromise: processPromise instanceof Promise,
      timestamp: new Date().toISOString(),
    });
    // #endregion
    
    processPromise.catch((error) => {
      console.error('[AUTO_RESPONSE] Erro ao processar respostas automáticas:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      // Não propagar o erro para não afetar o webhook
    });

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
