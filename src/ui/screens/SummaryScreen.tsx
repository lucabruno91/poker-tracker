import { useMemo } from "react";
import { addInto, bbPer100, emptyCounters } from "../../stats/aggregate";
import { buildResultSeries } from "../../stats/series";
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

  const series = useMemo(() => buildResultSeries(sessions, handsById, hero), [sessions, handsById, hero]);

  const { counters, net, rebuys, bb, heroHands } = useMemo(() => {
    const counters = emptyCounters();
    const heroHands: Hand[] = [];
    let net = 0;
    let rebuys = 0;
    for (const s of sessions) {
      addInto(counters, s.hero);
      net += s.net;
      rebuys += s.rebuys;
      for (const id of s.handIds) {
        const h = handsById.get(id);
        if (h && hero && h.players.some((p) => p.name === hero)) heroHands.push(h);
      }
    }
    const last = sessions[sessions.length - 1];
    const bb = (last && handsById.get(last.handIds[0] ?? "")?.bb) || 2;
    return { counters, net, rebuys, bb, heroHands };
  }, [sessions, handsById, hero]);

  const totalBb = series.total[series.total.length - 1] ?? 0;

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
        <CumulativeChart
          lines={[
            { label: "Totale", points: series.total, className: "line-total" },
            { label: "Showdown", points: series.showdown, className: "line-sd" },
            { label: "Senza showdown", points: series.nonShowdown, className: "line-nsd" },
          ]}
          sessionStarts={series.sessionStarts}
        />
        <p className="small muted">
          Le linee verticali separano le sessioni. «Showdown»: mani in cui hai mostrato o buttato le carte allo
          showdown; «senza showdown»: piatti vinti o persi prima. Una linea senza showdown in discesa di solito vuol dire
          che abbandoni troppo spesso o che i tuoi bluff non passano.
        </p>
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
