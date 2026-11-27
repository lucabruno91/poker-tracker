// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { POSITION_GLOSSARY, STAT_GLOSSARY, TERM_GLOSSARY } from "../src/ui/glossary";
import { STAT_REFERENCES } from "../src/stats/reference";
import { POSITION_ORDER } from "../src/stats/byPosition";
import { Term } from "../src/ui/Term";

afterEach(cleanup);

describe("glossario", () => {
  it("ogni statistica e ogni posizione ha una spiegazione", () => {
    for (const key of Object.keys(STAT_REFERENCES)) {
      expect(STAT_GLOSSARY[key as keyof typeof STAT_GLOSSARY]?.length, key).toBeGreaterThan(20);
    }
    for (const p of POSITION_ORDER) expect(POSITION_GLOSSARY[p].length, p).toBeGreaterThan(10);
    for (const [k, v] of Object.entries(TERM_GLOSSARY)) expect(v.length, k).toBeGreaterThan(20);
  });
});

describe("<Term>", () => {
  it("è raggiungibile da tastiera e descritto dal tooltip", () => {
    render(<Term tip="Pre-Flop Raise: rilanci preflop.">PFR</Term>);
    const term = screen.getByText("PFR");
    expect(term.tabIndex).toBe(0);
    const tip = screen.getByRole("tooltip", { hidden: true });
    expect(term.getAttribute("aria-describedby")).toBe(tip.id);
    expect(tip.textContent).toBe("Pre-Flop Raise: rilanci preflop.");
  });

  it("si apre al focus e al passaggio del mouse, si chiude con Esc e uscita del mouse", () => {
    render(<Term tip="spiegazione">VPIP</Term>);
    const term = screen.getByText("VPIP");
    const tip = screen.getByRole("tooltip", { hidden: true });
    expect(tip.classList.contains("open")).toBe(false);

    act(() => term.focus());
    expect(tip.classList.contains("open")).toBe(true);
    fireEvent.keyDown(term, { key: "Escape" });
    expect(tip.classList.contains("open")).toBe(false);

    fireEvent.mouseEnter(term);
    expect(tip.classList.contains("open")).toBe(true);
    // Lo scroll (anche quello causato dal focus da tastiera) non lo chiude: lo riposiziona.
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(tip.classList.contains("open")).toBe(true);

    fireEvent.mouseLeave(term);
    expect(tip.classList.contains("open")).toBe(false);
    act(() => term.focus());
    act(() => term.blur());
    expect(tip.classList.contains("open")).toBe(false);
  });
});
