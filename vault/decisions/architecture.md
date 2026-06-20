---
status: stable
type: decision
layer: H3
created: 2026-06-20
---

# Arquitectura — Docker AR Tutor

## Estructura del monorepo

```
docker_ar_experience_v2/
├── app/
│   ├── frontend/              ← Next.js 16 (UI web + AR client)
│   ├── backend/               ← Fastify HTTP server (routes, plugins, lifecycle)
│   └── services/
│       ├── rag/               ← retrieval: hybrid search, confidence, cache, ingest
│       ├── llm/               ← LLM: prompt, composition, orchestrate, openai client
│       └── ar/                ← deferred (no hay AR server-side en MVP)
├── packages/
│   └── shared/                ← Zod schemas + tipos TS (SceneItem, ResponseEnvelope)
├── infra/
│   ├── docker-compose.yml
│   └── postgres/
│       └── init.sql           ← extensión pgvector, tablas documents/chunks/cache
├── vault/                     ← vault semántico (fuente de verdad H1-H3)
├── tasks/                     ← specs de delegación a Codex
│   ├── active/
│   ├── completed/
│   └── evaluated/
└── scripts/                   ← engine vault-sync
```

**Notas de estructura:**
- `packages/shared/` contiene los tipos compartidos — Zod schemas y tipos TS compartidos entre frontend y backend
- El frontend importa desde shared via TypeScript path alias: `@shared/*` → `../../packages/shared/src/*`
- El backend importa desde rag y llm via alias: `@rag/*` → `../services/rag/*`, `@llm/*` → `../services/llm/*`
- El backend importa desde shared via alias: `@shared/*` → `../../packages/shared/src/*`
- `app/services/ar/` es un placeholder para funcionalidad server-side AR futura (post-MVP)

## Separación de responsabilidades

### Frontend: capas de layout

```
HeaderShell          ← barra superior, logo, nav mínima
MobileDrawer         ← drawer lateral en mobile (Radix Sheet)
PageShell            ← layout público (home, info)
ExperienceShell      ← layout de la experiencia de pregunta/respuesta
ARShell              ← layout que inicializa AR y monta la escena
```

Regla: los shells **no tienen lógica de dominio**. Solo estructuran. La lógica vive en hooks o en el servicio AR.

### Frontend: capas de componentes

```
components/ui/           ← shadcn/ui primitivos (Button, Card, Badge, Table, etc.)
components/layout/       ← HeaderShell, MobileDrawer, PageShell, ExperienceShell, ARShell
components/learning/     ← componentes pedagógicos (ConceptCard, MiniQuiz, CommandRunner, etc.)
components/ar/           ← lógica AR (ARExperience, SpatialBoard, SpatialPanel, FocusController, etc.)
```

**Los componentes en `components/learning/` no saben que existen en AR.** Son componentes React normales que se ven bien en DOM. El sistema AR los envuelve en CSS3DObject para proyectarlos.

**Los componentes en `components/ar/` no tienen lógica pedagógica.** Solo manejan posición, escala, rotación, focus, y el ciclo de render Three.js/CSS3D.

### Frontend: separación WebGL vs CSS3D

**Capa WebGL (Three.js)**:
- Escena base, cámara, matrices
- MindAR anchor
- Objetos decorativos: whale, partículas, líneas, marcos
- NO renderiza UI real

**Capa CSS3D (CSS3DRenderer)**:
- Paneles DOM reales como CSS3DObject
- Componentes React proyectados en espacio 3D
- SÍ mantiene estado React, eventos, Tailwind

Ambas capas **comparten la misma cámara Three.js** y el mismo loop `requestAnimationFrame`. El CSS3DRenderer usa la misma `camera` y `domElement` container que el WebGL renderer, superpuestos via CSS (`position: absolute`, mismo z-index stack).

### Backend: responsabilidades (app/backend)

El backend es el proceso Fastify que expone la API HTTP. Las rutas son delgadas — solo validan el request (Zod) y delegan a los servicios.

```
app/backend/src/
  routes/          ← endpoints HTTP (H4 — contratos)
    ask.ts         ← POST /ask
    ingest.ts      ← POST /ingest (protegido)
    health.ts      ← GET /health
  plugins/         ← plugins Fastify con lifecycle limpio (H4)
    db.ts          ← pool PostgreSQL (fastify.decorate, onClose cleanup)
    openai.ts      ← cliente OpenAI (fastify.decorate)
    cors.ts        ← CORS config
    env.ts         ← validación env con Zod al startup
  index.ts         ← bootstrap: register plugins → register routes → listen
```

### Servicios: responsabilidades (app/services)

Los servicios son módulos de lógica pura — sin dependencia directa de Fastify. Se importan desde el backend.

**`app/services/rag/`**
```
hybrid.ts       ← búsqueda RRF (BM25 + vector via pgvector)
confidence.ts   ← scoring: grounded / weak / out_of_scope
cache.ts        ← cache de respuestas en PostgreSQL
chunk.ts        ← split por headings + max-token guard
parse.ts        ← walk markdown files + filtros
embed.ts        ← embeddings via OpenAI API
ingest.ts       ← pipeline: parse → chunk → embed → store
config.ts       ← KB_CONFIG
types.ts        ← Chunk, RetrievedChunk, ConfidenceLevel, KBConfig
```

**`app/services/llm/`**
```
orchestrate.ts  ← orquestación principal: prompt → OpenAI → parse → validate
prompt.ts       ← system prompt + buildUserPrompt(chunks)
composition.ts  ← normalizeComposition: dedup, order, cap 5
openai.ts       ← OpenAIProvider con retry (rate limit 429)
```

**`packages/shared/src/`**
```
components.ts   ← SceneItemSchema (discriminated union, catálogo activo)
envelope.ts     ← ResponseEnvelopeSchema
index.ts        ← re-exports
```

Endpoints MVP:
- `GET /health`
- `POST /ask` → `{ question: string }` → `ResponseEnvelope`
- `POST /ingest` → protegido con header interno → dispara pipeline de ingestión

### Contrato LLM → UI (invariante crítico)

El LLM produce un `ResponseEnvelope` (schema Zod en `packages/shared/src`). Ver detalle completo en `domain/llm-response-contract.md`.

El LLM **nunca** decide posición, escala, rotación ni distribución espacial en AR.

## Catálogo de componentes pedagógicos (MVP activo)

Detalle completo con schemas Zod en `domain/component-catalog.md`.

| Tipo | Descripción |
|------|-------------|
| `ConceptCard` | Tarjeta con concepto, definición e icono |
| `ComparisonTable` | Tabla comparativa (imagen vs contenedor, etc.) |
| `CommandRunner` | Comando Docker con flags explicados y botón copiar |
| `GlossaryPop` | Términos clave con definición expandible |
| `MiniQuiz` | Pregunta de opción múltiple con feedback |
| `DiagramPanel` | Diagrama generado por LLM (Mermaid → SVG dinámico client-side) |

**Roadmap (no activo):** StepwiseStepper, CodeExplanation, ChecklistPanel, AnalogyMapper, DecisionTree, TimelineSequence, FlashcardDeck.

**Regla**: el LLM solo produce tipos que tengan schema + renderer React + test DOM + preview CSS3D.

## Board espacial: distribución radial por paneles planos

El board AR es un arco de paneles planos, NO una esfera continua.

```
           [Panel 2]

   [Panel 1]       [Panel 3]

[Panel 0]             [Panel 4]
```

Cada panel es un `CSS3DObject` con:
- `position`: calculada algorítmicamente en función del índice y radio del arco
- `rotation`: orientada hacia el centro (cámara del usuario)
- `scale`: uniforme por defecto, escalada por focus
- `opacity`: 1.0 activo, 0.4 inactivo
- `priority`: define order de prominencia si hay muchos paneles

El `RadialPanelLayout` calcula las posiciones. El `FocusController` maneja el estado activo/inactivo.

## Focus system

1. Usuario toca un panel.
2. El panel activo: scale 1.2, opacity 1.0, se acerca ligeramente (z offset).
3. Los demás paneles: opacity 0.4.
4. Tap fuera o botón back: vuelve al overview (todos panels en posición base).

Las animaciones de focus/unfocus son responsabilidad de GSAP, no de React state directamente.

## Convenciones de naming

- **Archivos TypeScript**: `kebab-case` en frontend (componentes: `PascalCase.tsx`)
- **Componentes React**: `PascalCase`
- **Hooks**: `use` prefix en camelCase (`useSpatialBoard`, `useFocusController`)
- **Endpoints REST**: `/health`, `/ask`, `/ingest` — plural solo si colección, snake_case prohibido en URLs
- **Variables env**: `SCREAMING_SNAKE_CASE` con prefijo por servicio (`RAG_`, `OPENAI_`, `DB_`)
- **Tablas DB**: plural snake_case (`documents`, `document_chunks`)

## Manejo de errores

- **RAG Service**: errores de OpenAI/pgvector → log + respuesta 500 con message genérico. Nunca exponer stack traces.
- **Frontend AR**: errores de MindAR → mostrar mensaje "Target no detectado" en la UI web (no en AR). Errores de fetch al RAG service → toast de error con posibilidad de reintentar.
- **Contrato LLM**: si el JSON de respuesta no valida el schema Zod → log del error + respuesta fallback con `ConceptCard` genérico. Nunca romper la experiencia AR por un schema inválido.

## Integración AR: constraints confirmados por investigación (2026-06-20)

Ver detalle completo en `domain/ar-system.md`. Resumen ejecutivo para referencias rápidas:

- **CSS3DRenderer** es el approach correcto. CanvasTexture está descartado.
- **`createPortal`** (no `createRoot`) para montar React en CSS3DObjects.
- **CSS3DObject.scale.setScalar()** es obligatorio — escala default es 1px = 1 unidad.
- **Oclusión imposible**: panels siempre sobre WebGL. Constraint de diseño aceptado.
- **No backdrop-filter en iOS** Safari. Diseño sin blur de fondo.
- **GSAP anima propiedades Three.js**, no CSS directo.
- **No usar WebXR AR**: MindAR funciona en iOS porque usa `getUserMedia`, no WebXR.
- **Three.js version**: pinear al peer dep de MindAR. Necesita stub `three-compat.js` para `sRGBEncoding`.
- **No R3F en la escena AR principal**: MindAR y R3F crean renderers propios — conflictan. R3F solo para escena fallback/preview.

## Decisiones pendientes

- [ ] **Cache de respuestas RAG**: ¿cache por hash de pregunta normalizada o sin cache en v1?
- [ ] **Hybrid retrieval**: ¿pgvector full-text search suficiente o agregar FTS separado?
- [ ] **WebSocket vs polling**: ¿streaming de respuesta RAG al frontend o esperar respuesta completa?
- [ ] **Graphify**: activar post-scaffolds para extraer call graph del RAG service y verificar separación de capas.
- [ ] **Splash screen / onboarding AR**: ¿guía visual de "apuntá la cámara al target" en v1?
- [ ] **Calibración de escala CSS3DObject**: determinar `SCALE_FACTOR` en dispositivo real (referencia v1: 37.7 px = 1 metro a scale 1).
- [ ] **Radio y ángulo del arco radial**: calibrar `radius` y `arcAngleDeg` en dispositivo físico.
