/**
 * Configuração por meta_phone_number_id (id da Meta): resposta automática e permissão de envio.
 */

import { getSupabaseClient } from '@/lib/supabase';

export interface AutoReplyPhoneConfig {
  /** Id da Meta do número (coluna meta_phone_number_id); exposto como phone_number_id na API. */
  phone_number_id: string;
  enabled: boolean;
  message: string;
  allowed_for_sending: boolean;
  phone_number: string | null;
}

function rowToConfig(row: { meta_phone_number_id: string; enabled: boolean; message: string; allowed_for_sending: boolean; phone_number: string | null }): AutoReplyPhoneConfig {
  return {
    phone_number_id: row.meta_phone_number_id,
    enabled: row.enabled,
    message: row.message,
    allowed_for_sending: row.allowed_for_sending,
    phone_number: row.phone_number,
  };
}

/**
 * Busca a configuração para um número (resposta automática e se pode ser usado para envio).
 */
export async function getAutoReplyConfigForPhone(
  phoneNumberId: string
): Promise<AutoReplyPhoneConfig | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('auto_reply_phone_config')
    .select('meta_phone_number_id, enabled, message, allowed_for_sending, phone_number')
    .eq('meta_phone_number_id', phoneNumberId)
    .maybeSingle();

  if (error) {
    console.error('[AUTO_REPLY_PHONE_CONFIG] Erro ao buscar config:', error);
    return null;
  }
  return data ? rowToConfig(data) : null;
}

/**
 * Verifica se o número está habilitado para envio (API send-template).
 * Se não houver linha na tabela, considera permitido (retorna true).
 */
export async function isAllowedForSending(phoneNumberId: string): Promise<boolean> {
  const config = await getAutoReplyConfigForPhone(phoneNumberId);
  if (!config) return true;
  return config.allowed_for_sending === true;
}

/**
 * Busca configuração de vários números de uma vez (para listagem).
 */
export async function getConfigForPhoneIds(
  phoneIds: string[]
): Promise<Record<string, AutoReplyPhoneConfig>> {
  if (phoneIds.length === 0) return {};
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('auto_reply_phone_config')
    .select('meta_phone_number_id, enabled, message, allowed_for_sending, phone_number')
    .in('meta_phone_number_id', phoneIds);

  if (error) {
    console.error('[AUTO_REPLY_PHONE_CONFIG] Erro ao buscar configs:', error);
    return {};
  }
  const out: Record<string, AutoReplyPhoneConfig> = {};
  for (const row of data || []) {
    const config = rowToConfig(row);
    out[config.phone_number_id] = config;
  }
  return out;
}

/**
 * Retorna todos os números cadastrados na tabela (fonte da verdade para a listagem).
 */
export async function getAllPhoneConfigs(): Promise<AutoReplyPhoneConfig[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('auto_reply_phone_config')
    .select('meta_phone_number_id, enabled, message, allowed_for_sending, phone_number')
    .order('meta_phone_number_id');

  if (error) {
    console.error('[AUTO_REPLY_PHONE_CONFIG] Erro ao buscar todos os configs:', error);
    return [];
  }
  return (data ?? []).map(rowToConfig);
}
