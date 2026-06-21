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
  renderer: THREE.WebGLRenderer;
  cssRenderer: CSS3DRenderer;
  panels: ReactNode[];
  theta0: number;
  radius?: number;
  arcAngleDeg?: number;
}

export function ExplorationSphere({
  camera,
  renderer,
  cssRenderer,
  panels,
  theta0,
  radius = 0.8,
  arcAngleDeg = 270,
}: ExplorationSphereProps) {
  const { quaternionRef, isGranted, requestPermission } = useDeviceOrientation();
  const [explorationScene, setExplorationScene] = useState<THREE.Scene | null>(null);

  const panelRefsStorage = useRef<Array<PanelRef | null>>(
    new Array(panels.length).fill(null),
  );

  const theta0Initial = useRef(theta0);
  const panelPositions = useMemo(
    () => computeBeltPositions(panels.length, radius, theta0Initial.current, arcAngleDeg),
    [panels.length, radius, arcAngleDeg],
  );

  useEffect(() => {
    let active = true;
    let rafId = 0;

    void (async () => {
      const THREE = await import('three');
      const { CSS3DObject } = await import('three/addons/renderers/CSS3DRenderer.js');
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const { gsap } = await import('gsap');
      if (!active) return;

      // ── CSS3D scene (panels) ──────────────────────────────────────────────────
      const scene = new THREE.Scene();
      setExplorationScene(scene);

      // Separate camera for CSS3D — never touch camera.quaternion (shared with
      // MindAR WebGL renderer which would break the video background).
      const cssCamera = new THREE.PerspectiveCamera();
      // MindAR's projection matrix (from physical camera intrinsics). We re-copy it
      // each frame after updateMatrixWorld() because PerspectiveCamera.updateMatrixWorld
      // calls updateProjectionMatrix() which would overwrite it with wrong defaults.
      const minarProjMatrix = camera.projectionMatrix.clone();
      const minarProjMatrixInv = camera.projectionMatrixInverse.clone();
      cssCamera.projectionMatrix.copy(minarProjMatrix);
      cssCamera.projectionMatrixInverse.copy(minarProjMatrixInv);

      // ── WebGL overlay scene (whale + particles) ───────────────────────────────
      const xrScene = new THREE.Scene();
      const xrCamera = new THREE.PerspectiveCamera();
      xrCamera.projectionMatrix.copy(minarProjMatrix);
      xrCamera.projectionMatrixInverse.copy(minarProjMatrixInv);

      // Lighting for whale model
      xrScene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const sun = new THREE.DirectionalLight(0x60b8f7, 1.4);
      sun.position.set(0.5, 1, 0.3);
      xrScene.add(sun);
      const rim = new THREE.DirectionalLight(0x2496ed, 0.5);
      rim.position.set(-0.5, -0.2, -0.5);
      xrScene.add(rim);

      // Glowing particle field ─────────────────────────────────────────────────
      const PARTICLE_COUNT = 140;
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const palette = [
        new THREE.Color(0x2496ed), // Docker blue
        new THREE.Color(0x60b8f7), // light blue
        new THREE.Color(0xffffff), // white
        new THREE.Color(0x38bdf8), // cyan
      ];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        const r = 0.2 + Math.random() * 1.6;
        positions[i * 3 + 0] = r * Math.sin(ph) * Math.cos(th);
        positions[i * 3 + 1] = (Math.random() - 0.5) * 1.4;
        positions[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
        const c = palette[i % palette.length];
        colors[i * 3 + 0] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }

      // Soft radial gradient sprite for each particle
      const spriteCanvas = document.createElement('canvas');
      spriteCanvas.width = spriteCanvas.height = 64;
      const sCtx = spriteCanvas.getContext('2d')!;
      const grad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(96,184,247,0.85)');
      grad.addColorStop(1, 'rgba(36,150,237,0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 64, 64);
      const particleTex = new THREE.CanvasTexture(spriteCanvas);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.028,
        map: particleTex,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const particles = new THREE.Points(geo, mat);
      xrScene.add(particles);
      // Slow drift rotation
      gsap.to(particles.rotation, {
        y: Math.PI * 2,
        duration: 45,
        ease: 'none',
        repeat: -1,
      });

      // Whale GLB ──────────────────────────────────────────────────────────────
      let mixer: THREE.AnimationMixer | null = null;
      const clock = new THREE.Clock();

      try {
        const gltf = await new GLTFLoader().loadAsync('/models/whale.glb');
        if (!active) return;

        const whale = gltf.scene;
        whale.scale.setScalar(0.12);

        // Position in the theta0 direction, slightly above belt level
        const t0 = theta0Initial.current;
        const wR = 0.75;
        whale.position.set(wR * Math.sin(t0), 0.05, wR * Math.cos(t0));
        // Face toward camera (origin): local -Z of model points inward
        whale.rotation.y = t0;

        xrScene.add(whale);

        if (gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(whale);
          gltf.animations.forEach((clip) => mixer!.clipAction(clip).play());
        } else {
          // Gentle bob + sway if no embedded animations
          gsap.to(whale.position, {
            y: 0.09,
            duration: 2.3,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          });
          gsap.to(whale.rotation, {
            z: 0.04,
            duration: 3.1,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          });
        }
      } catch {
        // Non-fatal: experience works without the whale
        console.warn('[ExplorationSphere] whale.glb load failed');
      }

      // ── RAF loop ─────────────────────────────────────────────────────────────
      const animate = () => {
        if (quaternionRef.current) {
          cssCamera.quaternion.copy(quaternionRef.current);
          cssCamera.updateMatrixWorld(); // updates matrixWorld + matrixWorldInverse
          // Restore MindAR projection — PerspectiveCamera.updateMatrixWorld calls
          // updateProjectionMatrix() which would overwrite with wrong defaults.
          cssCamera.projectionMatrix.copy(minarProjMatrix);
          cssCamera.projectionMatrixInverse.copy(minarProjMatrixInv);

          xrCamera.quaternion.copy(quaternionRef.current);
          xrCamera.updateMatrixWorld();
          xrCamera.projectionMatrix.copy(minarProjMatrix);
          xrCamera.projectionMatrixInverse.copy(minarProjMatrixInv);
        }

        if (mixer) mixer.update(clock.getDelta());

        // Composite whale scene on top of the MindAR WebGL frame (which ARShell
        // already rendered with autoClear:true before this RAF fires).
        renderer.autoClear = false;
        renderer.render(xrScene, xrCamera);
        renderer.autoClear = true;

        cssRenderer.render(scene, cssCamera);
        rafId = requestAnimationFrame(animate);
      };
      animate();
    })();

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
      setExplorationScene(null);
    };
    // quaternionRef is a stable ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, renderer, cssRenderer]);

  // Recalibration tween when theta0 changes
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
