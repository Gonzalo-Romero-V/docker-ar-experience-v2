---
status: stable
type: decision
layer: H3
created: 2026-06-20
branch: feat/3dof-exploration
code_path: "app/frontend/components/ar/"
---

# AR Exploration Architecture — 3DoF Sensor Fusion

Decisión arquitectónica para la exploración espacial. Aprobada 2026-06-20.

## Stack elegido: MindAR + DeviceOrientationEvent

**Veredicto final después de evaluar todas las alternativas disponibles.**

### Alternativas investigadas y descartadas

| Alternativa | Estado 2026 | Veredicto |
|---|---|---|
| **8th Wall** | ❌ CERRADO. Edit access terminó Feb 28 2026. Proyectos hosted hasta Feb 2027 y después offline total. Niantic está open-sourcing el core pero aún no disponible. | No usar. |
| **WebXR Image Tracking** | ⚠️ Behind flag. `#webxr-incubations` requerido en Chrome Android. Draft spec, no producción sin configuración manual del usuario. | No viable para usuarios finales. |
| **WebXR Hit Test + Anchors** | ✅ Estable en Chrome Android. PERO: no tiene image tracking estable → no podemos detectar el QR sin flags. | SLAM sin imagen = no detecta QR. |
| **Blippar** | 💰 Comercial paid. | Fuera de scope educativo. |
| **Zappar Universal AR** | 💰 Free tier con watermark obligatorio. | Watermark = inviable para demo. |
| **AR.js** | Mantenimiento mínimo. Marker tracking con Aruco, no image targets modernos. | Stack viejo. |
| **MindAR + DeviceOrientation** | ✅ Free, MIT, sin flags, estable en Android Chrome. | **ELEGIDO.** |

Sources de investigación: [WebXR Image Tracking ChromeStatus](https://chromestatus.com/feature/6548327782940672) · [8th Wall shutdown](https://www.8thwall.com/blog/post/200208966730/next-chapter) · [WebXR 2026 BrowserStack](https://www.browserstack.com/guide/webxr-and-compatible-browsers)

---

## Objetivo confirmado (ver imagen de referencia 2)

```
Escenario físico:
  - QR/target impreso, plano, horizontal sobre la mesa
  - Estudiante sentado frente a la mesa, teléfono en mano

Escenario virtual:
  - Esfera centrada en EL ESTUDIANTE (no en el target)
  - Cinturón horizontal de paneles a altura de ojos
  - Paneles miran hacia adentro (normales hacia el centro = hacia el estudiante)
  - POV: desde dentro de la esfera mirando hacia afuera

Comportamiento:
  - Al detectar el QR: inicializa la esfera, ancla la dirección del panel 0
  - Al perder el QR: la esfera persiste, rotación horizontal sigue funcionando
  - Al re-detectar el QR: recalibra la orientación del cinturón
```

**El target no es el centro. El target define la dirección "home" del cinturón.**

---

## Modelo matemático correcto

### Sistema de coordenadas MindAR

En MindAR THREE:
- La **cámara** está en el **origen del mundo** `(0, 0, 0)` — fija, no se mueve.
- El **anchor.group** se mueve en el espacio mundial para representar la posición del target.
- `anchor.group.position` = posición del target en el sistema de coordenadas del mundo.
- `camera.quaternion` = identidad por defecto (MindAR no lo toca). → Podemos controlarlo.

### Posiciones del cinturón

```
Cámara (estudiante) en: C = (0, 0, 0)   [origen del mundo]
Target detectado en:    T = anchor.group.position  (varía con la detección)

Dirección hacia el target (plano horizontal):
  d = normalize(T.x, 0, T.z)

Ángulo θ₀ del panel "home" (apuntando al target):
  θ₀ = atan2(d.x, d.z)     ← panel 0 en la misma dirección que T

Posición del panel i:
  θᵢ = θ₀ + i × (2π / N)
  Pᵢ = R × (sin(θᵢ), 0, cos(θᵢ))

Panel i mira al centro (normal inward):
  rotationY = atan2(Pᵢ.x, Pᵢ.z)   [= θᵢ — ya apunta hacia fuera]
  → lookAt(0, 0, 0) equivale a rotationY = θᵢ + π  (cara frontal mira inward)
```

### Exploración con DeviceOrientationEvent

```typescript
// Quaternion de la cámara desde sensor:
euler.set(
  THREE.MathUtils.degToRad(beta  ?? 0),
  THREE.MathUtils.degToRad(alpha ?? 0),
  -THREE.MathUtils.degToRad(gamma ?? 0),
  'YXZ'
);
camera.quaternion.setFromEuler(euler);

// Delta desde el lock (para evitar jump al iniciar):
//   Q_display = Q_current × Q_locked⁻¹ × Q_locked_camera
//   En práctica: guardar offset en el primer frame de exploración.
```

### Calibración de radio en metros

MindAR no entrega metros. Aproximación por parámetro de configuración:

```
physicalTargetWidthCm: number  (default: 10)
targetPixelWidth: número de píxeles del .mind compilado

scaleFactor = physicalTargetWidthCm / (100 × targetPixelWidth × MindARscaleUnknown)
R_sceneUnits = 0.8   // empírico, calibrar en dispositivo real
```

El parámetro `physicalTargetWidthCm` se expone en `ExperienceClient` para ajuste.

---

## Flujo de estados (3DoF fusion)

```
SCANNING
  ├── MindAR activo, video feed visible
  ├── Indicador: "Apuntá la cámara al QR de Docker 🎯"
  └── onTargetFound → ACQUIRED

ACQUIRED
  ├── Capturar: anchor.group.position → θ₀ inicial
  ├── Crear exploration scene con N CSS3DObjects en posiciones del cinturón
  ├── Solicitar DeviceOrientationEvent (Android: automático; iOS: pedir permiso con botón)
  ├── Toast: "Esfera lista — girá el teléfono para explorar"
  └── primer frame de orientación recibido → EXPLORING

EXPLORING
  ├── Cada frame:
  │   ├── Si anchor.group.visible: copiar anchor.group.position → actualizar θ₀ (suave)
  │   └── Actualizar camera.quaternion desde DeviceOrientationEvent
  ├── CSS3DRenderer renderiza exploration scene con esa cámara
  ├── Paneles en world space fijos (no se mueven con cámara, sí con δθ₀)
  └── onTargetLost → no cambia el estado; θ₀ queda congelado en último valor válido

RECALIBRATING  (subtransición dentro de EXPLORING)
  ├── Se vuelve a detectar el target
  ├── Nuevo anchor.group.position → nuevo θ₀
  ├── GSAP: tween de posiciones del cinturón al nuevo θ₀
  └── Vuelve a EXPLORING sin interrupción visual
```

---

## Arquitectura de rendering

```
container (position:relative, h-dvh)
  ├── <video>   (MindAR camera feed — z-index 0) [siempre visible]
  ├── <canvas>  (WebGL WebGLRenderer — z-index 1) [mínimo: solo tracking]
  └── <div>     (CSS3DRenderer — z-index 2, pointer-events:none)
       └── CSS3DObjects en explorationScene [no en anchor.group ni cssScene]
```

**CSS3DObjects están en `explorationScene` (nuestra escena), NO en el anchor.group de MindAR.**
Esto desacopla los paneles del lifecycle del anchor (MindAR no los oculta al perder tracking).

MindAR WebGL scene (arScene) no necesita nada — solo sirve para que MindAR corra
el tracker y exponga `anchor.group.position` (que leemos cada frame).

---

## Componentes a crear

| Componente | Responsabilidad |
|---|---|
| `ARShell.tsx` (refactor) | MindAR init + video + anchor tracking. Expone `onAcquired(anchorPosition)`. Solo scanning — sin CSS3D. |
| `ExplorationSphere.tsx` (nuevo) | Crea explorationScene + CSS3DObjects en posiciones del cinturón. Recibe `camera`, `cssRenderer`, `panels`, `radius`, `physicalTargetWidthCm`. |
| `useDeviceOrientation.ts` (nuevo) | DeviceOrientationEvent con manejo de permisos iOS. Devuelve `quaternion`, `requestPermission`, `isGranted`. |
| `useBeltCalibration.ts` (nuevo) | Mantiene θ₀ actual + smooth update cuando anchor recalibra. |
| `SpatialPanel.tsx` (refactor menor) | Recibe `group: THREE.Group` en vez de `scene: THREE.Scene`. |

---

## Lo que NO cambia respecto a main

- Backend RAG, `/ask`, schema LLM, base de datos — igual.
- Componentes pedagógicos (ConceptCard, MiniQuiz, etc.) — igual.
- Stack (Next.js 16, shadcn, Tailwind, Three.js) — igual.
- HTTPS / mkcert — igual.
- `stubs/three-compat.js` y `stubs/node-fetch.js` — igual.
- El `.mind` target compilado — igual.
