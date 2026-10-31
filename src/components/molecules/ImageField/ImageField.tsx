import { useRef, useState } from "react";

import { Button } from "../../atoms/Button";
import { FieldError } from "../../atoms/FieldError";
import { Label } from "../../atoms/Label";
import { readImageAsDataUrl } from "../../../lib/image";

export interface ImageFieldProps {
  id: string;
  label: string;
  hint?: string;
  /** Data URL of the current image, null if none. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Longer side in pixels the image is scaled down to. */
  maxSize?: number;
}

export function ImageField({ id, label, hint, value, onChange, maxSize }: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      onChange(await readImageAsDataUrl(file, maxSize));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="form-field">
      <Label htmlFor={id}>{label}</Label>
      <div className="image-field">
        <div className="image-field-preview">
          {value ? <img src={value} alt={label} /> : <span className="muted">Kein Bild</span>}
        </div>
        <div className="image-field-actions">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              // Allows picking the same file again after removing it.
              e.target.value = "";
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            {value ? "Anderes Bild wählen" : "Bild wählen"}
          </Button>
          {value && (
            <Button type="button" variant="danger" size="sm" onClick={() => onChange(null)}>
              Entfernen
            </Button>
          )}
        </div>
      </div>
      {hint && <p className="muted">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}
