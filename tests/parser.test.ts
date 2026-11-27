import { describe, expect, it } from "vitest";
import { toCents } from "../src/parser/money";
import { splitHands } from "../src/parser/splitHands";
import { netImbalance, parseHand } from "../src/parser/parseHand";
import { handsOf, oneHand, readFixture } from "./helpers";

describe("toCents", () => {
  it.each([
    ["0.07", 7], ["2", 200], ["1.5", 150], ["3.17", 317], ["€0.01", 1], ["0", 0], ["141.99", 14199],
  ])("%s → %i", (text, cents) => expect(toCents(text)).toBe(cents));

  it("rifiuta importi non validi", () => {
    expect(() => toCents("0,07")).toThrow();
    expect(() => toCents("abc")).toThrow();
  });
});

describe("splitHands", () => {
  it("gestisce BOM, CRLF e righe vuote in eccesso", () => {
    const text = readFixture("headsup.txt");
    const crlf = "﻿\r\n" + text.replace(/\n/g, "\r\n") + "\r\n\r\n\r\n\r\n";
    const blocks = splitHands(crlf);
    expect(blocks).toHaveLength(3);
    for (const b of blocks) {
      expect(b.startsWith("PokerStars Hand #")).toBe(true);
      expect(b).not.toContain("\r");
      expect(b.endsWith("\n")).toBe(false);
    }
  });
});

describe("parseHand — mano d'esempio (SPEC §4.2)", () => {
  const h = oneHand("example.txt");

  it("legge intestazione, tavolo e giocatori", () => {
    expect(h.id).toBe("262800000001");
    expect(h.table).toBe("Testtable I");
    expect(h.maxSeats).toBe(6);
    expect(h.playedAt).toBe("2026-11-25T12:16:12");
    expect(h.sb).toBe(1);
    expect(h.bb).toBe(2);
    expect(h.buttonSeat).toBe(5);
    expect(h.players).toHaveLength(6);
    expect(h.players[0]).toEqual({ seat: 1, name: "AlphaOne", stack: 85 });
    expect(h.heroName).toBe("HeroPlayer");
    expect(h.heroCards).toBe("Ad Kc");
    expect(h.board).toEqual(["Ts", "5d", "9s"]);
    expect(h.sawFlop).toBe(true);
    expect(h.rake).toBe(2);
    expect(h.showdown).toEqual([]);
    expect(h.winners).toEqual(["HeroPlayer"]);
  });

  it("calcola il netto di ogni giocatore", () => {
    expect(h.net).toEqual({
      AlphaOne: -14, BetaTwo: -5, HeroPlayer: 18, GammaFour: 0, DeltaFive: 0, EpsSix: -1,
    });
    expect(netImbalance(h)).toBe(0);
    expect(h.invested.HeroPlayer).toBe(14);
    expect(h.pot).toBe(34);
  });

  it("registra le azioni con la strada e il totale dei rilanci", () => {
    expect(h.actions[0]).toEqual({ street: "PRE", player: "BetaTwo", kind: "raise", amount: 5 });
    expect(h.actions.find((a) => a.street === "FLOP" && a.kind === "bet")).toEqual({
      street: "FLOP", player: "HeroPlayer", kind: "bet", amount: 16,
    });
    expect(h.actions.filter((a) => a.street === "PRE")).toHaveLength(7);
  });

  it("assegna le posizioni a 6 giocatori", () => {
    expect(h.positions).toEqual({
      EpsSix: "SB", AlphaOne: "BB", DeltaFive: "BTN", GammaFour: "CO", HeroPlayer: "HJ", BetaTwo: "UTG",
    });
  });

  it("conserva il testo originale", () => {
    expect(h.raw.startsWith("PokerStars Hand #262800000001")).toBe(true);
    expect(h.raw.endsWith("folded before Flop")).toBe(true);
  });
});

describe("parseHand — side pot, seduto fuori, nomi speciali", () => {
  const text = splitHands(readFixture("sidepot.txt"))[0] ?? "";
  const r = parseHand(text);
  if (!r.ok) throw new Error(r.reason);
  const h = r.hand;

  it("somma più righe collected e calcola i netti", () => {
    expect(h.net).toEqual({ HeroPlayer: 138, "Ab9//123": -50, ShortOne: -100 });
    expect(h.rake).toBe(12);
    expect(netImbalance(h)).toBe(0);
  });

  it("esclude chi è seduto fuori", () => {
    expect(h.players.map((p) => p.name)).toEqual(["HeroPlayer", "Ab9//123", "ShortOne"]);
    expect(h.positions).not.toHaveProperty("SitterX");
  });

  it("legge i nomi con caratteri speciali", () => {
    expect(h.positions["Ab9//123"]).toBe("BB");
    expect(h.actions.some((a) => a.player === "Ab9//123" && a.kind === "raise" && a.allIn)).toBe(true);
  });

  it("legge showdown, vincitori e board completo", () => {
    expect(h.showdown).toEqual(["HeroPlayer", "Ab9//123", "ShortOne"]);
    expect(h.winners).toEqual(["HeroPlayer"]);
    expect(h.board).toEqual(["2c", "5h", "9d", "Js", "3h"]);
  });

  it("posizioni a 3 giocatori", () => {
    expect(h.positions).toEqual({ HeroPlayer: "SB", "Ab9//123": "BB", ShortOne: "BTN" });
  });

  it("ignora le righe note e segnala solo quelle sconosciute", () => {
    expect(r.unknownLines).toEqual(["Something completely unexpected happened"]);
  });
});

describe("parseHand — heads-up", () => {
  const [a, b] = handsOf("headsup.txt");

  it("il bottone posta lo small blind", () => {
    expect(a?.positions).toEqual({ VillainHU: "BTN", HeroPlayer: "BB" });
    expect(b?.positions).toEqual({ HeroPlayer: "BTN", VillainHU: "BB" });
  });

  it("netti corretti con all-in e restituzioni", () => {
    expect(a?.net).toEqual({ HeroPlayer: -200, VillainHU: 190 });
    expect(b?.net).toEqual({ HeroPlayer: 2, VillainHU: -2 });
  });
});

describe("parseHand — mani da scartare", () => {
  it("scarta intestazioni non in inglese o non cash NLHE", () => {
    const results = splitHands(readFixture("rejected.txt")).map(parseHand);
    expect(results).toHaveLength(2);
    for (const r of results) expect(r.ok).toBe(false);
  });
});

describe("coerenza: Σ net = −rake su tutte le fixture sintetiche", () => {
  for (const file of ["example.txt", "sidepot.txt", "headsup.txt", "limp.txt"]) {
    it(file, () => {
      for (const h of handsOf(file)) expect(netImbalance(h), h.id).toBe(0);
    });
  }
});
