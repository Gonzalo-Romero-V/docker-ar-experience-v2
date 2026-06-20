---
status: stable
type: intent
layer: H1
created: 2026-06-20
---

# Visión — Docker AR Tutor

## Visión

Un tutor interactivo de Docker que usa RAG para responder preguntas del usuario y proyecta la respuesta como una experiencia visual en AR: una pizarra espacial o cine curvo virtual donde el contenido didáctico (cards, tablas, quizzes, diagramas, steppers) aparece como componentes web reales flotando alrededor del usuario, colocados en un plano 3D con posición, escala, rotación, foco y distribución radial.

El usuario accede desde el celular, apunta la cámara a un image target, y ve una pantalla curva virtual con el contenido de la respuesta materializado como paneles DOM reales en el espacio 3D. No es una imagen de una interfaz: es la interfaz misma, proyectada en AR.

## Propósito central

Demostrar que componentes web normales (Next.js/React) pueden existir como paneles DOM reales en una escena AR 3D, formando un board pedagógico espacial controlado matemáticamente, no improvisado.

## Invariantes de negocio

1. **El LLM elige componentes, no coordenadas.** El LLM produce una respuesta estructurada usando el catálogo cerrado de componentes del sistema. Nunca genera HTML libre ni posiciones 3D. El sistema (no el LLM) decide layout, posición, escala, rotación, foco y distribución espacial.

2. **Los componentes son DOM real, no imágenes.** CSS3DRenderer/CSS3DObject es la estrategia principal para proyectar UI en AR. CanvasTexture puede usarse solo para casos muy puntuales decorativos, nunca para renderizar cards, tablas, quizzes o componentes React completos.

3. **Un componente que se ve mal en DOM web se verá peor en AR.** Todos los componentes pedagógicos deben funcionar y verse bien como UI web normal antes de ser proyectados en AR. La validación AR no puede ser la primera validación.

4. **El layout espacial es matemático, no improvisado.** Las posiciones, escalas y rotaciones de los paneles se calculan algorítmicamente (distribución radial/semicurva). Cero magic numbers sueltos en código de presentación.

5. **Mobile-first.** La experiencia AR se piensa primero para móvil. El usuario abre la app desde el celular.

6. **Separación estricta de capas AR.** La capa WebGL (Three.js/MindAR: tracking, cámara, decorativos 3D) y la capa CSS3D (DOM real: paneles UI) son independientes y comparten cámara y ciclo de render. Mezclar lógica de ambas capas en un mismo componente está prohibido.

## Usuarios principales

**Estudiante de Docker (móvil)**: Abre la app desde el celular. Hace una pregunta al tutor. Apunta la cámara al image target. Ve la respuesta como paneles AR flotantes. Puede tocar un panel para enfocarlo, interactuar con quizzes, copiar comandos, ver diagramas animados.

## Fuera de alcance

- Multiusuario / colaboración en tiempo real.
- Autenticación y gestión de usuarios (v1 es stateless / sin auth).
- Contenido más allá de Docker (el sistema de RAG puede extenderse pero la v1 es Docker-only).
- Narración avanzada por componente (puede agregarse después — la arquitectura lo soporta, pero v1 no lo implementa).
- Deformación real de HTML sobre superficies curvas (la curvatura se simula con paneles planos en arco).
