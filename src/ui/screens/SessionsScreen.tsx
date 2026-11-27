import { Bb, Money } from "../components";
import { formatDate, formatEuro } from "../format";
import { href } from "../router";
import { useFilter, type AppData } from "../data";
import { FilterBar } from "../FilterBar";

export function SessionsScreen({ data }: { data: AppData }) {
  const filterState = useFilter(data);
  const sessions = [...filterState.sessions].reverse();
  const bbOf = (ids: string[]) => data.handsById.get(ids[0] ?? "")?.bb ?? 2;

  return (
    <>
      <h1>Sessioni</h1>
      {data.sessions.length > 0 && <FilterBar data={data} state={filterState} />}
      {data.sessions.length === 0 ? (
        <p>
          Nessuna sessione. <a href={href.import()}>Importa le hand history</a>.
        </p>
      ) : sessions.length === 0 ? (
        <p className="muted">Nessuna sessione corrisponde al filtro.</p>
      ) : (
        <div className="table-wrap card">
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
      )}
    </>
  );
}
