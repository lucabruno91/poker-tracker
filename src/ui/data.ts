import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { PokerDB, HERO_KEY } from "../db/schema";
import { compareHandIds } from "../stats/sessions";
import { summarizePlayers, type PlayerSummary } from "../stats/players";
import { emptyCounters } from "../stats/aggregate";
import { filterSessions, isActive, localToday, parseFilter, type Filter } from "../stats/filters";
import { effectiveLabel, type EffectiveLabel } from "../labels/autoLabel";
import type { Hand, HandNote, PlayerProfile, Session } from "../types";

/** Unico database dell'app (i test ne creano di propri). */
export const db = new PokerDB();

export interface AppData {
  loading: boolean;
  hands: Hand[];
  handsById: Map<string, Hand>;
  /** Dalla più vecchia alla più recente. */
  sessions: Session[];
  profiles: Map<string, PlayerProfile>;
  hero: string | null;
}

export function useAppData(): AppData {
  const hands = useLiveQuery(() => db.hands.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const profiles = useLiveQuery(() => db.profiles.toArray(), []);
  const hero = useLiveQuery(async () => (await db.settings.get(HERO_KEY))?.value ?? null, []);

  return useMemo(() => {
    const sortedSessions = [...(sessions ?? [])].sort((a, b) =>
      compareHandIds(a.handIds[0] ?? "", b.handIds[0] ?? ""),
    );
    return {
      loading: hands === undefined || sessions === undefined || profiles === undefined,
      hands: hands ?? [],
      handsById: new Map((hands ?? []).map((h) => [h.id, h])),
      sessions: sortedSessions,
      profiles: new Map((profiles ?? []).map((p) => [p.name, p])),
      hero: typeof hero === "string" ? hero : null,
    };
  }, [hands, sessions, profiles, hero]);
}

const FILTER_KEY = "filters";

export interface FilterState {
  filter: Filter;
  setFilter: (f: Filter) => void;
  /** Sessioni che rispettano il filtro, nello stesso ordine di `data.sessions`. */
  sessions: Session[];
  active: boolean;
  today: string;
}

/** Filtro per periodo e stake, salvato tra le visite (impostazione `filters`). */
export function useFilter(data: AppData): FilterState {
  const saved = useLiveQuery(async () => (await db.settings.get(FILTER_KEY))?.value ?? null, []);
  const filter = useMemo(() => parseFilter(typeof saved === "string" ? saved : null), [saved]);
  const today = localToday();
  const sessions = useMemo(
    () => filterSessions(data.sessions, data.handsById, filter, today),
    [data.sessions, data.handsById, filter, today],
  );
  const setFilter = (f: Filter) => {
    void db.settings.put({ key: FILTER_KEY, value: JSON.stringify(f) });
  };
  return { filter, setFilter, sessions, active: isActive(filter), today };
}

/** Segnalibri e note sulle mani, per hand ID (aggiornati dal vivo). */
export function useHandNotes(): Map<string, HandNote> {
  const notes = useLiveQuery(() => db.handNotes.toArray(), []);
  return useMemo(() => new Map((notes ?? []).map((n) => [n.handId, n])), [notes]);
}

export function usePlayers(hands: Hand[]): Map<string, PlayerSummary> {
  return useMemo(() => summarizePlayers(hands), [hands]);
}

export function labelFor(
  name: string,
  players: Map<string, PlayerSummary>,
  profiles: Map<string, PlayerProfile>,
): EffectiveLabel {
  return effectiveLabel(profiles.get(name), players.get(name)?.counters ?? emptyCounters());
}
