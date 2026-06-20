'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type * as THREE from 'three';
import type { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';

export interface AcquisitionContext {
  camera: THREE.PerspectiveCamera;
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

        const { renderer, camera } = mindarInstance;

        const cssRenderer = new CSS3DRenderer();
        cssRenderer.setSize(container.offsetWidth, container.offsetHeight);
        cssRenderer.domElement.style.cssText =
          'position:absolute;top:0;left:0;pointer-events:none;z-index:2;';
        container.appendChild(cssRenderer.domElement);

        // Animation loop: relay anchor position for belt calibration.
        // CSS3D rendering is owned by ExplorationSphere (its own RAF).
        renderer.setAnimationLoop(() => {
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
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
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
