import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHand } from "../src/parser/parseHand";
import { splitHands } from "../src/parser/splitHands";
import type { Hand } from "../src/types";

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
