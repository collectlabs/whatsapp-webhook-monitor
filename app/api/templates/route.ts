/**
 * API para consultar message_templates por WABA.
 * GET /api/templates?waba_id=<id>
 * Token resolvido via tabela wabas/bms no Supabase e WHATSAPP_ACCESS_TOKEN_<NOME_BM> no .env.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCredentials } from '@/lib/whatsapp-accounts';

const META_GRAPH_BASE = 'https://graph.facebook.com/v24.0';
const DEFAULT_LIMIT = 100;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wabaId = searchParams.get('waba_id');
  const limitParam = searchParams.get('limit');

  if (!wabaId?.trim()) {
    return NextResponse.json(
      { error: 'Parâmetro obrigatório "waba_id" não informado.' },
      { status: 400 }
    );
  }

  let token: string;
  try {
    const creds = await getCredentials(wabaId.trim());
    token = creds.accessToken;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'WABA não encontrada. Verifique a tabela wabas no Supabase e WHATSAPP_ACCESS_TOKEN_<NOME_BM> no .env.';
    return NextResponse.json({ error: message }, { status: 404 });
  }

  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || DEFAULT_LIMIT), 100) : DEFAULT_LIMIT;
  const url = `${META_GRAPH_BASE}/${wabaId.trim()}/message_templates?limit=${limit}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const body = await res.json();

    if (!res.ok) {
      const msg = body?.error?.message ?? body?.error?.error_user_msg ?? `HTTP ${res.status}`;
      return NextResponse.json(
        { error: `Meta message_templates: ${msg}`, meta_error: body?.error },
        { status: res.status >= 400 ? res.status : 502 }
      );
    }

    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao consultar templates na Meta.';
    console.error('[TEMPLATES] Erro ao consultar message_templates:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
