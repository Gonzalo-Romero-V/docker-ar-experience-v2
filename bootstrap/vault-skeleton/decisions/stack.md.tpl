---
status: draft
type: decision
layer: H3
created: __DATE__
---

# Stack — __PROJECT_NAME__

<!--
Nota H3 — DECISIÓN. Documenta qué tecnologías se eligieron y por qué.
Esta nota es la que cita `AGENTS.md` cuando una tarea toca dependencias o
herramientas. Si no hay alternativas descartadas, la decisión es frágil
(probablemente nadie la pensó en serio).
-->

## Stack elegido
<!--
Listar tecnologías principales con versiones específicas.
Ejemplo:
  - Frontend: Next.js 16 (App Router) + TypeScript 5.6 + Tailwind 4
  - Backend: Laravel 13 + PostgreSQL 17 + Sanctum
  - Storage: S3 (bucket privado, presigned URLs)
  - País / locale: Ecuador, USD, DD/MM/YYYY, America/Guayaquil
-->

## Motivación
<!--
Por qué este stack y no otro. Ser honesto sobre trade-offs.
Ejemplo: "Laravel porque el equipo ya lo maneja y queremos shippear en 6
semanas. La alternativa (NestJS) habría dado mejor type-safety en el
backend pero curva más larga."
-->

## Alternativas descartadas
<!--
Al menos una. Si no hay alternativas consideradas, la decisión es frágil.
Ejemplo:
  - Considerado Django + DRF: descartado por familiaridad del equipo con PHP.
  - Considerado Bun: descartado por compat con librerías del ecosistema Node.
-->

## Restricciones derivadas
<!--
Qué patrones/librerías/enfoques impone este stack y que afectan a quien toca
código bajo H4–H5.
Ejemplo: "Usar Eloquent ORM — no queries raw excepto reportes pesados."
Ejemplo: "Todas las rutas API pasan por `routes/api.php`, nunca por web."
-->

## Herramientas de desarrollo
<!--
CLI, entornos, convenciones de proyecto.
Ejemplo:
  - Scaffold: `composer create-project`, `create-next-app`, `shadcn add`.
  - Tests: PHPUnit + Vitest.
  - Lint: Pint (PHP) + ESLint flat config (TS).
  - Pre-commit: husky → lint-staged.
-->
