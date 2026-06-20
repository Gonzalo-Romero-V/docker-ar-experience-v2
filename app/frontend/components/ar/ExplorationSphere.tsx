'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type * as THREE from 'three';
import type { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { useDeviceOrientation } from './hooks/useDeviceOrientation';
import { computeBeltPositions, computeBeltPanelRotationY } from './utils/computeRadialPositions';
import { SpatialPanel } from './SpatialPanel';
import type { PanelRef } from './hooks/useFocusController';

interface ExplorationSphereProps {
  camera: THREE.PerspectiveCamera;
  cssRenderer: CSS3DRenderer;
  panels: ReactNode[];
  theta0: number;
  radius?: number;
  arcAngleDeg?: number;
}

export function ExplorationSphere({
  camera,
  cssRenderer,
  panels,
  theta0,
  radius = 0.8,
  arcAngleDeg = 270,
}: ExplorationSphereProps) {
  const { quaternionRef, isGranted, requestPermission } = useDeviceOrientation();
  const [explorationScene, setExplorationScene] = useState<THREE.Scene | null>(null);

  // Panel refs collected via SpatialPanel.onMount — used for GSAP tween on recalibration
  const panelRefsStorage = useRef<Array<PanelRef | null>>(
    new Array(panels.length).fill(null),
  );

  // Initial belt positions frozen at mount — props to SpatialPanel never change after mount
  // so the CSS3DObject lifecycle is not disrupted when theta0 updates.
  const theta0Initial = useRef(theta0);
  const panelPositions = useMemo(
    () => computeBeltPositions(panels.length, radius, theta0Initial.current, arcAngleDeg),
    [panels.length, radius, arcAngleDeg],
  );

  // Create the exploration scene and start its own RAF render loop.
  // This loop is independent of MindAR's WebGL loop.
  useEffect(() => {
    let active = true;
    let rafId = 0;

    void (async () => {
      const { Scene } = await import('three');
      if (!active) return;

      const scene = new Scene();
      setExplorationScene(scene);

      const animate = () => {
        // Drive camera orientation from device gyro
        if (quaternionRef.current) {
          camera.quaternion.copy(quaternionRef.current);
        }
        cssRenderer.render(scene, camera);
        rafId = requestAnimationFrame(animate);
      };
      animate();
    })();

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
      setExplorationScene(null);
    };
    // quaternionRef is a stable React ref — not a dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, cssRenderer]);

  // When theta0 changes (target re-detected at a new angle), GSAP tween to new positions.
  // We update CSS3DObject properties directly — bypassing SpatialPanel props — so React
  // doesn't tear down and re-mount the panels.
  useEffect(() => {
    if (!explorationScene || theta0 === theta0Initial.current) return;

    const newPositions = computeBeltPositions(panels.length, radius, theta0, arcAngleDeg);

    void import('gsap').then(({ gsap }) => {
      panelRefsStorage.current.forEach((ref, i) => {
        if (!ref?.obj || !newPositions[i]) return;
        const { x, y, z } = newPositions[i];
        const newRotY = computeBeltPanelRotationY(newPositions[i]);
        gsap.to(ref.obj.position, { x, y, z, duration: 0.8, ease: 'power2.out' });
        gsap.to(ref.obj.rotation, { y: newRotY, duration: 0.8, ease: 'power2.out' });
      });
    });
  }, [theta0, panels.length, radius, arcAngleDeg, explorationScene]);

  const handlePanelMount = useCallback((index: number, ref: PanelRef) => {
    panelRefsStorage.current[index] = ref;
  }, []);

  const handlePanelUnmount = useCallback((index: number) => {
    panelRefsStorage.current[index] = null;
  }, []);

  return (
    <>
      {/* iOS: permission must be requested from a user gesture */}
      {!isGranted && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
          <button
            className="rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm"
            onClick={() => void requestPermission()}
            type="button"
          >
            Habilitar sensor de orientación
          </button>
        </div>
      )}

      {/* CSS3DObjects added to explorationScene — portals into the Three.js scene */}
      {explorationScene &&
        panelPositions.map((position, i) => (
          <SpatialPanel
            key={i}
            scene={explorationScene}
            position={position}
            rotationY={computeBeltPanelRotationY(position)}
            onMount={(ref) => handlePanelMount(i, ref)}
            onUnmount={() => handlePanelUnmount(i)}
          >
            {panels[i]}
          </SpatialPanel>
        ))}
    </>
  );
}
