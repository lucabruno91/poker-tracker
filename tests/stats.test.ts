import { describe, expect, it } from "vitest";
import { handStats } from "../src/stats/handStats";
import { displayStats, emptyCounters, sumCounters } from "../src/stats/aggregate";
import { autoLabel, effectiveLabel } from "../src/labels/autoLabel";
import { oneHand } from "./helpers";

describe("handStats — mano d'esempio", () => {
  const s = handStats(oneHand("example.txt"));

  it("hero: 3-bet, c-bet, aggressività", () => {
    expect(s.HeroPlayer).toMatchObject({
      hands: 1, vpip: 1, pfr: 1, limp: 0, threeBet: 1, threeBetOpp: 1,
      foldTo3Bet: 0, foldTo3BetOpp: 0, flops: 1, wtsd: 0, wsd: 0,
      cbet: 1, cbetOpp: 1, aggr: 1, calls: 0, net: 18,
    });
  });

  it("l'opener folda alla 3-bet", () => {
    expect(s.BetaTwo).toMatchObject({ vpip: 1, pfr: 1, foldTo3Bet: 1, foldTo3BetOpp: 1, flops: 0, threeBetOpp: 0 });
  });

  it("dopo la 3-bet non c'è occasione di 3-bet; i blind non sono VPIP", () => {
    expect(s.GammaFour).toMatchObject({ vpip: 0, threeBetOpp: 0 });
    expect(s.AlphaOne).toMatchObject({ vpip: 1, pfr: 0, threeBetOpp: 0, flops: 1, cbetOpp: 0 });
    expect(s.EpsSix).toMatchObject({ vpip: 0, threeBetOpp: 0 });
  });
});

describe("handStats — side pot", () => {
  const s = handStats(oneHand("sidepot.txt"));

  it("all-in preflop: vede flop e showdown senza occasione di c-bet", () => {
    expect(s["Ab9//123"]).toMatchObject({ vpip: 1, pfr: 1, threeBetOpp: 0, flops: 1, wtsd: 1, wsd: 0, cbetOpp: 0 });
  });

  it("hero: 3-bet poi call; showdown vinto", () => {
    expect(s.HeroPlayer).toMatchObject({ threeBet: 1, threeBetOpp: 1, wtsd: 1, wsd: 1, aggr: 1, calls: 0, cbetOpp: 0 });
  });

  it("opener davanti a una 4-bet: nessuna occasione di fold contro 3-bet", () => {
    expect(s.ShortOne).toMatchObject({ foldTo3BetOpp: 0, calls: 1, wtsd: 1, wsd: 0 });
  });
});

describe("handStats — limp", () => {
  const s = handStats(oneHand("limp.txt"));

  it("conta i limp, compreso lo SB che completa", () => {
    expect(s.HeroPlayer).toMatchObject({ vpip: 1, limp: 1, pfr: 0, flops: 1, wtsd: 0 });
    expect(s.ButtonFour).toMatchObject({ vpip: 1, limp: 1, calls: 1, wtsd: 1, wsd: 1, net: 9 });
    expect(s.LimperOne).toMatchObject({ vpip: 1, limp: 1 });
    expect(s.BigTwo).toMatchObject({ vpip: 0, limp: 0, aggr: 1, cbetOpp: 0, wtsd: 1, wsd: 0 });
  });
});

describe("aggregate", () => {
  it("somma i contatori e calcola i rapporti", () => {
    const a = { ...emptyCounters(), hands: 10, vpip: 3, aggr: 4, calls: 2, net: -5 };
    const b = { ...emptyCounters(), hands: 10, vpip: 2, aggr: 2, calls: 1, net: 7 };
    const total = sumCounters([a, b]);
    expect(total).toMatchObject({ hands: 20, vpip: 5, aggr: 6, calls: 3, net: 2 });
    const d = displayStats(total);
    expect(d.vpip).toEqual({ value: 0.25, cases: 20 });
    expect(d.af).toEqual({ value: 2, cases: 3 });
    expect(d.threeBet).toEqual({ value: null, cases: 0 });
  });
});

describe("autoLabel", () => {
  const c = (hands: number, vpip: number, pfr: number) => ({ ...emptyCounters(), hands, vpip, pfr });

  it("applica le soglie della SPEC §6.6", () => {
    expect(autoLabel(c(14, 14, 0))).toBeNull();
    expect(autoLabel(c(100, 55, 5))).toBe("Balena");
    expect(autoLabel(c(100, 35, 25))).toBe("Fish");
    expect(autoLabel(c(100, 35, 26))).toBeNull();
    expect(autoLabel(c(100, 15, 10))).toBe("Roccia");
    expect(autoLabel(c(100, 25, 20))).toBeNull();
  });

  it("precedenza utente > Claude > automatica", () => {
    const stats = c(100, 60, 5);
    expect(effectiveLabel({ name: "x", label: "Roccia", claudeLabel: "Fish" }, stats)).toMatchObject({ label: "Roccia", source: "user" });
    expect(effectiveLabel({ name: "x", claudeLabel: "Fish" }, stats)).toMatchObject({ label: "Fish", source: "claude" });
    expect(effectiveLabel(undefined, stats)).toMatchObject({ label: "Balena", source: "auto", smallSample: false });
    expect(effectiveLabel(undefined, c(10, 10, 0))).toMatchObject({ label: null, toObserve: true, smallSample: true });
  });
});
