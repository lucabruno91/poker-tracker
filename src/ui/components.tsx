import { useState, type ReactNode } from "react";
import type { Cents, Counters, Label } from "../types";
import { displayStats } from "../stats/aggregate";
import { assessStat, FEW_CASES, STAT_REFERENCES, type StatKey } from "../stats/reference";
import type { EffectiveLabel } from "../labels/autoLabel";
import { formatAf, formatBb, formatEuro, formatPct } from "./format";
import { describeCard, isSuit, rankLabel, SUITS } from "./cards";
import { STAT_GLOSSARY } from "./glossary";
import { Term } from "./Term";

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

export function Kpi({ label, value, cls = "" }: { label: ReactNode; value: string | number; cls?: string }) {
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

/**
 * Carte come piccole carte chiare a quattro colori (cuori rosso, quadri blu,
 * fiori verde, picche nero), con il simbolo del seme. I lettori di schermo
 * leggono i nomi per esteso («asso di cuori, re di fiori»).
 */
export function Cards({ cards }: { cards: string | null }) {
  if (!cards) return <span className="muted">—</span>;
  const list = cards.split(/\s+/).filter(Boolean);
  return (
    <span className="cards" role="img" aria-label={list.map(describeCard).join(", ")}>
      {list.map((c, i) => {
        const suit = c[1] ?? "";
        if (!isSuit(suit)) {
          return (
            <span key={i} className="playing-card" aria-hidden="true">
              {c}
            </span>
          );
        }
        return (
          <span key={i} className={`playing-card suit-${suit}`} style={{ color: SUITS[suit].color }} aria-hidden="true">
            {rankLabel(c[0] ?? "")}
            <span className="card-suit">{SUITS[suit].symbol}</span>
          </span>
        );
      })}
    </span>
  );
}

const STAT_KEYS = Object.keys(STAT_REFERENCES) as StatKey[];

/**
 * Griglia delle statistiche. Con `compare` mostra l'intervallo ottimale e, per i
 * valori fuori, direzione, distanza e cosa significano.
 */
export function StatsGrid({ counters, compare = false }: { counters: Counters; compare?: boolean }) {
  const d = displayStats(counters);
  return (
    <div className="stats-grid">
      {STAT_KEYS.map((key) => {
        const ref = STAT_REFERENCES[key];
        const r = d[key];
        const a = assessStat(key, r);
        const out = compare && (a.status === "high" || a.status === "low");
        const warn = out && !a.smallSample;
        return (
          <div key={key} className={`stat${warn ? " out" : ""}`}>
            <div className="stat-name">
              <Term tip={STAT_GLOSSARY[key]}>{ref.name}</Term>
            </div>
            <div className="stat-value">{ref.unit === "ratio" ? formatAf(r) : formatPct(r)}</div>
            {r.cases > 0 && r.cases < FEW_CASES && <div className="stat-ref">solo {r.cases} casi</div>}
            {compare && <div className="stat-ref">Ottimale: {a.rangeText}</div>}
            {out && a.smallSample && (
              <div className="stat-note">Fuori dall'ottimale, ma campione piccolo: valore poco affidabile.</div>
            )}
            {warn && (
              <>
                <div className="stat-flag">
                  {a.status === "high" ? "Troppo alto" : "Troppo basso"} ({a.deltaText})
                </div>
                <div className="stat-hint">{a.hint}</div>
              </>
            )}
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
