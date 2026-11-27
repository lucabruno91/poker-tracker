import { formatBb } from "./format";

export interface ChartLine {
  label: string;
  /** Valori cumulati in bb, uno per mano. */
  points: number[];
  /** Classe CSS del tratto (colore). */
  className: string;
}

const W = 800;
const H = 280;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

function niceStep(range: number): number {
  const raw = range / 5;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** Grafico dei risultati cumulati in bb (una o più linee), SVG scritto a mano. */
export function CumulativeChart({ lines, sessionStarts }: { lines: ChartLine[]; sessionStarts: number[] }) {
  const count = Math.max(0, ...lines.map((l) => l.points.length));
  if (count === 0) return <p className="muted">Nessuna mano da mostrare.</p>;

  const all = [0, ...lines.flatMap((l) => l.points)];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const step = niceStep(max - min || 10);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step || step;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (innerW * i) / count;
  const y = (v: number) => PAD.top + innerH * (1 - (v - lo) / (hi - lo));
  const pathOf = (points: number[]) =>
    [0, ...points].map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  const finals = lines.map((l) => ({ ...l, last: l.points[l.points.length - 1] ?? 0 }));
  const ariaLabel = `Risultato cumulato su ${count} mani: ${finals.map((f) => `${f.label} ${formatBb(f.last)}`).join(", ")}`;

  return (
    <figure className="chart" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
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
              {f.label} <span className={`num ${f.last > 0 ? "pos" : f.last < 0 ? "neg" : ""}`}>{formatBb(f.last)}</span>
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
