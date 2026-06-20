---
status: stable
type: domain
layer: H2
created: 2026-06-20
code_path: "packages/shared/src/components.ts"
---

# Catálogo de componentes pedagógicos — Docker AR Tutor

## Regla de incorporación (invariante)

Un tipo de componente **solo puede aparecer en el schema activo y en el system prompt del LLM** si y solo si tiene:

1. Schema Zod en `app/servicios/shared/src/components.ts`
2. Componente React en `app/frontend/components/learning/`
3. Prueba funcional en DOM mode (web sin AR)
4. Preview validado en CSS3D sandbox (AR sin MindAR real)

Estar en el roadmap no activa un componente. Solo la implementación completa lo activa.

---

## Componentes activos (MVP)

### `ConceptCard`

**Cuándo**: definir un concepto Docker central (imagen, contenedor, volumen, red, compose service).

```typescript
z.object({
  type: z.literal('ConceptCard'),
  props: z.object({
    title: z.string(),
    definition: z.string(),
    icon: z.string().optional(),           // emoji o nombre de icono Lucide
    level: z.enum(['beginner', 'intermediate']),
    tags: z.array(z.string()).max(3).optional(),
  }),
})
```

---

### `ComparisonTable`

**Cuándo**: comparar dos o más conceptos en tabla (imagen vs contenedor, bind mount vs volume, CMD vs ENTRYPOINT).

```typescript
z.object({
  type: z.literal('ComparisonTable'),
  props: z.object({
    caption: z.string().optional(),
    headers: z.array(z.string()).min(2).max(6),
    rows: z.array(z.array(z.string())),    // matriz: filas × columnas (misma longitud que headers)
    highlightColumn: z.number().int().optional(), // índice de columna a destacar
  }),
})
```

---

### `CommandRunner`

**Cuándo**: explicar un comando Docker con sus flags. No ejecuta nada — es explicativo.

Visual: terminal oscura, comando en verde o amber, flags expandibles, botón copiar.

```typescript
z.object({
  type: z.literal('CommandRunner'),
  props: z.object({
    command: z.string(),                   // "docker run -d -p 8080:80 --name web nginx"
    description: z.string(),
    flags: z.array(z.object({
      flag: z.string(),                    // "-d", "--name", "-p"
      description: z.string(),
    })).optional(),
    expectedOutput: z.string().optional(), // texto de output esperado en terminal
  }),
})
```

---

### `GlossaryPop`

**Cuándo**: pregunta que involucra múltiples términos técnicos, o cuando la respuesta es un mini-glosario temático.

```typescript
z.object({
  type: z.literal('GlossaryPop'),
  props: z.object({
    terms: z.array(z.object({
      term: z.string(),
      definition: z.string(),
      example: z.string().optional(),      // ejemplo de uso en contexto Docker
    })).min(1).max(6),
  }),
})
```

---

### `MiniQuiz`

**Cuándo**: reforzar comprensión con una pregunta de opción múltiple.

**Regla**: siempre al final de `scene`, nunca como único componente.

```typescript
z.object({
  type: z.literal('MiniQuiz'),
  props: z.object({
    question: z.string(),
    options: z.array(z.string()).min(2).max(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string(),               // visible solo tras responder
  }),
})
```

---

### `DiagramPanel`

**Cuándo**: el usuario pregunta por flujos ("¿cómo funciona docker build?"), arquitecturas, relaciones entre componentes, redes o cualquier pregunta visual que se beneficie de un diagrama dinámico.

El LLM **genera la sintaxis Mermaid** adaptada a la pregunta específica. El componente React renderiza el SVG client-side con `mermaid.js`.

```typescript
z.object({
  type: z.literal('DiagramPanel'),
  props: z.object({
    mermaidCode: z.string(),               // LLM genera sintaxis Mermaid válida
    caption: z.string().optional(),
    diagramType: z.enum(['flowchart', 'sequence', 'graph']).optional(),
  }),
})
```

**Ejemplos de tipos Mermaid según pregunta**:
- `flowchart LR` → procesos lineales (docker build, docker run)
- `sequenceDiagram` → interacciones cliente-daemon-registry
- `graph TD` → relaciones jerárquicas (compose services, networks)

---

## Discriminated union (contrato exportado desde shared)

```typescript
// app/servicios/shared/src/components.ts
export const SceneItemSchema = z.discriminatedUnion('type', [
  ConceptCardSchema,
  ComparisonTableSchema,
  CommandRunnerSchema,
  GlossaryPopSchema,
  MiniQuizSchema,
  DiagramPanelSchema,
]);

export type SceneItem = z.infer<typeof SceneItemSchema>;
```

---

## Roadmap (NO activo)

Activar solo cuando el componente complete el ciclo completo: schema → renderer → DOM test → CSS3D preview.

| Componente | Descripción | Prioridad |
|---|---|---|
| `StepwiseStepper` | Proceso paso a paso numerado | Alta |
| `CodeExplanation` | Snippet con anotaciones inline | Alta |
| `ChecklistPanel` | Lista de verificación interactiva | Media |
| `AnalogyMapper` | Analogía visual (Docker X es como Y del mundo real) | Media |
| `DecisionTree` | Árbol de decisiones (¿cuándo usar X vs Y?) | Baja |
| `TimelineSequence` | Cronología de eventos | Baja |
| `FlashcardDeck` | Tarjetas frente/reverso | Baja |

---

## Nota: DiagramPanel v2 (idea diferida)

Existe la intención de abstraer la lógica de Canvas de **Fluyo** (editor de diagramas vanilla JS) en un microservicio interno. El LLM generaría un spec semántico de nodos+aristas (sin posiciones), un servicio haría auto-layout (dagre) + render con el estilo visual de Fluyo (nodos animados, íconos cloud). Por ahora Mermaid cubre el 90% del valor con 0% de esa complejidad. Retomar cuando `DiagramPanel` MVP esté estable.

## Estado de implementación (2026-06-20)
Schemas Zod implementados en `packages/shared/src/components.ts`. `SceneItemSchema` discriminated union activo con los 6 componentes MVP.

| Componente | Schema | React component | Test DOM |
|---|---|---|---|
| ConceptCard | ✅ | ⏳ | ⏳ |
| ComparisonTable | ✅ | ⏳ | ⏳ |
| CommandRunner | ✅ | ⏳ | ⏳ |
| GlossaryPop | ✅ | ⏳ | ⏳ |
| MiniQuiz | ✅ | ⏳ | ⏳ |
| DiagramPanel | ✅ | ⏳ | ⏳ |

**Pendiente:** stubs React en `app/frontend/components/learning/` (candidatos a delegación Codex con spec en `tasks/active/`).
