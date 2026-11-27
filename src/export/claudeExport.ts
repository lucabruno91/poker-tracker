import type { Counters, Hand, Label, Session } from "../types";
import { displayStats, netInBb } from "../stats/aggregate";
import { countersFor } from "../stats/players";
import { compareHandIds } from "../stats/sessions";
import { formatAf, formatBb, formatEuro, formatPct } from "../ui/format";

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

/** Testo da incollare in chat con Claude (SPEC §9). Funzione pura. */
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

  const opponents = [...countersFor(hands)]
    .filter(([name]) => name !== hero)
    .sort((a, b) => b[1].hands - a[1].hands || a[0].localeCompare(b[0]))
    .slice(0, input.topOpponents ?? 6)
    .map(([name, c]) => {
      const d = displayStats(c);
      const vp = `${Math.round((d.vpip.value ?? 0) * 100)}/${Math.round((d.pfr.value ?? 0) * 100)}`;
      const label = labelOf(name);
      return `${name} ${c.hands} mani ${vp}${label ? ` [${label}]` : ""}`;
    });
  if (opponents.length > 0) lines.push(`Avversari principali: ${opponents.join(" · ")}`);

  const selected = new Set(input.selectedIds);
  const chosen = hands.filter((h) => selected.has(h.id)).sort((a, b) => compareHandIds(a.id, b.id));
  if (chosen.length > 0) {
    lines.push("", "MANI SELEZIONATE", chosen.map((h) => h.raw).join("\n\n\n"));
  }
  return lines.join("\n");
}
