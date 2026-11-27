// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { useDismiss } from "../src/ui/useDismiss";

afterEach(cleanup);

function Harness({ active, onDismiss }: { active: boolean; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, active, onDismiss);
  return (
    <div>
      <div ref={ref}>
        <button type="button">dentro</button>
      </div>
      <p>fuori</p>
    </div>
  );
}

describe("useDismiss", () => {
  it("un clic fuori chiama onDismiss, un clic dentro no", () => {
    const onDismiss = vi.fn();
    render(<Harness active onDismiss={onDismiss} />);
    fireEvent.pointerDown(screen.getByText("dentro"));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText("fuori"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("Esc chiama onDismiss", () => {
    const onDismiss = vi.fn();
    render(<Harness active onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("non fa nulla quando non è attivo", () => {
    const onDismiss = vi.fn();
    render(<Harness active={false} onDismiss={onDismiss} />);
    fireEvent.pointerDown(screen.getByText("fuori"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
