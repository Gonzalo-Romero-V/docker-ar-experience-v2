// Type stub for mind-ar — no official @types package
declare module 'mind-ar/dist/mindar-image-three.prod.js' {
  import type { WebGLRenderer, Scene, PerspectiveCamera, Group, Object3D } from 'three';

  interface MindARThreeOptions {
    container: HTMLElement;
    imageTargetSrc: string;
    uiLoading?: 'yes' | 'no';
    uiScanning?: 'yes' | 'no';
    uiError?: 'yes' | 'no';
    maxTrack?: number;
    filterMinCF?: number;
    filterBeta?: number;
    missTolerance?: number;
    warmupTolerance?: number;
  }

  interface MindARThreeAnchor {
    group: Group;
    onTargetFound?: () => void;
    onTargetLost?: () => void;
  }

  export class MindARThree {
    constructor(options: MindARThreeOptions);
    renderer: WebGLRenderer;
    scene: Scene;
    camera: PerspectiveCamera;
    start(): Promise<void>;
    stop(): Promise<void>;
    addAnchor(targetIndex: number): MindARThreeAnchor;
  }
}
