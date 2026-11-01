import { useState } from "react";
import type { ReactNode } from "react";

import { AppNav } from "../../molecules/AppNav";
import { TestModeBanner } from "../../molecules/TestModeBanner";
import { UpdateBanner } from "../../molecules/UpdateBanner";
import { useInstallUpdate, useUpdateCheckQuery } from "../../../hooks/useAppUpdate";
import { useSetTestMode, useTestModeQuery } from "../../../hooks/useSettings";
import { confirmUpdate, installLabel } from "../../../lib/update";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: testMode } = useTestModeQuery();
  const setTestMode = useSetTestMode();
  const { data: update } = useUpdateCheckQuery();
  const installUpdate = useInstallUpdate();
  // Dismissed until the next start.
  const [updateDismissed, setUpdateDismissed] = useState(false);

  async function handleInstallUpdate() {
    if (!update || !(await confirmUpdate(update.version))) return;
    installUpdate.mutate(update);
  }

  return (
    <div className="app-frame">
      {update && !updateDismissed && (
        <UpdateBanner
          version={update.version}
          installing={installUpdate.isPending}
          installLabel={installLabel(installUpdate.isPending, installUpdate.progress)}
          errorMessage={installUpdate.error?.message}
          onInstall={handleInstallUpdate}
          onDismiss={() => setUpdateDismissed(true)}
        />
      )}
      {testMode && <TestModeBanner switching={setTestMode.isPending} onExit={() => setTestMode.mutate(false)} />}
      <div className="app-shell">
        <AppNav />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
