'use client';

import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type * as THREE from 'three';
import { useFocusController } from '@/components/ar/hooks/useFocusController';
import type { PanelRef } from '@/components/ar/hooks/useFocusController';
import {
  computePanelRotation,
  computeRadialPositions,
} from '@/components/ar/utils/computeRadialPositions';
import { SpatialPanel } from './SpatialPanel';

interface SpatialBoardProps {
  scene: THREE.Scene;
  panels: ReactNode[];
  radius?: number;
  arcAngleDeg?: number;
  yOffset?: number;
  depth?: number;
}

export function SpatialBoard({
  scene,
  panels,
  radius = 0.8,
  arcAngleDeg = 150,
  yOffset = 0,
  depth = 0,
}: SpatialBoardProps) {
  const { focusState, registerPanel, focusPanel, resetOverview } =
    useFocusController();

  const positions = useMemo(
    () =>
      computeRadialPositions(
        panels.length,
        radius,
        arcAngleDeg,
        yOffset,
        depth,
      ),
    [panels.length, radius, arcAngleDeg, yOffset, depth],
  );

  const handlePanelMount = useCallback(
    (index: number, ref: PanelRef) => {
      registerPanel(index, ref);
    },
    [registerPanel],
  );

  return (
    <>
      {panels.map((panel, index) => {
        const position = positions[index];

        return (
          <SpatialPanel
            key={index}
            scene={scene}
            position={position}
            rotationY={computePanelRotation(position)}
            onMount={(ref) => handlePanelMount(index, ref)}
          >
            <div
              className="h-full w-full"
              onClick={() => {
                void focusPanel(index);
              }}
            >
              {panel}
            </div>
          </SpatialPanel>
        );
      })}

      {focusState === 'focused' ? (
        <button
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-border bg-background/80 px-6 py-2 text-sm font-medium text-foreground"
          type="button"
          onClick={() => {
            void resetOverview();
          }}
        >
          Back to overview
        </button>
      ) : null}
    </>
  );
}
