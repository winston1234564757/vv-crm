import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils/cn";
import { fieldClass, fieldTone, FieldLabel } from "@/components/ui/Input";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Omit to render a bare select (e.g. inside a toolbar, where the label is the placeholder option). */
  label?: string;
  error?: string;
  hint?: string;
  /** Options as data. Pass `optionsOf(someMap)` from `@/lib/domain-labels`. */
  options?: SelectOption[];
  /** Leading option shown when nothing is chosen, e.g. "Всі статуси". */
  placeholder?: string;
  /**
   * Toolbar sizing: shrink-to-content and short, so several filters sit on one
   * row instead of stacking into a column. A prop rather than a `className`
   * override, because the sizing has to hold whatever else the caller passes.
   */
  inline?: boolean;
}

/**
 * Native select on the shared field chrome. Native is deliberate: it gives the
 * correct picker on touch devices for free, and this app is used behind a
 * counter on a phone as often as on the desktop.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, options, placeholder, inline = false, className, id, required, children, ...props },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;

  const field = (
    <select
      ref={ref}
      id={selectId}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      required={required}
      className={cn(
        fieldClass,
        fieldTone(!!error),
        "cursor-pointer",
        inline && "w-auto max-w-[190px] py-1.5 pr-8 text-sm md:text-xs",
        className,
      )}
      {...props}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options?.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {children}
    </select>
  );

  if (!label) return field;

  return (
    <div className="w-full">
      <FieldLabel htmlFor={selectId} required={required}>
        {label}
      </FieldLabel>
      {field}
      {error ? (
        <p id={`${selectId}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className="mt-1.5 text-xs text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
