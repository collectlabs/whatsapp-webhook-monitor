/**
 * Módulo para gerenciar configuração de respostas automáticas
 * Versão simplificada para teste
 */

export interface ResponseConfig {
  id: string;
  default_message: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Retorna configuração hardcoded para teste
 * TODO: Remover após teste e voltar a usar Supabase
 */
export async function getResponseConfig(): Promise<ResponseConfig | null> {
  console.log('[RESPONSE_CONFIG] Usando configuração hardcoded para teste');
  
  // Configuração hardcoded para teste
  return {
    id: 'test-config',
    default_message: 'Esse é um canal exclusivo para comunicações do Feirão de Acordos.\n\nQualquer dúvidas acesse: https://feiraodeacordos.com.br/',
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Invalida o cache de configuração
 */
export function invalidateConfigCache(): void {
  console.log('[RESPONSE_CONFIG] Cache invalidado (hardcoded mode)');
}
