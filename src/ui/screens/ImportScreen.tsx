import { useRef, useState, type DragEvent } from "react";
import { importFiles, type ImportReport } from "../../db/importFiles";
import { db } from "../data";
import { href } from "../router";
import { Kpi } from "../components";

export function ImportScreen() {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const run = async (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      setReport(await importFiles(db, files));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void run(e.dataTransfer.files);
  };

  return (
    <>
      <h1>Importa hand history</h1>
      <p className="muted">
        File .txt di PokerStars (cash game NL Hold'em, salvati in inglese). Puoi reimportare gli
        stessi file: le mani già presenti vengono saltate.
      </p>
      <div
        className={`dropzone${over ? " over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <p>Trascina qui i file</p>
        <button type="button" className="primary" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? "Importazione…" : "Scegli file"}
        </button>
        <input
          ref={input}
          type="file"
          accept=".txt,text/plain"
          multiple
          hidden
          aria-label="Scegli file di hand history"
          onChange={(e) => void run(e.target.files)}
        />
      </div>

      {error && <div className="notice error">Errore durante l'import: {error}</div>}
      {report && <Report report={report} />}
    </>
  );
}

function Report({ report }: { report: ImportReport }) {
  return (
    <section className="card" aria-live="polite">
      <h2 style={{ marginTop: 0 }}>Risultato</h2>
      <div className="kpis">
        <Kpi label="File" value={report.files} />
        <Kpi label="Mani lette" value={report.read} />
        <Kpi label="Nuove" value={report.added} />
        <Kpi label="Duplicate" value={report.duplicates} />
        <Kpi label="Scartate" value={report.rejected.length} />
      </div>
      {report.added > 0 && (
        <p>
          {report.sessionsUpdated} sessioni aggiornate. <a href={href.sessions()}>Vai alle sessioni</a>
        </p>
      )}
      {report.rejected.length > 0 && (
        <>
          <h3>Mani scartate</h3>
          <ul className="small">
            {report.rejected.map((r, i) => (
              <li key={i}>
                {r.file}
                {r.handId ? ` — mano ${r.handId}` : ""}: {r.reason}
              </li>
            ))}
          </ul>
        </>
      )}
      {report.imbalanced.length > 0 && (
        <div className="notice error">
          {report.imbalanced.length} mani hanno un totale incoerente (somma dei netti diversa dal rake):{" "}
          {report.imbalanced.map((id, i) => (
            <span key={id}>
              {i > 0 && ", "}
              <a href={href.hand(id)}>{id}</a>
            </span>
          ))}
        </div>
      )}
      {report.unknownLines.length > 0 && (
        <details>
          <summary className="small">Debug: {report.unknownLines.length} righe non riconosciute (ignorate)</summary>
          <pre className="hand-raw small">
            {report.unknownLines.map((u) => `${u.handId}  ${u.line}`).join("\n")}
          </pre>
        </details>
      )}
    </section>
  );
}
