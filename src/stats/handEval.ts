/**
 * Valutatore di mani a 7 carte (Hold'em). Carte come interi 0..51:
 * `rank * 4 + suit`, rank 0 = 2 … 12 = A, suit 0..3.
 * Il punteggio è un intero confrontabile: più alto = mano migliore.
 */

const RANKS = "23456789TJQKA";
const SUITS = "cdhs";

export const Category = {
  HighCard: 0, Pair: 1, TwoPair: 2, Trips: 3, Straight: 4, Flush: 5, FullHouse: 6, Quads: 7, StraightFlush: 8,
} as const;
export type Category = (typeof Category)[keyof typeof Category];

/** "Ah" → 50. Lancia un errore se la carta non è valida. */
export function parseCard(text: string): number {
  const r = RANKS.indexOf(text[0] ?? "");
  const s = SUITS.indexOf(text[1] ?? "");
  if (r < 0 || s < 0 || text.length !== 2) throw new Error(`Carta non valida: "${text}"`);
  return r * 4 + s;
}

export function parseCards(text: string): number[] {
  return text.trim() ? text.trim().split(/\s+/).map(parseCard) : [];
}

/** Rango più alto di una scala nella maschera dei ranghi (A può valere 1), o −1. */
function straightTop(mask: number): number {
  // Bit i+1 = rango i; bit 0 = asso basso.
  const ext = (mask << 1) | ((mask >> 12) & 1);
  for (let top = 13; top >= 4; top--) {
    if (((ext >> (top - 4)) & 0x1f) === 0x1f) return top - 1;
  }
  return -1;
}

/** I `n` ranghi più alti presenti nella maschera, dal più alto. */
function topRanks(mask: number, n: number, out: number[]): void {
  for (let r = 12; r >= 0 && out.length < n; r--) if (mask & (1 << r)) out.push(r);
}

function score(category: number, ranks: number[]): number {
  let s = category;
  for (let i = 0; i < 5; i++) s = s * 16 + (ranks[i] ?? 0);
  return s;
}

const counts = new Int8Array(13);
const suitMasks = new Int32Array(4);
const suitCounts = new Int8Array(4);

/** Punteggio della migliore mano di 5 carte tra quelle date (5–7 carte). */
export function evaluate(cards: ArrayLike<number>): number {
  counts.fill(0);
  suitMasks.fill(0);
  suitCounts.fill(0);
  let rankMask = 0;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i] as number;
    const r = c >> 2;
    const s = c & 3;
    counts[r]!++;
    suitMasks[s]! |= 1 << r;
    suitCounts[s]!++;
    rankMask |= 1 << r;
  }

  // Colore e scala colore.
  let flushMask = 0;
  for (let s = 0; s < 4; s++) if (suitCounts[s]! >= 5) flushMask = suitMasks[s]!;
  if (flushMask) {
    const sf = straightTop(flushMask);
    if (sf >= 0) return score(Category.StraightFlush, [sf]);
  }

  // Raggruppamenti per numero di carte uguali, dal rango più alto.
  let quad = -1;
  const trips: number[] = [];
  const pairs: number[] = [];
  for (let r = 12; r >= 0; r--) {
    const n = counts[r]!;
    if (n === 4) quad = r;
    else if (n === 3) trips.push(r);
    else if (n === 2) pairs.push(r);
  }

  if (quad >= 0) {
    const k: number[] = [];
    topRanks(rankMask & ~(1 << quad), 1, k);
    return score(Category.Quads, [quad, ...k]);
  }
  const t0 = trips[0];
  if (t0 !== undefined && (trips.length > 1 || pairs.length > 0)) {
    // Con due tris, il secondo fa da coppia.
    const pair = Math.max(trips[1] ?? -1, pairs[0] ?? -1);
    return score(Category.FullHouse, [t0, pair]);
  }
  if (flushMask) {
    const f: number[] = [];
    topRanks(flushMask, 5, f);
    return score(Category.Flush, f);
  }
  const st = straightTop(rankMask);
  if (st >= 0) return score(Category.Straight, [st]);
  if (t0 !== undefined) {
    const k: number[] = [];
    topRanks(rankMask & ~(1 << t0), 2, k);
    return score(Category.Trips, [t0, ...k]);
  }
  const p0 = pairs[0];
  const p1 = pairs[1];
  if (p0 !== undefined && p1 !== undefined) {
    const k: number[] = [];
    topRanks(rankMask & ~(1 << p0) & ~(1 << p1), 1, k);
    return score(Category.TwoPair, [p0, p1, ...k]);
  }
  if (p0 !== undefined) {
    const k: number[] = [];
    topRanks(rankMask & ~(1 << p0), 3, k);
    return score(Category.Pair, [p0, ...k]);
  }
  const h: number[] = [];
  topRanks(rankMask, 5, h);
  return score(Category.HighCard, h);
}

/** Categoria di un punteggio. */
export function categoryOf(scoreValue: number): Category {
  return Math.floor(scoreValue / 16 ** 5) as Category;
}

export interface EquityResult {
  /** Probabilità di vincere l'intero piatto, con i pareggi contati a metà. */
  equity: number;
  wins: number;
  ties: number;
  boards: number;
}

/**
 * Equity esatta di `hero` contro `villain` con il board noto: enumera tutte le
 * carte mancanti al board (0–5). Funzione pura e deterministica.
 */
export function headsUpEquity(hero: number[], villain: number[], board: number[]): EquityResult {
  const used = new Set([...hero, ...villain, ...board]);
  if (used.size !== hero.length + villain.length + board.length) throw new Error("Carte ripetute");
  const deck: number[] = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c);

  const need = 5 - board.length;
  const h = new Int32Array(7);
  const v = new Int32Array(7);
  h[0] = hero[0]!; h[1] = hero[1]!;
  v[0] = villain[0]!; v[1] = villain[1]!;
  board.forEach((c, i) => { h[2 + i] = c; v[2 + i] = c; });

  let wins = 0;
  let ties = 0;
  let boards = 0;
  const pos = 2 + board.length;
  const n = deck.length;

  const run = () => {
    const a = evaluate(h);
    const b = evaluate(v);
    boards++;
    if (a > b) wins++;
    else if (a === b) ties++;
  };

  // Combinazioni senza ripetizione di `need` carte dal mazzo (need ≤ 5).
  const rec = (k: number, start: number) => {
    if (k === need) { run(); return; }
    for (let i = start; i <= n - (need - k); i++) {
      const c = deck[i]!;
      h[pos + k] = c;
      v[pos + k] = c;
      rec(k + 1, i + 1);
    }
  };
  rec(0, 0);

  return { equity: (wins + ties / 2) / boards, wins, ties, boards };
}
