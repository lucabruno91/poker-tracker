import { describe, expect, it } from "vitest";
import { filterSignature, parseSelection, selectionQuery } from "../src/ui/selectionUrl";
import { NO_FILTER } from "../src/stats/filters";
import { normalizeHash, parseRoute, pathOf } from "../src/ui/router";

const TODAY = "2026-11-27";
const sig = filterSignature(NO_FILTER, TODAY);

describe("selezione nell'URL", () => {
  it("andata e ritorno, con i numeri di mano mostrati (da 1)", () => {
    const q = selectionQuery([114, 189], sig);
    expect(q).toBe("sel=115-190"); // senza filtro l'URL resta pulito
    expect(sig).toBe("");
    expect(parseSelection(q, sig, 453)).toEqual([114, 189]);
    expect(selectionQuery(null, sig)).toBe("");
    expect(parseSelection("", sig, 453)).toBeNull();
  });

  it("con un filtro l'impronta va nell'URL", () => {
    const today = filterSignature({ period: "today" }, TODAY);
    const q = selectionQuery([0, 9], today);
    expect(new URLSearchParams(q).get("f")).toBe(today);
    expect(parseSelection(q, today, 20)).toEqual([0, 9]);
    // Selezione fatta senza filtro, poi attivato «Oggi»: ignorata.
    expect(parseSelection("sel=1-10", today, 20)).toBeNull();
  });

  it("ignorata se fatta con un altro filtro", () => {
    const today = filterSignature({ period: "today" }, TODAY);
    expect(today).not.toBe(sig);
    expect(parseSelection(selectionQuery([0, 9], sig), today, 453)).toBeNull();
    // «Oggi» è relativo: domani l'impronta cambia e la selezione di oggi non vale più.
    expect(filterSignature({ period: "today" }, "2026-11-28")).not.toBe(today);
    expect(filterSignature({ period: "all", stake: "€0,01/€0,02" }, TODAY)).not.toBe(sig);
  });

  it("ignorata se non valida o fuori dalle mani del grafico", () => {
    const q = (sel: string) => new URLSearchParams({ sel }).toString();
    expect(parseSelection(q("0-5"), sig, 10)).toBeNull();
    expect(parseSelection(q("5-3"), sig, 10)).toBeNull();
    expect(parseSelection(q("3-11"), sig, 10)).toBeNull();
    expect(parseSelection(q("a-b"), sig, 10)).toBeNull();
    expect(parseSelection(q("3-10"), sig, 10)).toEqual([2, 9]);
    // Grafico non ancora caricato (0 mani): nessuna selezione, finché i dati non arrivano.
    expect(parseSelection(q("3-10"), sig, 0)).toBeNull();
  });
});

describe("router del Riepilogo", () => {
  it("la query arriva al Riepilogo", () => {
    expect(parseRoute("#/?sel=1-40&f=x")).toEqual({ name: "summary", query: "sel=1-40&f=x" });
    expect(parseRoute("#/")).toEqual({ name: "summary", query: "" });
    expect(parseRoute("")).toEqual({ name: "summary", query: "" });
    expect(parseRoute("#/sconosciuta?sel=1-2")).toEqual({ name: "summary", query: "" });
  });

  it("indirizzi e percorsi normalizzati", () => {
    expect(normalizeHash("")).toBe(normalizeHash("#/"));
    expect(pathOf("#/?sel=1-40")).toBe(pathOf("#/"));
    expect(pathOf("#/mano/123?da=x")).toBe("mano/123");
  });
});
