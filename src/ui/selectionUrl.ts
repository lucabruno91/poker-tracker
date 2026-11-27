import { dateRange, type Filter } from "../stats/filters";
import type { ChartRange } from "./CumulativeChart";

/**
 * La selezione del grafico del Riepilogo vive nell'URL (`#/?sel=115-190&f=…`),
 * così sopravvive all'apertura di una mano e al ritorno con «Indietro».
 * `sel` usa i numeri di mano mostrati (da 1); `f` è l'impronta del filtro con
 * cui la selezione è stata fatta: con un filtro diverso gli indici non
 * corrispondono più e la selezione va ignorata.
 */

/** Impronta del filtro: intervallo di date risolto e stake; "" senza filtro. */
export function filterSignature(filter: Filter, today: string): string {
  const { from, to } = dateRange(filter, today);
  if (!from && !to && !filter.stake) return "";
  return `${from ?? ""}~${to ?? ""}~${filter.stake ?? ""}`;
}

/** Query dell'URL per una selezione (vuota senza selezione). */
export function selectionQuery(range: ChartRange | null, signature: string): string {
  if (!range) return "";
  const p = new URLSearchParams({ sel: `${range[0] + 1}-${range[1] + 1}` });
  if (signature) p.set("f", signature); // senza filtro l'impronta è vuota e non serve
  return p.toString();
}

/**
 * Selezione letta dall'URL; null se manca, se non è valida, se esce dalle
 * `count` mani del grafico o se è stata fatta con un altro filtro.
 */
export function parseSelection(query: string, signature: string, count: number): ChartRange | null {
  const p = new URLSearchParams(query);
  const m = /^(\d+)-(\d+)$/.exec(p.get("sel") ?? "");
  if (!m || (p.get("f") ?? "") !== signature) return null;
  const a = Number(m[1]) - 1;
  const b = Number(m[2]) - 1;
  if (a < 0 || b < a || b >= count) return null;
  return [a, b];
}
