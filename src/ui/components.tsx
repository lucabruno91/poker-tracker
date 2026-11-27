import { useState } from "react";
import type { Cents, Counters, Label } from "../types";
import { displayStats, FEW_CASES, REFERENCE, type DisplayStats, type Ratio } from "../stats/aggregate";
import type { EffectiveLabel } from "../labels/autoLabel";
import { formatAf, formatBb, formatEuro, formatPct } from "./format";

export const LABEL_COLORS: Record<Label, string> = {
  "Regular forte": "#B5534F",
  "Regular medio": "#C98A3A",
  "Regular con leak": "#C9A24B",
  Roccia: "#6C8FB8",
  "Ibrido / bot": "#8A8375",
  Fish: "#6FA386",
  Balena: "#3E6353",
};

/** Etichette chiare su cui il testo color carta non si leggerebbe. */
const DARK_TEXT: ReadonlySet<Label> = new Set<Label>([
  "Regular con leak", "Fish", "Regular medio", "Roccia", "Ibrido / bot",
]);

const SOURCE_TEXT = { user: "", claude: "Claude", auto: "auto" } as const;

export function LabelBadge({ info }: { info: EffectiveLabel }) {
  if (!info.label) {
    return <span className="label empty">{info.toObserve ? "da osservare" : "nessuna"}</span>;
  }
  const color = LABEL_COLORS[info.label];
  return (
    <span>
      <span
        className="label"
        style={{ background: color, color: DARK_TEXT.has(info.label) ? "#14181C" : "#F1E8D6" }}
      >
        {info.label}
        {info.smallSample && <span title="Campione piccolo (meno di 45 mani)" aria-label="campione piccolo"> ·</span>}
      </span>
      {info.source && SOURCE_TEXT[info.source] && <span className="label-src">{SOURCE_TEXT[info.source]}</span>}
    </span>
  );
}

export function Kpi({ label, value, cls = "" }: { label: string; value: string | number; cls?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${cls}`}>{value}</div>
    </div>
  );
}

/** Classe CSS per il segno di un risultato. */
export const signClass = (n: number): string => (n > 0 ? "pos" : n < 0 ? "neg" : "");

export function Money({ cents, signed = true }: { cents: Cents; signed?: boolean }) {
  const cls = signed ? (cents > 0 ? "pos" : cents < 0 ? "neg" : "") : "";
  return <span className={`num ${cls}`}>{formatEuro(cents, signed)}</span>;
}

export function Bb({ cents, bb }: { cents: Cents; bb: Cents }) {
  const cls = cents > 0 ? "pos" : cents < 0 ? "neg" : "";
  return <span className={`num ${cls}`}>{formatBb(cents / bb)}</span>;
}

const SUIT_CLASS: Record<string, string> = { h: "suit-h", d: "suit-d", c: "suit-c", s: "suit-s" };

export function Cards({ cards }: { cards: string | null }) {
  if (!cards) return <span className="muted">—</span>;
  return (
    <span className="cards">
      {cards.split(" ").map((c, i) => (
        <span key={i} className={SUIT_CLASS[c.slice(-1)] ?? ""}>
          {i > 0 ? " " : ""}
          {c}
        </span>
      ))}
    </span>
  );
}

const STAT_ROWS: { key: keyof DisplayStats; name: string; af?: boolean }[] = [
  { key: "vpip", name: "VPIP" },
  { key: "pfr", name: "PFR" },
  { key: "threeBet", name: "3-bet" },
  { key: "foldTo3Bet", name: "Fold contro 3-bet" },
  { key: "cbet", name: "C-bet al flop" },
  { key: "wtsd", name: "WTSD" },
  { key: "wsd", name: "W$SD" },
  { key: "af", name: "AF", af: true },
];

function refText(key: keyof DisplayStats, af: boolean): string {
  const r = REFERENCE[key];
  return af ? `${r.min}–${r.max}` : `${Math.round(r.min * 100)}–${Math.round(r.max * 100)}%`;
}

function isOut(key: keyof DisplayStats, r: Ratio): boolean {
  if (r.value === null) return false;
  const ref = REFERENCE[key];
  return r.value < ref.min || r.value > ref.max;
}

/** Griglia delle statistiche; con `compare` evidenzia i valori fuori riferimento. */
export function StatsGrid({ counters, compare = false }: { counters: Counters; compare?: boolean }) {
  const d = displayStats(counters);
  return (
    <div className="stats-grid">
      {STAT_ROWS.map(({ key, name, af }) => {
        const r = d[key];
        const out = compare && isOut(key, r);
        return (
          <div key={key} className={`stat${out ? " out" : ""}`}>
            <div className="stat-name">{name}</div>
            <div className="stat-value">{af ? formatAf(r) : formatPct(r)}</div>
            {r.cases > 0 && r.cases < FEW_CASES && <div className="stat-ref">solo {r.cases} casi</div>}
            {compare && <div className="stat-ref">rif. {refText(key, Boolean(af))}</div>}
            {out && <div className="stat-flag">fuori riferimento</div>}
          </div>
        );
      })}
    </div>
  );
}

export function CopyButton({ text, label = "Copia" }: { text: () => string; label?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setState("ok");
    } catch {
      setState("error");
    }
    window.setTimeout(() => setState("idle"), 2000);
  };
  return (
    <button type="button" onClick={copy} aria-live="polite">
      {state === "ok" ? "Copiato" : state === "error" ? "Copia non riuscita" : label}
    </button>
  );
}
