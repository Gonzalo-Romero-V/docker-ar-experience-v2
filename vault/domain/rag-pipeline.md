---
status: stable
type: domain
layer: H2
created: 2026-06-20
code_path: app/servicios/rag/
---

# RAG Pipeline — Docker AR Tutor

## Decisión principal

**Refactorizar v1, no reimplementar desde cero.**

El RAG de `docker_ar_experience` (v1) tiene la arquitectura correcta y lógica valiosa.
Los problemas son puntuales y corregibles. Reimplementar desde cero sería tirar trabajo bueno.

---

## Qué se porta de v1 (con refactor)

| Módulo v1 | Destino v2 | Qué se porta | Qué se mejora |
|---|---|---|---|
| `knowledge/src/chunk.ts` | `app/servicios/rag/chunk.ts` | Chunking por headings H2/H3, SHA256 hash, `isUsefulChunk` | Agregar control max-token (tiktoken o estimación char/4) |
| `knowledge/src/parse.ts` | `app/servicios/rag/parse.ts` | `walkMarkdownFiles`, `stripFrontmatter`, filtros `includeGlobs`/`excludeGlobs` | Sin cambios estructurales |
| `backend/src/services/cache.ts` | `app/servicios/rag/cache.ts` | `getCachedResponse`/`setCachedResponse`, SHA256(normalizeQuery), PostgreSQL `ON CONFLICT DO UPDATE` | Sin cambios estructurales |
| `backend/src/llm/openai.ts` | `app/servicios/llm/openai.ts` | `OpenAIProvider` class, `LLMProvider` interface, `completeStructured()` con streaming, `response_format: json_schema strict: true` | Agregar retry con backoff exponencial (falta en v1) |
| `knowledge/src/hybrid.ts` (inferido) | `app/servicios/rag/hybrid.ts` | Búsqueda híbrida BM25 + vector via RRF | Verificar implementación al portar |
| `knowledge/src/config.ts` | `app/servicios/rag/config.ts` | `KB_CONFIG`: includeGlobs Docker docs, `minChunkChars: 160`, `embeddingDimensions: 1536` | Sin cambios estructurales |

### Archivo nuevo (no existe en v1)
- `app/servicios/rag/ingest.ts` — endpoint `POST /ingest` para indexar docs en caliente (protegido)

---

## Arquitectura del pipeline

### Búsqueda híbrida (hybrid.ts)

```
query
  ├── BM25 keyword search  ──┐
  └── pgvector ANN search  ──┤ Reciprocal Rank Fusion (RRF)
                              └── ranked chunks → top-K
```

- **RRF**: fusiona rankings de BM25 y vector sin necesitar normalizar scores
- **pgvector**: extensión PostgreSQL — zero servicios externos
- **Modelo embeddings**: `text-embedding-3-small`, 1536 dimensiones
- **CRÍTICO**: cambiar el modelo de embeddings requiere re-indexar toda la base vectorial

### Confidence scoring (confidence.ts)

```typescript
type ConfidenceLevel = "grounded" | "weak" | "out_of_scope"
```

| Nivel | Condición |
|---|---|
| `grounded` | Chunks recuperados con score alto, respuesta directamente apoyada |
| `weak` | Chunks parciales o score bajo, respuesta inferida |
| `out_of_scope` | No hay chunks relevantes, pregunta fuera del dominio Docker |

El nivel de confianza afecta el prompt del LLM y el campo `grounding` en el envelope.

### Query cache (cache.ts)

```
normalizeQuery(query) → SHA256 → lookup PostgreSQL
  hit  → return cached ResponseEnvelope
  miss → pipeline completo → setCachedResponse → return
```

- Cache en misma DB PostgreSQL (sin Redis)
- `ON CONFLICT DO UPDATE` — actualiza TTL en cada hit (tabla: `query_cache`)
- `normalizeQuery`: lowercase + trim + colapsar espacios

### Pipeline de orquestación completo

```
POST /ask { query, context? }
  1. validate input (Zod)
  2. getCachedResponse(query)          → hit: return early
  3. hybridSearch(query, topK=10)      → chunks[]
  4. deriveConfidence(chunks)          → ConfidenceLevel
  5. buildPrompt(query, chunks, conf)  → string
  6. orchestrateAnswer(prompt)         → ResponseEnvelope (OpenAI structured output)
  7. validateEnvelope(Zod)             → throw if invalid
  8. normalizeComposition(envelope)    → dedup, orden, cap 5 scene items
  9. setCachedResponse(query, result)
  10. return envelope
```

### OpenAI structured output

```typescript
response_format: {
  type: "json_schema",
  json_schema: {
    name: "ResponseEnvelope",
    strict: true,
    schema: zodToJsonSchema(ResponseEnvelopeSchema, {
      name: "ResponseEnvelope",
      strictUnions: true
    })
  }
}
```

**Problema v1**: sin retry. Si OpenAI falla con 429 o 5xx, el request muere.  
**Fix v2**: retry con backoff exponencial en `openai.ts` (3 intentos, delay 1s/2s/4s).

---

## Chunking — reglas y límites

### Estrategia (chunk.ts)
- Split por headings H2 (`##`) y H3 (`###`)
- Hash SHA256 del contenido → deduplicación en re-indexación
- `isUsefulChunk(text)`: descarta chunks con menos de `minChunkChars: 160` caracteres

### Problema crítico v1: sin control de max-tokens
Un chunk con un heading H2 puede tener miles de tokens si la sección es larga.
Esto hace que el contexto del LLM se llene con pocos chunks.

**Fix v2**: después del split por heading, si un chunk supera ~800 tokens (≈3200 chars),
subdividirlo por párrafos. Implementar en `chunk.ts` v2.

### Config de ingestión (config.ts)
```typescript
const KB_CONFIG = {
  repo: "docker/docs",  // fuente: documentación oficial Docker
  includeGlobs: [
    "engine/**", "build/**", "compose/**",
    "storage/**", "network/**", "reference/**", "get-started/**"
  ],
  minChunkChars: 160,
  embeddingDimensions: 1536  // text-embedding-3-small
}
```

---

## Estructura de archivos v2

```
app/servicios/rag/
  hybrid.ts       búsqueda BM25 + vector + RRF
  confidence.ts   derivación del nivel de confianza
  cache.ts        query cache SHA256 → PostgreSQL
  chunk.ts        split por headings + max-token guard
  parse.ts        walk markdown files + filtros
  embed.ts        generación de embeddings (OpenAI)
  ingest.ts       lógica de indexación completa (parse → chunk → embed → store)
  config.ts       KB_CONFIG

app/servicios/llm/
  openai.ts       OpenAIProvider con retry backoff
  orchestrate.ts  pipeline completo (pasos 1-10 arriba)
  prompt.ts       construcción del prompt con chunks + nivel confianza
  composition.ts  normalización del envelope (dedup, orden, cap 5)

app/servicios/shared/src/
  components.ts   Zod schemas 6 componentes MVP (ver component-catalog.md)
  envelope.ts     ResponseEnvelopeSchema (ver llm-response-contract.md)
  index.ts        re-exports

app/backend/src/
  routes/
    ask.ts        POST /ask → llm/orchestrate
    ingest.ts     POST /ingest (protegido) → rag/ingest
    health.ts     GET /health
  plugins/
    db.ts         conexión PostgreSQL + pgvector
    openai.ts     instancia OpenAIProvider
    cors.ts       CORS config
    env.ts        validación variables de entorno (Zod)
  index.ts        Fastify server + register plugins + routes
```

---

## Problemas de v1 y fixes en v2

| Problema v1 | Fix v2 |
|---|---|
| Chunking sin límite de tokens — chunks gigantes saturan contexto | Max-token guard en `chunk.ts`: si chunk > 800 tokens, subdividir por párrafos |
| Sin retry en OpenAI — falla si 429/5xx | Retry con backoff exponencial (1s/2s/4s, 3 intentos) en `llm/openai.ts` |
| Fastify sin lifecycle de plugins — orden de init frágil | Plugins con `fastify-plugin` + registro explícito en orden en `index.ts` |
| Sin endpoint de ingestión — indexar requería script manual | `POST /ingest` protegido en `backend/src/routes/ingest.ts` |

---

## Restricciones

- **Nunca cambiar el modelo de embeddings** sin re-indexar toda la base vectorial.
- **`POST /ingest` siempre protegido** — al menos Bearer token en header. No exponerlo público.
- **Cache no invalida automáticamente** — si se re-indexa, limpiar la tabla `query_cache` manualmente o agregar TTL.
- **Fastify plugins: orden importa** — `env` → `db` → `openai` → routes. Si db falla, el server no debe arrancar silenciosamente.
