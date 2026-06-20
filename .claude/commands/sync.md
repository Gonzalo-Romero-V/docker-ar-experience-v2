---
description: Aplica cambios al vault basados en change_report.json + facts.json (post-commit)
---

Estás sincronizando el vault con el último commit. El git hook ya generó dos
artefactos deterministas que **debés leer antes de proponer nada**:

- `.vault-sync/change_report.json` — qué cambió (archivos, capa, diff resumido)
- `.vault-sync/facts.json` — qué hay realmente en el repo (depende del extractor activo)

## Pasos

1. **Validá el reporte**:
   ```
   python scripts/vault_sync.py validate .vault-sync/change_report.json
   ```
   Si falla → aborta y reportá al usuario.

2. **Leé `change_report.json`** y quedate con:
   - `commit.message` y `commit.id`
   - `scope.by_layer` — qué capas se tocaron
   - `vault_hints.potentially_affected` — notas candidatas
   - `vault_hints.must_not_touch` — notas locked, intocables
   - `consistency.structural_checks.failed` — issues automáticos detectados

3. **Leé `facts.json`** para entender el estado semántico actual. Los campos
   varían según el extractor activo (`facts.extractor`):
   - **`nextjs-laravel`**: `frontend.shadcn`, `frontend.tsconfig_aliases`,
     `frontend.theme`, `frontend.ui_primitives`, `frontend.lib_utilities`,
     `frontend.pages`, `backend.models`, `backend.migrations`, `backend.routes`,
     `import_graph[file]`.
   - **`python-generic`**: `sqlalchemy_models`, `pydantic_schemas`,
     `alembic_migrations`, `routes`, `django.apps` (si aplica), `import_graph[file]`.
   - **`graphify`**: `import_graph[file]`, `call_graph[file]` (campo exclusivo —
     dependencias función-a-función), `node_count`, `edge_count`, `hyperedges_count`,
     `graphify_metadata`.
   - **`generic`**: `detected_stack`, `import_graph`, `layers`, `env_references`,
     `proposed_files` (si se generaron scaffolds).
   - **Universales** (todos los extractores): `extractor`, `extracted_at`,
     `import_graph`, `import_graph_size`, `env_references`, `layers.{H4,H5}`.

4. **Si el extractor es `graphify`**, aprovechá el `call_graph` antes de
   proponer cambios:
   - `call_graph[archivo_cambiado]` te dice qué funciones llama ese archivo.
   - Esto permite identificar si un cambio H5 toca contratos H4 indirectamente
     (a través de llamadas), aún cuando el `change_report` no lo flagee.
   - Si Graphify produjo `GRAPH_REPORT.md` (con `--cluster`), úsalo como
     contexto adicional sobre comunidades del grafo. No es obligatorio.

5. **Para cada nota en `potentially_affected`** decidí qué cambia:
   - Solo `code_path` y secciones append — nunca sobrescribir cuerpo.
   - Si la nota está `locked`, ignorá la propuesta y reportá al usuario.

6. **Si el commit incorpora una capa nueva al sistema** (ej: instalación de
   shadcn, sidebar nuevo, modelo nuevo, librería estructural):
   - Falta una nota en `decisions/` que documente la decisión arquitectónica?
   - Falta una nota en `domain/` para enlazar una entidad de código nueva?
   - Una nota existente debe actualizar su `code_path` o agregarse una
     sección "Implementación"?

7. **Si los cambios atraviesan jerarquía** (H3 o superior), validá coherencia
   con notas H1–H2 antes de tocar nada.

8. **Generá `.vault-sync/proposed-changes.json`** con operaciones concretas
   (`update_frontmatter`, `append_section`, `deprecate`, `create`).

9. **Resumí al usuario**:
   - Qué notas se actualizan
   - Qué se crea
   - Qué se deprecia
   - Contradicciones detectadas (NO las resolvés, solo las flageás)

10. **Pedí aprobación**. Si aprueba:
    ```
    python scripts/vault_sync.py apply .vault-sync/proposed-changes.json
    ```

## Reglas estrictas

- Operaciones permitidas: `update_frontmatter`, `append_section`, `deprecate`,
  `create`. **Nunca** sobrescribir cuerpo, **nunca** borrar.
- Si el reporte tiene `consistency.structural_checks.failed` no vacío,
  mencionalo antes de proponer cambios.
- Si el commit tocó solo H5 (implementación), el vault puede no necesitar
  cambios. Es válido proponer 0 operaciones.
- Idempotencia: si la nota ya tiene el valor que querés setear, no propongas
  la operación. El script igualmente la skipearía, pero ahorra ruido en la
  propuesta.
- **No leas el código fuente** salvo necesidad puntual — los facts ya tienen
  lo extraíble determinísticamente. Si necesitás más, pedí permiso.
