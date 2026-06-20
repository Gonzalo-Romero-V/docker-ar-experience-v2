'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Quaternion } from 'three';

export interface DeviceOrientationHook {
  quaternionRef: MutableRefObject<Quaternion | null>;
  isGranted: boolean;
  requestPermission: () => Promise<void>;
}

// iOS 13+ requires an explicit permission request via a user gesture.
function needsPermission(): boolean {
  return (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (
      DeviceOrientationEvent as unknown as { requestPermission?: unknown }
    ).requestPermission === 'function'
  );
}

function buildHandler(quaternionRef: MutableRefObject<Quaternion | null>) {
  // Lazy-initialized reusables — created once on first event, not on import
  let euler: import('three').Euler | null = null;
  let MathUtils: typeof import('three').MathUtils | null = null;

  return async (e: DeviceOrientationEvent) => {
    if (!euler || !MathUtils) {
      const THREE = await import('three');
      euler = new THREE.Euler();
      MathUtils = THREE.MathUtils;
      if (!quaternionRef.current) {
        quaternionRef.current = new THREE.Quaternion();
      }
    }
    euler.set(
      MathUtils.degToRad(e.beta ?? 0),
      MathUtils.degToRad(e.alpha ?? 0),
      -MathUtils.degToRad(e.gamma ?? 0),
      'YXZ',
    );
    quaternionRef.current!.setFromEuler(euler);
  };
}

export function useDeviceOrientation(): DeviceOrientationHook {
  const quaternionRef = useRef<Quaternion | null>(null);
  const [isGranted, setIsGranted] = useState(false);

  useEffect(() => {
    if (needsPermission()) return; // iOS: defer until requestPermission() called

    const handler = buildHandler(quaternionRef);
    window.addEventListener('deviceorientation', handler);
    setIsGranted(true);

    return () => window.removeEventListener('deviceorientation', handler);
  }, []);

  const requestPermission = useCallback(async () => {
    const DOE = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof DOE.requestPermission !== 'function') return;

    const result = await DOE.requestPermission();
    if (result !== 'granted') return;

    const handler = buildHandler(quaternionRef);
    window.addEventListener('deviceorientation', handler);
    setIsGranted(true);
  }, []);

  return { quaternionRef, isGranted, requestPermission };
}
