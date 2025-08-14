# Video Touch Gestures UserScript - Code Documentation & Maintenance Guide

## Overview
This is a comprehensive mobile video gesture control userscript that provides touch-based interaction with HTML5 video players. The script enhances mobile video viewing with intuitive gestures for seeking, volume control, playback speed adjustment, fullscreen management, and aspect ratio control.

**Current Version:** 2.2.0  
**File:** `vg.user.js`  
**Author:** Murtaza Salih

## Table of Contents
1. [Feature Overview](#feature-overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Gesture System](#gesture-system)
5. [Configuration](#configuration)
6. [Memory Management](#memory-management)
7. [Error Handling](#error-handling)
8. [Debugging](#debugging)
9. [Maintenance Guidelines](#maintenance-guidelines)
10. [Troubleshooting](#troubleshooting)

## Feature Overview

### Supported Gestures
1. **Single Touch Gestures:**
   - Double-tap: Play/pause or seek (left/right zones)
   - Horizontal swipe: Seeking (time navigation)
   - Vertical swipe: Volume control (left zone)
   - Long press: Speed boost (configurable multiplier)
   - Vertical swipe down: Exit fullscreen (center zone)

2. **Two-Finger Gestures (NEW in v2.2.0):**
   - Pinch out: Switch to fill screen mode (video covers entire screen)
   - Pinch in: Switch to fit screen mode (video fits with possible black bars)

### Supported Video Criteria
- Minimum duration: 60 seconds (configurable)
- Minimum size: 200x150 pixels
- Ready state: Must be loaded (readyState >= 1)
- Excludes: Live streams, ended videos, or stale content

### Excluded Sites
- Netflix, YouTube, Instagram, Facebook, Reddit, TikTok, Dailymotion, Hulu
- These platforms have their own gesture systems

## Architecture

### Main Code Structure

```
vg.user.js:1-1251
├── Initialization (lines 31-44): Mobile detection and early exit
├── Configuration (lines 48-127): Settings management and menu commands
├── Styling (lines 142-226): CSS-in-JS for UI components
├── UI Management (lines 228-329): Indicator and toast creation/management
├── Video Detection (lines 415-529): Video finding and validation logic
├── Touch Handlers (lines 738-913): Core touch event processing
├── Gesture Logic (lines 922-1132): Action determination and execution
├── Pinch Gestures (lines 537-735): Two-finger gesture system
├── Memory Management (lines 234-402): Cleanup and optimization
└── Initialization (lines 1208-1251): Event binding and startup
```

## Core Components

### 1. Configuration System (lines 54-127)
- **Location:** `vg.user.js:54-127`
- **Purpose:** Manages user settings with persistent storage
- **Key Settings:**
  ```javascript
  const CONFIG = {
    MIN_VIDEO_DURATION: 60,      // Minimum video length
    DOUBLE_TAP_SEEK: 5,          // Seek time in seconds
    SWIPE_THRESHOLD: 25,         // Minimum swipe distance
    SEEK_SENSITIVITY: 0.4,       // Seeking responsiveness
    VOLUME_SENSITIVITY: 200,     // Volume change rate
    HAPTIC_FEEDBACK: true,       // Vibration feedback
    LONG_PRESS_SPEED: 2.0,       // Speed boost multiplier
    DEAD_ZONE_SIZE: 30,          // Edge exclusion zone
    GESTURE_TIMEOUT: 10000       // Gesture cleanup timeout
  };
  ```

### 2. Video Detection System (lines 415-529)
- **Location:** `vg.user.js:415-529`
- **Key Functions:**
  - `findVideo()`: Intelligent video element discovery
  - `isValidVideo()`: Video eligibility validation
  - `findContainer()`: Player container identification

### 3. Gesture State Management (lines 531-543)
- **Location:** `vg.user.js:531-543`
- **State Variables:**
  ```javascript
  let gestureState = null;           // Single-touch gesture tracking
  let pinchState = null;             // Two-finger gesture tracking
  let pinchGestureActive = false;    // Pinch gesture status
  let longPressTimer = null;         // Long press timer reference
  ```

### 4. Touch Event Processing (lines 738-913)
- **Location:** `vg.user.js:738-913`
- **Flow:**
  1. `onTouchStart()`: Initializes gesture detection
  2. `onTouchMove()`: Processes ongoing gestures
  3. `onTouchEnd()`: Finalizes and executes actions

## Gesture System

### Single Touch Workflow
1. **Touch Detection (lines 738-832):**
   - Detects valid video targets
   - Validates minimum video requirements
   - Sets up gesture state object
   - Initializes double-tap detection

2. **Movement Processing (lines 834-884):**
   - Calculates swipe distance and direction
   - Determines action type based on screen zones
   - Updates real-time feedback indicators

3. **Action Execution (lines 922-1014):**
   - **Seeking:** Horizontal swipe → time navigation
   - **Volume:** Vertical swipe in left zone → volume control
   - **Speed:** Long press → playback rate boost

### Pinch Gesture System (NEW - lines 537-735)

#### Pinch Detection Logic
```javascript
// Distance calculation using Euclidean formula
const currentDistance = Math.hypot(
  touch2.clientX - touch1.clientX,
  touch2.clientY - touch1.clientY
);

// Trigger threshold: 15% change in finger distance
const changePercent = Math.abs(distanceChange) / initialDistance;
if (changePercent > 0.15 && !hasTriggered) {
  // Execute aspect ratio change
}
```

#### Aspect Ratio Management
- **Pinch Out:** Sets `objectFit: 'cover'` (fill screen, may crop)
- **Pinch In:** Sets `objectFit: 'contain'` (fit entirely, may show bars)
- **Original State:** Preserves initial video styling

#### Key Constants
```javascript
const PINCH_THRESHOLD = 20;      // Minimum distance change
const PINCH_MIN_DISTANCE = 50;   // Minimum finger separation
const PINCH_TIMEOUT = 200;       // Gesture completion timeout
```

### Screen Zone Layout
```
┌─────────────────────────────────┐
│  Volume    │ Fullscreen │  No   │
│  Control   │  Control   │Action │
│  (0-33%)   │ (33-67%)   │(67%+) │
├─────────────────────────────────┤
│         Seeking Control         │
│       (Horizontal Swipe)        │
└─────────────────────────────────┘
```

## Configuration

### User Menu Commands
- **⚙️ Set Seek Time:** Adjust double-tap seek duration (5-30s)
- **⚡ Set Speed:** Modify long-press speed multiplier (0.5-4x)
- **🔄 Reset Settings:** Restore default configuration

### Persistent Storage
Settings are automatically saved using `GM_getValue`/`GM_setValue` and persist across sessions.

## Memory Management

### Video Activity Tracking (lines 342-402)
- **WeakSet Usage:** `activeVideos` prevents memory leaks
- **Timer Management:** Automatic cleanup of inactive videos
- **Inactivity Detection:** 5-second timeout for gesture cleanup

### Cleanup Mechanisms
1. **Automatic Cleanup:** 30-second interval for inactive gestures
2. **Video Tracking:** Timeout-based removal of stale videos
3. **Event Cleanup:** Complete listener removal on page unload

### Memory-Safe Patterns
```javascript
// Use WeakSet for video references
let activeVideos = new WeakSet();
// Use WeakMap for video-specific data
let videoTimers = new WeakMap();
```

## Error Handling

### Defensive Programming Patterns
- All major functions wrapped in try-catch blocks
- Graceful degradation for missing APIs (haptics, fullscreen)
- Validation checks before DOM manipulations
- Safe video property access with fallbacks

### Error Recovery
- Gesture state reset on errors
- Timer cleanup on failures
- Automatic retry mechanisms for video detection

## Debugging

### Console Logging System
The script includes comprehensive logging with prefixed messages:
```javascript
console.log('[VideoGestures] Message'); // General info
console.warn('[VideoGestures] Warning'); // Non-critical issues
console.error('[VideoGestures] Error'); // Critical failures
```

### Debug Information
- Touch coordinates and movement tracking
- Video validation results and criteria checks
- Gesture state transitions and action determinations
- Memory management operations

### Common Debug Scenarios
1. **Video Not Detected:** Check console for validation failures
2. **Gestures Not Working:** Verify fullscreen state and video validity
3. **Pinch Issues:** Monitor distance calculations and threshold values

## Maintenance Guidelines

### Version Management
- **Current:** 2.2.0 (with pinch gesture support)
- **Version History:** Track feature additions in userscript header
- **Breaking Changes:** Document configuration or API changes

### Code Modification Best Practices

#### Adding New Gestures
1. Add state variables in gesture state section (lines 531-543)
2. Implement detection logic in touch handlers (lines 738-913)
3. Create action handlers following existing patterns
4. Update cleanup functions to include new state
5. Add appropriate CSS styling if needed

#### Modifying Existing Features
1. **Touch Sensitivity:** Adjust `SWIPE_THRESHOLD` and related constants
2. **Video Criteria:** Modify `isValidVideo()` function (lines 466-508)
3. **UI Styling:** Update CSS in `createStyles()` (lines 142-226)

#### Performance Optimization
1. **Timer Management:** Review timeout values and cleanup intervals
2. **Event Throttling:** Consider debouncing for high-frequency events
3. **Memory Usage:** Monitor WeakSet/WeakMap usage patterns

### Testing Checklist
- [ ] Single-touch gestures (seek, volume, play/pause)
- [ ] Two-finger pinch gestures (aspect ratio toggle)
- [ ] Fullscreen transitions and orientation changes
- [ ] Memory management during extended use
- [ ] Configuration persistence across sessions
- [ ] Error handling with invalid videos
- [ ] Performance on various mobile devices

### Site Compatibility
- Test on various video streaming platforms
- Verify gesture conflicts don't occur with site-specific controls
- Check fullscreen API compatibility across browsers

## Troubleshooting

### Common Issues

#### Gestures Not Responding
- **Cause:** Video not meeting validation criteria
- **Debug:** Check console for video validation messages
- **Fix:** Verify video duration, size, and ready state

#### Pinch Gestures Not Working
- **Cause:** Not in fullscreen mode or insufficient finger distance
- **Debug:** Monitor pinch state initialization and distance calculations
- **Fix:** Ensure fullscreen mode and minimum finger separation

#### Memory Leaks
- **Cause:** Timers not being cleared or video references not released
- **Debug:** Monitor video tracking and timer management logs
- **Fix:** Review cleanup functions and timer lifecycle

#### Configuration Not Saving
- **Cause:** GreaseMonkey storage API unavailable
- **Debug:** Check GM_getValue/GM_setValue availability
- **Fix:** Verify userscript permissions and storage access

### Performance Issues
- **High CPU Usage:** Reduce gesture polling frequency
- **Memory Growth:** Check for uncleaned video references
- **UI Lag:** Optimize CSS transitions and DOM updates

## File Structure Summary

```
vg.user.js (1,251 lines)
├── Header & Metadata (1-29)
├── Mobile Detection (31-44)
├── Configuration System (48-127)
├── UI Creation & Styling (142-329)
├── Video Management (342-529)
├── Gesture State (531-543)
├── Pinch Gesture System (544-735)
├── Touch Event Handlers (738-913)
├── Gesture Action Logic (922-1132)
├── Video Detection & Ready Check (1135-1161)
├── Cleanup System (1163-1206)
└── Initialization (1208-1251)
```

This documentation serves as a comprehensive guide for maintaining, debugging, and extending the Video Touch Gestures userscript. Keep this document updated when making significant changes to the codebase.
