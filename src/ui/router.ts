import { useEffect, useState } from "react";

export type Route =
  /** `query`: selezione del grafico (`sel`, `f`), vedi `selectionUrl.ts`. */
  | { name: "summary"; query: string }
  | { name: "import" }
  | { name: "sessions" }
  | { name: "session"; id: string }
  | { name: "opponents" }
  | { name: "opponent"; player: string }
  | { name: "hands"; query: string }
  /** `from`: query della lista Mani da cui si arriva (per mano precedente/successiva). */
  | { name: "hand"; id: string; from: string | null }
  | { name: "settings" };

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "");
  const q = raw.indexOf("?");
  const path = q >= 0 ? raw.slice(0, q) : raw;
  const query = q >= 0 ? raw.slice(q + 1) : "";
  const [head, arg] = path.split("/").map(decodeURIComponent);
  switch (head) {
    case "import": return { name: "import" };
    case "sessioni": return arg ? { name: "session", id: arg } : { name: "sessions" };
    case "avversari": return arg ? { name: "opponent", player: arg } : { name: "opponents" };
    case "mani": return { name: "hands", query };
    case "mano": return arg ? { name: "hand", id: arg, from: new URLSearchParams(query).get("da") } : { name: "hands", query: "" };
    case "impostazioni": return { name: "settings" };
    case "": return { name: "summary", query };
    default: return { name: "summary", query: "" };
  }
}

/** Link interni: i nomi dei giocatori possono contenere "/" e vanno codificati. */
export const href = {
  summary: () => "#/",
  import: () => "#/import",
  sessions: () => "#/sessioni",
  session: (id: string) => `#/sessioni/${encodeURIComponent(id)}`,
  opponents: () => "#/avversari",
  opponent: (name: string) => `#/avversari/${encodeURIComponent(name)}`,
  hands: (query = "") => `#/mani${query ? `?${query}` : ""}`,
  hand: (id: string, from: string | null = null) =>
    `#/mano/${encodeURIComponent(id)}${from !== null ? `?${new URLSearchParams({ da: from }).toString()}` : ""}`,
  settings: () => "#/impostazioni",
};

/** Indirizzo normalizzato ("" e "#/" sono la stessa pagina). */
export const normalizeHash = (hash: string) => hash.replace(/^#\/?/, "");
/** Percorso senza query: cambia pagina solo se cambia questo. */
export const pathOf = (hash: string) => normalizeHash(hash).split("?")[0] ?? "";

/** Posizione di scorrimento lasciata su ogni indirizzo (per la visita corrente). */
const scrollPositions = new Map<string, number>();

/**
 * Riporta la pagina a `y`. La pagina può non essere ancora alta abbastanza
 * (i dati arrivano dal database dopo il primo disegno): si riprova per circa
 * un secondo, finché lo scorrimento arriva a destinazione.
 */
function restoreScroll(y: number): void {
  let tries = 0;
  const step = () => {
    window.scrollTo(0, y);
    if (Math.abs(window.scrollY - y) > 2 && tries++ < 60) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    let last = normalizeHash(window.location.hash);
    const onChange = () => {
      const current = normalizeHash(window.location.hash);
      // Allo scatto di hashchange la pagina mostrata è ancora la precedente.
      scrollPositions.set(last, window.scrollY);
      setRoute(parseRoute(window.location.hash));
      // Cambiare solo la query (filtri, selezione) non sposta la pagina.
      if (pathOf(current) !== pathOf(last)) {
        const saved = scrollPositions.get(current);
        if (saved !== undefined) restoreScroll(saved); // ritorno a un indirizzo già visto (es. Indietro)
        else window.scrollTo(0, 0); // pagina nuova
      }
      last = current;
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

/** Sostituisce la query della pagina corrente senza aggiungere voci alla cronologia. */
export function replaceQuery(path: string, query: string): void {
  window.location.replace(`${path}${query ? `?${query}` : ""}`);
}
