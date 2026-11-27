import type { Hand, HandNote, PlayerProfile, Session } from "../types";
import type { PokerDB, Setting } from "./schema";
import { recomputeAllSessions } from "./sessionsStore";

/** v2 aggiunge `handNotes`; i backup v1 si possono ancora importare. */
export const BACKUP_VERSION = 2;
const SUPPORTED_VERSIONS = [1, 2];

export interface Backup {
  version: number;
  exportedAt: string;
  hands: Hand[];
  sessions: Session[];
  profiles: PlayerProfile[];
  settings: Setting[];
  /** Segnalibri e note sulle mani (assente nei backup v1). */
  handNotes: HandNote[];
}

export async function exportBackup(database: PokerDB): Promise<Backup> {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    hands: await database.hands.toArray(),
    sessions: await database.sessions.toArray(),
    profiles: await database.profiles.toArray(),
    settings: await database.settings.toArray(),
    handNotes: await database.handNotes.toArray(),
  };
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/** Controllo di forma del file di backup; lancia un errore leggibile. */
export function parseBackup(json: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Il file non è un JSON valido.");
  }
  if (!isObject(data)) throw new Error("Il file non è un backup del tracker.");
  if (typeof data.version !== "number" || !SUPPORTED_VERSIONS.includes(data.version)) {
    throw new Error(`Versione del backup non supportata: ${String(data.version)}`);
  }
  for (const key of ["hands", "sessions", "profiles", "settings"] as const) {
    if (!Array.isArray(data[key])) throw new Error(`Backup incompleto: manca "${key}".`);
  }
  if (data.version >= 2 && !Array.isArray(data.handNotes)) throw new Error('Backup incompleto: manca "handNotes".');
  return { ...(data as unknown as Backup), handNotes: Array.isArray(data.handNotes) ? (data.handNotes as HandNote[]) : [] };
}

export type RestoreMode = "replace" | "merge";

export async function restoreBackup(database: PokerDB, backup: Backup, mode: RestoreMode): Promise<void> {
  const tables = [database.hands, database.sessions, database.profiles, database.settings, database.handNotes];
  await database.transaction("rw", tables, async () => {
    if (mode === "replace") {
      await Promise.all(tables.map((t) => t.clear()));
      await database.hands.bulkPut(backup.hands);
      await database.sessions.bulkPut(backup.sessions);
      await database.profiles.bulkPut(backup.profiles);
      await database.settings.bulkPut(backup.settings);
      await database.handNotes.bulkPut(backup.handNotes);
      return;
    }
    // Unione: mani deduplicate per ID; profili e impostazioni attuali hanno la
    // precedenza; i riepiloghi delle sessioni si conservano.
    await database.hands.bulkPut(backup.hands);
    for (const p of backup.profiles) {
      const current = await database.profiles.get(p.name);
      await database.profiles.put({ ...p, ...current });
    }
    for (const s of backup.settings) {
      if (!(await database.settings.get(s.key))) await database.settings.put(s);
    }
    // Note sulle mani: vale la più recente tra quella attuale e quella del backup.
    for (const n of backup.handNotes) {
      const current = await database.handNotes.get(n.handId);
      if (!current || current.updatedAt < n.updatedAt) await database.handNotes.put(n);
    }
    for (const s of backup.sessions) {
      const current = await database.sessions.get(s.id);
      if (!current) await database.sessions.put(s);
      else if (!current.summary && s.summary) await database.sessions.put({ ...current, summary: s.summary });
    }
    await recomputeAllSessions(database);
  });
}

export async function clearAllData(database: PokerDB): Promise<void> {
  const tables = [database.hands, database.sessions, database.profiles, database.settings, database.handNotes];
  await database.transaction("rw", tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
  });
}
