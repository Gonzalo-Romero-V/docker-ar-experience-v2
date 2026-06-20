## Task: 3DoF sphere exploration — MindAR + DeviceOrientation
## Status: pending
## Evaluator: manual device test (Android Chrome)
## Branch: feat/3dof-exploration

### Context

Ver `vault/decisions/ar-exploration.md` para la decisión completa.

El stack actual (MindAR CSS anchor) no permite navegación después de perder el target.
Esta tarea reemplaza la arquitectura de AR de la rama `feat/3dof-exploration`.

**Modelo correcto:**
- La cámara Three.js está en el ORIGEN del mundo (MindAR no mueve la cámara).
- `anchor.group.position` = posición del target en el mundo.
- El cinturón de paneles rodea la CÁMARA (el estudiante) a radio R.
- `θ₀` se calcula desde la dirección del target al detectarse.
- `camera.quaternion` se controla con DeviceOrientationEvent (MindAR no lo toca).
- Los CSS3DObjects están en `explorationScene` (independiente de MindAR).

### Scope — archivos a modificar/crear

**Modificar:**
- `app/frontend/components/ar/ARShell.tsx` — refactor completo
- `app/frontend/components/ar/SpatialPanel.tsx` — prop `group: THREE.Group` en vez de `scene`
- `app/frontend/components/ar/SpatialBoard.tsx` — prop `group` + pasa a SpatialPanel
- `app/frontend/components/ar/utils/computeRadialPositions.ts` — nueva función de cinturón
- `app/frontend/app/experience/ExperienceClient.tsx` — wiring nuevo
- `app/frontend/types/mind-ar.d.ts` — agregar `addCSSAnchor` y `cssScene`

**Crear:**
- `app/frontend/components/ar/ExplorationSphere.tsx` — cinturón 3DoF principal
- `app/frontend/components/ar/hooks/useDeviceOrientation.ts` — sensor hook
- `app/frontend/components/ar/hooks/useBeltCalibration.ts` — θ₀ management

### Acceptance criteria

- [ ] El QR se detecta y activa la esfera (paneles aparecen en el cinturón).
- [ ] Rotar el teléfono horizontalmente mueve los paneles (panel 0 siempre apunta al QR inicial).
- [ ] Al dejar de ver el QR, los paneles NO desaparecen.
- [ ] La rotación horizontal sigue funcionando sin el QR visible.
- [ ] Al volver a ver el QR, los paneles se reposicionan suavemente (GSAP tween).
- [ ] `tsc --noEmit` pasa sin errores.

---

### FASE 1 — ARShell.tsx (refactor)

**Objetivo:** ARShell solo maneja MindAR + video. Sin CSS3D. Sin paneles.

**Nueva API:**
```typescript
interface ARShellProps {
  imageSrc: string;
  onAcquired: (ctx: AcquisitionContext) => void;
  onTargetUpdate: (position: THREE.Vector3, visible: boolean) => void;
  children?: ReactNode;  // overlay UI (scanning indicator, etc.)
}

interface AcquisitionContext {
  camera: THREE.PerspectiveCamera;
  cssRenderer: CSS3DRenderer;
  anchorPosition: THREE.Vector3;  // target world position at detection
}
```

**Pseudocódigo:**
```typescript
// En useEffect:
const mindarInstance = new MindARThree({ container, imageTargetSrc: imageSrc, ... });
const { renderer, scene: arScene, camera } = mindarInstance;

// CSS3DRenderer — para explorationScene, no para arScene
const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(container.offsetWidth, container.offsetHeight);
cssRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:2;';
container.appendChild(cssRenderer.domElement);

const anchor = mindarInstance.addAnchor(0);
anchor.group.add(new Object3D()); // mantener anchor activo

anchor.onTargetFound = () => {
  onAcquired({
    camera,
    cssRenderer,
    anchorPosition: anchor.group.position.clone(),
  });
};

// Cada frame: reportar posición del anchor (para recalibración)
renderer.setAnimationLoop(() => {
  onTargetUpdate(anchor.group.position.clone(), anchor.group.visible);
});

await mindarInstance.start();
setArStatus('scanning');
```

**Nota:** `anchor.group.position` solo es válida cuando `anchor.group.visible === true`.

---

### FASE 2 — useDeviceOrientation.ts (nuevo)

```typescript
export interface DeviceOrientationState {
  quaternion: THREE.Quaternion;
  isGranted: boolean;
  requestPermission: () => Promise<void>;  // iOS requiere gesto del usuario
}

export function useDeviceOrientation(): DeviceOrientationState {
  // 1. En Android Chrome: DeviceOrientationEvent no requiere permiso.
  //    Suscribirse directamente en useEffect.
  // 2. En iOS Safari 13+: DeviceOrientationEvent.requestPermission() requerido.
  //    Exponer requestPermission() para ser llamado desde un botón.
  
  // Conversión alpha/beta/gamma → quaternion THREE.js:
  // Las convenciones de eje del sensor dependen de la orientación del teléfono.
  // Para teléfono vertical (portrait, β≈90°) apuntando al frente:
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(beta),
    THREE.MathUtils.degToRad(alpha),
    -THREE.MathUtils.degToRad(gamma),
    'YXZ'
  );
  const q = new THREE.Quaternion().setFromEuler(euler);
  
  // Retornar el quaternion como estado React (useRef para evitar re-renders).
}
```

**Detección de plataforma:**
```typescript
const needsPermission =
  typeof DeviceOrientationEvent !== 'undefined' &&
  typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
    .requestPermission === 'function';
```

---

### FASE 3 — useBeltCalibration.ts (nuevo)

```typescript
export interface BeltCalibration {
  theta0: number;         // ángulo del panel 0 (hacia el target)
  updateFromAnchor: (position: THREE.Vector3) => void;  // llamar cuando anchor visible
}

export function useBeltCalibration(): BeltCalibration {
  // theta0 = atan2(position.x, position.z) cuando el anchor es visible
  // En EXPLORING: solo actualizar si la posición cambia >5° (evitar jitter)
  // Cambios de theta0 → GSAP tween en ExplorationSphere
}
```

---

### FASE 4 — computeRadialPositions.ts (actualizar)

Agregar función para cinturón:

```typescript
export function computeBeltPositions(
  count: number,
  radius: number,
  theta0: number = 0,   // ángulo del panel 0 (rad)
  arcAngleDeg: number = 360,  // 360 = cinturón completo; 270 = arco visible
): THREE.Vector3[] {
  const arcRad = (arcAngleDeg * Math.PI) / 180;
  const startTheta = theta0 - arcRad / 2;
  
  return Array.from({ length: count }, (_, i) => {
    const theta = count === 1
      ? theta0
      : startTheta + (i / (count - 1)) * arcRad;
    return new THREE.Vector3(
      radius * Math.sin(theta),
      0,   // altura de ojos = misma cámara Y = 0 en world space
      radius * Math.cos(theta),
    );
  });
}

// Rotación para que el panel mire al origen (normal inward):
export function computeBeltPanelRotationY(theta: number): number {
  // El panel apunta hacia afuera en dirección theta
  // Para mirar hacia adentro (al origen): rotar 180°
  return theta + Math.PI;
}
```

---

### FASE 5 — ExplorationSphere.tsx (nuevo)

```typescript
interface ExplorationSphereProps {
  camera: THREE.PerspectiveCamera;
  cssRenderer: CSS3DRenderer;
  panels: ReactNode[];
  radius?: number;              // default: 0.8 (scene units, calibrar en device)
  arcAngleDeg?: number;         // default: 270
  physicalTargetWidthCm?: number; // default: 10; para info, no afecta cálculo actual
  theta0: number;               // del useBeltCalibration
}
```

**Lógica:**
1. `useEffect` de montaje: crear `explorationScene = new THREE.Scene()`, crear N CSS3DObjects,
   agregarlos a `explorationScene`, arrancar animation loop.
2. `useEffect([theta0])`: cuando θ₀ cambia, GSAP tween de posiciones de los CSS3DObjects.
3. Cada frame en `setAnimationLoop`:
   ```typescript
   camera.quaternion.copy(deviceOrientationQuaternion);
   cssRenderer.render(explorationScene, camera);
   ```
4. CSS3DObjects: crear con `createPortal(<Panel />, panelEl)` igual que antes.
5. Panel orientation: `css3dObj.rotation.y = computeBeltPanelRotationY(thetaI)`.

**Nota sobre el animation loop:** `ExplorationSphere` se monta DESPUÉS de `onAcquired`.
MindAR ya tiene su propio `setAnimationLoop` corriendo. Podemos inyectar nuestro render
dentro del mismo loop, o usar `requestAnimationFrame` directamente. Para evitar conflicto:
inyectar CSS3D render dentro del loop existente de MindAR via `renderer.setAnimationLoop`
que ya está configurado en `ARShell`.

**Alternativa limpia:** `ARShell` acepta `onAnimationFrame` callback y lo llama dentro
de `renderer.setAnimationLoop`. `ExplorationSphere` pasa `(camera) => cssRenderer.render(explorationScene, camera)`.

---

### FASE 6 — ExperienceClient.tsx (wiring)

```typescript
const [acquisitionCtx, setAcquisitionCtx] = useState<AcquisitionContext | null>(null);
const [theta0, setTheta0] = useState(0);
const { updateFromAnchor } = useBeltCalibration({ onTheta0Change: setTheta0 });

return (
  <div className="relative h-dvh w-full">
    {/* Summary bar */}
    <div className="absolute inset-x-0 top-0 z-20 ...">...</div>

    {/* AR Shell — scanning + video */}
    <ARShell
      imageSrc="/targets/docker-target.mind"
      onAcquired={(ctx) => setAcquisitionCtx(ctx)}
      onTargetUpdate={(pos, visible) => {
        if (visible) updateFromAnchor(pos);
      }}
    >
      {/* Scanning indicator overlay */}
      {!acquisitionCtx && (
        <div className="absolute inset-x-0 bottom-12 z-10 text-center text-white">
          Apuntá la cámara al QR de Docker 🎯
        </div>
      )}
    </ARShell>

    {/* Exploration sphere — se monta cuando hay adquisición */}
    {acquisitionCtx && (
      <ExplorationSphere
        camera={acquisitionCtx.camera}
        cssRenderer={acquisitionCtx.cssRenderer}
        panels={panels}
        theta0={theta0}
        radius={0.8}
        arcAngleDeg={270}
      />
    )}
  </div>
);
```

---

### Do NOT

- No agregar objetos a `anchor.group` (solo servía para CSS anchor, ese enfoque falló).
- No usar `addCSSAnchor` — los paneles van en `explorationScene`, no en `cssScene` de MindAR.
- No intentar congelar/freeze la matriz del anchor (evaluado y rechazado en task 011).
- No modificar `camera.projectionMatrix` (lo maneja MindAR).
- No usar `scene.add(css3dObj)` — usar `explorationScene.add(css3dObj)`.
- No animar CSS directamente (CSS3DRenderer lo sobreescribe cada frame).
- No pedir permiso de DeviceOrientation sin un gesto del usuario (iOS requiere esto).
- No hacer `mindarInstance.stop()` hasta que el usuario navegue fuera de /experience.

### Pattern reference

`SpatialPanel.tsx` actual muestra el patrón correcto para CSS3DObjects + createPortal.
La diferencia en la nueva versión: recibe `group: THREE.Group` en vez de `scene`.
En ExplorationSphere la "scene" cumple ese rol.

### Notas de calibración (post-implementación)

Una vez funcionando en dispositivo, ajustar empíricamente:
- `radius`: comenzar con 0.8 (mismo order que antes); aumentar si paneles se ven muy cerca.
- `arcAngleDeg`: 270° deja libre el sector "detrás" del estudiante.
- `PANEL_WIDTH / PANEL_HEIGHT`: 400×300px, SCALE_FACTOR=1/400.
- Para `physicalTargetWidthCm`: cuando se mide el target impreso → refinar radio.
