## Task: Learning component stubs (6 componentes)
## Status: pending
## Evaluator: tsc + eslint

### Context

Los 6 componentes pedagógicos definidos en `vault/domain/component-catalog.md`.
Los schemas Zod ya existen en `packages/shared/src/components.ts`.

Regla crítica: un componente solo está activo cuando tiene schema Zod + componente React + DOM test. Los stubs implementan la capa React (paso 2 del ciclo).

### Scope

Crear (no modificar ningún archivo existente):

```
app/frontend/components/learning/
  ConceptCard.tsx
  ComparisonTable.tsx
  CommandRunner.tsx
  GlossaryPop.tsx
  MiniQuiz.tsx
  DiagramPanel.tsx
  index.ts              ← re-export barrel
```

### Props interfaces

Definir estas interfaces **inline** en cada archivo (no importar desde shared — la conexión se hará en paso posterior).

```typescript
// ConceptCard.tsx
interface ConceptCardProps {
  title: string;
  definition: string;
  icon?: string;
  level: 'beginner' | 'intermediate';
  tags?: string[];
}

// ComparisonTable.tsx
interface ComparisonTableProps {
  caption?: string;
  headers: string[];
  rows: string[][];
  highlightColumn?: number;
}

// CommandRunner.tsx
interface CommandRunnerProps {
  command: string;
  description: string;
  flags?: Array<{ flag: string; description: string }>;
  expectedOutput?: string;
}

// GlossaryPop.tsx
interface GlossaryPopProps {
  terms: Array<{ term: string; definition: string; example?: string }>;
}

// MiniQuiz.tsx
interface MiniQuizProps {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

// DiagramPanel.tsx
interface DiagramPanelProps {
  mermaidCode: string;
  caption?: string;
  diagramType?: 'flowchart' | 'sequence' | 'graph';
}
```

### Acceptance criteria

- [ ] `tsc --noEmit` en `app/frontend/` pasa sin errores
- [ ] ESLint pasa sin errores en los 7 archivos creados
- [ ] Cada componente exporta una función React nombrada (no default export anónimo)
- [ ] `index.ts` re-exporta los 6 componentes con named exports
- [ ] `DiagramPanel` inicializa mermaid con `mermaid.initialize({ startOnLoad: false, theme: 'dark' })` y usa `mermaid.render()` dentro de `useEffect`
- [ ] `MiniQuiz` maneja estado local de respuesta seleccionada (`useState`)
- [ ] `CommandRunner` incluye botón "Copiar" que hace `navigator.clipboard.writeText(command)`
- [ ] Todos usan `cn()` de `@/lib/utils` para clases Tailwind condicionales

### Pattern reference

shadcn/ui imports disponibles en `app/frontend/components/ui/`:
```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
```

Icono de React disponible via `lucide-react`.

Ejemplo de componente con el patrón correcto:
```typescript
'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ConceptCardProps {
  title: string;
  definition: string;
  icon?: string;
  level: 'beginner' | 'intermediate';
  tags?: string[];
}

export function ConceptCard({ title, definition, icon, level, tags }: ConceptCardProps) {
  return (
    <Card className={cn('border border-border/40 bg-card/80 backdrop-blur-sm')}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          {icon && <span aria-hidden>{icon}</span>}
          {title}
        </CardTitle>
        <Badge variant="outline" className="w-fit text-xs capitalize">
          {level}
        </Badge>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>{definition}</p>
        {tags && tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Do NOT

- No usar `default export` anónimo — siempre exportar función nombrada.
- No inventar componentes shadcn que no estén en `components/ui/` — usar solo los que existen.
- No tocar ningún archivo fuera de `app/frontend/components/learning/`.
- No importar desde `packages/shared/` ni desde rutas relativas fuera de `app/frontend/`.
- No usar `<img>` directamente — si necesitás imágenes, usar `next/image`.
- No agregar `useEffect` innecesarios — solo `DiagramPanel` lo necesita para mermaid.
- `DiagramPanel`: mermaid ya está en `package.json` (`"mermaid": "^11.15.0"`). No instalar nada.
- No convertir `MiniQuiz` en un formulario con submit — manejar selección via `onClick` en botones.
