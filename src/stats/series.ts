import type { Hand, Session } from "../types";
import { compareHandIds } from "./sessions";

export interface ResultSeries {
  /** Risultato cumulato in bb dopo ogni mano dell'hero. */
  total: number[];
  /** Parte del cumulato che viene dalle mani arrivate allo showdown. */
  showdown: number[];
  /** Parte del cumulato che viene dalle mani senza showdown. */
  nonShowdown: number[];
  /** Indici in cui inizia una nuova sessione. */
  sessionStarts: number[];
  /** ID della sessione per ogni voce di `sessionStarts`. */
  sessionIds: string[];
  /** ID della mano a ogni indice, nello stesso ordine di `total`. */
  handIds: string[];
  /**
   * Cumulato «all-in EV» (SPEC §6.11): come il totale, ma le mani in
   * `expected` contano con il risultato atteso. Vuoto se `expected` manca.
   */
  allInEv: number[];
}

/**
 * Serie del grafico cumulato (SPEC §6.9): sessioni nell'ordine dato, mani per
 * hand ID, solo le mani dell'hero. Una mano è «showdown» se l'hero è
 * nell'elenco `showdown`. A ogni indice: total = showdown + nonShowdown.
 */
export function buildResultSeries(
  sessions: Session[],
  handsById: Map<string, Hand>,
  hero: string | null,
  /** Risultato atteso dell'hero in centesimi per le mani con all-in. */
  expected?: Map<string, number>,
): ResultSeries {
  const out: ResultSeries = {
    total: [], showdown: [], nonShowdown: [], sessionStarts: [], sessionIds: [], handIds: [], allInEv: [],
  };
  if (!hero) return out;
  let sd = 0;
  let nsd = 0;
  let ev = 0;
  for (const s of sessions) {
    out.sessionStarts.push(out.total.length);
    out.sessionIds.push(s.id);
    for (const id of [...s.handIds].sort(compareHandIds)) {
      const h = handsById.get(id);
      if (!h || !h.players.some((p) => p.name === hero)) continue;
      const bb = (h.net[hero] ?? 0) / h.bb;
      if (h.showdown.includes(hero)) sd += bb;
      else nsd += bb;
      out.showdown.push(sd);
      out.nonShowdown.push(nsd);
      out.total.push(sd + nsd);
      out.handIds.push(h.id);
      if (expected) {
        ev += (expected.get(h.id) ?? h.net[hero] ?? 0) / h.bb;
        out.allInEv.push(ev);
      }
    }
  }
  return out;
}

/**
 * Primo e ultimo indice della sessione che contiene `index` (SPEC §6.9).
 * Tollera sessioni senza mani dell'hero (inizi ripetuti).
 */
export function sessionRangeAt(sessionStarts: number[], length: number, index: number): [number, number] {
  let start = 0;
  let end = length - 1;
  for (const s of sessionStarts) {
    if (s <= index) start = Math.max(start, s);
    else end = Math.min(end, s - 1);
  }
  return [start, end];
}

/** ID della sessione che inizia esattamente all'indice `from` e finisce a `to`, se c'è. */
export function sessionAtRange(series: ResultSeries, from: number, to: number): string | null {
  const [s, e] = sessionRangeAt(series.sessionStarts, series.total.length, from);
  if (s !== from || e !== to) return null;
  // Con inizi ripetuti, vale l'ultima sessione che inizia lì (quelle prima sono vuote).
  let id: string | null = null;
  series.sessionStarts.forEach((start, i) => {
    if (start === from) id = series.sessionIds[i] ?? null;
  });
  return id;
}

export interface RangeSummary {
  from: number;
  to: number;
  count: number;
  handIds: string[];
  totalBb: number;
  showdownBb: number;
  nonShowdownBb: number;
}

/**
 * Riepilogo di un tratto della serie (estremi inclusi, anche invertiti):
 * i bb sono la differenza dei cumulati tra la fine e il punto prima dell'inizio.
 */
export function summarizeRange(series: ResultSeries, a: number, b: number): RangeSummary {
  const n = series.total.length;
  const from = Math.max(0, Math.min(a, b));
  const to = Math.min(n - 1, Math.max(a, b));
  const diff = (arr: number[]) => (arr[to] ?? 0) - (from > 0 ? (arr[from - 1] ?? 0) : 0);
  return {
    from,
    to,
    count: Math.max(0, to - from + 1),
    handIds: series.handIds.slice(from, to + 1),
    totalBb: diff(series.total),
    showdownBb: diff(series.showdown),
    nonShowdownBb: diff(series.nonShowdown),
  };
}
