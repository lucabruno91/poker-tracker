import { describe, expect, it } from "vitest";
import { groupEvenings, sessionSpan } from "../src/stats/evenings";
import { emptyCounters } from "../src/stats/aggregate";
import { buildSessions } from "../src/stats/sessions";
import type { Hand, Session } from "../src/types";
import { handsOf } from "./helpers";

/** Sessione finta con mani agli orari indicati (solo i campi usati da groupEvenings). */
function fake(id: string, times: string[], net = 0, bb = 2): { session: Session; hands: Hand[] } {
  const hands = times.map((t, i) => ({ id: `${id}-${i}`, playedAt: t, bb }) as Hand);
  const session: Session = {
    id, table: id, date: times[0]?.slice(0, 10) ?? "", handIds: hands.map((h) => h.id),
    heroStart: 0, heroEnd: 0, rebuys: 0, net, hero: { ...emptyCounters(), hands: times.length },
  };
  return { session, hands };
}

function group(parts: ReturnType<typeof fake>[]) {
  const byId = new Map(parts.flatMap((p) => p.hands).map((h) => [h.id, h]));
  return groupEvenings(parts.map((p) => p.session), byId);
}

describe("groupEvenings", () => {
  it("tavoli sovrapposti: una serata", () => {
    const e = group([
      fake("A", ["2026-11-24T21:00:00", "2026-11-24T22:30:00"], 100),
      fake("B", ["2026-11-24T21:15:00", "2026-11-24T22:00:00"], -40),
      fake("C", ["2026-11-24T22:20:00", "2026-11-24T23:00:00"], 10),
    ]);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({
      start: "2026-11-24T21:00:00", end: "2026-11-24T23:00:00", date: "2026-11-24",
      sessionIds: ["A", "B", "C"], hands: 6, net: 70, netBb: 35,
    });
  });

  it("pausa di 60 minuti: stessa serata; di 61: serata nuova", () => {
    expect(group([
      fake("A", ["2026-11-24T21:00:00", "2026-11-24T22:00:00"]),
      fake("B", ["2026-11-24T23:00:00"]),
    ])).toHaveLength(1);
    expect(group([
      fake("A", ["2026-11-24T21:00:00", "2026-11-24T22:00:00"]),
      fake("B", ["2026-11-24T23:01:00"]),
    ])).toHaveLength(2);
  });

  it("a cavallo della mezzanotte: una serata con sessioni di due date", () => {
    const e = group([
      fake("A", ["2026-11-24T23:00:00", "2026-11-24T23:55:00"]),
      fake("B", ["2026-11-25T00:10:00", "2026-11-25T01:00:00"]),
    ]);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ date: "2026-11-24", end: "2026-11-25T01:00:00", sessionIds: ["A", "B"] });
  });

  it("ordina per inizio indipendentemente dall'ordine in ingresso", () => {
    const e = group([fake("B", ["2026-11-25T20:00:00"]), fake("A", ["2026-11-24T20:00:00"])]);
    expect(e.map((x) => x.sessionIds)).toEqual([["A"], ["B"]]);
  });

  it("fixture sintetiche: i totali delle serate sono quelli delle sessioni", () => {
    const hands = ["example.txt", "sidepot.txt", "headsup.txt", "limp.txt"].flatMap(handsOf);
    const byId = new Map(hands.map((h) => [h.id, h]));
    const sessions = buildSessions(hands, "HeroPlayer");
    const e = groupEvenings(sessions, byId);
    // 24/11 21:00; 25/11 9:05 (Quattro); 25/11 12:16 (Testtable, oltre un'ora dopo); 26/11 20:00.
    expect(e.map((x) => x.start)).toEqual([
      "2026-11-24T21:00:00", "2026-11-25T09:05:00", "2026-11-25T12:16:12", "2026-11-26T20:00:00",
    ]);
    expect(e.reduce((a, x) => a + x.net, 0)).toBe(sessions.reduce((a, s) => a + s.net, 0));
    expect(e.reduce((a, x) => a + x.hands, 0)).toBe(sessions.reduce((a, s) => a + s.hero.hands, 0));
    expect(sessionSpan(sessions[0] as Session, byId)).toEqual({ start: "2026-11-25T12:16:12", end: "2026-11-25T12:20:00" });
  });
});
