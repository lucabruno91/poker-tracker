import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { buildClaudeExport, heroStatsLine } from "../src/export/claudeExport";
import { parseClaudeLabels } from "../src/labels/claudeLabels";
import { applyClaudeLabels } from "../src/db/profiles";
import { applySeed, parseSeed } from "../src/db/seed";
import { PokerDB } from "../src/db/schema";
import { importTexts } from "../src/db/importFiles";
import { buildSession } from "../src/stats/sessions";
import { shownCards, summarizePlayers, tableOpponents } from "../src/stats/players";
import { emptyCounters } from "../src/stats/aggregate";
import { formatBb, formatEuro, formatPct, formatAf } from "../src/ui/format";
import { handsOf, oneHand } from "./helpers";

describe("formattazione", () => {
  it("euro e bb all'italiana", () => {
    expect(formatEuro(436, true)).toBe("+€4,36");
    expect(formatEuro(-101, true)).toBe("−€1,01");
    expect(formatEuro(97)).toBe("€0,97");
    expect(formatEuro(0, true)).toBe("€0,00");
    expect(formatBb(218)).toBe("+218,0 bb");
    expect(formatBb(-157.5)).toBe("−157,5 bb");
    expect(formatPct({ value: 0.344, cases: 10 })).toBe("34%");
    expect(formatAf({ value: 1.875, cases: 8 })).toBe("1,9");
    expect(formatPct({ value: null, cases: 0 })).toBe("—");
  });
});

describe("esportazione per Claude", () => {
  const hands = handsOf("headsup.txt").slice(0, 2);
  const session = buildSession(hands, "HeroPlayer");

  it("produce il formato della SPEC §9", () => {
    const text = buildClaudeExport({
      session, hands, hero: "HeroPlayer",
      selectedIds: ["262800000011", "262800000010"],
      labelOf: (n) => (n === "VillainHU" ? "Fish" : null),
    });
    const lines = text.split("\n");
    expect(lines[0]).toBe("SESSIONE Duotable II — 2026-11-24 — 2 mani");
    expect(lines[1]).toBe("Risultato hero: −99,0 bb (−€1,98), ricariche €2,00, stack finale €2,02");
    expect(lines[2]).toMatch(/^Hero: VPIP 100% · PFR 100% · 3-bet 100% \(1 casi\) · C-bet /);
    expect(lines[3]).toBe("Avversari principali: VillainHU 2 mani 50/50 [Fish]");
    expect(lines[4]).toBe("");
    expect(lines[5]).toBe("MANI SELEZIONATE");
    expect(text).toContain(`${hands[0]?.raw}\n\n\n${hands[1]?.raw}`);
  });

  it("senza mani selezionate non aggiunge la sezione", () => {
    const text = buildClaudeExport({ session, hands, hero: "HeroPlayer", selectedIds: [], labelOf: () => null });
    expect(text).not.toContain("MANI SELEZIONATE");
  });

  it("riga statistiche con valori mancanti", () => {
    expect(heroStatsLine(emptyCounters())).toBe("VPIP — · PFR — · 3-bet — (0 casi) · C-bet — · WTSD — · W$SD — · AF —");
  });
});

describe("etichette di Claude", () => {
  it("legge il JSON e segnala le etichette sconosciute", () => {
    const r = parseClaudeLabels(JSON.stringify({
      a: { label: "Fish", note: "paga" },
      b: { label: "Squalo" },
      c: { note: "solo nota" },
    }));
    expect(r.entries).toEqual([{ name: "a", label: "Fish", note: "paga" }, { name: "c", note: "solo nota" }]);
    expect(r.errors).toEqual(['b: etichetta sconosciuta "Squalo".']);
    expect(parseClaudeLabels("[").errors).toHaveLength(1);
  });

  it("non tocca le etichette dell'utente; i dati iniziali sono idempotenti", async () => {
    const database = new PokerDB("test-labels");
    await database.open();
    await database.profiles.put({ name: "VillainHU", label: "Regular forte", note: "mia nota" });
    await applyClaudeLabels(database, [{ name: "VillainHU", label: "Fish", note: "di Claude" }]);
    expect(await database.profiles.get("VillainHU")).toEqual({
      name: "VillainHU", label: "Regular forte", note: "mia nota", claudeLabel: "Fish", claudeNote: "di Claude",
    });

    await importTexts(database, [{ name: "x", text: handsOf("headsup.txt")[0]?.raw ?? "" }]);
    const { seed, errors } = parseSeed(JSON.stringify(SEED));
    expect(errors).toEqual([]);
    const r1 = await applySeed(database, seed);
    expect(r1).toEqual({ profiles: 2, summaries: 1, missingTables: ["Altro tavolo"] });
    expect((await database.profiles.get("VillainHU"))?.claudeLabel).toBe("Regular con leak");
    expect((await database.profiles.get("VillainHU"))?.label).toBe("Regular forte");
    expect((await database.profiles.get("Ab9//123"))?.claudeLabel).toBe("Balena");
    expect((await database.sessions.get("Duotable II|2026-11-24"))?.summary).toBe("Riepilogo di prova");

    const r2 = await applySeed(database, seed);
    expect(r2.summaries).toBe(0);
    expect(await database.profiles.count()).toBe(2);
    await database.delete();
  });

  it("segnala etichette e riepiloghi non validi nei dati iniziali", () => {
    const { seed, errors } = parseSeed(
      JSON.stringify({ players: { a: { label: "Squalo" }, b: { label: "Fish" } }, sessionSummaries: { t: 3 } }),
    );
    expect(seed.players).toEqual([{ name: "b", label: "Fish" }]);
    expect(errors).toHaveLength(2);
    expect(parseSeed("{").errors).toEqual(["Il file non è un JSON valido."]);
  });
});

const SEED = {
  players: {
    VillainHU: { label: "Regular con leak", note: "nota di prova" },
    "Ab9//123": { label: "Balena" },
  },
  sessionSummaries: { "Duotable II": "Riepilogo di prova", "Altro tavolo": "non importato" },
};

describe("riepilogo giocatori", () => {
  it("somma su più mani, sessioni e showdown", () => {
    const players = summarizePlayers(handsOf("headsup.txt"));
    const v = players.get("VillainHU");
    expect(v?.counters.hands).toBe(3);
    expect(v?.sessionIds.sort()).toEqual(["Duotable II|2026-11-24", "Duotable II|2026-11-26"]);
    expect(v?.showdownHandIds).toEqual(["262800000010"]);
    expect(v?.lastPlayedAt).toBe("2026-11-26T20:00:00");
  });

  it("legge le carte mostrate dal riepilogo", () => {
    const h = oneHand("sidepot.txt");
    expect(shownCards(h, "Ab9//123")).toBe("7c 2d");
    expect(shownCards(h, "SitterX")).toBeNull();
  });
});

describe("tableOpponents", () => {
  it("avversari delle mani date, dal più presente, senza l'hero", () => {
    const rows = tableOpponents(handsOf("headsup.txt").concat(handsOf("example.txt")), "HeroPlayer");
    expect(rows[0]).toMatchObject({ name: "VillainHU" });
    expect(rows[0]?.counters.hands).toBe(3);
    expect(rows.some((r) => r.name === "HeroPlayer")).toBe(false);
    // A parità di mani, ordine alfabetico.
    expect(rows.slice(1).map((r) => r.name)).toEqual(["AlphaOne", "BetaTwo", "DeltaFive", "EpsSix", "GammaFour"]);
  });
});
