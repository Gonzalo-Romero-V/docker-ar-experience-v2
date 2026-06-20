---
description: Detecta contradicciones e inconsistencias entre capas del grafo y el código
---

Estás ejecutando un chequeo de coherencia transversal entre el vault y el
repo. Combina chequeos deterministas (script) con interpretación semántica
(tu razonamiento).

## Pasos

1. **Ejecutá los checks deterministas**:
   ```
   python scripts/vault_sync.py check
   ```
   - Reporta `env_references` (variables usadas pero no declaradas en `.env.example`)
   - Reporta `vault_code_paths` rotos (notas que apuntan a archivos inexistentes)

2. **Leé `INDEX.md`** del vault para obtener el mapa de notas.

3. **Para cada par capa-superior → capa-inferior, verificá coherencia semántica**:
   - **H1 (intent) ↔ H2 (requisitos)**: ¿los requisitos cumplen la visión?
   - **H2 (requisitos) ↔ H3 (decisiones)**: ¿las decisiones cubren los requisitos?
   - **H3 (arquitectura) ↔ H4 (contratos)**: ¿los modelos/rutas/schemas reflejan
     las decisiones?
   - **H4 (contratos) ↔ H5 (implementación)**: ¿los controllers/handlers/components
     respetan los contratos?

4. **Si el extractor activo es `graphify`** (revisar `facts.json::extractor`),
   chequeá además:
   - **Frescura**: comparar el mtime de `graphify-out/graph.json` con el
     timestamp del último commit (`git log -1 --format=%cI`). Usá tu
     herramienta nativa (no asumas `stat -c` — eso solo funciona en Unix;
     en Windows + PowerShell sería `(Get-Item file).LastWriteTime`).
     Si está desactualizado, advertí al usuario:
     > graph.json desactualizado — ejecutar `graphify extract . --no-cluster`
       para refrescarlo antes del próximo /sync.
   - **Cobertura semántica**: leé `facts.call_graph` y contrastá contra las
     notas de `domain/`. ¿Hay funciones con muchas llamadas entrantes
     (high-fan-in) que no tienen nota de dominio correspondiente? Eso
     sugiere drift entre H4 y H5.

5. **Reportá hallazgos en tres categorías**:
   - 🔴 **Contradicciones** (deben resolverse): regla X dice A, código hace B
   - 🟡 **Drift** (atención): nota habla de un concepto sin reflejo en código
     (o al revés)
   - 🟢 **Coherente** (informativo): pares revisados sin issues

6. **NO resuelvas las contradicciones.** Solo presentá:
   - Qué dice la capa superior (cita la línea de la nota)
   - Qué hace la capa inferior (cita el archivo + línea)
   - Cuál es el conflicto
   - Sugerencia de resolución — el usuario decide.

## Reglas estrictas

- Leé solo notas relevantes a la jerarquía que estés auditando — no leas
  todo el vault.
- Si encontrás una contradicción que toca una nota `locked`, reportala
  primero: es la más prioritaria porque solo el humano puede resolverla.
- Sé específico: cita la línea de la regla y el archivo de código exacto.
- **Token-aware**: si el repo tiene > 50 archivos en H4–H5, auditá por
  módulo, no global. Mirá `facts.layers` para agrupar por carpeta.
- Si el extractor es `generic` y hay `proposed_files` en facts, recordá al
  usuario que esos scaffolds están pendientes de promoción al catálogo.
