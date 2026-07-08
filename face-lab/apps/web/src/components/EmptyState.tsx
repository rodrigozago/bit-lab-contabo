import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="py-20 text-center">
      <p className="text-lg font-medium">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
