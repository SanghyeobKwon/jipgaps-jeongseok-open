"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { joinClassNames } from "./utils";

interface FieldContextValue {
  controlId: string;
  descriptionId?: string;
  errorId?: string;
  invalid: boolean;
  disabled: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldProps {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  id?: string;
  className?: string;
}

export function Field({ label, children, hint, error, required, disabled, loading = false, id, className }: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? `hmi-field-${generatedId}`;
  const descriptionId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  return (
    <FieldContext.Provider value={{ controlId, descriptionId, errorId, invalid: Boolean(error), disabled: Boolean(disabled || loading), required: Boolean(required) }}>
      <div className={joinClassNames("hmi-field", className)} data-disabled={disabled || loading || undefined} data-invalid={Boolean(error) || undefined} aria-busy={loading || undefined}>
        <label className="hmi-field__label" htmlFor={controlId}>
          {label}
          {required && <span className="hmi-field__required" aria-hidden="true">*</span>}
        </label>
        {children}
        {error ? (
          <p id={errorId} className="hmi-field__message hmi-field__message--error" role="alert">{error}</p>
        ) : hint ? (
          <p id={descriptionId} className="hmi-field__message">{hint}</p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

function useFieldControl(explicitId?: string, explicitDescribedBy?: string) {
  const context = useContext(FieldContext);
  const describedBy = [explicitDescribedBy, context?.errorId, context?.descriptionId].filter(Boolean).join(" ") || undefined;
  return {
    id: explicitId ?? context?.controlId,
    describedBy,
    invalid: context?.invalid || undefined,
    disabled: context?.disabled || undefined,
    required: context?.required || undefined,
  };
}

export const FieldInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function FieldInput(
  { id, className, "aria-describedby": describedBy, "aria-invalid": invalid, disabled, required, ...props },
  ref,
) {
  const field = useFieldControl(id, describedBy);
  return <input {...props} ref={ref} id={field.id} aria-describedby={field.describedBy} aria-invalid={invalid ?? field.invalid} disabled={disabled ?? field.disabled} required={required ?? field.required} className={joinClassNames("hmi-field__control", className)} />;
});

export const FieldSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function FieldSelect(
  { id, className, "aria-describedby": describedBy, "aria-invalid": invalid, disabled, required, children, ...props },
  ref,
) {
  const field = useFieldControl(id, describedBy);
  return <select {...props} ref={ref} id={field.id} aria-describedby={field.describedBy} aria-invalid={invalid ?? field.invalid} disabled={disabled ?? field.disabled} required={required ?? field.required} className={joinClassNames("hmi-field__control", className)}>{children}</select>;
});

export const FieldTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function FieldTextarea(
  { id, className, "aria-describedby": describedBy, "aria-invalid": invalid, disabled, required, ...props },
  ref,
) {
  const field = useFieldControl(id, describedBy);
  return <textarea {...props} ref={ref} id={field.id} aria-describedby={field.describedBy} aria-invalid={invalid ?? field.invalid} disabled={disabled ?? field.disabled} required={required ?? field.required} className={joinClassNames("hmi-field__control", className)} />;
});
