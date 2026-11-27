import type { DisplayStats, Ratio } from "./aggregate";

export type StatKey = keyof DisplayStats;

/** Sotto questa soglia di casi un valore è poco affidabile. */
export const FEW_CASES = 20;

export interface StatReference {
  name: string;
  /** Intervallo ottimale per un regular 6-max (SPEC §6.5). */
  min: number;
  max: number;
  /** "pct": rapporto mostrato in percentuale; "ratio": numero con un decimale (AF). */
  unit: "pct" | "ratio";
  /** Cosa significa un valore sopra l'intervallo. */
  high: string;
  /** Cosa significa un valore sotto l'intervallo. */
  low: string;
}

export const STAT_REFERENCES: Record<StatKey, StatReference> = {
  vpip: {
    name: "VPIP", min: 0.22, max: 0.27, unit: "pct",
    high: "Giochi troppe mani: restringi i range di apertura e di call.",
    low: "Giochi poche mani: puoi allargare i range, soprattutto in posizione.",
  },
  pfr: {
    name: "PFR", min: 0.18, max: 0.23, unit: "pct",
    high: "Rilanci molto preflop: controlla le aperture dalle prime posizioni.",
    low: "Rilanci poco: apri rilanciando invece di fare limp o call.",
  },
  threeBet: {
    name: "3-bet", min: 0.05, max: 0.09, unit: "pct",
    high: "3-betti spesso: rischi di farlo con mani troppo deboli.",
    low: "3-betti poco: aggiungi 3-bet di valore e qualche bluff.",
  },
  foldTo3Bet: {
    name: "Fold contro 3-bet", min: 0.4, max: 0.6, unit: "pct",
    high: "Abbandoni troppo spesso contro la 3-bet: gli avversari possono sfruttarlo.",
    low: "Continui troppo spesso contro la 3-bet: rischi di pagare con mani dominate.",
  },
  cbet: {
    name: "C-bet al flop", min: 0.55, max: 0.7, unit: "pct",
    high: "Fai c-bet quasi sempre: scegli meglio board e avversari.",
    low: "Fai poche c-bet: lasci piatti che potresti vincere subito.",
  },
  wtsd: {
    name: "WTSD", min: 0.25, max: 0.3, unit: "pct",
    high: "Vai spesso allo showdown: probabilmente paghi troppo al turn e al river.",
    low: "Arrivi poco allo showdown: forse abbandoni troppo spesso dopo il flop.",
  },
  wsd: {
    name: "W$SD", min: 0.5, max: 0.55, unit: "pct",
    high: "Vinci spesso allo showdown: forse ci arrivi solo con mani forti e lasci valore.",
    low: "Perdi spesso allo showdown: chiami con mani troppo deboli.",
  },
  af: {
    name: "AF", min: 2, max: 3, unit: "ratio",
    high: "Molto aggressivo dopo il flop: attenzione ai bluff eccessivi.",
    low: "Passivo dopo il flop: chiami più spesso di quanto punti o rilanci.",
  },
};

export type StatStatus = "na" | "ok" | "high" | "low";

export interface StatAssessment {
  status: StatStatus;
  /** Fuori dall'intervallo ma con meno di FEW_CASES casi: poco affidabile. */
  smallSample: boolean;
  /** "22–27%" o "2–3". */
  rangeText: string;
  /** "+7 punti oltre il 27%" / "−0,4 sotto 2"; solo se fuori. */
  deltaText?: string;
  /** Frase su cosa significa; solo se fuori. */
  hint?: string;
}

const dec = (n: number) => String(n).replace(".", ",");

function shown(ref: StatReference, value: number): number {
  // Si confronta il valore come lo vede l'utente (percentuale intera, AF a un decimale).
  return ref.unit === "pct" ? Math.round(value * 100) : Math.round(value * 10) / 10;
}

function bounds(ref: StatReference): { min: number; max: number } {
  return ref.unit === "pct"
    ? { min: Math.round(ref.min * 100), max: Math.round(ref.max * 100) }
    : { min: ref.min, max: ref.max };
}

export function rangeText(key: StatKey): string {
  const ref = STAT_REFERENCES[key];
  const b = bounds(ref);
  return ref.unit === "pct" ? `${b.min}–${b.max}%` : `${dec(b.min)}–${dec(b.max)}`;
}

/** Confronta una statistica con il suo intervallo ottimale. Funzione pura. */
export function assessStat(key: StatKey, r: Ratio): StatAssessment {
  const ref = STAT_REFERENCES[key];
  const range = rangeText(key);
  if (r.value === null) return { status: "na", smallSample: false, rangeText: range };

  const v = shown(ref, r.value);
  const b = bounds(ref);
  if (v >= b.min && v <= b.max) return { status: "ok", smallSample: false, rangeText: range };

  const high = v > b.max;
  const bound = high ? b.max : b.min;
  const diff = Math.round(Math.abs(v - bound) * 10) / 10;
  const sign = high ? "+" : "−";
  const where = high ? "oltre" : "sotto";
  const deltaText =
    ref.unit === "pct"
      ? `${sign}${diff} ${diff === 1 ? "punto" : "punti"} ${where} il ${bound}%`
      : `${sign}${dec(diff)} ${where} ${dec(bound)}`;

  return {
    status: high ? "high" : "low",
    smallSample: r.cases < FEW_CASES,
    rangeText: range,
    deltaText,
    hint: high ? ref.high : ref.low,
  };
}
