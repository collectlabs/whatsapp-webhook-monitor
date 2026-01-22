/**
 * Módulo para gerenciar configuração de respostas automáticas
 */

import { getSupabaseClient } from './supabase';

export interface ResponseConfig {
  id: string;
  default_message: string;
  time_window_hours: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Busca a configuração de resposta automática ativa
 * Retorna a primeira configuração encontrada com enabled = true
 * @returns Configuração ativa ou null se não houver configuração habilitada
 */
export async function getResponseConfig(): Promise<ResponseConfig | null> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('response_config')
      .select('*')
      .eq('enabled', true)
      .limit(1)
      .single();

    if (error) {
      // Se não encontrar nenhum registro, não é um erro crítico
      if (error.code === 'PGRST116') {
        console.log('[RESPONSE_CONFIG] Nenhuma configuração de resposta automática encontrada ou desabilitada');
        return null;
      }

      console.error('[RESPONSE_CONFIG] Erro ao buscar configuração:', error);
      return null;
    }

    if (!data) {
      console.log('[RESPONSE_CONFIG] Nenhuma configuração de resposta automática encontrada');
      return null;
    }

    // Validar se a mensagem padrão está configurada
    if (!data.default_message || data.default_message.trim() === '') {
      console.warn('[RESPONSE_CONFIG] Configuração encontrada mas default_message está vazia');
      return null;
    }

    console.log('[RESPONSE_CONFIG] Configuração de resposta automática encontrada:', {
      id: data.id,
      enabled: data.enabled,
      messageLength: data.default_message.length,
    });

    return data as ResponseConfig;
  } catch (error) {
    console.error('[RESPONSE_CONFIG] Erro inesperado ao buscar configuração:', error);
    return null;
  }
}
