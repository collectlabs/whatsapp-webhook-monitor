/**
 * Integração com Meta Graph API para phone_numbers (quality_rating, verified_name)
 * e health_status (WABA, BUSINESS, APP). Persiste no Supabase.
 */

import { getSupabaseClient } from '@/lib/supabase';
import { getCredentials } from '@/lib/whatsapp-accounts';

const META_GRAPH_BASE = 'https://graph.facebook.com/v24.0';

export interface MetaPhoneNumberItem {
  id: string;
  quality_rating?: string | null;
  verified_name?: string | null;
}

export interface MetaHealthEntity {
  entity_type: string;
  id: string;
  can_send_message: string;
}

/** Resposta da API /{waba_id}/phone_numbers */
interface MetaPhoneNumbersResponse {
  data?: Array<{
    id?: string;
    quality_rating?: string;
    verified_name?: string;
  }>;
  error?: { message: string };
}

/** Resposta da API /{waba_id}?fields=health_status */
interface MetaHealthStatusResponse {
  health_status?: {
    entities?: MetaHealthEntity[];
  };
  error?: { message: string };
}

/**
 * Busca números da WABA na Meta e retorna id, quality_rating, verified_name.
 */
export async function fetchPhoneNumbersFromMeta(
  wabaId: string,
  accessToken: string
): Promise<MetaPhoneNumberItem[]> {
  const url = `${META_GRAPH_BASE}/${wabaId}/phone_numbers?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const body = (await res.json()) as MetaPhoneNumbersResponse;

  if (!res.ok || body.error) {
    const msg = body.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Meta phone_numbers: ${msg}`);
  }

  const list = body.data ?? [];
  return list.map((item) => ({
    id: item.id ?? '',
    quality_rating: item.quality_rating ?? null,
    verified_name: item.verified_name ?? null,
  }));
}

/**
 * Busca health_status da WABA na Meta (entities: WABA, BUSINESS, APP).
 */
export async function fetchHealthStatusFromMeta(
  wabaId: string,
  accessToken: string
): Promise<MetaHealthEntity[]> {
  const url = `${META_GRAPH_BASE}/${wabaId}?fields=health_status&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const body = (await res.json()) as MetaHealthStatusResponse;

  if (!res.ok || body.error) {
    const msg = body.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Meta health_status: ${msg}`);
  }

  const entities = body.health_status?.entities ?? [];
  return entities.map((e) => ({
    entity_type: e.entity_type ?? '',
    id: e.id ?? '',
    can_send_message: e.can_send_message ?? '',
  }));
}

/**
 * Persiste/atualiza um número em phone_number_meta (upsert por meta_phone_number_id).
 */
export async function savePhoneNumberMeta(
  phoneNumberId: string,
  wabaId: string,
  qualityRating: string | null,
  verifiedName: string | null
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('phone_number_meta').upsert(
    {
      meta_phone_number_id: phoneNumberId,
      meta_waba_id: wabaId,
      quality_rating: qualityRating,
      verified_name: verifiedName,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'meta_phone_number_id' }
  );
  if (error) {
    console.error('[META_PHONE_HEALTH] savePhoneNumberMeta:', error);
    // Não propaga para não derrubar a API; dados serão preenchidos quando o schema estiver correto.
  }
}

function entitiesToRow(
  wabaId: string,
  healthStatus: MetaHealthEntity[]
): {
  meta_waba_id: string;
  meta_bm_id: string | null;
  bm_status: string | null;
  waba_status: string | null;
  app_id: string | null;
  app_status: string | null;
} {
  const business = healthStatus.find((e) => e.entity_type === 'BUSINESS');
  const waba = healthStatus.find((e) => e.entity_type === 'WABA');
  const app = healthStatus.find((e) => e.entity_type === 'APP');
  return {
    meta_waba_id: wabaId,
    meta_bm_id: business?.id ?? null,
    bm_status: business?.can_send_message ?? null,
    waba_status: waba?.can_send_message ?? null,
    app_id: app?.id ?? null,
    app_status: app?.can_send_message ?? null,
  };
}

/**
 * Persiste/atualiza health_status da WABA (upsert por meta_waba_id).
 * Salva cada entidade (BM, WABA, APP) em colunas próprias.
 * bm_uuid: opcional, FK para bms(bm_uuid) (preenchido para JOIN com nossa tabela bms).
 */
export async function saveWabaHealthStatus(
  wabaId: string,
  healthStatus: MetaHealthEntity[],
  bmUuid?: string | null
): Promise<void> {
  const supabase = getSupabaseClient();
  const row = entitiesToRow(wabaId, healthStatus);
  const { error } = await supabase.from('waba_health_status').upsert(
    {
      ...row,
      bm_uuid: bmUuid ?? null,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'meta_waba_id' }
  );
  if (error) {
    console.error('[META_PHONE_HEALTH] saveWabaHealthStatus:', error);
    // Não propaga para não derrubar a API; dados serão preenchidos quando o schema estiver correto.
  }
}

/**
 * Atualiza saúde (phone_number_meta + waba_health_status) para uma WABA.
 * Busca dados na Meta e persiste no banco. Usado por webhook (alertas) e opcionalmente após send-template.
 */
export async function refreshHealthForWaba(wabaId: string): Promise<void> {
  let token: string;
  try {
    const creds = await getCredentials(wabaId);
    token = creds.accessToken;
  } catch (err) {
    console.warn('[META_PHONE_HEALTH] refreshHealthForWaba: credenciais não encontradas para waba_id', wabaId, err);
    return;
  }

  const supabase = getSupabaseClient();
  const { data: wabaRow } = await supabase
    .from('wabas')
    .select('bm_uuid')
    .eq('meta_waba_id', wabaId.trim())
    .maybeSingle();
  const bmUuid = (wabaRow as { bm_uuid?: string } | null)?.bm_uuid ?? null;

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
    }
    await saveWabaHealthStatus(wabaId, healthEntities, bmUuid);
  } catch (err) {
    console.error('[META_PHONE_HEALTH] refreshHealthForWaba falhou para waba_id', wabaId, err);
    throw err;
  }
}

/**
 * Busca phone_number_meta por meta_phone_number_id (para fallback quando Meta falha).
 */
export async function getPhoneNumberMeta(
  phoneNumberId: string
): Promise<{ quality_rating: string | null; verified_name: string | null } | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('phone_number_meta')
    .select('quality_rating, verified_name')
    .eq('meta_phone_number_id', phoneNumberId)
    .maybeSingle();
  if (error) {
    console.error('[META_PHONE_HEALTH] getPhoneNumberMeta:', error);
    return null;
  }
  return data;
}

function rowToEntities(row: {
  meta_waba_id: string;
  meta_bm_id: string | null;
  bm_status: string | null;
  waba_status: string | null;
  app_id: string | null;
  app_status: string | null;
}): MetaHealthEntity[] {
  const entities: MetaHealthEntity[] = [];
  if (row.meta_bm_id != null && row.bm_status != null) {
    entities.push({
      entity_type: 'BUSINESS',
      id: row.meta_bm_id,
      can_send_message: row.bm_status,
    });
  }
  entities.push({
    entity_type: 'WABA',
    id: row.meta_waba_id,
    can_send_message: row.waba_status ?? '',
  });
  if (row.app_id != null && row.app_status != null) {
    entities.push({
      entity_type: 'APP',
      id: row.app_id,
      can_send_message: row.app_status,
    });
  }
  return entities;
}

/**
 * Busca health_status por meta_waba_id (para fallback quando Meta falha).
 */
export async function getWabaHealthStatus(
  wabaId: string
): Promise<MetaHealthEntity[] | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('waba_health_status')
    .select('meta_waba_id, meta_bm_id, bm_status, waba_status, app_id, app_status')
    .eq('meta_waba_id', wabaId)
    .maybeSingle();
  if (error) {
    console.error('[META_PHONE_HEALTH] getWabaHealthStatus:', error);
    return null;
  }
  if (!data) return null;
  return rowToEntities(data);
}

/**
 * Busca phone_number_meta para vários meta_phone_number_id (fallback em lote).
 * Inclui meta_waba_id para permitir fallback quando o número não está no env.
 */
export async function getPhoneNumberMetaBatch(
  phoneNumberIds: string[]
): Promise<
  Record<
    string,
    {
      quality_rating: string | null;
      verified_name: string | null;
      waba_id: string | null;
    }
  >
> {
  if (phoneNumberIds.length === 0) return {};
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('phone_number_meta')
    .select('meta_phone_number_id, quality_rating, verified_name, meta_waba_id')
    .in('meta_phone_number_id', phoneNumberIds);
  if (error) {
    console.error('[META_PHONE_HEALTH] getPhoneNumberMetaBatch:', error);
    return {};
  }
  const out: Record<
    string,
    {
      quality_rating: string | null;
      verified_name: string | null;
      waba_id: string | null;
    }
  > = {};
  for (const row of data ?? []) {
    out[row.meta_phone_number_id] = {
      quality_rating: row.quality_rating ?? null,
      verified_name: row.verified_name ?? null,
      waba_id: row.meta_waba_id ?? null,
    };
  }
  return out;
}

/**
 * Busca health_status para vários meta_waba_id (fallback em lote).
 */
export async function getWabaHealthStatusBatch(
  wabaIds: string[]
): Promise<Record<string, MetaHealthEntity[]>> {
  if (wabaIds.length === 0) return {};
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('waba_health_status')
    .select('meta_waba_id, meta_bm_id, bm_status, waba_status, app_id, app_status')
    .in('meta_waba_id', wabaIds);
  if (error) {
    console.error('[META_PHONE_HEALTH] getWabaHealthStatusBatch:', error);
    return {};
  }
  const out: Record<string, MetaHealthEntity[]> = {};
  for (const row of data ?? []) {
    out[row.meta_waba_id] = rowToEntities(row);
  }
  return out;
}
