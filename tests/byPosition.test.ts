import { describe, expect, it } from "vitest";
import { heroByPosition } from "../src/stats/byPosition";
import { sumCounters } from "../src/stats/aggregate";
import { buildSessions } from "../src/stats/sessions";
import { handsOf } from "./helpers";

const all = ["example.txt", "sidepot.txt", "headsup.txt", "limp.txt"].flatMap(handsOf);

describe("heroByPosition", () => {
  const rows = heroByPosition(all, "HeroPlayer");

  it("raggruppa per posizione nell'ordine di azione", () => {
    expect(rows.map((r) => [r.position, r.counters.hands])).toEqual([
      ["HJ", 1], ["CO", 1], ["BTN", 1], ["SB", 1], ["BB", 2],
    ]);
  });

  it("la somma delle posizioni dà i totali dell'hero", () => {
    const totals = buildSessions(all, "HeroPlayer").map((s) => s.hero);
    expect(sumCounters(rows.map((r) => r.counters))).toEqual(sumCounters(totals));
    const netBb = rows.reduce((a, r) => a + r.netBb, 0);
    expect(netBb).toBeCloseTo((18 + 138 - 2 - 200 + 2 + 1) / 2, 10);
  });

  it("in heads-up solo BTN e BB", () => {
    const hu = heroByPosition(handsOf("headsup.txt"), "VillainHU");
    expect(hu.map((r) => r.position)).toEqual(["BTN", "BB"]);
  });

  it("giocatore assente: nessuna riga", () => {
    expect(heroByPosition(all, "Nessuno")).toEqual([]);
  });
});
