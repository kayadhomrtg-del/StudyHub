import { useEffect, useRef, type KeyboardEvent, type RefCallback } from "react";

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function useModalFocus(
  open: boolean,
  onClose: () => void,
  preferredFocus: () => HTMLElement | null,
): {
  dialogRef: RefCallback<HTMLElement>;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
} {
  const elementRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  const preferredFocusRef = useRef(preferredFocus);
  closeRef.current = onClose;
  preferredFocusRef.current = preferredFocus;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const initialFocus = preferredFocusRef.current()
      ?? elementRef.current?.querySelector<HTMLElement>(focusableSelector)
      ?? elementRef.current;
    initialFocus?.focus();
    return () => {
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeRef.current();
      return;
    }
    if (event.key !== "Tab" || !elementRef.current) return;

    const focusable = Array.from(
      elementRef.current.querySelectorAll<HTMLElement>(focusableSelector),
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return {
    dialogRef: (element) => {
      elementRef.current = element;
    },
    onKeyDown,
  };
}
