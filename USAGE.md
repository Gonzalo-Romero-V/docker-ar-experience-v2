# Cómo interactúo con el sistema de grafo semántico

Este documento describe **cómo vos, desarrollador, operás el sistema vault-sync**
en un proyecto instanciado con `code-vault-template`. Es la referencia que
necesitás para el día a día.

---

## El modelo mental

```
┌─────────────────────────────────────────────────────────────┐
│  CÓDIGO (repo)         ←→         VAULT (segundo cerebro)   │
│  fuente de verdad técnica         fuente de verdad semántica │
└─────────────────────────────────────────────────────────────┘
                  ↕ vault-sync                   ↕
            change_report.json (determinista)
                  ↕
            propuesta de cambios (Claude)
                  ↕
            tu aprobación → script aplica
```

**Capas (jerarquía descendente):**

- **H1 — INTENT**: visión, reglas de negocio, invariantes (`vault/intent/`)
- **H2 — REQUISITOS**: entidades de dominio y reglas operativas (`vault/domain/`, `vault/raw/`)
- **H3 — ARQUITECTURA**: decisiones de stack y patrones (`vault/decisions/`)
- **H4 — CONTRATOS**: modelos, migraciones, schemas, rutas (en código)
- **H5 — IMPLEMENTACIÓN**: controllers, handlers, services, components (en código)

**Regla de oro**: las capas superiores causan las inferiores. Cambios en H1–H3
son decisión tuya y se propagan hacia abajo. Cambios en H5 nunca contradicen
H1–H3 silenciosamente.

---

## Comandos diarios

### `/sync` — después de cada commit aprobado

El git hook ya generó `.vault-sync/change_report.json` y `.vault-sync/facts.json`
automáticamente. Vos ejecutás:

```
/sync
```

Claude:

1. Lee el reporte y los facts.
2. Identifica qué notas del vault deben actualizarse.
3. **Te muestra la propuesta** (qué se update, qué se crea, qué se deprecia).
4. Vos aprobás (o pedís ajustes).
5. El script aplica.

Si el commit fue solo H5 (refactor de implementación), la propuesta puede
ser **0 cambios al vault**. Eso está bien.

### `/check` — auditoría de coherencia

Cuando dudes que el código siga reflejando los requisitos:

```
/check
```

Claude corre los chequeos deterministas (`env_references`, `vault_code_paths`)
y luego analiza coherencia semántica entre capas. Reporta:

- 🔴 **Contradicciones** — código hace algo que viola una regla del vault
- 🟡 **Drift** — algo en el vault sin reflejo en código (o al revés)
- 🟢 **Coherente** — todo OK

**`/check` no resuelve nada solo.** Reporta y vos decidís.

Si el extractor activo es Graphify, `/check` además verifica que
`graphify-out/graph.json` no esté desactualizado.

### `/ingest <ruta>` — agregaste un documento nuevo

Cuando dropeás un PDF, .txt o imagen en `vault/raw/`:

```
/ingest raw/requisitos-cliente.pdf
```

Claude lee el contenido, extrae conceptos, propone agregar/enriquecer notas.
Vos aprobás. Las notas creadas siguen los templates tipados (`intent/`,
`domain/`, `decisions/`).

### `/snapshot` — solo en momentos especiales

- Al iniciar un proyecto nuevo.
- Después de un refactor masivo.
- Cuando sospechás que el grafo perdió sincronía con el código.

```
/snapshot
```

Claude regenera el mapeo completo concepto ↔ código. **Operación cara en
tokens** — usar con criterio.

---

## Windows: el hook necesita Git Bash

El `post-commit` hook tiene shebang `#!/usr/bin/env bash`. En **Git for Windows**
(default cuando instalás Git desde el sitio oficial), msys2 lo interpreta sin
problemas. Si usás Git via Scoop sin msys, Cygwin u otra instalación sin un
intérprete bash en el PATH del hook, el hook no se ejecuta y `.vault-sync/` no
se regenera tras el commit. En ese caso, correr manualmente:

```
python scripts/vault_sync.py report
```

Y / o configurar tu Git para que use el bash de Git for Windows.

---

## Comandos manuales (sin Claude)

```bash
# Estado del sistema
python scripts/vault_sync.py status

# Generar reporte manualmente (lo hace el git hook automáticamente)
python scripts/vault_sync.py report

# Regenerar solo facts.json (sin cambiar el reporte)
python scripts/vault_sync.py facts

# Validar un reporte
python scripts/vault_sync.py validate .vault-sync/change_report.json

# Correr solo los chequeos deterministas
python scripts/vault_sync.py check

# Aplicar un changes.json aprobado
python scripts/vault_sync.py apply .vault-sync/proposed-changes.json
```

Exit codes:

| Código | Significado |
|---|---|
| 0 | Éxito |
| 1 | Argumentos inválidos / archivo no encontrado |
| 2 | Reporte excede `max_files` — splitear el commit |
| 3 | Reporte falló schema validation |
| 4 | `check` encontró failures de consistency |
| 5 | `apply` tuvo ops fallidas |

---

## Reglas que el sistema respeta SIEMPRE

1. **Nunca** modifica notas con `status: locked`. Si tu `/sync` propone tocar
   una, abortá vos.
2. **Nunca** borra una nota. Como mucho, la marca `deprecated`.
3. **Nunca** sobrescribe el cuerpo entero de una nota. Solo: setea frontmatter,
   agrega secciones.
4. **Idempotente**: aplicar el mismo `changes.json` dos veces no produce
   cambios duplicados.
5. **Falla ruidosa**: si algo no cuadra, aborta y loguea. No adivina.
6. **Logs en `.vault-sync/sync.log`**: revisalo cuando dudes qué pasó.

---

## Estados de las notas

| `status` | Significado | Quién la modifica |
|----------|-------------|-------------------|
| `draft` | Borrador | Claude libremente |
| `stable` | Activa | Claude solo `code_path` y secciones append |
| `locked` | Inmutable | Solo vos manualmente |
| `deprecated` | Obsoleta, queda como histórico | Nadie la actualiza |

---

## Flujo cotidiano completo

```
1. Codeás un cambio
2. Me pedís commit → te muestro mensaje → aprobás
3. git commit (post-commit hook genera change_report.json + facts.json)
4. Si el cambio amerita actualizar vault → /sync
5. Reviso propuesta de Claude
6. Apruebo o ajusto
7. Vault actualizado
8. (Opcional) /check si toqué algo crítico
```

**Antes de cualquier acción de impacto** (commit, push, sync, ingest), Claude
**siempre** te pide aprobación explícita.

---

## Trabajando con un stack nuevo (catálogo acumulativo)

Si tu proyecto usa una pila que no tiene archetype (Angular, Java/Spring,
Go, Rust, Ruby/Rails, etc.), elegí `--stack generic` en el bootstrap. El
extractor `generic` va a:

1. **Detectar el stack** por signal files (`package.json`, `pom.xml`,
   `Cargo.toml`, `angular.json`, `go.mod`, `Gemfile`, etc.).
2. **Correr extracción genérica baseline**: file listing por capa heurística,
   env vars universales, import graph regex multi-lenguaje.
3. Si el stack detectado **no está en el catálogo**, escribir 2 scaffolds:
   - `bootstrap/stacks/_proposed_<stack>.json` — config inferido de convenciones.
   - `scripts/lib/extractors/_proposed_<stack>.py` — clase scaffold con TODOs.
4. Avisarte en stdout y en `facts.json::proposed_files`.

Después vos:

1. Editás el extractor con parsers específicos del framework.
2. Quitás el prefijo `_proposed_` en ambos archivos.
3. Registrás la clase en `scripts/lib/extractors/__init__.py::REGISTRY`.

El sistema **nunca auto-promueve** — el humano valida. Es scaffolding
honesto, no auto-aprendizaje. Cuando vos lo probás en serio y te funciona,
el catálogo crece.

Ver `README.md` sección "Cómo contribuir → Agregar un stack al catálogo"
para el detalle.

---

## Re-instanciar o cambiar de stack

Si querés cambiar el extractor activo sin re-bootstrappear:

```bash
# Editar manualmente:
"extractor": "graphify"      # en vault_sync.config.json
```

Después corré `python scripts/vault_sync.py facts` para regenerar `facts.json`
con el nuevo extractor. El `change_report.json` no cambia (su schema es
universal).

Si querés bootstrappear el sistema sobre un proyecto **que ya existe** (no
clonando el template), ver `README.md` sección "Inicio rápido". La idea es
clonar el template a una carpeta hermana y copiar a mano `scripts/`,
`.claude/`, `hooks/`, y los 3 markdowns (`AGENTS.md`, `CLAUDE.md`, `USAGE.md`).
