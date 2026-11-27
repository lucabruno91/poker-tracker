import type { Cents, Hand, Street } from "../types";
import { headsUpEquity, parseCards } from "./handEval";
import { shownCards } from "./players";

/** Carte del board già note per strada dell'ultima azione. */
const KNOWN_BOARD: Record<Street, number> = { PRE: 0, FLOP: 3, TURN: 4, RIVER: 5 };

export interface AllInSpot {
  handId: string;
  opponent: string;
  heroCards: string;
  opponentCards: string;
  /** Board noto al momento dell'all-in. */
  board: string[];
  street: Street;
}

export type AllInKind =
  | { kind: "spot"; spot: AllInSpot }
  /** All-in prima del river con più di due giocatori allo showdown: escluso. */
  | { kind: "multiway" }
  | { kind: "none" };

/**
 * Classifica una mano per l'all-in EV (SPEC §6.11). Una mano è uno «spot» se:
 * l'hero arriva allo showdown con esattamente un avversario, le carte di
 * entrambi sono note, almeno un'azione è all-in e l'ultima azione di gioco
 * avviene prima del river. Funzione pura.
 */
export function classifyAllIn(hand: Hand, hero: string): AllInKind {
  if (!hand.showdown.includes(hero)) return { kind: "none" };
  const last = hand.actions[hand.actions.length - 1];
  if (!last || last.street === "RIVER") return { kind: "none" };
  if (!hand.actions.some((a) => a.allIn)) return { kind: "none" };
  if (hand.showdown.length > 2) return { kind: "multiway" };
  const opponent = hand.showdown.find((n) => n !== hero);
  if (!opponent || hand.heroName !== hero || !hand.heroCards) return { kind: "none" };
  const opponentCards = shownCards(hand, opponent);
  if (!opponentCards) return { kind: "none" };
  return {
    kind: "spot",
    spot: {
      handId: hand.id,
      opponent,
      heroCards: hand.heroCards,
      opponentCards,
      board: hand.board.slice(0, KNOWN_BOARD[last.street]),
      street: last.street,
    },
  };
}

/** Equity esatta dell'hero nello spot (pareggi a metà). */
export function spotEquity(spot: AllInSpot): number {
  return headsUpEquity(parseCards(spot.heroCards), parseCards(spot.opponentCards), parseCards(spot.board.join(" ")))
    .equity;
}

/**
 * Risultato atteso dell'hero: equity × (piatto − rake) − investito.
 * In centesimi, non arrotondato (è un valore atteso).
 */
export function expectedNet(hand: Hand, hero: string, equity: number): number {
  const invested: Cents = hand.invested[hero] ?? 0;
  return equity * (hand.pot - hand.rake) - invested;
}
