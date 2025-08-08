# Subtitle Uploader v2.8 – Architecture & Maintenance Guide

Source file: `subtitle-uploader.user.js`

Purpose: Attach a site-agnostic UI onto any HTML5 video element to load, render, style, and sync local subtitle files (VTT, SRT, ASS/SSA) without relying on the website’s native subtitle support.

## High-level runtime lifecycle
- Script metadata: runs at `document-end` on all pages; requires GM APIs (`GM.getValue`, `GM.setValue`, `GM.addStyle`).
- `init()` is the entry point:
  - Skips mobile (window width ≤ 768).
  - Injects styles and builds the settings panel DOM (hidden by default).
  - Creates a global toast/indicator node for transient messages.
  - Applies saved settings.
  - Adds page-level listeners (keyboard, scroll/resize/fullscreen).
  - Starts a `MutationObserver` to find and initialize videos dynamically.
  - Scans the current DOM and initializes already-present videos.

## Core data model
- `settings`: object persisted via GM storage with typography, background, position, delay, and encoding preferences.
- `videoDataMap: Map<HTMLVideoElement, VideoState>` where `VideoState` can contain:
  - `uiSandbox`: overlay div anchored over the video container
  - `controls`: the floating controls container (upload/settings/select)
  - `trackSelector`: <select> for multiple subtitle tracks
  - `display`: `.custom-subtitle-display` (the rendered subtitle overlay)
  - `tracks`: array of `{ label, cues }` where cues are `{ start, end, text }`
  - `currentTrackIndex`, `lastTrackIndex`, `lastFile`, `lastCue`
- Globals: `globalIndicator` (toast), `settingsPanel`, `activeVideo` (video under the mouse / being configured).

## Video discovery & initialization
- `MutationObserver` watches the whole document for added nodes.
- `findVideosRecursively(node)`: collects `<video>` elements under a node, also descending into shadow roots.
- For each video:
  - Wait for metadata if needed, then call `initializeForVideo(video)`.
  - Guardrails: ignore if already handled, duration < 30s, or intrinsic width < 200.
- `initializeForVideo(video)`:
  - Resolves a suitable container via `findVideoContainer(video)`:
    - Prefer YouTube’s `#movie_player`.
    - Else look for class hints like `video-player`, `player-container`, `videoContainer`.
    - Else climb positioned ancestors within reasonable size bounds; fallback to parent.
  - Creates `uiSandbox` (absolute-positioned overlay) and inserts controls: Upload, Settings, Track selector (hidden until a track exists).
  - Mouse enter/leave sets `activeVideo` and toggles controls visibility.
  - Drag-and-drop handlers for subtitle files.

## UI components
- Controls (top-left over video):
  - Upload button (Ctrl+U)
  - Settings button (opens panel)
  - Track selector (appears when at least one track is loaded; includes “Subtitles Off”).
- Settings panel (modal): font family/size/color, outline, background color/toggle/opacity, vertical offset (as %), delay (ms) with +/- buttons, file encoding select + “Reload” last file.
- Global indicator (toast): shows feedback (load success, errors, drop hints, delay changes).

## Subtitle ingestion pipeline
- Entry points: file input (`handleUploadClick`) and drag-and-drop onto the video container.
- `processSubtitleFile(video, file, encoding)`:
  - Uses `FileReader.readAsText(file, encoding)`.
  - Converts source format to VTT string when needed:
    - SRT → VTT via `srtToVtt()` (replace comma milliseconds, prepend WEBVTT header).
    - ASS/SSA → VTT via `assToVtt()` (parses [Events] Format, strips override tags, replaces `\N` with newlines).
  - Parses VTT to cues via `parseVtt()` (simple line-based parser).
  - Updates `videoDataMap` (remembers `lastFile`), creates/updates track via `addSubtitleTrack()` and shows success/error toast.

## Track management
- `addSubtitleTrack(video, label, cues)`:
  - Disables native `textTracks` to avoid conflicts.
  - Ensures a custom display exists (`getOrCreateSubtitleDisplay`) and binds `timeupdate` → `renderCustomSubtitle` once.
  - Adds or replaces a track by label, updates `currentTrackIndex`, remembers `lastTrackIndex`.
  - Refreshes the track selector and reapplies style settings.
- Track selector onchange updates the active track and re-renders.
- Keyboard `S` toggles between Off (-1) and the last-used track.

## Rendering & positioning
- `renderCustomSubtitle(video)`:
  - Determines `activeCue` using `video.currentTime + (settings.delay / 1000)`.
  - If cue changes, updates `display.innerHTML` and shows the overlay; else hides it.
  - Calls `updateSubtitlePosition(video, display)`.
- `updateSubtitlePosition(video, display)`:
  - Uses the sandbox’s bounding rect to position the display:
    - Vertical: `top = (containerHeight * (offsetY%)) - displayHeight` (offset measured from the top; overlay is centered via CSS `transform: translateX(-50%)`).
    - Horizontal: centers via `left = containerWidth / 2`.
    - Sets `max-width` to 90% of smaller of container/window widths.
- Style application (`applySettings()`):
  - Computes font color, family, size, outline shadow, and background color (RGBA with opacity or transparent).
  - Applies these to all `.custom-subtitle-display` nodes, then schedules `updateAllPositions()`.

## Settings persistence
- `defaultSettings` are loaded and merged from GM storage on startup.
- Panel input changes call `updateSettingsFromPanel()` → `GM.setValue()` → `applySettings()` and `updatePanelUI()`.
- Delay also adjustable globally via `adjustDelay(amount)` with a toast; panel field syncs if open.

## Keyboard & interactions
- Global keydown (ignored when typing in inputs and when no `activeVideo`):
  - Ctrl+U: open file picker for the active video.
  - S: toggle subtitles on/off (remembers last track index).
  - [ / ]: adjust delay by -250ms/+250ms; with Shift: -50ms/+50ms.
- Inside the settings panel:
  - Esc closes.
  - [ / ] adjust delay.
  - Alt+[ / Alt+] decrease/increase font size.
  - Opening the panel pauses the active video; closing resumes if it was playing.

## Dynamic layout updates & cleanup
- Throttled `updateAllPositions()` runs on scroll/resize (debounced 100ms) and on `fullscreenchange`.
- `updateAllPositions()` also prunes entries whose videos have been removed from the DOM (removes sandbox and deletes from `videoDataMap`).

## Styles & z-index strategy
- `GM.addStyle()` injects all UI CSS:
  - `uiSandbox` is absolute, full-bleed over video container, very high z-index (2147483630) and pointer-events disabled except for its child controls.
  - Settings panel and indicator use z-index 2147483647 to sit above everything.
  - Controls use glassmorphism-like background with subtle transitions.

## Error handling & indicators
- Success/error SVG icons embedded in the indicator toast.
- Common errors shown: invalid file/format, unsupported extension, no file to reload.

## Known limitations / design trade-offs
- Mobile disabled by design for simplicity of overlay and interactions.
- VTT parser is basic:
  - Ignores cue IDs, settings (position/align/line), comments/notes, and style blocks.
  - Converts newlines to `<br>`; renders via `innerHTML`.
- ASS/SSA conversion strips most styling and positioning, keeping plain text only.
- Encoding support relies on the browser’s `FileReader` accepted encodings; behavior may vary by platform.
- Uses `innerHTML` to display user-provided subtitle text; since input is the local file the user selected, XSS risk is limited to self.
- Only one active video is interacted with at a time (`activeVideo` determined by hover).

## Maintenance guidelines
- Adding a new setting:
  - Extend `defaultSettings` and GM storage schema.
  - Add corresponding UI control in `createSettingsPanel()` and wire into `updateSettingsFromPanel()` and `applySettings()`.
  - Update `updatePanelUI()` if it needs a live label.
- Supporting a new subtitle format:
  - Extend `processSubtitleFile()` to detect the extension and convert to VTT.
  - Implement a converter similar to `srtToVtt()` / `assToVtt()`.
- Improving WebVTT support:
  - Enhance `parseVtt()` to support cue IDs, settings (e.g., `line`, `position`, `align`), NOTE blocks, and style span tags.
  - Extend `renderCustomSubtitle()` and CSS to respect those fields.
- Performance considerations:
  - Rendering happens in the `timeupdate` event; keep operations light (avoid layout thrash).
  - Position recalculation is throttled; if you change layout math, ensure `updateAllPositions()` remains cheap.
- UI safety:
  - High z-index values reduce site conflicts but can still clash with some pages; adjust only if necessary.
  - Keep `pointer-events: none` on the sandbox to avoid blocking native player interactions; enable events only on the controls.
- Cleanup:
  - Any new per-video resources should be removed alongside the existing `updateAllPositions()` pruning logic or by listening for `DOMNodeRemoved`/disconnection.

## Quick reference of key functions
- Entry & setup: `init`, `initializeStyles`, `createSettingsPanel`, `applySettings`
- Video lifecycle: `findVideosRecursively`, `findVideoContainer`, `initializeForVideo`, `updateAllPositions`
- UI: `createSubtitleControls`, `getOrCreateSubtitleDisplay`, `updateTrackSelector`, `openSettingsPanel`, `closeSettingsPanel`, `showIndicator`
- Subtitles: `processSubtitleFile`, `srtToVtt`, `assToVtt`, `assTimeToVtt`, `parseVtt`, `timeToSeconds`, `addSubtitleTrack`, `renderCustomSubtitle`
- Positioning: `updateSubtitlePosition`
- Settings: `updateSettingsFromPanel`, `adjustDelay`

## Behavior summary
- Drag or upload a subtitle → converted to VTT if needed → parsed to cues → displayed over the video with user-styled appearance. Multiple tracks supported and selectable. Timing can be shifted live via keyboard or panel. The overlay UI is isolated from the site’s native player and self-cleans when videos are removed.
