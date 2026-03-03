/**
 * POST /api/template-analytics/collect
 *
 * Dispara a coleta de analytics de templates para todas as WABAs.
 * Chamado manualmente (via API Key) ou pelo Vercel Cron diariamente.
 *
 * Body (opcional):
 *   { "date": "2026-03-02" }  → coleta para a data informada
 *   {}                        → coleta para ontem (default)
 *
 * Response:
 *   { success, date, wabas_processed, total_templates, total_rows_saved, errors[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { collectAnalyticsForAllWabas } from '@/lib/meta-template-analytics';

/**
 * Aceita autenticação via X-API-Key (chamadas manuais)
 * ou via Authorization: Bearer <CRON_SECRET> (Vercel Cron).
 */
function isAuthorized(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  if (apiKey && apiKey === process.env.API_KEY) return true;

  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  return false;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'API Key inválida ou não fornecida' },
      { status: 401 }
    );
  }

  let date: string | undefined;

  try {
    const body = await request.json().catch(() => ({}));
    if (body?.date && typeof body.date === 'string') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        return NextResponse.json(
          { success: false, error: 'Formato de data inválido. Use YYYY-MM-DD.' },
          { status: 400 }
        );
      }
      date = body.date;
    }
  } catch {
    // body vazio é aceito; usa default (ontem)
  }

  try {
    console.log(
      `[TEMPLATE_ANALYTICS_COLLECT] Iniciando coleta para ${date ?? 'ontem'}`
    );

    const result = await collectAnalyticsForAllWabas(date);

    console.log(
      `[TEMPLATE_ANALYTICS_COLLECT] Concluído: ` +
        `${result.wabas_processed} WABAs, ` +
        `${result.total_rows_saved} linhas, ` +
        `${result.errors.length} erros.`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[TEMPLATE_ANALYTICS_COLLECT]', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
