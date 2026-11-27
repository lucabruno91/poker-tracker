import type { ClaudeLabelEntry } from "../labels/claudeLabels";
import type { Label, PlayerProfile } from "../types";
import type { PokerDB } from "./schema";

/** Scrive etichetta e nota di Claude senza toccare quelle dell'utente. */
export async function applyClaudeLabels(database: PokerDB, entries: ClaudeLabelEntry[]): Promise<number> {
  await database.transaction("rw", database.profiles, async () => {
    for (const e of entries) {
      const current: PlayerProfile = (await database.profiles.get(e.name)) ?? { name: e.name };
      const next: PlayerProfile = { ...current };
      if (e.label) next.claudeLabel = e.label;
      if (e.note) next.claudeNote = e.note;
      await database.profiles.put(next);
    }
  });
  return entries.length;
}

/** Aggiorna etichetta e nota dell'utente; valori vuoti le cancellano. */
export async function saveUserProfile(
  database: PokerDB,
  name: string,
  label: Label | undefined,
  note: string,
): Promise<void> {
  const current: PlayerProfile = (await database.profiles.get(name)) ?? { name };
  const next: PlayerProfile = { ...current };
  if (label) next.label = label;
  else delete next.label;
  if (note.trim()) next.note = note.trim();
  else delete next.note;
  await database.profiles.put(next);
}
