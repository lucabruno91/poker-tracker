import { LABELS, type Label } from "../types";

export interface ClaudeLabelEntry {
  name: string;
  label?: Label;
  note?: string;
}

export interface ClaudeLabelsParse {
  entries: ClaudeLabelEntry[];
  errors: string[];
}

export function isLabel(x: unknown): x is Label {
  return typeof x === "string" && (LABELS as readonly string[]).includes(x);
}

/**
 * Legge il JSON `{ "nome": { "label": "...", "note": "..." } }` incollato da Claude.
 * Le voci con etichetta non valida vengono riportate tra gli errori (la nota resta).
 */
export function parseClaudeLabels(json: string): ClaudeLabelsParse {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { entries: [], errors: ["Il testo non è un JSON valido."] };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { entries: [], errors: ["Serve un oggetto { \"nome\": { \"label\": ..., \"note\": ... } }."] };
  }
  const entries: ClaudeLabelEntry[] = [];
  const errors: string[] = [];
  for (const [name, value] of Object.entries(data)) {
    if (typeof value !== "object" || value === null) {
      errors.push(`${name}: valore non valido.`);
      continue;
    }
    const v = value as Record<string, unknown>;
    const entry: ClaudeLabelEntry = { name };
    if (v.label !== undefined && v.label !== null && v.label !== "") {
      if (isLabel(v.label)) entry.label = v.label;
      else errors.push(`${name}: etichetta sconosciuta "${String(v.label)}".`);
    }
    if (typeof v.note === "string" && v.note.trim()) entry.note = v.note.trim();
    if (entry.label || entry.note) entries.push(entry);
  }
  return { entries, errors };
}
