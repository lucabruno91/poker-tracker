import type { Player, Position } from "../types";

const BACKWARD_FROM_BUTTON: Position[] = ["CO", "HJ", "UTG"];

/**
 * Posizioni secondo SPEC §6.4: SB e BB dalle righe dei blind, BTN dal seat del
 * bottone, poi CO, HJ, UTG andando a ritroso dal bottone tra i giocatori presenti.
 * In heads-up il bottone posta lo small blind e resta etichettato BTN.
 */
export function assignPositions(
  players: Player[],
  buttonSeat: number,
  sbName: string | null,
  bbName: string | null,
): Record<string, Position> {
  const positions: Record<string, Position> = {};
  if (sbName) positions[sbName] = "SB";
  if (bbName) positions[bbName] = "BB";

  const button = players.find((p) => p.seat === buttonSeat);
  if (button) positions[button.name] = "BTN";

  // Ordine ciclico a ritroso partendo dal seat subito prima del bottone.
  const bySeatDesc = [...players].sort((a, b) => b.seat - a.seat);
  const before = bySeatDesc.filter((p) => p.seat < buttonSeat);
  const after = bySeatDesc.filter((p) => p.seat > buttonSeat);
  const backward = [...before, ...after];

  let i = 0;
  for (const p of backward) {
    if (positions[p.name]) continue;
    positions[p.name] = BACKWARD_FROM_BUTTON[i] ?? "EP";
    i++;
  }
  return positions;
}
