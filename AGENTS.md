# Docker AR Tutor — Guía para agentes de IA

> Esta guía es **canónica** y la lee cualquier CLI de IA que abra el repo
> (Claude Code, Codex CLI, Cursor, etc.). `CLAUDE.md` la importa con `@AGENTS.md`.
>
> Stack activo: **`generic`** (extractor configurado en `vault_sync.config.json`).

---

## ⚠️ Pre-flight obligatorio (antes de tocar código)

El proyecto tiene un **vault Obsidian** como fuente de verdad semántica.
El código (H4–H5) refleja al vault (H1–H3), nunca al revés.
**Saltar este protocolo produce código que contradice contratos documentados.**

Toda sesión nueva, antes de la primera respuesta no-trivial, debe:

1. **Leer este archivo completo** — ya estás acá, sigamos.
2. **Leer el `INDEX.md` del vault** (`vault/INDEX.md` — está dentro del repo).
3. **Identificar la tarea** y consultar la tabla de abajo para saber qué notas leer.
4. **Leer SOLO esas notas** — no leer el vault completo, no inventar.
5. **Recién entonces** explorar código del repo.

Si la tarea es trivial y no toca dominio (fix de import, copy change, README), los pasos 3–5 son opcionales.

---

## Qué notas leer según la tarea

| Tarea | Notas obligatorias |
|-------|---------------------|
| Nuevo componente AR (SpatialPanel, FocusController, etc.) | `decisions/architecture.md` + `domain/ar-system.md` |
| Nuevo componente pedagógico (ConceptCard, MiniQuiz, etc.) | `domain/component-catalog.md` + `decisions/architecture.md` |
| Cambio en el contrato LLM → UI (schema de respuesta) | `domain/llm-response-contract.md` + `domain/component-catalog.md` |
| Feature en el servicio RAG (chunking, retrieval, embeddings) | `domain/rag-pipeline.md` + `decisions/stack.md` |
| Nuevo endpoint en el servicio RAG | `domain/rag-pipeline.md` + `decisions/api-contracts.md` (si existe) |
| Cambio en el layout web (HeaderShell, shells, breakpoints) | `decisions/architecture.md` + `intent/vision.md` |
| Cambio de dependencia estructural (Three.js, MindAR, shadcn) | `decisions/stack.md` + impacto en H4 completo |
| Feature cross-capa (AR + RAG + UI juntos) | `domain/ar-system.md` + `domain/rag-pipeline.md` + `domain/llm-response-contract.md` |
| Delegación a Codex | Ver sección "Protocolo de delegación Claude → Codex" abajo |

Si una nota referenciada no existe → **preguntar al humano**, no inventar.

---

## Regla de oro: contradicción → reportar, no resolver

Si el código actual contradice una nota del vault con `status: stable` o `locked`:

1. Parar.
2. Reportar al humano qué nota dice qué y qué código contradice.
3. Esperar decisión.

Resolver unilateralmente es **prohibido** (`SYSTEM.md`, regla 3).

---

## Estados de las notas

| Status | Edición |
|--------|---------|
| `draft` | Modificable libremente vía `/sync` |
| `stable` | Solo `code_path` y `append_section` vía `/sync` |
| `locked` | Inmutable — solo edición humana directa |
| `deprecated` | Histórico — nadie la actualiza |

Operaciones prohibidas siempre:

- Borrar archivos del vault.
- Sobrescribir cuerpo completo de una nota.
- Modificar notas `locked`.

---

## Flujo de trabajo cotidiano

```
1. Recibís tarea
2. Pre-flight → leer vault relevante
3. Decidís si implementás vos (Claude) o delegás a Codex
4. Implementás / generás task spec para Codex
5. Pedís al humano permiso para commit + proponés mensaje
6. git commit
   └─ post-commit hook genera .vault-sync/{change_report,facts}.json
7. /sync → propone cambios al vault
8. Humano aprueba → apply → vault alineado
```

---

## Protocolo de delegación Claude → Codex

Claude es el arquitecto. Codex es el colaborador que implementa tareas repetitivas, de volumen alto o que consumen tokens sin agregar razonamiento complejo. **Claude decide caso por caso** el mecanismo de comunicación según:

### Criterios para delegar a Codex

Delegar cuando la tarea es:
- **Repetitiva**: scaffolding de componentes, generación de tests unitarios para funciones ya diseñadas, creación de schemas Zod a partir de contratos definidos.
- **De volumen**: más de 3 archivos similares con el mismo patrón estructural.
- **Evaluable automáticamente**: TypeScript compila sin errores, ESLint no reporta issues, tests pasan, schema Zod valida los ejemplos de fixtures.

NO delegar cuando la tarea requiere:
- Razonamiento sobre arquitectura AR/3D (posicionamiento, distribución espacial, focus system).
- Decisiones sobre el contrato LLM → UI (qué componentes existen, qué props tienen).
- Resolución de contradicciones entre vault y código.
- Evaluación de si algo se ve bien en AR (esto no es automáticamente evaluable).

### Mecanismos de comunicación disponibles

**1. Task spec file (one-shot, sin feedback loop)**

Usar cuando la tarea es bien definida, sin ambigüedad, y la evaluación es automática.

Claude escribe `tasks/active/<id>-<nombre>.md` con:
```markdown
## Task: <nombre corto>
## Status: pending
## Evaluator: <tsc | eslint | test | diff-review | manual>

### Context
<extracto mínimo del vault relevante: 1-3 notas o fragmentos>

### Scope
<archivos a crear/modificar — paths exactos>

### Acceptance criteria
- [ ] <criterio verificable 1>
- [ ] <criterio verificable 2>

### Pattern reference
<fragmento de código existente que muestra el patrón a seguir>

### Do NOT
<lista de lo que Codex no debe hacer — importante para evitar drift>
```

Codex implementa. Claude revisa el diff contra los criterios.

**2. Bidireccional con checkpoint intermedio**

Usar cuando la tarea tiene partes evaluables en etapas (ej: primero types, luego implementación, luego tests).

Claude escribe el spec con fases marcadas:
```markdown
## Phase 1: <nombre> — evaluate before phase 2
## Phase 2: <nombre> — depends on phase 1 passing
```

Claude revisa y aprueba cada fase antes de que Codex continúe.

**3. Invocación directa via Bash** (cuando Codex CLI está en PATH)

Usar para tareas pequeñas y atómicas donde el contexto cabe en el prompt:
```bash
codex --model o4-mini "<prompt empaquetado con contexto mínimo>"
```

Claude captura el output, lo evalúa, y decide si integrar o iterar.

### Flujo de evaluación

Después de que Codex implementa, Claude evalúa en este orden:
1. **Compilación**: `tsc --noEmit` — bloqueante si falla.
2. **Linting**: ESLint sobre archivos nuevos/modificados — bloqueante si errores.
3. **Tests** (si aplica): `vitest run <scope>` — bloqueante si falla.
4. **Revisión semántica**: Claude lee el diff y verifica que respeta contratos del vault.
5. **Aprobación**: si pasa todo → proponer commit. Si no → iterar o corregir Claude mismo.

### Archivos de tareas

```
tasks/
  active/      ← specs pendientes o en progreso
  completed/   ← specs implementadas, pendientes de evaluación final
  evaluated/   ← specs cerradas (pass o fail documentado)
```

`tasks/completed/` y `tasks/evaluated/` están en `exclude_patterns` del engine — no contaminan los change reports.

---

## Reglas inviolables (resumen)

1. **Antes de tocar dominio**: leer las notas correspondientes del vault.
2. **Antes de cualquier commit / push**: pedir confirmación explícita al humano.
3. **Nunca** modificar notas con `status: locked`.
4. **Nunca** borrar notas (usar `deprecate` si hace falta).
5. **Nunca** commitear secrets (`.env`, credenciales, claves API).
6. **Solo proponer** cambios al vault; la aplicación la hace `apply` tras aprobación.
7. **Preferir scripts deterministas** (`scripts/vault_sync.py`) sobre razonamiento LLM cuando la operación es estructural.
8. **Claude decide el mecanismo de delegación** — Codex no recibe trabajo sin un spec escrito en `tasks/active/`.

---

## Skills disponibles

| Skill | Cuándo usar |
|-------|-------------|
| `/snapshot` | Solo en arranque de proyecto, refactor masivo, o sospecha de drift severo. Caro en tokens. |
| `/sync` | Después de cada commit aprobado. El flujo natural de mantenimiento del grafo. |
| `/ingest <ruta>` | Después de dropear un PDF / .txt en `vault/raw/`. |
| `/check` | Cuando dudes de la coherencia entre código y vault. Solo reporta, no resuelve. |
| `/delegate` | Claude empaqueta una tarea para Codex — genera el spec en `tasks/active/`. |

> Para Codex CLI / Cursor / Cline sin slash commands, ver [`prompts/SKILLS.md`](prompts/SKILLS.md).

Más detalle en `USAGE.md` (cara dev) y `vault/SYSTEM.md` (cara agente).

---

## Contexto rápido del proyecto

### Vault y código

- **Vault**: `vault/` (dentro del repo, en git)
- **Sistema vault-sync**: `vault/SYSTEM.md` (locked, leer una vez por sesión)
- **Engine**: `scripts/vault_sync.py` (stdlib only, 0 deps externas)
- **Estado en vivo**: `.vault-sync/facts.json` — no leer el código si la respuesta ya está acá.
- **Extractor activo**: `generic`. Activar `graphify` post-scaffolds cuando haya código real para analizar.

### Stack resumido

Frontend: Next.js + TypeScript + Tailwind + shadcn/ui + Radix UI + Zod
AR: MindAR + Three.js + CSS3DRenderer + GSAP
Backend/RAG: Node.js + Fastify + TypeScript + PostgreSQL + pgvector + OpenAI
Shared: paquete de tipos y schemas Zod compartido

Detalle completo en `vault/decisions/stack.md`.

### Commits

- Mensajes en inglés.
- Prefijos: `feat: fix: refactor: docs: style: chore: test:`.
- Cortos y honestos sobre el "qué/por qué", no sobre el "cómo".
- Nunca saltar el hook (`--no-verify`).

---

## Por qué este protocolo existe

Sin pre-flight y sin vault, una IA típicamente:
1. Inventa props de componentes que no existen en el catálogo cerrado.
2. Genera coordenadas 3D hardcodeadas en lugar de respetar el sistema de layout matemático.
3. Mezcla lógica AR con lógica UI, rompiendo la separación de capas.
4. Deja el vault desactualizado → próxima sesión de IA parte sin contexto real.

> El código (H4–H5) refleja al vault (H1–H3), nunca al revés.
> Contradicción se reporta, no se resuelve unilateralmente.
> Codex implementa lo que Claude diseña — nunca al revés.
