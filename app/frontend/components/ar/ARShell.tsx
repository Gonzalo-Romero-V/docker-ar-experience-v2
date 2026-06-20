'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type ARStatus = 'idle' | 'loading' | 'tracking' | 'error';

interface ARShellProps {
  /** Path to the compiled .mind image target (e.g. /targets/docker.mind) */
  imageSrc: string;
  /** Content to show in overview while AR is loading */
  loadingSlot?: ReactNode;
  /** Rendered inside the AR scene once tracking starts — receives the THREE.Scene */
  children: (scene: import('three').Scene) => ReactNode;
}

/**
 * Initializes MindAR + CSS3DRenderer, runs the AR loop, and exposes the THREE.Scene
 * to children via render prop. All AR lib imports are dynamic (SSR-safe).
 *
 * Stacking (see vault/domain/ar-system.md):
 *   container (position:relative)
 *   ├── <video>  (z-index 0, MindAR camera feed)
 *   ├── <canvas> (z-index 1, WebGL Three.js)
 *   └── <div>    (z-index 2, CSS3DRenderer — pointer-events:none)
 *        └── panels (pointer-events:auto individually)
 */
export function ARShell({ imageSrc, loadingSlot, children }: ARShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [arStatus, setArStatus] = useState<ARStatus>('idle');
  const [scene, setScene] = useState<import('three').Scene | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let active = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mindarInstance: any = null;

    setArStatus('loading');

    (async () => {
      try {
        const [{ MindARThree }, { CSS3DRenderer }] = await Promise.all([
          import('mind-ar/dist/mindar-image-three.prod.js'),
          import('three/addons/renderers/CSS3DRenderer.js'),
        ]);

        if (!active) return;

        mindarInstance = new MindARThree({
          container,
          imageTargetSrc: imageSrc,
          uiLoading: 'no',
          uiScanning: 'no',
          uiError: 'no',
        });

        const { renderer, scene: arScene, camera } = mindarInstance;

        // CSS3DRenderer shares the same camera — overlaid on the WebGL canvas
        const cssRenderer = new CSS3DRenderer();
        cssRenderer.setSize(container.offsetWidth, container.offsetHeight);
        cssRenderer.domElement.style.cssText =
          'position:absolute;top:0;left:0;pointer-events:none;z-index:2;';
        container.appendChild(cssRenderer.domElement);

        // Hook CSS render into MindAR's animation loop
        renderer.setAnimationLoop(() => {
          cssRenderer.render(arScene, camera);
        });

        await mindarInstance.start();

        if (!active) {
          await mindarInstance.stop();
          cssRenderer.domElement.remove();
          return;
        }

        // Anchor 0 — first (and only) image target
        const anchor = mindarInstance.addAnchor(0);
        anchor.group.add(new (await import('three')).Object3D()); // keep anchor active

        setScene(arScene);
        setArStatus('tracking');
      } catch (err) {
        if (active) {
          console.error('[ARShell] init failed', err);
          setArStatus('error');
        }
      }
    })();

    return () => {
      active = false;
      if (mindarInstance) {
        mindarInstance.stop().catch(() => {});
      }
      setScene(null);
      setArStatus('idle');
    };
  }, [imageSrc]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
      {/* Loading overlay */}
      {arStatus === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
          {loadingSlot ?? (
            <div className="flex flex-col items-center gap-3 text-white">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <p className="text-sm">Iniciando cámara...</p>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {arStatus === 'error' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/90 p-8 text-center text-white">
          <div className="space-y-2">
            <p className="text-lg font-semibold">No se pudo iniciar la cámara</p>
            <p className="text-sm text-white/60">
              Asegurate de dar permisos de cámara y usar HTTPS.
            </p>
          </div>
        </div>
      )}

      {/* Scanning hint */}
      {arStatus === 'tracking' && !scene && (
        <div className="absolute inset-x-0 bottom-12 z-10 text-center text-sm text-white/80">
          Apuntá la cámara al image target 🎯
        </div>
      )}

      {/* AR content — only when scene is ready */}
      {scene && children(scene)}
    </div>
  );
}
