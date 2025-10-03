// ==UserScript==
// @name          Video Touch & Mouse Gestures
// @namespace     https://github.com/itsrody/SuperBrowsing
// @version       4.0
// @icon          data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzc0QzBGQyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bS0yIDE0LjV2LTlsNiA0LjUtNiA0LjV6Ii8+PC9zdmc+
// @description   Optimized video gesture interface for both touch and mouse, with performance improvements and aspect ratio control.
// @author        Murtaza Salih
// @match         *://*/*
// @exclude       *://*.netflix.com/*
// @exclude       *://netflix.com/*
// @exclude       *://*.youtube.com/*
// @exclude       *://youtube.com/*
// @exclude       *://*.instagram.com/*
// @exclude       *://instagram.com/*
// @exclude       *://*.facebook.com/*
// @exclude       *://facebook.com/*
// @exclude       *://*.reddit.com/*
// @exclude       *://reddit.com/*
// @exclude       *://*.tiktok.com/*
// @exclude       *://tiktok.com/*
// @exclude       *://*.dailymotion.com/*
// @exclude       *://dailymotion.com/*
// @exclude       *://*.hulu.com/*
// @exclude       *://hulu.com/*
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_registerMenuCommand
// @run-at        document-start
// ==/UserScript==

(async () => {
  'use strict';

  // Constants
  const STYLE_ID = 'vg-styles';
  const INDICATOR_ID = 'vg-indicator';
  const TOAST_ID = 'vg-toast';
  const INACTIVE_TIMEOUT = 5000; // 5 seconds

  const ICONS = {
    'play': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
    'pause': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
    'forward': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',
    'backward': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z"/></svg>',
    'step-forward': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>',
    'step-backward': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z"/></svg>',
    'volume-up': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
    'volume-mute': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
    'expand': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
    'compress': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',
    'check-circle': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'
  };

  // Default configuration
  const CONFIG = {
    MIN_VIDEO_DURATION: 60,
    DOUBLE_TAP_SEEK: 5,
    SWIPE_THRESHOLD: 25,
    SEEK_SENSITIVITY: 0.4,
    VOLUME_SENSITIVITY: 200,
    HAPTIC_FEEDBACK: true,
    HAPTIC_DURATION: 15,
    FORCE_LANDSCAPE: true,
    DOUBLE_TAP_TIMEOUT: 300,
    LONG_PRESS_DURATION: 450,
    LONG_PRESS_SPEED: 2.0,
    DEAD_ZONE_SIZE: 30, // pixels from edges
    GESTURE_TIMEOUT: 10000, // 10 seconds
    SWIPE_ZONES: { VOLUME: 0.33, FULLSCREEN: 0.67 },
    TAP_ZONES: { BACKWARD: 0.4, FORWARD: 0.6 },
    INDICATOR_UPDATE_THROTTLE: 80 // ms
  };

  // Load saved config
  let savedConfig = {};
  try {
    savedConfig = await GM_getValue('vg_config', {});
  } catch (e) {
    console.warn('[VideoGestures] Failed to load config:', e);
  }

  // Merge configs
  const settings = { ...CONFIG, ...savedConfig };

  // Save config function
  const saveConfig = async () => {
    try {
      await GM_setValue('vg_config', settings);
    } catch (e) {
      console.warn('[VideoGestures] Failed to save config:', e);
    }
  };

  // Register menu commands
  try {
    GM_registerMenuCommand('⚙️ Set Seek Time', async () => {
      const current = settings.DOUBLE_TAP_SEEK;
      const input = prompt(`Double-tap seek seconds (5-30):
Current: ${current}s`, current);
      if (input && !isNaN(input)) {
        const value = Math.max(5, Math.min(30, parseInt(input)));
        settings.DOUBLE_TAP_SEEK = value;
        await saveConfig();
        alert(`Seek time set to ${value}s`);
      }
    });

    GM_registerMenuCommand('⚡ Set Speed', async () => {
      const current = settings.LONG_PRESS_SPEED;
      const input = prompt(`Long-press speed (0.5-4):
Current: ${current}x`, current);
      if (input && !isNaN(input)) {
        const value = Math.max(0.5, Math.min(4, parseFloat(input)));
        settings.LONG_PRESS_SPEED = value;
        await saveConfig();
        alert(`Speed set to ${value}x`);
      }
    });

    GM_registerMenuCommand('🔄 Reset Settings', async () => {
      if (confirm('Reset all settings to defaults?')) {
        Object.assign(settings, CONFIG);
        await saveConfig();
        alert('Settings reset');
      }
    });
  } catch (e) {
    console.warn('[VideoGestures] Failed to register menu commands:', e);
  }

  // Format time helper
  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      return `${hours}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Cross-browser fullscreen helpers
  const getFullscreenElement = () => document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement;
  const requestFullscreen = (element) => {
    if (element.requestFullscreen) return element.requestFullscreen();
    if (element.mozRequestFullScreen) return element.mozRequestFullScreen();
    if (element.webkitRequestFullscreen) return element.webkitRequestFullscreen();
    return Promise.reject(new Error('Fullscreen API not supported'));
  };
  const exitFullscreenHelper = () => {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    return Promise.reject(new Error('Fullscreen API not supported'));
  };

  // Create styles
  const createStyles = () => {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* External fonts and icons removed for privacy and performance */
      #${INDICATOR_ID}, #${TOAST_ID} {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) scale(0.94) !important;
        padding: 12px 16px !important;
        background: linear-gradient(135deg, rgba(18,18,18,0.38), rgba(18,18,18,0.28)) !important;
        border: 1px solid rgba(255,255,255,0.14) !important;
        backdrop-filter: blur(14px) saturate(140%) !important;
        -webkit-backdrop-filter: blur(14px) saturate(140%) !important;
        color: rgba(255,255,255,0.96) !important;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        border-radius: 16px !important;
        z-index: 2147483647 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 10px !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.28s cubic-bezier(0.23, 1, 0.32, 1), transform 0.28s cubic-bezier(0.23, 1, 0.32, 1) !important;
        box-shadow:  0 18px 44px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255,255,255,.06) !important;
        text-shadow:  0 1px 1px rgba(0,0,0,.35) !important;
        user-select: none !important;
        white-space: nowrap !important;
      }

      #${INDICATOR_ID}.visible, #${TOAST_ID}.visible {
        opacity: 1 !important;
        transform: translate(-50%, -50%) scale(1) !important;
      }

      #${INDICATOR_ID} .vg-icon, #${TOAST_ID} .vg-icon {
        width: 24px !important;
        height: 24px !important;
        min-width: 24px !important;
        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.09)) !important;
      }

      #${INDICATOR_ID} .vg-icon svg, #${TOAST_ID} .vg-icon svg {
        width: 100% !important;
        height: 100% !important;
        display: block !important;
      }

      #${INDICATOR_ID} span, #${TOAST_ID} span {
        font-size: 15px !important;
        line-height: 1 !important;
      }

      #${INDICATOR_ID}.seeking {
        background: rgba(18, 18, 18, 0.09) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
      }

      #${INDICATOR_ID}.volume {
        background: rgba(18, 18, 18, 0.09) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
      }

      #${INDICATOR_ID}.speed {
        background: rgba(18, 18, 18, 0.09) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
      }

      #${INDICATOR_ID}.aspect {
        background: rgba(74, 144, 226, 0.15) !important;
        border: 1px solid rgba(74, 144, 226, 0.3) !important;
        color: rgba(255, 255, 255, 0.98) !important;
      }

      @media (prefers-reduced-motion: reduce) {
        #${INDICATOR_ID}, #${TOAST_ID} {
          transition: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  };

  // UI elements
  let indicator = null;
  let toast = null;
  let hideTimer = null;
  let toastTimer = null;

  // Memory management
  let activeVideos = new WeakSet();
  let videoTimers = new WeakMap();
  const videoOriginalStyles = new WeakMap();
  let periodicCleanupTimer = null;
  let lastActiveTime = Date.now();

  const createElements = () => {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = INDICATOR_ID;
      document.body.appendChild(indicator);
    }

    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }
  };

  const showIndicator = (iconName, text, type = '', sticky = false) => {
    if (!indicator) return;

    // Smooth transition by checking if already visible
    const wasVisible = indicator.classList.contains('visible');
    const iconSvg = ICONS[iconName] || '';

    indicator.innerHTML = `<span class="vg-icon">${iconSvg}</span><span>${text}</span>`;
    indicator.className = `visible ${type}`;

    // Add a small delay for content change if was already visible
    if (wasVisible) {
      indicator.style.opacity = '0.7';
      setTimeout(() => {
        if (indicator) indicator.style.opacity = '';
      }, 50);
    }

    clearTimeout(hideTimer);
    if (!sticky) {
      hideTimer = setTimeout(() => {
        if (indicator) {
          indicator.style.opacity = '0';
          setTimeout(() => {
            if (indicator) indicator.classList.remove('visible');
          }, 280); // Match CSS transition duration
        }
      }, 1000);
    }
  };

  const hideIndicator = () => {
    if (indicator) {
      indicator.style.opacity = '0';
      setTimeout(() => {
        if (indicator) {
          indicator.classList.remove('visible');
          indicator.style.opacity = '';
        }
      }, 280); // Match CSS transition duration
    }
  };

  const showToast = (iconName, text, duration = 1500) => {
    if (!toast) return;

    const iconSvg = ICONS[iconName] || '';
    toast.innerHTML = `<span class="vg-icon">${iconSvg}</span><span>${text}</span>`;
    toast.classList.add('visible');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toast) {
        toast.style.opacity = '0';
        setTimeout(() => {
          if (toast) {
            toast.classList.remove('visible');
            toast.style.opacity = '';
          }
        }, 280); // Match CSS transition duration
      }
    }, duration);
  };

  const attachToFullscreen = () => {
    const fsElement = getFullscreenElement();
    if (fsElement) {
      if (indicator && indicator.parentElement !== fsElement) {
        fsElement.appendChild(indicator);
      }
    }
    else {
      if (indicator && indicator.parentElement !== document.body) {
        document.body.appendChild(indicator);
      }
    }
  };

  // Dead zone detection
  const isInDeadZone = (x, y) => {
    const deadZone = settings.DEAD_ZONE_SIZE;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    return x < deadZone ||
           x > screenWidth - deadZone ||
           y < deadZone ||
           y > screenHeight - deadZone;
  };

  // Video activity tracking
  const trackVideoActivity = (video) => {
    if (!video || activeVideos.has(video)) return;

    activeVideos.add(video);
    lastActiveTime = Date.now();

    // Clear existing timer
    if (videoTimers.has(video)) {
      clearTimeout(videoTimers.get(video));
    }

    // Set cleanup timer
    const timer = setTimeout(() => {
      cleanupVideoTracking(video);
    }, settings.GESTURE_TIMEOUT);

    videoTimers.set(video, timer);
  };

  const cleanupVideoTracking = (video) => {
    activeVideos.delete(video);
    if (videoTimers.has(video)) {
      clearTimeout(videoTimers.get(video));
      videoTimers.delete(video);
    }
  };

  // Inactivity timer management
  const resetInactivityTimer = () => {
    lastActiveTime = Date.now();
    clearTimeout(inactivityTimer);

    inactivityTimer = setTimeout(() => {
      cleanupInactiveGestures();
    }, INACTIVE_TIMEOUT);
  };

  const cleanupInactiveGestures = () => {
    // Clean up video tracking for inactive videos
    for (const video of activeVideos) {
      if (video.paused || video.ended) {
        cleanupVideoTracking(video);
      }
    }
  };

  // Haptics
  const vibrate = () => {
    if (settings.HAPTIC_FEEDBACK && navigator.vibrate) {
      try {
        navigator.vibrate(settings.HAPTIC_DURATION);
      } catch (e) {
        // Ignore
      }
    }
  };

  // Video finder
  const findVideo = (targetElement, x, y) => {
    try {
      // Try fullscreen first
      if (getFullscreenElement()) {
        const video = getFullscreenElement().querySelector('video');
        if (video && isValidVideo(video)) {
          return { video, container: getFullscreenElement() };
        }
      }

      // Try target element
      if (targetElement) {
        const video = targetElement.closest('video');
        if (video && isValidVideo(video)) {
          return { video, container: findContainer(video) };
        }
      }

      // Try point search
      if (typeof x === 'number' && typeof y === 'number') {
        const element = document.elementFromPoint(x, y);
        if (element) {
          const video = element.closest('video');
          if (video && isValidVideo(video)) {
            return { video, container: findContainer(video) };
          }
        }
      }

      // Find largest video
      let largest = null;
      let maxArea = 0;

      document.querySelectorAll('video').forEach(video => {
        if (!isValidVideo(video)) return;
        const rect = video.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > maxArea) {
          maxArea = area;
          largest = video;
        }
      });

      return largest ? { video: largest, container: findContainer(largest) } : null;
    } catch (e) {
      console.warn('[VideoGestures] Video find error:', e);
      return null;
    }
  };

  const isValidVideo = (video) => {
    try {
      if (!video) {
        return false;
      }

      if (video.readyState < 1) {
        return false;
      }

      const rect = video.getBoundingClientRect();
      if (rect.width < 200 || rect.height < 150) {
        return false;
      }

      // Allow paused videos for gesture detection
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        return false;
      }

      // Check if video is not stale (hasn't been inactive too long)
      const now = Date.now();
      if (video.ended || (video.paused && now - lastActiveTime > settings.GESTURE_TIMEOUT)) {
        cleanupVideoTracking(video);
        return false;
      }

      return true;
    } catch (e) {
      console.error('[VideoGestures] Video validation error:', e);
      return false;
    }
  };

  const findContainer = (video) => {
    try {
      const selectors = [
        '.html5-video-player',
        '.player',
        '.video-js',
        '[data-vjs-player]',
        '.jwplayer'
      ];

      for (const selector of selectors) {
        const container = video.closest(selector);
        if (container) return container;
      }

      return video.parentElement || document.body;
    } catch (e) {
      return video.parentElement || document.body;
    }
  };

  // Gesture state
  let gestureState = null;
  let lastTap = { time: 0, count: 0 };
  let longPressTimer = null;
  let inactivityTimer = null;
  let touchInProgress = false; // To prevent mouse events on touch

  // Desktop gesture state
  let mouseState = null;
  let longPressMouseTimer = null;

  // Pinch gesture state
  let pinchState = null;
  let pinchGestureActive = false;
  const PINCH_THRESHOLD = 20; // Minimum distance change to trigger pinch
  const PINCH_MIN_DISTANCE = 50; // Minimum distance between fingers
  const PINCH_TIMEOUT = 200; // Time to wait before considering pinch ended

  // Pinch gesture handlers
  const handlePinchStart = (e) => {
    try {
      if (!getFullscreenElement()) {
        return;
      }

      if (e.touches.length !== 2) return;

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const result = findVideo(e.target,
        (touch1.clientX + touch2.clientX) / 2,
        (touch1.clientY + touch2.clientY) / 2
      );

      if (!result?.video) {
        return;
      }

      // Prevent conflicts with single-touch gestures
      if (gestureState) {
        clearTimeout(longPressTimer);
        gestureState = null;
      }

      e.preventDefault();
      e.stopPropagation();

      const initialDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      if (initialDistance < PINCH_MIN_DISTANCE) {
        return;
      }

      pinchState = {
        video: result.video,
        container: result.container,
        initialDistance,
        currentDistance: initialDistance,
        startTime: Date.now(),
        touch1: { x: touch1.clientX, y: touch1.clientY },
        touch2: { x: touch2.clientX, y: touch2.clientY },
        hasTriggered: false,
        aspectRatio: getCurrentAspectRatio(result.video)
      };

      pinchGestureActive = true;

      // Track video activity
      trackVideoActivity(result.video);
      resetInactivityTimer();

    } catch (e) {
      console.error('[VideoGestures] Pinch start error:', e);
    }
  };

  const handlePinchMove = (e) => {
    try {
      if (!pinchState || e.touches.length !== 2) return;

      e.preventDefault();
      e.stopPropagation();

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      pinchState.currentDistance = currentDistance;

      const distanceChange = currentDistance - pinchState.initialDistance;
      const changePercent = Math.abs(distanceChange) / pinchState.initialDistance;

      // Update touch positions for stability check
      pinchState.touch1 = { x: touch1.clientX, y: touch1.clientY };
      pinchState.touch2 = { x: touch2.clientX, y: touch2.clientY };

      // Trigger aspect ratio change if threshold is met
      if (changePercent > 0.15 && !pinchState.hasTriggered) { // 15% change threshold
        pinchState.hasTriggered = true;

        if (distanceChange > 0) {
          // Pinch out - switch to fill/zoom mode
          setVideoAspectRatio(pinchState.video, 'fill');
          showIndicator('expand', 'Fill Screen', 'aspect');
        } else {
          // Pinch in - switch to fit/normal mode
          setVideoAspectRatio(pinchState.video, 'fit');
          showIndicator('compress', 'Fit Screen', 'aspect');
        }

        vibrate();
      }

      resetInactivityTimer();

    } catch (e) {
      console.error('[VideoGestures] Pinch move error:', e);
    }
  };

  const handlePinchEnd = (e) => {
    try {
      if (!pinchState) return;

      pinchState = null;
      pinchGestureActive = false;

    } catch (e) {
      console.error('[VideoGestures] Pinch end error:', e);
    }
  };

  // Video aspect ratio management
  const getCurrentAspectRatio = (video) => {
    try {
      const style = getComputedStyle(video);
      return style.objectFit || 'fill';
    } catch (e) {
      return 'fill';
    }
  };

  const setVideoAspectRatio = (video, mode) => {
    try {
      if (!video) return;

      // Store original styles if not already stored
      if (!videoOriginalStyles.has(video)) {
        videoOriginalStyles.set(video, {
          objectFit: getComputedStyle(video).objectFit || 'fill',
          objectPosition: getComputedStyle(video).objectPosition || 'center'
        });
      }

      switch (mode) {
        case 'fill':
          // Fill entire screen, may crop content
          video.style.objectFit = 'cover';
          video.style.objectPosition = 'center';
          video.style.width = '100%';
          video.style.height = '100%';
          break;

        case 'fit':
          // Fit entire video, may show black bars
          video.style.objectFit = 'contain';
          video.style.objectPosition = 'center';
          video.style.width = '100%';
          video.style.height = '100%';
          break;

        case 'original':
          // Restore original aspect ratio
          const originalStyles = videoOriginalStyles.get(video);
          if (originalStyles) {
            video.style.objectFit = originalStyles.objectFit;
            video.style.objectPosition = originalStyles.objectPosition;
          }
          video.style.width = '';
          video.style.height = '';
          break;
      }

    } catch (e) {
      console.error('[VideoGestures] Aspect ratio change error:', e);
    }
  };

  // Helper to check for interactive UI elements
  const isInteractive = (element) => {
    if (!element) return false;
    const interactiveSelectors = [
      'button', 'a', 'input', 'textarea', 'select',
      '[role="button"]', '[role="checkbox"]', '[role="radio"]', '[role="slider"]', '[role="tab"]', '[role="menu"]',
      // Common player control selectors
      '.jw-controls', '.vjs-control-bar', '.ytp-chrome-bottom',
      '.player-controls', '.media-controls', '.control-bar', '.controls'
    ];
    if (element.closest(interactiveSelectors.join(','))) {
      return true;
    }
    return false;
  };

  // Touch handlers (updated for pinch support)
  const onTouchStart = (e) => {
    try {
      touchInProgress = true;
      // Handle multi-touch for pinch gestures
      if (e.touches.length === 2) {
        handlePinchStart(e);
        return;
      } else if (e.touches.length > 2) {
        return;
      }

      const touch = e.touches[0];

      // If touch starts on an interactive element, ignore the gesture to allow UI interaction.
      if (isInteractive(touch.target)) {
        return;
      }

      const result = findVideo(e.target, touch.clientX, touch.clientY);

      if (!result?.video) {
        return;
      }

      if (result.video.duration < settings.MIN_VIDEO_DURATION) {
        return;
      }

      // By not calling preventDefault or stopPropagation here, we allow simple taps
      // to be processed by the underlying player for play/pause functionality.
      // The gesture is "claimed" in onTouchMove if the user starts swiping.

      gestureState = {
        video: result.video,
        container: result.container,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        isSwipe: false,
        action: null,
        claimed: false, // Property to track if the gesture is claimed
        originalPlaybackRate: result.video.playbackRate,
        initialVolume: result.video.volume,
        baseCurrentTime: result.video.currentTime,
        lastIndicatorUpdate: 0
      };

      // Double-tap detection
      const now = Date.now();
      if (now - lastTap.time < settings.DOUBLE_TAP_TIMEOUT) {
        lastTap.count++;
      } else {
        lastTap.count = 1;
      }
      lastTap.time = now;

      // Check for dead zones
      if (isInDeadZone(touch.clientX, touch.clientY)) {
        return;
      }

      // Long-press setup (only if video is playing)
      if (getFullscreenElement() && !result.video.paused) {
        longPressTimer = setTimeout(() => {
          if (!gestureState || gestureState.isSwipe) return;

          const moved = Math.hypot(
            gestureState.lastX - gestureState.startX,
            gestureState.lastY - gestureState.startY
          );

          if (moved > 10) return;

          gestureState.action = 'long-press-speed';
          gestureState.video.playbackRate = settings.LONG_PRESS_SPEED;
          showIndicator('forward', `${settings.LONG_PRESS_SPEED}x`, 'speed', true);
          vibrate();
        }, settings.LONG_PRESS_DURATION);
      }

      // Track video activity
      trackVideoActivity(result.video);

      // Reset inactivity timer
      resetInactivityTimer();
    } catch (e) {
      console.error('[VideoGestures] Touch start error:', e);
    }
  };

  const onTouchMove = (e) => {
    try {
      // Handle pinch gesture movement
      if (e.touches.length === 2 && pinchState) {
        handlePinchMove(e);
        return;
      }

      if (!gestureState || e.touches.length > 1) {
        return;
      }

      // Reset inactivity timer on movement
      resetInactivityTimer();

      const touch = e.touches[0];
      const dx = touch.clientX - gestureState.startX;
      const dy = touch.clientY - gestureState.startY;
      const distance = Math.hypot(dx, dy);

      // Claim the gesture early to prevent conflicts with native player gestures and browser actions.
      if (getFullscreenElement() && distance > 10 && !gestureState.claimed) {
        e.preventDefault();
        e.stopPropagation();
        gestureState.claimed = true;
      }

      gestureState.lastX = touch.clientX;
      gestureState.lastY = touch.clientY;

      if (!gestureState.isSwipe && distance > settings.SWIPE_THRESHOLD) {
        clearTimeout(longPressTimer);
        lastTap.count = 0;
        gestureState.isSwipe = true;

        if (gestureState.action === 'long-press-speed') {
          gestureState.video.playbackRate = gestureState.originalPlaybackRate;
          hideIndicator();
        }

        if (getFullscreenElement()) {
          determineAction(dx, dy);
        }
      }

      if (gestureState.isSwipe && getFullscreenElement()) {
        handleSwipeAction(dx, dy);
      }
    } catch (e) {
      console.error('[VideoGestures] Touch move error:', e);
    }
  };

  const onTouchEnd = (e) => {
    try {
      // Handle pinch gesture end
      if (pinchState && e.touches.length < 2) {
        handlePinchEnd(e);
        return;
      }

      if (!gestureState) return;

      clearTimeout(longPressTimer);

      if (gestureState.action === 'long-press-speed') {
        e.stopPropagation();
        gestureState.video.playbackRate = gestureState.originalPlaybackRate;
        hideIndicator();
      } else if (gestureState.isSwipe) {
        e.stopPropagation();
        handleSwipeEnd();
      } else {
        // This is a tap or double tap
        if (lastTap.count >= 2) {
          // This is a double tap, handle it and stop propagation to prevent conflicts
          e.preventDefault();
          e.stopPropagation();
          handleTap();
        }
        // For single taps, do nothing and let the event propagate to the player
      }

      gestureState = null;
    } catch (e) {
      console.warn('[VideoGestures] Touch end error:', e);
      gestureState = null;
    }
    setTimeout(() => { touchInProgress = false; }, 300);
  };

  const onContextMenu = (e) => {
    if (gestureState || pinchGestureActive) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Desktop mouse handlers
  const onMouseDown = (e) => {
    if (touchInProgress || e.button !== 0 || e.isPrimary === false) return;
    if (isInteractive(e.target)) return;

    const result = findVideo(e.target, e.clientX, e.clientY);
    if (!result?.video || result.video.duration < settings.MIN_VIDEO_DURATION) return;

    mouseState = {
      video: result.video,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      action: null,
      originalPlaybackRate: result.video.playbackRate,
    };

    clearTimeout(longPressMouseTimer);
    longPressMouseTimer = setTimeout(() => {
      if (!mouseState || mouseState.moved) return;

      mouseState.action = 'long-press-speed';
      mouseState.video.playbackRate = settings.LONG_PRESS_SPEED;
      showIndicator('forward', `${settings.LONG_PRESS_SPEED}x`, 'speed', true);
      vibrate();
    }, settings.LONG_PRESS_DURATION);
  };

  const onMouseMove = (e) => {
    if (!mouseState || mouseState.moved) return;

    const moved = Math.hypot(e.clientX - mouseState.startX, e.clientY - mouseState.startY);
    if (moved > 10) {
      mouseState.moved = true;
      clearTimeout(longPressMouseTimer);
    }
  };

  const onMouseUp = (e) => {
    if (e.button !== 0 || !mouseState) return;

    clearTimeout(longPressMouseTimer);
    if (mouseState.action === 'long-press-speed') {
      mouseState.video.playbackRate = mouseState.originalPlaybackRate;
      hideIndicator();
    }
    mouseState = null;
  };

  // Keyboard handler
  const onKeyDown = (e) => {
    if (e.target.matches('input, textarea, [contenteditable]')) return;

    const fsVideo = getFullscreenElement()?.querySelector('video');
    const result = fsVideo ? { video: fsVideo } : findVideo(document.activeElement, window.innerWidth / 2, window.innerHeight / 2);

    if (!result?.video) return;

    const { video } = result;
    const seekTime = settings.DOUBLE_TAP_SEEK;
    let handled = false;

    switch (e.key) {
      case 'ArrowLeft':
        video.currentTime = Math.max(0, video.currentTime - seekTime);
        showIndicator('step-backward', `-${seekTime}s`);
        vibrate();
        handled = true;
        break;
      case 'ArrowRight':
        video.currentTime = Math.min(video.duration, video.currentTime + seekTime);
        showIndicator('step-forward', `+${seekTime}s`);
        vibrate();
        handled = true;
        break;
      case 'ArrowUp':
        const newVolumeUp = Math.min(1, video.volume + 0.05);
        video.volume = newVolumeUp;
        video.muted = newVolumeUp < 0.01;
        showIndicator(video.muted ? 'volume-mute' : 'volume-up', `${Math.round(newVolumeUp * 100)}%`, 'volume');
        vibrate();
        handled = true;
        break;
      case 'ArrowDown':
        const newVolumeDown = Math.max(0, video.volume - 0.05);
        video.volume = newVolumeDown;
        video.muted = newVolumeDown < 0.01;
        showIndicator(video.muted ? 'volume-mute' : 'volume-up', `${Math.round(newVolumeDown * 100)}%`, 'volume');
        vibrate();
        handled = true;
        break;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const determineAction = (dx, dy) => {
    try {
      const rect = gestureState.video.getBoundingClientRect();
      const zoneX = (gestureState.startX - rect.left) / rect.width;
      const isVertical = Math.abs(dy) > Math.abs(dx);

      if (isVertical) {
        if (zoneX < settings.SWIPE_ZONES.VOLUME) {
          gestureState.action = 'volume';
        } else if (zoneX > settings.SWIPE_ZONES.VOLUME && zoneX < settings.SWIPE_ZONES.FULLSCREEN) {
          gestureState.action = 'fullscreen';
        } else {
          gestureState.action = 'none';
        }
      }
      else {
        if (Number.isFinite(gestureState.video.duration)) {
          gestureState.action = 'seeking';
        } else {
          showIndicator('play', 'Live Stream');
          gestureState.action = 'none';
        }
      }
    } catch (e) {
      console.error('[VideoGestures] Determine action error:', e);
    }
  };

  const handleSwipeAction = (dx, dy) => {
    try {
      switch (gestureState.action) {
        case 'seeking':
          handleSeeking(dx);
          break;
        case 'volume':
          handleVolume(dy);
          break;
        case 'none':
          // Do nothing for right zone or unsupported gestures
          break;
      }
    } catch (e) {
      console.error('[VideoGestures] Swipe action error:', e);
    }
  };

  const handleSeeking = (dx) => {
    try {
      if (!Number.isFinite(gestureState.video.duration)) return;

      let seekAmount = dx * settings.SEEK_SENSITIVITY;
      seekAmount = Math.max(-120, Math.min(120, seekAmount));

      const newTime = Math.max(0, Math.min(
        gestureState.video.duration,
        gestureState.baseCurrentTime + seekAmount
      ));

      gestureState.video.currentTime = newTime;

      const now = Date.now();
      if (now - gestureState.lastIndicatorUpdate > settings.INDICATOR_UPDATE_THROTTLE) {
        const icon = seekAmount >= 0 ? 'forward' : 'backward';
        showIndicator(icon, formatTime(newTime), 'seeking');
        gestureState.lastIndicatorUpdate = now;
      }
    } catch (e) {
      console.warn('[VideoGestures] Seeking error:', e);
    }
  };

  const handleVolume = (dy) => {
    try {
      const change = -dy / settings.VOLUME_SENSITIVITY;
      const newVolume = Math.max(0, Math.min(1, gestureState.initialVolume + change));

      gestureState.video.volume = newVolume;
      gestureState.video.muted = newVolume < 0.01;

      const now = Date.now();
      if (now - gestureState.lastIndicatorUpdate > settings.INDICATOR_UPDATE_THROTTLE) {
        const icon = newVolume < 0.01 ? 'volume-mute' : 'volume-up';
        const text = newVolume < 0.01 ? 'Muted' : `${Math.round(newVolume * 100)}%`;
        showIndicator(icon, text, 'volume');
        gestureState.lastIndicatorUpdate = now;
      }
    } catch (e) {
      console.warn('[VideoGestures] Volume error:', e);
    }
  };

  const handleSwipeEnd = () => {
    try {
      if (gestureState.action === 'volume' || gestureState.action === 'seeking') {
        vibrate();
      } else if (gestureState.action === 'fullscreen') {
        const dy = gestureState.lastY - gestureState.startY;
        if (dy > settings.SWIPE_THRESHOLD * 1.5) {
          exitFullscreen();
        }
      }
    } catch (e) {
      console.warn('[VideoGestures] Swipe end error:', e);
    }
  };

  const handleTap = () => {
    try {
      if (lastTap.count >= 2) {
        if (getFullscreenElement()) {
          handleDoubleTapSeek();
        } else {
          toggleFullscreen();
        }
        lastTap = { time: 0, count: 0 };
      }
    } catch (e) {
      console.error('[VideoGestures] Tap error:', e);
    }
  };

  const handleDoubleTapSeek = () => {
    try {
      const rect = gestureState.video.getBoundingClientRect();
      const zone = (gestureState.startX - rect.left) / rect.width;
      const seekTime = settings.DOUBLE_TAP_SEEK;

      if (zone < settings.TAP_ZONES.BACKWARD) {
        gestureState.video.currentTime -= seekTime;
        showIndicator('step-backward', `-${seekTime}s`);
      } else if (zone > settings.TAP_ZONES.FORWARD) {
        gestureState.video.currentTime += seekTime;
        showIndicator('step-forward', `+${seekTime}s`);
      } else {
        if (gestureState.video.paused) {
          const playPromise = gestureState.video.play();
          if (playPromise && playPromise.catch) {
            playPromise.catch(() => {});
          }
          showIndicator('play', 'Play');
        } else {
          gestureState.video.pause();
          showIndicator('pause', 'Pause');
        }
      }

      vibrate();
    } catch (e) {
      console.warn('[VideoGestures] Double tap error:', e);
    }
  };

  const exitFullscreen = () => {
    try {
      if (getFullscreenElement()) {
        exitFullscreenHelper().catch(() => {}); // Ignore errors
        showIndicator('compress', 'Exit Fullscreen');
        vibrate();
      }
    }
    catch (e) {
      console.warn('[VideoGestures] Exit fullscreen error:', e);
    }
  };

  const toggleFullscreen = () => {
    try {
      const isFullscreen = !!getFullscreenElement();

      if (isFullscreen) {
        exitFullscreen();
      } else {
        const element = gestureState?.container || document.documentElement;
        requestFullscreen(element).catch(() => {}); // Ignore errors, fire and forget

        showIndicator('expand', 'Enter Fullscreen');

        if (settings.FORCE_LANDSCAPE && gestureState?.video) {
          const { videoWidth, videoHeight } = gestureState.video;
          if (videoWidth > videoHeight && screen.orientation) {
            setTimeout(() => {
              screen.orientation.lock('landscape').catch(() => {});
            }, 100);
          }
        }

        vibrate();
      }
    } catch (e) {
      console.warn('[VideoGestures] Toggle fullscreen error:', e);
    }
  };

  const onFullscreenChange = () => {
    try {
      attachToFullscreen();
      if (!getFullscreenElement() && screen.orientation) {
        screen.orientation.unlock().catch(() => {});
      }
    } catch (e) {
      console.warn('[VideoGestures] Fullscreen change error:', e);
    }
  };

  // Check for videos and show ready message
  let readyShown = false;
  const checkForVideos = () => {
    if (readyShown) return;

    try {
      const videos = document.querySelectorAll('video');
      for (const video of videos) {
        if (isValidVideo(video) && video.duration >= settings.MIN_VIDEO_DURATION) {
          readyShown = true;
          showToast('check-circle', 'Gestures Ready');
          break;
        }
      }
    } catch (e) {
      console.error('[VideoGestures] Video check error:', e);
    }
  };

  // Cleanup
  const cleanup = () => {
    try {
      // Clear all timers
      clearTimeout(longPressTimer);
      clearTimeout(longPressMouseTimer);
      clearTimeout(hideTimer);
      clearTimeout(toastTimer);
      clearTimeout(inactivityTimer);
      clearInterval(periodicCleanupTimer);

      // Clear video timers
      for (const timer of videoTimers.values()) {
        clearTimeout(timer);
      }
      videoTimers.clear();

      // Clear WeakSet references
      activeVideos = new WeakSet();

      // Clear pinch state
      pinchState = null;
      pinchGestureActive = false;

      document.removeEventListener('touchstart', onTouchStart, true);
      document.removeEventListener('touchmove', onTouchMove, true);
      document.removeEventListener('touchend', onTouchEnd, true);
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('mouseup', onMouseUp, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);

      document.getElementById(STYLE_ID)?.remove();
      indicator?.remove();
      toast?.remove();

      gestureState = null;
      mouseState = null;
    } catch (e) {
      console.warn('[VideoGestures] Cleanup error:', e);
    }
  };

  // Initialize
  const init = () => {
    try {
      createStyles();
      createElements();

      // Touch gestures
      document.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
      document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
      document.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });

      // Desktop gestures
      document.addEventListener('mousedown', onMouseDown, { capture: true });
      document.addEventListener('mousemove', onMouseMove, { capture: true });
      document.addEventListener('mouseup', onMouseUp, { capture: true });
      document.addEventListener('keydown', onKeyDown, { capture: true });

      // Common
      document.addEventListener('contextmenu', onContextMenu, { capture: true });
      document.addEventListener('fullscreenchange', onFullscreenChange, { passive: true });
      document.addEventListener('mozfullscreenchange', onFullscreenChange, { passive: true });
      document.addEventListener('webkitfullscreenchange', onFullscreenChange, { passive: true });

      window.addEventListener('beforeunload', cleanup);
      window.addEventListener('pagehide', cleanup);

      // Watch for videos
      let debounceTimer;
      const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(checkForVideos, 300);
      });
      observer.observe(document.body, { childList: true, subtree: true });

      // Initial check
      checkForVideos();

      // Start inactivity monitoring
      resetInactivityTimer();

      // Periodic cleanup for memory management
      periodicCleanupTimer = setInterval(() => {
        cleanupInactiveGestures();
      }, 30000); // Every 30 seconds

    } catch (e) {
      console.error('[VideoGestures] Initialization failed:', e);
    }
  };

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

})();
