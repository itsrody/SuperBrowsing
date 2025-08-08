# Video Gestures Pro 10.3.0 — Stable Checkpoint

Date: 2025-08-08

This release is a stability-focused iteration on top of 10.2.4. It preserves the core gesture model and fullscreen-only behavior on mobile, while adding lightweight, opt-in UX refinements and operational safeguards. All changes are localized, behind small config flags, and designed not to regress the baseline interactions.

## Highlights

- Mobile-only activation with site-level onboarding toast and checkmark-in-circle icon.
- Immediate scrubbing during horizontal seeking with velocity-aware scaling and clamped range.
- Gentle rubber-banding near start/end to avoid hard stops.
- Micro haptic ticks while scrubbing every N seconds (configurable).
- One-time per-domain onboarding toast to avoid repetition.
- Per-site brightness persistence and restore.
- Reduced-motion friendly indicator/overlay animations.
- Volume overlay shows "Muted" state.
- Stronger middle-zone fullscreen swipe threshold; and safer long-press with slop tolerance.
- Live stream guard: don’t attempt seek on non-finite duration streams.
- Nearest-video fallback for touch start using elementFromPoint.
- Config reset/export/import from GM menu.

## Why this build is stable

- Scoped changes: Each improvement is confined to one or two methods (e.g., `handleHorizontal`, `initReadyToastWatcher`, `UIManager._ensureStyles`), minimizing cross-surface impact.
- Guarded logic: Live stream guard prevents invalid seeks; per-domain toast gate avoids observer churn; long-press slop prevents accidental activations.
- Backwards-compatible defaults: New config keys have conservative defaults. Disabling persistence or ticks requires no code changes.
- Non-invasive UI: Site toast remains on body; indicator remains in fullscreen container; styles bundled under unique IDs.
- Performance conscious: MutationObserver detaches after first toast; micro-ticks use integer stepping (O(1)); velocity tracking uses simple deltas.
- Error resilience: Central `ErrorHandler` resets transient gesture state on exceptions.

## Configuration (new/updated keys)

- SEEK_TICK_SECONDS (number, default 5): Interval for scrub haptic ticks.
- FULLSCREEN_THRESHOLD_MULT (number, default 1.4): Extra threshold for middle fullscreen swipe.
- LONG_PRESS_SLOP_PX (number, default 8): Movement tolerance before long-press engages.
- PERSIST_BRIGHTNESS_PER_SITE (bool, default true): Save/restore brightness per hostname.

Existing keys like SEEK_SENSITIVITY, SEEK_MAX_SECONDS, and velocity parameters remain intact.

## Maintenance guidance

- Keep stable pristine:
  - All experimental work happens in `video-gestures.dev.user.js` (e.g., 10.3.x-dev → 10.4.0-dev).
  - Merge only proven, low-diff patches into `video-gestures.user.js` with version bumps.

- Versioning:
  - Use semver-ish: major.feature.patch.
  - Suffix `-dev` for development builds. Never ship `-dev` to stable.
  - Bump patch for fixes, minor for additive features, major if behavior defaults change.

- Testing matrix (quick manual):
  - Devices: Android Chrome, iOS Safari.
  - Cases: short video (<10m), long video (>1h), live stream (duration = Infinity/NaN).
  - Interactions: double-tap seek, horizontal scrubbing, vertical volume/brightness, long-press speed, fullscreen swipe in middle zone.
  - Accessibility: OS “Reduce Motion” on/off.

- Performance hygiene:
  - Verify MutationObserver disconnects after toast.
  - Avoid logging inside move handlers.
  - Keep computations per frame O(1).

- Error handling:
  - Wrap new gesture logic via `ErrorHandler.handle` or similar try/catch sites.
  - On unexpected errors, ensure `App.instance.resetGestureState()` is safe and idempotent.

- UI/UX consistency:
  - Preserve the glass style and SVG icon set in `UIManager`.
  - Keep overlays short and non-blocking; do not add persistent DOM except via existing IDs.

- Backward compatibility:
  - Add config keys with defaults; merge persisted values with `deepMerge`; avoid removing keys abruptly.

## Upgrade notes from 10.2.4

- No breaking changes.
- Behavior improvements during scrubbing and onboarding; live content protected from invalid seeks.
- Additional GM menu entries for config lifecycle.

## Future candidates (dev first)

- Optional scrub preview bar (non-blocking, minimal DOM).
- Fine-tuned haptic patterns (platform-gated).
- Site-specific presets via hostname patterns.

Maintain the split between stable and dev, verify on mobile, and keep diffs small to ensure ongoing stability.
