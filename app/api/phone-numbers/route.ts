import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { listAccounts, getCredentials } from '@/lib/whatsapp-accounts';
import {
  fetchPhoneNumbersFromMeta,
  fetchHealthStatusFromMeta,
  savePhoneNumberMeta,
  saveWabaHealthStatus,
  getPhoneNumberMetaBatch,
  getWabaHealthStatusBatch,
  type MetaHealthEntity,
} from '@/lib/meta-phone-health';

/** Registro de phone_numbers no Supabase (fonte da verdade para listagem). */
interface PhoneNumberRow {
  meta_phone_number_id: string;
  waba_uuid: string;
  enabled_for_sending?: boolean;
  auto_reply_enabled?: boolean;
  auto_reply_message?: string | null;
  display_phone_number?: string | null;
}

/**
 * Busca todos os números da tabela phone_numbers.
 * Usa meta_phone_number_id + waba_uuid; fallback para schema legado (phone_number_id, waba_id).
 */
async function getAllPhoneNumbersFromSupabase(): Promise<PhoneNumberRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('meta_phone_number_id, waba_uuid, enabled_for_sending, auto_reply_enabled, auto_reply_message, display_phone_number')
    .order('meta_phone_number_id');

  if (!error && data?.length) {
    return data as PhoneNumberRow[];
  }
  if (error?.message?.includes('enabled_for_sending') || error?.message?.includes('auto_reply') || error?.message?.includes('display_phone_number')) {
    const { data: dataWithoutExtra, error: err2 } = await supabase
      .from('phone_numbers')
      .select('meta_phone_number_id, waba_uuid')
      .order('meta_phone_number_id');
    if (!err2 && dataWithoutExtra?.length) {
      return (dataWithoutExtra as { meta_phone_number_id: string; waba_uuid: string }[]).map((r) => ({
        ...r,
        enabled_for_sending: true,
        auto_reply_enabled: false,
        auto_reply_message: null,
        display_phone_number: null,
      }));
    }
  }
  if (error?.message?.includes('waba_uuid') || error?.message?.includes('meta_phone_number_id')) {
    const { data: legacy } = await supabase
      .from('phone_numbers')
      .select('phone_number_id, waba_id')
      .order('phone_number_id');
    if (legacy?.length) {
      return legacy.map((r: { phone_number_id: string; waba_id: string }) => ({
        meta_phone_number_id: r.phone_number_id,
        waba_uuid: r.waba_id,
        enabled_for_sending: true,
        auto_reply_enabled: false,
        auto_reply_message: null,
        display_phone_number: null,
      }));
    }
  }
  return [];
}

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  const configuredApiKey = process.env.API_KEY;
  if (!configuredApiKey) return false;
  return apiKey === configuredApiKey;
}

/**
 * GET - Lista todos os números cadastrados no Supabase (tabela phone_numbers) com status, WABA e saúde (Meta).
 * Tudo centralizado em phone_numbers (enabled_for_sending, auto_reply_enabled, auto_reply_message, display_phone_number).
 * Retorna: waba_id, waba_name, bm_id, bm_name, phone_id, phone_number, enabled_for_sending, auto_reply_enabled, auto_reply_message, status,
 * number_quality_rating, verified_name, waba_status, bm_status.
 * status: indica se o número está associado a uma WABA no Supabase.
 *   - 'ok' = número está em phone_numbers com waba_uuid válido (WABA conhecida).
 *   - 'env_false' = número está em phone_numbers mas a WABA não está configurada para envio (token/env).
 */
export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, error: 'API Key inválida ou não fornecida' },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseClient();
    const phoneRows = await getAllPhoneNumbersFromSupabase();
    if (phoneRows.length === 0) {
      return NextResponse.json({ success: true, count: 0, numbers: [] });
    }

    const wabaUuids = [...new Set(phoneRows.map((p) => p.waba_uuid))];
    const { data: wabaRows } = await supabase
      .from('wabas')
      .select('waba_uuid, meta_waba_id, name, bm_uuid, enabled_for_sending')
      .in('waba_uuid', wabaUuids);
    const wabaByUuid: Record<string, { meta_waba_id: string; name: string; bm_uuid: string; enabled_for_sending?: boolean }> = {};
    for (const r of wabaRows ?? []) {
      const row = r as { waba_uuid: string; meta_waba_id: string; name: string; bm_uuid: string; enabled_for_sending?: boolean };
      wabaByUuid[row.waba_uuid] = {
        meta_waba_id: row.meta_waba_id,
        name: row.name ?? '',
        bm_uuid: row.bm_uuid,
        enabled_for_sending: row.enabled_for_sending ?? true,
      };
    }
    const bmUuids = [...new Set(Object.values(wabaByUuid).map((w) => w.bm_uuid).filter(Boolean))];
    const { data: bmsRows } = await supabase
      .from('bms')
      .select('bm_uuid, meta_bm_id, name, enabled_for_sending')
      .in('bm_uuid', bmUuids);
    const bmByUuid: Record<string, { meta_bm_id: string; name: string; enabled_for_sending?: boolean }> = {};
    for (const b of bmsRows ?? []) {
      const row = b as { bm_uuid: string; meta_bm_id: string; name: string; enabled_for_sending?: boolean };
      bmByUuid[row.bm_uuid] = {
        meta_bm_id: row.meta_bm_id,
        name: row.name ?? '',
        enabled_for_sending: row.enabled_for_sending ?? true,
      };
    }

    const phoneToWaba: Record<string, string> = {};
    const phoneToWabaName: Record<string, string> = {};
    const phoneToBmId: Record<string, string> = {};
    const phoneToBmName: Record<string, string> = {};
    for (const p of phoneRows) {
      const waba = wabaByUuid[p.waba_uuid];
      if (waba) {
        const key = String(p.meta_phone_number_id).trim();
        phoneToWaba[key] = waba.meta_waba_id;
        phoneToWabaName[key] = waba.name;
        const bm = bmByUuid[waba.bm_uuid];
        if (bm) {
          phoneToBmId[key] = bm.meta_bm_id;
          phoneToBmName[key] = bm.name;
        }
      }
    }

    const accounts = await listAccounts();
    const uniqueWabaIds = [...new Set(Object.values(phoneToWaba))];
    const { data: wabaRowsForBm } = await supabase
      .from('wabas')
      .select('meta_waba_id, bm_uuid');
    const wabaToBmUuid: Record<string, string | null> = {};
    for (const r of wabaRowsForBm ?? []) {
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

    const phoneIds = phoneRows.map((p) => String(p.meta_phone_number_id).trim());
    const savedPhoneMeta = await getPhoneNumberMetaBatch(phoneIds);
    const wabaIdsFromPhones = [...new Set(Object.values(phoneToWaba))];
    const wabaIdsFromMeta = [
      ...new Set(
        Object.values(savedPhoneMeta)
          .map((m) => m.waba_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const wabaIdsForFallback = [...new Set([...wabaIdsFromPhones, ...wabaIdsFromMeta])];
    const savedHealth = await getWabaHealthStatusBatch(wabaIdsForFallback);

    const phoneRowsAllowedByHierarchy = phoneRows.filter((row) => {
      const waba = wabaByUuid[row.waba_uuid];
      const bm = waba ? bmByUuid[waba.bm_uuid] : null;
      const phoneOk = row.enabled_for_sending !== false;
      const wabaOk = waba?.enabled_for_sending !== false;
      const bmOk = bm?.enabled_for_sending !== false;
      return phoneOk && wabaOk && bmOk;
    });

    const items = phoneRowsAllowedByHierarchy.map((row) => {
      const phoneIdStr = String(row.meta_phone_number_id).trim();
      const meta =
        phoneMetaMap[phoneIdStr] ?? savedPhoneMeta[phoneIdStr] ?? null;
      const wabaId = phoneToWaba[phoneIdStr] ?? meta?.waba_id ?? null;
      const isInWaba = phoneIdStr in phoneToWaba;
      const status = isInWaba ? 'ok' : 'env_false';
      const healthRaw =
        (wabaId && (healthMap[wabaId] ?? savedHealth[wabaId])) ?? [];
      const health = Array.isArray(healthRaw) ? healthRaw : [];
      const wabaEntity = health.find((e) => e.entity_type === 'WABA');
      const bmEntity = health.find((e) => e.entity_type === 'BUSINESS');
      const account = wabaId ? accounts.find((a) => a.waba_id === wabaId) : null;
      const wabaName =
        phoneToWabaName[phoneIdStr] ?? account?.waba_name ?? null;
      const bmId = phoneToBmId[phoneIdStr] ?? account?.bm_id ?? null;
      const bmName = phoneToBmName[phoneIdStr] ?? account?.bm_name ?? null;
      return {
        waba_id: wabaId,
        waba_name: wabaName,
        bm_id: bmId,
        bm_name: bmName,
        phone_id: phoneIdStr,
        phone_number: row.display_phone_number ?? phoneIdStr,
        enabled_for_sending: row.enabled_for_sending !== false,
        auto_reply_enabled: row.auto_reply_enabled === true,
        auto_reply_message: row.auto_reply_message ?? null,
        status,
        number_quality_rating: meta?.quality_rating ?? null,
        verified_name: meta?.verified_name ?? null,
        waba_status: wabaEntity?.can_send_message ?? null,
        bm_status: bmEntity?.can_send_message ?? null,
      };
    });
    return NextResponse.json({
      success: true,
      count: items.length,
      numbers: items,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao listar números';
    console.error('[PHONE_NUMBERS]', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
