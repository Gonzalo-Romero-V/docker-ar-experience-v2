---
status: stable
type: decision
layer: H3
created: 2026-06-20
---

# Stack — Docker AR Tutor

## Stack elegido

### Frontend
- **Next.js 16** (App Router, Turbopack) + **TypeScript 5**
- **Tailwind CSS 4** + design tokens en `globals.css`
- **shadcn/ui** + **Radix UI** como base de componentes
- **Zod** para validación de contratos (especialmente el contrato LLM → componentes)
- **Lucide React** para iconos

### AR
- **MindAR** (image tracking únicamente — abre cámara, detecta target, provee anchor 3D)
- **Three.js** (escena, cámara, matrices, transformaciones, objetos decorativos)
- **CSS3DRenderer + CSS3DObject** (renderizar componentes DOM reales en espacio 3D — pieza central)
- **GSAP** (animaciones de focus, transiciones de paneles, cambios de escala/opacidad)

### Backend / RAG Service
- **Node.js + TypeScript** (ecosistema unificado, sin Python)
- **Fastify** (framework HTTP: endpoints limpios, alto rendimiento, tipado, sin complejidad innecesaria)
- **PostgreSQL** + **pgvector** (base de datos + búsqueda vectorial)
- **OpenAI** (LLM para respuestas + embeddings para indexación)

### Shared
- Módulo `app/servicios/shared/src/` con tipos TypeScript y schemas Zod compartidos entre frontend y RAG service

### Monorepo
- Sin turbo/nx por ahora — estructura simple de carpetas bajo `app/`

## Motivación

**JS/TS en todo el stack**: reduce fricción de contexto, permite compartir tipos entre frontend y backend sin conversión, un solo ecosistema de herramientas (ESLint, TypeScript, Vitest).

**Fastify sobre Express**: mejor soporte nativo de async/await, plugin system ordenado, mejor rendimiento sin complejidad de NestJS.

**MindAR sobre AR.js**: documentación más activa para image tracking, ejemplos reales con Three.js, soporte de CSS3D más claro en la comunidad.

**CSS3DRenderer como estrategia principal AR**: es la única forma real de mantener componentes React/Next como DOM genuino en espacio 3D. Preserva estado React, Tailwind, shadcn, accesibilidad, eventos nativos. Sin CanvasTexture como reemplazo genérico de UI.

**pgvector sobre Pinecone/Qdrant/Chroma**: cero servicios externos extra, misma DB que podría usarse para datos de aplicación, soporte de búsqueda híbrida keyword+vector con extensiones Postgres.

## Alternativas descartadas

- **Python para el servicio RAG**: descartado para mantener un solo ecosistema. La fricción de mantener dos entornos (Node + Python) supera los beneficios de LangChain o llama-index para la escala de este proyecto.
- **LangChain/LlamaIndex**: descartados — agregan abstracción sobre OpenAI SDK que no aporta en un pipeline RAG controlado y definido. Preferible implementar el pipeline explícitamente.
- **CanvasTexture para UI AR**: descartado explícitamente. No mantiene estado React, no renderiza shadcn correctamente, no soporta eventos nativos. Solo válido para elementos decorativos o textos estáticos simples.
- **A-Frame**: descartado. Abstrae demasiado Three.js y dificulta el control preciso de CSS3DRenderer.
- **Turbo/Nx**: descartado para v1. La estructura monorepo es simple; agregar herramientas de build antes de tener código es overhead innecesario.

## Restricciones derivadas

- **Nunca generar HTML libre desde el LLM**. El LLM produce JSON con tipo de componente + props tipadas con Zod. El frontend mapea ese JSON a componentes React reales.
- **CSS3DRenderer requiere sincronización de cámara con WebGL renderer**. Ambos renderers comparten la misma cámara Three.js y el mismo ciclo `requestAnimationFrame`. No pueden vivir en contextos separados.
- **GSAP anima propiedades de CSS3DObject**, no estilos DOM directos cuando el objeto está en escena AR. Hay que animar el objeto Three.js, no el elemento HTML subyacente directamente.
- **pgvector requiere extensión activa en PostgreSQL**. El setup de la DB incluye `CREATE EXTENSION IF NOT EXISTS vector`.
- **OpenAI embeddings: modelo `text-embedding-3-small`** como default de v1. Cambiar el modelo de embeddings requiere re-indexar toda la base vectorial.

## Compatibilidad MindAR + Three.js (workaround documentado)

MindAR requiere constantes legacy de Three.js (`sRGBEncoding`, `LinearEncoding`) removidas en r152.
Solución aplicada en `app/frontend/next.config.ts`:

```ts
turbopack: {
  resolveAlias: {
    three: "./stubs/three-compat.js",  // re-export three + constantes legacy
    fs:    "./stubs/empty.js",         // shim vacío — MindAR intenta importar fs en browser
  }
}
```

**Regla**: no tocar estos aliases ni stubs salvo error real documentado con número de issue o referencia concreta.

## Herramientas de desarrollo

- **Scaffold frontend**: `create-next-app` + `shadcn@latest init`
- **Scaffold RAG service**: Fastify con TypeScript desde template oficial
- **Tests**: Vitest (frontend + backend)
- **Lint**: ESLint flat config (TypeScript)
- **Type check**: `tsc --noEmit` en CI
- **Orquestación agentes**: Claude Code (arquitecto) + Codex CLI (implementador de tareas delegadas)
- **Graphify**: activar post-scaffolds cuando haya código real para extraer call graphs
