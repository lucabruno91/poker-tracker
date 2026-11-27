// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CARD_BG, contrastRatio, describeCard, rankLabel, SUITS } from "../src/ui/cards";
import { Cards } from "../src/ui/components";

afterEach(cleanup);

describe("mazzo a quattro colori", () => {
  it("colori dei semi: cuori rosso, quadri blu, fiori verde, picche nero", () => {
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
    const [hr, hg, hb] = rgb(SUITS.h.color);
    const [dr, dg, db] = rgb(SUITS.d.color);
    const [cr, cg, cb] = rgb(SUITS.c.color);
    const [sr, sg, sb] = rgb(SUITS.s.color);
    expect(hr).toBeGreaterThan(Math.max(hg, hb)); // rosso
    expect(db).toBeGreaterThan(Math.max(dr, dg)); // blu
    expect(cg).toBeGreaterThan(Math.max(cr, cb)); // verde
    expect(Math.max(sr, sg, sb)).toBeLessThan(40); // nero
  });

  it("ogni colore ha contrasto almeno 4,5:1 sul fondo della carta", () => {
    for (const [k, s] of Object.entries(SUITS)) {
      expect(contrastRatio(s.color, CARD_BG), k).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("nomi per esteso e rango del dieci", () => {
    expect(describeCard("Ah")).toBe("asso di cuori");
    expect(describeCard("Td")).toBe("dieci di quadri");
    expect(describeCard("9c")).toBe("nove di fiori");
    expect(describeCard("Qs")).toBe("donna di picche");
    expect(describeCard("Xx")).toBe("Xx");
    expect(rankLabel("T")).toBe("10");
    expect(rankLabel("K")).toBe("K");
  });
});

describe("<Cards>", () => {
  it("mostra rango e simbolo colorato, con il nome accessibile", () => {
    render(<Cards cards="Ah Td 9c Ks" />);
    const group = screen.getByRole("img", { name: "asso di cuori, dieci di quadri, nove di fiori, re di picche" });
    const cards = [...group.querySelectorAll(".playing-card")] as HTMLElement[];
    expect(cards.map((c) => c.textContent)).toEqual(["A♥︎", "10♦︎", "9♣︎", "K♠︎"]);
    const color = (el: HTMLElement) => el.style.color;
    expect(color(cards[0]!)).toBe("rgb(179, 38, 30)");
    expect(color(cards[1]!)).toBe("rgb(31, 95, 168)");
    expect(color(cards[2]!)).toBe("rgb(23, 105, 60)");
    expect(color(cards[3]!)).toBe("rgb(20, 24, 28)");
  });

  it("senza carte mostra un trattino", () => {
    const { container } = render(<Cards cards={null} />);
    expect(container.textContent).toBe("—");
  });
});
