## Task: Unit tests — computeBeltPositions + wrapDiff
## Status: pending
## Evaluator: vitest run (frontend)
## Branch: feat/3dof-exploration

### Context

`computeBeltPositions` y la lógica de `wrapDiff` en `useBeltCalibration` son las
únicas funciones con lógica no-trivial que no tienen cobertura de tests.

El resto de la implementación (ARShell, ExplorationSphere, hooks de sensor) requiere
dispositivo físico para verificar — no es testeable con vitest.

### Scope

**Crear:**
- `app/frontend/components/ar/utils/computeRadialPositions.test.ts`
- `app/frontend/components/ar/hooks/useBeltCalibration.test.ts`

**No tocar:**
- Ningún archivo fuera de `app/frontend/components/ar/`
- No modificar implementaciones — solo agregar tests

### Pattern reference

Tests existentes en el backend (`app/services/rag/confidence.test.ts`):
```typescript
import { describe, it, expect } from 'vitest';
import { deriveConfidence } from './confidence';

describe('deriveConfidence', () => {
  it('returns high for score above threshold', () => {
    expect(deriveConfidence([{ score: 0.8 }])).toBe('high');
  });
});
```

### Acceptance criteria

**computeRadialPositions.test.ts:**
- [ ] `computeBeltPositions(1, 1, 0)` → `[{x:0, y:0, z:1}]` (single panel at θ=0 → +Z)
- [ ] `computeBeltPositions(2, 1, 0, 180)` → dos paneles en hemisferio, simétricos
- [ ] `computeBeltPositions(0, 1)` → `[]`
- [ ] `computeBeltPositions(3, 0.8, Math.PI/2, 360)` — todos los vectores tienen módulo ≈ 0.8
- [ ] `computeBeltPanelRotationY({x:0, z:1})` ≈ π (panel en +Z apunta hacia adentro)
- [ ] `computeBeltPanelRotationY({x:1, z:0})` ≈ π * 1.5 (panel en +X apunta hacia adentro)

**useBeltCalibration.test.ts** (testear solo `wrapDiff` como función pura exportada,
o verificar comportamiento del hook con mocks de useState):
- [ ] `wrapDiff(0, 350 * Math.PI / 180)` ≈ pequeña diferencia positiva (no 350°)
- [ ] `wrapDiff(Math.PI, -Math.PI)` ≈ 0 (o 2π, ambas representan lo mismo)
- [ ] `wrapDiff(0.1, 0)` ≈ 0.1

### Notes

`wrapDiff` está definida como función local en `useBeltCalibration.ts`. Para testearla,
Codex puede:
- Exportarla desde el módulo (agregar `export` a la función)
- O testear el comportamiento del hook directamente con `renderHook` de @testing-library/react

Si exporta `wrapDiff`, agregar el export a `useBeltCalibration.ts` (no a `index.ts`).

### Do NOT

- No modificar `computeBeltPositions` ni `useBeltCalibration` lógica.
- No usar `@testing-library/react` si `wrapDiff` se exporta directamente — es más simple.
- No testear ARShell, ExplorationSphere, useDeviceOrientation (requieren browser/device).
- No usar `vi.mock` para Three.js — testear con la librería real.
