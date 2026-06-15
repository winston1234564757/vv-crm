"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IconClose } from "@/components/icons";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "default" | "full" | "half";
}

export default function Drawer({ isOpen, onClose, title, children, size = "half" }: DrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

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
            className="fixed inset-0 z-50 bg-warm-bg/80"
            aria-hidden="true"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-warm-surface shadow-sm shadow-[0_0_40px_oklch(0%_0_0/0.1)] ${
              size === "full" 
                ? "max-w-full" 
                : size === "half" 
                  ? "max-w-full md:max-w-[50vw]" 
                  : "max-w-md md:max-w-lg"
            }`}
          >
            <div className="flex items-center justify-between border-b border-warm-border/50 p-6">
              <h2 className="text-xl font-semibold tracking-tight text-text-primary">{title}</h2>
              <button
                onClick={onClose}
                className="btn-press flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-violet/5 text-text-secondary transition-colors hover:bg-violet/10 hover:text-violet"
              >
                <IconClose />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

