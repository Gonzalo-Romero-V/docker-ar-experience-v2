---
description: Empaqueta una tarea para Codex — genera task spec en tasks/active/ con contexto mínimo, criterios de aceptación y mecanismo de evaluación
---

Vas a delegar una tarea a Codex. Antes de escribir el spec, evaluá si la tarea cumple los criterios de delegación definidos en `AGENTS.md` sección "Protocolo de delegación".

## Pasos

1. **Verificá que la tarea es delegable**:
   - ¿Es repetitiva o de volumen alto?
   - ¿Los criterios de aceptación son automáticamente verificables (tsc, eslint, tests)?
   - ¿No requiere razonamiento arquitectónico ni decisiones sobre AR/contrato LLM?
   Si no cumple → implementá vos.

2. **Leé el vault relevante** según la tabla de tareas en `AGENTS.md`.
   Los fragmentos necesarios van al spec como contexto mínimo — no el vault completo.

3. **Generá el ID de tarea**: formato `YYYY-MM-DD-<N>-<slug>` (ej: `2026-06-20-1-ar-panel-components`).

4. **Escribí `tasks/active/<id>.md`** con esta estructura exacta:

```markdown
---
id: <id>
status: pending
created: <fecha>
evaluator: <tsc | eslint | test | diff-review | manual>
bidirectional: <true | false>
---

## Task: <nombre corto>

### Context
<!-- Extracto mínimo del vault. Solo lo que Codex necesita para implementar correctamente. -->

### Scope
<!-- Lista de archivos a crear / modificar con paths exactos desde repo root -->

### Acceptance criteria
- [ ] <criterio verificable 1>
- [ ] <criterio verificable 2>

### Pattern reference
<!-- Fragmento de código existente que muestra el patrón. Si no existe aún, describir el shape esperado. -->

### Do NOT
<!-- Restricciones explícitas. Ejemplo: no usar CanvasTexture, no hardcodear posiciones 3D, no mezclar lógica AR con estado React. -->

### Evaluation command
<!-- Comando exacto a correr para evaluar. Ejemplo: npx tsc --noEmit && npx eslint app/frontend/components/ar/ -->
```

5. **Si `bidirectional: true`**, agregá fases:
```markdown
### Phase 1: <nombre>
<scope y criterios de fase 1>
**Checkpoint: Claude revisa antes de continuar.**

### Phase 2: <nombre>
<scope y criterios de fase 2 — depende de fase 1>
```

6. **Informá al humano**:
   - Qué tarea se delegó
   - Qué evaluador se usará
   - Si es one-shot o bidireccional
   - Dónde está el spec: `tasks/active/<id>.md`

7. **Después de que Codex implementa**, corré la evaluación:
   ```
   <evaluation command del spec>
   ```
   Si pasa → mové el spec a `tasks/completed/<id>.md` y proponé commit.
   Si falla → anotá el failure en el spec y decidí si iterar (Codex) o corregir (Claude).

## Reglas

- Nunca escribir specs ambiguos — si no podés definir un criterio de aceptación verificable, la tarea no es delegable.
- El spec debe ser autocontenido: Codex no tiene acceso al vault ni al historial de conversación.
- El campo `Do NOT` es tan importante como `Acceptance criteria` — es donde se previenen los errores más comunes.
- Nunca delegar decisiones de diseño AR, posicionamiento espacial ni cambios al contrato LLM → componentes.
