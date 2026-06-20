---
status: stable
type: domain
layer: H2
created: 2026-06-20
code_path: "app/frontend/components/ar/"
---

# AR System — Docker AR Tutor

Sistema de realidad aumentada que proyecta componentes React reales como paneles DOM en espacio 3D alrededor del image target.

## Dos capas sincronizadas

### Capa WebGL (Three.js)
- Renderer: `THREE.WebGLRenderer` provisto por MindAR
- Responsabilidades: escena, cámara, anchor tracking, decorativos (whale, partículas, anillos)
- NO renderiza UI real — solo elementos 3D geométricos

### Capa CSS3D (CSS3DRenderer)
- Renderer: `THREE.CSS3DRenderer` superpuesto sobre el canvas WebGL
- Responsabilidades: paneles DOM reales posicionados en espacio 3D
- Comparte la misma `THREE.PerspectiveCamera` que la capa WebGL
- Renderiza componentes React reales via `createPortal`

## Integración MindAR + CSS3DRenderer

### Setup mínimo (patrón canónico)

```typescript
const mindarThree = new MindARThree({ container, imageTargetSrc });
const { renderer, scene, camera } = mindarThree;

// Crear CSS3DRenderer usando la misma cámara
const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(container.offsetWidth, container.offsetHeight);
cssRenderer.domElement.style.cssText = `
  position: absolute; top: 0; left: 0; pointer-events: none;
`;
container.appendChild(cssRenderer.domElement);

// Hook CSS render en el loop de MindAR
renderer.setAnimationLoop(() => {
  cssRenderer.render(scene, camera);
});

await mindarThree.start();
```

### Stacking DOM correcto

```
container (position: relative, overflow: hidden)
  ├── <video>   (MindAR camera feed, z-index: 0)
  ├── <canvas>  (WebGL Three.js, z-index: 1)
  └── <div>     (CSS3DRenderer container, z-index: 2, pointer-events: none)
       └── panels (matrix3d transformed, pointer-events: auto individualmente)
```

## Montar React components en CSS3DObjects

Usar `createPortal` (NO `createRoot`). Razón: `createPortal` mantiene el elemento como parte del árbol React principal, preservando todos los providers (Zustand, React Query, Tailwind, shadcn). `createRoot` crearía un árbol aislado sin contextos.

```typescript
// Patrón de panel espacial
const panelEl = document.createElement('div');
panelEl.style.cssText = 'width: 400px; height: 300px; pointer-events: auto;';

const css3dObj = new CSS3DObject(panelEl);
css3dObj.position.set(x, y, z);
css3dObj.scale.setScalar(SCALE_FACTOR); // CRÍTICO: ver sección de escala
scene.add(css3dObj);

// En React: renderizar componente real en el elemento DOM
createPortal(<ConceptCard {...props} />, panelEl);
```

## Constraints de diseño fundamentales (no negociables)

### 1. Escala CSS3DObject
CSS3DObject asume 1 unidad Three.js = 1 pixel CSS. Un panel de 400px sin calibrar = 400 unidades Three.js en la escena — enorme. Solución: `css3dObj.scale.setScalar(SCALE_FACTOR)` y calibrar empíricamente. Valor de referencia v1: `37.7 px = 1 metro a scale 1`.

### 2. Oclusión imposible — constraint de diseño aceptado
CSS3DObjects no participan del depth buffer WebGL. El DOM siempre aparece visualmente encima del canvas WebGL. Los objetos 3D decorativos (whale, partículas) **nunca pueden pasar por delante de los paneles**. Esto es un límite fundamental del browser, sin workaround real. El diseño debe asumir que los paneles están siempre en primer plano.

### 3. pointer-events
```css
/* Container CSS3DRenderer: sin eventos (deja pasar al canvas WebGL) */
.css3d-container { pointer-events: none; }
/* Cada panel: con eventos para touch/click/scroll */
.spatial-panel   { pointer-events: auto; }
```

### 4. GSAP anima propiedades Three.js, NO CSS directo
GSAP debe animar `css3dObj.position`, `css3dObj.rotation`, `css3dObj.scale` (objetos Three.js). CSS3DRenderer sobreescribe el `transform` CSS del DOM en cada frame. Animar el CSS directamente no tiene efecto duradero.

```typescript
// CORRECTO
gsap.to(css3dObj.position, { x: targetX, duration: 0.4, ease: 'power2.out' });
// INCORRECTO — CSS3DRenderer lo sobreescribe
gsap.to(panelEl, { x: targetX, duration: 0.4 });
```

### 5. No usar backdrop-filter en iOS Safari
`backdrop-filter: blur()` no funciona en WebKit dentro de CSS3DObjects. El diseño de paneles no puede depender de blur de fondo. Usar colores sólidos semitransparentes en su lugar.

### 6. No usar position: fixed dentro de paneles
`position: fixed` no funciona dentro de CSS3DObjects en ningún browser (containing block issue). Usar `position: absolute` relativo al panel.

## Board espacial: distribución radial (cine curvo simulado)

El board AR es un arco de N paneles planos, NO una superficie curva continua.

```
         [Panel 1]
   
[Panel 0]  [Centro]  [Panel 2]
   
         [Panel 3]
```

### Matemática de distribución radial

```typescript
function computeRadialPositions(
  count: number,
  radius: number,
  arcAngleDeg: number,
  yOffset: number,
  depth: number
): THREE.Vector3[] {
  const arcRad = (arcAngleDeg * Math.PI) / 180;
  const startAngle = -arcRad / 2;
  
  return Array.from({ length: count }, (_, i) => {
    const angle = count === 1 
      ? 0 
      : startAngle + (i / (count - 1)) * arcRad;
    return new THREE.Vector3(
      Math.sin(angle) * radius,
      yOffset,
      depth - Math.cos(angle) * radius
    );
  });
}

// Cada panel mira al origen (donde está el usuario)
// css3dObj.lookAt(new THREE.Vector3(0, 0, 0));
// O con Three.js: calcular rotación para orientar hacia cámara
```

### Parámetros de partida (calibrar en dispositivo real)
- `radius`: 0.6–1.0 unidades
- `arcAngleDeg`: 120–180° para sensación de "cine curvo"
- Orientación: cada panel rota para mirar al origen del anchor
- Máximo de paneles visibles: 5–7 (más = crowded en mobile)

## Focus system

```
Estado: overview
  ├── Todos los paneles: scale = 1.0, opacity = 0.8
  └── distribución radial completa

Evento: tap en panel N
  ├── Panel N: scale ×1.3, se acerca (z += offset), opacity = 1.0
  ├── Demás paneles: opacity = 0.35, scale ligeramente reducido
  └── GSAP anima todas las transiciones

Evento: tap fuera o botón back
  └── Vuelve a estado: overview (GSAP reverse)
```

Los cambios de opacity en CSS3DObjects se aplican al elemento DOM (CSS `opacity`), no via Three.js material (que no existe en CSS3D).

## Compatibilidad de browsers

| Feature | iOS Safari | Chrome Android |
|---------|-----------|----------------|
| getUserMedia (cámara) | iOS 11+ ✓ | ✓ |
| CSS matrix3d | iOS 9+ ✓ | ✓ |
| CSS3DRenderer | ✓ (sin backdrop-filter) | ✓ completo |
| Touch events en panels | ✓ | ✓ |
| Scroll dentro de panels | iOS 15+ ✓ | ✓ |
| WebXR AR | ✗ NO | ✓ (no lo usamos) |

## Integración con Next.js 15 App Router

Toda la lógica AR es `client only`. El ARShell se importa con `dynamic(..., { ssr: false })`.

```typescript
// app/experience/page.tsx (server component)
const ARShell = dynamic(() => import('@/components/ar/ARShell'), {
  ssr: false,
  loading: () => <LoadingScreen />,
});
```

```typescript
// components/ar/ARShell.tsx
'use client';
// Imports de Three.js y MindAR son dinámicos dentro de useEffect
// para evitar errores de SSR con window/document
```

MindAR y CSS3DRenderer se importan dinámicamente dentro de `useEffect`:

```typescript
useEffect(() => {
  let active = true;
  (async () => {
    const [{ MindARThree }, { CSS3DRenderer, CSS3DObject }] = await Promise.all([
      import('mind-ar/dist/mindar-image-three.prod.js'),
      import('three/addons/renderers/CSS3DRenderer.js'),
    ]);
    if (!active) return;
    // init AR scene...
  })();
  return () => { active = false; /* cleanup */ };
}, []);
```

## Lecciones de la versión 1 (no repetir)

1. **CanvasTexture para UI**: NO. Solucionado con CSS3DRenderer.
2. **Magic numbers de posición**: NO. Usar `computeRadialPositions()` o equivalente matemático.
3. **Raycaster para click detection**: NO necesario. CSS3DObjects reciben eventos DOM nativos.
4. **Dos implementaciones separadas (MindAR + R3F sin integrar)**: NO. Una sola escena con MindAR + CSS3DRenderer.
5. **R3F para la escena AR con MindAR**: NO viable sin hacking. MindAR crea su propio renderer; R3F también. Conflictan. R3F solo para la escena fallback/preview sin cámara real.

## Three.js version pinning

`mind-ar@1.2.5` importa `sRGBEncoding` (removido en Three.js r153). Con `three@0.184.0` (r184) se necesita el stub:

```javascript
// stubs/three-compat.js
export * from 'three/src/Three.js';
export const sRGBEncoding = 3001; // valor legacy, compatibilidad mind-ar
```

Y en `next.config.ts`:
```typescript
turbopack: {
  resolveAlias: {
    three: './stubs/three-compat.js',
    fs: { browser: './stubs/empty.js' }, // TF.js dentro de mind-ar
  }
}
```

## Nota de rama — feat/3dof-exploration
En la rama `feat/3dof-exploration`, la distribución radial (Board Radial) y el
anchor tracking continuo están siendo **reemplazados** por `ExplorationSphere`
+ DeviceOrientationEvent. Ver [[ar-exploration]] para la decisión completa,
la matemática del cinturón 3DoF y el flujo de estados.

Esta nota sigue siendo válida para `main` (enfoque CSS anchor).
En `feat/3dof-exploration`, las secciones "Board espacial" y "Focus system"
aún aplican a los componentes pedagógicos pero **no** al sistema de posicionamiento AR.

Componentes nuevos en esta rama:
- `ExplorationSphere.tsx` — cinturón 3DoF (reemplaza SpatialBoard para AR)
- `hooks/useDeviceOrientation.ts` — sensor hook
- `hooks/useBeltCalibration.ts` — gestión de θ₀
