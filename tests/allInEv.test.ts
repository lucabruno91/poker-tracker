import { describe, expect, it } from "vitest";
import { classifyAllIn, expectedNet, spotEquity } from "../src/stats/allInEv";
import { buildResultSeries } from "../src/stats/series";
import { buildSessions } from "../src/stats/sessions";
import { handsOf, oneHand } from "./helpers";

describe("classifyAllIn", () => {
  it("heads-up all-in al flop: spot con il board noto", () => {
    const [hu] = handsOf("headsup.txt");
    if (!hu) throw new Error("fixture");
    expect(classifyAllIn(hu, "HeroPlayer")).toEqual({
      kind: "spot",
      spot: {
        handId: "262800000010", opponent: "VillainHU", heroCards: "Qs Qh", opponentCards: "As Kd",
        board: ["Ac", "7d", "2s"], street: "FLOP",
      },
    });
  });

  it("all-in a tre giocatori: escluso come multiway", () => {
    expect(classifyAllIn(oneHand("sidepot.txt"), "HeroPlayer")).toEqual({ kind: "multiway" });
  });

  it("niente all-in o niente showdown: nessuno spot", () => {
    expect(classifyAllIn(oneHand("example.txt"), "HeroPlayer")).toEqual({ kind: "none" });
    expect(classifyAllIn(oneHand("limp.txt"), "HeroPlayer")).toEqual({ kind: "none" });
    expect(classifyAllIn(oneHand("limp.txt"), "ButtonFour")).toEqual({ kind: "none" });
  });
});

describe("equity e risultato atteso", () => {
  const [hu] = handsOf("headsup.txt");
  if (!hu) throw new Error("fixture");
  const k = classifyAllIn(hu, "HeroPlayer");
  if (k.kind !== "spot") throw new Error("spot atteso");

  it("QQ contro AK su Ac 7d 2s: 87 vittorie su 990, nessun pareggio", () => {
    // QQ vince solo se esce almeno una Q: C(45,2) − C(43,2) = 87 board.
    // - Q + A: l'asso fa coppia sul board, QQ ha full (Q su A) contro il tris d'assi.
    // - Q + K: tris di Q contro doppia coppia A-K.
    // Senza Q vince sempre AK: anche 7-7 o 2-2 danno tris sul board e full ad AK (con gli A).
    expect(spotEquity(k.spot)).toBe(87 / 990);
  });

  it("risultato atteso = equity × (piatto − rake) − investito", () => {
    // Piatto 400, rake 10, investito 200.
    expect(expectedNet(hu, "HeroPlayer", 87 / 990)).toBeCloseTo((87 / 990) * 390 - 200, 10);
    // Con equity 1 il risultato atteso coincide con quello di chi vince tutto.
    expect(expectedNet(hu, "VillainHU", 1)).toBe(hu.net.VillainHU);
  });

  it("serie all-in EV: cambia solo nelle mani con spot", () => {
    const hands = handsOf("headsup.txt");
    const sessions = buildSessions(hands, "HeroPlayer");
    const byId = new Map(hands.map((h) => [h.id, h]));
    const ev = expectedNet(hu, "HeroPlayer", 87 / 990);
    const s = buildResultSeries(sessions, byId, "HeroPlayer", new Map([[hu.id, ev]]));
    expect(s.allInEv).toHaveLength(s.total.length);
    expect(s.allInEv[0]).toBeCloseTo(ev / 2, 10);
    // Le mani successive contano col risultato reale: la differenza resta costante.
    const diff = (s.allInEv[0] ?? 0) - (s.total[0] ?? 0);
    s.allInEv.forEach((v, i) => expect(v - (s.total[i] ?? 0)).toBeCloseTo(diff, 10));
  });
});
