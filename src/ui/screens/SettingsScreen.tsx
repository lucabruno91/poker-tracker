import { useEffect, useRef, useState } from "react";
import { clearAllData, exportBackup, parseBackup, restoreBackup, type RestoreMode } from "../../db/backup";
import { applyClaudeLabels } from "../../db/profiles";
import { HERO_KEY, setSetting } from "../../db/schema";
import { applySeed, parseSeed } from "../../db/seed";
import { recomputeAllSessions } from "../../db/sessionsStore";
import { parseClaudeLabels } from "../../labels/claudeLabels";
import { db, type AppData } from "../data";

type Msg = { kind: "ok" | "error"; text: string } | null;

function Message({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <div className={`notice${msg.kind === "error" ? " error" : ""}`} role="status">
      {msg.text}
    </div>
  );
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function SettingsScreen({ data }: { data: AppData }) {
  return (
    <>
      <h1>Impostazioni</h1>
      <div className="notice">
        I dati restano solo in questo browser: nessun server, nessun invio a terzi. Fai il backup
        periodicamente.
      </div>
      <HeroSection hero={data.hero} />
      <BackupSection />
      <ClaudeLabelsSection />
      <SeedSection />
      <DeleteSection />
    </>
  );
}

function HeroSection({ hero }: { hero: string | null }) {
  const [name, setName] = useState(hero ?? "");
  const [msg, setMsg] = useState<Msg>(null);
  useEffect(() => setName(hero ?? ""), [hero]);

  const save = async () => {
    const value = name.trim();
    if (!value) return;
    await setSetting(db, HERO_KEY, value);
    const n = await recomputeAllSessions(db);
    setMsg({ kind: "ok", text: `Nome salvato; ${n} sessioni ricalcolate.` });
  };

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Hero</h2>
      <p className="small muted">
        Il tuo nome su PokerStars. Se non lo imposti viene dedotto dalle righe «Dealt to».
      </p>
      <div className="row">
        <label htmlFor="hero-name" className="sr-only">
          Nome dell'hero
        </label>
        <input id="hero-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" onClick={() => void save()} disabled={!name.trim() || name.trim() === hero}>
          Salva
        </button>
      </div>
      <Message msg={msg} />
    </section>
  );
}

function BackupSection() {
  const [msg, setMsg] = useState<Msg>(null);
  const [mode, setMode] = useState<RestoreMode>("merge");
  const input = useRef<HTMLInputElement>(null);

  const download = async () => {
    const backup = await exportBackup(db);
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `poker-tracker-backup-${backup.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg({ kind: "ok", text: `Backup scaricato: ${backup.hands.length} mani, ${backup.profiles.length} profili.` });
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      await restoreBackup(db, backup, mode);
      setMsg({
        kind: "ok",
        text: `Backup ${mode === "replace" ? "ripristinato (dati sostituiti)" : "unito ai dati attuali"}: ${backup.hands.length} mani.`,
      });
    } catch (e) {
      setMsg({ kind: "error", text: errorText(e) });
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Backup</h2>
      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <button type="button" className="primary" onClick={() => void download()}>
          Esporta backup (JSON)
        </button>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: "0 0 0.5rem" }}>
        <legend className="small">Quando reimporti un backup:</legend>
        <label>
          <input type="radio" name="restore-mode" checked={mode === "merge"} onChange={() => setMode("merge")} /> unisci
          ai dati attuali
        </label>{" "}
        <label>
          <input type="radio" name="restore-mode" checked={mode === "replace"} onChange={() => setMode("replace")} />{" "}
          sostituisci tutto
        </label>
      </fieldset>
      <button type="button" onClick={() => input.current?.click()}>
        Importa backup…
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="Scegli file di backup"
        onChange={(e) => void restore(e.target.files?.[0])}
      />
      <Message msg={msg} />
    </section>
  );
}

function ClaudeLabelsSection() {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  const apply = async () => {
    const { entries, errors } = parseClaudeLabels(text);
    if (entries.length > 0) await applyClaudeLabels(db, entries);
    setMsg({
      kind: errors.length ? "error" : "ok",
      text: `${entries.length} profili aggiornati.${errors.length ? ` Problemi: ${errors.join(" ")}` : ""}`,
    });
    if (errors.length === 0) setText("");
  };

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Etichette di Claude</h2>
      <p className="small muted">
        Incolla il JSON <code className="mono">{'{ "nome": { "label": "Fish", "note": "..." } }'}</code>. Va in
        etichetta e nota di Claude, senza toccare le tue.
      </p>
      <label htmlFor="claude-json" className="sr-only">
        JSON delle etichette di Claude
      </label>
      <textarea id="claude-json" className="mono" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row" style={{ marginTop: "0.5rem" }}>
        <button type="button" onClick={() => void apply()} disabled={!text.trim()}>
          Importa etichette
        </button>
      </div>
      <Message msg={msg} />
    </section>
  );
}

function SeedSection() {
  const [msg, setMsg] = useState<Msg>(null);
  const input = useRef<HTMLInputElement>(null);

  const apply = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { seed, errors } = parseSeed(await file.text());
      const r = await applySeed(db, seed);
      const missing = r.missingTables.length
        ? ` Riepiloghi non applicati (sessione non ancora importata): ${r.missingTables.join(", ")}.`
        : "";
      const problems = errors.length ? ` Problemi: ${errors.join(" ")}` : "";
      setMsg({
        kind: errors.length ? "error" : "ok",
        text: `${r.profiles} profili e ${r.summaries} riepiloghi di sessione applicati.${missing}${problems}`,
      });
    } catch (e) {
      setMsg({ kind: "error", text: errorText(e) });
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Dati iniziali</h2>
      <p className="small muted">
        File JSON con etichette e note di Claude sugli avversari e riepiloghi delle sessioni (formato nel README).
        Si può applicare più volte, ad esempio dopo aver importato altre sessioni: non sovrascrive i tuoi dati né i
        riepiloghi già scritti.
      </p>
      <button type="button" onClick={() => input.current?.click()}>
        Carica dati iniziali…
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="Scegli il file dei dati iniziali"
        onChange={(e) => void apply(e.target.files?.[0])}
      />
      <Message msg={msg} />
    </section>
  );
}

function DeleteSection() {
  const [armed, setArmed] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const remove = async () => {
    await clearAllData(db);
    setArmed(false);
    setMsg({ kind: "ok", text: "Tutti i dati sono stati eliminati." });
  };
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Elimina i dati</h2>
      <p className="small muted">Cancella mani, sessioni, profili e impostazioni da questo browser.</p>
      {armed ? (
        <div className="row">
          <span>Sei sicuro? L'operazione non si può annullare.</span>
          <button type="button" className="danger" onClick={() => void remove()}>
            Sì, elimina tutto
          </button>
          <button type="button" onClick={() => setArmed(false)}>
            Annulla
          </button>
        </div>
      ) : (
        <button type="button" className="danger" onClick={() => setArmed(true)}>
          Elimina tutti i dati…
        </button>
      )}
      <Message msg={msg} />
    </section>
  );
}
