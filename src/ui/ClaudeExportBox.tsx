import { useEffect, useState } from "react";
import type { GroupExport } from "../export/claudeExport";
import { CopyButton } from "./components";

/**
 * «Esporta per Claude»: prepara il testo solo su richiesta (può essere lungo),
 * lo mostra in anteprima e lo copia. `resetKey` chiude l'anteprima quando
 * cambia il gruppo di mani (es. un'altra selezione o altri filtri).
 */
export function ClaudeExportBox({ build, resetKey }: { build: () => GroupExport; resetKey: string }) {
  const [result, setResult] = useState<GroupExport | null>(null);
  useEffect(() => setResult(null), [resetKey]);

  return (
    <div className="claude-export">
      <div className="row">
        <button type="button" onClick={() => setResult(build())}>
          Esporta per Claude
        </button>
        {result && <CopyButton text={() => result.text} />}
        {result && (
          <button type="button" onClick={() => setResult(null)}>
            Chiudi
          </button>
        )}
      </div>
      {result && result.exported < result.total && (
        <p className="small notice" role="status">
          Esportate le prime {result.exported} mani di {result.total}: restringi la selezione o i filtri per mandarle
          tutte. Risultato e statistiche nel testo valgono comunque per tutte.
        </p>
      )}
      {result && (
        <pre className="hand-raw small" style={{ marginTop: "0.75rem", maxHeight: "22rem" }}>
          {result.text}
        </pre>
      )}
    </div>
  );
}
