import { parseClaudeLabels, type ClaudeLabelEntry } from "../labels/claudeLabels";
import { applyClaudeLabels } from "./profiles";
import type { PokerDB } from "./schema";

/**
 * Dati iniziali: etichette e note di Claude sugli avversari e riepiloghi delle
 * sessioni. Contengono nomi di altri giocatori, quindi NON stanno nel codice:
 * si importano da un file JSON locale (vedi README):
 *
 * { "players": { "nome": { "label": "Fish", "note": "..." } },
 *   "sessionSummaries": { "Nome tavolo": "riepilogo" } }
 */
export interface SeedData {
  players: ClaudeLabelEntry[];
  sessionSummaries: Record<string, string>;
}

export interface SeedParse {
  seed: SeedData;
  errors: string[];
}

export function parseSeed(json: string): SeedParse {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { seed: { players: [], sessionSummaries: {} }, errors: ["Il file non è un JSON valido."] };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { seed: { players: [], sessionSummaries: {} }, errors: ["Formato dei dati iniziali non valido."] };
  }
  const obj = data as Record<string, unknown>;
  const errors: string[] = [];

  const { entries, errors: labelErrors } =
    obj.players === undefined ? { entries: [], errors: [] } : parseClaudeLabels(JSON.stringify(obj.players));
  errors.push(...labelErrors);

  const sessionSummaries: Record<string, string> = {};
  if (obj.sessionSummaries !== undefined) {
    if (typeof obj.sessionSummaries !== "object" || obj.sessionSummaries === null) {
      errors.push("\"sessionSummaries\" deve essere un oggetto { \"tavolo\": \"riepilogo\" }.");
    } else {
      for (const [table, summary] of Object.entries(obj.sessionSummaries)) {
        if (typeof summary === "string" && summary.trim()) sessionSummaries[table] = summary.trim();
        else errors.push(`${table}: riepilogo non valido.`);
      }
    }
  }
  return { seed: { players: entries, sessionSummaries }, errors };
}

export interface SeedResult {
  profiles: number;
  summaries: number;
  missingTables: string[];
}

/**
 * Applica i dati iniziali. Idempotente: le etichette vanno in claudeLabel/claudeNote
 * e i riepiloghi solo nelle sessioni che non ne hanno già uno.
 */
export async function applySeed(database: PokerDB, seed: SeedData): Promise<SeedResult> {
  const profiles = await applyClaudeLabels(database, seed.players);
  let summaries = 0;
  const missingTables: string[] = [];
  const sessions = await database.sessions.toArray();
  for (const [table, summary] of Object.entries(seed.sessionSummaries)) {
    const matching = sessions.filter((s) => s.table === table);
    if (matching.length === 0) {
      missingTables.push(table);
      continue;
    }
    for (const s of matching) {
      if (!s.summary) {
        await database.sessions.update(s.id, { summary });
        summaries++;
      }
    }
  }
  return { profiles, summaries, missingTables };
}
