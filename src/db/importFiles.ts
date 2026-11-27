import { netImbalance, parseHand } from "../parser/parseHand";
import { splitHands } from "../parser/splitHands";
import { sessionIdOf } from "../stats/sessions";
import type { Hand } from "../types";
import type { PokerDB } from "./schema";
import { recomputeSessions } from "./sessionsStore";

export interface RejectedHand {
  file: string;
  handId?: string;
  reason: string;
}

export interface ImportReport {
  files: number;
  /** Mani lette nei file (comprese le scartate). */
  read: number;
  added: number;
  duplicates: number;
  rejected: RejectedHand[];
  /** Mani in cui Σnet ≠ −rake (importate ma da controllare). */
  imbalanced: string[];
  /** Righe non riconosciute (per la modalità debug). */
  unknownLines: { handId: string; line: string }[];
  sessionsUpdated: number;
}

export interface TextFile {
  name: string;
  text: string;
}

/** Importa testi di hand history. Idempotente: le mani già presenti si saltano. */
export async function importTexts(database: PokerDB, files: TextFile[]): Promise<ImportReport> {
  const report: ImportReport = {
    files: files.length, read: 0, added: 0, duplicates: 0,
    rejected: [], imbalanced: [], unknownLines: [], sessionsUpdated: 0,
  };
  const parsed = new Map<string, Hand>();

  for (const file of files) {
    for (const text of splitHands(file.text)) {
      report.read++;
      const r = parseHand(text);
      if (!r.ok) {
        const rejected: RejectedHand = { file: file.name, reason: r.reason };
        if (r.handId) rejected.handId = r.handId;
        report.rejected.push(rejected);
        continue;
      }
      if (parsed.has(r.hand.id)) {
        report.duplicates++;
        continue;
      }
      parsed.set(r.hand.id, r.hand);
      for (const line of r.unknownLines) report.unknownLines.push({ handId: r.hand.id, line });
      if (netImbalance(r.hand) !== 0) report.imbalanced.push(r.hand.id);
    }
  }

  const ids = [...parsed.keys()];
  const existing = await database.hands.bulkGet(ids);
  const fresh = [...parsed.values()].filter((_, i) => existing[i] === undefined);
  report.duplicates += ids.length - fresh.length;
  report.added = fresh.length;

  if (fresh.length > 0) {
    await database.transaction("rw", database.hands, database.sessions, database.settings, async () => {
      await database.hands.bulkPut(fresh);
      report.sessionsUpdated = await recomputeSessions(database, fresh.map(sessionIdOf));
    });
  }
  return report;
}

/** Legge i File del browser e li importa. */
export async function importFiles(database: PokerDB, files: File[]): Promise<ImportReport> {
  const texts = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
  return importTexts(database, texts);
}
