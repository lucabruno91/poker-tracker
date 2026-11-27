import {
  BLIND_RE, CALL_BET_RE, COLLECTED_RE, DEALT_RE, FOLD_CHECK_RE, RAISE_RE, STREET_RE, UNCALLED_RE,
} from "../parser/parseHand";
import { toCents } from "../parser/money";
import { normalizeText } from "../parser/splitHands";
import type { Cents, Hand, Position } from "../types";
import { shownCards } from "./players";

export type ReplayPhase = "SETUP" | "PRE" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN" | "END";

export interface SeatState {
  seat: number;
  name: string;
  position?: Position;
  /** Chips dietro, non ancora puntate. */
  stack: Cents;
  /** Puntato nella strada corrente (davanti al posto). */
  bet: Cents;
  folded: boolean;
  allIn: boolean;
  /** Carte note: dell'hero, o degli avversari se mostrate a fine mano. */
  cards: string | null;
  /** Le carte sono scoperte a questo passo (hero sempre; avversari dallo showdown). */
  revealed: boolean;
  /** Ultima azione nella strada corrente, es. "rilancia a €0,14". */
  action?: string;
  /** Vinto in questa mano (somma dei `collected`). */
  won: Cents;
}

export interface ReplayStep {
  phase: ReplayPhase;
  /** Descrizione in italiano. */
  text: string;
  /** Giocatore che agisce a questo passo. */
  actor?: string;
  board: string[];
  /** Chips già al centro (strade precedenti). */
  pot: Cents;
  /** Rake già prelevato (solo dopo le vincite). */
  rake: Cents;
  seats: SeatState[];
}

const euro = (c: Cents) => `€${Math.floor(c / 100)},${String(c % 100).padStart(2, "0")}`;
const STREET_NAME = { FLOP: "Flop", TURN: "Turn", RIVER: "River" } as const;
const POT_NAME = (from: string) =>
  from === "pot" ? "il piatto" : from === "main pot" ? "il piatto principale" : "il side pot";

/**
 * Passi del replay di una mano (SPEC §6.12): rilegge il testo originale con le
 * stesse espressioni del parser. Invarianti: a ogni passo
 * Σ stack + Σ puntate + piatto + rake = totale iniziale; all'ultimo passo ogni
 * stack = stack iniziale + netto. Funzione pura.
 */
export function buildReplay(hand: Hand): ReplayStep[] {
  const seats: SeatState[] = hand.players.map((p) => ({
    seat: p.seat,
    name: p.name,
    position: hand.positions[p.name],
    stack: p.stack,
    bet: 0,
    folded: false,
    allIn: false,
    cards: p.name === hand.heroName ? hand.heroCards : shownCards(hand, p.name),
    revealed: p.name === hand.heroName,
    won: 0,
  }));
  const byName = new Map(seats.map((s) => [s.name, s]));
  let phase: ReplayPhase = "SETUP";
  let board: string[] = [];
  let pot: Cents = 0;
  let rake: Cents = 0;
  const steps: ReplayStep[] = [];

  const snapshot = (text: string, actor?: string) => {
    const step: ReplayStep = {
      phase, text, board: [...board], pot, rake,
      seats: seats.map((s) => ({ ...s })),
    };
    if (actor) step.actor = actor;
    steps.push(step);
  };
  /** Le puntate davanti ai posti vanno al centro. */
  const gatherBets = () => {
    for (const s of seats) {
      pot += s.bet;
      s.bet = 0;
      delete s.action;
    }
  };
  const put = (s: SeatState, amount: Cents) => {
    s.stack -= amount;
    s.bet += amount;
    if (s.stack <= 0) s.allIn = true;
  };

  snapshot(`${seats.length} giocatori al tavolo ${hand.table}, bottone al posto ${hand.buttonSeat}`);

  const lines = normalizeText(hand.raw).split("\n").map((l) => l.trimEnd());
  for (const line of lines.slice(2)) {
    const street = STREET_RE.exec(line);
    if (street) {
      const name = street[1];
      if (name === "HOLE CARDS") {
        phase = "PRE";
        continue;
      }
      if (name === "FLOP" || name === "TURN" || name === "RIVER") {
        gatherBets();
        phase = name;
        const cards = [...(street[2] ?? "").matchAll(/\[([^\]]+)\]/g)].flatMap((m) => (m[1] ?? "").split(" "));
        const fresh = cards.slice(board.length);
        board = cards;
        snapshot(`${STREET_NAME[name]}: ${fresh.join(" ")}`);
        continue;
      }
      if (name === "SHOW DOWN") {
        gatherBets();
        phase = "SHOWDOWN";
        const shown: string[] = [];
        for (const s of seats) {
          if (hand.showdown.includes(s.name) && s.cards) {
            s.revealed = true;
            shown.push(`${s.name} mostra ${s.cards}`);
          }
        }
        snapshot(`Showdown${shown.length ? `: ${shown.join(", ")}` : ""}`);
        continue;
      }
      break; // SUMMARY: fine delle azioni.
    }

    const blind = BLIND_RE.exec(line);
    if (blind) {
      const s = byName.get(blind[1] ?? "");
      if (!s) continue;
      const amount = toCents(blind[3] ?? "");
      if (blind[2] === "small & big blinds") {
        // La parte di small blind è morta: va direttamente al centro.
        const live = Math.min(amount, hand.bb);
        put(s, live);
        s.stack -= amount - live;
        pot += amount - live;
        s.action = `small e big blind ${euro(amount)}`;
        snapshot(`${s.name} posta small e big blind ${euro(amount)}`, s.name);
      } else {
        put(s, amount);
        const which = blind[2] === "small blind" ? "lo small blind" : "il big blind";
        s.action = blind[2] === "small blind" ? "small blind" : "big blind";
        snapshot(`${s.name} posta ${which} ${euro(amount)}`, s.name);
      }
      continue;
    }

    if (DEALT_RE.test(line)) {
      snapshot(hand.heroName && hand.heroCards ? `Carte distribuite: ${hand.heroName} ha ${hand.heroCards}` : "Carte distribuite");
      continue;
    }

    const fc = FOLD_CHECK_RE.exec(line);
    if (fc) {
      const s = byName.get(fc[1] ?? "");
      if (!s) continue;
      if (fc[2] === "folds") {
        s.folded = true;
        s.action = "fold";
        snapshot(`${s.name} fa fold`, s.name);
      } else {
        s.action = "check";
        snapshot(`${s.name} fa check`, s.name);
      }
      continue;
    }

    const cb = CALL_BET_RE.exec(line);
    if (cb) {
      const s = byName.get(cb[1] ?? "");
      if (!s) continue;
      const amount = toCents(cb[3] ?? "");
      put(s, amount);
      if (cb[4]) s.allIn = true;
      const verb = cb[2] === "calls" ? "chiama" : "punta";
      s.action = `${verb} ${euro(amount)}${s.allIn ? " (all-in)" : ""}`;
      snapshot(`${s.name} ${verb} ${euro(amount)}${cb[4] ? " ed è all-in" : ""}`, s.name);
      continue;
    }

    const rs = RAISE_RE.exec(line);
    if (rs) {
      const s = byName.get(rs[1] ?? "");
      if (!s) continue;
      const to = toCents(rs[3] ?? "");
      put(s, to - s.bet);
      if (rs[4]) s.allIn = true;
      s.action = `rilancia a ${euro(to)}${s.allIn ? " (all-in)" : ""}`;
      snapshot(`${s.name} rilancia a ${euro(to)}${rs[4] ? " ed è all-in" : ""}`, s.name);
      continue;
    }

    const unc = UNCALLED_RE.exec(line);
    if (unc) {
      const s = byName.get(unc[2] ?? "");
      if (!s) continue;
      const amount = toCents(unc[1] ?? "");
      const fromBet = Math.min(amount, s.bet);
      s.bet -= fromBet;
      pot -= amount - fromBet;
      s.stack += amount;
      if (s.stack > 0) s.allIn = false;
      snapshot(`${euro(amount)} non chiamati tornano a ${s.name}`, s.name);
      continue;
    }

    const col = COLLECTED_RE.exec(line);
    if (col) {
      const s = byName.get(col[1] ?? "");
      if (!s) continue;
      gatherBets(); // mano finita senza showdown: le puntate vanno al centro.
      const amount = toCents(col[2] ?? "");
      const from = /from (.+)$/.exec(line)?.[1] ?? "pot";
      pot -= amount;
      s.stack += amount;
      s.won += amount;
      s.action = `vince ${euro(amount)}`;
      snapshot(`${s.name} vince ${euro(amount)} (${POT_NAME(from)})`, s.name);
    }
  }

  // Fine: quello che resta al centro è il rake.
  gatherBets();
  rake += pot;
  pot = 0;
  phase = "END";
  for (const s of seats) delete s.action;
  const results = seats
    .filter((s) => (hand.net[s.name] ?? 0) !== 0)
    .map((s) => {
      const n = hand.net[s.name] ?? 0;
      return `${s.name} ${n > 0 ? "+" : "−"}${euro(Math.abs(n))}`;
    });
  snapshot(`Fine mano${results.length ? ` · ${results.join(", ")}` : ""}${rake ? ` · rake ${euro(rake)}` : ""}`);
  return steps;
}

/** Totale delle chips a un passo (deve restare uguale al totale iniziale). */
export function chipsInPlay(step: ReplayStep): Cents {
  return step.seats.reduce((a, s) => a + s.stack + s.bet, 0) + step.pot + step.rake;
}
