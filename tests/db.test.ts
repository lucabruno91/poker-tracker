import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PokerDB, setSetting, HERO_KEY } from "../src/db/schema";
import { importTexts } from "../src/db/importFiles";
import { clearAllData, exportBackup, parseBackup, restoreBackup } from "../src/db/backup";
import { readFixture } from "./helpers";

let database: PokerDB;
let n = 0;

beforeEach(async () => {
  database = new PokerDB(`test-${n++}`);
  await database.open();
});

afterEach(async () => {
  await database.delete();
});

const files = () => [
  { name: "example.txt", text: readFixture("example.txt") },
  { name: "headsup.txt", text: readFixture("headsup.txt") },
  { name: "rejected.txt", text: readFixture("rejected.txt") },
];

describe("import", () => {
  it("importa, scarta con motivo e deduce l'hero", async () => {
    const r = await importTexts(database, files());
    expect(r).toMatchObject({ files: 3, read: 6, added: 4, duplicates: 0, imbalanced: [] });
    expect(r.rejected).toHaveLength(2);
    expect(r.rejected[0]?.reason).toMatch(/Intestazione/);
    expect(await database.hands.count()).toBe(4);
    expect(await database.sessions.count()).toBe(3);
    expect((await database.settings.get(HERO_KEY))?.value).toBe("HeroPlayer");
  });

  it("è idempotente: reimportare lo stesso file non cambia nulla", async () => {
    await importTexts(database, files());
    const before = await exportBackup(database);
    const r = await importTexts(database, files());
    expect(r).toMatchObject({ added: 0, duplicates: 4 });
    const after = await exportBackup(database);
    expect(after.hands).toEqual(before.hands);
    expect(after.sessions).toEqual(before.sessions);
  });

  it("conserva il riepilogo della sessione quando la ricalcola", async () => {
    await setSetting(database, HERO_KEY, "HeroPlayer");
    const [first, ...rest] = readFixture("headsup.txt").split(/\n{3,}/);
    await importTexts(database, [{ name: "a", text: first ?? "" }]);
    const id = "Duotable II|2026-11-24";
    await database.sessions.update(id, { summary: "nota" });
    await importTexts(database, [{ name: "b", text: rest.join("\n\n\n") }]);
    const s = await database.sessions.get(id);
    expect(s?.summary).toBe("nota");
    expect(s?.handIds).toHaveLength(2);
    expect(s?.rebuys).toBe(200);
  });
});

describe("backup", () => {
  it("andata e ritorno con sostituzione", async () => {
    await importTexts(database, files());
    await database.profiles.put({ name: "VillainHU", label: "Fish", note: "paga tutto" });
    const json = JSON.stringify(await exportBackup(database));
    await clearAllData(database);
    expect(await database.hands.count()).toBe(0);
    await restoreBackup(database, parseBackup(json), "replace");
    expect(await database.hands.count()).toBe(4);
    expect(await database.profiles.get("VillainHU")).toEqual({ name: "VillainHU", label: "Fish", note: "paga tutto" });
  });

  it("unione: le mani si deduplicano, i profili attuali hanno la precedenza", async () => {
    await importTexts(database, files());
    await database.profiles.put({ name: "VillainHU", label: "Fish" });
    const backup = await exportBackup(database);
    await database.profiles.put({ name: "VillainHU", label: "Roccia" });
    await restoreBackup(database, backup, "merge");
    expect(await database.hands.count()).toBe(4);
    expect((await database.profiles.get("VillainHU"))?.label).toBe("Roccia");
  });

  it("rifiuta file non validi", () => {
    expect(() => parseBackup("non json")).toThrow(/JSON/);
    expect(() => parseBackup(JSON.stringify({ version: 99 }))).toThrow(/Versione/);
    expect(() => parseBackup(JSON.stringify({ version: 1, hands: [] }))).toThrow(/sessions/);
  });
});
