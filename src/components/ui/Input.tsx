import { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">
          {label}
        </label>
        <input
          ref={ref}
          className={`w-full rounded-xl border bg-warm-surface px-4 py-3 text-sm text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40 ${
            error ? "border-rose/50" : "border-warm-border/60"
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-rose">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
