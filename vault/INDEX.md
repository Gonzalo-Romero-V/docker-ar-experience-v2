---
type: index
status: locked
---

# INDEX — Docker AR Tutor

**Vault**: `C:/Users/Gonzalo/Dev/MATERIAS/03_EVA/docker_ar_experience_v2/vault`

---

## Sistema

- [[SYSTEM]] — cómo funciona el vault y la sincronización (leer antes de modificar)

---

## Intent — H1 El Porqué

> Visión, invariantes de negocio, reglas que no negocian con la implementación.

- [[vision]] — qué es, para quién, problema que resuelve _(empezar aquí — obligatorio antes del primer feature)_

---

## Domain — H2 El Qué

> Entidades de dominio, sus estados, sus reglas, sus relaciones.

- [[ar-system]] — sistema AR: capas WebGL/CSS3D, board espacial, focus system _(crear)_
- [[rag-pipeline]] — pipeline RAG: ingestión, chunking, retrieval, orquestación LLM _(crear)_
- [[llm-response-contract]] — contrato JSON LLM → componentes UI: catálogo, schema Zod _(crear)_
- [[component-catalog]] — catálogo de componentes pedagógicos: props, variantes, ejemplos _(crear)_

---

## Decisions — H3 El Cómo

> Decisiones arquitectónicas que propagan hacia H4–H5.

- [[stack]] — tecnologías elegidas por capa (frontend, AR, RAG service, shared)
- [[architecture]] — monorepo, capas, separación WebGL/CSS3D, board radial, convenciones
- [[api-contracts]] — contratos de endpoints RAG service _(crear cuando se defina el primer endpoint)_

---

## Raw — Fuentes

_(documentación Docker, papers AR/CSS3D, transcripts — ingeribles con `/ingest`)_

---

## Tarea → notas obligatorias

| Tarea | Notas obligatorias |
|-------|---------------------|
| Nuevo componente AR (SpatialPanel, FocusController, etc.) | `decisions/architecture.md` + `domain/ar-system.md` |
| Nuevo componente pedagógico (ConceptCard, MiniQuiz, etc.) | `domain/component-catalog.md` + `decisions/architecture.md` |
| Cambio en el contrato LLM → UI | `domain/llm-response-contract.md` + `domain/component-catalog.md` |
| Feature en el servicio RAG | `domain/rag-pipeline.md` + `decisions/stack.md` |
| Nuevo endpoint RAG | `domain/rag-pipeline.md` + `decisions/api-contracts.md` |
| Cambio en layout web (shells, breakpoints) | `decisions/architecture.md` + `intent/vision.md` |
| Cambio de dependencia estructural (Three.js, MindAR, shadcn) | `decisions/stack.md` + H4 completo afectado |
| Feature cross-capa (AR + RAG + UI juntos) | `domain/ar-system.md` + `domain/rag-pipeline.md` + `domain/llm-response-contract.md` |
| Delegación a Codex | `AGENTS.md` sección "Protocolo de delegación" + nota relevante al área |

---

## Protocolo para agentes

1. Leer este índice antes de cualquier tarea no-trivial.
2. Leer las notas relevantes al área de trabajo (no leer todo el vault).
3. Tras implementar: actualizar `code_path` en la nota correspondiente vía `/sync`.
4. **Nunca modificar** notas con `status: locked`.
5. Si una implementación contradice una nota de dominio → reportar, no resolver.
6. Los snapshots y READMEs son fuentes secundarias — la fuente de verdad
   semántica es este vault.

**Sistema de sincronización**: ver [[SYSTEM]].
