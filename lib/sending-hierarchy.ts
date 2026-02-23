/**
 * Validação hierárquica para disparo: BM, WABA e phone_numbers devem ter enabled_for_sending = true.
 * Usado pela API send-template e pela listagem da API phone-numbers.
 */

import { getSupabaseClient } from '@/lib/supabase';

function isColumnError(error: { message?: string } | null): boolean {
  const msg = error?.message ?? '';
  return msg.includes('enabled_for_sending') || msg.includes('column') || msg.includes('does not exist');
}

/**
 * Verifica se o par (waba_id, phone_id) está liberado para disparo segundo a hierarquia:
 * - BM da WABA deve ter enabled_for_sending = true
 * - WABA deve ter enabled_for_sending = true
 * - Número em phone_numbers deve ter enabled_for_sending = true
 * Retorna true apenas quando os três estiverem true.
 * Se a coluna enabled_for_sending não existir (migration não aplicada), considera true.
 */
export async function isEnabledForSendingByHierarchy(
  wabaId: string,
  phoneId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const phoneIdStr = String(phoneId).trim();
  const wabaIdStr = String(wabaId).trim();

  const { data: wabaRow, error: wabaError } = await supabase
    .from('wabas')
    .select('waba_uuid, bm_uuid, enabled_for_sending')
    .eq('meta_waba_id', wabaIdStr)
    .maybeSingle();

  if (wabaError && !isColumnError(wabaError)) return false;
  if (!wabaRow) return false;

  const waba = wabaRow as { waba_uuid: string; bm_uuid: string; enabled_for_sending?: boolean };
  if (waba.enabled_for_sending === false) return false;

  const { data: bmRow, error: bmError } = await supabase
    .from('bms')
    .select('enabled_for_sending')
    .eq('bm_uuid', waba.bm_uuid)
    .maybeSingle();

  if (bmError && !isColumnError(bmError)) return false;
  if (!bmRow) return false;

  const bm = bmRow as { enabled_for_sending?: boolean };
  if (bm.enabled_for_sending === false) return false;

  const { data: phoneRow, error: phoneError } = await supabase
    .from('phone_numbers')
    .select('enabled_for_sending')
    .eq('meta_phone_number_id', phoneIdStr)
    .maybeSingle();

  if (phoneError && !isColumnError(phoneError)) return false;
  if (!phoneRow) return false;

  const phone = phoneRow as { enabled_for_sending?: boolean };
  if (phone.enabled_for_sending === false) return false;

  return true;
}
