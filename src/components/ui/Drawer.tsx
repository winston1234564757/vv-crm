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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
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
            initial={isMobile ? { y: "100%", x: 0 } : { x: "100%", y: 0 }}
            animate={{ x: 0, y: 0 }}
            exit={isMobile ? { y: "100%", x: 0 } : { x: "100%", y: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className={`fixed z-50 flex w-full flex-col bg-warm-surface shadow-sm shadow-[0_0_40px_oklch(0%_0_0/0.1)] ${
              isMobile 
                ? "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl border-t border-warm-border/50" 
                : "inset-y-0 right-0"
            } ${
              size === "full" 
                ? "max-w-full" 
                : size === "half" 
                  ? "max-w-full md:max-w-[50vw]" 
                  : "max-w-md md:max-w-lg"
            }`}
          >
            {isMobile && (
              <div className="w-12 h-1 bg-border-strong rounded-full mx-auto mt-4 shrink-0" />
            )}
            <div className={`flex items-center justify-between border-b border-warm-border/50 p-6 ${isMobile ? "pt-3 pb-4" : ""}`}>
              <h2 className="text-xl font-semibold tracking-tight text-text-primary text-balance">{title}</h2>
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

