import type { Cents } from "../types";
import type { Ratio } from "../stats/aggregate";

const MINUS = "−";

function sign(n: number, always: boolean): string {
  if (n < 0) return MINUS;
  return always && n > 0 ? "+" : "";
}

/** 436 → "€4,36"; con `signed` → "+€4,36" / "−€1,01". */
export function formatEuro(cents: Cents, signed = false): string {
  const abs = Math.abs(cents);
  const text = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
  return `${sign(cents, signed)}€${text}`;
}

/** Numero decimale all'italiana: 1.9 → "1,9". */
export function formatDecimal(n: number, digits = 1): string {
  return Math.abs(n).toFixed(digits).replace(".", ",");
}

/** Risultato in bb con segno: 218 → "+218,0 bb". */
export function formatBb(bb: number, signed = true): string {
  return `${sign(bb, signed)}${formatDecimal(bb, 1)} bb`;
}

/** Numero con segno e un decimale (es. bb/100): 12.34 → "+12,3"; null → "—". */
export function formatSigned(n: number | null): string {
  return n === null ? "—" : `${sign(n, true)}${formatDecimal(n, 1)}`;
}

export function formatPct(r: Ratio): string {
  return r.value === null ? "—" : `${Math.round(r.value * 100)}%`;
}

export function formatAf(r: Ratio): string {
  return r.value === null ? "—" : formatDecimal(r.value, 1);
}

/** "2026-11-25" → "25/11/2026". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
