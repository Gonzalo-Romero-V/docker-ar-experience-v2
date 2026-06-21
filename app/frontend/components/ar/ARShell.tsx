'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type * as THREE from 'three';
import type { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';

export interface AcquisitionContext {
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  cssRenderer: CSS3DRenderer;
  anchorPosition: THREE.Vector3;
}

type ARStatus = 'idle' | 'loading' | 'scanning' | 'acquired' | 'error';

interface ARShellProps {
  imageSrc: string;
  onAcquired: (ctx: AcquisitionContext) => void;
  onTargetUpdate?: (position: THREE.Vector3, visible: boolean) => void;
  children?: ReactNode;
}

export function ARShell({ imageSrc, onAcquired, onTargetUpdate, children }: ARShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [arStatus, setArStatus] = useState<ARStatus>('idle');

  // Stable callback refs — updated every render, never stale in the animation loop
  const onAcquiredRef = useRef(onAcquired);
  const onTargetUpdateRef = useRef(onTargetUpdate);
  useEffect(() => { onAcquiredRef.current = onAcquired; });
  useEffect(() => { onTargetUpdateRef.current = onTargetUpdate; });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let active = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mindarInstance: any = null;
    // Mutable anchor ref — available to the animation loop after addAnchor() resolves
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anchorRef: { current: any } = { current: null };

    setArStatus('loading');

    void (async () => {
      try {
        const [{ MindARThree }, { CSS3DRenderer }, THREE] = await Promise.all([
          import('mind-ar/dist/mindar-image-three.prod.js'),
          import('three/addons/renderers/CSS3DRenderer.js'),
          import('three'),
        ]);

        if (!active) return;

        mindarInstance = new MindARThree({
          container,
          imageTargetSrc: imageSrc,
          uiLoading: 'no',
          uiScanning: 'no',
          uiError: 'no',
        });

        const { renderer, scene: arScene, camera } = mindarInstance as {
          renderer: THREE.WebGLRenderer;
          scene: THREE.Scene;
          camera: THREE.PerspectiveCamera;
        };

        const cssRenderer = new CSS3DRenderer();
        cssRenderer.setSize(container.offsetWidth, container.offsetHeight);
        cssRenderer.domElement.style.cssText =
          'position:absolute;top:0;left:0;pointer-events:none;z-index:2;';
        container.appendChild(cssRenderer.domElement);

        // Render the (empty) AR scene each frame so the WebGL canvas is cleared
        // to transparent — video feed shows through underneath.
        // Anchor position is relayed to ExplorationSphere for belt calibration.
        renderer.setAnimationLoop(() => {
          renderer.render(arScene, camera);
          if (anchorRef.current) {
            onTargetUpdateRef.current?.(
              anchorRef.current.group.position.clone(),
              anchorRef.current.group.visible,
            );
          }
        });

        await mindarInstance.start();

        if (!active) {
          await mindarInstance.stop();
          cssRenderer.domElement.remove();
          return;
        }

        // After start() the layout is stable — re-measure and apply full-screen CSS.
        // MindAR defaults to object-fit:contain (black bars) and z-index:-2 on video.
        // Canvas has no explicit position — both must be forced to fill 100%.
        const w = container.offsetWidth;
        const h = container.offsetHeight;

        const videoEl = container.querySelector('video');
        if (videoEl) {
          (videoEl as HTMLElement).style.cssText =
            'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;';
        }
        renderer.domElement.style.cssText =
          'position:absolute;inset:0;width:100%;height:100%;z-index:1;';

        // Resize CSS3DRenderer to the actual container size (was set before start() when
        // the layout might not have been finalised on mobile).
        cssRenderer.setSize(w, h);
        cssRenderer.domElement.style.cssText =
          'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;';

        setArStatus('scanning');

        const anchor = mindarInstance.addAnchor(0);
        anchor.group.add(new THREE.Object3D());
        anchorRef.current = anchor;

        let acquired = false;
        anchor.onTargetFound = () => {
          if (!acquired) {
            acquired = true;
            setArStatus('acquired');
            onAcquiredRef.current({
              camera,
              renderer,
              cssRenderer,
              anchorPosition: anchor.group.position.clone(),
            });
          }
        };
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
      setArStatus('idle');
    };
  }, [imageSrc]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {arStatus === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-3 text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <p className="text-sm">Iniciando cámara...</p>
          </div>
        </div>
      )}
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
      {children}
    </div>
  );
}
