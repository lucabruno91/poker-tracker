import type { Counters, Hand } from "../types";
import { addInto, emptyCounters } from "./aggregate";
import { handStats } from "./handStats";
import { sessionIdOf } from "./sessions";

export interface PlayerSummary {
  name: string;
  counters: Counters;
  /** ID delle sessioni (`tavolo|data`) in cui è comparso. */
  sessionIds: string[];
  /** Data e ora dell'ultima mano giocata. */
  lastPlayedAt: string;
  /** Mani in cui è arrivato allo showdown. */
  showdownHandIds: string[];
}

/** Statistiche cumulate di tutti i giocatori (non salvate, SPEC §5). */
export function summarizePlayers(hands: Iterable<Hand>): Map<string, PlayerSummary> {
  const map = new Map<string, PlayerSummary & { sessions: Set<string> }>();
  for (const h of hands) {
    const stats = handStats(h);
    const sid = sessionIdOf(h);
    for (const [name, c] of Object.entries(stats)) {
      let p = map.get(name);
      if (!p) {
        p = { name, counters: emptyCounters(), sessionIds: [], sessions: new Set(), lastPlayedAt: "", showdownHandIds: [] };
        map.set(name, p);
      }
      addInto(p.counters, c);
      p.sessions.add(sid);
      if (h.playedAt > p.lastPlayedAt) p.lastPlayedAt = h.playedAt;
      if (h.showdown.includes(name)) p.showdownHandIds.push(h.id);
    }
  }
  const out = new Map<string, PlayerSummary>();
  for (const [name, p] of map) {
    const { sessions, ...rest } = p;
    out.set(name, { ...rest, sessionIds: [...sessions] });
  }
  return out;
}

/** Contatori di ogni giocatore limitati a un insieme di mani (es. una sessione). */
export function countersFor(hands: Iterable<Hand>): Map<string, Counters> {
  const out = new Map<string, Counters>();
  for (const h of hands) {
    for (const [name, c] of Object.entries(handStats(h))) {
      const current = out.get(name);
      if (current) addInto(current, c);
      else out.set(name, addInto(emptyCounters(), c));
    }
  }
  return out;
}

/** Carte mostrate da un giocatore nel riepilogo della mano, se presenti. */
export function shownCards(hand: Hand, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^Seat \\d+: ${escaped} .*?(?:showed|mucked) \\[([^\\]]+)\\]`, "m");
  return re.exec(hand.raw)?.[1] ?? null;
}
