import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}

export default function GlassCard({ children, className = "", interactive = false }: GlassCardProps) {
  return (
    <div
      className={`card p-5 ${interactive ? "card-hover" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
