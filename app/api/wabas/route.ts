/**
 * GET /api/wabas - Lista WABAs disponíveis no sistema.
 * Retorna waba_id, waba_name e bm_name (sem tokens/credenciais).
 */

import { NextRequest, NextResponse } from 'next/server';
import { listAccounts } from '@/lib/whatsapp-accounts';

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  const configuredApiKey = process.env.API_KEY;
  if (!configuredApiKey) {
    console.error('[WABAS] API_KEY não configurada nas variáveis de ambiente');
    return false;
  }
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
    const accounts = await listAccounts();

    const wabas = accounts.map(({ waba_id, waba_name, bm_name }) => ({
      waba_id,
      waba_name,
      bm_name,
    }));

    return NextResponse.json({ success: true, wabas });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[WABAS] Erro ao listar WABAs:', errorMsg);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
