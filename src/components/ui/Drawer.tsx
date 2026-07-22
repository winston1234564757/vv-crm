"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IconClose } from "@/components/icons";
import { cn } from "@/lib/utils/cn";
import { useOverlay } from "@/components/ui/useOverlay";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "default" | "full" | "half";
  /** Sticky action bar pinned to the bottom of the panel. */
  footer?: React.ReactNode;
}

export default function Drawer({
  isOpen,
  onClose,
  title,
  children,
  size = "half",
  footer,
}: DrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const titleId = useId();
  const panelRef = useOverlay(isOpen, onClose);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[var(--z-drawer-backdrop)] bg-ink/40"
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={isMobile ? { y: "100%", x: 0 } : { x: "100%", y: 0 }}
            animate={{ x: 0, y: 0 }}
            exit={isMobile ? { y: "100%", x: 0 } : { x: "100%", y: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              "fixed z-[var(--z-drawer)] flex w-full flex-col bg-surface shadow-[0_0_40px_oklch(0%_0_0/0.1)] focus:outline-none",
              isMobile
                ? "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[var(--radius-xl)] border-t border-border"
                : "inset-y-0 right-0 border-l border-border",
              size === "full"
                ? "max-w-full"
                : size === "half"
                  ? "max-w-full md:max-w-[50vw]"
                  : "max-w-md md:max-w-lg",
            )}
          >
            {isMobile && (
              <div className="mx-auto mt-3 h-1 w-12 shrink-0 rounded-full bg-border-strong" />
            )}
            <div
              className={cn(
                "flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-5",
                isMobile && "pt-3 pb-4",
              )}
            >
              <h2
                id={titleId}
                className="font-display text-xl font-semibold tracking-tight text-ink text-balance"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрити"
                className="btn-press flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-hover text-muted transition-colors hover:bg-border hover:text-ink"
              >
                <IconClose />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">{children}</div>

            {footer && (
              <div className="shrink-0 border-t border-border bg-surface px-6 py-4">{footer}</div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
