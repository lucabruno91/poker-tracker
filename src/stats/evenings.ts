import type { Cents, Hand, Session } from "../types";

/** Pausa massima tra la fine della serata e l'inizio di una sessione (SPEC §6.3). */
export const EVENING_GAP_MINUTES = 60;

export interface Evening {
  /** Inizio della prima mano, "2026-11-24T21:00:00": identifica la serata. */
  id: string;
  start: string;
  end: string;
  /** Data di inizio, "2026-11-24". */
  date: string;
  /** Sessioni in ordine di inizio. */
  sessionIds: string[];
  /** Mani dell'hero. */
  hands: number;
  net: Cents;
  rebuys: Cents;
  /** Risultato in bb, somma delle sessioni (ognuna con il suo bb). */
  netBb: number;
}

/** Minuti da un'origine fissa per un orario "YYYY-MM-DDTHH:MM:SS" (ora locale del sito). */
function minutes(t: string): number {
  return Date.parse(`${t}Z`) / 60000;
}

/** Prima e ultima mano di una sessione; null se non ha mani in archivio. */
export function sessionSpan(session: Session, handsById: Map<string, Hand>): { start: string; end: string } | null {
  let start: string | null = null;
  let end: string | null = null;
  for (const id of session.handIds) {
    const t = handsById.get(id)?.playedAt;
    if (!t) continue;
    if (start === null || t < start) start = t;
    if (end === null || t > end) end = t;
  }
  return start && end ? { start, end } : null;
}

/**
 * Raggruppa le sessioni in serate (SPEC §6.3): in ordine di inizio, una
 * sessione entra nella serata corrente se inizia entro `gapMinutes` dalla fine
 * della serata (tavoli sovrapposti o pause brevi, anche dopo mezzanotte).
 * Restituisce le serate dalla più vecchia. Funzione pura.
 */
export function groupEvenings(
  sessions: Session[],
  handsById: Map<string, Hand>,
  gapMinutes = EVENING_GAP_MINUTES,
): Evening[] {
  const spans = sessions
    .map((s) => ({ s, span: sessionSpan(s, handsById) }))
    .filter((x): x is { s: Session; span: { start: string; end: string } } => x.span !== null)
    .sort((a, b) => (a.span.start < b.span.start ? -1 : a.span.start > b.span.start ? 1 : 0));

  const evenings: Evening[] = [];
  let current: Evening | null = null;
  for (const { s, span } of spans) {
    if (!current || minutes(span.start) > minutes(current.end) + gapMinutes) {
      current = {
        id: span.start, start: span.start, end: span.end, date: span.start.slice(0, 10),
        sessionIds: [], hands: 0, net: 0, rebuys: 0, netBb: 0,
      };
      evenings.push(current);
    }
    if (span.end > current.end) current.end = span.end;
    const bb = handsById.get(s.handIds[0] ?? "")?.bb ?? 2;
    current.sessionIds.push(s.id);
    current.hands += s.hero.hands;
    current.net += s.net;
    current.rebuys += s.rebuys;
    current.netBb += s.net / bb;
  }
  return evenings;
}
