import { useMemo } from "react";
import { sessionIdOf } from "../../stats/sessions";
import type { Hand } from "../../types";
import { Bb, Cards, CopyButton, Money } from "../components";
import { formatDate, formatEuro } from "../format";
import { href } from "../router";
import { HandReplayer } from "../HandReplayer";
import { useHandNotes, type AppData } from "../data";
import { HandNotesEditor } from "../HandNotesEditor";
import { filterHands, parseHandQuery } from "../../stats/handFilters";
import { useHeroHands } from "./HandsScreen";

function lineClass(line: string, hero: string | null): string {
  const classes: string[] = [];
  if (line.startsWith("***")) classes.push("hl-street");
  else if (/^\S+: (raises|bets) /.test(line)) classes.push("hl-aggr");
  else if (/^\S+: calls /.test(line)) classes.push("hl-call");
  else if (/^\S+: folds/.test(line)) classes.push("hl-fold");
  else if (/^\S+ collected /.test(line)) classes.push("hl-win");
  if (hero && (line.startsWith(`${hero}:`) || line.startsWith(`${hero} `) || line.startsWith(`Dealt to ${hero}`))) {
    classes.push("hl-hero");
  }
  return classes.join(" ");
}

/** Navigazione nella lista Mani da cui si è arrivati (stessi filtri, stesso ordine). */
function ListNav({ data, id, from }: { data: AppData; id: string; from: string }) {
  const all = useHeroHands(data);
  const notes = useHandNotes();
  const list = useMemo(
    () => (data.hero ? filterHands(all, data.hero, parseHandQuery(from), notes) : []),
    [all, data.hero, from, notes],
  );
  const i = list.findIndex((h) => h.id === id);
  const prev = i > 0 ? list[i - 1] : undefined;
  const next = i >= 0 ? list[i + 1] : undefined;
  return (
    <nav className="row small" aria-label="Mani della lista" style={{ marginBottom: "0.5rem" }}>
      <a href={href.hands(from)}>← Lista delle mani</a>
      <span className="spacer" />
      {prev ? <a href={href.hand(prev.id, from)}>‹ Mano precedente</a> : <span className="muted">‹ Mano precedente</span>}
      {i >= 0 && (
        <span className="muted">
          {i + 1} di {list.length}
        </span>
      )}
      {next ? <a href={href.hand(next.id, from)}>Mano successiva ›</a> : <span className="muted">Mano successiva ›</span>}
    </nav>
  );
}

export function HandScreen({ data, id, from }: { data: AppData; id: string; from: string | null }) {
  const hand = data.handsById.get(id);
  if (!hand) {
    return data.loading ? null : (
      <>
        <h1>Mano non trovata</h1>
        <a href={href.hands()}>Torna alle mani</a>
      </>
    );
  }
  return (
    <>
      {from !== null && <ListNav data={data} id={id} from={from} />}
      <HandView hand={hand} hero={data.hero} />
    </>
  );
}

function HandView({ hand, hero }: { hand: Hand; hero: string | null }) {
  const lines = useMemo(() => hand.raw.split("\n"), [hand.raw]);
  const heroIn = hero !== null && hand.players.some((p) => p.name === hero);
  const sid = sessionIdOf(hand);

  return (
    <>
      <p className="small">
        <a href={href.session(sid)}>← {hand.table} · {formatDate(hand.playedAt)}</a>
      </p>
      <h1>Mano #{hand.id}</h1>
      <div className="row" style={{ marginBottom: "1rem" }}>
        <span>
          {hand.playedAt.slice(11)} · {formatEuro(hand.sb)}/{formatEuro(hand.bb)} · piatto {formatEuro(hand.pot)}
        </span>
        {heroIn && hero && (
          <span>
            · {hand.positions[hero] ?? "—"} <Cards cards={hand.heroCards} /> ·{" "}
            <Bb cents={hand.net[hero] ?? 0} bb={hand.bb} /> (<Money cents={hand.net[hero] ?? 0} />)
          </span>
        )}
        <span className="spacer" />
        <CopyButton text={() => hand.raw} label="Copia" />
      </div>

      <HandReplayer hand={hand} />
      <HandNotesEditor handId={hand.id} />

      <div className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Giocatore</th>
              <th>Posizione</th>
              <th className="num">Stack</th>
              <th className="num">Risultato</th>
            </tr>
          </thead>
          <tbody>
            {hand.players.map((p) => (
              <tr key={p.name}>
                <td>
                  {p.name === hero ? <strong>{p.name}</strong> : <a href={href.opponent(p.name)}>{p.name}</a>}
                </td>
                <td>{hand.positions[p.name] ?? "—"}</td>
                <td className="num">{formatEuro(p.stack)}</td>
                <td className="num">
                  <Money cents={hand.net[p.name] ?? 0} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="card">
        <summary>Testo originale</summary>
        <pre className="hand-raw" aria-label="Testo originale della mano" style={{ marginTop: "0.75rem" }}>
          {lines.map((line, i) => (
            <div key={i} className={lineClass(line, hero)}>
              {line || " "}
            </div>
          ))}
        </pre>
      </details>
    </>
  );
}
