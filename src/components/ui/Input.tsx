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

/**
 * Мітка поля зі знаком обов'язковості.
 *
 * Досі `required` мовчки їхало в DOM, і єдиним свідченням, що поле треба
 * заповнити, була бульбашка браузера після невдалої відправки. На довгій формі
 * прийому це означало «кнопка не працює» — особливо для `type="file"`, який
 * блокує сабміт, не показуючи нічого поруч із собою.
 *
 * Зірочка `aria-hidden`: сам атрибут `required` на полі скрінрідер уже
 * озвучує, тож інакше він прочитав би це двічі.
 */
export function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-muted">
      {children}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-danger">
          *
        </span>
      )}
    </label>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  /** Helper text under the field. Hidden while an error is showing. */
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, id, required, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="w-full">
      <FieldLabel htmlFor={inputId} required={required}>
        {label}
      </FieldLabel>
      <input
        ref={ref}
        id={inputId}
        required={required}
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
