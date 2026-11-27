import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { saveHandNote } from "../db/handNotes";
import { HAND_TAGS, type HandTag } from "../types";
import { db } from "./data";

const TAG_KEYS = Object.keys(HAND_TAGS) as HandTag[];

/** Tag di studio e nota libera di una mano. I tag si salvano subito, la nota al salvataggio o all'uscita dal campo. */
export function HandNotesEditor({ handId }: { handId: string }) {
  const saved = useLiveQuery(() => db.handNotes.get(handId), [handId]);
  const tags = saved?.tags ?? [];
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"" | "saved">("");
  useEffect(() => setText(saved?.note ?? ""), [saved?.note, handId]);

  const savedText = saved?.note ?? "";
  const dirty = text.trim() !== savedText;

  const toggle = (t: HandTag) => {
    const next = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t];
    void saveHandNote(db, handId, next, savedText);
  };
  const saveText = async () => {
    if (!dirty) return;
    await saveHandNote(db, handId, tags, text);
    setStatus("saved");
    window.setTimeout(() => setStatus(""), 2000);
  };

  return (
    <section className="card" aria-labelledby="hand-notes-title">
      <h2 id="hand-notes-title" style={{ marginTop: 0 }}>
        Studio
      </h2>
      <div className="row" role="group" aria-label="Tag della mano">
        {TAG_KEYS.map((t) => {
          const on = tags.includes(t);
          return (
            <button key={t} type="button" className={`tag-toggle${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggle(t)}>
              {HAND_TAGS[t]}
            </button>
          );
        })}
      </div>
      <label htmlFor="hand-note" style={{ display: "block", marginTop: "0.75rem" }}>
        Nota
      </label>
      <textarea
        id="hand-note"
        value={text}
        placeholder="Cosa rivedere, cosa avresti fatto diversamente…"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void saveText()}
      />
      <div className="row" style={{ marginTop: "0.5rem" }}>
        <button type="button" onClick={() => void saveText()} disabled={!dirty}>
          Salva nota
        </button>
        <span className="small muted" role="status">
          {status === "saved" ? "Salvata" : dirty ? "Modifiche non salvate" : ""}
        </span>
      </div>
    </section>
  );
}
