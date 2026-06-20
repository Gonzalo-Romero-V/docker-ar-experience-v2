'use client';

import { useCallback, useRef, useState } from 'react';
import type * as THREE from 'three';

export type FocusState = 'overview' | 'focused';

export interface PanelRef {
  obj: THREE.Object3D;
  el: HTMLElement;
  basePosition: THREE.Vector3;
  /** The scale the CSS3DObject was initialized with (e.g. 1/400). Multiplied by focus factors. */
  baseScale: number;
}

const FOCUSED_SCALE_MULT = 1.3;
const UNFOCUSED_SCALE_MULT = 0.9;
const UNFOCUSED_OPACITY = 0.35;
const FOCUS_Z_OFFSET = 0.15;

/**
 * Manages focus/overview state for the spatial board.
 * GSAP animates Three.js properties — NOT CSS directly (CSS3DRenderer overwrites it).
 */
export function useFocusController() {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const panelRefs = useRef<PanelRef[]>([]);

  const registerPanel = useCallback((index: number, ref: PanelRef) => {
    panelRefs.current[index] = ref;
  }, []);

  const focusPanel = useCallback(
    async (index: number) => {
      // Lazy import GSAP — only needed client-side, never during SSR
      const { gsap } = await import('gsap');

      panelRefs.current.forEach((panel, i) => {
        if (!panel) return;
        if (i === index) {
          const s = panel.baseScale * FOCUSED_SCALE_MULT;
          gsap.to(panel.obj.scale, { x: s, y: s, z: s, duration: 0.35, ease: 'power2.out' });
          gsap.to(panel.obj.position, { z: panel.basePosition.z + FOCUS_Z_OFFSET, duration: 0.35, ease: 'power2.out' });
          gsap.to(panel.el, { opacity: 1, duration: 0.25 });
        } else {
          const s = panel.baseScale * UNFOCUSED_SCALE_MULT;
          gsap.to(panel.obj.scale, { x: s, y: s, z: s, duration: 0.35, ease: 'power2.out' });
          gsap.to(panel.obj.position, { z: panel.basePosition.z, duration: 0.35 });
          gsap.to(panel.el, { opacity: UNFOCUSED_OPACITY, duration: 0.25 });
        }
      });

      setFocusedIndex(index);
    },
    [],
  );

  const resetOverview = useCallback(async () => {
    const { gsap } = await import('gsap');

    panelRefs.current.forEach((panel) => {
      if (!panel) return;
      const s = panel.baseScale;
      gsap.to(panel.obj.scale, { x: s, y: s, z: s, duration: 0.35, ease: 'power2.out' });
      gsap.to(panel.obj.position, {
        x: panel.basePosition.x,
        y: panel.basePosition.y,
        z: panel.basePosition.z,
        duration: 0.35,
        ease: 'power2.out',
      });
      gsap.to(panel.el, { opacity: 0.8, duration: 0.25 });
    });

    setFocusedIndex(null);
  }, []);

  return {
    focusedIndex,
    focusState: focusedIndex !== null ? ('focused' as FocusState) : ('overview' as FocusState),
    registerPanel,
    focusPanel,
    resetOverview,
  };
}
