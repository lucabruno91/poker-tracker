import { useEffect, useMemo, useState } from "react";
import { saveUserProfile } from "../../db/profiles";
import { shownCards } from "../../stats/players";
import { compareHandIds } from "../../stats/sessions";
import { LABELS, type Label } from "../../types";
import { Cards, Kpi, LabelBadge, Money, signClass, StatsGrid } from "../components";
import { formatBb, formatDate } from "../format";
import { href } from "../router";
import { db, labelFor, usePlayers, type AppData } from "../data";

export function OpponentDetail({ data, name }: { data: AppData; name: string }) {
  const players = usePlayers(data.hands);
  const player = players.get(name);
  const profile = data.profiles.get(name);
  const label = labelFor(name, players, data.profiles);

  const [userLabel, setUserLabel] = useState<Label | "">(profile?.label ?? "");
  const [note, setNote] = useState(profile?.note ?? "");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setUserLabel(profile?.label ?? "");
    setNote(profile?.note ?? "");
  }, [profile?.label, profile?.note]);

  const sessions = useMemo(
    () => data.sessions.filter((s) => player?.sessionIds.includes(s.id)).reverse(),
    [data.sessions, player],
  );
  const showdowns = useMemo(
    () =>
      (player?.showdownHandIds ?? [])
        .map((id) => data.handsById.get(id))
        .filter((h) => h !== undefined)
        .sort((a, b) => compareHandIds(b.id, a.id)),
    [player, data.handsById],
  );

  if (!player && !profile) {
    return data.loading ? null : (
      <>
        <h1>Giocatore non trovato</h1>
        <a href={href.opponents()}>Torna agli avversari</a>
      </>
    );
  }

  const save = async () => {
    await saveUserProfile(db, name, userLabel || undefined, note);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const bb = data.hands[0]?.bb ?? 2;
  const net = player?.counters.net ?? 0;

  return (
    <>
      <p className="small">
        <a href={href.opponents()}>← Avversari</a>
      </p>
      <h1>
        {name} <LabelBadge info={label} />
      </h1>

      {player && (
        <>
          <div className="kpis">
            <Kpi label="Mani" value={player.counters.hands} />
            <Kpi label="Sessioni" value={player.sessionIds.length} />
            <Kpi label="Risultato" value={formatBb(net / bb)} cls={signClass(net)} />
            <Kpi label="Ultima mano" value={formatDate(player.lastPlayedAt)} />
          </div>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Statistiche</h2>
            <StatsGrid counters={player.counters} />
          </section>
        </>
      )}

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Etichetta e nota</h2>
        {(profile?.claudeLabel || profile?.claudeNote) && (
          <div className="notice">
            <strong>Claude:</strong> {profile.claudeLabel ?? "nessuna etichetta"}
            {profile.claudeNote && <> — {profile.claudeNote}</>}
          </div>
        )}
        <div className="row" style={{ marginBottom: "0.5rem" }}>
          <label htmlFor="user-label">La tua etichetta</label>
          <select id="user-label" value={userLabel} onChange={(e) => setUserLabel(e.target.value as Label | "")}>
            <option value="">— nessuna (usa Claude o automatica) —</option>
            {LABELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <label htmlFor="user-note">La tua nota</label>
        <textarea id="user-note" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="row" style={{ marginTop: "0.5rem" }}>
          <button type="button" className="primary" onClick={() => void save()}>
            Salva
          </button>
          {saved && <span className="small pos" role="status">Salvato</span>}
        </div>
      </section>

      {sessions.length > 0 && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Sessioni in cui è comparso</h2>
          <ul>
            {sessions.map((s) => (
              <li key={s.id}>
                <a href={href.session(s.id)}>
                  {s.table} — {formatDate(s.date)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showdowns.length > 0 && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Mani mostrate allo showdown</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mano</th>
                  <th>Posizione</th>
                  <th>Carte</th>
                  <th>Board</th>
                  <th className="num">Risultato</th>
                </tr>
              </thead>
              <tbody>
                {showdowns.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <a href={href.hand(h.id)}>{formatDate(h.playedAt)} · {h.table}</a>
                    </td>
                    <td>{h.positions[name] ?? "—"}</td>
                    <td>
                      <Cards cards={shownCards(h, name)} />
                    </td>
                    <td>
                      <Cards cards={h.board.join(" ") || null} />
                    </td>
                    <td className="num">
                      <Money cents={h.net[name] ?? 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
