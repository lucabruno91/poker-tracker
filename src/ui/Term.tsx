import {
  useEffect, useId, useRef, useState,
  type CSSProperties, type FocusEventHandler, type KeyboardEventHandler, type MouseEventHandler, type ReactNode, type RefObject,
} from "react";
import { createPortal } from "react-dom";

const HALF_WIDTH = 150; // metà della larghezza massima del tooltip (18rem ≈ 288px) + margine
const GAP = 6;

export interface Tooltip<T extends HTMLElement> {
  /** Da assegnare all'elemento che fa da ancora. */
  ref: RefObject<T | null>;
  /** Da spargere sull'elemento: apertura con mouse e focus, Esc per chiudere, descrizione accessibile. */
  props: {
    "aria-describedby": string;
    onMouseEnter: MouseEventHandler<T>;
    onMouseLeave: MouseEventHandler<T>;
    onFocus: FocusEventHandler<T>;
    onBlur: FocusEventHandler<T>;
    onKeyDown: KeyboardEventHandler<T>;
  };
  /** Il tooltip stesso, da rendere accanto all'elemento (vive in un portal su <body>). */
  node: ReactNode;
}

/**
 * Tooltip accessibile per qualsiasi elemento (acronimi, pulsanti). Compare al
 * passaggio del mouse e al focus da tastiera, si chiude con Esc ed è letto dai
 * lettori di schermo come descrizione. È `fixed` in un portal su <body>, così
 * non viene tagliato dalle tabelle scorrevoli né spostato da antenati con
 * `transform`, e resta dentro la finestra. Niente `title`: non funziona da
 * tastiera né su touch.
 */
export function useTooltip<T extends HTMLElement>(tip: string): Tooltip<T> {
  const id = useId();
  const ref = useRef<T>(null);
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
  // aperto, lo riposizioniamo accanto all'elemento. (Chiuderlo non va bene:
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

  return {
    ref,
    props: {
      "aria-describedby": id,
      onMouseEnter: show,
      onMouseLeave: hide,
      onFocus: show,
      onBlur: hide,
      onKeyDown: (e) => {
        if (e.key === "Escape") hide();
      },
    },
    node: createPortal(
      <span id={id} role="tooltip" className={`term-tip${open ? " open" : ""}`} style={style ?? undefined}>
        {tip}
      </span>,
      document.body,
    ),
  };
}

/** Acronimo con spiegazione (sottolineato a puntini, raggiungibile con Tab). */
export function Term({ children, tip }: { children: ReactNode; tip: string }) {
  const t = useTooltip<HTMLSpanElement>(tip);
  return (
    <span ref={t.ref} className="term" tabIndex={0} {...t.props}>
      {children}
      {t.node}
    </span>
  );
}

/**
 * Pulsante con tooltip esplicativo (stesse regole di `Term`). Da disattivato
 * usa `aria-disabled` invece di `disabled`: resta raggiungibile con Tab e il
 * tooltip può spiegare perché non si può usare.
 */
export function TipButton({
  tip, children, onClick, disabled = false,
}: { tip: string; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  const t = useTooltip<HTMLButtonElement>(tip);
  return (
    <>
      <button
        ref={t.ref}
        type="button"
        aria-disabled={disabled}
        className={disabled ? "is-disabled" : undefined}
        onClick={() => {
          if (!disabled) onClick();
        }}
        {...t.props}
      >
        {children}
      </button>
      {t.node}
    </>
  );
}
