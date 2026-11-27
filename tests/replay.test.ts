import { describe, expect, it } from "vitest";
import { buildReplay } from "../src/stats/replay";
import { checkReplay, handsOf, oneHand } from "./helpers";

describe("buildReplay — mano d'esempio", () => {
  const hand = oneHand("example.txt");
  const steps = buildReplay(hand);

  it("un passo per ogni evento, nell'ordine del testo", () => {
    expect(steps.map((s) => s.text)).toEqual([
      "6 giocatori al tavolo Testtable I, bottone al posto 5",
      "EpsSix posta lo small blind €0,01",
      "AlphaOne posta il big blind €0,02",
      "Carte distribuite: HeroPlayer ha Ad Kc",
      "BetaTwo rilancia a €0,05",
      "HeroPlayer rilancia a €0,14",
      "GammaFour fa fold",
      "DeltaFive fa fold",
      "EpsSix fa fold",
      "AlphaOne chiama €0,12",
      "BetaTwo fa fold",
      "Flop: Ts 5d 9s",
      "AlphaOne fa check",
      "HeroPlayer punta €0,16",
      "AlphaOne fa fold",
      "€0,16 non chiamati tornano a HeroPlayer",
      "HeroPlayer vince €0,32 (il piatto)",
      "Fine mano · AlphaOne −€0,14, BetaTwo −€0,05, HeroPlayer +€0,18, EpsSix −€0,01 · rake €0,02",
    ]);
  });

  it("il rilancio «a» mette solo la differenza; il flop raccoglie le puntate", () => {
    const hero = (i: number) => steps[i]?.seats.find((s) => s.name === "HeroPlayer");
    expect(hero(5)).toMatchObject({ stack: 199 - 14, bet: 14, action: "rilancia a €0,14" });
    const flop = steps[11];
    expect(flop?.pot).toBe(1 + 14 + 14 + 5);
    expect(flop?.board).toEqual(["Ts", "5d", "9s"]);
    expect(flop?.seats.every((s) => s.bet === 0 && s.action === undefined)).toBe(true);
    expect(steps[10]?.seats.find((s) => s.name === "BetaTwo")?.folded).toBe(true);
  });

  it("carte: l'hero le vede sempre, nessun avversario le mostra", () => {
    for (const s of steps) {
      expect(s.seats.find((x) => x.name === "HeroPlayer")).toMatchObject({ cards: "Ad Kc", revealed: true });
      expect(s.seats.filter((x) => x.name !== "HeroPlayer").every((x) => x.cards === null)).toBe(true);
    }
  });

  it("rispetta gli invarianti", () => checkReplay(hand, steps));
});

describe("buildReplay — side pot e showdown", () => {
  const hand = oneHand("sidepot.txt");
  const steps = buildReplay(hand);

  it("esclude chi è seduto fuori", () => {
    expect(steps[0]?.seats.map((s) => s.name)).toEqual(["HeroPlayer", "Ab9//123", "ShortOne"]);
  });

  it("le carte degli avversari si scoprono solo allo showdown", () => {
    const sd = steps.findIndex((s) => s.phase === "SHOWDOWN");
    expect(steps[sd]?.text).toBe("Showdown: HeroPlayer mostra Ah Ad, Ab9//123 mostra 7c 2d, ShortOne mostra Kc Kd");
    const opp = (i: number) => steps[i]?.seats.find((s) => s.name === "ShortOne");
    expect(opp(sd - 1)).toMatchObject({ cards: "Kc Kd", revealed: false });
    expect(opp(sd)).toMatchObject({ revealed: true });
  });

  it("due vincite dell'hero, all-in segnati, board completo", () => {
    expect(steps.filter((s) => s.text.startsWith("HeroPlayer vince")).map((s) => s.text)).toEqual([
      "HeroPlayer vince €0,95 (il side pot)",
      "HeroPlayer vince €1,43 (il piatto principale)",
    ]);
    expect(steps.find((s) => s.phase === "SHOWDOWN")?.seats.filter((s) => s.allIn).map((s) => s.name)).toEqual([
      "Ab9//123", "ShortOne",
    ]);
    expect(steps.at(-1)?.board).toEqual(["2c", "5h", "9d", "Js", "3h"]);
    expect(steps.at(-1)?.seats.find((s) => s.name === "HeroPlayer")?.won).toBe(238);
  });

  it("rispetta gli invarianti", () => checkReplay(hand, steps));
});

describe("buildReplay — invarianti su tutte le mani sintetiche", () => {
  for (const file of ["example.txt", "sidepot.txt", "headsup.txt", "limp.txt"]) {
    it(file, () => {
      for (const h of handsOf(file)) checkReplay(h, buildReplay(h));
    });
  }

  it("heads-up: il bottone posta lo small blind", () => {
    const [hu] = handsOf("headsup.txt");
    if (!hu) throw new Error("fixture");
    const steps = buildReplay(hu);
    expect(steps[1]?.text).toBe("VillainHU posta lo small blind €0,01");
    expect(steps[1]?.seats.find((s) => s.name === "VillainHU")?.position).toBe("BTN");
  });
});
