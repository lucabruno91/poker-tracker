import { describe, expect, it } from "vitest";
import { buildResultSeries } from "../src/stats/series";
import { buildSessions } from "../src/stats/sessions";
import { handsOf } from "./helpers";

const hands = ["example.txt", "sidepot.txt", "headsup.txt", "limp.txt"].flatMap(handsOf);
const byId = new Map(hands.map((h) => [h.id, h]));
const sessions = buildSessions(hands, "HeroPlayer");
const s = buildResultSeries(sessions, byId, "HeroPlayer");

describe("buildResultSeries", () => {
  it("una voce per ogni mano dell'hero, con gli inizi di sessione", () => {
    expect(s.total).toHaveLength(6);
    expect(s.showdown).toHaveLength(6);
    expect(s.nonShowdown).toHaveLength(6);
    // Sessioni per primo hand ID: Testtable (2 mani), Duotable 24/11 (2), Duotable 26/11 (1), Quattro (1).
    expect(sessions.map((x) => x.table)).toEqual(["Testtable I", "Duotable II", "Duotable II", "Quattro III"]);
    expect(s.sessionStarts).toEqual([0, 2, 4, 5]);
  });

  it("totale = showdown + senza showdown a ogni mano", () => {
    s.total.forEach((t, i) => expect(t).toBeCloseTo((s.showdown[i] ?? 0) + (s.nonShowdown[i] ?? 0), 10));
    expect(s.total.at(-1)).toBeCloseTo((18 + 138 - 2 - 200 + 2 + 1) / 2, 10);
  });

  it("separa showdown e piatti vinti senza mostrare", () => {
    // Showdown: side pot (+69 bb) e heads-up perso (−100 bb). Senza: esempio, limp, HU vinti.
    expect(s.showdown.at(-1)).toBeCloseTo(69 - 100, 10);
    expect(s.nonShowdown.at(-1)).toBeCloseTo(9 - 1 + 1 + 0.5, 10);
  });

  it("senza hero le serie sono vuote", () => {
    expect(buildResultSeries(sessions, byId, null)).toEqual({ total: [], showdown: [], nonShowdown: [], sessionStarts: [], allInEv: [] });
  });
});
