"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Shared behaviour for Drawer and Modal: lock the background, close on Escape,
 * keep Tab inside the panel, and give focus back to whatever opened it.
 *
 * Both overlays previously had none of this. A drawer over a table left focus
 * on the row behind it, so Tab walked the page underneath while the drawer
 * covered it, and Escape did nothing — the only way out was the mouse.
 *
 * Returns the ref to attach to the panel element.
 */
export function useOverlay(isOpen: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  // Lock background scroll. Restores the previous value rather than clearing,
  // so nested overlays cannot unlock the page when the inner one closes.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Remember the trigger, move focus into the panel, hand it back on close.
  useEffect(() => {
    if (!isOpen) return;
    restoreTo.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    // Fall back to the panel itself so focus never stays behind the overlay.
    (first ?? panel)?.focus({ preventScroll: true });

    return () => {
      restoreTo.current?.focus?.({ preventScroll: true });
    };
  }, [isOpen]);

  // Escape closes; Tab cycles within the panel.
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  return panelRef;
}
