// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CumulativeChart, sessionRanges, targetSession, type ChartRange } from "../src/ui/CumulativeChart";

afterEach(cleanup);

// 10 mani in tre sessioni: 0–3, 4–6, 7–9.
const points = [1, 2, 1, 3, 2, 0, -1, 0, 2, 4];
const sessionStarts = [0, 4, 7];

function setup(selection: ChartRange | null = null) {
  const onSelect = vi.fn();
  render(
    <CumulativeChart
      lines={[{ label: "Totale", points, className: "line-total" }]}
      sessionStarts={sessionStarts}
      selection={selection}
      onSelect={onSelect}
    />,
  );
  const svg = screen.getByRole("img");
  // jsdom non calcola il layout: l'SVG è largo 800px a partire da x = 0.
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 280, right: 800, bottom: 280, x: 0, y: 0, toJSON: () => ({}) });
  return { svg, onSelect };
}

/** Ascissa (px) del centro della mano i, con area dati da 56 a 784. */
const xOf = (i: number) => 56 + ((i + 0.5) * 728) / points.length;

describe("CumulativeChart — selezione", () => {
  it("un clic seleziona la sessione sotto il puntatore", () => {
    const { svg, onSelect } = setup();
    fireEvent.pointerDown(svg, { clientX: xOf(5), button: 0, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: xOf(5), pointerId: 1 });
    expect(onSelect).toHaveBeenCalledWith([4, 6]);
  });

  it("un trascinamento seleziona il tratto, anche da destra a sinistra", () => {
    const { svg, onSelect } = setup();
    fireEvent.pointerDown(svg, { clientX: xOf(8), button: 0, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: xOf(2), pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: xOf(2), pointerId: 1 });
    expect(onSelect).toHaveBeenCalledWith([2, 8]);
  });

  it("selezione da tastiera: campi numerici e sessioni", () => {
    const { onSelect } = setup([4, 6]);
    fireEvent.change(screen.getByLabelText("dalla mano"), { target: { value: "2" } });
    expect(onSelect).toHaveBeenLastCalledWith([1, 6]);
    fireEvent.change(screen.getByLabelText("alla mano"), { target: { value: "9" } });
    expect(onSelect).toHaveBeenLastCalledWith([4, 8]);
    fireEvent.click(screen.getByRole("button", { name: "Sessione successiva ›" }));
    expect(onSelect).toHaveBeenLastCalledWith([7, 9]);
    fireEvent.click(screen.getByRole("button", { name: "‹ Sessione precedente" }));
    expect(onSelect).toHaveBeenLastCalledWith([0, 3]);
  });

  it("la selezione compare nella descrizione accessibile", () => {
    const { svg } = setup([4, 6]);
    expect(svg.getAttribute("aria-label")).toContain("selezionate le mani da 5 a 7");
  });
});

describe("CumulativeChart — gesti rapidi", () => {
  it("un trascinamento senza eventi intermedi resta un trascinamento", () => {
    const { svg, onSelect } = setup();
    fireEvent.pointerDown(svg, { clientX: xOf(1), button: 0, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: xOf(6), pointerId: 1 });
    expect(onSelect).toHaveBeenCalledWith([1, 6]);
  });

  it("un piccolo tremolio del puntatore è ancora un clic", () => {
    const { svg, onSelect } = setup();
    fireEvent.pointerDown(svg, { clientX: xOf(8), button: 0, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: xOf(8) + 3, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: xOf(8) + 3, pointerId: 1 });
    expect(onSelect).toHaveBeenCalledWith([7, 9]);
  });
});

describe("CumulativeChart — legenda", () => {
  const lines = [
    { label: "Totale", points: [1, 2, 3], className: "line-total" },
    { label: "Showdown", points: [10, 20, 30], className: "line-sd" },
    { label: "Senza showdown", points: [-1, -2, -3], className: "line-nsd" },
  ];
  const renderChart = (hidden: string[]) => {
    const onToggleLine = vi.fn();
    const r = render(<CumulativeChart lines={lines} sessionStarts={[0]} hidden={hidden} onToggleLine={onToggleLine} />);
    return { ...r, onToggleLine };
  };

  it("il trattino colorato è un pulsante che attiva e disattiva la linea", () => {
    const { onToggleLine } = renderChart([]);
    const btn = screen.getByRole("button", { name: "Nascondi la linea Showdown" });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(btn);
    expect(onToggleLine).toHaveBeenCalledWith("Showdown");
  });

  it("una linea nascosta non è disegnata e la scala si adatta", () => {
    const { container } = renderChart(["Showdown"]);
    expect(container.querySelectorAll("path.line")).toHaveLength(2);
    expect(container.querySelector("path.line-sd")).toBeNull();
    // Senza la linea che arriva a 30, l'asse non supera più 10.
    const ticks = [...container.querySelectorAll("svg text")].map((t) => Number(t.textContent)).filter((n) => !Number.isNaN(n));
    expect(Math.max(...ticks)).toBeLessThanOrEqual(10);
    const off = screen.getByRole("button", { name: "Mostra la linea Showdown" });
    expect(off.getAttribute("aria-pressed")).toBe("false");
    expect(off.closest(".legend-item")?.classList.contains("off")).toBe(true);
  });

  it("l'ultima linea visibile non si può nascondere", () => {
    renderChart(["Showdown", "Senza showdown"]);
    const last = screen.getByRole("button", { name: "Nascondi la linea Totale" }) as HTMLButtonElement;
    expect(last.disabled).toBe(true);
  });
});

describe("CumulativeChart — pulsanti di sessione", () => {
  it("hanno testi espliciti e un tooltip che spiega cosa fanno", () => {
    setup();
    const next = screen.getByRole("button", { name: "Sessione successiva ›" });
    const tip = document.getElementById(next.getAttribute("aria-describedby") ?? "");
    expect(tip?.getAttribute("role")).toBe("tooltip");
    expect(tip?.textContent).toContain("Seleziona nel grafico la sessione successiva");
    expect(tip?.classList.contains("open")).toBe(false);
    fireEvent.mouseEnter(next);
    expect(tip?.classList.contains("open")).toBe(true);
    fireEvent.mouseLeave(next);
    expect(tip?.classList.contains("open")).toBe(false);
    expect(screen.getByRole("button", { name: "‹ Sessione precedente" })).toBeTruthy();
  });
});

describe("targetSession", () => {
  const ranges: ChartRange[] = [[0, 3], [4, 6], [7, 9]];
  it("senza selezione parte dalla prima o dall'ultima", () => {
    expect(targetSession(ranges, null, 1)).toBe(0);
    expect(targetSession(ranges, null, -1)).toBe(2);
  });
  it("con una sessione selezionata passa alla vicina, -1 ai bordi", () => {
    expect(targetSession(ranges, [4, 6], 1)).toBe(2);
    expect(targetSession(ranges, [4, 6], -1)).toBe(0);
    expect(targetSession(ranges, [7, 9], 1)).toBe(-1);
    expect(targetSession(ranges, [0, 3], -1)).toBe(-1);
  });
  it("con un tratto libero salta alla sessione dopo o prima del suo inizio", () => {
    expect(targetSession(ranges, [2, 5], 1)).toBe(1);
    expect(targetSession(ranges, [2, 5], -1)).toBe(0);
    expect(targetSession(ranges, [8, 9], 1)).toBe(-1);
  });
  it("una sola sessione: dopo averla selezionata non c'è altro", () => {
    expect(targetSession([[0, 9]], null, 1)).toBe(0);
    expect(targetSession([[0, 9]], [0, 9], 1)).toBe(-1);
    expect(targetSession([[0, 9]], [0, 9], -1)).toBe(-1);
    expect(targetSession([], null, 1)).toBe(-1);
  });
  it("sessionRanges ignora le sessioni senza mani", () => {
    expect(sessionRanges([0, 3, 3, 5], 7)).toEqual([[0, 2], [3, 4], [5, 6]]);
  });
});

describe("CumulativeChart — una sola sessione (es. filtro «Oggi»)", () => {
  it("i pulsanti si disattivano e lo dicono, l'indicatore mostra la posizione", () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <CumulativeChart lines={[{ label: "Totale", points, className: "line-total" }]} sessionStarts={[0]} selection={null} onSelect={onSelect} />,
    );
    const next = screen.getByRole("button", { name: "Sessione successiva ›" });
    expect(next.getAttribute("aria-disabled")).toBe("false");
    expect(screen.getByText("1 sessione")).toBeTruthy();
    fireEvent.click(next);
    expect(onSelect).toHaveBeenLastCalledWith([0, 9]);

    rerender(
      <CumulativeChart lines={[{ label: "Totale", points, className: "line-total" }]} sessionStarts={[0]} selection={[0, 9]} onSelect={onSelect} />,
    );
    const nextAfter = screen.getByRole("button", { name: "Sessione successiva ›" });
    const prevAfter = screen.getByRole("button", { name: "‹ Sessione precedente" });
    expect(nextAfter.getAttribute("aria-disabled")).toBe("true");
    expect(prevAfter.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("sessione 1 di 1")).toBeTruthy();
    onSelect.mockClear();
    fireEvent.click(nextAfter);
    expect(onSelect).not.toHaveBeenCalled();
    const tip = document.getElementById(nextAfter.getAttribute("aria-describedby") ?? "");
    expect(tip?.textContent).toContain("Non c'è una sessione successiva");
    // Disattivato ma raggiungibile da tastiera, per leggere il motivo.
    expect(nextAfter.hasAttribute("disabled")).toBe(false);
  });
});
