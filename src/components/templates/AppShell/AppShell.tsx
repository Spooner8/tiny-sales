import type { ReactNode } from "react";

import { AppNav } from "../../molecules/AppNav";
import { TestModeBanner } from "../../molecules/TestModeBanner";
import { useSetTestMode, useTestModeQuery } from "../../../hooks/useSettings";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: testMode } = useTestModeQuery();
  const setTestMode = useSetTestMode();

  return (
    <div className="app-frame">
      {testMode && <TestModeBanner switching={setTestMode.isPending} onExit={() => setTestMode.mutate(false)} />}
      <div className="app-shell">
        <AppNav />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
