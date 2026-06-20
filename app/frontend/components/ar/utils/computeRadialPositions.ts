import * as THREE from 'three';

/**
 * Distributes N panels in a flat arc ("curved cinema") around the anchor origin.
 * Each returned Vector3 is a world-space position for a CSS3DObject.
 *
 * Params calibrated for device — start with radius=0.8, arcAngleDeg=150, yOffset=0, depth=0.
 */
export function computeRadialPositions(
  count: number,
  radius: number,
  arcAngleDeg: number,
  yOffset: number,
  depth: number,
): THREE.Vector3[] {
  if (count === 0) return [];

  const arcRad = (arcAngleDeg * Math.PI) / 180;
  const startAngle = -arcRad / 2;

  return Array.from({ length: count }, (_, i) => {
    const angle =
      count === 1 ? 0 : startAngle + (i / (count - 1)) * arcRad;
    return new THREE.Vector3(
      Math.sin(angle) * radius,
      yOffset,
      depth - Math.cos(angle) * radius,
    );
  });
}

/**
 * Returns the Y-axis rotation (radians) so a panel at `position` faces the origin.
 * Use: css3dObj.rotation.y = computePanelRotation(position)
 */
export function computePanelRotation(position: THREE.Vector3): number {
  return Math.atan2(position.x, position.z);
}
