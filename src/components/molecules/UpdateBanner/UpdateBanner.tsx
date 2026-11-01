import { Download } from "lucide-react";

import { Button } from "../../atoms/Button";

export interface UpdateBannerProps {
  version: string;
  installing?: boolean;
  installLabel: string;
  errorMessage?: string;
  onInstall: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ version, installing, installLabel, errorMessage, onInstall, onDismiss }: UpdateBannerProps) {
  return (
    <div className="update-banner no-print" role="status">
      <span className="update-banner-text">
        <Download size={16} />
        {errorMessage ? `Update fehlgeschlagen: ${errorMessage}` : `Version ${version} von Tiny Sales ist verfügbar.`}
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="border border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
        disabled={installing}
        onClick={onInstall}
      >
        {installLabel}
      </Button>
      {!installing && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          onClick={onDismiss}
        >
          Später
        </Button>
      )}
    </div>
  );
}
