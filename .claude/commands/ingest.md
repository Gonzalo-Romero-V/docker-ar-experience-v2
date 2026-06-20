---
description: Ingiere un documento nuevo de raw/ al grafo semántico del vault
argument-hint: <ruta del archivo en vault/raw/>
---

Estás ingiriendo un documento nuevo a la base de conocimiento. El usuario
agregó un archivo en `vault/raw/` (PDF, txt, imagen, etc.) y querés extraer
su contenido semántico al grafo.

## Pasos

1. **Leé el archivo** indicado en el argumento (ruta relativa al vault).
2. **Identificá el tipo de información**:
   - ¿Es contexto de negocio? → relevante a `intent/` o `domain/`
   - ¿Es decisión técnica externa? → relevante a `decisions/`
   - ¿Es referencia o material de soporte? → puede quedarse solo en `raw/`
3. **Leé el `INDEX.md` y las notas relevantes** ya existentes para no duplicar
   información.
4. **Extrae entidades, reglas y relaciones**:
   - ¿Hay nuevas entidades de dominio?
   - ¿Hay reglas que contradicen reglas existentes?
   - ¿Hay decisiones implícitas que merecen una nota `decisions/`?
5. **Proponé operaciones** en `.vault-sync/proposed-changes.json`:
   - `create` para conceptos nuevos (usar los templates `*.md.tpl` como base)
   - `append_section` para enriquecer notas existentes
   - **NUNCA** `deprecate` automáticamente; eso es decisión del usuario.
     `ingest` solo agrega.
6. **Reportá contradicciones encontradas** al usuario explícitamente — no
   resuelvas, solo flagealas.
7. **Resumí y pedí aprobación** antes de aplicar.

## Reglas estrictas

- No toques notas `locked`.
- Si el documento parece reescribir una regla existente → reportalo como
  contradicción, no como `update`.
- Mantené los enlaces wiki (`[[nota]]`) consistentes con las notas que existen
  en el vault.

## Nota sobre Graphify

Para PDFs técnicos extensos y documentos externos densos, Graphify Pass 3
(con flags de LLM activas) puede ser una alternativa: extrae entidades,
diagramas y rationale como nodos del grafo en lugar de notas del vault.

**`/ingest` sigue siendo el camino canónico** porque produce notas
estructuradas con `status`, `code_path` y wikilinks. Graphify produce nodos
de grafo — utiles para queries, no para el contrato semántico que el sistema
vault-sync mantiene.

Si Graphify ya está corriendo y querés combinar ambos:
- Dejá los PDFs en `vault/raw/` y corré `/ingest` (path canónico).
- Si además querés que Graphify los conozca para queries, ejecutá:
  ```
  graphify extract . --no-cluster
  ```
  (sin `--no-cluster` si querés clusters, con flags adicionales si querés Pass 3.)
