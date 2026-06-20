'use client';

import type { ReactNode } from 'react';

interface HeaderShellProps {
  children?: ReactNode;
}

function HeaderShell({ children }: HeaderShellProps) {
  return (
    <header className="sticky top-0 z-50 h-14 w-full border-b border-border bg-background/80 text-foreground backdrop-blur">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2 font-mono font-semibold">
          <span aria-hidden="true" className="shrink-0">
            🐳
          </span>
          <span className="truncate">Docker AR Tutor</span>
        </div>
        {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
      </div>
    </header>
  );
}

export { HeaderShell };
export type { HeaderShellProps };
