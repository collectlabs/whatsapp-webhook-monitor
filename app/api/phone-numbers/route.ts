import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { listAccounts, getCredentials } from '@/lib/whatsapp-accounts';
import { getAllPhoneConfigs } from '@/lib/auto-reply-phone-config';
import {
  fetchPhoneNumbersFromMeta,
  fetchHealthStatusFromMeta,
  savePhoneNumberMeta,
  saveWabaHealthStatus,
  getPhoneNumberMetaBatch,
  getWabaHealthStatusBatch,
  type MetaHealthEntity,
} from '@/lib/meta-phone-health';

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  const configuredApiKey = process.env.API_KEY;
  if (!configuredApiKey) return false;
  return apiKey === configuredApiKey;
}

/**
 * GET - Lista todos os números cadastrados no Supabase (auto_reply_phone_config) com status, WABA e saúde (Meta).
 * Retorna: waba_id, waba_name, bm_id, bm_name, phone_id, phone_number, allowed_for_sending, auto_reply_enabled, message, status,
 * number_quality_rating, verified_name, waba_status, bm_status.
 * status: indica se o phone_number_id está configurado nas WABAs do Supabase.
 *   - 'ok' = número está em algum phone_ids da tabela wabas.
 *   - 'env_false' = número está na tabela auto_reply mas NÃO está em nenhuma WABA no Supabase.
 */
export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, error: 'API Key inválida ou não fornecida' },
      { status: 401 }
    );
  }

  try {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0f40f6'},body:JSON.stringify({sessionId:'0f40f6',location:'phone-numbers/route.ts:GET:entry',message:'GET try started',data:{},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    const configs = await getAllPhoneConfigs();
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0f40f6'},body:JSON.stringify({sessionId:'0f40f6',location:'phone-numbers/route.ts:after getAllPhoneConfigs',message:'configs loaded',data:{count:configs?.length},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    const accounts = await listAccounts();
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0f40f6'},body:JSON.stringify({sessionId:'0f40f6',location:'phone-numbers/route.ts:after listAccounts',message:'accounts loaded',data:{count:accounts?.length},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    const phoneToWaba: Record<string, string> = {};
    const phoneToWabaName: Record<string, string> = {};
    for (const { waba_id, waba_name, phone_ids } of accounts) {
      for (const pid of phone_ids) {
        const key = String(pid);
        phoneToWaba[key] = waba_id;
        phoneToWabaName[key] = waba_name;
      }
    }

    const uniqueWabaIds = [...new Set(accounts.map((a) => a.waba_id))];
    const supabase = getSupabaseClient();
    const { data: wabaRows, error: wabaSelectError } = await supabase
      .from('wabas')
      .select('meta_waba_id, bm_uuid');
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0f40f6'},body:JSON.stringify({sessionId:'0f40f6',location:'phone-numbers/route.ts:after wabas select',message:'wabas select done',data:{rowCount:(wabaRows??[]).length,hasError:!!wabaSelectError,errorCode:wabaSelectError?.code,errorMessage:wabaSelectError?.message},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    const wabaToBmUuid: Record<string, string | null> = {};
    for (const r of wabaRows ?? []) {
      const row = r as { meta_waba_id: string; bm_uuid?: string };
      if (uniqueWabaIds.includes(row.meta_waba_id)) wabaToBmUuid[row.meta_waba_id] = row.bm_uuid ?? null;
    }

    const phoneMetaMap: Record<
      string,
      {
        quality_rating: string | null;
        verified_name: string | null;
        waba_id: string | null;
      }
    > = {};
    const healthMap: Record<string, MetaHealthEntity[]> = {};

    for (const wabaId of uniqueWabaIds) {
      let token: string;
      try {
        const creds = await getCredentials(wabaId);
        token = creds.accessToken;
      } catch {
        continue;
      }
      try {
        const [phoneList, healthEntities] = await Promise.all([
          fetchPhoneNumbersFromMeta(wabaId, token),
          fetchHealthStatusFromMeta(wabaId, token),
        ]);
        for (const p of phoneList) {
          await savePhoneNumberMeta(
            p.id,
            wabaId,
            p.quality_rating ?? null,
            p.verified_name ?? null
          );
          phoneMetaMap[p.id] = {
            quality_rating: p.quality_rating ?? null,
            verified_name: p.verified_name ?? null,
            waba_id: wabaId,
          };
        }
        await saveWabaHealthStatus(wabaId, healthEntities, wabaToBmUuid[wabaId] ?? null);
        healthMap[wabaId] = healthEntities;
      } catch (err) {
        console.error('[PHONE_NUMBERS] Meta API para WABA', wabaId, err);
      }
    }

    const phoneIds = configs.map((c) => c.phone_number_id);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0f40f6'},body:JSON.stringify({sessionId:'0f40f6',location:'phone-numbers/route.ts:before getPhoneNumberMetaBatch',message:'about to fetch meta batch',data:{phoneIdsCount:phoneIds.length},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    const savedPhoneMeta = await getPhoneNumberMetaBatch(phoneIds);
    const wabaIdsFromEnv = [...new Set(Object.values(phoneToWaba))];
    const wabaIdsFromMeta = [
      ...new Set(
        Object.values(savedPhoneMeta)
          .map((m) => m.waba_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const wabaIdsForFallback = [
      ...new Set([...wabaIdsFromEnv, ...wabaIdsFromMeta]),
    ];
    const savedHealth = await getWabaHealthStatusBatch(wabaIdsForFallback);

    const items = configs.map((config) => {
      const meta =
        phoneMetaMap[config.phone_number_id] ??
        savedPhoneMeta[config.phone_number_id] ??
        null;
      const phoneIdStr = String(config.phone_number_id);
      const wabaId =
        phoneToWaba[phoneIdStr] ?? meta?.waba_id ?? null;
      const isConfiguredInEnv = phoneIdStr in phoneToWaba;
      const status = isConfiguredInEnv ? 'ok' : 'env_false';
      const healthRaw =
        (wabaId && (healthMap[wabaId] ?? savedHealth[wabaId])) ?? [];
      const health = Array.isArray(healthRaw) ? healthRaw : [];
      const wabaEntity = health.find((e) => e.entity_type === 'WABA');
      const bmEntity = health.find((e) => e.entity_type === 'BUSINESS');
      const account = wabaId ? accounts.find((a) => a.waba_id === wabaId) : null;
      const wabaName =
        phoneToWabaName[phoneIdStr] ?? account?.waba_name ?? null;
      return {
        waba_id: wabaId,
        waba_name: wabaName,
        bm_id: account?.bm_id ?? null,
        bm_name: account?.bm_name ?? null,
        phone_id: config.phone_number_id,
        phone_number: config.phone_number ?? config.phone_number_id,
        allowed_for_sending: config.allowed_for_sending,
        auto_reply_enabled: config.enabled,
        message: config.message || null,
        status,
        number_quality_rating: meta?.quality_rating ?? null,
        verified_name: meta?.verified_name ?? null,
        waba_status: wabaEntity?.can_send_message ?? null,
        bm_status: bmEntity?.can_send_message ?? null,
      };
    });

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0f40f6'},body:JSON.stringify({sessionId:'0f40f6',location:'phone-numbers/route.ts:before return',message:'success path',data:{itemsCount:items.length},timestamp:Date.now(),hypothesisId:'ok'})}).catch(()=>{});
    // #endregion
    return NextResponse.json({
      success: true,
      count: items.length,
      numbers: items,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao listar números';
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bcc78ab0-226b-408e-9be5-e85475e37b10',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0f40f6'},body:JSON.stringify({sessionId:'0f40f6',location:'phone-numbers/route.ts:catch',message:'500 error',data:{message:msg,name:error instanceof Error?error.name:undefined,stack:error instanceof Error?(error.stack||'').slice(0,500):undefined},timestamp:Date.now(),hypothesisId:'all'})}).catch(()=>{});
    // #endregion
    console.error('[PHONE_NUMBERS]', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
