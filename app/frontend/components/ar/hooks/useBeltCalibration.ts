'use client';

import { useCallback, useRef, useState } from 'react';
import type { Vector3 } from 'three';

const MIN_CHANGE_RAD = (5 * Math.PI) / 180; // 5° threshold — suppresses anchor jitter

/** Wraps a radian difference to [-π, π]. */
function wrapDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export interface BeltCalibration {
  /** Current orientation angle (rad) of panel 0 — points toward last known target. */
  theta0: number;
  /** Call every frame while anchor.group.visible === true. */
  updateFromAnchor: (position: Vector3) => void;
}

export function useBeltCalibration(): BeltCalibration {
  const theta0Ref = useRef(0);
  const [theta0, setTheta0] = useState(0);

  const updateFromAnchor = useCallback((position: Vector3) => {
    const next = Math.atan2(position.x, position.z);
    if (Math.abs(wrapDiff(next, theta0Ref.current)) > MIN_CHANGE_RAD) {
      theta0Ref.current = next;
      setTheta0(next);
    }
  }, []);

  return { theta0, updateFromAnchor };
}
