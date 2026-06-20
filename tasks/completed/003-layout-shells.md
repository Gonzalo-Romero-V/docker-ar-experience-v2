## Task: Layout Shells — HeaderShell + ExperienceShell
## Status: pending
## Evaluator: tsc

### Context

Frontend: Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui. Dark theme by default.
Path alias: `@/*` maps to `./` (relative to `app/frontend/`).
Existing shadcn primitives available: `@/components/ui/button`, `@/components/ui/badge`, `@/components/ui/separator`.

Architecture rule (from vault): shells have NO domain logic. They only structure layout. Logic lives in hooks or services.

### Scope

Create exactly these two files (nothing else):

1. `app/frontend/components/layout/HeaderShell.tsx`
2. `app/frontend/components/layout/ExperienceShell.tsx`

Also create `app/frontend/components/layout/index.ts` re-exporting both.

### Acceptance criteria

- [ ] TypeScript compiles without errors (`tsc --noEmit` in `app/frontend/`)
- [ ] No domain logic (no fetch, no AR, no state beyond UI toggles)
- [ ] HeaderShell renders: logo text "Docker AR Tutor" + optional nav slot via children or props
- [ ] ExperienceShell renders: full-viewport layout (h-dvh, no padding, overflow-hidden) that wraps children
- [ ] Both are mobile-first (no horizontal overflow, works on 375px wide)
- [ ] No hardcoded colors — use Tailwind semantic tokens (bg-background, text-foreground, etc.)

### Pattern reference

Follow the style of existing components in `app/frontend/components/learning/ConceptCard.tsx`:

```tsx
'use client';
// minimal imports from @/components/ui/...

interface HeaderShellProps {
  children?: React.ReactNode;
}

function HeaderShell({ children }: HeaderShellProps) {
  return (
    <header className="...">
      {/* logo */}
      {children}
    </header>
  );
}

export { HeaderShell };
export type { HeaderShellProps };
```

### HeaderShell spec

- `'use client'` directive (may need click handlers later)
- `<header>` with `sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur`
- Logo: container/whale emoji + "Docker AR Tutor" text in `font-mono font-semibold`
- `children` slot for optional right-side nav items
- Height: `h-14` (56px)
- Max width container: `max-w-5xl mx-auto px-4 flex items-center justify-between`

### ExperienceShell spec

- Server component (no `'use client'`)
- `<div className="relative h-dvh w-full overflow-hidden bg-black">`
- `children` fills the entire space
- No inner padding, no max-width — used for the full-screen AR view

### Do NOT

- Do NOT add React state beyond what's strictly needed for basic layout
- Do NOT add navigation links (logo is NOT a link — just text)
- Do NOT add dark mode toggle (handled by layout.tsx + ThemeProvider)
- Do NOT create any other files
- Do NOT use inline styles
- Do NOT import Three.js, MindAR, or any AR library
- Do NOT create a MobileDrawer — that's a future task
