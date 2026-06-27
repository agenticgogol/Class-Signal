import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type SharedProps = { label: string; error?: string; hint?: string };
type InputFieldProps = SharedProps & InputHTMLAttributes<HTMLInputElement> & { multiline?: false };
type TextareaFieldProps = SharedProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true };

export function FormField(props: InputFieldProps | TextareaFieldProps) {
  const { label, error, hint, id, multiline, className = "", ...controlProps } = props;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  const controlClassName = `form-control ${error ? "form-control--error" : ""} ${className}`.trim();

  return (
    <div className={`form-field ${multiline ? "form-field--wide" : ""}`}>
      <label className="form-label" htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          {...(controlProps as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          aria-describedby={describedBy || undefined}
          aria-invalid={Boolean(error)}
          className={controlClassName}
          id={id}
        />
      ) : (
        <input
          {...(controlProps as InputHTMLAttributes<HTMLInputElement>)}
          aria-describedby={describedBy || undefined}
          aria-invalid={Boolean(error)}
          className={controlClassName}
          id={id}
        />
      )}
      {hint && <p className="form-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="form-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}
