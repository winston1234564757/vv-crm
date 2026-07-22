import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils/cn";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** Omit for a bare checkbox, e.g. a row-selection cell in a table. */
  label?: string;
  /** Header "select all" state when only some rows on the page are selected. */
  indeterminate?: boolean;
}

/**
 * Native checkbox tinted with `accent-color`.
 *
 * The hand-rolled checkboxes this replaces carried `text-violet
 * focus:ring-violet`, which does nothing to a native checkbox without
 * @tailwindcss/forms — the project does not use that plugin, so every one of
 * them rendered in the browser's default blue, not the app accent.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const boxId = id ?? autoId;

  const box = (
    <input
      ref={(node) => {
        if (node) node.indeterminate = !!indeterminate;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      id={boxId}
      type="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 cursor-pointer rounded-[var(--radius-xs)] border border-border-strong bg-surface",
        "accent-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );

  if (!label) return box;

  return (
    <label htmlFor={boxId} className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
      {box}
      {label}
    </label>
  );
});
