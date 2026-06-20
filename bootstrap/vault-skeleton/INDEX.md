---
type: index
status: locked
---

# INDEX — __PROJECT_NAME__

**Vault**: `__VAULT_ABSOLUTE_PATH__`

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

_(agregar al crear notas H2 — una por entidad o concepto cohesivo)_

---

## Decisions — H3 El Cómo

> Decisiones arquitectónicas que propagan hacia H4–H5.

- [[stack]] — tecnologías elegidas por capa _(obligatoria antes del primer feature técnico)_
- [[architecture]] — patrón arquitectónico, convenciones, manejo de errores

_(agregar más al tomar decisiones — auth, design-system, rbac, deploy, etc.)_

---

## Raw — Fuentes

_(documentos crudos en `raw/` — PDFs, transcripts, imágenes — ingeridos con `/ingest`)_

---

## Tarea → notas obligatorias

> **Completar esta tabla al instanciar el proyecto.** Es la mitad del valor
> del sistema. Sin ella, los agentes no saben qué leer antes de tocar código
> en cada área del repo.

| Tarea | Notas obligatorias |
|-------|---------------------|
| _(completar según el dominio del proyecto)_ | |
| Ejemplo: nueva entidad de dominio | `domain/<entidad>.md` + `decisions/architecture.md` |
| Ejemplo: nueva ruta / endpoint | `domain/<entidad>.md` + `decisions/api-contracts.md` (si existe) |
| Ejemplo: cambio de modelo / schema | `domain/<entidad>.md` + `domain/data-model.md` (si existe) |

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
