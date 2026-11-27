import type { Cents, Hand, Session } from "../types";
import { addInto, emptyCounters } from "./aggregate";
import { handStats } from "./handStats";

/** Confronto numerico tra hand ID (stringhe di cifre). */
export function compareHandIds(a: string, b: string): number {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

export function sessionDate(hand: Hand): string {
  return hand.playedAt.slice(0, 10);
}

export function sessionId(table: string, date: string): string {
  return `${table}|${date}`;
}

export function sessionIdOf(hand: Hand): string {
  return sessionId(hand.table, sessionDate(hand));
}

/** Nome dell'hero più frequente nelle righe "Dealt to". */
export function detectHero(hands: Iterable<Hand>): string | null {
  const counts = new Map<string, number>();
  for (const h of hands) {
    if (h.heroName) counts.set(h.heroName, (counts.get(h.heroName) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [name, n] of counts) {
    if (n > bestCount) { best = name; bestCount = n; }
  }
  return best;
}

const euro = (c: Cents): string => `€${(c / 100).toFixed(2)}`;

/**
 * Costruisce una sessione (mani dello stesso tavolo e giorno) per l'hero.
 * Ricariche secondo SPEC §6.3.
 */
export function buildSession(hands: Hand[], hero: string, summary?: string): Session {
  const sorted = [...hands].sort((a, b) => compareHandIds(a.id, b.id));
  const first = sorted[0];
  if (!first) throw new Error("Sessione senza mani");

  const heroHands = sorted.filter((h) => h.players.some((p) => p.name === hero));
  const counters = emptyCounters();
  const issues: string[] = [];
  let rebuys: Cents = 0;
  let net: Cents = 0;
  let heroStart: Cents = 0;
  let heroEnd: Cents = 0;

  heroHands.forEach((h, i) => {
    const stats = handStats(h)[hero];
    if (stats) addInto(counters, stats);
    const heroNet = h.net[hero] ?? 0;
    net += heroNet;
    const stack = h.players.find((p) => p.name === hero)?.stack ?? 0;
    if (i === 0) heroStart = stack;
    const next = heroHands[i + 1];
    if (next) {
      const nextStack = next.players.find((p) => p.name === hero)?.stack ?? 0;
      const diff = nextStack - (stack + heroNet);
      if (diff > 0) rebuys += diff;
      else if (diff < 0) {
        issues.push(`Stack dell'hero sceso di ${euro(-diff)} tra la mano ${h.id} e la ${next.id}`);
      }
    } else {
      heroEnd = stack + heroNet;
    }
  });

  if (heroHands.length > 0 && heroEnd - heroStart - rebuys !== net) {
    issues.push("Stack finale incoerente con il risultato netto della sessione");
  }

  const session: Session = {
    id: sessionIdOf(first),
    table: first.table,
    date: sessionDate(first),
    handIds: sorted.map((h) => h.id),
    heroStart,
    heroEnd,
    rebuys,
    net,
    hero: counters,
  };
  if (summary !== undefined) session.summary = summary;
  if (issues.length > 0) session.issues = issues;
  return session;
}

/** Raggruppa le mani in sessioni (tavolo + giorno), dalla più vecchia. */
export function groupHandsBySession(hands: Iterable<Hand>): Map<string, Hand[]> {
  const groups = new Map<string, Hand[]>();
  for (const h of hands) {
    const id = sessionIdOf(h);
    const list = groups.get(id);
    if (list) list.push(h);
    else groups.set(id, [h]);
  }
  return groups;
}

export function buildSessions(hands: Iterable<Hand>, hero: string): Session[] {
  const sessions = [...groupHandsBySession(hands).values()].map((g) => buildSession(g, hero));
  return sessions.sort((a, b) => compareHandIds(a.handIds[0] ?? "", b.handIds[0] ?? ""));
}
