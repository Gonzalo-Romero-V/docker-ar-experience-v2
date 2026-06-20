'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type * as THREE from 'three';
import type { PanelRef } from '@/components/ar/hooks/useFocusController';

const PANEL_WIDTH = 400;
const PANEL_HEIGHT = 300;
const SCALE_FACTOR = 1 / 400;

interface SpatialPanelProps {
  scene: THREE.Scene;
  position: THREE.Vector3;
  rotationY: number;
  onMount?: (ref: PanelRef) => void;
  onUnmount?: () => void;
  children: ReactNode;
}

export function SpatialPanel({
  scene,
  position,
  rotationY,
  onMount,
  onUnmount,
  children,
}: SpatialPanelProps) {
  const panelElRef = useRef<HTMLDivElement | null>(null);
  const onMountRef = useRef(onMount);
  const onUnmountRef = useRef(onUnmount);
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    onMountRef.current = onMount;
    onUnmountRef.current = onUnmount;
  }, [onMount, onUnmount]);

  useEffect(() => {
    let active = true;
    let css3dObj: THREE.Object3D | null = null;

    const panelEl = document.createElement('div');
    panelEl.style.width = `${PANEL_WIDTH}px`;
    panelEl.style.height = `${PANEL_HEIGHT}px`;
    panelEl.style.pointerEvents = 'auto';
    panelEl.style.overflow = 'hidden';
    panelElRef.current = panelEl;

    (async () => {
      const { CSS3DObject } = await import(
        'three/addons/renderers/CSS3DRenderer.js'
      );

      if (!active) {
        panelEl.remove();
        return;
      }

      css3dObj = new CSS3DObject(panelEl);
      css3dObj.position.copy(position);
      css3dObj.rotation.y = rotationY;
      css3dObj.scale.setScalar(SCALE_FACTOR);

      scene.add(css3dObj);
      onMountRef.current?.({
        obj: css3dObj,
        el: panelEl,
        basePosition: position.clone(),
        baseScale: SCALE_FACTOR,
      });
      setPortalTarget(panelEl);
    })();

    return () => {
      active = false;
      setPortalTarget(null);

      if (css3dObj) {
        scene.remove(css3dObj);
      }

      panelEl.remove();
      panelElRef.current = null;
      onUnmountRef.current?.();
    };
  }, [scene, position, rotationY]);

  if (!portalTarget) {
    return null;
  }

  return createPortal(children, portalTarget);
}
