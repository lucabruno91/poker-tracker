import type { Hand } from "../types";

/** Ranghi dal più alto al più basso: righe e colonne della griglia 13×13. */
export const GRID_ORDER = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;

const RANK_INDEX = new Map<string, number>(GRID_ORDER.map((r, i) => [r, i]));

/**
 * Classe della mano iniziale: "Ad Kc" → "AKo", "Ah Kh" → "AKs", "Qs Qd" → "QQ".
 * null se le carte non sono due carte valide.
 */
export function handClass(cards: string): string | null {
  const parts = cards.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const [a, b] = parts as [string, string];
  const ra = RANK_INDEX.get(a[0] ?? "");
  const rb = RANK_INDEX.get(b[0] ?? "");
  if (ra === undefined || rb === undefined || a.length !== 2 || b.length !== 2) return null;
  const [hi, lo] = ra <= rb ? [a, b] : [b, a];
  if (ra === rb) return `${hi[0]}${lo[0]}`;
  return `${hi[0]}${lo[0]}${hi[1] === lo[1] ? "s" : "o"}`;
}

/** Classe della cella (riga, colonna): coppie in diagonale, suited sopra, offsuit sotto. */
export function gridCell(row: number, col: number): string {
  const r = GRID_ORDER[row] ?? "";
  const c = GRID_ORDER[col] ?? "";
  if (row === col) return `${r}${c}`;
  return row < col ? `${r}${c}s` : `${c}${r}o`;
}

export interface StartingHandResult {
  hands: number;
  /** Mani in cui l'hero ha messo soldi volontariamente preflop. */
  vpip: number;
  /** Risultato in bb, sommato mano per mano. */
  netBb: number;
  handIds: string[];
}

/** Risultati dell'hero per classe di mano iniziale. Funzione pura. */
export function heroByStartingHand(hands: Iterable<Hand>, hero: string): Map<string, StartingHandResult> {
  const out = new Map<string, StartingHandResult>();
  for (const h of hands) {
    if (h.heroName !== hero || !h.heroCards) continue;
    const cls = handClass(h.heroCards);
    if (!cls) continue;
    let row = out.get(cls);
    if (!row) {
      row = { hands: 0, vpip: 0, netBb: 0, handIds: [] };
      out.set(cls, row);
    }
    row.hands++;
    row.netBb += (h.net[hero] ?? 0) / h.bb;
    row.handIds.push(h.id);
    if (h.actions.some((a) => a.street === "PRE" && a.player === hero && (a.kind === "call" || a.kind === "raise"))) {
      row.vpip++;
    }
  }
  return out;
}
