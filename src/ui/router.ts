import { useEffect, useState } from "react";

export type Route =
  | { name: "summary" }
  | { name: "import" }
  | { name: "sessions" }
  | { name: "session"; id: string }
  | { name: "opponents" }
  | { name: "opponent"; player: string }
  | { name: "hand"; id: string }
  | { name: "settings" };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const [head, arg] = parts;
  switch (head) {
    case "import": return { name: "import" };
    case "sessioni": return arg ? { name: "session", id: arg } : { name: "sessions" };
    case "avversari": return arg ? { name: "opponent", player: arg } : { name: "opponents" };
    case "mano": return arg ? { name: "hand", id: arg } : { name: "summary" };
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
  hand: (id: string) => `#/mano/${encodeURIComponent(id)}`,
  settings: () => "#/impostazioni",
};

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
