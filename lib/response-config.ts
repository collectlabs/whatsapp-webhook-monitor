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
 * Inclui retry logic para lidar com erros de conexão temporários
 * @returns Configuração ativa ou null se não houver configuração habilitada
 */
export async function getResponseConfig(maxRetries: number = 2): Promise<ResponseConfig | null> {
  // #region agent log
  console.log('[DEBUG_GET_CONFIG_ENTRY] getResponseConfig chamada:', {
    maxRetries,
    timestamp: new Date().toISOString(),
  });
  // #endregion
  
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // #region agent log
      console.log('[DEBUG_GET_CONFIG_ATTEMPT] Tentativa de buscar config:', {
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        timestamp: new Date().toISOString(),
      });
      // #endregion
      
      const supabase = getSupabaseClient();
      
      // #region agent log
      console.log('[DEBUG_GET_CONFIG_SUPABASE] Cliente Supabase obtido:', {
        hasSupabase: !!supabase,
        timestamp: new Date().toISOString(),
      });
      // #endregion

      // #region agent log
      console.log('[DEBUG_GET_CONFIG_QUERY] Executando query no Supabase:', {
        timestamp: new Date().toISOString(),
      });
      // #endregion
      
      // Buscar configuração com timeout
      const queryPromise = supabase
        .from('response_config')
        .select('*')
        .eq('enabled', true)
        .limit(1)
        .single();
      
      // Adicionar timeout de 10 segundos
      const timeoutPromise = new Promise<{ data: null; error: { code: string; message: string } }>((resolve) => {
        setTimeout(() => {
          resolve({
            data: null,
            error: {
              code: 'TIMEOUT',
              message: 'Query timeout após 10 segundos',
            },
          });
        }, 10000);
      });
      
      // #region agent log
      console.log('[DEBUG_GET_CONFIG_RACE] Iniciando race entre query e timeout:', {
        timestamp: new Date().toISOString(),
      });
      // #endregion
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      
      // #region agent log
      console.log('[DEBUG_GET_CONFIG_RESULT] Resultado da query:', {
        hasData: !!data,
        hasError: !!error,
        errorCode: error?.code,
        errorMessage: error?.message,
        timestamp: new Date().toISOString(),
      });
      // #endregion

      if (error) {
        // Se não encontrar nenhum registro, não é um erro crítico
        if (error.code === 'PGRST116') {
          console.log('[RESPONSE_CONFIG] Nenhuma configuração de resposta automática encontrada ou desabilitada');
          return null;
        }

        // Se for erro de conexão e ainda tiver tentativas, tentar novamente
        if (
          (error.message?.includes('fetch failed') ||
            error.message?.includes('SocketError') ||
            error.message?.includes('UND_ERR_SOCKET') ||
            error.message?.includes('ECONNRESET') ||
            error.message?.includes('ETIMEDOUT')) &&
          attempt < maxRetries
        ) {
          const delay = (attempt + 1) * 1000; // Backoff exponencial simples
          console.warn(`[RESPONSE_CONFIG] Erro de conexão (tentativa ${attempt + 1}/${maxRetries + 1}), tentando novamente em ${delay}ms...`, {
            error: error.message,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
          lastError = error;
          continue;
        }

        console.error('[RESPONSE_CONFIG] Erro ao buscar configuração:', {
          code: error.code,
          message: error.message,
          details: error.details,
        });
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
    } catch (error: any) {
      lastError = error;

      // Se for erro de conexão e ainda tiver tentativas, tentar novamente
      if (
        (error?.message?.includes('fetch failed') ||
          error?.message?.includes('SocketError') ||
          error?.message?.includes('UND_ERR_SOCKET') ||
          error?.message?.includes('ECONNRESET') ||
          error?.message?.includes('ETIMEDOUT') ||
          error?.message?.includes('Timeout')) &&
        attempt < maxRetries
      ) {
        const delay = (attempt + 1) * 1000;
        console.warn(`[RESPONSE_CONFIG] Erro de conexão (tentativa ${attempt + 1}/${maxRetries + 1}), tentando novamente em ${delay}ms...`, {
          error: error?.message || 'Erro desconhecido',
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Se não for erro de conexão ou esgotaram as tentativas, logar e retornar null
      if (attempt === maxRetries) {
        console.error('[RESPONSE_CONFIG] Erro inesperado ao buscar configuração após todas as tentativas:', {
          error: error?.message || 'Erro desconhecido',
          stack: error?.stack,
        });
      }
    }
  }

  // Se chegou aqui, todas as tentativas falharam
  if (lastError) {
    console.error('[RESPONSE_CONFIG] Falha ao buscar configuração após todas as tentativas:', {
      error: lastError?.message || 'Erro desconhecido',
    });
  }

  return null;
}
