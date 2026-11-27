import { useMemo } from "react";
import { addInto, emptyCounters } from "../../stats/aggregate";
import { buildResultSeries } from "../../stats/series";
import { CumulativeChart } from "../CumulativeChart";
import { Kpi, signClass, StatsGrid } from "../components";
import { formatBb, formatEuro, formatSigned } from "../format";
import { href } from "../router";
import { useFilter, type AppData } from "../data";
import { FilterBar } from "../FilterBar";
import { PositionTable } from "../PositionTable";
import { StartingHandsGrid } from "../StartingHandsGrid";
import type { Hand } from "../../types";
import { useAllInEv, type AllInEvState } from "../useAllInEv";
import { TERM_GLOSSARY } from "../glossary";
import { Term } from "../Term";

/** Riga sotto il grafico: all-in considerati e differenza tra risultato reale e atteso. */
function AllInSummary({ state }: { state: AllInEvState }) {
  const { spots, multiway, computed, done, actualBb, expectedBb } = state;
  if (spots.length === 0 && multiway === 0) return null;
  const excluded = multiway > 0 ? ` (${multiway} a più giocatori esclusi)` : "";
  if (!done) {
    return (
      <p className="small muted" role="status">
        Calcolo dell'all-in EV: {computed} di {spots.length} all-in{excluded}…
      </p>
    );
  }
  const luck = actualBb - expectedBb;
  return (
    <p className="small" role="status">
      <strong>
        <Term tip={TERM_GLOSSARY.allIn}>All-in</Term> prima del river:
      </strong>{" "}
      {spots.length}
      {excluded} · risultato reale <span className={`num ${signClass(actualBb)}`}>{formatBb(actualBb)}</span>, atteso{" "}
      <span className={`num ${signClass(expectedBb)}`}>{formatBb(expectedBb)}</span> · fortuna{" "}
      <span className={`num ${signClass(luck)}`}>{formatBb(luck)}</span>
    </p>
  );
}

export function SummaryScreen({ data }: { data: AppData }) {
  const filterState = useFilter(data);
  const { handsById, hero } = data;
  const { sessions } = filterState;

  const { counters, net, rebuys, heroHands } = useMemo(() => {
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
    return { counters, net, rebuys, heroHands };
  }, [sessions, handsById, hero]);

  const allIn = useAllInEv(heroHands, hero);
  const series = useMemo(
    () => buildResultSeries(sessions, handsById, hero, allIn.expected),
    [sessions, handsById, hero, allIn.expected],
  );

  const totalBb = series.total[series.total.length - 1] ?? 0;

  if (data.sessions.length === 0) {
    return (
      <>
        <h1>Riepilogo</h1>
        <p>
          Nessuna sessione in archivio. <a href={href.import()}>Importa le hand history</a> per iniziare.
        </p>
      </>
    );
  }

  // bb/100 dal risultato in bb sommato mano per mano: corretto anche con stake diversi.
  const per100 = counters.hands > 0 ? (100 * totalBb) / counters.hands : null;

  return (
    <>
      <h1>Riepilogo</h1>
      <p className="muted small">Hero: {hero ?? "—"}</p>
      <FilterBar data={data} state={filterState} />
      {sessions.length === 0 ? (
        <p className="muted">Nessuna sessione corrisponde al filtro.</p>
      ) : (
        <>
          <div className="kpis">
            <Kpi label="Sessioni" value={String(sessions.length)} />
            <Kpi label="Mani" value={String(counters.hands)} />
            <Kpi label={<>Risultato (<Term tip={TERM_GLOSSARY.bb}>bb</Term>)</>} value={formatBb(totalBb)} cls={signClass(totalBb)} />
            <Kpi label="Risultato €" value={formatEuro(net, true)} cls={signClass(net)} />
            <Kpi
              label={<Term tip={TERM_GLOSSARY.bb100}>bb/100</Term>}
              value={formatSigned(per100)}
              cls={signClass(per100 ?? 0)}
            />
            <Kpi label="Ricariche" value={formatEuro(rebuys)} />
          </div>

          <section className="card">
            <h2 style={{ marginTop: 0 }}>
              Risultato cumulato (<Term tip={TERM_GLOSSARY.bb}>bb</Term>)
            </h2>
            <CumulativeChart
              lines={[
                { label: "Totale", points: series.total, className: "line-total" },
                { label: "Showdown", tip: TERM_GLOSSARY.showdown, points: series.showdown, className: "line-sd" },
                { label: "Senza showdown", tip: TERM_GLOSSARY.showdown, points: series.nonShowdown, className: "line-nsd" },
                ...(series.allInEv.length > 0
                  ? [{ label: "All-in EV", tip: TERM_GLOSSARY.allInEv, points: series.allInEv, className: "line-ev" }]
                  : []),
              ]}
              sessionStarts={series.sessionStarts}
            />
            <AllInSummary state={allIn} />
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
      )}
    </>
  );
}
