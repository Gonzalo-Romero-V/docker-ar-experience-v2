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

/**
 * Distributes N panels in a full belt (or arc) around the CAMERA origin.
 * theta0 = angle (rad) of panel 0 — set to atan2(target.x, target.z) so the first
 * panel points toward the QR target.
 * arcAngleDeg = 360 for a full ring; 270 to leave the back sector empty.
 */
export function computeBeltPositions(
  count: number,
  radius: number,
  theta0: number = 0,
  arcAngleDeg: number = 360,
): THREE.Vector3[] {
  if (count === 0) return [];
  const arcRad = (arcAngleDeg * Math.PI) / 180;
  const startTheta = theta0 - arcRad / 2;
  return Array.from({ length: count }, (_, i) => {
    const theta =
      count === 1 ? theta0 : startTheta + (i / (count - 1)) * arcRad;
    return new THREE.Vector3(
      radius * Math.sin(theta),
      0,
      radius * Math.cos(theta),
    );
  });
}

/**
 * Inward-facing rotation for a belt panel: panel face points toward the origin (camera).
 * Equivalent to computePanelRotation(position) + π.
 */
export function computeBeltPanelRotationY(position: THREE.Vector3): number {
  return Math.atan2(position.x, position.z) + Math.PI;
}
