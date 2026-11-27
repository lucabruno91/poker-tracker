import { useEffect, useState } from "react";

export type Route =
  | { name: "summary" }
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
    default: return { name: "summary" };
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

/** Percorso senza query: cambia pagina solo se cambia questo. */
const pathOf = (hash: string) => hash.split("?")[0];

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    let lastPath = pathOf(window.location.hash);
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      // Cambiare solo i filtri (la query) non deve riportare in cima alla pagina.
      const path = pathOf(window.location.hash);
      if (path !== lastPath) window.scrollTo(0, 0);
      lastPath = path;
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
