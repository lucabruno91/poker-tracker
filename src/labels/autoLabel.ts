import type { Counters, Label, PlayerProfile } from "../types";

export const MIN_HANDS_FOR_LABEL = 15;
export const SMALL_SAMPLE_HANDS = 45;

/** Etichetta automatica (solo suggerimento, SPEC §6.6). */
export function autoLabel(c: Counters): Label | null {
  if (c.hands < MIN_HANDS_FOR_LABEL) return null;
  const vpip = (100 * c.vpip) / c.hands;
  const pfr = (100 * c.pfr) / c.hands;
  if (vpip >= 55) return "Balena";
  if (vpip >= 35 && vpip - pfr >= 10) return "Fish";
  if (vpip <= 15) return "Roccia";
  return null;
}

export type LabelSource = "user" | "claude" | "auto";

export interface EffectiveLabel {
  label: Label | null;
  source: LabelSource | null;
  /** Meno di 15 mani e nessuna etichetta: «da osservare». */
  toObserve: boolean;
  /** Meno di 45 mani: campione piccolo. */
  smallSample: boolean;
}

/** Precedenza: utente > Claude > automatica. */
export function effectiveLabel(profile: PlayerProfile | undefined, c: Counters): EffectiveLabel {
  const smallSample = c.hands < SMALL_SAMPLE_HANDS;
  if (profile?.label) return { label: profile.label, source: "user", toObserve: false, smallSample };
  if (profile?.claudeLabel) return { label: profile.claudeLabel, source: "claude", toObserve: false, smallSample };
  const auto = autoLabel(c);
  return {
    label: auto,
    source: auto ? "auto" : null,
    toObserve: c.hands < MIN_HANDS_FOR_LABEL,
    smallSample,
  };
}
