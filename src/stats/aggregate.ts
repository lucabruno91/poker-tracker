import type { Cents, Counters } from "../types";

export function emptyCounters(): Counters {
  return {
    hands: 0, vpip: 0, pfr: 0, limp: 0,
    threeBet: 0, threeBetOpp: 0, foldTo3Bet: 0, foldTo3BetOpp: 0,
    flops: 0, wtsd: 0, wsd: 0, cbet: 0, cbetOpp: 0, aggr: 0, calls: 0,
    net: 0,
  };
}

const KEYS = Object.keys(emptyCounters()) as (keyof Counters)[];

/** Somma b in a (modifica a) e lo restituisce. */
export function addInto(a: Counters, b: Counters): Counters {
  for (const k of KEYS) a[k] += b[k];
  return a;
}

export function sumCounters(list: Iterable<Counters>): Counters {
  const total = emptyCounters();
  for (const c of list) addInto(total, c);
  return total;
}

export interface Ratio {
  /** null se il denominatore è 0. */
  value: number | null;
  /** Numero di casi (denominatore). */
  cases: number;
}

export function ratio(num: number, den: number): Ratio {
  return { value: den > 0 ? num / den : null, cases: den };
}

export interface DisplayStats {
  vpip: Ratio;
  pfr: Ratio;
  threeBet: Ratio;
  foldTo3Bet: Ratio;
  cbet: Ratio;
  wtsd: Ratio;
  wsd: Ratio;
  af: Ratio;
}

export function displayStats(c: Counters): DisplayStats {
  return {
    vpip: ratio(c.vpip, c.hands),
    pfr: ratio(c.pfr, c.hands),
    threeBet: ratio(c.threeBet, c.threeBetOpp),
    foldTo3Bet: ratio(c.foldTo3Bet, c.foldTo3BetOpp),
    cbet: ratio(c.cbet, c.cbetOpp),
    wtsd: ratio(c.wtsd, c.flops),
    wsd: ratio(c.wsd, c.wtsd),
    af: ratio(c.aggr, c.calls),
  };
}

/** Risultato in big blind (numero decimale, solo per la visualizzazione). */
export function netInBb(net: Cents, bb: Cents): number {
  return net / bb;
}

export function bbPer100(net: Cents, bb: Cents, hands: number): number | null {
  return hands > 0 ? (100 * (net / bb)) / hands : null;
}

/** Valori di riferimento per un regular 6-max (SPEC §6.5). */
export const REFERENCE: Record<keyof DisplayStats, { min: number; max: number }> = {
  vpip: { min: 0.22, max: 0.27 },
  pfr: { min: 0.18, max: 0.23 },
  threeBet: { min: 0.05, max: 0.09 },
  foldTo3Bet: { min: 0.4, max: 0.6 },
  cbet: { min: 0.55, max: 0.7 },
  wtsd: { min: 0.25, max: 0.3 },
  wsd: { min: 0.5, max: 0.55 },
  af: { min: 2, max: 3 },
};

/** Sotto questa soglia si mostra il numero di casi. */
export const FEW_CASES = 20;
