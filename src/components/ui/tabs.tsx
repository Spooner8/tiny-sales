import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ReactNode } from "react";

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  /** Name of the tab group for screen readers. */
  label: string;
  items: TabItem[];
}

export function Tabs({ label, items }: TabsProps) {
  return (
    <BaseTabs.Root defaultValue={items[0]?.value}>
      <BaseTabs.List className="tabs-list" aria-label={label}>
        {items.map((item) => (
          <BaseTabs.Tab key={item.value} value={item.value} className="tabs-tab">
            {item.label}
          </BaseTabs.Tab>
        ))}
      </BaseTabs.List>
      {items.map((item) => (
        // Kept mounted: switching tabs must not lose what was typed but not saved yet.
        <BaseTabs.Panel key={item.value} value={item.value} keepMounted className="tabs-panel">
          {item.content}
        </BaseTabs.Panel>
      ))}
    </BaseTabs.Root>
  );
}
