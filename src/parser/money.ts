import type { Cents } from "../types";

const MONEY_RE = /^(\d+)(?:\.(\d{1,2}))?$/;

/** "0.07" → 7, "2" → 200, "1.5" → 150. Accetta anche il prefisso "€". */
export function toCents(text: string): Cents {
  const clean = text.trim().replace(/^€/, "");
  const m = MONEY_RE.exec(clean);
  if (!m) throw new Error(`Importo non valido: "${text}"`);
  const whole = Number(m[1]);
  const frac = (m[2] ?? "").padEnd(2, "0");
  return whole * 100 + Number(frac);
}
