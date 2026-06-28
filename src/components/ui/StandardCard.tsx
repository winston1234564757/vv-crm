import { ReactNode } from "react";

interface StandardCardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}

export default function StandardCard({ children, className = "", interactive = false }: StandardCardProps) {
  return (
    <div
      className={`card p-5 ${interactive ? "card-hover" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
