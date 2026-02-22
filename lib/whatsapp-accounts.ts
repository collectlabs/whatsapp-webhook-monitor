/**
 * Módulo para resolver credenciais WhatsApp por waba_id/phone_id.
 * Estrutura: BM (token no .env) >> WABA >> NUMBER_ID. Dados de BMs e WABAs vêm do Supabase.
 * Token por BM: WHATSAPP_ACCESS_TOKEN_<bm.name> no .env.
 */

import { getSupabaseClient } from '@/lib/supabase';

export interface WhatsAppCredentials {
  accessToken: string;
  phoneNumberId: string;
}

const TOKEN_ENV_PREFIX = 'WHATSAPP_ACCESS_TOKEN_';

interface WabaEntry {
  token: string;
  phone_ids: string[];
  bm_id: string;
  bm_name: string;
  waba_name: string;
}

interface BmRef {
  bm_uuid: string;
  name: string;
  meta_bm_id: string;
}

interface WabaRow {
  meta_waba_id: string;
  waba_uuid: string;
  bm_uuid: string;
  name: string;
  phone_ids: string[];
  bms: BmRef | BmRef[] | null;
}

const CACHE_TTL_MS = 60_000;
let cache: { map: Record<string, WabaEntry>; expiresAt: number } | null = null;

async function buildWabaMap(): Promise<Record<string, WabaEntry>> {
  if (cache && Date.now() < cache.expiresAt) {
    return cache.map;
  }

  const supabase = getSupabaseClient();

  type WabaRowMin = { meta_waba_id: string; waba_uuid?: string; id?: string; bm_uuid: string; name: string };
  let rows: WabaRowMin[] = [];
  let wabaIdByUuid: Record<string, string> = {}; // waba_uuid ou id -> meta_waba_id
  let phoneIdsByMetaWabaId: Record<string, string[]> = {};

  const { data: wabas, error: wabasError } = await supabase
    .from('wabas')
    .select('meta_waba_id, waba_uuid, bm_uuid, name');

  if (wabasError) {
    const msg = wabasError.message ?? '';
    if (msg.includes('waba_uuid') || msg.includes('meta_waba_id') || msg.includes('bm_uuid')) {
      const { data: wabasLegacy, error: errLegacy } = await supabase
        .from('wabas')
        .select('id, meta_waba_id, bm_uuid, name');
      if (errLegacy) {
        console.error('[whatsapp-accounts] Erro ao carregar WABAs (fallback):', errLegacy);
        throw new Error(`Falha ao carregar contas WhatsApp do Supabase: ${errLegacy.message}`);
      }
      rows = (wabasLegacy ?? []) as WabaRowMin[];
      wabaIdByUuid = Object.fromEntries(rows.map((w) => [String(w.id ?? w.meta_waba_id), w.meta_waba_id]));
    } else {
      console.error('[whatsapp-accounts] Erro ao carregar WABAs do Supabase:', wabasError);
      throw new Error(`Falha ao carregar contas WhatsApp do Supabase: ${msg}`);
    }
  } else {
    rows = (wabas ?? []) as WabaRowMin[];
    wabaIdByUuid = Object.fromEntries(rows.map((w) => [String(w.waba_uuid ?? w.meta_waba_id), w.meta_waba_id]));
  }

  const wabaUuids = rows.map((w) => (w.waba_uuid ?? w.id) as string).filter(Boolean);
  if (wabaUuids.length > 0) {
    const { data: phones, error: phonesError } = await supabase
      .from('phone_numbers')
      .select('waba_uuid, meta_phone_number_id')
      .in('waba_uuid', wabaUuids);
    if (!phonesError && phones) {
      for (const p of phones as { waba_uuid: string; meta_phone_number_id: string }[]) {
        const metaWabaId = wabaIdByUuid[p.waba_uuid];
        if (metaWabaId) {
          if (!phoneIdsByMetaWabaId[metaWabaId]) phoneIdsByMetaWabaId[metaWabaId] = [];
          phoneIdsByMetaWabaId[metaWabaId].push(String(p.meta_phone_number_id).trim());
        }
      }
    } else if (phonesError && (phonesError.message?.includes('waba_uuid') || phonesError.message?.includes('meta_phone_number_id'))) {
      const { data: phonesLegacy } = await supabase
        .from('phone_numbers')
        .select('waba_id, phone_number_id')
        .in('waba_id', wabaUuids);
      if (phonesLegacy) {
        for (const p of phonesLegacy as { waba_id: string; phone_number_id: string }[]) {
          const metaWabaId = wabaIdByUuid[p.waba_id];
          if (metaWabaId) {
            if (!phoneIdsByMetaWabaId[metaWabaId]) phoneIdsByMetaWabaId[metaWabaId] = [];
            phoneIdsByMetaWabaId[metaWabaId].push(String(p.phone_number_id).trim());
          }
        }
      }
    }
  }

  const bmUuids = [...new Set(rows.map((w) => w.bm_uuid).filter(Boolean))];
  const bmsMap: Record<string, BmRef> = {};
  if (bmUuids.length > 0) {
    const { data: bmsRows, error: bmsError } = await supabase
      .from('bms')
      .select('bm_uuid, name, meta_bm_id')
      .in('bm_uuid', bmUuids);
    if (!bmsError && bmsRows) {
      for (const b of bmsRows as BmRef[]) {
        bmsMap[b.bm_uuid] = b;
      }
    }
  }

  const wabaMap: Record<string, WabaEntry> = {};
  for (const w of rows) {
    const bm = bmsMap[w.bm_uuid];
    if (!bm?.name) continue;

    const envKey = `${TOKEN_ENV_PREFIX}${bm.name}`;
    const token = process.env[envKey];
    if (!token || typeof token !== 'string') {
      console.warn(
        `[whatsapp-accounts] Token não configurado para BM "${bm.name}". Defina ${envKey} no .env`
      );
      continue;
    }

    const phoneIds = phoneIdsByMetaWabaId[w.meta_waba_id] ?? [];

    const wabaIdKey = w.meta_waba_id?.trim();
    if (!wabaIdKey) continue;
    wabaMap[wabaIdKey] = {
      token,
      phone_ids: phoneIds,
      bm_id: bm.meta_bm_id,
      bm_name: bm.name,
      waba_name: (w.name && String(w.name).trim()) || bm.name,
    };
  }

  cache = { map: wabaMap, expiresAt: Date.now() + CACHE_TTL_MS };
  return wabaMap;
}

/**
 * Retorna credenciais para envio: token (da BM) e phone_number_id.
 * wabaId é obrigatório; token é resolvido pela BM da WABA (env: WHATSAPP_ACCESS_TOKEN_<bm.name>).
 */
export async function getCredentials(
  wabaId: string,
  phoneId?: string
): Promise<WhatsAppCredentials> {
  if (!wabaId?.trim()) {
    throw new Error(
      'waba_id é obrigatório. Configure as WABAs na tabela wabas do Supabase.'
    );
  }
  const wabaMap = await buildWabaMap();
  const entry = wabaMap[wabaId.trim()];
  if (!entry) {
    throw new Error(
      `WABA não encontrada: ${wabaId}. Verifique a tabela wabas no Supabase e WHATSAPP_ACCESS_TOKEN_<NOME_BM> no .env.`
    );
  }
  const usePhoneId =
    phoneId && entry.phone_ids.includes(phoneId)
      ? phoneId
      : entry.phone_ids[0];
  if (!usePhoneId) {
    throw new Error(`Nenhum phone_id configurado para a WABA: ${wabaId}`);
  }
  return { accessToken: entry.token, phoneNumberId: usePhoneId };
}

/**
 * Resolve credenciais a partir apenas do phone_number_id.
 * number_id pertence a uma única WABA; token vem da BM dessa WABA.
 */
export async function getCredentialsByPhoneId(
  phoneNumberId: string
): Promise<WhatsAppCredentials | null> {
  const wabaMap = await buildWabaMap();
  for (const entry of Object.values(wabaMap)) {
    if (entry.phone_ids.includes(phoneNumberId)) {
      return { accessToken: entry.token, phoneNumberId };
    }
  }
  return null;
}

/**
 * Retorna { bm_id, bm_name } para um waba_id. Usado ao persistir em webhook_messages, webhook_alerts, messages.
 */
export async function getBmByWabaId(wabaId: string): Promise<{
  bm_id: string;
  bm_name: string;
} | null> {
  const wabaMap = await buildWabaMap();
  const entry = wabaMap[wabaId?.trim()];
  if (!entry) return null;
  return { bm_id: entry.bm_id, bm_name: entry.bm_name };
}

/**
 * Lista WABAs com waba_id, waba_name, phone_ids, bm_id e bm_name (sem tokens).
 */
export async function listAccounts(): Promise<
  Array<{
    waba_id: string;
    waba_name: string;
    phone_ids: string[];
    bm_id: string;
    bm_name: string;
  }>
> {
  const wabaMap = await buildWabaMap();
  return Object.entries(wabaMap).map(([waba_id, entry]) => ({
    waba_id,
    waba_name: entry.waba_name,
    phone_ids: entry.phone_ids,
    bm_id: entry.bm_id,
    bm_name: entry.bm_name,
  }));
}

/**
 * Retorna o nome da WABA a partir do waba_id.
 */
export async function getWabaName(wabaId: string): Promise<string> {
  const list = await listAccounts();
  const found = list.find((a) => a.waba_id === wabaId.trim());
  return found ? found.waba_name : wabaId.trim();
}
