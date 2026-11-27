/** Mazzo a quattro colori: semi, colori e nomi accessibili delle carte. */

/** Fondo chiaro delle carte (= --paper): i colori dei semi sono scelti per questo fondo. */
export const CARD_BG = "#F1E8D6";

/**
 * Seme → simbolo, nome e colore. U+FE0E chiede la versione testuale del
 * simbolo: senza, alcuni sistemi mostrano ♥ come emoji e ignorano il colore.
 */
export const SUITS = {
  h: { symbol: "♥︎", name: "cuori", color: "#B3261E" }, // rosso
  d: { symbol: "♦︎", name: "quadri", color: "#1F5FA8" }, // blu
  c: { symbol: "♣︎", name: "fiori", color: "#17693C" }, // verde
  s: { symbol: "♠︎", name: "picche", color: "#14181C" }, // nero
} as const;

export type SuitKey = keyof typeof SUITS;

const RANK_NAMES: Record<string, string> = {
  A: "asso", K: "re", Q: "donna", J: "fante", T: "dieci",
  "9": "nove", "8": "otto", "7": "sette", "6": "sei", "5": "cinque", "4": "quattro", "3": "tre", "2": "due",
};

export function isSuit(x: string): x is SuitKey {
  return x === "h" || x === "d" || x === "c" || x === "s";
}

/** Rango come si mostra: "T" diventa "10". */
export function rankLabel(rank: string): string {
  return rank === "T" ? "10" : rank;
}

/** "Ah" → "asso di cuori"; testo non riconosciuto → restituito com'è. */
export function describeCard(card: string): string {
  const rank = RANK_NAMES[card[0] ?? ""];
  const suit = card[1] ?? "";
  if (!rank || !isSuit(suit) || card.length !== 2) return card;
  return `${rank} di ${SUITS[suit].name}`;
}

/** Contrasto WCAG tra due colori "#rrggbb". */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
