---
status: stable
type: domain
layer: H2
created: 2026-06-20
code_path: "packages/shared/src/envelope.ts"
---

# Contrato LLM → UI — Docker AR Tutor

## Invariante central

El LLM produce JSON estructurado con un catálogo cerrado de componentes.  
El **SISTEMA** decide layout, posición, escala y orden de renderizado en AR.

El LLM **NUNCA**:
- Genera HTML ni CSS
- Genera coordenadas 3D
- Inventa tipos de componente fuera del catálogo activo
- Decide cuántos paneles mostrar en AR ni su distribución radial

---

## ResponseEnvelope

Fuente de verdad en `app/servicios/shared/src/envelope.ts`.

```typescript
export const ResponseEnvelopeSchema = z.object({
  answer_summary: z.string(),
  level: z.enum(['beginner', 'intermediate']),
  grounding: z.enum(['grounded', 'weak', 'out_of_scope']),
  confidence: z.number().min(0).max(1),
  scene: z.array(SceneItemSchema).min(0).max(5),
  followups: z.array(FollowupSchema),
  sources: z.array(SourceSchema),
});

export type ResponseEnvelope = z.infer<typeof ResponseEnvelopeSchema>;
```

---

## Tipos auxiliares

```typescript
const FollowupSchema = z.object({
  type: z.enum(['deepen', 'quiz', 'video', 'ask']),
  label: z.string(),
  payload: z.string().optional(),
});

const SourceSchema = z.object({
  title: z.string(),
  source_file: z.string(),
  source_url: z.string(),
});
```

---

## Reglas de generación (base para el system prompt)

1. **Solo usar tipos del catálogo activo** en `component-catalog.md`. Sin inventar tipos.
2. `scene` tiene entre 1 y 5 items. En `out_of_scope` puede ser 0 o un ConceptCard de "fuera de alcance".
3. `MiniQuiz` siempre es el **último** item en `scene`. Nunca el único.
4. `DiagramPanel`: generar Mermaid válido. `flowchart` para procesos, `sequenceDiagram` para interacciones, `graph` para relaciones.
5. `answer_summary` es para UI texto (no AR). Conciso: 1-2 oraciones.
6. `grounding` es estimación del LLM (`grounded`/`weak`/`out_of_scope`). El sistema puede sobreescribirla con confidence scoring propio.
7. `confidence` es un float 0–1 que el sistema puede usar o ignorar según su propio scoring.
8. No repetir el mismo tipo de componente más de una vez en la misma `scene` salvo `ConceptCard` en escenas multi-concepto justificadas.

---

## Structured output (implementación)

Se usa `response_format: { type: "json_schema", strict: true }` de OpenAI.

El JSON Schema se genera desde el Zod schema:

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';
const jsonSchema = zodToJsonSchema(ResponseEnvelopeSchema, {
  name: 'ResponseEnvelope',
  strictUnions: true,
});
```

Este JSON Schema se pasa al campo `json_schema.schema` de la request a OpenAI.

---

## Pipeline de orquestación

```
POST /ask
  │
  ├─ Validar request (Zod)
  ├─ Consultar cache (query hash)
  │
  │  [cache miss]
  ├─ hybridSearch(question) → RetrievedChunk[]
  ├─ deriveConfidence(chunks) → 'grounded' | 'weak' | 'out_of_scope'
  ├─ buildPrompt(question, chunks, confidence)
  ├─ orchestrateAnswer(prompt) → streaming JSON → ResponseEnvelope
  ├─ validateEnvelope(Zod) → si falla → fallback ConceptCard
  ├─ normalizeComposition(envelope) → dedup, order, cap 5
  ├─ setCachedResponse(query, envelope)
  └─ return ResponseEnvelope
```

---

## Fallback

Si el schema Zod falla al validar la respuesta del LLM:
1. Log del error con el JSON raw
2. Respuesta fallback: `{ scene: [ConceptCard con answer_summary como definición], grounding: 'weak', ... }`
3. La experiencia AR nunca rompe por schema inválido

Si `grounding === 'out_of_scope'`:
- `scene` contiene un `ConceptCard` con mensaje de fuera de alcance
- `followups` sugiere reformular la pregunta

---

## Cache

- Key: `SHA256(normalize(query))`
- Storage: tabla `response_cache` en PostgreSQL
- `ON CONFLICT DO UPDATE` (idempotente)
- No hay cache semántico en MVP (mismo hash = misma respuesta)

---

## Evolución del contrato

Agregar un campo a `ResponseEnvelope` o un tipo a `SceneItemSchema` requiere:
1. Actualizar `app/servicios/shared/src/envelope.ts` o `components.ts`
2. Regenerar el JSON Schema para OpenAI
3. Actualizar el system prompt
4. Actualizar el componente React correspondiente
5. Actualizar esta nota (via `/sync` o edición directa si es cambio de contrato)

Esto es deliberadamente costoso para evitar drift del contrato.
