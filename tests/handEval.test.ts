import { describe, expect, it } from "vitest";
import { Category, categoryOf, evaluate, headsUpEquity, parseCard, parseCards } from "../src/stats/handEval";

const ev = (s: string) => evaluate(parseCards(s));

describe("parseCard", () => {
  it("codifica rango e seme", () => {
    expect(parseCard("2c")).toBe(0);
    expect(parseCard("As")).toBe(51);
    expect(parseCard("Th")).toBe(8 * 4 + 2);
    expect(() => parseCard("1h")).toThrow();
    expect(() => parseCard("Ax")).toThrow();
  });
});

describe("evaluate — categorie", () => {
  it.each([
    ["9h Th Jh Qh Kh 2c 3d", Category.StraightFlush],
    ["Ah 2h 3h 4h 5h Kc Kd", Category.StraightFlush],
    ["Kc Kd Kh Ks 2c 3d 4h", Category.Quads],
    ["Kc Kd Kh 2s 2c 3d 4h", Category.FullHouse],
    ["Kc Kd Kh 2s 2c 2d 4h", Category.FullHouse],
    ["Ah 9h 7h 4h 2h Kc Kd", Category.Flush],
    ["9c Td Jh Qs Kh 2c 2d", Category.Straight],
    ["Ac 2d 3h 4s 5h Kc Qd", Category.Straight],
    ["Kc Kd Kh 2s 3c 7d 9h", Category.Trips],
    ["Kc Kd 2h 2s 3c 7d 9h", Category.TwoPair],
    ["Kc Kd 2h 4s 3c 7d 9h", Category.Pair],
    ["Ac Kd 2h 4s 3c 7d 9h", Category.HighCard],
  ])("%s", (cards, cat) => expect(categoryOf(ev(cards))).toBe(cat));
});

describe("evaluate — confronti", () => {
  it("scala più alta batte la ruota; la ruota è la scala più bassa", () => {
    expect(ev("2c 3d 4h 5s 6h Kc Qd")).toBeGreaterThan(ev("Ac 2d 3h 4s 5h Kc Qd"));
  });

  it("kicker e seconda coppia", () => {
    expect(ev("Ac Ad Kh 7s 3c 2d 9h")).toBeGreaterThan(ev("Ac Ad Qh 7s 3c 2d 9h"));
    expect(ev("Ac Ad Kh Ks 3c 2d 9h")).toBeGreaterThan(ev("Ac Ad Qh Qs 3c 2d 9h"));
    // Tre coppie: conta la migliore quinta carta.
    expect(ev("Ac Ad Kh Ks 3c 3d 9h")).toBe(ev("Ac Ad Kh Ks 9c 2d 4h"));
  });

  it("full: con due tris il secondo fa da coppia", () => {
    expect(ev("Kc Kd Kh 2s 2c 2d 4h")).toBe(ev("Kc Kd Kh 2s 2c 5d 4h"));
  });

  it("colore: contano le 5 carte più alte del seme", () => {
    expect(ev("Ah Kh 7h 4h 2h 3h Qc")).toBeGreaterThan(ev("Ah Qh 7h 4h 3h 2h Qc"));
  });

  it("board che gioca: pareggio", () => {
    expect(ev("2c 3d Ah Kh Qh Jh Th")).toBe(ev("4c 5d Ah Kh Qh Jh Th"));
  });
});

/** Valutatore di riferimento, volutamente ingenuo: migliore delle 21 mani da 5 carte. */
function naive5(c: number[]): number[] {
  const ranks = c.map((x) => x >> 2).sort((a, b) => b - a);
  const flush = c.every((x) => (x & 3) === (c[0]! & 3));
  const uniq = [...new Set(ranks)];
  let straight = -1;
  if (uniq.length === 5 && uniq[0]! - uniq[4]! === 4) straight = uniq[0]!;
  if (uniq.join() === "12,3,2,1,0") straight = 3;
  const groups = uniq
    .map((r) => [ranks.filter((x) => x === r).length, r] as [number, number])
    .sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const byGroup = groups.map((g) => g[1]);
  const shape = groups.map((g) => g[0]).join("");
  if (straight >= 0 && flush) return [8, straight];
  if (shape === "41") return [7, ...byGroup];
  if (shape === "32") return [6, ...byGroup];
  if (flush) return [5, ...ranks];
  if (straight >= 0) return [4, straight];
  if (shape === "311") return [3, ...byGroup];
  if (shape === "221") return [2, ...byGroup];
  if (shape === "2111") return [1, ...byGroup];
  return [0, ...ranks];
}
function cmp(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}
function naive7(c: number[]): number[] {
  let best: number[] = [-1];
  for (let i = 0; i < 7; i++)
    for (let j = i + 1; j < 7; j++) {
      const five = c.filter((_, k) => k !== i && k !== j);
      const s = naive5(five);
      if (cmp(s, best) > 0) best = s;
    }
  return best;
}

describe("evaluate — confronto con un valutatore di riferimento", () => {
  it("stesso ordinamento su 20.000 coppie di mani casuali (seme fisso)", () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const deal = (n: number) => {
      const deck = Array.from({ length: 52 }, (_, i) => i);
      for (let i = 51; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [deck[i], deck[j]] = [deck[j]!, deck[i]!];
      }
      return deck.slice(0, n);
    };
    let mismatches = 0;
    for (let t = 0; t < 20000; t++) {
      const cards = deal(9);
      const board = cards.slice(4);
      const a = [cards[0]!, cards[1]!, ...board];
      const b = [cards[2]!, cards[3]!, ...board];
      if (Math.sign(evaluate(a) - evaluate(b)) !== cmp(naive7(a), naive7(b))) mismatches++;
      if (categoryOf(evaluate(a)) !== naive7(a)[0]) mismatches++;
    }
    expect(mismatches).toBe(0);
  }, 60_000);
});

describe("headsUpEquity", () => {
  it("al turn: 15 outs su 44 carte", () => {
    // AhKh contro QsQd, board 2h 7h 9c 3s: 9 cuori, 3 assi, 3 re.
    const r = headsUpEquity(parseCards("Ah Kh"), parseCards("Qs Qd"), parseCards("2h 7h 9c 3s"));
    expect(r.boards).toBe(44);
    expect(r.wins).toBe(15);
    expect(r.ties).toBe(0);
    expect(r.equity).toBe(15 / 44);
  });

  it("al river: nessuna carta da girare", () => {
    const r = headsUpEquity(parseCards("Ah Kh"), parseCards("Qs Qd"), parseCards("2h 7h 9c 3s 5h"));
    expect(r).toEqual({ equity: 1, wins: 1, ties: 0, boards: 1 });
  });

  it("pareggio contato a metà", () => {
    const r = headsUpEquity(parseCards("2c 3d"), parseCards("2d 3c"), parseCards("Ah Kh Qh Jh"));
    // Il board gioca quasi sempre; vince solo chi chiude colore a cuori? Nessuno ha cuori: sempre pari.
    expect(r.equity).toBe(0.5);
  });

  it("al flop: conteggio esatto e simmetria", () => {
    // 99 (set) contro AA su 9c 5h 2d. AA vince con:
    // - almeno un asso (Ad, As) al turn/river: 1 + 2×43 = 87 combinazioni, meno le 2 con il 9h (poker di 9) = 85;
    // - scala alla ruota con un 3 e un 4: 4×4 = 16.
    // Totale 101 su 990: il 99 vince 889.
    const a = headsUpEquity(parseCards("9s 9d"), parseCards("Ah Ac"), parseCards("9c 5h 2d"));
    const b = headsUpEquity(parseCards("Ah Ac"), parseCards("9s 9d"), parseCards("9c 5h 2d"));
    expect(a).toMatchObject({ boards: 990, wins: 889, ties: 0 });
    expect(b).toMatchObject({ boards: 990, wins: 101, ties: 0 });
    expect(a.equity + b.equity).toBeCloseTo(1, 12);
  });

  it("preflop: AA contro KK", () => {
    const t0 = performance.now();
    const r = headsUpEquity(parseCards("Ah Ad"), parseCards("Kc Ks"), []);
    const ms = performance.now() - t0;
    expect(r.boards).toBe(1712304);
    expect(r.equity).toBeGreaterThan(0.81);
    expect(r.equity).toBeLessThan(0.83);
    console.log(`preflop AA vs KK: ${(r.equity * 100).toFixed(2)}% in ${ms.toFixed(0)} ms`);
  }, 60_000);

  it("rifiuta carte ripetute", () => {
    expect(() => headsUpEquity(parseCards("Ah Kh"), parseCards("Ah Qd"), [])).toThrow();
  });
});
