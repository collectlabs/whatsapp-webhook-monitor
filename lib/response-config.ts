/**
 * Módulo para gerenciar configuração de respostas automáticas
 * Busca a mensagem padrão da tabela response_config do Supabase
 */

import { getSupabaseClient } from './supabase';

export interface ResponseConfig {
  id: string;
  default_message: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Mensagem fallback caso não consiga buscar do banco
const FALLBACK_MESSAGE = 'Olá! Agradecemos o seu retorno. Como podemos ajudar?';

// Cache simples para evitar múltiplas queries
let configCache: { config: ResponseConfig | null; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 1 minuto

/**
 * Busca a configuração de resposta automática do Supabase
 * Se falhar, retorna configuração com mensagem fallback
 */
export async function getResponseConfig(): Promise<ResponseConfig | null> {
  // Verificar cache primeiro
  if (configCache && (Date.now() - configCache.timestamp) < CACHE_TTL) {
    console.log('[RESPONSE_CONFIG] Usando cache');
    return configCache.config;
  }

  try {
    console.log('[RESPONSE_CONFIG] Buscando configuração do Supabase...');
    
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('response_config')
      .select('*')
      .eq('enabled', true)
      .limit(1)
      .single();

    if (error) {
      // Se não encontrar registro, não é erro crítico
      if (error.code === 'PGRST116') {
        console.log('[RESPONSE_CONFIG] Nenhuma configuração habilitada no banco');
        // Retorna fallback
        const fallbackConfig: ResponseConfig = {
          id: 'fallback',
          default_message: FALLBACK_MESSAGE,
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        configCache = { config: fallbackConfig, timestamp: Date.now() };
        return fallbackConfig;
      }

      console.error('[RESPONSE_CONFIG] Erro ao buscar do Supabase:', error.message);
      // Em caso de erro, usa fallback
      const fallbackConfig: ResponseConfig = {
        id: 'fallback',
        default_message: FALLBACK_MESSAGE,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      configCache = { config: fallbackConfig, timestamp: Date.now() };
      return fallbackConfig;
    }

    if (!data || !data.default_message) {
      console.log('[RESPONSE_CONFIG] Dados inválidos no banco, usando fallback');
      const fallbackConfig: ResponseConfig = {
        id: 'fallback',
        default_message: FALLBACK_MESSAGE,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      configCache = { config: fallbackConfig, timestamp: Date.now() };
      return fallbackConfig;
    }

    console.log('[RESPONSE_CONFIG] Configuração encontrada:', {
      id: data.id,
      messageLength: data.default_message.length,
    });

    const config = data as ResponseConfig;
    configCache = { config, timestamp: Date.now() };
    return config;

  } catch (error) {
    console.error('[RESPONSE_CONFIG] Erro inesperado:', error);
    // Em caso de erro, usa fallback
    const fallbackConfig: ResponseConfig = {
      id: 'fallback',
      default_message: FALLBACK_MESSAGE,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    configCache = { config: fallbackConfig, timestamp: Date.now() };
    return fallbackConfig;
  }
}

/**
 * Invalida o cache de configuração
 */
export function invalidateConfigCache(): void {
  configCache = null;
  console.log('[RESPONSE_CONFIG] Cache invalidado');
}
