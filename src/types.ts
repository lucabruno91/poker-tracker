/** Importi in centesimi interi. Mai sommare denaro in virgola mobile. */
export type Cents = number;

export type Street = "PRE" | "FLOP" | "TURN" | "RIVER";

export type ActionKind = "fold" | "check" | "call" | "bet" | "raise";

export interface Action {
  street: Street;
  player: string;
  kind: ActionKind;
  /** call/bet: importo aggiuntivo; raise: totale della strada ("to"). */
  amount?: Cents;
  allIn?: boolean;
}

/** "EP" solo per tavoli con più di 6 giocatori (non previsti, ma gestiti). */
export type Position = "UTG" | "HJ" | "CO" | "BTN" | "SB" | "BB" | "EP";

export interface Player {
  seat: number;
  name: string;
  stack: Cents;
}

export interface Hand {
  id: string;
  table: string;
  maxSeats: number;
  /** Ora locale del sito, "2026-11-25T12:16:12". */
  playedAt: string;
  sb: Cents;
  bb: Cents;
  buttonSeat: number;
  /** Solo i giocatori nella mano (esclusi quelli "is sitting out"). */
  players: Player[];
  positions: Record<string, Position>;
  heroName: string | null;
  heroCards: string | null;
  board: string[];
  actions: Action[];
  net: Record<string, Cents>;
  /** Soldi messi nel piatto da ogni giocatore, al netto delle restituzioni. */
  invested: Record<string, Cents>;
  /** Piatto totale (somma di `invested`, rake compreso). */
  pot: Cents;
  sawFlop: boolean;
  showdown: string[];
  winners: string[];
  rake: Cents;
  raw: string;
}

export interface Counters {
  hands: number;
  vpip: number;
  pfr: number;
  limp: number;
  threeBet: number;
  threeBetOpp: number;
  foldTo3Bet: number;
  foldTo3BetOpp: number;
  flops: number;
  wtsd: number;
  wsd: number;
  cbet: number;
  cbetOpp: number;
  aggr: number;
  calls: number;
  net: Cents;
}

export interface Session {
  /** `${table}|${date}` */
  id: string;
  table: string;
  /** "2026-11-25" */
  date: string;
  handIds: string[];
  heroStart: Cents;
  heroEnd: Cents;
  rebuys: Cents;
  net: Cents;
  hero: Counters;
  summary?: string;
  /** Incoerenze trovate nel calcolo degli stack (es. stack sceso tra due mani). */
  issues?: string[];
}

export const LABELS = [
  "Regular forte",
  "Regular medio",
  "Regular con leak",
  "Roccia",
  "Ibrido / bot",
  "Fish",
  "Balena",
] as const;

export type Label = (typeof LABELS)[number];

export interface PlayerProfile {
  name: string;
  label?: Label;
  note?: string;
  claudeLabel?: Label;
  claudeNote?: string;
}
