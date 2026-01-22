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
  // #region agent log
  console.log('[DEBUG_GET_CONFIG_ENTRY] getResponseConfig chamada:', {
    maxRetries,
    hasCache: !!configCache,
    cacheAge: configCache ? Date.now() - configCache.timestamp : null,
    timestamp: new Date().toISOString(),
  });
  // #endregion
  
  // Verificar cache primeiro
  if (configCache && (Date.now() - configCache.timestamp) < CACHE_TTL) {
    // #region agent log
    console.log('[DEBUG_GET_CONFIG_CACHE_HIT] Usando cache:', {
      hasConfig: !!configCache.config,
      cacheAge: Date.now() - configCache.timestamp,
      timestamp: new Date().toISOString(),
    });
    // #endregion
    return configCache.config;
  }
  
  // #region agent log
  console.log('[DEBUG_GET_CONFIG_CACHE_MISS] Cache não disponível, buscando do banco:', {
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
      
      // Buscar configuração
      // #region agent log
      console.log('[DEBUG_GET_CONFIG_BEFORE_QUERY] Antes de executar query:', {
        timestamp: new Date().toISOString(),
      });
      // #endregion
      
      // Criar a query primeiro
      const query = supabase
        .from('response_config')
        .select('*')
        .eq('enabled', true)
        .limit(1)
        .single();
      
      // #region agent log
      console.log('[DEBUG_GET_CONFIG_QUERY_CREATED] Query criada, aguardando resultado:', {
        hasQuery: !!query,
        isPromise: query instanceof Promise,
        hasThen: typeof (query as any)?.then === 'function',
        timestamp: new Date().toISOString(),
      });
      // #endregion
      
      // Adicionar timeout manual de 3 segundos (reduzido para ser mais rápido)
      let timeoutId: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<{ data: null; error: { code: string; message: string } }>((resolve) => {
        timeoutId = setTimeout(() => {
          // #region agent log
          console.error('[DEBUG_GET_CONFIG_TIMEOUT] Query timeout após 3 segundos');
          // #endregion
          resolve({
            data: null,
            error: {
              code: 'TIMEOUT',
              message: 'Query timeout após 3 segundos',
            },
          });
        }, 3000);
      });
      
      let queryResult;
      try {
        // #region agent log
        console.log('[DEBUG_GET_CONFIG_AWAITING] Aguardando resultado da query (com timeout de 3s):', {
          timestamp: new Date().toISOString(),
        });
        // #endregion
        
        // Usar Promise.race para adicionar timeout
        const raceResult = await Promise.race([
          query.then((result) => {
            // #region agent log
            console.log('[DEBUG_GET_CONFIG_QUERY_RESOLVED] Query resolveu antes do timeout:', {
              hasData: !!result.data,
              hasError: !!result.error,
              timestamp: new Date().toISOString(),
            });
            // #endregion
            if (timeoutId) clearTimeout(timeoutId);
            return result;
          }),
          timeoutPromise.then((result) => {
            // #region agent log
            console.log('[DEBUG_GET_CONFIG_TIMEOUT_RESOLVED] Timeout resolveu:', {
              timestamp: new Date().toISOString(),
            });
            // #endregion
            return result;
          }),
        ]);
        
        queryResult = raceResult as { data: ResponseConfig | null; error: any };
        
        // #region agent log
        console.log('[DEBUG_GET_CONFIG_AWAIT_COMPLETE] Await completado:', {
          hasResult: !!queryResult,
          hasData: !!queryResult?.data,
          hasError: !!queryResult?.error,
          errorCode: queryResult?.error?.code,
          timestamp: new Date().toISOString(),
        });
        // #endregion
      } catch (queryError) {
        // #region agent log
        console.error('[DEBUG_GET_CONFIG_QUERY_ERROR] Erro ao executar query:', {
          error: queryError instanceof Error ? queryError.message : String(queryError),
          stack: queryError instanceof Error ? queryError.stack : undefined,
          timestamp: new Date().toISOString(),
        });
        // #endregion
        if (timeoutId) clearTimeout(timeoutId);
        throw queryError;
      } finally {
        // Garantir que o timeout seja limpo
        if (timeoutId) clearTimeout(timeoutId);
      }
      
      // Verificar se foi timeout
      if (queryResult?.error?.code === 'TIMEOUT') {
        console.error('[RESPONSE_CONFIG] Timeout ao buscar configuração após 3 segundos');
        // Usar cache se disponível mesmo com timeout
        if (configCache) {
          // #region agent log
          console.log('[DEBUG_GET_CONFIG_TIMEOUT_CACHE] Usando cache devido a timeout:', {
            timestamp: new Date().toISOString(),
          });
          // #endregion
          return configCache.config;
        }
        return null;
      }
      
      const { data, error } = queryResult;
      
      // #region agent log
      console.log('[DEBUG_GET_CONFIG_RESULT] Resultado da query:', {
        hasData: !!data,
        hasError: !!error,
        errorCode: error?.code,
        errorMessage: error?.message,
        dataKeys: data ? Object.keys(data) : [],
        timestamp: new Date().toISOString(),
      });
      // #endregion

      if (error) {
        // Se não encontrar nenhum registro, não é um erro crítico
        if (error.code === 'PGRST116') {
          console.log('[RESPONSE_CONFIG] Nenhuma configuração de resposta automática encontrada ou desabilitada');
          // Atualizar cache com null
          configCache = {
            config: null,
            timestamp: Date.now(),
          };
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

      const config = data as ResponseConfig;
      
      // Atualizar cache
      configCache = {
        config,
        timestamp: Date.now(),
      };
      
      // #region agent log
      console.log('[DEBUG_GET_CONFIG_CACHE_UPDATED] Cache atualizado:', {
        timestamp: new Date().toISOString(),
      });
      // #endregion

      return config;
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
    // Atualizar cache com null para evitar tentativas repetidas
    configCache = {
      config: null,
      timestamp: Date.now(),
    };
  }

  return null;
}
