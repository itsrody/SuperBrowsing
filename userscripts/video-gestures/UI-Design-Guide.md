# Video Gestures Pro — UI Design Guide

Design any new UI to match the existing overlay and toast aesthetics. This guide distills the visual language, motion, and implementation patterns used by the script.

## Aesthetic principles

- Minimal and expressive: one concise label + one clear icon.
- Glassmorphism: translucent panel, subtle border, heavy blur/saturation.
- High legibility on video: strong light-on-dark contrast, gentle text-shadow.
- Mobile-first, fullscreen-safe: centered, non-obstructive, and transient.
- Consistency: identical styling for indicator overlays and site-level toast.

## Visual tokens (defaults)

- Typography: Roboto, 15px, weight 500, line-height 1.
- Layout: inline-flex, center-aligned, gap 10px, padding 12px 16px, radius 16px.
- Iconography: 24×24 SVG, filled, single color; subtle drop-shadow.
- Colors:
  - Surface: rgba(18,18,18,0.35)
  - Border: rgba(255,255,255,0.12)
  - Foreground text/icon: rgba(255,255,255,0.95)
- Effects:
  - backdrop-filter: blur(12px) saturate(140%), with -webkit- fallback
  - box-shadow: 0 8px 30px rgba(0,0,0,.45), inset 0 1px 1px rgba(255,255,255,.06)
  - text-shadow: 0 1px 1px rgba(0,0,0,.4)
  - SVG drop-shadow: filter: drop-shadow(0 1px 1px rgba(0,0,0,.35))
- Z-index:
  - Foreground overlays: 2147483647 (indicator, toast)
  - Brightness scrim: 2147483646
- Motion:
  - Default: opacity and transform scale in 0.18s ease (0.94 → 1)
  - Reduced motion: disable transitions via prefers-reduced-motion

## Accessibility

- Contrast: maintain high contrast foreground on translucent surfaces.
- Reduce motion: honor `@media (prefers-reduced-motion: reduce)`.
- Text: keep labels short; use clear icons to reduce localization burden.

## Icons

- Style: simple, filled, single-color SVG at 24×24.
- Semantics: choose icons that communicate action (play, pause, seek, ready).
- Consistency: maintain uniform viewBox (0 0 24 24) and fill color.

## Components

1) Indicator overlay (fullscreen)
- Purpose: feedback for gestures (seek target time, volume %, brightness %).
- Position: fixed center of fullscreen element; reparent to `document.fullscreenElement` when active; otherwise body.
- Behavior: hidden by default; add `.visible` to fade/scale in for ~800ms.
- Pointer events: none (don’t block touches).

2) Site-level toast
- Purpose: one-time onboarding message (e.g., “Gestures Ready”).
- Position: fixed center on body; never reparent into fullscreen element.
- Behavior: same styling and motion as indicator.

3) Brightness overlay (scrim)
- Element: fixed, inset: 0; background: #000; pointer-events: none.
- Opacity: `1 - brightness01` (e.g., 0..0.9); transition 0.12s linear.

## CSS reference (extract)

```css
/* Shared glass style */
.overlay {
  position: fixed;
  top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.94);
  padding: 12px 16px;
  background: rgba(18,18,18,0.35);
  border: 1px solid rgba(255,255,255,0.12);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  color: rgba(255,255,255,0.95);
  font: 500 15px/1 Roboto, system-ui, sans-serif;
  border-radius: 16px;
  display: inline-flex; align-items: center; gap: 10px;
  opacity: 0; pointer-events: none;
  transition: opacity .18s ease, transform .18s ease;
  box-shadow: 0 8px 30px rgba(0,0,0,.45), inset 0 1px 1px rgba(255,255,255,.06);
  text-shadow: 0 1px 1px rgba(0,0,0,.4);
  z-index: 2147483647;
}
.overlay.visible { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.overlay svg { width: 24px; height: 24px; fill: rgba(255,255,255,0.95); filter: drop-shadow(0 1px 1px rgba(0,0,0,.35)); }
.overlay span { font-size: 15px; line-height: 1; }

/* Brightness scrim */
.scrim { position: fixed; inset: 0; background: #000; opacity: 0; pointer-events: none; z-index: 2147483646; transition: opacity .12s linear; }

@media (prefers-reduced-motion: reduce) {
  .overlay, .scrim { transition: none !important; }
}
```

## Behavior patterns

- Lifecycle: create elements once; update content; toggle `.visible` class; set timeouts for auto-hide.
- Reparenting: indicator/scrim move into `document.fullscreenElement`; toast stays on body.
- Timing: default show ~800ms; allow sticky mode for long-press speed.
- Haptics: optional micro-ticks on seek milestones; don’t overuse.

## Performance considerations

- O(1) per frame: compute minimal deltas; avoid layout trashing.
- requestAnimationFrame: batch DOM writes for `show()`.
- Singletons: keep one indicator, one scrim, one toast; no repeated creation/removal.
- Observers: disconnect MutationObserver when no longer needed.

## Theming with CSS variables (optional)

Define tokens for easy theming without code changes:

```css
:root {
  --vg-bg: rgba(18,18,18,0.35);
  --vg-border: rgba(255,255,255,0.12);
  --vg-fg: rgba(255,255,255,0.95);
  --vg-blur: 12px;
  --vg-sat: 140%;
}
.overlay { background: var(--vg-bg); border-color: var(--vg-border); color: var(--vg-fg); backdrop-filter: blur(var(--vg-blur)) saturate(var(--vg-sat)); -webkit-backdrop-filter: blur(var(--vg-blur)) saturate(var(--vg-sat)); }
```

## Implementation checklist

- Create/ensure three elements:
  - Indicator container (centered overlay)
  - Brightness scrim (fixed, inset: 0)
  - Site-level toast (centered on body)
- Apply shared glass style and motion rules.
- Toggle `.visible` to show/hide; avoid blocking touches (pointer-events: none).
- Reparent indicator/scrim on fullscreenchange; keep toast on body.
- Respect prefers-reduced-motion.
- Keep labels short; pair with a clear SVG icon.

Following these guidelines will keep new UI elements visually cohesive, accessible, and performant alongside the existing script UI.
