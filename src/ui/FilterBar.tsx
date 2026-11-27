import { useMemo } from "react";
import { availableStakes, dateRange, NO_FILTER, type Period } from "../stats/filters";
import type { AppData, FilterState } from "./data";
import { formatDate } from "./format";

const PERIODS: { value: Period; text: string }[] = [
  { value: "all", text: "Tutto" },
  { value: "7d", text: "Ultimi 7 giorni" },
  { value: "30d", text: "Ultimi 30 giorni" },
  { value: "custom", text: "Intervallo" },
];

/** Barra dei filtri per periodo e stake (SPEC §6.10). */
export function FilterBar({ data, state }: { data: AppData; state: FilterState }) {
  const { filter, setFilter, active, today } = state;
  const stakes = useMemo(() => availableStakes(data.hands), [data.hands]);
  const range = dateRange(filter, today);

  return (
    <div className="filter-bar card" role="group" aria-label="Filtri">
      <div className="row">
        <label htmlFor="filter-period">Periodo</label>
        <select
          id="filter-period"
          value={filter.period}
          onChange={(e) => {
            const period = e.target.value as Period;
            const next = { ...filter, period };
            if (period !== "custom") {
              delete next.from;
              delete next.to;
            }
            setFilter(next);
          }}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.text}
            </option>
          ))}
        </select>

        {filter.period === "custom" && (
          <>
            <label htmlFor="filter-from">dal</label>
            <input
              id="filter-from"
              type="date"
              value={filter.from ?? ""}
              onChange={(e) => {
                const next = { ...filter };
                if (e.target.value) next.from = e.target.value;
                else delete next.from;
                setFilter(next);
              }}
            />
            <label htmlFor="filter-to">al</label>
            <input
              id="filter-to"
              type="date"
              value={filter.to ?? ""}
              onChange={(e) => {
                const next = { ...filter };
                if (e.target.value) next.to = e.target.value;
                else delete next.to;
                setFilter(next);
              }}
            />
          </>
        )}

        {stakes.length > 1 && (
          <>
            <label htmlFor="filter-stake">Stake</label>
            <select
              id="filter-stake"
              value={filter.stake ?? ""}
              onChange={(e) => {
                const next = { ...filter };
                if (e.target.value) next.stake = e.target.value;
                else delete next.stake;
                setFilter(next);
              }}
            >
              <option value="">Tutti</option>
              {stakes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </>
        )}

        <span className="spacer" />
        {active && (
          <button type="button" onClick={() => setFilter(NO_FILTER)}>
            Azzera filtri
          </button>
        )}
      </div>
      {active && (
        <p className="small muted" role="status" style={{ margin: "0.5rem 0 0" }}>
          Filtro attivo: {state.sessions.length} di {data.sessions.length} sessioni
          {range.from || range.to
            ? ` · ${range.from ? `dal ${formatDate(range.from)}` : ""}${range.from && range.to ? " " : ""}${range.to ? `al ${formatDate(range.to)}` : ""}`
            : ""}
          {filter.stake ? ` · stake ${filter.stake}` : ""}
        </p>
      )}
    </div>
  );
}
