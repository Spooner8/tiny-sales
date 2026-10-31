import { FlaskConical } from "lucide-react";

import { Button } from "../../atoms/Button";

export interface TestModeBannerProps {
  switching?: boolean;
  onExit: () => void;
}

export function TestModeBanner({ switching, onExit }: TestModeBannerProps) {
  return (
    <div className="test-mode-banner no-print" role="status">
      <span className="test-mode-banner-text">
        <FlaskConical size={16} />
        Test-Modus – es wird die Test-Datenbank verwendet, produktive Daten bleiben unberührt.
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="border border-warning-foreground/40 text-warning-foreground hover:bg-warning-foreground/10 hover:text-warning-foreground"
        disabled={switching}
        onClick={onExit}
      >
        Zum Produktivsystem wechseln
      </Button>
    </div>
  );
}
