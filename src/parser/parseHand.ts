import type { Action, Cents, Hand, Player, Street } from "../types";
import { toCents } from "./money";
import { normalizeText } from "./splitHands";
import { assignPositions } from "./positions";

// Espressioni della SPEC §4.3. I nomi dei giocatori sono sempre \S+ (mai \w+).
const HEADER_RE =
  /^PokerStars Hand #(\d+):\s+Hold'em No Limit \(€([\d.]+)\/€([\d.]+) EUR\).* - (\d{4})\/(\d{2})\/(\d{2}) (\d{1,2}):(\d{2}):(\d{2}) (\S+)/;
const TABLE_RE = /^Table '([^']+)' (\d+)-max Seat #(\d+) is the button/;
const SEAT_RE = /^Seat (\d+): (\S+) \(€([\d.]+) in chips\)(.*)$/;
const BLIND_RE = /^(\S+): posts (small blind|big blind|small & big blinds) €([\d.]+)/;
const DEALT_RE = /^Dealt to (\S+) \[(.+?)\]/;
const STREET_RE = /^\*\*\* (HOLE CARDS|FLOP|TURN|RIVER|SHOW DOWN|SUMMARY) \*\*\*(.*)/;
const FOLD_CHECK_RE = /^(\S+): (folds|checks)$/;
const CALL_BET_RE = /^(\S+): (calls|bets) €([\d.]+)( and is all-in)?$/;
const RAISE_RE = /^(\S+): raises €([\d.]+) to €([\d.]+)( and is all-in)?$/;
const UNCALLED_RE = /^Uncalled bet \(€([\d.]+)\) returned to (\S+)$/;
const COLLECTED_RE = /^(\S+) collected €([\d.]+) from (?:pot|main pot|side pot(?:-\d+)?)$/;
const SUMMARY_SHOWDOWN_RE = /^Seat \d+: (\S+).*?(showed|mucked) \[/;
const RAKE_RE = /Rake €([\d.]+)/;
const CARDS_RE = /\[([^\]]+)\]/g;

/** Righe note che non servono al calcolo (SPEC §4.4). */
const IGNORED_RES: RegExp[] = [
  /^\S+: sits out$/,
  /^\S+ has timed out(?: while disconnected)?$/,
  /^\S+: has timed out(?: while disconnected)?$/,
  /^\S+ is disconnected$/,
  /^\S+ is connected$/,
  /^\S+ leaves the table$/,
  /^\S+ joins the table at seat #\d+$/,
  /^\S+ said, ".*"$/,
  /^\S+: shows \[.+\]/,
  /^\S+: mucks hand$/,
  /^\S+: doesn't show hand$/,
  /^\S+ is sitting out$/,
  /^\S+ was removed from the table/,
  /^\S+ finished the tournament/,
];

export type ParseResult =
  | { ok: true; hand: Hand; unknownLines: string[] }
  | { ok: false; reason: string; handId?: string };

const STREET_OF: Record<string, Street> = {
  "HOLE CARDS": "PRE",
  FLOP: "FLOP",
  TURN: "TURN",
  RIVER: "RIVER",
};

type Section = "SETUP" | "PLAY" | "SHOWDOWN" | "SUMMARY";

function add(map: Record<string, Cents>, key: string, amount: Cents): void {
  map[key] = (map[key] ?? 0) + amount;
}

function parseCards(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(CARDS_RE)) {
    const group = m[1];
    if (group) out.push(...group.split(" ").filter(Boolean));
  }
  return out;
}

/** Testo di una mano → oggetto Hand. Funzione pura. */
export function parseHand(text: string): ParseResult {
  const raw = normalizeText(text).replace(/^\n+|\n+$/g, "");
  const lines = raw.split("\n").map((l) => l.trimEnd());

  const header = HEADER_RE.exec(lines[0] ?? "");
  if (!header) {
    const idMatch = /#(\d+)/.exec(lines[0] ?? "");
    return {
      ok: false,
      reason: "Intestazione non riconosciuta (serve una mano NL Hold'em in euro, in inglese)",
      handId: idMatch?.[1],
    };
  }
  const [, id, sbText, bbText, yy, mo, dd, hh, mi, ss] = header;
  if (!id || !sbText || !bbText) return { ok: false, reason: "Intestazione incompleta" };
  const playedAt = `${yy}-${mo}-${dd}T${(hh ?? "").padStart(2, "0")}:${mi}:${ss}`;

  const tableMatch = TABLE_RE.exec(lines[1] ?? "");
  if (!tableMatch) return { ok: false, reason: "Riga del tavolo non riconosciuta", handId: id };
  const table = tableMatch[1] ?? "";
  const maxSeats = Number(tableMatch[2]);
  const buttonSeat = Number(tableMatch[3]);

  const players: Player[] = [];
  const actions: Action[] = [];
  const committedTotal: Record<string, Cents> = {};
  let committedStreet: Record<string, Cents> = {};
  const returned: Record<string, Cents> = {};
  const collected: Record<string, Cents> = {};
  const showdown: string[] = [];
  const unknownLines: string[] = [];
  let sbName: string | null = null;
  let bbName: string | null = null;
  let heroName: string | null = null;
  let heroCards: string | null = null;
  let board: string[] = [];
  let sawFlop = false;
  let rake: Cents = 0;
  let section: Section = "SETUP";
  let street: Street = "PRE";

  const bb = toCents(bbText);

  for (const line of lines.slice(2)) {
    if (line === "") continue;

    const streetMatch = STREET_RE.exec(line);
    if (streetMatch) {
      const name = streetMatch[1] ?? "";
      const mapped = STREET_OF[name];
      if (mapped) {
        section = "PLAY";
        if (mapped !== street) committedStreet = {};
        street = mapped;
        if (mapped === "FLOP") sawFlop = true;
        if (mapped !== "PRE") board = parseCards(streetMatch[2] ?? "");
      } else if (name === "SHOW DOWN") {
        section = "SHOWDOWN";
      } else {
        section = "SUMMARY";
      }
      continue;
    }

    if (section === "SUMMARY") {
      const sd = SUMMARY_SHOWDOWN_RE.exec(line);
      if (sd?.[1] && !showdown.includes(sd[1])) showdown.push(sd[1]);
      const rk = RAKE_RE.exec(line);
      if (rk?.[1] && line.startsWith("Total pot")) rake = toCents(rk[1]);
      continue; // Il resto del riepilogo non serve.
    }

    if (section === "SETUP") {
      const seat = SEAT_RE.exec(line);
      if (seat) {
        if (!(seat[4] ?? "").includes("is sitting out")) {
          players.push({ seat: Number(seat[1]), name: seat[2] ?? "", stack: toCents(seat[3] ?? "") });
        }
        continue;
      }
    }

    const blind = BLIND_RE.exec(line);
    if (blind) {
      const [, who = "", kind, amountText = ""] = blind;
      const amount = toCents(amountText);
      add(committedTotal, who, amount);
      if (kind === "small blind") {
        sbName = who;
        add(committedStreet, who, amount);
      } else if (kind === "big blind") {
        bbName = who;
        add(committedStreet, who, amount);
      } else {
        // "small & big blinds": la parte di small blind è morta, conta solo il BB
        // per il calcolo dei rilanci "to".
        add(committedStreet, who, Math.min(amount, bb));
      }
      continue;
    }

    const dealt = DEALT_RE.exec(line);
    if (dealt) {
      heroName = dealt[1] ?? null;
      heroCards = dealt[2] ?? null;
      continue;
    }

    if (section === "PLAY") {
      const fc = FOLD_CHECK_RE.exec(line);
      if (fc) {
        actions.push({ street, player: fc[1] ?? "", kind: fc[2] === "folds" ? "fold" : "check" });
        continue;
      }
      const cb = CALL_BET_RE.exec(line);
      if (cb) {
        const who = cb[1] ?? "";
        const amount = toCents(cb[3] ?? "");
        add(committedTotal, who, amount);
        add(committedStreet, who, amount);
        const action: Action = { street, player: who, kind: cb[2] === "calls" ? "call" : "bet", amount };
        if (cb[4]) action.allIn = true;
        actions.push(action);
        continue;
      }
      const rs = RAISE_RE.exec(line);
      if (rs) {
        const who = rs[1] ?? "";
        const to = toCents(rs[3] ?? "");
        const added = to - (committedStreet[who] ?? 0);
        add(committedTotal, who, added);
        committedStreet[who] = to;
        const action: Action = { street, player: who, kind: "raise", amount: to };
        if (rs[4]) action.allIn = true;
        actions.push(action);
        continue;
      }
    }

    const unc = UNCALLED_RE.exec(line);
    if (unc) {
      add(returned, unc[2] ?? "", toCents(unc[1] ?? ""));
      continue;
    }

    const col = COLLECTED_RE.exec(line);
    if (col) {
      add(collected, col[1] ?? "", toCents(col[2] ?? ""));
      continue;
    }

    if (IGNORED_RES.some((re) => re.test(line))) continue;
    unknownLines.push(line);
  }

  if (players.length < 2) return { ok: false, reason: "Meno di due giocatori nella mano", handId: id };

  const net: Record<string, Cents> = {};
  const invested: Record<string, Cents> = {};
  let pot: Cents = 0;
  const names = new Set<string>([
    ...players.map((p) => p.name),
    ...Object.keys(committedTotal),
    ...Object.keys(collected),
  ]);
  for (const name of names) {
    const put = (committedTotal[name] ?? 0) - (returned[name] ?? 0);
    invested[name] = put;
    pot += put;
    net[name] = (collected[name] ?? 0) - put;
  }

  const hand: Hand = {
    id,
    table,
    maxSeats,
    playedAt,
    sb: toCents(sbText),
    bb,
    buttonSeat,
    players,
    positions: assignPositions(players, buttonSeat, sbName, bbName),
    heroName,
    heroCards,
    board,
    actions,
    net,
    invested,
    pot,
    sawFlop,
    showdown,
    winners: Object.keys(collected).filter((n) => (collected[n] ?? 0) > 0),
    rake,
    raw,
  };
  return { ok: true, hand, unknownLines };
}

/** Somma dei net di tutti i giocatori + rake: deve essere 0 (SPEC §6.2). */
export function netImbalance(hand: Hand): Cents {
  return Object.values(hand.net).reduce((a, b) => a + b, 0) + hand.rake;
}
