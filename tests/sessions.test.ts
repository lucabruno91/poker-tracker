import { describe, expect, it } from "vitest";
import { buildSessions, compareHandIds, detectHero } from "../src/stats/sessions";
import { handsOf } from "./helpers";

describe("sessioni e ricariche", () => {
  const hands = handsOf("headsup.txt");
  const sessions = buildSessions(hands, "HeroPlayer");

  it("raggruppa per tavolo e giorno", () => {
    expect(sessions.map((s) => s.id)).toEqual(["Duotable II|2026-11-24", "Duotable II|2026-11-26"]);
  });

  it("rileva la ricarica e lo stack finale", () => {
    const s = sessions[0];
    expect(s).toMatchObject({ heroStart: 200, heroEnd: 202, rebuys: 200, net: -198 });
    expect(s?.hero.hands).toBe(2);
    expect(s?.issues).toBeUndefined();
    if (s) expect(s.heroEnd - s.heroStart - s.rebuys).toBe(s.net);
  });

  it("segnala uno stack sceso tra due mani", () => {
    const [first, second] = hands;
    if (!first || !second) throw new Error("fixture");
    // Atteso dopo la prima mano: 200 − 150 = 50; la seconda parte da 0 → calo.
    const altered = { ...first, net: { ...first.net, HeroPlayer: -150 } };
    const zero = {
      ...second,
      players: second.players.map((p) => (p.name === "HeroPlayer" ? { ...p, stack: 0 } : p)),
    };
    const s = buildSessions([altered, zero], "HeroPlayer")[0];
    expect(s?.rebuys).toBe(0);
    expect(s?.issues?.length).toBeGreaterThanOrEqual(1);
  });

  it("ordina gli hand ID come numeri e trova l'hero", () => {
    expect(compareHandIds("99", "100")).toBeLessThan(0);
    expect(detectHero(hands)).toBe("HeroPlayer");
  });
});
