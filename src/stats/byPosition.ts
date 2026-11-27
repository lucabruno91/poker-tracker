import type { Counters, Hand, Position } from "../types";
import { addInto, emptyCounters } from "./aggregate";
import { handStats } from "./handStats";

/** Ordine di azione preflop; EP solo per tavoli con più di 6 giocatori. */
export const POSITION_ORDER: Position[] = ["EP", "UTG", "HJ", "CO", "BTN", "SB", "BB"];

export interface PositionResult {
  position: Position;
  counters: Counters;
  /** Risultato in bb, sommato mano per mano (regge stake diversi). */
  netBb: number;
}

/**
 * Contatori e risultato dell'hero per posizione (SPEC §6.4), nell'ordine di
 * azione. Le posizioni senza mani non compaiono. Funzione pura.
 */
export function heroByPosition(hands: Iterable<Hand>, hero: string): PositionResult[] {
  const map = new Map<Position, PositionResult>();
  for (const h of hands) {
    const position = h.positions[hero];
    const stats = handStats(h)[hero];
    if (!position || !stats) continue;
    let row = map.get(position);
    if (!row) {
      row = { position, counters: emptyCounters(), netBb: 0 };
      map.set(position, row);
    }
    addInto(row.counters, stats);
    row.netBb += (h.net[hero] ?? 0) / h.bb;
  }
  return POSITION_ORDER.flatMap((p) => {
    const row = map.get(p);
    return row ? [row] : [];
  });
}
