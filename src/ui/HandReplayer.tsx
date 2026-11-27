import { useEffect, useMemo, useState } from "react";
import { buildReplay, type SeatState } from "../stats/replay";
import type { Hand } from "../types";
import { Cards } from "./components";
import { formatEuro } from "./format";
import { POSITION_GLOSSARY } from "./glossary";
import { Term } from "./Term";

/** Posizione di un posto sull'ellisse del tavolo, in percentuale. */
function seatPlace(seat: number, refSeat: number, maxSeats: number, radius: { x: number; y: number }) {
  const offset = (((seat - refSeat) % maxSeats) + maxSeats) % maxSeats;
  // 90° = in basso al centro; si procede in senso orario come al tavolo.
  const angle = ((90 + (offset * 360) / maxSeats) * Math.PI) / 180;
  return { left: `${50 + radius.x * Math.cos(angle)}%`, top: `${50 + radius.y * Math.sin(angle)}%` };
}

function CardBacks() {
  return (
    <span className="card-backs" aria-label="carte coperte">
      <span className="card-back" />
      <span className="card-back" />
    </span>
  );
}

function Seat({ s, isButton, isActor, showCards }: { s: SeatState; isButton: boolean; isActor: boolean; showCards: boolean }) {
  const cls = ["rp-seat", s.folded && "folded", isActor && "actor", s.won > 0 && "winner"].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <div className="rp-name">
        {s.name}
        {isButton && (
          <span className="rp-dealer" title="Bottone" aria-label="bottone">
            D
          </span>
        )}
      </div>
      <div className="rp-meta">
        {s.position && <Term tip={POSITION_GLOSSARY[s.position]}>{s.position}</Term>}
        <span className="num">{formatEuro(s.stack)}</span>
        {s.allIn && <span className="rp-allin">all-in</span>}
      </div>
      <div className="rp-cards">
        {s.folded ? <span className="muted small">—</span> : s.cards && (s.revealed || showCards) ? <Cards cards={s.cards} /> : <CardBacks />}
      </div>
      {s.action && <div className="rp-action">{s.action}</div>}
    </div>
  );
}

/** Replay grafico di una mano, passo per passo (SPEC §6.12). */
export function HandReplayer({ hand }: { hand: Hand }) {
  const steps = useMemo(() => buildReplay(hand), [hand]);
  const [i, setI] = useState(0);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => setI(0), [hand.id]);

  const last = steps.length - 1;
  const go = (n: number) => setI(Math.min(Math.max(n, 0), last));

  // Frecce della tastiera ovunque nella pagina, tranne quando si scrive in un campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, last));
      else if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
      else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(last);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  const step = steps[i];
  if (!step) return null;
  const refSeat = hand.players.find((p) => p.name === hand.heroName)?.seat ?? 1;
  const betsTotal = step.seats.reduce((a, s) => a + s.bet, 0);

  return (
    <section className="card replayer" aria-label="Replay della mano">
      <div className="rp-table">
        <div className="rp-felt" />
        <div className="rp-center">
          <div className="rp-board">{step.board.length ? <Cards cards={step.board.join(" ")} /> : <span className="muted small">nessuna carta</span>}</div>
          <div className="rp-pot">
            Piatto <span className="num">{formatEuro(step.pot)}</span>
            {betsTotal > 0 && <span className="muted small num"> (+{formatEuro(betsTotal)} in gioco)</span>}
          </div>
          {step.rake > 0 && <div className="muted small">rake {formatEuro(step.rake)}</div>}
        </div>
        {step.seats.map((s) => (
          <div key={s.seat} className="rp-slot" style={seatPlace(s.seat, refSeat, hand.maxSeats, { x: 41, y: 38 })}>
            <Seat s={s} isButton={s.seat === hand.buttonSeat} isActor={s.name === step.actor} showCards={showAll} />
          </div>
        ))}
        {step.seats
          .filter((s) => s.bet > 0)
          .map((s) => (
            <div key={`bet-${s.seat}`} className="rp-bet num" style={seatPlace(s.seat, refSeat, hand.maxSeats, { x: 24, y: 19 })}>
              {formatEuro(s.bet)}
            </div>
          ))}
      </div>

      <div className="rp-controls">
        <button type="button" className="rp-arrow" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Passo precedente">
          ◀
        </button>
        <div className="rp-step">
          <div className="rp-text" aria-live="polite">
            {step.text}
          </div>
          <div className="small muted">
            passo {i + 1} di {steps.length} · frecce ← → della tastiera
          </div>
        </div>
        <button type="button" className="rp-arrow" onClick={() => go(i + 1)} disabled={i === last} aria-label="Passo successivo">
          ▶
        </button>
      </div>
      <div className="row small" style={{ justifyContent: "center", marginTop: "0.5rem" }}>
        <button type="button" onClick={() => go(0)} disabled={i === 0}>
          Inizio
        </button>
        <button type="button" onClick={() => go(last)} disabled={i === last}>
          Fine
        </button>
        <label>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Mostra tutte le carte
        </label>
      </div>
    </section>
  );
}
