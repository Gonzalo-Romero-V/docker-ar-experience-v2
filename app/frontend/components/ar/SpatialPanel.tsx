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

    // Outer shell: no overflow clip so CSS3D 3D transform doesn't detach shadows.
    // Visual chrome is on an inner wrapper to stay within the painted area.
    const panelEl = document.createElement('div');
    panelEl.style.cssText =
      `width:${PANEL_WIDTH}px;height:${PANEL_HEIGHT}px;pointer-events:auto;`;

    // Inner wrapper: all visual styling lives here so effects stay within bounds.
    // box-shadow is intentionally avoided — it detaches under CSS3D perspective.
    const inner = document.createElement('div');
    inner.style.cssText =
      'width:100%;height:100%;overflow:hidden;border-radius:16px;' +
      'background:linear-gradient(160deg,rgba(8,18,38,0.96) 0%,rgba(4,12,28,0.98) 100%);' +
      'border-top:2px solid rgba(36,150,237,0.9);' +
      'border-left:1px solid rgba(36,150,237,0.35);' +
      'border-right:1px solid rgba(36,150,237,0.35);' +
      'border-bottom:1px solid rgba(36,150,237,0.2);';
    panelEl.appendChild(inner);
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
      // Portal targets the inner wrapper so React content is inside the styled card
      const innerEl = panelEl.querySelector('div') as HTMLDivElement;
      setPortalTarget(innerEl);
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
