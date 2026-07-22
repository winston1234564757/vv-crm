import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Shared field chrome. Input, Select and Textarea all render the same box, so
 * a row mixing them lines up instead of drifting by a pixel of padding.
 * `text-base md:text-sm` is deliberate: 16px on mobile stops iOS Safari from
 * zooming the viewport when the field takes focus.
 */
export const fieldClass =
  "w-full rounded-[var(--radius-md)] border bg-surface px-3.5 py-2.5 text-base md:text-sm text-ink placeholder-faint outline-none transition-colors hover:border-border-strong focus:border-accent disabled:cursor-not-allowed disabled:opacity-60";

export function fieldTone(hasError?: boolean) {
  return hasError ? "border-danger" : "border-border";
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  /** Helper text under the field. Hidden while an error is showing. */
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(fieldClass, fieldTone(!!error), className)}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
