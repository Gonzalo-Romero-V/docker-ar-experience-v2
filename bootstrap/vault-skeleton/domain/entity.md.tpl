---
status: draft
type: domain
layer: H2
created: __DATE__
code_path: ""
---

# [Entidad]

<!--
Nota H2 — DOMINIO. Una entidad de negocio, descripta en términos de negocio.
NO es la definición del modelo Eloquent/SQLAlchemy/Pydantic; ESA vive en el
código (H4) y se referencia vía `code_path`.

Setear `code_path` cuando la entidad se materializa en código: el script
`/check` valida que el archivo apuntado existe.

Estados: si tu entidad tiene ciclo de vida (pedido pendiente → entregado →
cancelado), la sección "Estados" es la fuente de verdad. El enum del código
implementa este enum, no al revés.
-->

## Definición
<!-- ¿Qué es esta entidad en términos de negocio (no técnicos)? -->

## Estados
<!--
Si la entidad tiene un ciclo de vida, listar estados válidos aquí.
CRÍTICO: este enum es la fuente de verdad. El código lo implementa.

Ejemplo:
  - `pendiente` — orden creada, sin pagar
  - `pagada` — pago confirmado, lista para preparar
  - `entregada` — recibida por el cliente
  - `cancelada` — terminal, no se reabre
-->

## Atributos clave
<!--
Solo los que tienen reglas de negocio. No listar todos los campos del
modelo — eso lo extrae `facts.json`. Listar acá los que tienen invariantes:
"precio > 0", "email único", "fecha_vencimiento ≥ hoy", etc.
-->

## Relaciones
<!--
Con qué otras entidades se relaciona y cómo (1:N, N:M, opcional, obligatoria).
Usar `[[otra-entidad]]` para wikilinks.
-->

## Reglas de negocio
<!--
Restricciones que aplican a esta entidad y que no caben en "atributos".
Ejemplo: "Un pedido cancelado no puede volverse pagado."
Ejemplo: "Solo el admin puede modificar el precio una vez confirmado."
-->

## Notas de implementación
<!--
Esta sección la actualiza `/sync` automáticamente cuando detecta cambios en
el archivo referenciado por `code_path`. NO escribir acá manualmente algo
que `/sync` deba mantener — se va a sobreescribir con append-only.
-->
