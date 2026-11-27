import type { Hand } from "../types";
import { Bb, Cards } from "./components";
import { formatDate, formatEuro } from "./format";
import { POSITION_GLOSSARY } from "./glossary";
import { href } from "./router";
import { Term } from "./Term";

export const PAGE_SIZE = 50;

/**
 * Tabella di mani: riga cliccabile verso il replayer, link nella data per la
 * tastiera. `from` è la query della lista Mani (per mano precedente/successiva).
 */
export function HandList({ hands, hero, from = null }: { hands: Hand[]; hero: string | null; from?: string | null }) {
  return (
    <div className="table-wrap">
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
          {hands.map((h) => {
            const pos = hero ? h.positions[hero] : undefined;
            const link = href.hand(h.id, from);
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
  );
}

/** Paginazione «Precedenti / Successive». Non mostra nulla con una sola pagina. */
export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (n: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="row" aria-label="Pagine" style={{ justifyContent: "center" }}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Precedenti
      </button>
      <span className="small muted">
        pagina {page} di {pages}
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Successive →
      </button>
    </nav>
  );
}
