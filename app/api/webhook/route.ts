import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import {
  WhatsAppWebhookPayload,
} from '@/types/webhook';
import { processWebhookPayload, WEBHOOK_ALERT_FIELDS } from '@/lib/webhook-processor';
import { processAutoReply } from '@/lib/auto-reply-service';
import { getBmByWabaId, getWabaName } from '@/lib/whatsapp-accounts';
import { refreshHealthForWaba } from '@/lib/meta-phone-health';
import { toSaoPauloISOString, toSaoPauloTimestampString } from '@/lib/date-utils';

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

/** Payload de teste da Meta (formato "sample" ao clicar em Test no webhook) */
function isMetaTestSamplePayload(body: any): body is { sample: { field: string; value: any } } {
  return (
    body &&
    typeof body === 'object' &&
    body.sample &&
    typeof body.sample === 'object' &&
    typeof body.sample.field === 'string' &&
    body.sample.value != null
  );
}

/**
 * POST - Receber webhooks de mensagens do WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[DEBUG] Webhook POST recebido:', {
      object: body?.object,
      entriesCount: body?.entry?.length ?? 0,
      hasSample: !!body?.sample,
      sampleField: body?.sample?.field,
      timestamp: toSaoPauloISOString(),
    });

    // Formato de TESTE da Meta: { sample: { field: "account_alerts", value: { ... } } }
    // A Meta envia esse formato ao clicar em "Test" no painel do webhook (não tem object/entry)
    if (isMetaTestSamplePayload(body)) {
      const { sample } = body;
      const supabase = getSupabaseClient();
      if (sample.field === 'account_alerts' && sample.value?.alert_type != null) {
        const alert = sample.value;
        console.log('[WEBHOOK] Payload de teste account_alerts (sample) recebido, salvando em webhook_alerts:', {
          alert_type: alert.alert_type,
          entity_id: alert.entity_id,
        });
        const result = await supabase.from('webhook_alerts').insert({
          meta_waba_id: null,
          meta_bm_id: null,
          bm_name: null,
          field: sample.field,
          object: (body as Record<string, unknown>).object ?? null,
          entity_type: alert.entity_type ?? null,
          entity_id: alert.entity_id != null ? String(alert.entity_id) : null,
          alert_type: alert.alert_type ?? null,
          alert_severity: alert.alert_severity ?? null,
          alert_status: alert.alert_status ?? null,
          alert_description: alert.alert_description ?? null,
          raw_payload: body,
        });
        if (result.error) {
          console.error('[WEBHOOK] Erro ao salvar account_alert (teste):', result.error);
        } else {
          console.log('[WEBHOOK] account_alert (teste) salvo em webhook_alerts com sucesso');
        }
        return new NextResponse('OK', { status: 200 });
      }
      // Outro campo de sample (business_capability_update, template_category_update, etc.) → webhook_alerts
      console.log('[WEBHOOK] Payload sample com field:', sample.field, '- salvando em webhook_alerts');
      await supabase.from('webhook_alerts').insert({
        meta_waba_id: null,
        meta_bm_id: null,
        bm_name: null,
        field: sample.field,
        object: (body as Record<string, unknown>).object ?? null,
        entity_type: null,
        entity_id: null,
        alert_type: null,
        alert_severity: null,
        alert_status: null,
        alert_description: null,
        raw_payload: body,
      });
      return new NextResponse('OK', { status: 200 });
    }

    // Payload padrão: object + entry
    const bodyTyped = body as WhatsAppWebhookPayload;
    if (!bodyTyped.object || !bodyTyped.entry || !Array.isArray(bodyTyped.entry)) {
      console.error('Payload inválido:', JSON.stringify(body, null, 2));
      return new NextResponse('Invalid payload', { status: 400 });
    }

    // Processar apenas webhooks do tipo "whatsapp_business_account"
    if (bodyTyped.object !== 'whatsapp_business_account') {
      console.log('Webhook ignorado - objeto não é whatsapp_business_account:', bodyTyped.object);
      return new NextResponse('OK', { status: 200 });
    }

    // Log detalhado do payload para debug
    const hasAccountAlerts = bodyTyped.entry?.some((e) =>
      e.changes?.some((c) => c.field === 'account_alerts')
    );
    if (hasAccountAlerts) {
      console.log('[WEBHOOK] account_alerts detectado no payload');
    }
    const payloadDetails = {
      entries: bodyTyped.entry.map((entry) => ({
        id: entry.id,
        changes: entry.changes.map((change) => ({
          field: change.field,
          hasAccountAlerts: change.field === 'account_alerts',
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
    console.log('[DEBUG] Payload completo (raw):', JSON.stringify(bodyTyped, null, 2));

    // Extrair e processar TODOS os eventos (messages, statuses, e qualquer outro tipo)
    const allEventsData = processWebhookPayload(bodyTyped);

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
        entryCount: bodyTyped.entry?.length,
        changes: bodyTyped.entry?.flatMap(e => e.changes.map(c => ({
          field: c.field,
          valueKeys: Object.keys(c.value || {}),
          hasMessages: !!c.value?.messages,
          hasStatuses: !!c.value?.statuses,
        }))),
      });
      
      // Salvar o payload bruto completo em webhook_messages (tipo genérico)
      const supabase = getSupabaseClient();
      const rawWabaId = bodyTyped.entry[0]?.id ?? null;
      const bmForRaw = rawWabaId ? await getBmByWabaId(rawWabaId) : null;
      const wabaNameForRaw = rawWabaId ? await getWabaName(rawWabaId) : null;
      const result = await supabase.from('webhook_messages').insert({
        message_id: `raw_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        from_number: 'unknown',
        meta_waba_id: rawWabaId,
        waba_name: wabaNameForRaw,
        meta_phone_number_id: bodyTyped.entry[0]?.changes[0]?.value?.metadata?.phone_number_id ?? null,
        meta_bm_id: bmForRaw?.bm_id ?? null,
        bm_name: bmForRaw?.bm_name ?? null,
        timestamp: Math.floor(Date.now() / 1000),
        created_at: toSaoPauloTimestampString(),
        message_type: 'raw_webhook',
        message_body: `Nenhum evento processado. Payload completo salvo para análise.`,
        raw_payload: bodyTyped as any,
      });

      if (result.error) {
        console.error('[DEBUG] Erro ao salvar payload bruto:', result.error);
      } else {
        console.log('[DEBUG] Payload bruto salvo com sucesso no banco');
      }

      return new NextResponse('OK', { status: 200 });
    }

    // PRIMEIRO: Disparar respostas automáticas para mensagens de texto/button/audio
    // Isso é feito ANTES de salvar no banco para garantir que sempre responda
    for (const eventData of allEventsData) {
      if (eventData.message_type === 'text' || eventData.message_type === 'button' || eventData.message_type === 'audio') {
        console.log('[WEBHOOK] *** DISPARANDO RESPOSTA AUTOMÁTICA ***', {
          message_type: eventData.message_type,
          from_number: eventData.from_number,
          message_body: eventData.message_body,
        });
        // Não usar await para não bloquear o webhook
        processAutoReply(eventData).catch((err) => {
          console.error('[AUTO_REPLY] Erro ao processar resposta automática:', {
            message_id: eventData.message_id,
            error: err instanceof Error ? err.message : 'Erro desconhecido',
          });
        });
      }
    }

    // SEGUNDO: Separar eventos de mensagens (webhook_messages) vs alertas (webhook_alerts)
    const messageEvents = allEventsData.filter((e) => e.field === 'messages');
    const alertEvents = allEventsData.filter(
      (e) => e.field != null && WEBHOOK_ALERT_FIELDS.includes(e.field as any)
    );

    // Atualizar saúde no banco quando receber account_alerts ou business_capability_update (em background)
    const wabaIdsToRefresh = [...new Set(alertEvents.map((e) => e.waba_id).filter((id): id is string => Boolean(id)))];
    for (const wabaId of wabaIdsToRefresh) {
      refreshHealthForWaba(wabaId).catch((err) =>
        console.error('[WEBHOOK] refreshHealthForWaba falhou para waba_id', wabaId, err)
      );
    }

    const supabase = getSupabaseClient();

    // Inserir mensagens em webhook_messages
    const messageInsertPromises = messageEvents.map(async (eventData) => {
      const wabaId = eventData.waba_id ?? null;
      const bm = wabaId ? await getBmByWabaId(wabaId) : null;
      const wabaName = wabaId ? await getWabaName(wabaId) : null;
      console.log('[DEBUG] Salvando evento em webhook_messages:', {
        message_id: eventData.message_id,
        message_type: eventData.message_type,
      });
      const result = await supabase.from('webhook_messages').insert({
        message_id: eventData.message_id,
        from_number: eventData.from_number,
        meta_waba_id: wabaId,
        waba_name: wabaName,
        meta_phone_number_id: eventData.to_number ?? null,
        meta_bm_id: bm?.bm_id ?? null,
        bm_name: bm?.bm_name ?? null,
        timestamp: eventData.timestamp,
        created_at: toSaoPauloTimestampString(),
        message_type: eventData.message_type,
        message_body: eventData.message_body,
        raw_payload: eventData.raw_payload as any,
      });
      if (result.error) {
        console.error('[DEBUG] Erro ao salvar em webhook_messages:', result.error);
      }
      return result;
    });

    // Inserir alertas em webhook_alerts
    const alertInsertPromises = alertEvents.map(async (eventData) => {
      let entity_type: string | null = null;
      let entity_id: string | null = null;
      let alert_type: string | null = null;
      let alert_severity: string | null = null;
      let alert_status: string | null = null;
      let alert_description: string | null = null;
      if (eventData.message_type === 'account_alert' && eventData.message_body) {
        try {
          const parsed = JSON.parse(eventData.message_body) as Record<string, unknown>;
          entity_type = parsed.entity_type != null ? String(parsed.entity_type) : null;
          entity_id = parsed.entity_id != null ? String(parsed.entity_id) : null;
          alert_type = parsed.alert_type != null ? String(parsed.alert_type) : null;
          alert_severity = parsed.alert_severity != null ? String(parsed.alert_severity) : null;
          alert_status = parsed.alert_status != null ? String(parsed.alert_status) : null;
          alert_description = parsed.alert_description != null ? String(parsed.alert_description) : null;
        } catch {
          // ignore parse error
        }
      }
      const wabaId = eventData.waba_id ?? null;
      const bm = wabaId ? await getBmByWabaId(wabaId) : null;
      console.log('[DEBUG] Salvando evento em webhook_alerts:', { field: eventData.field });
      const result = await supabase.from('webhook_alerts').insert({
        meta_waba_id: wabaId,
        meta_bm_id: bm?.bm_id ?? null,
        bm_name: bm?.bm_name ?? null,
        field: eventData.field ?? null,
        object: bodyTyped.object ?? null,
        entity_type,
        entity_id,
        alert_type,
        alert_severity,
        alert_status,
        alert_description,
        raw_payload: eventData.raw_payload as any,
      });
      if (result.error) {
        console.error('[DEBUG] Erro ao salvar em webhook_alerts:', result.error);
      }
      return result;
    });

    const [messageResults, alertResults] = await Promise.all([
      Promise.allSettled(messageInsertPromises),
      Promise.allSettled(alertInsertPromises),
    ]);

    const allResults = [...messageResults, ...alertResults];
    const errors = allResults.filter((r) => r.status === 'rejected');
    if (errors.length > 0) {
      console.error('Erros ao salvar eventos:', errors.map((e) =>
        e.status === 'rejected' ? (e as PromiseRejectedResult).reason : 'unknown'
      ));
    }

    const successCount =
      messageResults.filter((r) => r.status === 'fulfilled' && !(r.value as { error?: unknown }).error).length +
      alertResults.filter((r) => r.status === 'fulfilled' && !(r.value as { error?: unknown }).error).length;
    const totalSaved = messageEvents.length + alertEvents.length;
    const failedCount = totalSaved - successCount;

    console.log(
      `Webhook processado: ${successCount}/${totalSaved} eventos salvos (messages: ${messageEvents.length}, alerts: ${alertEvents.length})${failedCount > 0 ? `, ${failedCount} falharam` : ''}`
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
