import { useMemo, useState } from "react";
import { displayStats } from "../../stats/aggregate";
import { LabelBadge } from "../components";
import { formatDate } from "../format";
import { href } from "../router";
import { labelFor, usePlayers, type AppData } from "../data";

type SortKey = "hands" | "vpip" | "last";

const SORTS: { key: SortKey; text: string }[] = [
  { key: "hands", text: "Mani" },
  { key: "vpip", text: "VPIP" },
  { key: "last", text: "Ultima sessione" },
];

export function OpponentsScreen({ data }: { data: AppData }) {
  const players = usePlayers(data.hands);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("hands");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...players.values()]
      .filter((p) => p.name !== data.hero)
      .map((p) => ({ p, label: labelFor(p.name, players, data.profiles), stats: displayStats(p.counters) }))
      .filter(({ p, label }) => !q || p.name.toLowerCase().includes(q) || (label.label ?? "").toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "vpip") return (b.stats.vpip.value ?? 0) - (a.stats.vpip.value ?? 0);
        if (sort === "last") return b.p.lastPlayedAt.localeCompare(a.p.lastPlayedAt);
        return b.p.counters.hands - a.p.counters.hands;
      });
  }, [players, data.hero, data.profiles, query, sort]);

  const pct = (v: number | null) => (v === null ? "—" : String(Math.round(v * 100)));

  return (
    <>
      <h1>Avversari</h1>
      <div className="row" style={{ marginBottom: "1rem" }}>
        <input
          type="search"
          placeholder="Cerca per nome o etichetta"
          aria-label="Cerca per nome o etichetta"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="spacer" />
        <span className="small muted" id="sort-label">
          Ordina per
        </span>
        <div className="row" role="group" aria-labelledby="sort-label">
          {SORTS.map((s) => (
            <button key={s.key} type="button" aria-pressed={sort === s.key} className={sort === s.key ? "primary" : ""} onClick={() => setSort(s.key)}>
              {s.text}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="muted">Nessun avversario trovato.</p>
      ) : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th className="num">Mani</th>
                <th className="num">VPIP/PFR</th>
                <th>Etichetta</th>
                <th className="num">Ultima sessione</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, label, stats }) => (
                <tr key={p.name}>
                  <td>
                    <a href={href.opponent(p.name)}>{p.name}</a>
                  </td>
                  <td className="num">{p.counters.hands}</td>
                  <td className="num">
                    {pct(stats.vpip.value)}/{pct(stats.pfr.value)}
                  </td>
                  <td>
                    <LabelBadge info={label} />
                  </td>
                  <td className="num">{formatDate(p.lastPlayedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted">
        Etichette: scelta tua &gt; Claude &gt; automatica. Il punto indica un campione sotto le 45 mani.
      </p>
    </>
  );
}
