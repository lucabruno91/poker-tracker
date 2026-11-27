import { useEffect, useMemo, useState } from "react";
import { bbPer100 } from "../../stats/aggregate";
import { compareHandIds } from "../../stats/sessions";
import { buildClaudeExport } from "../../export/claudeExport";
import type { Hand, Session } from "../../types";
import { Bb, Cards, CopyButton, Kpi, Money, signClass, StatsGrid } from "../components";
import { formatBb, formatDate, formatEuro, formatSigned } from "../format";
import { href } from "../router";
import { db, labelFor, usePlayers, type AppData } from "../data";

export function SessionDetail({ data, id }: { data: AppData; id: string }) {
  const session = data.sessions.find((s) => s.id === id);
  if (!session) {
    return data.loading ? null : (
      <>
        <h1>Sessione non trovata</h1>
        <a href={href.sessions()}>Torna alle sessioni</a>
      </>
    );
  }
  return <SessionView data={data} session={session} />;
}

function SessionView({ data, session }: { data: AppData; session: Session }) {
  const hero = data.hero ?? "";
  const hands = useMemo(
    () =>
      [...session.handIds]
        .sort(compareHandIds)
        .map((id) => data.handsById.get(id))
        .filter((h): h is Hand => h !== undefined),
    [session, data.handsById],
  );
  const indexOf = useMemo(() => new Map(hands.map((h, i) => [h.id, i + 1])), [hands]);
  const bb = hands[0]?.bb ?? 2;
  const players = usePlayers(data.hands);

  const biggest = useMemo(
    () =>
      hands
        .filter((h) => (h.invested[hero] ?? 0) > 0)
        .sort((a, b) => b.pot - a.pot)
        .slice(0, 10),
    [hands, hero],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (handId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(handId)) next.delete(handId);
      else next.add(handId);
      return next;
    });

  const [note, setNote] = useState(session.summary ?? "");
  const [savedNote, setSavedNote] = useState(session.summary ?? "");
  useEffect(() => {
    setNote(session.summary ?? "");
    setSavedNote(session.summary ?? "");
  }, [session.id, session.summary]);
  const saveNote = async () => {
    const value = note.trim();
    await db.sessions.update(session.id, { summary: value || undefined });
    setSavedNote(note);
  };

  const [exportText, setExportText] = useState<string | null>(null);
  const makeExport = () =>
    buildClaudeExport({
      session,
      hands,
      hero,
      selectedIds: selected,
      labelOf: (name) => labelFor(name, players, data.profiles).label,
    });

  const per100 = bbPer100(session.net, bb, session.hero.hands);

  return (
    <>
      <p className="small">
        <a href={href.sessions()}>← Sessioni</a>
      </p>
      <h1>
        {session.table} <span className="muted">· {formatDate(session.date)}</span>
      </h1>

      {session.issues && (
        <div className="notice error">
          <strong>Incoerenze negli stack:</strong>
          <ul>
            {session.issues.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="kpis">
        <Kpi label="Mani" value={session.hero.hands} />
        <Kpi label="Risultato" value={formatBb(session.net / bb)} cls={signClass(session.net)} />
        <Kpi label="Risultato €" value={formatEuro(session.net, true)} cls={signClass(session.net)} />
        <Kpi label="bb/100" value={formatSigned(per100)} cls={signClass(per100 ?? 0)} />
        <Kpi label="Ricariche" value={formatEuro(session.rebuys)} />
        <Kpi label="Stack iniziale → finale" value={`${formatEuro(session.heroStart)} → ${formatEuro(session.heroEnd)}`} />
      </div>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Statistiche dell'hero</h2>
        <StatsGrid counters={session.hero} compare />
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Mani con il piatto più grande</h2>
        <p className="small muted">Le 10 mani più grandi in cui hai messo soldi. Spunta quelle da esportare.</p>
        <HandTable hands={biggest} hero={hero} indexOf={indexOf} selected={selected} toggle={toggle} bb={bb} />
        <details style={{ marginTop: "1rem" }}>
          <summary>Tutte le mani ({hands.length})</summary>
          <HandTable hands={hands} hero={hero} indexOf={indexOf} selected={selected} toggle={toggle} bb={bb} />
        </details>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Nota sulla sessione</h2>
        <label htmlFor="session-note" className="sr-only">
          Nota sulla sessione
        </label>
        <textarea id="session-note" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="row" style={{ marginTop: "0.5rem" }}>
          <button type="button" onClick={() => void saveNote()} disabled={note === savedNote}>
            Salva nota
          </button>
          {note !== savedNote && <span className="small muted">Modifiche non salvate</span>}
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Esporta per Claude</h2>
        <p className="small muted">
          Riepilogo della sessione e {selected.size} mani selezionate nel formato originale.
        </p>
        <div className="row">
          <button type="button" className="primary" onClick={() => setExportText(makeExport())}>
            Prepara il testo
          </button>
          {exportText !== null && <CopyButton text={() => exportText} />}
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())}>
              Deseleziona tutte
            </button>
          )}
        </div>
        {exportText !== null && (
          <pre className="hand-raw small" style={{ marginTop: "0.75rem", maxHeight: "24rem" }}>
            {exportText}
          </pre>
        )}
      </section>
    </>
  );
}

interface HandTableProps {
  hands: Hand[];
  hero: string;
  indexOf: Map<string, number>;
  selected: Set<string>;
  toggle: (id: string) => void;
  bb: number;
}

function HandTable({ hands, hero, indexOf, selected, toggle, bb }: HandTableProps) {
  if (hands.length === 0) return <p className="muted">Nessuna mano.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>
              <span className="sr-only">Esporta</span>
            </th>
            <th>#</th>
            <th>Posizione</th>
            <th>Carte</th>
            <th className="num">Piatto</th>
            <th className="num">Risultato</th>
            <th className="num">€</th>
          </tr>
        </thead>
        <tbody>
          {hands.map((h) => {
            const n = indexOf.get(h.id) ?? 0;
            return (
              <tr key={h.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(h.id)}
                    onChange={() => toggle(h.id)}
                    aria-label={`Esporta la mano #${n}`}
                  />
                </td>
                <td className="num">
                  <a href={href.hand(h.id)}>#{n}</a>
                </td>
                <td>{h.positions[hero] ?? "—"}</td>
                <td>
                  <Cards cards={h.heroName === hero ? h.heroCards : null} />
                </td>
                <td className="num">{formatEuro(h.pot)}</td>
                <td className="num">
                  <Bb cents={h.net[hero] ?? 0} bb={bb} />
                </td>
                <td className="num">
                  <Money cents={h.net[hero] ?? 0} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
