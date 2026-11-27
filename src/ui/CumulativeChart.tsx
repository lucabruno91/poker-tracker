import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { sessionRangeAt } from "../stats/series";
import { formatBb } from "./format";
import { Term } from "./Term";

export interface ChartLine {
  label: string;
  /** Spiegazione mostrata come tooltip sull'etichetta della legenda. */
  tip?: string;
  /** Valori cumulati in bb, uno per mano. */
  points: number[];
  /** Classe CSS del tratto (colore). */
  className: string;
}

/** Intervallo di mani selezionato: indici della serie, estremi inclusi. */
export type ChartRange = [number, number];

const W = 800;
const H = 280;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };
const INNER_W = W - PAD.left - PAD.right;
/** Spostamento minimo (in pixel dello schermo) perché un gesto sia un trascinamento. */
const DRAG_PX = 5;

function niceStep(range: number): number {
  const raw = range / 5;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/**
 * Indice della mano sotto il puntatore. `offsetX` è la distanza dal bordo
 * sinistro dell'SVG in pixel dello schermo, `rectWidth` la sua larghezza a
 * schermo: si riporta alle coordinate del viewBox. La mano k occupa il tratto
 * tra il punto k e il punto k+1. Funzione pura.
 */
export function indexAt(offsetX: number, rectWidth: number, count: number): number {
  const svgX = (offsetX * W) / rectWidth;
  const i = Math.floor(((svgX - PAD.left) / INNER_W) * count);
  return Math.min(Math.max(i, 0), count - 1);
}

/** Intervalli [inizio, fine] delle sessioni con almeno una mano. */
function sessionRanges(sessionStarts: number[], count: number): ChartRange[] {
  const starts = [...new Set(sessionStarts.filter((s) => s < count))].sort((a, b) => a - b);
  return starts.map((s) => sessionRangeAt(sessionStarts, count, s));
}

interface Props {
  lines: ChartLine[];
  sessionStarts: number[];
  /** Selezione corrente; con `onSelect` il grafico diventa interattivo. */
  selection?: ChartRange | null;
  onSelect?: (range: ChartRange | null) => void;
}

/** Grafico dei risultati cumulati in bb (una o più linee), SVG scritto a mano. */
export function CumulativeChart({ lines, sessionStarts, selection = null, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Il punto di partenza sta in un ref: gli eventi del puntatore possono arrivare
  // prima che React ridisegni, e uno stato letto dalla closure sarebbe vecchio.
  const startRef = useRef<{ idx: number; px: number } | null>(null);
  /** Tratto mostrato durante il trascinamento (solo per il disegno). */
  const [preview, setPreview] = useState<ChartRange | null>(null);
  const count = Math.max(0, ...lines.map((l) => l.points.length));
  if (count === 0) return <p className="muted">Nessuna mano da mostrare.</p>;

  const all = [0, ...lines.flatMap((l) => l.points)];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const step = niceStep(max - min || 10);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step || step;

  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (INNER_W * i) / count;
  const y = (v: number) => PAD.top + innerH * (1 - (v - lo) / (hi - lo));
  const pathOf = (points: number[]) =>
    [0, ...points].map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  const finals = lines.map((l) => ({ ...l, last: l.points[l.points.length - 1] ?? 0 }));

  // --- Selezione col puntatore (mouse, penna, touch).
  const pointerIndex = (e: ReactPointerEvent) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return indexAt(e.clientX - r.left, r.width, count);
  };
  const rangeTo = (e: ReactPointerEvent): ChartRange | null => {
    const start = startRef.current;
    if (!start || Math.abs(e.clientX - start.px) <= DRAG_PX) return null;
    const idx = pointerIndex(e);
    return [Math.min(start.idx, idx), Math.max(start.idx, idx)];
  };
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!onSelect || e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    startRef.current = { idx: pointerIndex(e), px: e.clientX };
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (startRef.current) setPreview(rangeTo(e));
  };
  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const start = startRef.current;
    if (!start || !onSelect) return;
    // Trascinamento: il tratto; clic (spostamento minimo): la sessione sotto il puntatore.
    onSelect(rangeTo(e) ?? sessionRangeAt(sessionStarts, count, start.idx));
    startRef.current = null;
    setPreview(null);
  };
  const onPointerCancel = () => {
    startRef.current = null;
    setPreview(null);
  };

  const shown: ChartRange | null = preview ?? selection;

  const selLabel = selection ? `, selezionate le mani da ${selection[0] + 1} a ${selection[1] + 1}` : "";
  const ariaLabel = `Risultato cumulato su ${count} mani: ${finals.map((f) => `${f.label} ${formatBb(f.last)}`).join(", ")}${selLabel}`;

  // --- Selezione da tastiera: campi numerici e sessione precedente/successiva.
  const ranges = sessionRanges(sessionStarts, count);
  const currentSession = selection ? ranges.findIndex(([s, e]) => s === selection[0] && e === selection[1]) : -1;
  const goSession = (dir: -1 | 1) => {
    if (!onSelect || ranges.length === 0) return;
    let i: number;
    if (currentSession >= 0) i = currentSession + dir;
    else if (selection) i = dir > 0 ? ranges.findIndex(([s]) => s > selection[0]) : ranges.findLastIndex(([s]) => s < selection[0]);
    else i = dir > 0 ? 0 : ranges.length - 1;
    const r = ranges[i];
    if (r) onSelect(r);
  };
  const setBound = (which: 0 | 1, value: string) => {
    if (!onSelect) return;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > count) return;
    const cur: ChartRange = selection ?? [0, count - 1];
    const next: ChartRange = which === 0 ? [n - 1, Math.max(n - 1, cur[1])] : [Math.min(cur[0], n - 1), n - 1];
    onSelect(next);
  };

  return (
    <figure className="chart" style={{ margin: 0 }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        className={onSelect ? "selectable" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="axis" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {sessionStarts
          .filter((i) => i > 0)
          .map((i) => (
            <line key={i} className="sep" x1={x(i)} x2={x(i)} y1={PAD.top} y2={H - PAD.bottom} />
          ))}
        <line className="zero" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />
        {/* La prima linea (il totale) va disegnata per ultima, sopra le altre. */}
        {[...lines].reverse().map((l) => (
          <path key={l.label} className={`line ${l.className}`} d={pathOf(l.points)} />
        ))}
        {shown && (
          <g className="chart-selection" aria-hidden="true">
            {/* Attenua le parti fuori dalla selezione. */}
            <rect className="dim" x={PAD.left} y={PAD.top} width={Math.max(0, x(shown[0]) - PAD.left)} height={innerH} />
            <rect className="dim" x={x(shown[1] + 1)} y={PAD.top} width={Math.max(0, W - PAD.right - x(shown[1] + 1))} height={innerH} />
            <rect className="sel" x={x(shown[0])} y={PAD.top} width={Math.max(1, x(shown[1] + 1) - x(shown[0]))} height={innerH} />
          </g>
        )}
        <text x={W - PAD.right} y={H - 8} textAnchor="end">
          {count} mani
        </text>
        <text x={PAD.left} y={H - 8}>
          bb
        </text>
      </svg>
      {lines.length > 1 && (
        <figcaption className="chart-legend">
          {finals.map((f) => (
            <span key={f.label} className="legend-item">
              <span className={`legend-swatch ${f.className}`} aria-hidden="true" />
              {f.tip ? <Term tip={f.tip}>{f.label}</Term> : f.label} <span className={`num ${f.last > 0 ? "pos" : f.last < 0 ? "neg" : ""}`}>{formatBb(f.last)}</span>
            </span>
          ))}
        </figcaption>
      )}
      {onSelect && (
        <div className="row small chart-select-controls" role="group" aria-label="Selezione delle mani nel grafico">
          <span className="muted">Trascina sul grafico per selezionare un tratto, o clicca una sessione. Oppure:</span>
          <label htmlFor="sel-from">dalla mano</label>
          <input
            id="sel-from"
            type="number"
            min={1}
            max={count}
            value={selection ? selection[0] + 1 : ""}
            placeholder="1"
            onChange={(e) => setBound(0, e.target.value)}
          />
          <label htmlFor="sel-to">alla mano</label>
          <input
            id="sel-to"
            type="number"
            min={1}
            max={count}
            value={selection ? selection[1] + 1 : ""}
            placeholder={String(count)}
            onChange={(e) => setBound(1, e.target.value)}
          />
          <button type="button" onClick={() => goSession(-1)}>
            ‹ Sessione
          </button>
          <button type="button" onClick={() => goSession(1)}>
            Sessione ›
          </button>
        </div>
      )}
    </figure>
  );
}
