// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HandReplayer, SPEEDS } from "../src/ui/HandReplayer";
import { buildReplay } from "../src/stats/replay";
import { oneHand } from "./helpers";

const hand = oneHand("example.txt");
const total = buildReplay(hand).length; // 18 passi

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Avanza di `n` passi: un `act` per passo, perché ogni timeout è programmato dopo il ridisegno. */
const tick = (n: number, ms: number) => {
  for (let k = 0; k < n; k++) act(() => void vi.advanceTimersByTime(ms));
};
const stepLabel = () => screen.getByText(/^passo \d+ di/).textContent ?? "";
const stepNo = () => Number(/passo (\d+)/.exec(stepLabel())?.[1]);

describe("HandReplayer — riproduzione automatica", () => {
  it("avanza di un passo alla velocità scelta e si ferma alla fine", () => {
    render(<HandReplayer hand={hand} />);
    const play = screen.getByRole("button", { name: "▶ Riproduci" });
    fireEvent.click(play);
    expect(screen.getByRole("button", { name: "❚❚ Pausa" }).getAttribute("aria-pressed")).toBe("true");
    tick(1, SPEEDS.normal);
    expect(stepNo()).toBe(2);
    tick(3, SPEEDS.normal);
    expect(stepNo()).toBe(5);
    // Meno del tempo di un passo: non avanza.
    act(() => void vi.advanceTimersByTime(SPEEDS.normal - 1));
    expect(stepNo()).toBe(5);
    // Fino alla fine, poi si ferma da solo.
    tick(total, SPEEDS.normal);
    expect(stepNo()).toBe(total);
    expect(screen.getByRole("button", { name: "▶ Riproduci" })).toBeTruthy();
  });

  it("la pausa ferma l'avanzamento; dalla fine riparte dall'inizio", () => {
    render(<HandReplayer hand={hand} />);
    fireEvent.click(screen.getByRole("button", { name: "▶ Riproduci" }));
    tick(2, SPEEDS.normal);
    fireEvent.click(screen.getByRole("button", { name: "❚❚ Pausa" }));
    const at = stepNo();
    tick(5, SPEEDS.normal);
    expect(stepNo()).toBe(at);

    fireEvent.keyDown(window, { key: "End" });
    expect(stepNo()).toBe(total);
    fireEvent.click(screen.getByRole("button", { name: "▶ Riproduci" }));
    expect(stepNo()).toBe(1);
  });

  it("velocità veloce e barra spaziatrice", () => {
    render(<HandReplayer hand={hand} />);
    fireEvent.change(screen.getByLabelText("Velocità della riproduzione"), { target: { value: String(SPEEDS.fast) } });
    fireEvent.keyDown(window, { key: " " });
    tick(2, SPEEDS.fast);
    expect(stepNo()).toBe(3);
    fireEvent.keyDown(window, { key: " " });
    tick(4, SPEEDS.fast);
    expect(stepNo()).toBe(3);
  });
});
