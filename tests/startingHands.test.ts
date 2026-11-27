import { describe, expect, it } from "vitest";
import { GRID_ORDER, gridCell, handClass, heroByStartingHand } from "../src/stats/startingHands";
import { handsOf } from "./helpers";

describe("handClass", () => {
  it.each([
    ["Ad Kc", "AKo"],
    ["Kc Ad", "AKo"],
    ["Ah Kh", "AKs"],
    ["Qs Qd", "QQ"],
    ["2c 7d", "72o"],
    ["9c 8c", "98s"],
    ["Ts 5d", "T5o"],
  ])("%s → %s", (cards, cls) => expect(handClass(cards)).toBe(cls));

  it("rifiuta carte non valide", () => {
    expect(handClass("Ad")).toBeNull();
    expect(handClass("Xd Kc")).toBeNull();
    expect(handClass("Ad Kc Qh")).toBeNull();
  });
});

describe("gridCell", () => {
  it("coppie in diagonale, suited sopra, offsuit sotto", () => {
    expect(gridCell(0, 0)).toBe("AA");
    expect(gridCell(0, 1)).toBe("AKs");
    expect(gridCell(1, 0)).toBe("AKo");
    expect(gridCell(12, 12)).toBe("22");
    expect(gridCell(12, 0)).toBe("A2o");
  });

  it("copre tutte le 169 classi una sola volta", () => {
    const all = new Set<string>();
    GRID_ORDER.forEach((_, r) => GRID_ORDER.forEach((__, c) => all.add(gridCell(r, c))));
    expect(all.size).toBe(169);
  });
});

describe("heroByStartingHand", () => {
  const hands = ["example.txt", "sidepot.txt", "headsup.txt", "limp.txt"].flatMap(handsOf);
  const res = heroByStartingHand(hands, "HeroPlayer");

  it("raggruppa le mani dell'hero per classe", () => {
    expect([...res.keys()].sort()).toEqual(["55", "72o", "98s", "AA", "AKo", "QQ"]);
    expect(res.get("AKo")).toEqual({ hands: 1, vpip: 1, netBb: 9, handIds: ["262800000001"] });
    expect(res.get("72o")).toMatchObject({ hands: 1, vpip: 0, netBb: 0.5 });
  });

  it("la somma della griglia dà il totale delle mani con carte note", () => {
    const total = [...res.values()].reduce((a, r) => a + r.hands, 0);
    expect(total).toBe(hands.filter((h) => h.heroName === "HeroPlayer" && h.heroCards).length);
    const netBb = [...res.values()].reduce((a, r) => a + r.netBb, 0);
    expect(netBb).toBeCloseTo((18 + 138 - 2 - 200 + 2 + 1) / 2, 10);
  });
});
