/**
 * Ferramentas MCP para o agente OpenAI
 * Fornecem contexto adicional para respostas mais inteligentes
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import { getSupabaseClient } from './supabase';
import { toSaoPauloISOString } from './date-utils';

/**
 * Ferramenta para buscar histórico de conversas do cliente
 */
export const getConversationHistoryTool = tool({
  name: 'get_conversation_history',
  description: 'Busca o histórico das últimas mensagens de um cliente específico. Use para entender o contexto da conversa.',
  parameters: z.object({
    customerPhone: z.string().describe('Número de telefone do cliente'),
    limit: z.number().optional().default(10).describe('Quantidade máxima de mensagens a retornar'),
  }),
  execute: async ({ customerPhone, limit }) => {
    console.log('[MCP_TOOL] Buscando histórico de conversas:', { customerPhone, limit });

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('webhook_messages')
        .select('message_type, message_body, timestamp, created_at')
        .eq('from_number', customerPhone)
        .in('message_type', ['text', 'button', 'audio', 'sent', 'delivered', 'read'])
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[MCP_TOOL] Erro ao buscar histórico:', error);
        return { success: false, error: error.message, messages: [] };
      }

      // Formatar mensagens para o agente (timestamp em America/Sao_Paulo)
      const formattedMessages = (data || []).map((msg) => ({
        type: msg.message_type,
        content: msg.message_body || '[sem conteúdo de texto]',
        timestamp: toSaoPauloISOString(new Date(msg.timestamp * 1000)),
      }));

      console.log('[MCP_TOOL] Histórico encontrado:', {
        customerPhone,
        messagesCount: formattedMessages.length,
      });

      return {
        success: true,
        customerPhone,
        messagesCount: formattedMessages.length,
        messages: formattedMessages,
      };
    } catch (error) {
      console.error('[MCP_TOOL] Exceção ao buscar histórico:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        messages: [],
      };
    }
  },
});

/**
 * Ferramenta para obter informações do negócio
 */
export const getBusinessInfoTool = tool({
  name: 'get_business_info',
  description: 'Retorna informações sobre o Feirão de Acordos e horários de atendimento.',
  parameters: z.object({
    topic: z.enum(['general', 'contact', 'hours', 'services']).optional().default('general')
      .describe('Tópico específico de informação desejada'),
  }),
  execute: async ({ topic }) => {
    console.log('[MCP_TOOL] Buscando informações do negócio:', { topic });

    // Informações estáticas do negócio
    // Em produção, isso poderia vir de um banco de dados ou CMS
    const businessInfo = {
      general: {
        name: 'Feirão de Acordos',
        description: 'Plataforma para negociação e acordos de dívidas',
        website: 'https://feiraodeacordos.com.br/',
      },
      contact: {
        website: 'https://feiraodeacordos.com.br/',
        whatsapp: 'Este canal de WhatsApp',
        note: 'Para atendimento personalizado, acesse o site oficial',
      },
      hours: {
        weekdays: 'Segunda a Sexta: 8h às 18h',
        weekend: 'Sábados: 9h às 13h',
        holidays: 'Fechado em feriados nacionais',
        note: 'Respostas automáticas funcionam 24/7, atendimento humano nos horários indicados',
      },
      services: {
        main: 'Negociação de dívidas',
        features: [
          'Consulta de débitos',
          'Propostas de acordo',
          'Parcelamento facilitado',
          'Descontos especiais em campanhas',
        ],
        howTo: 'Acesse https://feiraodeacordos.com.br/ para verificar seus débitos e fazer acordos',
      },
    };

    return {
      success: true,
      topic,
      info: businessInfo[topic] || businessInfo.general,
    };
  },
});
