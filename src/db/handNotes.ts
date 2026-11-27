import { HAND_TAGS, type HandNote, type HandTag } from "../types";
import type { PokerDB } from "./schema";

export function isHandTag(x: unknown): x is HandTag {
  return typeof x === "string" && Object.hasOwn(HAND_TAGS, x);
}

/**
 * Salva tag e nota di una mano. Senza tag e con la nota vuota il record viene
 * cancellato, così l'archivio non si riempie di note vuote.
 */
export async function saveHandNote(database: PokerDB, handId: string, tags: HandTag[], note: string): Promise<void> {
  const clean = [...new Set(tags.filter(isHandTag))];
  const text = note.trim();
  if (clean.length === 0 && !text) {
    await database.handNotes.delete(handId);
    return;
  }
  const record: HandNote = { handId, tags: clean, updatedAt: new Date().toISOString() };
  if (text) record.note = text;
  await database.handNotes.put(record);
}

/** Vero se la mano ha almeno un tag o una nota. */
export function hasNote(n: HandNote | undefined): boolean {
  return Boolean(n && (n.tags.length > 0 || n.note));
}
