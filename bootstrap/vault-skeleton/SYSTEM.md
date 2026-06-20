---
type: system
status: locked
---

# Cómo funciona este vault — para agentes

Esta nota describe el sistema de sincronización al que pertenece este vault.
Cualquier agente operando aquí debe leerla antes de modificar notas.

**Status: `locked`** — esta nota no se modifica automáticamente. Solo edición
humana directa.

---

## Arquitectura

```
Repositorio de código (fuente de verdad técnica)
    ↓ git post-commit hook
scripts/vault_sync.py report
    ↓ genera dos artefactos deterministas
.vault-sync/change_report.json  (qué cambió: archivos, capa, diff resumido)
.vault-sync/facts.json          (qué hay: extracción semántica del repo,
                                 según el extractor activo del plugin system)
    ↓ /sync skill (Claude lee ambos, propone cambios)
.vault-sync/proposed-changes.json (operaciones discretas)
    ↓ aprobación humana
scripts/vault_sync.py apply
    ↓
Vault actualizado (este directorio)
```

**`facts.json` se regenera siempre con `report`**, garantizando que la imagen
semántica del repo esté actualizada al instante. Ningún agente debe leer
código fuente para preguntas que ya se respondan en `facts.json`.

El campo `extractor` en `vault_sync.config.json` decide qué plugin produce
`facts.json`. Cambiar el extractor (`nextjs-laravel`, `python-generic`,
`graphify`, `generic`, o uno propio del catálogo) no cambia el schema del
report ni la semántica del vault — solo cambia qué metadata semántica se
captura del repo.

---

## Jerarquía semántica

| Capa | Carpeta | Quién manda |
|------|---------|-------------|
| H1 — INTENT | `intent/` | Humano. Inmutable salvo decisión deliberada. |
| H2 — REQUISITOS | `domain/`, `raw/` | Humano + ingesta de docs vía `/ingest`. |
| H3 — ARQUITECTURA | `decisions/` | Humano. Propaga hacia abajo. |
| H4 — CONTRATOS | (en código) | Generado/derivado. Refleja H1–H3. |
| H5 — IMPLEMENTACIÓN | (en código) | Derivado. Nunca contradice capas superiores. |

**Las capas superiores causan las inferiores.** Un cambio en H1 invalida la
coherencia de H4–H5 hasta que se propaga. Un cambio H5 que contradice H1–H3
es un bug del código, no una invitación a modificar H1–H3.

---

## Operaciones permitidas sobre notas

| Operación | Qué hace | Restricción |
|-----------|----------|-------------|
| `update_frontmatter` | Setea claves del frontmatter | No toca notas `locked` |
| `append_section` | Agrega sección al final del cuerpo | Idempotente |
| `create` | Crea nota nueva | Solo si no existe |
| `deprecate` | Marca `status: deprecated`, agrega `deprecated_at` | Reversible manualmente |

**Operaciones prohibidas**: borrar archivos del vault, sobrescribir el cuerpo
completo de una nota, modificar notas `locked`.

---

## Estados de las notas

- `draft` — en construcción, modificable libremente por agentes
- `stable` — activa, solo se actualiza `code_path` y secciones append
- `locked` — inmutable, solo edición humana directa
- `deprecated` — histórico, nadie la actualiza

---

## Contrato del `change_report.json`

Cualquier reporte que no valide contra `scripts/lib/schema.py::REPORT_SCHEMA`
se rechaza. El sistema no procesa reportes ambiguos.

Campos clave para un agente:
- `commit.message` — qué se cambió y por qué (semántica del commit)
- `scope.by_layer` — qué capas se tocaron
- `vault_hints.potentially_affected` — notas candidatas a actualizar
- `vault_hints.must_not_touch` — notas locked, prohibidas
- `consistency.structural_checks.failed` — issues automáticos detectados

---

## Reglas para el agente

1. **Lectura mínima**: leer solo `INDEX.md` + las notas referenciadas en
   `vault_hints`. Nunca leer el vault completo.
2. **Propuesta antes que escritura**: nunca aplicar cambios sin que el humano
   apruebe el `proposed-changes.json`.
3. **Reportar contradicciones, no resolverlas**: si una capa inferior pide
   cambiar algo de una capa superior, escalar al humano.
4. **Idempotencia**: si una operación ya está aplicada (frontmatter ya tiene
   el valor, sección ya existe), omitirla.
5. **Token-aware**: si el reporte excede `report_size_limits.split_threshold_files`,
   dividir el procesamiento por capa o módulo.
6. **Determinismo primero**: si una respuesta está en `facts.json`, no leer
   el código. Solo abrir archivos del repo cuando lo determinista no alcanza.

---

## Para `__PROJECT_NAME__`

Esta nota es el contrato del sistema. Los detalles del proyecto (entidades,
roles, decisiones técnicas concretas) viven en `INDEX.md` y las notas
individuales de `intent/`, `domain/`, `decisions/`.
