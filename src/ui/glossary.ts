import type { Position } from "../types";
import type { StatKey } from "../stats/reference";

/**
 * Spiegazioni degli acronimi mostrate nei tooltip. Coerenti con le definizioni
 * della SPEC §6 (statistiche 6.5, posizioni 6.4, all-in EV 6.11).
 */
export const STAT_GLOSSARY: Record<StatKey, string> = {
  vpip: "Voluntarily Put $ In Pot: percentuale di mani in cui metti soldi nel piatto di tua scelta preflop (call o rilancio). I blind obbligatori non contano.",
  pfr: "Pre-Flop Raise: percentuale di mani in cui rilanci preflop.",
  threeBet: "3-bet: rilancio sopra un'apertura (il terzo «bet» preflop). Percentuale delle volte in cui lo fai quando ne hai l'occasione.",
  foldTo3Bet: "Percentuale delle volte in cui, dopo aver aperto, abbandoni la mano quando un avversario ti fa 3-bet.",
  cbet: "Continuation bet: puntata al flop di chi ha rilanciato per ultimo preflop, quando nessuno ha ancora puntato. Percentuale sulle occasioni.",
  wtsd: "Went To ShowDown: percentuale delle mani in cui hai visto il flop e sei arrivato allo showdown.",
  wsd: "Won $ at ShowDown: percentuale degli showdown in cui vinci almeno una parte del piatto.",
  af: "Aggression Factor: (puntate + rilanci) diviso call, dal flop in poi. Sopra 1 sei più aggressivo che passivo.",
};

export const POSITION_GLOSSARY: Record<Position, string> = {
  UTG: "Under The Gun: primo a parlare preflop, subito dopo i blind. La posizione più svantaggiata.",
  HJ: "Hijack: due posti prima del bottone.",
  CO: "Cutoff: il posto subito prima del bottone.",
  BTN: "Button (bottone): parla per ultimo dopo il flop, la posizione migliore.",
  SB: "Small blind: posta mezzo big blind obbligatorio e parla per primo dopo il flop.",
  BB: "Big blind: posta un big blind obbligatorio; preflop parla per ultimo.",
  EP: "Early position: posizioni iniziali ai tavoli con più di 6 giocatori.",
};

export const TERM_GLOSSARY = {
  bb: "Big blind: il risultato espresso in big blind, indipendente dallo stake (a €0,01/€0,02 un bb vale €0,02).",
  bb100: "bb/100: big blind vinti ogni 100 mani giocate. È il tasso di vincita.",
  showdown: "Showdown: le mani arrivate alla fine, con le carte mostrate o buttate. «Senza showdown»: piatti vinti o persi prima, quando qualcuno ha abbandonato.",
  allInEv: "All-in EV (Expected Value): il risultato che avresti avuto se ogni all-in prima del river fosse stato pagato secondo la tua equity, non secondo le carte uscite. Toglie la fortuna degli all-in.",
  allIn: "All-in: hai puntato (o chiamato) tutte le chips. Qui contano quelli heads-up prima del river, con le carte di entrambi note.",
  suited: "s = suited (stesso seme), o = offsuit (semi diversi); due ranghi uguali sono una coppia. Esempio: AKs, AKo, QQ.",
} as const;

export type TermKey = keyof typeof TERM_GLOSSARY;
