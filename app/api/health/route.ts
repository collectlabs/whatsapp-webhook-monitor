/**
 * GET /api/health - Resumo de saúde por WABA/BM (waba_health_status + bms/wabas).
 * Protegido por X-API-Key (API_KEY). Útil para monitoramento e dashboards.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  const configuredApiKey = process.env.API_KEY;
  if (!configuredApiKey) return false;
  return apiKey === configuredApiKey;
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, error: 'API Key inválida ou não fornecida' },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseClient();
    const { data: rows, error } = await supabase
      .from('waba_health_status')
      .select('meta_waba_id, waba_status, meta_bm_id, bm_status, app_id, app_status, fetched_at, bm_name, bm_uuid')
      .order('fetched_at', { ascending: false });

    if (error) {
      console.error('[HEALTH] Erro ao buscar waba_health_status:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const items = (rows ?? []).map((row: Record<string, unknown>) => ({
      waba_id: row.meta_waba_id,
      bm_id: row.meta_bm_id,
      bm_name: row.bm_name ?? null,
      bm_uuid: row.bm_uuid ?? null,
      fetched_at: row.fetched_at,
      waba_status: row.waba_status,
      bm_status: row.bm_status,
      app_status: row.app_status ?? null,
    }));

    return NextResponse.json({
      success: true,
      count: items.length,
      health: items,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao consultar saúde';
    console.error('[HEALTH]', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
