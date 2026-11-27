import { useMemo, useState } from "react";
import { GRID_ORDER, gridCell, heroByStartingHand } from "../stats/startingHands";
import { compareHandIds } from "../stats/sessions";
import type { Hand } from "../types";
import { Bb, Cards } from "./components";
import { formatBb, formatDate, formatSigned } from "./format";
import { href } from "./router";
import { TERM_GLOSSARY } from "./glossary";
import { Term } from "./Term";

type Metric = "total" | "perHand";

const POS = "111, 163, 134"; // --clear
const NEG = "181, 83, 79"; // --red

/** Griglia 13×13 dei risultati dell'hero per mano iniziale. */
export function StartingHandsGrid({ hands, hero }: { hands: Hand[]; hero: string }) {
  const results = useMemo(() => heroByStartingHand(hands, hero), [hands, hero]);
  const handsById = useMemo(() => new Map(hands.map((h) => [h.id, h])), [hands]);
  const [metric, setMetric] = useState<Metric>("total");
  const [selected, setSelected] = useState<string | null>(null);

  const valueOf = (cls: string): number | null => {
    const r = results.get(cls);
    if (!r) return null;
    return metric === "total" ? r.netBb : r.netBb / r.hands;
  };
  const maxAbs = Math.max(1e-9, ...[...results.keys()].map((k) => Math.abs(valueOf(k) ?? 0)));

  const selectedHands = selected
    ? (results.get(selected)?.handIds ?? [])
        .map((id) => handsById.get(id))
        .filter((h): h is Hand => h !== undefined)
        .sort((a, b) => compareHandIds(a.id, b.id))
    : [];

  if (results.size === 0) return <p className="muted">Nessuna mano con le carte dell'hero.</p>;

  return (
    <>
      <div className="row" role="group" aria-label="Metrica della griglia" style={{ marginBottom: "0.75rem" }}>
        <button type="button" aria-pressed={metric === "total"} className={metric === "total" ? "primary" : ""} onClick={() => setMetric("total")}>
          bb totali
        </button>
        <button type="button" aria-pressed={metric === "perHand"} className={metric === "perHand" ? "primary" : ""} onClick={() => setMetric("perHand")}>
          bb per mano
        </button>
      </div>
      <div className="table-wrap">
        <table className="hand-grid">
          <caption className="sr-only">
            Risultato per mano iniziale: coppie in diagonale, suited sopra, offsuit sotto
          </caption>
          <tbody>
            {GRID_ORDER.map((_, row) => (
              <tr key={row}>
                {GRID_ORDER.map((__, col) => {
                  const cls = gridCell(row, col);
                  const r = results.get(cls);
                  const v = valueOf(cls);
                  const alpha = v === null ? 0 : 0.15 + 0.85 * (Math.abs(v) / maxAbs);
                  const bg = v === null || v === 0 ? undefined : `rgba(${v > 0 ? POS : NEG}, ${alpha.toFixed(2)})`;
                  const label = r
                    ? `${cls}: ${r.hands} ${r.hands === 1 ? "mano" : "mani"}, ${formatBb(r.netBb)}`
                    : `${cls}: nessuna mano`;
                  return (
                    <td key={col} style={{ background: bg }} className={r ? "" : "empty"}>
                      <button
                        type="button"
                        className="cell"
                        title={label}
                        aria-label={label}
                        aria-pressed={selected === cls}
                        disabled={!r}
                        onClick={() => setSelected(selected === cls ? null : cls)}
                      >
                        <span className="cell-name">{cls}</span>
                        {r && <span className="cell-value">{formatSigned(v ?? 0)}</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        Coppie in diagonale, <Term tip={TERM_GLOSSARY.suited}>suited (s)</Term> sopra,{" "}
        <Term tip={TERM_GLOSSARY.suited}>offsuit (o)</Term> sotto. Verde: in attivo; rosso: in perdita; più intenso =
        valore più grande. Clicca una cella per vedere le mani.
      </p>

      {selected && (
        <div style={{ marginTop: "0.75rem" }}>
          <h3>
            {selected}: {selectedHands.length} {selectedHands.length === 1 ? "mano" : "mani"}
          </h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mano</th>
                  <th>Posizione</th>
                  <th>Carte</th>
                  <th className="num">Risultato</th>
                </tr>
              </thead>
              <tbody>
                {selectedHands.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <a href={href.hand(h.id)}>
                        {formatDate(h.playedAt)} · {h.table}
                      </a>
                    </td>
                    <td>{h.positions[hero] ?? "—"}</td>
                    <td>
                      <Cards cards={h.heroCards} />
                    </td>
                    <td className="num">
                      <Bb cents={h.net[hero] ?? 0} bb={h.bb} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
