## Task: Anchor lock persistence
## Status: in progress — Phase A approved
## Evaluator: manual device test

### Intent

The image target is an acquisition reference, not a continuous leash. Once found, it
initializes a horizontal, inward-facing belt of panels around the student. Losing the
target must preserve the last valid scene pose; later work will add device-orientation
exploration to traverse that belt.

### Scope

- `app/frontend/components/ar/ARShell.tsx`

### Phase A: freeze last tracked pose

1. Copy the CSS anchor matrix on every valid tracking update.
2. When tracking is lost, reapply that last matrix, preserve CSS child visibility,
   and keep the anchor group renderable.
3. Expose a `locked` status so the user knows the scene is held rather than actively
   tracking.

### Constraints

- This phase deliberately freezes the pose relative to the current virtual camera.
  It does not yet provide orientation-based exploration or translational tracking.
- Keep calibration values and temporary probes unchanged.
- Do not introduce device-sensor permissions in this phase.

### Acceptance criteria

- [ ] Target acquisition displays the scene.
- [ ] Removing the target does not hide or reset the scene.
- [ ] Reacquiring the target resumes active tracking without errors.

### Rollback

Revert the dedicated anchor-lock commit. The previous target-loss behavior can be
restored by removing the saved matrix and `locked` branch.

### Implementation record (2026-06-20)

- ARShell captures the anchor matrix only during valid tracking updates.
- During loss, it restores the saved matrix and CSS child visibility after every
  MindAR update, preventing MindAR's invisible-matrix reset from hiding the scene.
- The UI now identifies the held state as `locked`.
- Passed: `npx tsc --noEmit` and focused ESLint for `ARShell.tsx`.
- Pending: target-loss and reacquisition test on device.

### Evaluation result

Rejected and removed: freezing the last MindAR pose cannot support the intended
post-target exploration because MindAR supplies no continuing camera/world pose.
The next architecture needs Android orientation sensors for 3DoF exploration or a
separate ARCore/WebXR implementation for persistent 6DoF world tracking.
