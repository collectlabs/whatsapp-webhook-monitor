/**
 * Utilitários de data/hora para gravação no Supabase em America/Sao_Paulo.
 */

const TIMEZONE = 'America/Sao_Paulo';

/**
 * Retorna data/hora em ISO no fuso America/Sao_Paulo (ex: 2025-02-06T14:30:00-03:00).
 * Use para gravar em colunas de data no Supabase.
 */
export function toSaoPauloISOString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  const h = parts.find((p) => p.type === 'hour')!.value;
  const min = parts.find((p) => p.type === 'minute')!.value;
  const s = parts.find((p) => p.type === 'second')!.value;
  return `${y}-${m}-${d}T${h}:${min}:${s}-03:00`;
}

/**
 * Retorna data/hora em America/Sao_Paulo no formato "YYYY-MM-DD HH:mm:ss" (sem timezone).
 * Use para colunas "timestamp without time zone" no Supabase, para que o valor exibido
 * na tabela seja o horário de São Paulo.
 */
export function toSaoPauloTimestampString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  const h = parts.find((p) => p.type === 'hour')!.value;
  const min = parts.find((p) => p.type === 'minute')!.value;
  const s = parts.find((p) => p.type === 'second')!.value;
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}
