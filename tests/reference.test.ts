/**
 * Valori di riferimento della SPEC §11, calcolati sulle hand history reali.
 *
 * Le hand history (`fixtures/*.txt`) e i valori attesi (`fixtures/reference.json`)
 * contengono nomi di altri giocatori e restano fuori da git. Senza quei file
 * questi test vengono saltati; con i file DEVONO passare tutti.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { netImbalance, parseHand } from "../src/parser/parseHand";
import { splitHands } from "../src/parser/splitHands";
import { handStats } from "../src/stats/handStats";
import { addInto, emptyCounters } from "../src/stats/aggregate";
import { buildSessions } from "../src/stats/sessions";
import { groupEvenings } from "../src/stats/evenings";
import { heroByPosition } from "../src/stats/byPosition";
import { heroByStartingHand } from "../src/stats/startingHands";
import { buildResultSeries } from "../src/stats/series";
import type { Counters, Hand } from "../src/types";

interface Reference {
  hero: string;
  sessions: { table: string; date: string; hands: number; net: number; rebuys: number; heroEnd: number; counters: number[] }[];
  totals: { net: number; rebuys: number; hands: number; netBb: number; counters: number[] };
  opponents: { name: string; counters: number[]; tables: string[] }[];
  sidePot: { handId: string; heroNet: number; heroCollectedLines: number; sittingOut: string };
  specialName: { name: string; table: string };
}

const DIR = join(__dirname, "..", "fixtures");
const REF_FILE = join(DIR, "reference.json");
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".txt")) : [];
const enabled = files.length > 0 && existsSync(REF_FILE);

/** Ordine dei contatori dell'hero nella SPEC §11. */
const HERO_KEYS: (keyof Counters)[] = [
  "hands", "vpip", "pfr", "limp", "threeBet", "threeBetOpp", "foldTo3Bet", "foldTo3BetOpp",
  "flops", "wtsd", "wsd", "cbet", "cbetOpp", "aggr", "calls",
];
/** Ordine dei contatori degli avversari nella SPEC §11. */
const OPP_KEYS: (keyof Counters)[] = [
  "hands", "vpip", "pfr", "limp", "threeBet", "threeBetOpp", "flops", "wtsd", "wsd", "aggr", "calls",
];

function loadAll(): Hand[] {
  const byId = new Map<string, Hand>();
  for (const f of files) {
    for (const text of splitHands(readFileSync(join(DIR, f), "utf8"))) {
      const r = parseHand(text);
      if (r.ok) byId.set(r.hand.id, r.hand);
    }
  }
  return [...byId.values()];
}

describe.skipIf(!enabled)("valori di riferimento (fixture reali)", () => {
  const ref = enabled ? (JSON.parse(readFileSync(REF_FILE, "utf8")) as Reference) : null;
  const hands = enabled ? loadAll() : [];
  const sessions = ref ? buildSessions(hands, ref.hero) : [];
  if (!ref) return;

  it("Σ net = −rake per ogni mano", () => {
    expect(hands.filter((h) => netImbalance(h) !== 0).map((h) => h.id)).toEqual([]);
  });

  it("sessioni dell'hero", () => {
    expect(sessions.map((s) => [s.table, s.date, s.hero.hands, s.net, s.rebuys, s.heroEnd])).toEqual(
      ref.sessions.map((s) => [s.table, s.date, s.hands, s.net, s.rebuys, s.heroEnd]),
    );
    for (const s of sessions) {
      expect(s.heroEnd - s.heroStart - s.rebuys, s.id).toBe(s.net);
      expect(s.issues, s.id).toBeUndefined();
    }
  });

  it("totali e ultimo valore del grafico", () => {
    const net = sessions.reduce((a, s) => a + s.net, 0);
    expect(net).toBe(ref.totals.net);
    expect(sessions.reduce((a, s) => a + s.rebuys, 0)).toBe(ref.totals.rebuys);
    expect(sessions.reduce((a, s) => a + s.hero.hands, 0)).toBe(ref.totals.hands);
    expect(net / 2).toBe(ref.totals.netBb);
  });

  it("per posizione: la somma dà i totali", () => {
    const rows = heroByPosition(hands, ref.hero);
    expect(rows.reduce((a, r) => a + r.counters.hands, 0)).toBe(ref.totals.hands);
    expect(rows.reduce((a, r) => a + r.counters.net, 0)).toBe(ref.totals.net);
    expect(rows.reduce((a, r) => a + r.netBb, 0)).toBeCloseTo(ref.totals.netBb, 9);
  });

  it("per mano iniziale: la somma dà i totali", () => {
    const res = [...heroByStartingHand(hands, ref.hero).values()];
    expect(res.reduce((a, r) => a + r.hands, 0)).toBe(ref.totals.hands);
    expect(res.reduce((a, r) => a + r.netBb, 0)).toBeCloseTo(ref.totals.netBb, 9);
  });

  it("grafico: ultimo valore e totale = showdown + senza showdown", () => {
    const series = buildResultSeries(sessions, new Map(hands.map((h) => [h.id, h])), ref.hero);
    expect(series.total).toHaveLength(ref.totals.hands);
    expect(series.total.at(-1)).toBeCloseTo(ref.totals.netBb, 9);
    series.total.forEach((t, i) => expect(t).toBeCloseTo((series.showdown[i] ?? 0) + (series.nonShowdown[i] ?? 0), 9));
  });

  it("serate: i totali sono quelli delle sessioni", () => {
    const evenings = groupEvenings(sessions, new Map(hands.map((h) => [h.id, h])));
    expect(evenings.flatMap((e) => e.sessionIds).sort()).toEqual(sessions.map((s) => s.id).sort());
    expect(evenings.reduce((a, e) => a + e.net, 0)).toBe(ref.totals.net);
    expect(evenings.reduce((a, e) => a + e.rebuys, 0)).toBe(ref.totals.rebuys);
    expect(evenings.reduce((a, e) => a + e.hands, 0)).toBe(ref.totals.hands);
  });

  for (const expected of ref.sessions) {
    it(`contatori dell'hero — ${expected.table}`, () => {
      const s = sessions.find((x) => x.table === expected.table);
      expect(HERO_KEYS.map((k) => s?.hero[k])).toEqual(expected.counters);
    });
  }

  it("contatori dell'hero — totale", () => {
    const total = emptyCounters();
    for (const s of sessions) addInto(total, s.hero);
    expect(HERO_KEYS.map((k) => total[k])).toEqual(ref.totals.counters);
  });

  for (const opp of ref.opponents) {
    it(`avversario n. ${ref.opponents.indexOf(opp) + 1}`, () => {
      const total = emptyCounters();
      const seen = new Set<string>();
      for (const h of hands) {
        const c = handStats(h)[opp.name];
        if (!c) continue;
        addInto(total, c);
        seen.add(h.table);
      }
      expect(OPP_KEYS.map((k) => total[k])).toEqual(opp.counters);
      expect([...seen].sort()).toEqual([...opp.tables].sort());
    });
  }

  it("side pot", () => {
    const { handId, heroNet, heroCollectedLines, sittingOut } = ref.sidePot;
    const h = hands.find((x) => x.id === handId);
    expect(h).toBeDefined();
    expect(h?.net[ref.hero]).toBe(heroNet);
    const collected = (h?.raw.match(new RegExp(`^${ref.hero} collected €`, "gm")) ?? []).length;
    expect(collected).toBe(heroCollectedLines);
    expect(h?.players.some((p) => p.name === sittingOut)).toBe(false);
  });

  it("nome con caratteri speciali", () => {
    const { name, table } = ref.specialName;
    expect(hands.some((h) => h.table === table && h.players.some((p) => p.name === name))).toBe(true);
  });

  it("posizioni in heads-up e a 3 giocatori", () => {
    for (const n of [2, 3]) {
      for (const h of hands.filter((x) => x.players.length === n)) {
        expect(Object.values(h.positions).sort(), h.id).toEqual(n === 2 ? ["BB", "BTN"] : ["BB", "BTN", "SB"]);
      }
    }
  });
});
