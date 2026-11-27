import { useAppData } from "./data";
import { href, useRoute, type Route } from "./router";
import { ImportScreen } from "./screens/ImportScreen";
import { SummaryScreen } from "./screens/SummaryScreen";
import { SessionsScreen } from "./screens/SessionsScreen";
import { SessionDetail } from "./screens/SessionDetail";
import { OpponentsScreen } from "./screens/OpponentsScreen";
import { OpponentDetail } from "./screens/OpponentDetail";
import { HandScreen } from "./screens/HandScreen";
import { HandsScreen } from "./screens/HandsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

const NAV: { text: string; link: string; match: Route["name"][] }[] = [
  { text: "Riepilogo", link: href.summary(), match: ["summary"] },
  { text: "Sessioni", link: href.sessions(), match: ["sessions", "session"] },
  { text: "Mani", link: href.hands(), match: ["hands", "hand"] },
  { text: "Avversari", link: href.opponents(), match: ["opponents", "opponent"] },
  { text: "Importa", link: href.import(), match: ["import"] },
  { text: "Impostazioni", link: href.settings(), match: ["settings"] },
];

export function App() {
  const route = useRoute();
  const data = useAppData();

  return (
    <div className="app">
      <nav className="nav" aria-label="Sezioni">
        <div className="nav-title">Poker Session Tracker</div>
        {NAV.map((n) => (
          <a key={n.link} href={n.link} aria-current={n.match.includes(route.name) ? "page" : undefined}>
            {n.text}
          </a>
        ))}
        <div className="nav-foot">Analisi dopo la sessione. I dati restano in questo browser.</div>
      </nav>
      <main className="main">
        <Screen route={route} data={data} />
      </main>
    </div>
  );
}

function Screen({ route, data }: { route: Route; data: ReturnType<typeof useAppData> }) {
  switch (route.name) {
    case "import": return <ImportScreen />;
    case "sessions": return <SessionsScreen data={data} />;
    case "session": return <SessionDetail data={data} id={route.id} />;
    case "opponents": return <OpponentsScreen data={data} />;
    case "opponent": return <OpponentDetail data={data} name={route.player} />;
    case "hands": return <HandsScreen data={data} query={route.query} />;
    case "hand": return <HandScreen data={data} id={route.id} from={route.from} />;
    case "settings": return <SettingsScreen data={data} />;
    default: return <SummaryScreen data={data} />;
  }
}
