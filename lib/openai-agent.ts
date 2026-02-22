/**
 * Serviço de agente OpenAI para respostas inteligentes do WhatsApp
 * Usa o OpenAI Agents SDK com ferramentas MCP
 */

import { Agent, run } from '@openai/agents';
import { getConversationHistoryTool, getBusinessInfoTool } from './mcp-tools';

// Instruções do agente - contexto do negócio
const AGENT_INSTRUCTIONS = `Você é o assistente virtual do Feirão de Acordos.

SOBRE O FEIRÃO DE ACORDOS:
- Plataforma para negociação e acordos de dívidas
- Site oficial: https://feiraodeacordos.com.br/
- Este canal é exclusivo para comunicações do Feirão de Acordos

DIRETRIZES DE ATENDIMENTO:
1. Seja sempre cordial, profissional e objetivo
2. Responda em português brasileiro
3. Para dúvidas específicas sobre acordos, direcione ao site oficial
4. Não forneça informações financeiras específicas ou valores
5. Se não souber a resposta, indique o site ou solicite que aguardem contato de um atendente
6. Mantenha respostas concisas (máximo 2-3 parágrafos)

FORMATO DAS RESPOSTAS:
- Use linguagem clara e acessível
- Evite jargões técnicos
- Seja empático com a situação financeira do cliente
- Sempre termine oferecendo ajuda adicional quando apropriado

IMPORTANTE:
- Este é um canal de WhatsApp, então mantenha as mensagens curtas
- Não use formatação markdown complexa (apenas texto simples)
- Não use emojis em excesso`;

// Criar o agente com ferramentas
const whatsappAgent = new Agent({
  name: 'WhatsApp Feirão de Acordos Assistant',
  model: process.env.AI_MODEL || 'gpt-4o-mini',
  instructions: AGENT_INSTRUCTIONS,
  tools: [getConversationHistoryTool, getBusinessInfoTool],
});

/**
 * Gera uma resposta inteligente usando o agente OpenAI
 * @param customerPhone - Número do cliente
 * @param message - Mensagem recebida do cliente
 * @param messageType - Tipo da mensagem (text, audio, button, etc.)
 * @returns Resposta gerada pelo agente
 */
export async function generateAIResponse(
  customerPhone: string,
  message: string | null,
  messageType: string
): Promise<string> {
  const startTime = Date.now();

  console.log('[OPENAI_AGENT] Gerando resposta para:', {
    customerPhone,
    messageType,
    messagePreview: message?.substring(0, 50),
  });

  try {
    // Montar o contexto da mensagem
    let userMessage = '';

    if (messageType === 'text' && message) {
      userMessage = message;
    } else if (messageType === 'audio') {
      userMessage = '[Cliente enviou um áudio] Por favor, responda de forma genérica pois não foi possível transcrever o áudio.';
    } else if (messageType === 'button') {
      userMessage = message || '[Cliente clicou em um botão]';
    } else {
      userMessage = message || '[Mensagem sem conteúdo de texto]';
    }

    // Adicionar contexto do cliente
    const contextMessage = `
Número do cliente: ${customerPhone}
Tipo de mensagem: ${messageType}
Mensagem do cliente: ${userMessage}

Por favor, responda de forma apropriada.`;

    // Executar o agente
    const result = await run(whatsappAgent, contextMessage);

    const duration = Date.now() - startTime;

    console.log('[OPENAI_AGENT] Resposta gerada com sucesso:', {
      customerPhone,
      duration: `${duration}ms`,
      responseLength: result.finalOutput?.length || 0,
    });

    // Retornar a resposta final do agente
    return result.finalOutput || getFallbackResponse();
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('[OPENAI_AGENT] Erro ao gerar resposta:', {
      customerPhone,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      duration: `${duration}ms`,
    });

    // Retornar resposta de fallback em caso de erro
    return getFallbackResponse();
  }
}

/**
 * Resposta de fallback em caso de erro
 */
function getFallbackResponse(): string {
  return 'Olá! Este é um canal exclusivo para comunicações do Feirão de Acordos.\n\nPara mais informações, acesse: https://feiraodeacordos.com.br/';
}

/**
 * Verifica se a IA está habilitada
 */
export function isAIEnabled(): boolean {
  const enabled = process.env.AI_ENABLED !== 'false';
  const hasApiKey = !!process.env.OPENAI_API_KEY;

  if (enabled && !hasApiKey) {
    console.warn('[OPENAI_AGENT] AI_ENABLED está true mas OPENAI_API_KEY não está configurada');
    return false;
  }

  return enabled && hasApiKey;
}
