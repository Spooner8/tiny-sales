import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parses a numeric <input type="text"> value, guarding against NaN from
 * free-text entry (type="text" is used instead of type="number" because
 * native number inputs have a well-known bug where React re-renders can
 * reset the cursor/selection to the start of the field mid-edit).
 */
export function parseNumericInput(value: string, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
