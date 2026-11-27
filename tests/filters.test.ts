import { describe, expect, it } from "vitest";
import {
  addDays, availableStakes, dateRange, filterSessions, isActive, localToday, NO_FILTER, parseFilter, stakeOf,
} from "../src/stats/filters";
import { buildSessions } from "../src/stats/sessions";
import { handsOf } from "./helpers";

const hands = ["example.txt", "sidepot.txt", "headsup.txt", "limp.txt"].flatMap(handsOf);
const byId = new Map(hands.map((h) => [h.id, h]));
const sessions = buildSessions(hands, "HeroPlayer");
// Date delle sessioni sintetiche: 24/11 (Duotable), 25/11 (Testtable, Quattro), 26/11 (Duotable).
const TODAY = "2026-11-27";
const dates = (f: Parameters<typeof filterSessions>[2], today = TODAY) =>
  filterSessions(sessions, byId, f, today).map((s) => s.date).sort();

describe("date", () => {
  it("addDays attraversa mesi e anni", () => {
    expect(addDays("2026-11-27", -6)).toBe("2026-11-21");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("intervalli dei periodi (estremi inclusi)", () => {
    expect(dateRange({ period: "7d" }, TODAY)).toEqual({ from: "2026-11-21", to: TODAY });
    expect(dateRange({ period: "30d" }, TODAY)).toEqual({ from: "2026-10-29", to: TODAY });
    expect(dateRange(NO_FILTER, TODAY)).toEqual({});
  });

  it("data locale di oggi", () => {
    expect(localToday(new Date(2026, 10, 5, 23, 59))).toBe("2026-11-05");
  });
});

describe("filterSessions", () => {
  it("nessun filtro: tutte le sessioni", () => {
    expect(filterSessions(sessions, byId, NO_FILTER, TODAY)).toEqual(sessions);
  });

  it("ultimi 7 giorni rispetto a oggi", () => {
    expect(dates({ period: "7d" })).toHaveLength(4);
    expect(dates({ period: "7d" }, "2026-12-01")).toEqual(["2026-11-25", "2026-11-25", "2026-11-26"]);
    expect(dates({ period: "7d" }, "2027-01-15")).toEqual([]);
  });

  it("intervallo personalizzato con estremi inclusi", () => {
    expect(dates({ period: "custom", from: "2026-11-24", to: "2026-11-24" })).toEqual(["2026-11-24"]);
    expect(dates({ period: "custom", from: "2026-11-25" })).toEqual(["2026-11-25", "2026-11-25", "2026-11-26"]);
    expect(dates({ period: "custom", to: "2026-11-25" })).toEqual(["2026-11-24", "2026-11-25", "2026-11-25"]);
  });

  it("stake", () => {
    expect(stakeOf({ sb: 1, bb: 2 })).toBe("€0,01/€0,02");
    expect(stakeOf({ sb: 25, bb: 50 })).toBe("€0,25/€0,50");
    expect(availableStakes(hands)).toEqual(["€0,01/€0,02"]);
    expect(dates({ period: "all", stake: "€0,01/€0,02" })).toHaveLength(4);
    expect(dates({ period: "all", stake: "€0,02/€0,05" })).toEqual([]);
  });
});

describe("filtro salvato", () => {
  it("isActive", () => {
    expect(isActive(NO_FILTER)).toBe(false);
    expect(isActive({ period: "custom" })).toBe(false);
    expect(isActive({ period: "custom", from: "2026-11-01" })).toBe(true);
    expect(isActive({ period: "7d" })).toBe(true);
    expect(isActive({ period: "all", stake: "€0,01/€0,02" })).toBe(true);
  });

  it("parseFilter ignora valori non validi", () => {
    expect(parseFilter(null)).toEqual(NO_FILTER);
    expect(parseFilter("{rotto")).toEqual(NO_FILTER);
    expect(parseFilter(JSON.stringify({ period: "boh" }))).toEqual(NO_FILTER);
    expect(parseFilter(JSON.stringify({ period: "custom", from: "2026-11-01", to: "ieri" }))).toEqual({
      period: "custom", from: "2026-11-01",
    });
    expect(parseFilter(JSON.stringify({ period: "7d", from: "2026-11-01", stake: "€0,01/€0,02" }))).toEqual({
      period: "7d", stake: "€0,01/€0,02",
    });
  });
});
