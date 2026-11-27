import { HAND_TAGS, type Hand, type HandNote, type HandTag, type Position } from "../types";
import { POSITION_ORDER } from "./byPosition";
import { handStats } from "./handStats";
import { compareHandIds } from "./sessions";
import { GRID_ORDER, handClass } from "./startingHands";

export type HandKind = "showdown" | "allin" | "vpip";
export type HandResult = "won" | "lost";
export type HandSort = "recent" | "pot" | "worst" | "best";

export interface HandFilter {
  position?: Position;
  kind?: HandKind;
  result?: HandResult;
  /** Testo libero: "AKs", "AKo", "AK" (entrambe), "QQ"; maiuscole/minuscole e ordine indifferenti. */
  cards?: string;
  /** Solo le mani con questo tag, o con un tag/nota qualsiasi ("any"). */
  tag?: HandTag | "any";
  sort: HandSort;
}

export const DEFAULT_HAND_FILTER: HandFilter = { sort: "recent" };

export interface CardsQuery {
  /** Ranghi dal più alto, es. ["A", "K"]. */
  ranks: [string, string];
  /** undefined = suited e offsuit. */
  suited?: "s" | "o";
}

/** "ak", "KA", "AKs", "qq", "T9o", "10 9" → classe cercata; null se non valida. */
export function parseCardsQuery(text: string): CardsQuery | null {
  const t = text.trim().toUpperCase().replace(/10/g, "T").replace(/\s+/g, "");
  const m = /^([AKQJT2-9])([AKQJT2-9])([SO])?$/.exec(t);
  if (!m) return null;
  const a = m[1] as string;
  const b = m[2] as string;
  if (a === b && m[3]) return null; // una coppia non è suited/offsuit
  const order = (r: string) => GRID_ORDER.indexOf(r as (typeof GRID_ORDER)[number]);
  const ranks: [string, string] = order(a) <= order(b) ? [a, b] : [b, a];
  const q: CardsQuery = { ranks };
  if (m[3]) q.suited = m[3] === "S" ? "s" : "o";
  return q;
}

export function matchesCards(q: CardsQuery, heroCards: string | null): boolean {
  if (!heroCards) return false;
  const cls = handClass(heroCards);
  if (!cls) return false;
  const base = `${q.ranks[0]}${q.ranks[1]}`;
  if (q.ranks[0] === q.ranks[1]) return cls === base;
  return q.suited ? cls === `${base}${q.suited}` : cls === `${base}s` || cls === `${base}o`;
}

/**
 * Mani dell'hero che rispettano il filtro, ordinate. Funzione pura.
 * Una ricerca per carte non valida non esclude nulla (la UI la segnala).
 */
export function filterHands(
  hands: Iterable<Hand>,
  hero: string,
  f: HandFilter,
  /** Segnalibri e note per hand ID (serve solo per il filtro `tag`). */
  notes?: Map<string, HandNote>,
): Hand[] {
  const cardsQ = f.cards ? parseCardsQuery(f.cards) : null;
  const out: Hand[] = [];
  for (const h of hands) {
    if (!h.players.some((p) => p.name === hero)) continue;
    if (f.position && h.positions[hero] !== f.position) continue;
    const net = h.net[hero] ?? 0;
    if (f.result === "won" && net <= 0) continue;
    if (f.result === "lost" && net >= 0) continue;
    if (f.kind === "showdown" && !h.showdown.includes(hero)) continue;
    if (f.kind === "allin" && !(h.actions.some((a) => a.allIn) && !h.actions.some((a) => a.player === hero && a.kind === "fold"))) {
      continue; // mani con un all-in in cui l'hero non ha foldato
    }
    if (f.kind === "vpip" && !handStats(h)[hero]?.vpip) continue;
    if (cardsQ && !matchesCards(cardsQ, h.heroName === hero ? h.heroCards : null)) continue;
    if (f.tag) {
      const n = notes?.get(h.id);
      if (!n) continue;
      if (f.tag === "any" ? n.tags.length === 0 && !n.note : !n.tags.includes(f.tag)) continue;
    }
    out.push(h);
  }
  const bb = (h: Hand) => (h.net[hero] ?? 0) / h.bb;
  const recent = (a: Hand, b: Hand) => (b.playedAt < a.playedAt ? -1 : b.playedAt > a.playedAt ? 1 : compareHandIds(b.id, a.id));
  switch (f.sort) {
    case "pot": return out.sort((a, b) => b.pot / b.bb - a.pot / a.bb || recent(a, b));
    case "worst": return out.sort((a, b) => bb(a) - bb(b) || recent(a, b));
    case "best": return out.sort((a, b) => bb(b) - bb(a) || recent(a, b));
    default: return out.sort(recent);
  }
}

const KINDS: HandKind[] = ["showdown", "allin", "vpip"];
const SORTS: HandSort[] = ["recent", "pot", "worst", "best"];

const KIND_TEXT: Record<HandKind, string> = { showdown: "allo showdown", allin: "con un all-in", vpip: "giocate" };
const SORT_TEXT: Record<HandSort, string> = {
  recent: "", pot: "per piatto", worst: "per perdite", best: "per vincite",
};

/** Descrizione breve del filtro, es. «BB, perse, carte AK». Vuota senza filtri. */
export function describeHandFilter(f: HandFilter): string {
  const parts: string[] = [];
  if (f.position) parts.push(f.position);
  if (f.kind) parts.push(KIND_TEXT[f.kind]);
  if (f.result) parts.push(f.result === "won" ? "vinte" : "perse");
  if (f.cards) parts.push(`carte ${f.cards}`);
  if (f.tag) parts.push(f.tag === "any" ? "con tag o nota" : `tag «${HAND_TAGS[f.tag]}»`);
  if (SORT_TEXT[f.sort]) parts.push(`ordinate ${SORT_TEXT[f.sort]}`);
  return parts.join(", ");
}

/** Filtro letto dalla query dell'URL (`pos`, `tipo`, `esito`, `carte`, `ordina`). */
export function parseHandQuery(query: string): HandFilter {
  const p = new URLSearchParams(query);
  const f: HandFilter = { sort: "recent" };
  const pos = p.get("pos");
  if (pos && (POSITION_ORDER as string[]).includes(pos)) f.position = pos as Position;
  const kind = p.get("tipo");
  if (kind && (KINDS as string[]).includes(kind)) f.kind = kind as HandKind;
  const res = p.get("esito");
  if (res === "vinte") f.result = "won";
  else if (res === "perse") f.result = "lost";
  const cards = p.get("carte");
  if (cards) f.cards = cards;
  const tag = p.get("tag");
  if (tag === "qualsiasi") f.tag = "any";
  else if (tag && Object.hasOwn(HAND_TAGS, tag)) f.tag = tag as HandTag;
  const sort = p.get("ordina");
  if (sort && (SORTS as string[]).includes(sort)) f.sort = sort as HandSort;
  return f;
}

/** Query dell'URL per un filtro (solo i valori diversi dal predefinito). */
export function handQuery(f: HandFilter, page = 1): string {
  const p = new URLSearchParams();
  if (f.position) p.set("pos", f.position);
  if (f.kind) p.set("tipo", f.kind);
  if (f.result) p.set("esito", f.result === "won" ? "vinte" : "perse");
  if (f.cards) p.set("carte", f.cards);
  if (f.tag) p.set("tag", f.tag === "any" ? "qualsiasi" : f.tag);
  if (f.sort !== "recent") p.set("ordina", f.sort);
  if (page > 1) p.set("pagina", String(page));
  return p.toString();
}

export function pageOf(query: string): number {
  const n = Number(new URLSearchParams(query).get("pagina"));
  return Number.isInteger(n) && n > 1 ? n : 1;
}
