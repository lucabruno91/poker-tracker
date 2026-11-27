import { useMemo } from "react";
import { displayStats } from "../stats/aggregate";
import { heroByPosition } from "../stats/byPosition";
import { FEW_CASES } from "../stats/reference";
import type { Hand } from "../types";
import { signClass } from "./components";
import { formatBb, formatPct, formatSigned } from "./format";

/** Statistiche e risultato dell'hero per posizione. */
export function PositionTable({ hands, hero }: { hands: Hand[]; hero: string }) {
  const rows = useMemo(() => heroByPosition(hands, hero), [hands, hero]);
  if (rows.length === 0) return <p className="muted">Nessuna mano dell'hero.</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Posizione</th>
            <th className="num">Mani</th>
            <th className="num">VPIP</th>
            <th className="num">PFR</th>
            <th className="num">3-bet</th>
            <th className="num">Risultato</th>
            <th className="num">bb/100</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ position, counters, netBb }) => {
            const d = displayStats(counters);
            const per100 = counters.hands > 0 ? (100 * netBb) / counters.hands : null;
            return (
              <tr key={position}>
                <td>{position}</td>
                <td className="num">
                  {counters.hands}
                  {counters.hands < FEW_CASES && <span className="muted small"> (poche)</span>}
                </td>
                <td className="num">{formatPct(d.vpip)}</td>
                <td className="num">{formatPct(d.pfr)}</td>
                <td className="num">{formatPct(d.threeBet)}</td>
                <td className={`num ${signClass(netBb)}`}>{formatBb(netBb)}</td>
                <td className={`num ${signClass(per100 ?? 0)}`}>{formatSigned(per100)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.some((r) => r.counters.hands < FEW_CASES) && (
        <p className="small muted">«Poche»: meno di {FEW_CASES} mani, valori poco affidabili.</p>
      )}
    </div>
  );
}
