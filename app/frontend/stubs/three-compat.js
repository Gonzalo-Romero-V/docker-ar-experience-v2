// "three" is aliased to this file via turbopack.resolveAlias.
// Using a RELATIVE path bypasses both the alias table (only applies to bare specifiers)
// and the package exports map (only applies to package imports), so Turbopack
// resolves directly to the file without creating a circular dependency.
export * from '../node_modules/three/build/three.module.js';

// Constants removed in Three.js r152 that MindAR still imports
export const sRGBEncoding = 3001;
export const LinearEncoding = 3000;
