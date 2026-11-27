import { useEffect, useMemo, useRef, useState } from "react";
import { addInto, emptyCounters } from "../../stats/aggregate";
import { buildResultSeries, sessionAtRange, summarizeRange, type ResultSeries } from "../../stats/series";
import { CumulativeChart, type ChartRange } from "../CumulativeChart";
import { HandList, PAGE_SIZE, Pager } from "../HandList";
import { useDismiss } from "../useDismiss";
import { useLiveQuery } from "dexie-react-hooks";
import { Kpi, signClass, StatsGrid } from "../components";
import { formatBb, formatDate, formatEuro, formatSigned } from "../format";
import { href } from "../router";
import { db, useFilter, type AppData } from "../data";
import { FilterBar } from "../FilterBar";
import { PositionTable } from "../PositionTable";
import { StartingHandsGrid } from "../StartingHandsGrid";
import type { Hand, Session } from "../../types";
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

const CHART_HIDDEN_KEY = "chartHidden";

/** Linee nascoste salvate (JSON di etichette); valori non validi → nessuna. */
export function parseHiddenLines(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const data: unknown = JSON.parse(value);
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Riepilogo ed elenco delle mani del tratto selezionato nel grafico (SPEC §6.9). */
function SelectionPanel(props: {
  series: ResultSeries;
  range: ChartRange;
  sessions: Session[];
  handsById: Map<string, Hand>;
  hero: string | null;
  onClear: () => void;
}) {
  const { series, range, sessions, handsById, hero, onClear } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const sum = useMemo(() => summarizeRange(series, range[0], range[1]), [series, range]);
  const hands = useMemo(
    () => sum.handIds.map((id) => handsById.get(id)).filter((h): h is Hand => h !== undefined),
    [sum, handsById],
  );
  const sessionId = sessionAtRange(series, sum.from, sum.to);
  const session = sessionId ? sessions.find((x) => x.id === sessionId) : undefined;

  useEffect(() => {
    setPage(1);
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [range]);

  const pages = Math.max(1, Math.ceil(hands.length / PAGE_SIZE));
  const shown = hands.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const bb = (v: number) => <span className={`num ${signClass(v)}`}>{formatBb(v)}</span>;

  return (
    <div className="selection-panel" ref={ref}>
      <div className="row">
        <p className="small" role="status" aria-live="polite" style={{ margin: 0 }}>
          <strong>
            {session ? `${session.table} · ${formatDate(session.date)}` : `Mani ${sum.from + 1}–${sum.to + 1}`}
          </strong>{" "}
          ({sum.count} {sum.count === 1 ? "mano" : "mani"}) · risultato {bb(sum.totalBb)} · showdown {bb(sum.showdownBb)} ·
          senza showdown {bb(sum.nonShowdownBb)}
        </p>
        <span className="spacer" />
        {session && <a href={href.session(session.id)}>Apri la sessione</a>}
        <button type="button" onClick={onClear}>
          Azzera selezione
        </button>
      </div>
      <HandList hands={shown} hero={hero} />
      <Pager page={page} pages={pages} onPage={setPage} />
    </div>
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
  const [selection, setSelection] = useState<ChartRange | null>(null);
  // Un clic fuori dal grafico e dal pannello, o Esc, toglie la selezione.
  const selectionArea = useRef<HTMLDivElement>(null);
  useDismiss(selectionArea, selection !== null, () => setSelection(null));

  // Linee nascoste del grafico, salvate tra le visite (impostazione `chartHidden`).
  const savedHidden = useLiveQuery(async () => (await db.settings.get(CHART_HIDDEN_KEY))?.value ?? null, []);
  const hiddenLines = useMemo(() => parseHiddenLines(savedHidden), [savedHidden]);
  const toggleLine = (label: string) => {
    const next = hiddenLines.includes(label) ? hiddenLines.filter((l) => l !== label) : [...hiddenLines, label];
    void db.settings.put({ key: CHART_HIDDEN_KEY, value: JSON.stringify(next) });
  };
  // Cambiando i filtri cambia la serie: la selezione non avrebbe più senso.
  useEffect(() => setSelection(null), [sessions]);

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
            <div ref={selectionArea}>
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
                selection={selection}
                onSelect={setSelection}
                hidden={hiddenLines}
                onToggleLine={toggleLine}
              />
              {selection && (
                <SelectionPanel
                  series={series}
                  range={selection}
                  sessions={sessions}
                  handsById={handsById}
                  hero={hero}
                  onClear={() => setSelection(null)}
                />
              )}
            </div>
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
