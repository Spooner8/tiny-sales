import type { ReactNode } from "react";

import { FieldError } from "../../atoms/FieldError";
import { Label } from "../../atoms/Label";

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string | null;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, children }: FormFieldProps) {
  return (
    <div className="form-field">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      <FieldError message={error} />
    </div>
  );
}
