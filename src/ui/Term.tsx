import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

const HALF_WIDTH = 150; // metà della larghezza massima del tooltip (18rem ≈ 288px) + margine
const GAP = 6;

/**
 * Acronimo con spiegazione. Il tooltip compare al passaggio del mouse e al
 * focus da tastiera (Tab), e i lettori di schermo leggono la spiegazione come
 * descrizione. È posizionato `fixed`, così non viene tagliato dalle tabelle
 * scorrevoli, e resta dentro la finestra. Niente `title`: non funziona da
 * tastiera né su touch. Il tooltip vive in un portal su <body>.
 */
export function Term({ children, tip }: { children: ReactNode; tip: string }) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [style, setStyle] = useState<CSSProperties | null>(null);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const center = Math.min(Math.max(r.left + r.width / 2, HALF_WIDTH), window.innerWidth - HALF_WIDTH);
    const above = r.top > 90;
    setStyle({
      left: center,
      top: above ? r.top - GAP : r.bottom + GAP,
      transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
    });
  };
  const hide = () => setStyle(null);
  const open = style !== null;

  // Il tooltip è fisso: se la pagina scorre o cambia dimensione mentre è
  // aperto, lo riposizioniamo accanto all'acronimo. (Chiuderlo non va bene:
  // il focus da tastiera fa scorrere la pagina e lo chiuderebbe subito.)
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", show, { capture: true, passive: true });
    window.addEventListener("resize", show);
    return () => {
      window.removeEventListener("scroll", show, { capture: true });
      window.removeEventListener("resize", show);
    };
    // `show` legge solo il ref: basta riagganciarlo quando il tooltip si apre.
  }, [open]);

  return (
    <span
      ref={ref}
      className="term"
      tabIndex={0}
      aria-describedby={id}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === "Escape") hide();
      }}
    >
      {children}
      {/* Portal su <body>: un antenato con `transform` (es. i posti del replayer)
          cambierebbe il riferimento di `position: fixed`. */}
      {createPortal(
        <span id={id} role="tooltip" className={`term-tip${style ? " open" : ""}`} style={style ?? undefined}>
          {tip}
        </span>,
        document.body,
      )}
    </span>
  );
}
