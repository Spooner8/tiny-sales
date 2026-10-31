import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  action?: ReactNode;
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {action}
    </div>
  );
}
