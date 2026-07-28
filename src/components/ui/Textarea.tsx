import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils/cn";
import { fieldClass, fieldTone, FieldLabel } from "@/components/ui/Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, id, rows = 3, required, ...props },
  ref,
) {
  const autoId = useId();
  const areaId = id ?? autoId;
  const describedBy = error ? `${areaId}-error` : hint ? `${areaId}-hint` : undefined;

  return (
    <div className="w-full">
      <FieldLabel htmlFor={areaId} required={required}>
        {label}
      </FieldLabel>
      <textarea
        ref={ref}
        id={areaId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(fieldClass, fieldTone(!!error), "resize-y", className)}
        {...props}
      />
      {error ? (
        <p id={`${areaId}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${areaId}-hint`} className="mt-1.5 text-xs text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
