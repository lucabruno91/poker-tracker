import type { Hand, Session } from "../types";

export type Period = "all" | "today" | "7d" | "30d" | "custom";

export interface Filter {
  period: Period;
  /** "2026-11-24", solo con period "custom" (estremi inclusi). */
  from?: string;
  to?: string;
  /** Stake come lo restituisce `stakeOf`, es. "€0,01/€0,02". */
  stake?: string;
}

export const NO_FILTER: Filter = { period: "all" };

const euro = (cents: number) => `€${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;

/** "€0,01/€0,02". */
export function stakeOf(hand: Pick<Hand, "sb" | "bb">): string {
  return `${euro(hand.sb)}/${euro(hand.bb)}`;
}

/** Stake presenti nell'archivio, dal più basso. */
export function availableStakes(hands: Iterable<Hand>): string[] {
  const byStake = new Map<string, number>();
  for (const h of hands) byStake.set(stakeOf(h), h.bb);
  return [...byStake].sort((a, b) => a[1] - b[1]).map(([s]) => s);
}

/** Sposta una data "YYYY-MM-DD" di `days` giorni. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Intervallo di date (estremi inclusi) del filtro rispetto a `today`. */
export function dateRange(filter: Filter, today: string): { from?: string; to?: string } {
  switch (filter.period) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "custom": {
      const r: { from?: string; to?: string } = {};
      if (filter.from) r.from = filter.from;
      if (filter.to) r.to = filter.to;
      return r;
    }
    default:
      return {};
  }
}

export function isActive(filter: Filter): boolean {
  const { from, to } = dateRange(filter, "2000-01-01");
  return Boolean(from || to || filter.stake);
}

/**
 * Sessioni che rispettano il filtro (SPEC §6.10). Si filtra per sessione: una
 * sessione è un solo tavolo, un solo giorno e un solo stake, così ricariche e
 * stack restano coerenti. Funzione pura.
 */
export function filterSessions(
  sessions: Session[],
  handsById: Map<string, Hand>,
  filter: Filter,
  today: string,
): Session[] {
  const { from, to } = dateRange(filter, today);
  return sessions.filter((s) => {
    if (from && s.date < from) return false;
    if (to && s.date > to) return false;
    if (filter.stake) {
      const first = handsById.get(s.handIds[0] ?? "");
      if (!first || stakeOf(first) !== filter.stake) return false;
    }
    return true;
  });
}

const isDate = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);

/** Legge un filtro salvato (JSON); valori non validi → nessun filtro. */
export function parseFilter(json: string | null | undefined): Filter {
  if (!json) return NO_FILTER;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return NO_FILTER;
  }
  if (typeof data !== "object" || data === null) return NO_FILTER;
  const o = data as Record<string, unknown>;
  const period: Period =
    o.period === "today" || o.period === "7d" || o.period === "30d" || o.period === "custom" ? o.period : "all";
  const f: Filter = { period };
  if (period === "custom") {
    if (isDate(o.from)) f.from = o.from;
    if (isDate(o.to)) f.to = o.to;
  }
  if (typeof o.stake === "string" && o.stake) f.stake = o.stake;
  return f;
}

/** Data locale di oggi, "YYYY-MM-DD". */
export function localToday(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
