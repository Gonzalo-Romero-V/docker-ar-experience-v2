# Skills agnósticas del Code Vault

Este archivo describe las 4 operaciones del flujo Code Vault en un formato
**independiente del CLI de IA** que estés usando.

- En **Claude Code**, estas mismas operaciones se invocan como slash commands
  (`/sync`, `/check`, `/ingest`, `/snapshot`) — la fuente vive en
  `.claude/commands/*.md`.
- En **Codex CLI, Cursor, Cline, Continue u otro CLI sin slash commands**, leé
  este archivo cuando el usuario te pida "sincronizar el vault", "auditar
  coherencia", "ingerir un documento" o "tomar un snapshot del repo". Las
  instrucciones canónicas son las de acá.

Las reglas globales del sistema están en `AGENTS.md` (pre-flight, jerarquía
H1–H5, estados de notas, locked guard). Este archivo solo agrega el **cómo
operar** sin asumir un CLI específico.

---

## Engine determinista (siempre disponible, sin LLM)

Antes de cualquier skill, podés invocar el engine manualmente:

```
python scripts/vault_sync.py report     # genera change_report.json + facts.json
python scripts/vault_sync.py facts      # regenera solo facts.json
python scripts/vault_sync.py validate <change_report.json>
python scripts/vault_sync.py check      # chequeos env_references + vault_code_paths
python scripts/vault_sync.py apply <proposed-changes.json>
python scripts/vault_sync.py status
```

El `post-commit` hook ya corre `report` automáticamente; solo necesitás
invocarlo a mano si el hook está deshabilitado o estás operando offline.

Exit codes: `0` éxito, `1` args/archivo inválido, `2` excede `max_files`,
`3` schema inválido, `4` consistency failures, `5` apply tuvo ops fallidas.

---

## sync — propagar al vault después de un commit

**Cuándo**: después de cada commit que toque dominio o decisiones técnicas. Si
fue refactor puro de implementación (H5), `sync` puede proponer 0 cambios y
eso está bien.

**Inputs**:
- `.vault-sync/change_report.json` — qué cambió (el hook lo generó).
- `.vault-sync/facts.json` — qué hay en el repo (depende del extractor activo).

**Pasos**:

1. **Validá el reporte**:
   ```
   python scripts/vault_sync.py validate .vault-sync/change_report.json
   ```
   Si exit != 0, abortá y reportá al usuario.

2. **Leé `change_report.json`** y quedate con:
   - `commit.message` y `commit.id`
   - `scope.by_layer` — qué capas se tocaron
   - `vault_hints.potentially_affected` — notas candidatas a actualizar
   - `vault_hints.must_not_touch` — notas locked, intocables
   - `consistency.structural_checks.failed` — issues automáticos detectados

3. **Leé `facts.json`** para entender el estado semántico actual. Los campos
   varían según `facts.extractor`:
   - `nextjs-laravel`: `frontend.{shadcn, tsconfig_aliases, theme,
     ui_primitives, lib_utilities, pages}`, `backend.{models, migrations,
     routes, controllers}`, `import_graph[file]`.
   - `python-generic`: `sqlalchemy_models`, `pydantic_schemas`,
     `alembic_migrations`, `routes`, `django.apps` (si aplica), `import_graph`.
   - `graphify`: `import_graph[file]`, `call_graph[file]` (exclusivo —
     dependencias función-a-función), `node_count`, `edge_count`,
     `hyperedges_count`, `graphify_metadata`.
   - `generic`: `detected_stack`, `import_graph`, `layers`, `env_references`,
     `proposed_files` (si se generaron scaffolds).
   - **Universales** (todos): `extractor`, `extracted_at`, `import_graph`,
     `env_references`, `layers.{H4,H5}`.

4. **Si el extractor es `graphify`**, aprovechá el `call_graph` antes de
   proponer cambios. `call_graph[archivo_cambiado]` te dice qué funciones
   llama ese archivo, lo que permite identificar si un cambio H5 toca
   contratos H4 indirectamente.

5. **Para cada nota en `potentially_affected`** decidí qué cambia:
   - Solo `code_path` y secciones append — nunca sobrescribir cuerpo.
   - Si está `locked`, ignorá la propuesta y reportá al usuario.

6. **Si el commit incorpora una capa nueva** (instalación de librería
   estructural, modelo nuevo, decisión arquitectónica implícita):
   - ¿Falta una nota en `decisions/` que documente la decisión?
   - ¿Falta una nota en `domain/` para una entidad nueva?
   - ¿Una nota existente debe actualizar `code_path` o sumar sección
     "Implementación"?

7. **Si los cambios atraviesan jerarquía** (H3 o superior), validá coherencia
   con H1–H2 antes de tocar nada.

8. **Generá `.vault-sync/proposed-changes.json`** con operaciones concretas.
   Las acciones soportadas son:
   ```json
   {
     "operations": [
       {"action": "update_frontmatter", "note": "domain/x.md",
        "set": {"code_path": "app/models/x.py", "status": "stable"}},
       {"action": "append_section", "note": "domain/x.md",
        "section": "Implementación", "content": "Implementado en [[y]]."},
       {"action": "create", "path": "domain/y.md",
        "content": "---\nstatus: draft\ntype: domain\nlayer: H2\n---\n\n# Y\n"},
       {"action": "deprecate", "note": "domain/old.md"}
     ]
   }
   ```

9. **Resumí al usuario**: qué se actualiza, qué se crea, qué se deprecia, qué
   contradicciones detectaste (NO las resolvés, solo las flageás).

10. **Pedí aprobación**. Si aprueba:
    ```
    python scripts/vault_sync.py apply .vault-sync/proposed-changes.json
    ```

**Reglas estrictas**:
- Solo `update_frontmatter`, `append_section`, `deprecate`, `create`. Nunca
  sobrescribir body, nunca borrar.
- Si `consistency.structural_checks.failed` no está vacío, mencionalo antes
  de proponer cambios.
- Idempotencia: si la nota ya tiene el valor que querés setear, no propongas
  la operación.
- **No leas el código fuente** salvo necesidad puntual — los facts ya tienen
  lo extraíble deterministicamente.

---

## check — auditoría de coherencia transversal

**Cuándo**: cuando dudás que el código siga reflejando los requisitos del vault.

**Pasos**:

1. **Ejecutá los checks deterministas**:
   ```
   python scripts/vault_sync.py check
   ```
   - Reporta `env_references` (variables usadas pero no declaradas en
     `.env.example`).
   - Reporta `vault_code_paths` rotos (notas que apuntan a archivos
     inexistentes).

2. **Leé `INDEX.md`** del vault para obtener el mapa de notas.

3. **Para cada par capa-superior → capa-inferior, verificá coherencia
   semántica**:
   - H1 (intent) ↔ H2 (requisitos): ¿los requisitos cumplen la visión?
   - H2 (requisitos) ↔ H3 (decisiones): ¿las decisiones cubren los requisitos?
   - H3 (arquitectura) ↔ H4 (contratos): ¿los modelos/rutas/schemas reflejan
     las decisiones?
   - H4 (contratos) ↔ H5 (implementación): ¿los controllers/handlers
     respetan los contratos?

4. **Si el extractor activo es `graphify`** (revisar `facts.json::extractor`),
   chequeá además:
   - **Frescura**: comparar mtime de `graphify-out/graph.json` con el
     timestamp del último commit (`git log -1 --format=%cI`). Si está
     desactualizado, advertí al usuario:
     > graph.json desactualizado — ejecutar `graphify extract . --no-cluster`
       antes del próximo sync.
   - **Cobertura semántica**: leé `facts.call_graph` y contrastá contra
     `domain/`. Funciones con muchas llamadas entrantes (high-fan-in) sin
     nota de dominio correspondiente sugieren drift entre H4 y H5.

5. **Reportá hallazgos en tres categorías**:
   - 🔴 **Contradicciones** (deben resolverse): regla X dice A, código hace B.
   - 🟡 **Drift** (atención): nota habla de un concepto sin reflejo en código
     (o al revés).
   - 🟢 **Coherente** (informativo): pares revisados sin issues.

6. **NO resuelvas las contradicciones.** Solo presentá:
   - Qué dice la capa superior (cita la línea de la nota).
   - Qué hace la capa inferior (cita el archivo + línea).
   - Cuál es el conflicto.
   - Sugerencia de resolución — el usuario decide.

**Reglas estrictas**:
- Leé solo notas relevantes a la jerarquía que estés auditando — no leas
  todo el vault.
- Si encontrás una contradicción que toca una nota `locked`, reportala
  primero: es la más prioritaria porque solo el humano puede resolverla.
- Sé específico: cita la línea de la regla y el archivo de código exacto.
- **Token-aware**: si el repo tiene > 50 archivos en H4–H5, auditá por
  módulo, no global. Mirá `facts.layers` para agrupar por carpeta.
- Si el extractor es `generic` y hay `proposed_files` en facts, recordá al
  usuario que esos scaffolds están pendientes de promoción al catálogo.

---

## ingest \<ruta\> — incorporar un documento nuevo

**Cuándo**: el usuario dropeó un PDF / .txt / imagen en `vault/raw/` y querés
extraer su contenido semántico al grafo.

**Pasos**:

1. **Leé el archivo** indicado en el argumento (ruta relativa al vault).
2. **Identificá el tipo de información**:
   - ¿Es contexto de negocio? → `intent/` o `domain/`.
   - ¿Es decisión técnica externa? → `decisions/`.
   - ¿Es referencia o material de soporte? → puede quedarse solo en `raw/`.
3. **Leé el `INDEX.md` y las notas relevantes** ya existentes para no duplicar
   información.
4. **Extraé entidades, reglas y relaciones**:
   - ¿Hay entidades de dominio nuevas?
   - ¿Hay reglas que contradicen reglas existentes?
   - ¿Hay decisiones implícitas que merecen una nota `decisions/`?
5. **Proponé operaciones** en `.vault-sync/proposed-changes.json`:
   - `create` para conceptos nuevos (usar los templates `*.md.tpl` como base).
   - `append_section` para enriquecer notas existentes.
   - **NUNCA** `deprecate` automáticamente; es decisión del usuario. `ingest`
     solo agrega.
6. **Reportá contradicciones encontradas** al usuario explícitamente — no
   resolvás, solo flagealas.
7. **Resumí y pedí aprobación** antes de aplicar.

**Reglas estrictas**:
- No toques notas `locked`.
- Si el documento parece reescribir una regla existente → reportalo como
  contradicción, no como `update`.
- Mantené los enlaces wiki (`[[nota]]`) consistentes con las notas que
  existen en el vault.

**Nota sobre Graphify**: para PDFs técnicos extensos, Graphify Pass 3 (con
flags LLM) puede ser una alternativa que extrae entidades como nodos del
grafo. **`ingest` sigue siendo el camino canónico** porque produce notas
estructuradas con `status`, `code_path` y wikilinks. Graphify produce nodos —
útiles para queries, no para el contrato semántico que el sistema mantiene.

---

## snapshot — mapeo completo inicial

**Cuándo**: solo en arranque de proyecto, refactor masivo, o sospecha de drift
severo. **Caro en tokens** — usar con criterio.

**Antes de leer cualquier archivo de código**:

Verificá si `graphify-out/graph.json` existe.
- Si existe, usalo como mapa estructural. Leé sus primeras ~200 líneas con
  tu herramienta nativa. Empezar por el grafo evita re-leer archivos raw
  que Graphify ya parseó deterministicamente.
- Si no existe, proceder con lectura directa.

**Pasos**:

1. **Leé `vault_sync.config.json`** para conocer `vault_path`, extractor
   activo, `hierarchy_mapping`.
2. **Generá el reporte y los facts**:
   ```
   python scripts/vault_sync.py report
   ```
3. **Leé `.vault-sync/facts.json`** primero — tiene la extracción semántica
   del repo. Qué exactamente está adentro depende del extractor:
   - `nextjs-laravel`: `frontend.*`, `backend.*`, `import_graph`.
   - `python-generic`: `sqlalchemy_models`, `pydantic_schemas`,
     `alembic_migrations`, `routes`, `django.apps`.
   - `graphify`: `node_count`, `edge_count`, `import_graph`, `call_graph`,
     `layers`.
   - `generic`: `detected_stack`, `import_graph`, `layers`, posiblemente
     `proposed_files` (scaffolds para promover al catálogo — informarlo).
   - Cualquiera: `layers.{H4, H5}`, `env_references`.
4. **Leé `INDEX.md` y las notas existentes** (`intent/`, `domain/`,
   `decisions/`). No leas el vault completo — solo lo que ya hay.
5. **Mapeá código → vault**:
   - Para cada entidad/módulo H4 detectado en `facts.json`, identificá si
     ya existe una nota de dominio.
   - Si existe → proponé actualizar `code_path` en su frontmatter.
   - Si no existe pero el archivo representa un concepto del dominio →
     proponé crear una nueva nota.
6. **Identificá gaps**:
   - Variables en `facts.env_references` sin documentación en `decisions/`.
   - Decisiones técnicas implícitas sin reflejo en `decisions/stack.md` o
     `decisions/architecture.md`.
   - Entidades en H4 sin nota domain correspondiente.
7. **Produzcí `.vault-sync/proposed-changes.json`** con operaciones tipo
   `update_frontmatter` / `create`.
8. **Resumí y pedí aprobación**. Si aprueba:
   ```
   python scripts/vault_sync.py apply .vault-sync/proposed-changes.json
   ```

**Reglas estrictas**:
- Nunca modifiques notas con `status: locked` (típicamente `SYSTEM.md` e
  `INDEX.md`).
- Nunca borres una nota; usá `deprecate` si está obsoleta.
- Si una propuesta contradice una nota `locked`, detenete y reportá la
  contradicción.
- **No leas el vault completo de golpe** — usá el report y las notas
  relevantes.
- Si el extractor es `generic` y aparecen `proposed_files` en facts.json, el
  primer item del resumen debería ser:
  > Stack `<X>` detectado sin archetype; scaffolds escritos en `_proposed_*`.
    Revisá antes de promover.
