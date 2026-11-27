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
  const out: ResultSeries = { total: [], showdown: [], nonShowdown: [], sessionStarts: [], allInEv: [] };
  if (!hero) return out;
  let sd = 0;
  let nsd = 0;
  let ev = 0;
  for (const s of sessions) {
    out.sessionStarts.push(out.total.length);
    for (const id of [...s.handIds].sort(compareHandIds)) {
      const h = handsById.get(id);
      if (!h || !h.players.some((p) => p.name === hero)) continue;
      const bb = (h.net[hero] ?? 0) / h.bb;
      if (h.showdown.includes(hero)) sd += bb;
      else nsd += bb;
      out.showdown.push(sd);
      out.nonShowdown.push(nsd);
      out.total.push(sd + nsd);
      if (expected) {
        ev += (expected.get(h.id) ?? h.net[hero] ?? 0) / h.bb;
        out.allInEv.push(ev);
      }
    }
  }
  return out;
}
