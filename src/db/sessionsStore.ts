import { buildSession, detectHero, sessionDate, sessionIdOf } from "../stats/sessions";
import { HERO_KEY, getSetting, setSetting, type PokerDB } from "./schema";

/** Nome dell'hero dalle impostazioni; se manca, lo deduce dalle mani e lo salva. */
export async function resolveHero(database: PokerDB): Promise<string | null> {
  const saved = await getSetting(database, HERO_KEY);
  if (typeof saved === "string" && saved.trim()) return saved.trim();
  const detected = detectHero(await database.hands.toArray());
  if (detected) await setSetting(database, HERO_KEY, detected);
  return detected;
}

/** Ricalcola le sessioni indicate, mantenendo il riepilogo scritto dall'utente. */
export async function recomputeSessions(database: PokerDB, ids: Iterable<string>): Promise<number> {
  const hero = await resolveHero(database);
  if (!hero) return 0;
  let count = 0;
  for (const id of new Set(ids)) {
    const sep = id.lastIndexOf("|");
    const table = id.slice(0, sep);
    const date = id.slice(sep + 1);
    const hands = (await database.hands.where("table").equals(table).toArray()).filter(
      (h) => sessionDate(h) === date,
    );
    const existing = await database.sessions.get(id);
    if (hands.length === 0) {
      if (existing) await database.sessions.delete(id);
      continue;
    }
    await database.sessions.put(buildSession(hands, hero, existing?.summary));
    count++;
  }
  return count;
}

export async function recomputeAllSessions(database: PokerDB): Promise<number> {
  const ids = new Set<string>();
  await database.hands.each((h) => {
    ids.add(sessionIdOf(h));
  });
  for (const s of await database.sessions.toArray()) ids.add(s.id);
  return recomputeSessions(database, ids);
}
