/**
 * Módulo para gerenciar configuração de respostas automáticas
 * Suporta configuração via variáveis de ambiente ou hardcoded
 */

import { toSaoPauloTimestampString } from '@/lib/date-utils';

export interface ResponseConfig {
  id: string;
  default_message: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIConfig {
  enabled: boolean;
  model: string;
  hasApiKey: boolean;
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
    created_at: toSaoPauloTimestampString(),
    updated_at: toSaoPauloTimestampString(),
  };
}

/**
 * Invalida o cache de configuração
 */
export function invalidateConfigCache(): void {
  console.log('[RESPONSE_CONFIG] Cache invalidado (hardcoded mode)');
}

/**
 * Retorna configuração da IA
 */
export function getAIConfig(): AIConfig {
  return {
    enabled: process.env.AI_ENABLED !== 'false',
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    hasApiKey: !!process.env.OPENAI_API_KEY,
  };
}
