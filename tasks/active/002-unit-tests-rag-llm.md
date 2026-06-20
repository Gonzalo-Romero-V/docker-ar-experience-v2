## Task: Unit tests — confidence.ts + composition.ts
## Status: pending
## Evaluator: test (vitest run)

### Context

Dos módulos críticos que implementan lógica de transformación pura (sin I/O, sin DB):

**`app/services/rag/confidence.ts`**
```typescript
// Deriva el nivel de confianza del top chunk score.
export function deriveConfidence(chunks: RetrievedChunk[]): ConfidenceLevel
// GROUNDED_THRESHOLD = 0.7  → grounded
// WEAK_THRESHOLD = 0.4      → weak
// score < 0.4 OR empty      → out_of_scope
```

**`app/services/llm/composition.ts`**
```typescript
// Normaliza la escena del envelope:
// 1. dedupScene: ConceptCard puede repetirse; otros tipos se deduplan (primer ocurrencia wins)
// 2. slice(0, 5): cap a 5 items
// 3. promoteQuizToLast: MiniQuiz siempre al final si está presente
export function normalizeComposition(envelope: ResponseEnvelope): ResponseEnvelope
```

### Scope

Crear (no modificar nada existente):

```
app/services/rag/confidence.test.ts
app/services/llm/composition.test.ts
```

Correr los tests desde `app/backend/` con:
```bash
cd app/backend && npx vitest run ../services/rag/confidence.test.ts ../services/llm/composition.test.ts
```

### Acceptance criteria

- [ ] `vitest run` pasa todos los tests (0 failures)
- [ ] `confidence.test.ts`: mínimo 5 tests que cubren: array vacío, score exactamente 0.7, score entre 0.4 y 0.7, score exactamente 0.4, score < 0.4
- [ ] `composition.test.ts`: mínimo 6 tests que cubren: sin MiniQuiz (quiz queda donde está), MiniQuiz en medio se mueve al final, MiniQuiz al principio se mueve al final, dos ConceptCard se preservan (no se deduplan), dos ComparisonTable → solo queda una, más de 5 items → se corta a 5

### Pattern reference

Tipos necesarios (importar desde paths relativos para evitar resolver alias en tests):

```typescript
// confidence.test.ts — importar directamente
import { deriveConfidence } from './confidence.js';
import type { RetrievedChunk } from './types.js';

// Helper para construir mocks mínimos:
function makeChunk(score: number): RetrievedChunk {
  return {
    content: 'test',
    sourcePath: 'test.md',
    hash: 'abc',
    score,
    bm25Score: score,
    vectorScore: score,
  };
}
```

```typescript
// composition.test.ts — necesita resolver @shared/index.js via tsconfig del backend
// Importar desde paths relativos:
import { normalizeComposition } from './composition.js';

// Mock mínimo de ResponseEnvelope:
const baseEnvelope = {
  answer_summary: 'test',
  level: 'beginner' as const,
  grounding: 'grounded' as const,
  confidence: 0.9,
  followups: [],
  sources: [],
};

// Helpers para construir SceneItems:
const conceptCard = (title = 'T') => ({
  type: 'ConceptCard' as const,
  props: { title, definition: 'D', level: 'beginner' as const },
});
const quizItem = () => ({
  type: 'MiniQuiz' as const,
  props: { question: 'Q?', options: ['A', 'B'], correctIndex: 0, explanation: 'E' },
});
const tableItem = () => ({
  type: 'ComparisonTable' as const,
  props: { headers: ['A', 'B'], rows: [['1', '2']] },
});
```

Usar `describe` + `it` + `expect` de vitest:
```typescript
import { describe, it, expect } from 'vitest';
```

### Do NOT

- No crear mocks de la DB ni de OpenAI — estos módulos son pure functions.
- No modificar los archivos que se testean (`confidence.ts`, `composition.ts`).
- No usar `beforeEach`/`afterEach` si los tests son independientes (lo son — no hay estado compartido).
- No usar `@shared/index.js` en composition.test.ts si eso complica la resolución de módulos — construir los objetos de prueba directamente como plain objects tipados con `as const`.
- No agregar dependencias a `package.json` — vitest ya está en devDependencies del backend.
- Los tests deben correr en menos de 2 segundos (son pure functions, no I/O).
