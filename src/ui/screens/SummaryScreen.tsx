import { useMemo } from "react";
import { addInto, bbPer100, emptyCounters } from "../../stats/aggregate";
import { compareHandIds } from "../../stats/sessions";
import { CumulativeChart } from "../CumulativeChart";
import { Kpi, signClass, StatsGrid } from "../components";
import { formatBb, formatEuro, formatSigned } from "../format";
import { href } from "../router";
import type { AppData } from "../data";
import { PositionTable } from "../PositionTable";
import { StartingHandsGrid } from "../StartingHandsGrid";
import type { Hand } from "../../types";

export function SummaryScreen({ data }: { data: AppData }) {
  const { sessions, handsById, hero } = data;

  const { points, starts, totalBb, counters, net, rebuys, bb, heroHands } = useMemo(() => {
    const heroHands: Hand[] = [];
    const points: number[] = [];
    const starts: number[] = [];
    const counters = emptyCounters();
    let cum = 0;
    let net = 0;
    let rebuys = 0;
    let bb = 2;
    for (const s of sessions) {
      starts.push(points.length);
      addInto(counters, s.hero);
      net += s.net;
      rebuys += s.rebuys;
      const ids = [...s.handIds].sort(compareHandIds);
      for (const id of ids) {
        const h = handsById.get(id);
        if (!h || !hero || !h.players.some((p) => p.name === hero)) continue;
        heroHands.push(h);
        bb = h.bb;
        cum += (h.net[hero] ?? 0) / h.bb;
        points.push(cum);
      }
    }
    return { points, starts, totalBb: cum, counters, net, rebuys, bb, heroHands };
  }, [sessions, handsById, hero]);

  if (sessions.length === 0) {
    return (
      <>
        <h1>Riepilogo</h1>
        <p>
          Nessuna sessione in archivio. <a href={href.import()}>Importa le hand history</a> per iniziare.
        </p>
      </>
    );
  }

  const per100 = bbPer100(net, bb, counters.hands);

  return (
    <>
      <h1>Riepilogo</h1>
      <p className="muted small">Hero: {hero ?? "—"}</p>
      <div className="kpis">
        <Kpi label="Sessioni" value={String(sessions.length)} />
        <Kpi label="Mani" value={String(counters.hands)} />
        <Kpi label="Risultato" value={formatBb(totalBb)} cls={signClass(totalBb)} />
        <Kpi label="Risultato €" value={formatEuro(net, true)} cls={signClass(net)} />
        <Kpi
          label="bb/100"
          value={formatSigned(per100)}
          cls={signClass(per100 ?? 0)}
        />
        <Kpi label="Ricariche" value={formatEuro(rebuys)} />
      </div>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Risultato cumulato (bb)</h2>
        <CumulativeChart points={points} sessionStarts={starts} />
        <p className="small muted">Le linee verticali separano le sessioni.</p>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Le tue statistiche</h2>
        <StatsGrid counters={counters} compare />
        <p className="small muted">Intervalli ottimali per un regular 6-max. In rosso i valori fuori, con cosa significano.</p>
      </section>

      {hero && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Per posizione</h2>
          <PositionTable hands={heroHands} hero={hero} />
        </section>
      )}

      {hero && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Per mano iniziale</h2>
          <StartingHandsGrid hands={heroHands} hero={hero} />
        </section>
      )}
    </>
  );
}
