import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../../lib/utils";

export interface ModalProps {
  open: boolean;
  title: string;
  /** Escape and the close button; a click outside doesn't close, so typed input isn't lost. */
  onClose: () => void;
  /** "lg" for forms laid out in two columns. */
  size?: "md" | "lg";
  children: ReactNode;
}

/** Window above the page, e.g. for creating and editing records. */
export function Modal({ open, title, onClose, size = "md", children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()} disablePointerDismissal>
      <Dialog.Portal>
        <Dialog.Backdrop className="modal-backdrop" />
        <Dialog.Popup className={cn("modal", `modal-${size}`)}>
          <div className="modal-header">
            <Dialog.Title className="modal-title">{title}</Dialog.Title>
            <Dialog.Close className="modal-close" aria-label="Schliessen">
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
