/**
 * Integração com Meta Graph API para analytics diários de templates por WABA.
 * Coleta métricas: sent, delivered, read, replied, clicked (por botão), custos.
 * Persiste na tabela `template_analytics` no Supabase.
 *
 * Fluxo por WABA:
 *   1. fetchTemplateIdsForWaba  → pagina /{wabaId}/message_templates
 *   2. fetchAnalyticsBatch      → /{wabaId}/template_analytics (lotes de 20 IDs)
 *   3. saveAnalytics            → upsert em template_analytics
 */

import { getSupabaseClient } from '@/lib/supabase';
import { listAccounts } from '@/lib/whatsapp-accounts';

const META_GRAPH_BASE = 'https://graph.facebook.com/v24.0';

/** Tamanho máximo de IDs por chamada à API de analytics. */
const ANALYTICS_BATCH_SIZE = 20;

/** Delay entre WABAs para respeitar rate limits da Meta. */
const DELAY_BETWEEN_WABAS_MS = 1500;

// ---------------------------------------------------------------------------
// Tipos da Meta Graph API
// ---------------------------------------------------------------------------

interface MetaTemplateRef {
  id: string;
  name: string;
}

interface MetaCostPoint {
  type: string;
  value?: number;
}

export interface MetaClickedPoint {
  type: string;
  button_content: string;
  count: number;
}

interface MetaAnalyticsDataPoint {
  template_id: string;
  start: number;
  end: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  clicked?: MetaClickedPoint[];
  cost?: MetaCostPoint[];
}

interface MetaAnalyticsResponse {
  data?: Array<{
    granularity: string;
    product_type: string;
    data_points: MetaAnalyticsDataPoint[];
  }>;
  paging?: { cursors?: { before?: string; after?: string }; next?: string };
  error?: { message?: string; code?: number };
}

interface MetaTemplatesListResponse {
  data?: Array<{ id?: string; name?: string }>;
  paging?: { cursors?: { before?: string; after?: string }; next?: string };
  error?: { message?: string; code?: number };
}

// ---------------------------------------------------------------------------
// Tipo da linha persistida no Supabase
// ---------------------------------------------------------------------------

export interface TemplateAnalyticsRow {
  meta_waba_id: string;
  waba_name: string | null;
  template_id: string;
  template_name: string | null;
  date: string;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  clicked: MetaClickedPoint[] | null;
  amount_spent: number | null;
  cost_per_delivered: number | null;
  cost_per_url_button_click: number | null;
  fetched_at: string;
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

/** Retorna a data de ontem no formato YYYY-MM-DD (UTC). */
export function getYesterdayDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extrai o campo `value` de um custo pelo tipo, ou null se ausente. */
function extractCostValue(
  costs: MetaCostPoint[] | undefined,
  type: string
): number | null {
  if (!costs) return null;
  const found = costs.find((c) => c.type === type);
  return found?.value != null ? found.value : null;
}

// ---------------------------------------------------------------------------
// Funções de integração com a Meta
// ---------------------------------------------------------------------------

/**
 * Pagina /{wabaId}/message_templates e retorna todos os IDs e nomes de templates.
 */
export async function fetchTemplateIdsForWaba(
  wabaId: string,
  accessToken: string
): Promise<MetaTemplateRef[]> {
  const results: MetaTemplateRef[] = [];
  let afterCursor: string | undefined;

  do {
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,name',
      limit: '100',
    });
    if (afterCursor) params.set('after', afterCursor);

    const url = `${META_GRAPH_BASE}/${wabaId}/message_templates?${params.toString()}`;
    const res = await fetch(url);
    const body = (await res.json()) as MetaTemplatesListResponse;

    if (!res.ok || body.error) {
      const msg = body.error?.message ?? `HTTP ${res.status}`;
      throw new Error(
        `[META_TEMPLATE_ANALYTICS] message_templates waba=${wabaId}: ${msg}`
      );
    }

    for (const item of body.data ?? []) {
      if (item.id && item.name) {
        results.push({ id: String(item.id), name: String(item.name) });
      }
    }

    afterCursor = body.paging?.cursors?.after;
    if (!body.paging?.next) break;
  } while (afterCursor);

  return results;
}

/**
 * Chama /{wabaId}/template_analytics para um lote de IDs em uma data específica.
 * Retorna os data_points brutos da resposta.
 */
async function fetchAnalyticsBatch(
  wabaId: string,
  accessToken: string,
  templateIds: string[],
  date: string
): Promise<MetaAnalyticsDataPoint[]> {
  if (templateIds.length === 0) return [];

  const params = new URLSearchParams({
    access_token: accessToken,
    start: date,
    end: date,
    granularity: 'DAILY',
    template_ids: templateIds.join(','),
  });

  const url = `${META_GRAPH_BASE}/${wabaId}/template_analytics?${params.toString()}`;
  const res = await fetch(url);
  const body = (await res.json()) as MetaAnalyticsResponse;

  if (!res.ok || body.error) {
    const msg = body.error?.message ?? `HTTP ${res.status}`;
    throw new Error(
      `[META_TEMPLATE_ANALYTICS] template_analytics waba=${wabaId}: ${msg}`
    );
  }

  return body.data?.[0]?.data_points ?? [];
}

/**
 * Normaliza data_points da API em linhas prontas para upsert no Supabase.
 */
function normalizeDataPoints(
  wabaId: string,
  wabaName: string,
  date: string,
  dataPoints: MetaAnalyticsDataPoint[],
  templateNameById: Record<string, string>
): TemplateAnalyticsRow[] {
  const now = new Date().toISOString();

  return dataPoints.map((dp) => ({
    meta_waba_id: wabaId,
    waba_name: wabaName,
    template_id: dp.template_id,
    template_name: templateNameById[dp.template_id] ?? null,
    date,
    sent: dp.sent ?? 0,
    delivered: dp.delivered ?? 0,
    read: dp.read ?? 0,
    replied: dp.replied ?? 0,
    clicked:
      dp.clicked && dp.clicked.length > 0 ? dp.clicked : null,
    amount_spent: extractCostValue(dp.cost, 'amount_spent'),
    cost_per_delivered: extractCostValue(dp.cost, 'cost_per_delivered'),
    cost_per_url_button_click: extractCostValue(
      dp.cost,
      'cost_per_url_button_click'
    ),
    fetched_at: now,
  }));
}

// ---------------------------------------------------------------------------
// Persistência no Supabase
// ---------------------------------------------------------------------------

/**
 * Upsert das linhas de analytics na tabela `template_analytics`.
 * Conflito em (meta_waba_id, template_id, date) → atualiza os valores.
 * Retorna o número de linhas processadas.
 */
export async function saveAnalytics(
  rows: TemplateAnalyticsRow[]
): Promise<number> {
  if (rows.length === 0) return 0;
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('template_analytics')
    .upsert(rows as any, {
      onConflict: 'meta_waba_id,template_id,date',
    });

  if (error) {
    console.error('[META_TEMPLATE_ANALYTICS] saveAnalytics:', error);
    throw new Error(`Falha ao salvar analytics no Supabase: ${error.message}`);
  }

  return rows.length;
}

// ---------------------------------------------------------------------------
// Orquestrador principal
// ---------------------------------------------------------------------------

export interface CollectResult {
  date: string;
  wabas_processed: number;
  total_templates: number;
  total_rows_saved: number;
  errors: Array<{ waba_id: string; waba_name: string; error: string }>;
}

/**
 * Coleta analytics de todas as WABAs para a data informada (default: ontem).
 * Processa WABAs sequencialmente com delay entre chamadas para evitar rate limit.
 */
export async function collectAnalyticsForAllWabas(
  date?: string
): Promise<CollectResult> {
  const targetDate = date ?? getYesterdayDate();
  const accounts = await listAccounts();

  const result: CollectResult = {
    date: targetDate,
    wabas_processed: 0,
    total_templates: 0,
    total_rows_saved: 0,
    errors: [],
  };

  for (let i = 0; i < accounts.length; i++) {
    const { waba_id, waba_name, bm_name } = accounts[i];

    if (i > 0) await sleep(DELAY_BETWEEN_WABAS_MS);

    try {
      const token = process.env[`WHATSAPP_ACCESS_TOKEN_${bm_name}`];
      if (!token) {
        throw new Error(
          `Token não configurado: WHATSAPP_ACCESS_TOKEN_${bm_name}`
        );
      }

      // 1. Busca todos os templates da WABA (paginado)
      const templates = await fetchTemplateIdsForWaba(waba_id, token);
      const templateNameById: Record<string, string> = Object.fromEntries(
        templates.map((t) => [t.id, t.name])
      );
      result.total_templates += templates.length;

      // 2. Busca analytics em lotes e acumula as linhas
      const allRows: TemplateAnalyticsRow[] = [];
      const templateIds = templates.map((t) => t.id);

      for (let j = 0; j < templateIds.length; j += ANALYTICS_BATCH_SIZE) {
        const batch = templateIds.slice(j, j + ANALYTICS_BATCH_SIZE);
        const dataPoints = await fetchAnalyticsBatch(
          waba_id,
          token,
          batch,
          targetDate
        );
        const rows = normalizeDataPoints(
          waba_id,
          waba_name,
          targetDate,
          dataPoints,
          templateNameById
        );
        allRows.push(...rows);
      }

      // 3. Persiste tudo de uma vez via upsert
      const saved = await saveAnalytics(allRows);
      result.total_rows_saved += saved;
      result.wabas_processed++;

      console.log(
        `[META_TEMPLATE_ANALYTICS] ${waba_name} (${waba_id}): ` +
          `${templates.length} templates, ${saved} linhas salvas para ${targetDate}.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[META_TEMPLATE_ANALYTICS] Erro na WABA ${waba_name} (${waba_id}):`,
        msg
      );
      result.errors.push({ waba_id, waba_name, error: msg });
    }
  }

  return result;
}
