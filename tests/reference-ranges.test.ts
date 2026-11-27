import { describe, expect, it } from "vitest";
import { assessStat, rangeText, STAT_REFERENCES } from "../src/stats/reference";

describe("intervalli ottimali (SPEC §6.5)", () => {
  it("testi degli intervalli", () => {
    expect(rangeText("vpip")).toBe("22–27%");
    expect(rangeText("foldTo3Bet")).toBe("40–60%");
    expect(rangeText("af")).toBe("2–3");
  });

  it("ogni statistica ha frasi per valore alto e basso", () => {
    for (const ref of Object.values(STAT_REFERENCES)) {
      expect(ref.high.length).toBeGreaterThan(10);
      expect(ref.low.length).toBeGreaterThan(10);
      expect(ref.high).not.toBe(ref.low);
    }
  });
});

describe("assessStat", () => {
  it("valore troppo alto: direzione, distanza e frase", () => {
    expect(assessStat("vpip", { value: 156 / 453, cases: 453 })).toEqual({
      status: "high",
      smallSample: false,
      rangeText: "22–27%",
      deltaText: "+7 punti oltre il 27%",
      hint: STAT_REFERENCES.vpip.high,
    });
  });

  it("valore troppo basso", () => {
    const a = assessStat("wtsd", { value: 34 / 142, cases: 142 });
    expect(a).toMatchObject({ status: "low", deltaText: "−1 punto sotto il 25%", hint: STAT_REFERENCES.wtsd.low });
  });

  it("AF con un decimale", () => {
    expect(assessStat("af", { value: 1.6, cases: 50 })).toMatchObject({ status: "low", deltaText: "−0,4 sotto 2" });
    expect(assessStat("af", { value: 3.54, cases: 50 })).toMatchObject({ status: "high", deltaText: "+0,5 oltre 3" });
    expect(assessStat("af", { value: 98 / 44, cases: 44 }).status).toBe("ok");
  });

  it("confronta il valore come viene mostrato (arrotondato)", () => {
    // 27,4% si mostra come 27%: è dentro l'intervallo, niente «+0 punti».
    expect(assessStat("vpip", { value: 0.274, cases: 100 }).status).toBe("ok");
    expect(assessStat("vpip", { value: 0.275, cases: 100 })).toMatchObject({ status: "high", deltaText: "+1 punto oltre il 27%" });
  });

  it("campione piccolo sotto i 20 casi", () => {
    expect(assessStat("foldTo3Bet", { value: 6 / 8, cases: 8 })).toMatchObject({ status: "high", smallSample: true });
    expect(assessStat("foldTo3Bet", { value: 0.75, cases: 20 }).smallSample).toBe(false);
  });

  it("valore mancante", () => {
    expect(assessStat("cbet", { value: null, cases: 0 })).toEqual({ status: "na", smallSample: false, rangeText: "55–70%" });
  });
});
