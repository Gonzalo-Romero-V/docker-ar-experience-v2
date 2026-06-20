## Task: SpatialPanel + SpatialBoard
## Status: pending
## Evaluator: tsc

### Context

Next.js 16 + TypeScript + React 19. All AR logic is `'use client'` and dynamic-import only (never SSR).
Path alias `@/*` → `app/frontend/` root.

The AR system uses two synchronized layers:
- WebGL (Three.js / MindAR): tracking, camera, decoratives
- CSS3D (CSS3DRenderer): real DOM panels as CSS3DObjects, sharing the same camera

CSS3DObjects are regular DOM elements positioned in 3D via CSS matrix3d.
React components are mounted inside them via `createPortal` (NOT createRoot — createPortal keeps provider tree).

Key constraint: `css3dObj.scale.setScalar(SCALE_FACTOR)` is MANDATORY.
1 CSS unit = 1 Three.js unit by default, so an unscaled 400px div = 400 Three.js units = huge.
SCALE_FACTOR reference: 1/400 (calibrate empirically on device).

Already implemented (DO NOT recreate):
- `@/components/ar/utils/computeRadialPositions.ts` — exports `computeRadialPositions(count, radius, arcAngleDeg, yOffset, depth): THREE.Vector3[]` and `computePanelRotation(position): number`
- `@/components/ar/hooks/useFocusController.ts` — exports `useFocusController()` hook, `PanelRef` type

### Scope

Create exactly these two files:

1. `app/frontend/components/ar/SpatialPanel.tsx`
2. `app/frontend/components/ar/SpatialBoard.tsx`

### SpatialPanel.tsx spec

```typescript
'use client';
// A single CSS3DObject wrapper. Receives a THREE.Scene reference and panel content via children.
// Uses createPortal to render children into the DOM element that is attached to the CSS3DObject.
// Registers itself with useFocusController via onMount callback.

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type * as THREE from 'three';
import type { PanelRef } from '@/components/ar/hooks/useFocusController';

const PANEL_WIDTH = 400;  // px — size of the DOM element
const PANEL_HEIGHT = 300; // px
const SCALE_FACTOR = 1 / 400; // calibrate on device

interface SpatialPanelProps {
  scene: THREE.Scene;
  position: THREE.Vector3;
  rotationY: number; // radians — panel faces origin
  onMount?: (ref: PanelRef) => void;
  onUnmount?: () => void;
  children: React.ReactNode;
}

function SpatialPanel({ scene, position, rotationY, onMount, onUnmount, children }: SpatialPanelProps) {
  // 1. Create panelEl div (PANEL_WIDTH x PANEL_HEIGHT, pointer-events: auto)
  // 2. Create CSS3DObject(panelEl) — import CSS3DObject from 'three/addons/renderers/CSS3DRenderer.js'
  //    NOTE: import must be DYNAMIC inside useEffect (avoids SSR crash with document)
  // 3. Set position, rotation.y, scale.setScalar(SCALE_FACTOR)
  // 4. scene.add(css3dObj)
  // 5. Call onMount({ obj: css3dObj, el: panelEl, basePosition: position.clone() })
  // 6. Cleanup on unmount: scene.remove(css3dObj), panelEl.remove(), onUnmount?.()
  // 7. Return createPortal(children, panelEl) so React renders into the DOM element

  // IMPORTANT: panelEl is a detached DOM node managed manually — NOT in the React tree.
  // createPortal attaches React output to it while keeping provider context intact.
}
```

Implementation notes:
- panelEl style: `width: ${PANEL_WIDTH}px; height: ${PANEL_HEIGHT}px; pointer-events: auto; overflow: hidden;`
- Use `useRef<HTMLDivElement | null>(null)` to hold panelEl across renders (created once in useEffect)
- Use a state or ref to hold whether the portal target is ready (needed so createPortal doesn't fire before useEffect)
- The CSS3DObject import MUST be inside useEffect: `const { CSS3DObject } = await import('three/addons/renderers/CSS3DRenderer.js')`
- scene ref is stable — no need to list in dep array unless it can change

### SpatialBoard.tsx spec

```typescript
'use client';
// Manages N SpatialPanels, distributes them in a radial arc, wires up focus controller.
// Receives: scene, an array of ReactNode content (one per panel), arc config.

import { SpatialPanel } from './SpatialPanel';
import { useFocusController } from '@/components/ar/hooks/useFocusController';
import { computeRadialPositions, computePanelRotation } from '@/components/ar/utils/computeRadialPositions';
import type * as THREE from 'three';

interface SpatialBoardProps {
  scene: THREE.Scene;
  panels: React.ReactNode[]; // content for each panel
  radius?: number;           // default 0.8
  arcAngleDeg?: number;      // default 150
  yOffset?: number;          // default 0
  depth?: number;            // default 0
}

function SpatialBoard({ scene, panels, radius = 0.8, arcAngleDeg = 150, yOffset = 0, depth = 0 }: SpatialBoardProps) {
  // 1. Compute positions array with computeRadialPositions(panels.length, radius, arcAngleDeg, yOffset, depth)
  // 2. Compute rotationY per panel with computePanelRotation(position)
  // 3. Render one <SpatialPanel> per panel item, passing:
  //    - scene, position, rotationY
  //    - onMount: registerPanel(index, ref)
  //    - children: a wrapper div with onClick={() => focusPanel(index)} + the panel content
  // 4. Include a "back to overview" button (a fixed-position DOM button, NOT in AR space) that calls resetOverview()
  //    — visible only when focusState === 'focused'
}
```

Back button: `position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%)` — visible only when `focusState === 'focused'`.
Style: Tailwind `px-6 py-2 rounded-full bg-background/80 text-foreground text-sm font-medium border border-border`.

### Acceptance criteria

- [ ] TypeScript compiles without errors (`cd app/frontend && npx tsc --noEmit`)
- [ ] SpatialPanel creates a CSS3DObject with position, rotationY and SCALE_FACTOR
- [ ] SpatialPanel returns `createPortal(children, panelEl)` (not null, not a div wrapper)
- [ ] SpatialBoard wires all panels with useFocusController
- [ ] Back button only renders when focusState === 'focused'
- [ ] No import of Three.js or CSS3DRenderer at module level (all inside useEffect dynamic imports)
- [ ] No `createRoot` anywhere — only `createPortal`

### Do NOT

- Do NOT import Three.js at top level — dynamic import inside useEffect only
- Do NOT use `createRoot` — only `createPortal`
- Do NOT add GSAP animations here — those are in useFocusController
- Do NOT implement the AR loop or MindAR init — that is ARShell's job
- Do NOT add Tailwind styles to the CSS3DObject panel element — styling of panel content is the children's responsibility
- Do NOT create any other files
