/**
 * Módulo para gerenciar configuração de respostas automáticas
 */

import { getSupabaseClient } from './supabase';

export interface ResponseConfig {
  id: string;
  default_message: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Cache simples para evitar múltiplas queries simultâneas
let configCache: { config: ResponseConfig | null; timestamp: number } | null = null;
const CACHE_TTL = 30000; // 30 segundos

/**
 * Busca a configuração de resposta automática ativa
 * Retorna a primeira configuração encontrada com enabled = true
 * Inclui retry logic para lidar com erros de conexão temporários
 * @returns Configuração ativa ou null se não houver configuração habilitada
 */
export async function getResponseConfig(maxRetries: number = 2): Promise<ResponseConfig | null> {
  // Verificar cache primeiro
  if (configCache && (Date.now() - configCache.timestamp) < CACHE_TTL) {
    console.log('[RESPONSE_CONFIG] Usando cache:', {
      hasConfig: !!configCache.config,
      cacheAge: Date.now() - configCache.timestamp,
    });
    return configCache.config;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
          console.log('[RESPONSE_CONFIG] Nenhuma configuração de resposta automática habilitada');
          configCache = { config: null, timestamp: Date.now() };
          return null;
        }

        // Se for erro de conexão e ainda tiver tentativas, tentar novamente
        if (isConnectionError(error.message) && attempt < maxRetries) {
          const delay = (attempt + 1) * 1000;
          console.warn(`[RESPONSE_CONFIG] Erro de conexão (tentativa ${attempt + 1}/${maxRetries + 1}), tentando novamente em ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          lastError = new Error(error.message);
          continue;
        }

        console.error('[RESPONSE_CONFIG] Erro ao buscar configuração:', {
          code: error.code,
          message: error.message,
        });
        return null;
      }

      if (!data) {
        console.log('[RESPONSE_CONFIG] Nenhuma configuração encontrada');
        configCache = { config: null, timestamp: Date.now() };
        return null;
      }

      // Validar se a mensagem padrão está configurada
      if (!data.default_message || data.default_message.trim() === '') {
        console.warn('[RESPONSE_CONFIG] Configuração encontrada mas default_message está vazia');
        return null;
      }

      console.log('[RESPONSE_CONFIG] Configuração encontrada:', {
        id: data.id,
        enabled: data.enabled,
        messageLength: data.default_message.length,
      });

      const config = data as ResponseConfig;
      configCache = { config, timestamp: Date.now() };

      return config;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (isConnectionError(lastError.message) && attempt < maxRetries) {
        const delay = (attempt + 1) * 1000;
        console.warn(`[RESPONSE_CONFIG] Erro de conexão (tentativa ${attempt + 1}/${maxRetries + 1}), tentando novamente em ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      console.error('[RESPONSE_CONFIG] Erro inesperado:', lastError.message);
    }
  }

  // Se chegou aqui, todas as tentativas falharam
  if (lastError) {
    console.error('[RESPONSE_CONFIG] Falha após todas as tentativas:', lastError.message);
  }

  return null;
}

/**
 * Verifica se o erro é um erro de conexão temporário
 */
function isConnectionError(message: string | undefined): boolean {
  if (!message) return false;
  
  const connectionErrors = [
    'fetch failed',
    'SocketError',
    'UND_ERR_SOCKET',
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
  ];
  
  return connectionErrors.some((err) => message.includes(err));
}

/**
 * Invalida o cache de configuração
 * Útil para forçar uma nova busca após atualizações
 */
export function invalidateConfigCache(): void {
  configCache = null;
  console.log('[RESPONSE_CONFIG] Cache invalidado');
}
