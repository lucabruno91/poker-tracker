import { describe, expect, it } from "vitest";
import {
  filterHands, handQuery, matchesCards, pageOf, parseCardsQuery, parseHandQuery, type HandFilter,
} from "../src/stats/handFilters";
import { href, parseRoute } from "../src/ui/router";
import { handsOf } from "./helpers";

const hands = ["example.txt", "sidepot.txt", "headsup.txt", "limp.txt"].flatMap(handsOf);
const ids = (f: Partial<HandFilter>) => filterHands(hands, "HeroPlayer", { sort: "recent", ...f }).map((h) => h.id.slice(-2));
// Mani dell'hero: 01 AKo HJ +18 · 02 AA SB +138 (side pot, showdown, all-in) · 10 QQ BB −200 (showdown, all-in)
// · 11 98s BTN +2 · 12 72o BB +1 · 20 55 CO −2 (limp)

describe("parseCardsQuery", () => {
  it.each([
    ["AK", { ranks: ["A", "K"] }],
    ["ka", { ranks: ["A", "K"] }],
    ["AKs", { ranks: ["A", "K"], suited: "s" }],
    ["kao", { ranks: ["A", "K"], suited: "o" }],
    ["qq", { ranks: ["Q", "Q"] }],
    ["10 9", { ranks: ["T", "9"] }],
  ])("%s", (q, expected) => expect(parseCardsQuery(q)).toEqual(expected));

  it("rifiuta testi non validi", () => {
    for (const q of ["", "A", "AKx", "QQs", "AK7", "ZZ"]) expect(parseCardsQuery(q), q).toBeNull();
  });

  it("confronto con le carte dell'hero", () => {
    const q = (t: string) => parseCardsQuery(t) ?? { ranks: ["X", "X"] as [string, string] };
    expect(matchesCards(q("AK"), "Ad Kc")).toBe(true);
    expect(matchesCards(q("AKs"), "Ad Kc")).toBe(false);
    expect(matchesCards(q("AKo"), "Kc Ad")).toBe(true);
    expect(matchesCards(q("98s"), "9c 8c")).toBe(true);
    expect(matchesCards(q("QQ"), "Qs Qh")).toBe(true);
    expect(matchesCards(q("QQ"), null)).toBe(false);
  });
});

describe("filterHands", () => {
  it("ordine predefinito: dalla più recente", () => {
    expect(ids({})).toEqual(["12", "02", "01", "20", "11", "10"]);
  });

  it("posizione, tipo, risultato, carte", () => {
    expect(ids({ position: "BB" })).toEqual(["12", "10"]);
    expect(ids({ kind: "showdown" })).toEqual(["02", "10"]);
    expect(ids({ kind: "allin" })).toEqual(["02", "10"]);
    expect(ids({ kind: "vpip" })).toEqual(["02", "01", "20", "11", "10"]);
    expect(ids({ result: "won" })).toEqual(["12", "02", "01", "11"]);
    expect(ids({ result: "lost" })).toEqual(["20", "10"]);
    expect(ids({ cards: "ak" })).toEqual(["01"]);
    expect(ids({ cards: "AA" })).toEqual(["02"]);
  });

  it("filtri combinati", () => {
    expect(ids({ position: "BB", result: "lost" })).toEqual(["10"]);
    expect(ids({ kind: "showdown", result: "won", cards: "AA" })).toEqual(["02"]);
  });

  it("una ricerca per carte non valida non esclude nulla", () => {
    expect(ids({ cards: "boh" })).toHaveLength(6);
  });

  it("ordinamenti", () => {
    expect(ids({ sort: "worst" })).toEqual(["10", "20", "12", "11", "01", "02"]);
    expect(ids({ sort: "best" })).toEqual(["02", "01", "11", "12", "20", "10"]);
    expect(ids({ sort: "pot" })[0]).toBe("10");
  });

  it("esclude le mani in cui l'hero non c'è", () => {
    expect(filterHands(hands, "Nessuno", { sort: "recent" })).toEqual([]);
  });
});

describe("query della lista", () => {
  it("andata e ritorno", () => {
    const f: HandFilter = { position: "BB", kind: "allin", result: "lost", cards: "AK", sort: "worst" };
    expect(handQuery(f)).toBe("pos=BB&tipo=allin&esito=perse&carte=AK&ordina=worst");
    expect(parseHandQuery(handQuery(f))).toEqual(f);
    expect(handQuery({ sort: "recent" })).toBe("");
    expect(pageOf(handQuery(f, 3))).toBe(3);
    expect(pageOf("")).toBe(1);
  });

  it("valori non validi ignorati", () => {
    expect(parseHandQuery("pos=XX&tipo=boh&esito=forse&ordina=a")).toEqual({ sort: "recent" });
  });
});

describe("router", () => {
  it("lista con query e mano con la lista di provenienza", () => {
    expect(parseRoute("#/mani?pos=BB&tipo=allin")).toEqual({ name: "hands", query: "pos=BB&tipo=allin" });
    expect(parseRoute("#/mani")).toEqual({ name: "hands", query: "" });
    const link = href.hand("262800000010", "pos=BB&tipo=allin");
    expect(parseRoute(link)).toEqual({ name: "hand", id: "262800000010", from: "pos=BB&tipo=allin" });
    expect(parseRoute(href.hand("262800000010"))).toEqual({ name: "hand", id: "262800000010", from: null });
    expect(parseRoute(href.hand("x", ""))).toEqual({ name: "hand", id: "x", from: "" });
  });
});
