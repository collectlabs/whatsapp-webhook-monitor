/**
 * Configuração por meta_phone_number_id: tudo centralizado na tabela phone_numbers.
 *   enabled_for_sending — permissão de disparo (hierarquia BM/WABA/phone)
 *   auto_reply_enabled — resposta automática habilitada
 *   auto_reply_message — mensagem de resposta automática
 *   display_phone_number — número de exibição
 */

import { getSupabaseClient } from '@/lib/supabase';

export interface AutoReplyPhoneConfig {
  phone_number_id: string;
  enabled: boolean;
  message: string;
  allowed_for_sending: boolean;
  phone_number: string | null;
}

/**
 * Busca a configuração para um número (tudo de phone_numbers).
 * Retorna null se não existir linha em phone_numbers para o número.
 */
export async function getAutoReplyConfigForPhone(
  phoneNumberId: string
): Promise<AutoReplyPhoneConfig | null> {
  const supabase = getSupabaseClient();
  const id = String(phoneNumberId).trim();

  const { data, error } = await supabase
    .from('phone_numbers')
    .select('meta_phone_number_id, auto_reply_enabled, auto_reply_message, enabled_for_sending, display_phone_number')
    .eq('meta_phone_number_id', id)
    .maybeSingle();

  if (error) {
    console.error('[AUTO_REPLY_PHONE_CONFIG] Erro ao buscar phone_numbers:', error);
    return null;
  }
  if (!data) return null;

  const row = data as {
    meta_phone_number_id: string;
    auto_reply_enabled?: boolean;
    auto_reply_message?: string | null;
    enabled_for_sending?: boolean;
    display_phone_number?: string | null;
  };

  return {
    phone_number_id: row.meta_phone_number_id,
    enabled: row.auto_reply_enabled === true,
    message: row.auto_reply_message ?? '',
    allowed_for_sending: row.enabled_for_sending !== false,
    phone_number: row.display_phone_number ?? null,
  };
}

/**
 * Verifica se o número está habilitado para envio (API send-template).
 * Lê enabled_for_sending de phone_numbers. Sem linha = permitido (true).
 */
export async function isAllowedForSending(phoneNumberId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('enabled_for_sending')
    .eq('meta_phone_number_id', String(phoneNumberId).trim())
    .maybeSingle();

  if (error) {
    console.error('[AUTO_REPLY_PHONE_CONFIG] Erro ao buscar enabled_for_sending:', error);
    return true;
  }
  if (!data) return true;
  return (data as { enabled_for_sending?: boolean }).enabled_for_sending !== false;
}

/**
 * Busca configuração de vários números (para listagem). Tudo de phone_numbers.
 */
export async function getConfigForPhoneIds(
  phoneIds: string[]
): Promise<Record<string, AutoReplyPhoneConfig>> {
  if (phoneIds.length === 0) return {};
  const supabase = getSupabaseClient();
  const ids = phoneIds.map((id) => String(id).trim());

  const { data, error } = await supabase
    .from('phone_numbers')
    .select('meta_phone_number_id, auto_reply_enabled, auto_reply_message, enabled_for_sending, display_phone_number')
    .in('meta_phone_number_id', ids);

  if (error) {
    console.error('[AUTO_REPLY_PHONE_CONFIG] Erro ao buscar phone_numbers em lote:', error);
    return {};
  }

  const out: Record<string, AutoReplyPhoneConfig> = {};
  for (const r of data ?? []) {
    const row = r as {
      meta_phone_number_id: string;
      auto_reply_enabled?: boolean;
      auto_reply_message?: string | null;
      enabled_for_sending?: boolean;
      display_phone_number?: string | null;
    };
    out[row.meta_phone_number_id] = {
      phone_number_id: row.meta_phone_number_id,
      enabled: row.auto_reply_enabled === true,
      message: row.auto_reply_message ?? '',
      allowed_for_sending: row.enabled_for_sending !== false,
      phone_number: row.display_phone_number ?? null,
    };
  }
  return out;
}

/**
 * Retorna todos os números com config (tudo de phone_numbers).
 */
export async function getAllPhoneConfigs(): Promise<AutoReplyPhoneConfig[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('meta_phone_number_id, auto_reply_enabled, auto_reply_message, enabled_for_sending, display_phone_number')
    .order('meta_phone_number_id');

  if (error) {
    console.error('[AUTO_REPLY_PHONE_CONFIG] Erro ao buscar todos os configs:', error);
    return [];
  }

  return (data ?? []).map((r) => {
    const row = r as {
      meta_phone_number_id: string;
      auto_reply_enabled?: boolean;
      auto_reply_message?: string | null;
      enabled_for_sending?: boolean;
      display_phone_number?: string | null;
    };
    return {
      phone_number_id: row.meta_phone_number_id,
      enabled: row.auto_reply_enabled === true,
      message: row.auto_reply_message ?? '',
      allowed_for_sending: row.enabled_for_sending !== false,
      phone_number: row.display_phone_number ?? null,
    };
  });
}
