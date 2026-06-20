---
status: draft
type: decision
layer: H3
created: __DATE__
---

# Arquitectura — __PROJECT_NAME__

<!--
Nota H3 — DECISIÓN. Documenta cómo está organizado el sistema:
patrón arquitectónico, capas, convenciones que cualquier feature debe respetar.

Esta nota es referencia obligatoria para tareas que toquen el shape del
código: nuevo módulo, refactor estructural, decisiones de auth/errores.
-->

## Patrón arquitectónico
<!--
MVC / hexagonal / clean architecture / monolito modular / microservicios.
Ser específico sobre QUÉ patrón se aplica DÓNDE — pueden coexistir varios.
Ejemplo:
  - Backend: MVC clásico Laravel (Controller → Service → Eloquent Model).
  - Frontend: App Router con Server Components por defecto; Client Components
    solo para interactividad explícita.
-->

## Separación de responsabilidades
<!--
Qué capa hace qué. Ser específico sobre las invariantes:
  - "Los Controllers no hacen queries directas; delegan en Services."
  - "Los Models no llaman a APIs externas; eso vive en Services o Jobs."
  - "Los Components UI no hacen fetch; usan hooks que viven en `hooks/`."
-->

## Convenciones de naming
<!--
Cómo se nombran archivos, clases, rutas, variables. Ejemplo:
  - Archivos: kebab-case en frontend, PascalCase en backend (clases PHP).
  - Endpoints REST: `/api/v1/<resource>` plural, kebab-case.
  - Tablas DB: plural snake_case (`users`, `order_items`).
  - Variables: camelCase JS, snake_case Python/PHP.
-->

## Gestión de autenticación y autorización
<!--
Si aplica. Quién puede hacer qué y cómo se controla.
  - Auth: estrategia (sesión, JWT, OAuth) y dónde se valida.
  - RBAC / ABAC: dónde vive la matriz de permisos.
  - Multi-tenancy: cómo se aísla el dato entre tenants.
-->

## Manejo de errores
<!--
Estrategia global:
  - Dónde se capturan (middleware, decorator, error boundary).
  - Cómo se reportan (logs, Sentry, throw a la UI).
  - Qué se le devuelve al cliente vs qué se loguea internamente.
-->

## Decisiones pendientes
<!--
ADRs abiertos. Mejor explícito que implícito.
Ejemplo:
  - [ ] Real-time: ¿polling con React Query o WebSocket con Echo?
  - [ ] Cache: ¿Redis ahora o esperamos al primer cuello de botella?
-->
