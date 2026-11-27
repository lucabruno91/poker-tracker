import { HAND_TAGS, type Counters, type Hand, type HandNote, type Label, type Session } from "../types";
import { addInto, displayStats, emptyCounters, netInBb } from "../stats/aggregate";
import { handStats } from "../stats/handStats";
import { countersFor } from "../stats/players";
import { compareHandIds } from "../stats/sessions";
import { formatAf, formatBb, formatDate, formatEuro, formatPct } from "../ui/format";

/** Massimo di mani per export: oltre, il testo diventa troppo lungo per una chat. */
export const EXPORT_LIMIT = 50;

export interface ClaudeExportInput {
  session: Session;
  /** Tutte le mani della sessione. */
  hands: Hand[];
  hero: string;
  selectedIds: Iterable<string>;
  /** Etichetta da mostrare per un avversario (già risolta con le precedenze). */
  labelOf: (name: string) => Label | null;
  /** Quanti avversari elencare (default 6). */
  topOpponents?: number;
  /** Note di studio per hand ID: finiscono nella sezione «NOTE DI STUDIO». */
  notes?: Map<string, HandNote>;
}

export function heroStatsLine(c: Counters): string {
  const d = displayStats(c);
  return [
    `VPIP ${formatPct(d.vpip)}`,
    `PFR ${formatPct(d.pfr)}`,
    `3-bet ${formatPct(d.threeBet)} (${d.threeBet.cases} casi)`,
    `C-bet ${formatPct(d.cbet)}`,
    `WTSD ${formatPct(d.wtsd)}`,
    `W$SD ${formatPct(d.wsd)}`,
    `AF ${formatAf(d.af)}`,
  ].join(" · ");
}

/** «Avversari principali: …» sulle mani date, o null se non ce ne sono. */
function opponentsLine(hands: Hand[], hero: string, labelOf: (name: string) => Label | null, top = 6): string | null {
  const opponents = [...countersFor(hands)]
    .filter(([name]) => name !== hero)
    .sort((a, b) => b[1].hands - a[1].hands || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([name, c]) => {
      const d = displayStats(c);
      const vp = `${Math.round((d.vpip.value ?? 0) * 100)}/${Math.round((d.pfr.value ?? 0) * 100)}`;
      const label = labelOf(name);
      return `${name} ${c.hands} mani ${vp}${label ? ` [${label}]` : ""}`;
    });
  return opponents.length > 0 ? `Avversari principali: ${opponents.join(" · ")}` : null;
}

/**
 * Sezione «NOTE DI STUDIO» per le mani esportate che hanno tag o nota. Sta
 * prima delle mani e non dentro il loro testo, che resta nel formato originale
 * (così si può incollare anche in GTO Wizard).
 */
export function notesSection(hands: Hand[], notes: Map<string, HandNote> | undefined): string[] {
  if (!notes) return [];
  const lines: string[] = [];
  for (const h of hands) {
    const n = notes.get(h.id);
    if (!n || (n.tags.length === 0 && !n.note)) continue;
    const tags = n.tags.length ? `[${n.tags.map((t) => HAND_TAGS[t]).join(", ")}] ` : "";
    lines.push(`Mano #${h.id} (${h.table}, ${formatDate(h.playedAt)} ${h.playedAt.slice(11, 16)}): ${tags}${n.note ?? ""}`.trimEnd());
  }
  return lines.length ? ["", "NOTE DI STUDIO", ...lines] : [];
}

/** Testo da incollare in chat con Claude per una sessione (SPEC §9). Funzione pura. */
export function buildClaudeExport(input: ClaudeExportInput): string {
  const { session, hands, hero, labelOf } = input;
  const bb = hands[0]?.bb ?? 2;
  const lines: string[] = [];

  lines.push(`SESSIONE ${session.table} — ${session.date} — ${session.hero.hands} mani`);
  lines.push(
    `Risultato hero: ${formatBb(netInBb(session.net, bb))} (${formatEuro(session.net, true)}), ` +
      `ricariche ${formatEuro(session.rebuys)}, stack finale ${formatEuro(session.heroEnd)}`,
  );
  lines.push(`Hero: ${heroStatsLine(session.hero)}`);
  const opponents = opponentsLine(hands, hero, labelOf, input.topOpponents);
  if (opponents) lines.push(opponents);

  const selected = new Set(input.selectedIds);
  const chosen = hands.filter((h) => selected.has(h.id)).sort((a, b) => compareHandIds(a.id, b.id));
  lines.push(...notesSection(chosen, input.notes));
  if (chosen.length > 0) {
    lines.push("", "MANI SELEZIONATE", chosen.map((h) => h.raw).join("\n\n\n"));
  }
  return lines.join("\n");
}

export interface GroupExportInput {
  /** Titolo del gruppo, es. «Selezione del grafico: mani 115–190». */
  title: string;
  /** Mani del gruppo, nell'ordine in cui esportarle. */
  hands: Hand[];
  hero: string;
  labelOf: (name: string) => Label | null;
  notes?: Map<string, HandNote>;
  topOpponents?: number;
  /** Massimo di mani esportate (default EXPORT_LIMIT). */
  limit?: number;
}

export interface GroupExport {
  text: string;
  /** Mani incluse nel testo (al massimo `limit`). */
  exported: number;
  /** Mani del gruppo. */
  total: number;
}

/**
 * Testo per Claude di un gruppo qualsiasi di mani (SPEC §9): intestazione,
 * risultato e statistiche dell'hero sulle mani del gruppo, avversari
 * principali, note di studio e le mani nel formato originale (al massimo
 * `limit`). Funzione pura.
 */
export function buildGroupExport(input: GroupExportInput): GroupExport {
  const { hands, hero, labelOf } = input;
  const limit = input.limit ?? EXPORT_LIMIT;
  const counters = emptyCounters();
  let bb = 0;
  let cents = 0;
  for (const h of hands) {
    const c = handStats(h)[hero];
    if (!c) continue;
    addInto(counters, c);
    bb += (h.net[hero] ?? 0) / h.bb;
    cents += h.net[hero] ?? 0;
  }
  const dates = [...new Set(hands.map((h) => h.playedAt.slice(0, 10)))].sort();
  const first = dates[0];
  const last = dates[dates.length - 1] ?? first;
  const when = !first ? "" : first === last ? ` — ${formatDate(first)}` : ` — dal ${formatDate(first)} al ${formatDate(last ?? first)}`;

  const lines: string[] = [];
  lines.push(`${input.title.toUpperCase()}${when} — ${hands.length} ${hands.length === 1 ? "mano" : "mani"}`);
  lines.push(`Risultato hero: ${formatBb(bb)} (${formatEuro(cents, true)})`);
  lines.push(`Hero: ${heroStatsLine(counters)}`);
  const opponents = opponentsLine(hands, hero, labelOf, input.topOpponents);
  if (opponents) lines.push(opponents);

  const exported = hands.slice(0, limit);
  if (hands.length > limit) {
    lines.push(`(Esportate le prime ${limit} mani di ${hands.length}: risultato e statistiche valgono per tutte.)`);
  }
  lines.push(...notesSection(exported, input.notes));
  if (exported.length > 0) lines.push("", "MANI", exported.map((h) => h.raw).join("\n\n\n"));
  return { text: lines.join("\n"), exported: exported.length, total: hands.length };
}
