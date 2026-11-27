import { useEffect, useMemo, useState } from "react";
import { classifyAllIn, expectedNet, type AllInSpot } from "../stats/allInEv";
import type { EquityMessage } from "../stats/allIn.worker";
import type { Hand } from "../types";

/** Equity già calcolate, per hand ID: valgono per tutta la visita della pagina. */
const cache = new Map<string, number>();

export interface AllInEvState {
  /** Spot heads-up all-in prima del river. */
  spots: AllInSpot[];
  /** All-in prima del river con più di due giocatori (esclusi). */
  multiway: number;
  /** Spot con equity già calcolata. */
  computed: number;
  done: boolean;
  /** Risultato atteso dell'hero in centesimi, per hand ID (solo quando `done`). */
  expected: Map<string, number> | undefined;
  /** Somma dei risultati reali e attesi degli spot, in bb. */
  actualBb: number;
  expectedBb: number;
}

/** Calcola l'all-in EV delle mani dell'hero in un Web Worker. */
export function useAllInEv(hands: Hand[], hero: string | null): AllInEvState {
  const { spots, multiway } = useMemo(() => {
    const spots: AllInSpot[] = [];
    let multiway = 0;
    if (hero) {
      for (const h of hands) {
        const k = classifyAllIn(h, hero);
        if (k.kind === "spot") spots.push(k.spot);
        else if (k.kind === "multiway") multiway++;
      }
    }
    return { spots, multiway };
  }, [hands, hero]);

  const [, setTick] = useState(0);

  useEffect(() => {
    const missing = spots.filter((s) => !cache.has(s.handId));
    if (missing.length === 0) return;
    const worker = new Worker(new URL("../stats/allIn.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<EquityMessage>) => {
      cache.set(event.data.handId, event.data.equity);
      setTick((t) => t + 1);
    };
    // Prima gli spot veloci (turn e flop), poi i preflop.
    const order = { RIVER: 0, TURN: 1, FLOP: 2, PRE: 3 } as const;
    worker.postMessage([...missing].sort((a, b) => order[a.street] - order[b.street]));
    return () => worker.terminate();
  }, [spots]);

  const computed = spots.filter((s) => cache.has(s.handId)).length;
  const done = computed === spots.length;

  const byId = useMemo(() => new Map(hands.map((h) => [h.id, h])), [hands]);
  let expected: Map<string, number> | undefined;
  let actualBb = 0;
  let expectedBb = 0;
  if (done && hero) {
    expected = new Map();
    for (const s of spots) {
      const h = byId.get(s.handId);
      const eq = cache.get(s.handId);
      if (!h || eq === undefined) continue;
      const ev = expectedNet(h, hero, eq);
      expected.set(h.id, ev);
      actualBb += (h.net[hero] ?? 0) / h.bb;
      expectedBb += ev / h.bb;
    }
  }

  return { spots, multiway, computed, done, expected, actualBb, expectedBb };
}
