# Contexto sesión — Scaffold Backend + Servicios
> Leer al inicio. Eliminar después de leer.
> Pre-flight obligatorio: leer `vault/domain/rag-pipeline.md` antes de tocar código.

---

## Estado del repo al cerrar sesión frontend

**Branch**: `main` — 5 commits desde init  
**Frontend**: CERRADO Y LIMPIO (`app/frontend/`) — tsc ✓, build ✓, dev ✓  
**Vault**: notas H1–H3 completas — stack, architecture, ar-system, component-catalog, llm-response-contract, **rag-pipeline** (creada al cierre de esta sesión)

---

## Tarea: scaffold backend + servicios

### Orden de trabajo

1. `app/servicios/shared/src/` — primero, es la dependencia de todo
2. `app/backend/` — Fastify server con plugins y routes
3. `app/servicios/rag/` — portar y refactorizar de v1
4. `app/servicios/llm/` — orquestador + OpenAI con retry

### Por qué este orden
`shared` define los tipos que backend y servicios importan.
Backend necesita saber qué devuelve llm antes de escribir la route `/ask`.
RAG y LLM son independientes entre sí pero ambos dependen de shared.

---

## Referencia rápida — vault relevante

| Tarea | Nota a leer |
|---|---|
| Cualquier cosa RAG | `vault/domain/rag-pipeline.md` ← **LA MÁS IMPORTANTE** |
| Estructura de carpetas | `vault/decisions/architecture.md` |
| Schemas Zod shared | `vault/domain/component-catalog.md` + `vault/domain/llm-response-contract.md` |
| Stack y deps | `vault/decisions/stack.md` |

---

## Lo que YA se analizó de v1 (no re-analizar)

La nota `vault/domain/rag-pipeline.md` tiene todo el análisis completo de v1:
- Qué archivos portar y de dónde
- Qué mejorar en cada uno
- El pipeline completo paso a paso
- Los problemas concretos y sus fixes

**No leer el código de v1 de nuevo** — el análisis ya está en el vault.  
v1 está en `C:\Users\Gonzalo\Dev\MATERIAS\03_EVA\docker_ar_experience\`

---

## Comandos de scaffold — backend

```bash
# Desde la raíz del repo
cd app/backend
npm init -y
npm install fastify @fastify/cors @fastify/env fastify-plugin openai pg zod
npm install --save-dev typescript tsx @types/node @types/pg vitest
npx tsc --init
```

`tsconfig.json` del backend necesita:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "paths": {
      "@shared/*": ["../servicios/shared/src/*"],
      "@rag/*": ["../servicios/rag/*"],
      "@llm/*": ["../servicios/llm/*"]
    }
  }
}
```

---

## Lo que Codex puede hacer (delegar después del scaffold)

Una vez que el scaffold base compile sin errores:
- Stubs de los 6 componentes pedagógicos en `app/frontend/components/learning/`
- Tests unitarios de `confidence.ts` y `composition.ts`
- Schema SQL inicial (`infra/postgres/init.sql`)

Criterio de delegación: tsc pasa → delegar. Si no compila → no delegar.

---

## Invariantes que no se tocan

- Estructura de carpetas: `app/{frontend,backend,servicios/{rag,llm,shared,ar}}`, `infra/`. NO `packages/`.
- El LLM nunca genera HTML libre — solo JSON validado por Zod.
- `POST /ingest` siempre protegido con al menos Bearer token.
- Modelo embeddings: `text-embedding-3-small`. Cambiar = re-indexar todo.
- Commits: pedir permiso antes. `/sync` después de cada commit.
