import type { Counters, Hand } from "../types";
import { emptyCounters } from "./aggregate";

/** Contatori di ogni giocatore presente nella mano (SPEC §6.5). Funzione pura. */
export function handStats(hand: Hand): Record<string, Counters> {
  const result: Record<string, Counters> = {};
  for (const p of hand.players) {
    const c = emptyCounters();
    c.hands = 1;
    c.net = hand.net[p.name] ?? 0;
    result[p.name] = c;
  }
  const get = (name: string): Counters | undefined => result[name];

  // --- Preflop: solo azioni volontarie (i blind non sono tra le azioni).
  let raises = 0;
  let lastRaiser: string | null = null;
  let opener: string | null = null;
  const actionCount: Record<string, number> = {};
  const vpip = new Set<string>();
  const pfr = new Set<string>();
  const limped = new Set<string>();
  const foldedPre = new Set<string>();

  for (const a of hand.actions) {
    if (a.street !== "PRE") continue;
    const c = get(a.player);
    if (!c) continue;
    const n = (actionCount[a.player] = (actionCount[a.player] ?? 0) + 1);

    if (a.kind === "call" || a.kind === "raise") vpip.add(a.player);
    if (a.kind === "raise") pfr.add(a.player);
    if (a.kind === "call" && raises === 0) limped.add(a.player);
    if (a.kind === "fold") foldedPre.add(a.player);

    if (n === 1 && raises === 1 && lastRaiser !== a.player) {
      c.threeBetOpp++;
      if (a.kind === "raise") c.threeBet++;
    }
    if (a.player === opener && raises === 2 && n === 2) {
      c.foldTo3BetOpp++;
      if (a.kind === "fold") c.foldTo3Bet++;
    }

    if (a.kind === "raise") {
      raises++;
      lastRaiser = a.player;
      opener ??= a.player;
    }
  }
  for (const name of vpip) { const c = get(name); if (c) c.vpip = 1; }
  for (const name of pfr) { const c = get(name); if (c) c.pfr = 1; }
  for (const name of limped) { const c = get(name); if (c) c.limp = 1; }

  // --- Flop, showdown.
  const sawFlop = new Set<string>();
  if (hand.sawFlop) {
    for (const p of hand.players) {
      if (foldedPre.has(p.name)) continue;
      sawFlop.add(p.name);
      const c = get(p.name);
      if (!c) continue;
      c.flops = 1;
      if (hand.showdown.includes(p.name)) {
        c.wtsd = 1;
        if (hand.winners.includes(p.name)) c.wsd = 1;
      }
    }
  }

  // --- C-bet: ultimo rilanciatore preflop, prima azione al flop senza puntate prima.
  if (lastRaiser && sawFlop.has(lastRaiser)) {
    let betSeen = false;
    for (const a of hand.actions) {
      if (a.street !== "FLOP") continue;
      if (a.player === lastRaiser) {
        const c = get(lastRaiser);
        if (c && !betSeen) {
          c.cbetOpp = 1;
          if (a.kind === "bet") c.cbet = 1;
        }
        break;
      }
      if (a.kind === "bet" || a.kind === "raise") betSeen = true;
    }
  }

  // --- Aggressività dal flop in poi.
  for (const a of hand.actions) {
    if (a.street === "PRE") continue;
    const c = get(a.player);
    if (!c) continue;
    if (a.kind === "bet" || a.kind === "raise") c.aggr++;
    else if (a.kind === "call") c.calls++;
  }

  return result;
}
