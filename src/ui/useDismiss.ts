import { useEffect, useRef, type RefObject } from "react";

/**
 * Chiama `onDismiss` quando, con `active` vero, si clicca (o si tocca) fuori
 * dall'elemento `ref` oppure si preme Esc. I clic dentro l'elemento non contano.
 */
export function useDismiss(ref: RefObject<HTMLElement | null>, active: boolean, onDismiss: () => void): void {
  // L'ultima callback in un ref: l'effetto non va ricreato a ogni render.
  const cb = useRef(onDismiss);
  cb.current = onDismiss;

  useEffect(() => {
    if (!active) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && ref.current && !ref.current.contains(target)) cb.current();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") cb.current();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [active, ref]);
}
