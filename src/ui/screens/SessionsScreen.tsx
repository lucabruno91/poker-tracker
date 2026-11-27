import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { groupEvenings } from "../../stats/evenings";
import type { Hand, Session } from "../../types";
import { Bb, Money, signClass } from "../components";
import { formatBb, formatDate, formatEuro } from "../format";
import { href } from "../router";
import { db, useFilter, type AppData } from "../data";
import { FilterBar } from "../FilterBar";

type View = "tables" | "evenings";
const VIEW_KEY = "sessionsView";

export function SessionsScreen({ data }: { data: AppData }) {
  const filterState = useFilter(data);
  const savedView = useLiveQuery(async () => (await db.settings.get(VIEW_KEY))?.value ?? null, []);
  const view: View = savedView === "evenings" ? "evenings" : "tables";
  const setView = (v: View) => void db.settings.put({ key: VIEW_KEY, value: v });

  const sessions = filterState.sessions;
  const evenings = useMemo(
    () => (view === "evenings" ? groupEvenings(sessions, data.handsById).reverse() : []),
    [view, sessions, data.handsById],
  );
  const byId = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);

  return (
    <>
      <h1>Sessioni</h1>
      {data.sessions.length > 0 && (
        <>
          <FilterBar data={data} state={filterState} />
          <div className="row" role="group" aria-label="Raggruppamento" style={{ marginBottom: "1rem" }}>
            <button type="button" aria-pressed={view === "tables"} className={view === "tables" ? "primary" : ""} onClick={() => setView("tables")}>
              Per tavolo
            </button>
            <button type="button" aria-pressed={view === "evenings"} className={view === "evenings" ? "primary" : ""} onClick={() => setView("evenings")}>
              Per serata
            </button>
          </div>
        </>
      )}
      {data.sessions.length === 0 ? (
        <p>
          Nessuna sessione. <a href={href.import()}>Importa le hand history</a>.
        </p>
      ) : sessions.length === 0 ? (
        <p className="muted">Nessuna sessione corrisponde al filtro.</p>
      ) : view === "tables" ? (
        <div className="card">
          <SessionTable sessions={[...sessions].reverse()} handsById={data.handsById} />
        </div>
      ) : (
        <>
          {evenings.map((e) => (
            <details key={e.id} className="card evening">
              <summary>
                <span className="evening-date num">{formatDate(e.date)}</span>
                <span className="muted small num">
                  {e.start.slice(11, 16)}–{e.end.slice(11, 16)}
                  {e.end.slice(0, 10) !== e.date ? " (+1)" : ""}
                </span>
                <span className="small">
                  {e.sessionIds.length} {e.sessionIds.length === 1 ? "tavolo" : "tavoli"} · {e.hands} mani
                </span>
                <span className="spacer" />
                <span className={`num ${signClass(e.netBb)}`}>{formatBb(e.netBb)}</span>
                <span className="num">
                  <Money cents={e.net} />
                </span>
                {e.rebuys > 0 && <span className="small muted">ricariche {formatEuro(e.rebuys)}</span>}
              </summary>
              <SessionTable
                sessions={e.sessionIds.map((id) => byId.get(id)).filter((s): s is Session => s !== undefined)}
                handsById={data.handsById}
              />
            </details>
          ))}
          <p className="small muted">
            Una serata raggruppa le sessioni giocate insieme: tavoli sovrapposti o iniziati entro un'ora dalla fine
            dei precedenti, anche dopo mezzanotte.
          </p>
        </>
      )}
    </>
  );
}

function SessionTable({ sessions, handsById }: { sessions: Session[]; handsById: Map<string, Hand> }) {
  const bbOf = (ids: string[]) => handsById.get(ids[0] ?? "")?.bb ?? 2;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Tavolo</th>
            <th className="num">Mani</th>
            <th className="num">Risultato</th>
            <th className="num">€</th>
            <th className="num">Ricariche</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td className="num">{formatDate(s.date)}</td>
              <td>
                <a href={href.session(s.id)}>{s.table}</a>
                {s.issues && (
                  <span className="neg small" title={s.issues.join("\n")}>
                    {" "}
                    ⚠ <span className="sr-only">incoerenze negli stack</span>
                  </span>
                )}
              </td>
              <td className="num">{s.hero.hands}</td>
              <td className="num">
                <Bb cents={s.net} bb={bbOf(s.handIds)} />
              </td>
              <td className="num">
                <Money cents={s.net} />
              </td>
              <td className="num">{s.rebuys > 0 ? formatEuro(s.rebuys) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
