"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IconClose } from "@/components/icons";
import { cn } from "@/lib/utils/cn";
import { useOverlay } from "@/components/ui/useOverlay";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Optional line under the title — use it for the question, not decoration. */
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

/**
 * Centred dialog for short, focused interruptions — a confirmation, a payment,
 * a single decision. Anything longer belongs in a Drawer.
 *
 * Replaces the hand-rolled `fixed inset-0` overlays in POSClient,
 * PayPurchaseModal, devices/table, parts/table and the store-launch modals,
 * none of which closed on Escape or trapped focus.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descId = useId();
  const panelRef = useOverlay(isOpen, onClose);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center p-4 sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-[var(--z-modal-backdrop)] bg-ink/40"
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              "relative z-[var(--z-modal)] flex max-h-[85dvh] w-full flex-col rounded-[var(--radius-xl)] border border-border bg-surface shadow-[0_12px_40px_oklch(0%_0_0/0.14)] focus:outline-none",
              size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-lg",
            )}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 px-6 pt-5 pb-4">
              <div>
                <h2
                  id={titleId}
                  className="font-display text-lg font-semibold tracking-tight text-ink text-balance"
                >
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1 text-sm text-muted">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрити"
                className="btn-press flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-hover text-muted transition-colors hover:bg-border hover:text-ink"
              >
                <IconClose />
              </button>
            </div>

            {children && <div className="flex-1 overflow-y-auto px-6 pb-5">{children}</div>}

            {footer && (
              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
