import type { ReactNode } from 'react';

interface ExperienceShellProps {
  children?: ReactNode;
}

function ExperienceShell({ children }: ExperienceShellProps) {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <div className="h-full w-full">{children}</div>
    </div>
  );
}

export { ExperienceShell };
export type { ExperienceShellProps };
