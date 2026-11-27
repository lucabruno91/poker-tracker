export interface ChartSeries {
  /** Risultato cumulato in bb dopo ogni mano dell'hero. */
  points: number[];
  /** Indici (in `points`) in cui inizia una nuova sessione. */
  sessionStarts: number[];
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

/** Grafico del risultato cumulato in bb, SVG scritto a mano. */
export function CumulativeChart({ points, sessionStarts }: ChartSeries) {
  if (points.length === 0) return <p className="muted">Nessuna mano da mostrare.</p>;

  const all = [0, ...points];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const step = niceStep(max - min || 10);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step || step;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (innerW * i) / Math.max(points.length, 1);
  const y = (v: number) => PAD.top + innerH * (1 - (v - lo) / (hi - lo));

  const path = all.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  const last = points[points.length - 1] ?? 0;

  return (
    <figure className="chart" style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Risultato cumulato: ${points.length} mani, ultimo valore ${last.toFixed(1)} bb`}
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
        <path className="line" d={path} />
        <text x={W - PAD.right} y={H - 8} textAnchor="end">
          {points.length} mani
        </text>
        <text x={PAD.left} y={H - 8}>
          bb
        </text>
      </svg>
    </figure>
  );
}
