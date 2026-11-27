import { useEffect, useMemo, useState } from "react";
import {
  filterHands, handQuery, pageOf, parseCardsQuery, parseHandQuery,
  type HandFilter, type HandKind, type HandResult, type HandSort,
} from "../../stats/handFilters";
import { POSITION_ORDER } from "../../stats/byPosition";
import type { Hand, Position } from "../../types";
import { Bb, Cards, signClass } from "../components";
import { formatBb, formatDate, formatEuro } from "../format";
import { POSITION_GLOSSARY } from "../glossary";
import { href, replaceQuery } from "../router";
import { Term } from "../Term";
import { useFilter, type AppData } from "../data";
import { FilterBar } from "../FilterBar";

export const PAGE_SIZE = 50;

/** Mani dell'hero nelle sessioni che rispettano periodo e stake. */
export function useHeroHands(data: AppData): Hand[] {
  const { sessions } = useFilter(data);
  return useMemo(
    () => sessions.flatMap((s) => s.handIds.map((id) => data.handsById.get(id)).filter((h): h is Hand => h !== undefined)),
    [sessions, data.handsById],
  );
}

export function HandsScreen({ data, query }: { data: AppData; query: string }) {
  const filterState = useFilter(data);
  const all = useHeroHands(data);
  const hero = data.hero;
  const f = useMemo(() => parseHandQuery(query), [query]);
  const list = useMemo(() => (hero ? filterHands(all, hero, f) : []), [all, hero, f]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(pageOf(query), pages);
  const shown = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalBb = list.reduce((a, h) => a + (h.net[hero ?? ""] ?? 0) / h.bb, 0);
  const listQuery = handQuery(f); // senza pagina: è la lista da cui si apre una mano

  const update = (patch: Partial<HandFilter>) => {
    const next: HandFilter = { ...f, ...patch };
    for (const k of Object.keys(patch) as (keyof HandFilter)[]) {
      if (next[k] === undefined || next[k] === "") delete next[k];
    }
    replaceQuery("#/mani", handQuery(next));
  };
  const cardsInvalid = Boolean(f.cards && !parseCardsQuery(f.cards));
  const [cardsText, setCardsText] = useState(f.cards ?? "");
  useEffect(() => setCardsText(f.cards ?? ""), [f.cards]);
  const goPage = (n: number) => {
    replaceQuery("#/mani", handQuery(f, n));
    window.scrollTo(0, 0);
  };

  if (data.sessions.length === 0) {
    return (
      <>
        <h1>Mani</h1>
        <p>
          Nessuna mano in archivio. <a href={href.import()}>Importa le hand history</a>.
        </p>
      </>
    );
  }

  return (
    <>
      <h1>Mani</h1>
      <FilterBar data={data} state={filterState} />

      <div className="card filter-bar" role="group" aria-label="Filtri della lista">
        <div className="row">
          <label htmlFor="hf-pos">Posizione</label>
          <select id="hf-pos" value={f.position ?? ""} onChange={(e) => update({ position: (e.target.value || undefined) as Position | undefined })}>
            <option value="">Tutte</option>
            {POSITION_ORDER.filter((p) => p !== "EP").map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <label htmlFor="hf-kind">Tipo</label>
          <select id="hf-kind" value={f.kind ?? ""} onChange={(e) => update({ kind: (e.target.value || undefined) as HandKind | undefined })}>
            <option value="">Tutte</option>
            <option value="showdown">Arrivate allo showdown</option>
            <option value="allin">Con un all-in</option>
            <option value="vpip">Giocate (VPIP)</option>
          </select>

          <label htmlFor="hf-res">Risultato</label>
          <select id="hf-res" value={f.result ?? ""} onChange={(e) => update({ result: (e.target.value || undefined) as HandResult | undefined })}>
            <option value="">Tutte</option>
            <option value="won">Vinte</option>
            <option value="lost">Perse</option>
          </select>

          <label htmlFor="hf-cards">Carte</label>
          <input
            id="hf-cards"
            type="search"
            placeholder="es. AKs, AK, QQ"
            size={8}
            value={cardsText}
            aria-invalid={cardsInvalid}
            aria-describedby="hf-cards-help"
            onChange={(e) => {
              setCardsText(e.target.value);
              update({ cards: e.target.value.trim() || undefined });
            }}
          />

          <label htmlFor="hf-sort">Ordina</label>
          <select id="hf-sort" value={f.sort} onChange={(e) => update({ sort: e.target.value as HandSort })}>
            <option value="recent">Più recenti</option>
            <option value="pot">Piatto più grande</option>
            <option value="worst">Perdite maggiori</option>
            <option value="best">Vincite maggiori</option>
          </select>

          <span className="spacer" />
          {listQuery && (
            <button type="button" onClick={() => replaceQuery("#/mani", "")}>
              Azzera
            </button>
          )}
        </div>
        <p id="hf-cards-help" className={`small ${cardsInvalid ? "neg" : "muted"}`} style={{ margin: "0.5rem 0 0" }} role="status">
          {cardsInvalid
            ? `«${f.cards}» non è una mano valida: usa due ranghi (AK, T9, QQ) con s o o facoltativi.`
            : `${list.length} ${list.length === 1 ? "mano" : "mani"} · risultato `}
          {!cardsInvalid && <span className={`num ${signClass(totalBb)}`}>{formatBb(totalBb)}</span>}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="muted">Nessuna mano corrisponde ai filtri.</p>
      ) : (
        <div className="card table-wrap">
          <table className="hands-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tavolo</th>
                <th>Pos.</th>
                <th>Carte</th>
                <th>Board</th>
                <th className="num">Piatto</th>
                <th className="num">Risultato</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((h) => {
                const pos = hero ? h.positions[hero] : undefined;
                const link = href.hand(h.id, listQuery);
                return (
                  <tr key={h.id} className="clickable" onClick={() => (window.location.hash = link)}>
                    <td className="num">
                      <a href={link} onClick={(e) => e.stopPropagation()}>
                        {formatDate(h.playedAt)} {h.playedAt.slice(11, 16)}
                      </a>
                    </td>
                    <td>{h.table}</td>
                    <td>{pos ? <Term tip={POSITION_GLOSSARY[pos]}>{pos}</Term> : "—"}</td>
                    <td>
                      <Cards cards={h.heroName === hero ? h.heroCards : null} />
                    </td>
                    <td>
                      <Cards cards={h.board.length ? h.board.join(" ") : null} />
                    </td>
                    <td className="num">{formatEuro(h.pot)}</td>
                    <td className="num">
                      <Bb cents={h.net[hero ?? ""] ?? 0} bb={h.bb} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="row" aria-label="Pagine" style={{ justifyContent: "center" }}>
          <button type="button" disabled={page <= 1} onClick={() => goPage(page - 1)}>
            ← Precedenti
          </button>
          <span className="small muted">
            pagina {page} di {pages}
          </span>
          <button type="button" disabled={page >= pages} onClick={() => goPage(page + 1)}>
            Successive →
          </button>
        </nav>
      )}
    </>
  );
}
