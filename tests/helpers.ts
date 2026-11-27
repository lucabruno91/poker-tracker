import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHand } from "../src/parser/parseHand";
import { splitHands } from "../src/parser/splitHands";
import type { Hand } from "../src/types";
import { expect } from "vitest";
import { chipsInPlay, type ReplayStep } from "../src/stats/replay";

export function readFixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf8");
}

/** Tutte le mani di una fixture sintetica; fallisce se una non è valida. */
export function handsOf(name: string): Hand[] {
  return splitHands(readFixture(name)).map((text) => {
    const r = parseHand(text);
    if (!r.ok) throw new Error(`${name}: ${r.reason}`);
    return r.hand;
  });
}

export function oneHand(name: string): Hand {
  const h = handsOf(name)[0];
  if (!h) throw new Error(`${name}: nessuna mano`);
  return h;
}

/** Invarianti della SPEC §6.12, valide per qualsiasi mano. */
export function checkReplay(hand: Hand, steps: ReplayStep[]): void {
  const initial = hand.players.reduce((a, p) => a + p.stack, 0);
  for (const [i, s] of steps.entries()) {
    expect(chipsInPlay(s), `${hand.id} passo ${i}: ${s.text}`).toBe(initial);
    for (const seat of s.seats) expect(seat.stack, `${hand.id} passo ${i} ${seat.name}`).toBeGreaterThanOrEqual(0);
  }
  const last = steps[steps.length - 1];
  if (!last) throw new Error("nessun passo");
  expect(last.phase).toBe("END");
  expect(last.pot).toBe(0);
  expect(last.rake).toBe(hand.rake);
  for (const p of hand.players) {
    const seat = last.seats.find((s) => s.name === p.name);
    expect(seat?.stack, `${hand.id} ${p.name}`).toBe(p.stack + (hand.net[p.name] ?? 0));
    expect(seat?.bet).toBe(0);
  }
}
