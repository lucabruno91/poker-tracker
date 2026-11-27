import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { PokerDB, HERO_KEY } from "../db/schema";
import { compareHandIds } from "../stats/sessions";
import { summarizePlayers, type PlayerSummary } from "../stats/players";
import { emptyCounters } from "../stats/aggregate";
import { effectiveLabel, type EffectiveLabel } from "../labels/autoLabel";
import type { Hand, PlayerProfile, Session } from "../types";

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
