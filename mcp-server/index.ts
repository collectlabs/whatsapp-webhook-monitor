#!/usr/bin/env node
/**
 * MCP Server para criação de templates WhatsApp via Claude Desktop.
 * Comunica-se com a API Next.js (Vercel) via HTTP.
 *
 * Variáveis de ambiente necessárias:
 *   APP_BASE_URL - URL base da aplicação (ex: https://whatsapp-webhook-monitor.vercel.app)
 *   API_KEY      - Chave de autenticação da API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const APP_BASE_URL = process.env.APP_BASE_URL?.replace(/\/$/, '') ?? '';
const API_KEY = process.env.API_KEY ?? '';

if (!APP_BASE_URL) {
  console.error('[MCP] APP_BASE_URL não configurada. Defina nas env do Claude Desktop.');
  process.exit(1);
}
if (!API_KEY) {
  console.error('[MCP] API_KEY não configurada. Defina nas env do Claude Desktop.');
  process.exit(1);
}

async function apiRequest(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const url = `${APP_BASE_URL}${path}`;
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const data = await res.json();

  if (!res.ok) {
    const errorMsg = typeof data === 'object' && data !== null && 'error' in data
      ? (data as { error: string }).error
      : `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

const server = new McpServer({
  name: 'whatsapp-templates',
  version: '1.0.0',
});

// --- Tool: create_template ---

server.tool(
  'create_template',
  `Cria um template de mensagem do WhatsApp em todas as WABAs cadastradas.
O template será submetido à Meta para aprovação em cada WABA.

Campos obrigatórios:
- name: nome do template (snake_case, sem espaços)
- language: código do idioma (ex: "pt_BR", "en_US")
- category: categoria do template ("MARKETING", "UTILITY" ou "AUTHENTICATION")

O campo components é um array seguindo a estrutura da API de templates da Meta.
Exemplo de components para template de texto simples:
[
  { "type": "HEADER", "format": "TEXT", "text": "Título do template" },
  { "type": "BODY", "text": "Olá {{1}}, sua compra {{2}} foi confirmada." },
  { "type": "FOOTER", "text": "Feirão de Acordos" }
]

Exemplo com botões:
[
  { "type": "BODY", "text": "Olá {{1}}, temos uma oferta especial para você!" },
  { "type": "BUTTONS", "buttons": [
    { "type": "QUICK_REPLY", "text": "Tenho interesse" },
    { "type": "QUICK_REPLY", "text": "Não tenho interesse" }
  ]}
]`,
  {
    name: z.string().describe('Nome do template (snake_case, sem espaços ou caracteres especiais)'),
    language: z.string().describe('Código do idioma (ex: "pt_BR", "en_US")'),
    category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).describe('Categoria do template'),
    components: z.array(z.record(z.unknown())).optional()
      .describe('Array de componentes do template seguindo a API da Meta (HEADER, BODY, FOOTER, BUTTONS)'),
  },
  async ({ name, language, category, components }) => {
    try {
      const body: Record<string, unknown> = { name, language, category };
      if (components && components.length > 0) {
        body.components = components;
      }

      const result = await apiRequest('/api/create-template', {
        method: 'POST',
        body,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      return {
        content: [{ type: 'text' as const, text: `Erro ao criar template: ${msg}` }],
        isError: true,
      };
    }
  }
);

// --- Tool: get_template_results ---

server.tool(
  'get_template_results',
  `Consulta o status e resultados de templates criados anteriormente.
Pode filtrar por request_id ou template_name. Sem filtros, retorna os 20 mais recentes.
Cada resultado mostra o status de aprovação em cada WABA (feirao_1..5).`,
  {
    request_id: z.string().optional().describe('UUID da requisição de criação (retornado ao criar)'),
    template_name: z.string().optional().describe('Nome do template para buscar o resultado mais recente'),
  },
  async ({ request_id, template_name }) => {
    try {
      const params = new URLSearchParams();
      if (request_id) params.set('request_id', request_id);
      if (template_name) params.set('template_name', template_name);

      const qs = params.toString();
      const path = `/api/create-template${qs ? `?${qs}` : ''}`;

      const result = await apiRequest(path);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      return {
        content: [{ type: 'text' as const, text: `Erro ao consultar resultados: ${msg}` }],
        isError: true,
      };
    }
  }
);

// --- Tool: list_wabas ---

server.tool(
  'list_wabas',
  'Lista todas as WABAs (WhatsApp Business Accounts) cadastradas no sistema, com waba_id, waba_name e bm_name.',
  {},
  async () => {
    try {
      const result = await apiRequest('/api/wabas');

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      return {
        content: [{ type: 'text' as const, text: `Erro ao listar WABAs: ${msg}` }],
        isError: true,
      };
    }
  }
);

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[MCP] Erro fatal:', err);
  process.exit(1);
});
