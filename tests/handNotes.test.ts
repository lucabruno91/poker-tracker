import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { PokerDB } from "../src/db/schema";
import { saveHandNote, hasNote } from "../src/db/handNotes";
import { clearAllData, exportBackup, parseBackup, restoreBackup } from "../src/db/backup";
import { importTexts } from "../src/db/importFiles";
import { filterHands, handQuery, parseHandQuery } from "../src/stats/handFilters";
import { handsOf, readFixture } from "./helpers";

let n = 0;
const opened: Dexie[] = [];
const fresh = async () => {
  const d = new PokerDB(`notes-${n++}`);
  await d.open();
  opened.push(d);
  return d;
};
afterEach(async () => {
  for (const d of opened.splice(0)) await d.delete();
});

describe("migrazione v1 → v2", () => {
  it("apre un archivio v1 esistente senza toccare i dati e aggiunge handNotes", async () => {
    const name = `migr-${n++}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ hands: "id, table, playedAt", sessions: "id, date", profiles: "name", settings: "key" });
    await v1.open();
    await v1.table("profiles").put({ name: "VillainHU", label: "Fish" });
    await v1.table("settings").put({ key: "heroName", value: "HeroPlayer" });
    v1.close();

    const v2 = new PokerDB(name);
    await v2.open();
    opened.push(v2);
    expect(v2.verno).toBe(2);
    expect(await v2.profiles.get("VillainHU")).toEqual({ name: "VillainHU", label: "Fish" });
    expect((await v2.settings.get("heroName"))?.value).toBe("HeroPlayer");
    expect(await v2.handNotes.count()).toBe(0);
  });
});

describe("saveHandNote", () => {
  it("salva tag e nota, deduplica i tag, cancella il record vuoto", async () => {
    const db = await fresh();
    await saveHandNote(db, "1", ["errore", "errore", "rivedere"], "  troppo largo  ");
    const saved = await db.handNotes.get("1");
    expect(saved).toMatchObject({ handId: "1", tags: ["errore", "rivedere"], note: "troppo largo" });
    expect(hasNote(saved)).toBe(true);
    await saveHandNote(db, "1", [], "   ");
    expect(await db.handNotes.get("1")).toBeUndefined();
    expect(hasNote(undefined)).toBe(false);
  });
});

describe("backup con le note", () => {
  it("v2: andata e ritorno, e l'eliminazione cancella anche le note", async () => {
    const db = await fresh();
    await importTexts(db, [{ name: "hu", text: readFixture("headsup.txt") }]);
    await saveHandNote(db, "262800000010", ["cooler"], "QQ contro AK");
    const json = JSON.stringify(await exportBackup(db));
    expect(JSON.parse(json).version).toBe(2);
    await clearAllData(db);
    expect(await db.handNotes.count()).toBe(0);
    await restoreBackup(db, parseBackup(json), "replace");
    expect(await db.handNotes.get("262800000010")).toMatchObject({ tags: ["cooler"], note: "QQ contro AK" });
  });

  it("v1 (senza note) si importa ancora", async () => {
    const db = await fresh();
    const v1 = { version: 1, exportedAt: "2026-11-01T00:00:00Z", hands: [], sessions: [], profiles: [], settings: [] };
    const b = parseBackup(JSON.stringify(v1));
    expect(b.handNotes).toEqual([]);
    await restoreBackup(db, b, "merge");
    expect(await db.handNotes.count()).toBe(0);
    expect(() => parseBackup(JSON.stringify({ ...v1, version: 2 }))).toThrow(/handNotes/);
  });

  it("unione: vince la nota più recente", async () => {
    const db = await fresh();
    await db.handNotes.put({ handId: "a", tags: ["errore"], updatedAt: "2026-11-27T10:00:00Z" });
    await db.handNotes.put({ handId: "b", tags: ["bluff"], updatedAt: "2026-11-27T10:00:00Z" });
    const backup = parseBackup(JSON.stringify({
      version: 2, exportedAt: "x", hands: [], sessions: [], profiles: [], settings: [],
      handNotes: [
        { handId: "a", tags: ["cooler"], updatedAt: "2026-11-27T12:00:00Z" }, // più recente: vince
        { handId: "b", tags: ["buona"], updatedAt: "2026-11-27T08:00:00Z" }, // più vecchia: resta quella attuale
        { handId: "c", tags: ["rivedere"], updatedAt: "2026-11-27T08:00:00Z" }, // nuova
      ],
    }));
    await restoreBackup(db, backup, "merge");
    expect((await db.handNotes.get("a"))?.tags).toEqual(["cooler"]);
    expect((await db.handNotes.get("b"))?.tags).toEqual(["bluff"]);
    expect((await db.handNotes.get("c"))?.tags).toEqual(["rivedere"]);
  });
});

describe("filtro per tag", () => {
  const hands = ["example.txt", "headsup.txt"].flatMap(handsOf);
  const notes = new Map([
    ["262800000001", { handId: "262800000001", tags: ["errore" as const], updatedAt: "x" }],
    ["262800000010", { handId: "262800000010", tags: [], note: "solo nota", updatedAt: "x" }],
  ]);
  const ids = (tag: "errore" | "cooler" | "any") =>
    filterHands(hands, "HeroPlayer", { sort: "recent", tag }, notes).map((h) => h.id.slice(-2));

  it("per tag preciso o con un tag/nota qualsiasi", () => {
    expect(ids("errore")).toEqual(["01"]);
    expect(ids("cooler")).toEqual([]);
    expect(ids("any").sort()).toEqual(["01", "10"]);
  });

  it("nella query dell'URL", () => {
    expect(handQuery({ sort: "recent", tag: "any" })).toBe("tag=qualsiasi");
    expect(parseHandQuery("tag=qualsiasi")).toEqual({ sort: "recent", tag: "any" });
    expect(parseHandQuery("tag=errore")).toEqual({ sort: "recent", tag: "errore" });
    expect(parseHandQuery("tag=boh")).toEqual({ sort: "recent" });
  });
});
