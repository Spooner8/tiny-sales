import { useEffect, useRef } from "react";

// Scanners send keystrokes a few ms apart; even fast human typing rarely gets
// below ~40ms between keys, and never several times in a row.
const FAST_GAP_MS = 35;
const RESET_GAP_MS = 300;
const IDLE_FINALIZE_MS = 300;
const MIN_LENGTH = 3;
/** Consecutive fast gaps needed before a burst counts as a scan. */
const MIN_FAST_GAPS_TO_CONFIRM = 3;

/**
 * Scanners emulate a US-layout HID keyboard. If the OS keyboard layout is
 * different (e.g. German/Swiss), punctuation keys can resolve to the wrong
 * character or even start a dead-key composition that eats the following
 * keystrokes entirely. event.code reports the physical US-layout key
 * regardless of the active OS layout, so it's used to normalize the small
 * set of punctuation keys that actually differ between layouts.
 */
const CODE_OVERRIDES: Record<string, string> = {
  Minus: "-",
  Slash: "/",
  Period: ".",
  Comma: ",",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Semicolon: ";",
  Quote: "'",
  Backslash: "\\",
};

function resolveChar(event: KeyboardEvent): string | null {
  const override = CODE_OVERRIDES[event.code];
  if (override) return override;
  if (event.key.length === 1) return event.key;
  return null;
}

/**
 * The first couple of characters of a burst can land in whatever text input
 * is focused before the detector is confident it's a scan (and once
 * confirmed, the Enter keystroke that would normally clear that field via
 * its own submit handler gets intercepted instead). Once a scan is
 * confirmed, wipe any such leftovers from the currently focused field so it
 * doesn't show stray characters. Uses the native value setter + a real
 * `input` event so React's controlled-input state picks up the change.
 */
function clearFocusedTextInput() {
  const el = document.activeElement;
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
  const prototype = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(el, "");
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Detects keyboard-wedge barcode/QR scanner input anywhere on the page,
 * independent of which element currently has focus. Scanners type far
 * faster and more consistently than humans, so once a burst of keystrokes
 * shows MIN_FAST_GAPS_TO_CONFIRM consecutive fast gaps it is treated as a scan
 * for the rest of that burst (including its slower-starting first key) and
 * finalized either on Enter (most scanners) or after a short idle gap
 * (scanners configured with no suffix).
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const bufferRef = useRef("");
  const lastTimeRef = useRef(0);
  const fastGapCountRef = useRef(0);
  const isScanningRef = useRef(false);
  const idleTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;

    function reset() {
      bufferRef.current = "";
      fastGapCountRef.current = 0;
      isScanningRef.current = false;
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    }

    function finalize() {
      const code = bufferRef.current;
      const wasScanning = isScanningRef.current;
      reset();
      if (wasScanning && code.length >= MIN_LENGTH) {
        clearFocusedTextInput();
        onScan(code);
      }
    }

    function scheduleIdleFinalize() {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(finalize, IDLE_FINALIZE_MS);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter") {
        if (isScanningRef.current) event.preventDefault();
        finalize();
        return;
      }

      const char = resolveChar(event);
      if (char === null) return;

      const now = performance.now();
      const gap = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (gap > RESET_GAP_MS) {
        reset();
      } else if (gap < FAST_GAP_MS) {
        fastGapCountRef.current += 1;
        if (fastGapCountRef.current >= MIN_FAST_GAPS_TO_CONFIRM) {
          isScanningRef.current = true;
        }
      } else if (!isScanningRef.current) {
        // A human-speed gap: occasional quick key pairs while typing must not
        // add up to a "scan" (that swallowed fast search input). The buffer is
        // kept so a scan whose first keys arrive slower still captures them.
        fastGapCountRef.current = 0;
      }

      // Prevent default as soon as this burst looks like a scan, including
      // for punctuation keys that would otherwise start a dead-key
      // composition and swallow the keystrokes that follow.
      if (isScanningRef.current) event.preventDefault();
      bufferRef.current += char;
      scheduleIdleFinalize();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [onScan, enabled]);
}
