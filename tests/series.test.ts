import { describe, expect, it } from "vitest";
import { buildResultSeries, sessionAtRange, sessionRangeAt, summarizeRange } from "../src/stats/series";
import { indexAt } from "../src/ui/CumulativeChart";
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
    expect(buildResultSeries(sessions, byId, null)).toEqual({ total: [], showdown: [], nonShowdown: [], sessionStarts: [], sessionIds: [], handIds: [], allInEv: [] });
  });
});

describe("selezione nel grafico", () => {
  // Sessioni per primo hand ID: Testtable (indici 0–1), Duotable 24/11 (2–3), Duotable 26/11 (4), Quattro (5).
  it("gli ID delle mani sono allineati al totale", () => {
    expect(s.handIds).toHaveLength(s.total.length);
    expect(s.handIds).toEqual(["262800000001", "262800000002", "262800000010", "262800000011", "262800000012", "262800000020"]);
    expect(s.sessionIds).toEqual(sessions.map((x) => x.id));
  });

  it("sessionRangeAt: primo e ultimo indice della sessione", () => {
    const at = (i: number) => sessionRangeAt(s.sessionStarts, s.total.length, i);
    expect(at(0)).toEqual([0, 1]);
    expect(at(1)).toEqual([0, 1]);
    expect(at(2)).toEqual([2, 3]);
    expect(at(4)).toEqual([4, 4]);
    expect(at(5)).toEqual([5, 5]);
    // Sessioni senza mani dell'hero: inizi ripetuti.
    expect(sessionRangeAt([0, 3, 3, 5], 7, 3)).toEqual([3, 4]);
    expect(sessionRangeAt([0, 3, 3, 5], 7, 6)).toEqual([5, 6]);
  });

  it("sessionAtRange riconosce solo intervalli che coincidono con una sessione", () => {
    expect(sessionAtRange(s, 2, 3)).toBe(sessions[1]?.id);
    expect(sessionAtRange(s, 2, 2)).toBeNull();
    expect(sessionAtRange(s, 1, 2)).toBeNull();
  });

  it("summarizeRange: differenza dei cumulati, estremi inclusi o invertiti", () => {
    const all = summarizeRange(s, 0, s.total.length - 1);
    expect(all.count).toBe(6);
    expect(all.totalBb).toBeCloseTo(s.total.at(-1) ?? 0, 10);
    const one = summarizeRange(s, 2, 2);
    expect(one).toMatchObject({ from: 2, to: 2, count: 1, handIds: ["262800000010"] });
    expect(one.totalBb).toBeCloseTo(-100, 10);
    expect(one.showdownBb).toBeCloseTo(-100, 10);
    expect(summarizeRange(s, 3, 1)).toEqual(summarizeRange(s, 1, 3));
    const r = summarizeRange(s, 1, 4);
    expect(r.totalBb).toBeCloseTo(r.showdownBb + r.nonShowdownBb, 10);
    // Intervalli consecutivi si sommano.
    expect(summarizeRange(s, 0, 1).totalBb + summarizeRange(s, 2, 5).totalBb).toBeCloseTo(all.totalBb, 10);
  });

  it("indexAt converte la posizione del puntatore nell'indice della mano", () => {
    // viewBox largo 800 con margine sinistro 56 e destro 16: area dati 728.
    expect(indexAt(0, 800, 10)).toBe(0); // nel margine: prima mano
    expect(indexAt(56, 800, 10)).toBe(0);
    expect(indexAt(56 + 728 / 2, 800, 10)).toBe(5);
    expect(indexAt(799, 800, 10)).toBe(9); // nel margine destro: ultima mano
    expect(indexAt(28 + 364 / 2, 400, 10)).toBe(5); // SVG mostrato a metà larghezza
  });
});
