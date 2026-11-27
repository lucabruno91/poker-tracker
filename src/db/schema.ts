import Dexie, { type Table } from "dexie";
import type { Hand, PlayerProfile, Session } from "../types";

export type SettingValue = string | number | boolean | null;

export interface Setting {
  key: string;
  value: SettingValue;
}

export class PokerDB extends Dexie {
  hands!: Table<Hand, string>;
  sessions!: Table<Session, string>;
  profiles!: Table<PlayerProfile, string>;
  settings!: Table<Setting, string>;

  constructor(name = "poker-tracker") {
    super(name);
    this.version(1).stores({
      hands: "id, table, playedAt",
      sessions: "id, date",
      profiles: "name",
      settings: "key",
    });
  }
}

export const HERO_KEY = "heroName";
export const SEED_KEY = "seedApplied";

export async function getSetting(database: PokerDB, key: string): Promise<SettingValue | undefined> {
  return (await database.settings.get(key))?.value;
}

export async function setSetting(database: PokerDB, key: string, value: SettingValue): Promise<void> {
  await database.settings.put({ key, value });
}
