// ==UserScript==
// @name          Video Touch Gestures
// @namespace     https://github.com/itsrody/SuperBrowsing
// @version       2.2.0
// @icon          data:image/svg+xml;base64, PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NDAgNjQwIj48IS0tIUZvbnQgQXdlc29tZSBGcmVlIDcuMC4wIGJ5IEBmb250YXdlc29tZSAtIGh0dHBzOi8vZm9udGF3ZXNvbWUuY29tIExpY2Vuc2UgLSBodHRwczovL2ZvbnRhd2Vzb21lLmNvbS9saWNlbnNlL2ZyZWUgQ29weXJpZ2h0IDIwMjUgRm9udGljb25zLCBJbmMuLS0+PHBhdGggZmlsbD0iIzc0QzBGQyIgZD0iTTY0IDMyMEM2NCAxNzguNiAxNzguNiA2NCAzMjAgNjRDNDYxLjQgNjQgNTc2IDE3OC42IDU3NiAzMjBDNTc2IDQ2MS40IDQ2MS40IDU3NiAzMjAgNTc2QzE3OC42IDU3NiA2NCA0NjEuNCA2NCAzMjB6TTI1Mi4zIDIxMS4xQzI0NC43IDIxNS4zIDI0MCAyMjMuNCAyNDAgMjMyTDI0MCA0MDhDMjQwIDQxNi43IDI0NC43IDQyNC43IDI1Mi4zIDQyOC45QzI1OS45IDQzMy4xIDI2OS4xIDQzMyAyNzYuNiA0MjguNEw0MjAuNiAzNDAuNEM0MjcuNyAzMzYgNDMyLjEgMzI4LjMgNDMyLjEgMzE5LjlDNDMyLjEgMzExLjUgNDI3LjcgMzAzLjggNDIwLjYgMjk5LjRMMjc2LjYgMjExLjRDMjY5LjIgMjA2LjkgMjU5LjkgMjA2LjcgMjUyLjMgMjEwLjl6Ii8+PC9zdmc+
// @description   Optimized video gesture interface with Font Awesome icons, improved performance, and pinch-to-zoom aspect ratio control
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

(() => {
  'use strict';

  // Check if mobile device
  const isMobile = () => {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
           (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  };

  // Exit early if not mobile
  if (!isMobile()) {
    console.log('[VideoGestures] Not a mobile device, exiting');
    return;
  }

  console.log('[VideoGestures] Starting initialization with pinch gesture support...');

  // Constants
  const STYLE_ID = 'vg-styles';
  const INDICATOR_ID = 'vg-indicator';
  const TOAST_ID = 'vg-toast';
  const INACTIVE_TIMEOUT = 5000; // 5 seconds

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
    GESTURE_TIMEOUT: 10000 // 10 seconds
  };

  // Load saved config
  let savedConfig = {};
  try {
    savedConfig = GM_getValue('vg_config', {});
    console.log('[VideoGestures] Config loaded');
  } catch (e) {
    console.warn('[VideoGestures] Failed to load config:', e);
  }

  // Merge configs
  const settings = { ...CONFIG, ...savedConfig };

  // Save config function
  const saveConfig = () => {
    try {
      GM_setValue('vg_config', settings);
    } catch (e) {
      console.warn('[VideoGestures] Failed to save config:', e);
    }
  };

  // Register menu commands
  try {
    GM_registerMenuCommand('⚙️ Set Seek Time', () => {
      const current = settings.DOUBLE_TAP_SEEK;
      const input = prompt(`Double-tap seek seconds (5-30):\nCurrent: ${current}s`, current);
      if (input && !isNaN(input)) {
        const value = Math.max(5, Math.min(30, parseInt(input)));
        settings.DOUBLE_TAP_SEEK = value;
        saveConfig();
        alert(`Seek time set to ${value}s`);
      }
    });

    GM_registerMenuCommand('⚡ Set Speed', () => {
      const current = settings.LONG_PRESS_SPEED;
      const input = prompt(`Long-press speed (0.5-4):\nCurrent: ${current}x`, current);
      if (input && !isNaN(input)) {
        const value = Math.max(0.5, Math.min(4, parseFloat(input)));
        settings.LONG_PRESS_SPEED = value;
        saveConfig();
        alert(`Speed set to ${value}x`);
      }
    });

    GM_registerMenuCommand('🔄 Reset Settings', () => {
      if (confirm('Reset all settings to defaults?')) {
        Object.assign(settings, CONFIG);
        saveConfig();
        alert('Settings reset');
      }
    });

    console.log('[VideoGestures] Menu commands registered');
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

  // Create styles
  const createStyles = () => {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');
      @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css');
      
      #${INDICATOR_ID}, #${TOAST_ID} {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) scale(0.94) !important;
        padding: 12px 16px !important;
        background: linear-gradient(135deg, rgba(18,18,18,0.38), rgba(18,18,18,0.28)) !important;
        border: 1px solid rgba(255,255,255,0.14) !important;
        backdrop-filter: blur(14px) saturate(140%) !important;
        -webkit-backdrop-filter: blur(12px) saturate(140%) !important;
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

      #${INDICATOR_ID} i, #${TOAST_ID} i {
        font-size: 24px !important;
        min-width: 24px !important;
        text-align: center !important;
        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.09)) !important;
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
    console.log('[VideoGestures] Styles created with pinch gesture support');
  };

  // UI elements
  let indicator = null;
  let toast = null;
  let hideTimer = null;
  let toastTimer = null;
  
  // Memory management
  let activeVideos = new WeakSet();
  let videoTimers = new WeakMap();
  let gestureTimers = new Map();
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
    
    console.log('[VideoGestures] UI elements created');
  };

  const showIndicator = (iconClass, text, type = '', sticky = false) => {
    if (!indicator) return;

    // Smooth transition by checking if already visible
    const wasVisible = indicator.classList.contains('visible');
    
    indicator.innerHTML = `<i class="${iconClass}"></i><span>${text}</span>`;
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

  const showToast = (iconClass, text, duration = 1500) => {
    if (!toast) return;

    toast.innerHTML = `<i class="${iconClass}"></i><span>${text}</span>`;
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
    const fsElement = document.fullscreenElement;
    if (fsElement) {
      if (indicator && indicator.parentElement !== fsElement) {
        fsElement.appendChild(indicator);
      }
    } else {
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
    
    console.log('[VideoGestures] Video activity tracked');
  };
  
  const cleanupVideoTracking = (video) => {
    activeVideos.delete(video);
    if (videoTimers.has(video)) {
      clearTimeout(videoTimers.get(video));
      videoTimers.delete(video);
    }
    console.log('[VideoGestures] Video tracking cleaned up');
  };
  
  // Inactivity timer management
  const resetInactivityTimer = () => {
    lastActiveTime = Date.now();
    clearTimeout(inactivityTimer);
    
    inactivityTimer = setTimeout(() => {
      console.log('[VideoGestures] Cleaning up inactive gestures');
      cleanupInactiveGestures();
    }, INACTIVE_TIMEOUT);
  };
  
  const cleanupInactiveGestures = () => {
    const now = Date.now();
    
    // Clear old gesture timers
    for (const [key, timer] of gestureTimers.entries()) {
      clearTimeout(timer);
      gestureTimers.delete(key);
    }
    
    // Clean up video tracking for inactive videos
    for (const video of activeVideos) {
      if (video.paused || video.ended) {
        cleanupVideoTracking(video);
      }
    }
    
    console.log('[VideoGestures] Inactive gestures cleaned up');
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
      if (document.fullscreenElement) {
        const video = document.fullscreenElement.querySelector('video');
        if (video && isValidVideo(video)) {
          return { video, container: document.fullscreenElement };
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
        console.log('[VideoGestures] No video element');
        return false;
      }
      
      if (video.readyState < 1) {
        console.log('[VideoGestures] Video not ready, readyState:', video.readyState);
        return false;
      }

      const rect = video.getBoundingClientRect();
      console.log('[VideoGestures] Video rect:', rect.width, 'x', rect.height);
      
      if (rect.width < 200 || rect.height < 150) {
        console.log('[VideoGestures] Video too small');
        return false;
      }

      console.log('[VideoGestures] Video duration:', video.duration, 'paused:', video.paused);
      
      // Allow paused videos for gesture detection
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        console.log('[VideoGestures] Invalid duration');
        return false;
      }
      
      // Check if video is not stale (hasn't been inactive too long)
      const now = Date.now();
      if (video.ended || (video.paused && now - lastActiveTime > settings.GESTURE_TIMEOUT)) {
        console.log('[VideoGestures] Video is stale or ended');
        cleanupVideoTracking(video);
        return false;
      }

      console.log('[VideoGestures] Video is valid');
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
  
  // Pinch gesture state
  let pinchState = null;
  let pinchGestureActive = false;
  const PINCH_THRESHOLD = 20; // Minimum distance change to trigger pinch
  const PINCH_MIN_DISTANCE = 50; // Minimum distance between fingers
  const PINCH_TIMEOUT = 200; // Time to wait before considering pinch ended

  // Pinch gesture handlers
  const handlePinchStart = (e) => {
    try {
      if (!document.fullscreenElement) {
        console.log('[VideoGestures] Pinch gesture only available in fullscreen');
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
        console.log('[VideoGestures] No valid video found for pinch gesture');
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
        console.log('[VideoGestures] Fingers too close together for pinch gesture');
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
      console.log('[VideoGestures] Pinch gesture started, initial distance:', initialDistance);
      
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
      
      console.log('[VideoGestures] Pinch distance change:', distanceChange, 'percent:', changePercent);
      
      // Trigger aspect ratio change if threshold is met
      if (changePercent > 0.15 && !pinchState.hasTriggered) { // 15% change threshold
        pinchState.hasTriggered = true;
        
        if (distanceChange > 0) {
          // Pinch out - switch to fill/zoom mode
          console.log('[VideoGestures] Pinch out detected - switching to fill mode');
          setVideoAspectRatio(pinchState.video, 'fill');
          showIndicator('fas fa-expand-arrows-alt', 'Fill Screen', 'aspect');
        } else {
          // Pinch in - switch to fit/normal mode
          console.log('[VideoGestures] Pinch in detected - switching to fit mode');
          setVideoAspectRatio(pinchState.video, 'fit');
          showIndicator('fas fa-compress-arrows-alt', 'Fit Screen', 'aspect');
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
      
      console.log('[VideoGestures] Pinch gesture ended');
      
      // Clean up pinch state
      const endTime = Date.now();
      const duration = endTime - pinchState.startTime;
      
      console.log('[VideoGestures] Pinch duration:', duration, 'ms, triggered:', pinchState.hasTriggered);
      
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
      const objectFit = style.objectFit || 'fill';
      return objectFit;
    } catch (e) {
      return 'fill';
    }
  };
  
  const setVideoAspectRatio = (video, mode) => {
    try {
      if (!video) return;
      
      // Store original styles if not already stored
      if (!video._originalObjectFit) {
        video._originalObjectFit = getComputedStyle(video).objectFit || 'fill';
        video._originalObjectPosition = getComputedStyle(video).objectPosition || 'center';
      }
      
      switch (mode) {
        case 'fill':
          // Fill entire screen, may crop content
          video.style.objectFit = 'cover';
          video.style.objectPosition = 'center';
          video.style.width = '100%';
          video.style.height = '100%';
          console.log('[VideoGestures] Video set to fill mode');
          break;
          
        case 'fit':
          // Fit entire video, may show black bars
          video.style.objectFit = 'contain';
          video.style.objectPosition = 'center';
          video.style.width = '100%';
          video.style.height = '100%';
          console.log('[VideoGestures] Video set to fit mode');
          break;
          
        case 'original':
          // Restore original aspect ratio
          video.style.objectFit = video._originalObjectFit || 'fill';
          video.style.objectPosition = video._originalObjectPosition || 'center';
          video.style.width = '';
          video.style.height = '';
          console.log('[VideoGestures] Video restored to original mode');
          break;
      }
      
    } catch (e) {
      console.error('[VideoGestures] Aspect ratio change error:', e);
    }
  };

  // Touch handlers (updated for pinch support)
  const onTouchStart = (e) => {
    try {
      console.log('[VideoGestures] Touch start detected');
      
      // Handle multi-touch for pinch gestures
      if (e.touches.length === 2) {
        console.log('[VideoGestures] Two-finger touch detected, checking for pinch gesture');
        handlePinchStart(e);
        return;
      } else if (e.touches.length > 2) {
        console.log('[VideoGestures] More than 2 touches detected, ignoring');
        return;
      }

      const touch = e.touches[0];
      console.log('[VideoGestures] Touch coordinates:', touch.clientX, touch.clientY);
      
      const result = findVideo(e.target, touch.clientX, touch.clientY);
      console.log('[VideoGestures] Video search result:', result);
      
      if (!result?.video) {
        console.log('[VideoGestures] No valid video found');
        return;
      }

      if (result.video.duration < settings.MIN_VIDEO_DURATION) {
        console.log('[VideoGestures] Video too short:', result.video.duration);
        return;
      }

      console.log('[VideoGestures] Valid video found, setting up gesture state');
      e.stopPropagation();

      gestureState = {
        video: result.video,
        container: result.container,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        isSwipe: false,
        action: null,
        originalPlaybackRate: result.video.playbackRate,
        initialVolume: result.video.volume,
        baseCurrentTime: result.video.currentTime
      };

      // Double-tap detection
      const now = Date.now();
      if (now - lastTap.time < settings.DOUBLE_TAP_TIMEOUT) {
        lastTap.count++;
      } else {
        lastTap.count = 1;
      }
      lastTap.time = now;
      console.log('[VideoGestures] Tap count:', lastTap.count);

      // Check for dead zones
      if (isInDeadZone(touch.clientX, touch.clientY)) {
        console.log('[VideoGestures] Touch in dead zone, ignoring');
        return;
      }

      // Long-press setup (only if video is playing)
      if (document.fullscreenElement && !result.video.paused) {
        console.log('[VideoGestures] Setting up long press timer (video is playing)');
        longPressTimer = setTimeout(() => {
          if (!gestureState || gestureState.isSwipe) return;

          const moved = Math.hypot(
            gestureState.lastX - gestureState.startX,
            gestureState.lastY - gestureState.startY
          );
          
          if (moved > 10) return;

          console.log('[VideoGestures] Long press triggered');
          gestureState.action = 'long-press-speed';
          gestureState.video.playbackRate = settings.LONG_PRESS_SPEED;
          showIndicator('fas fa-forward', `${settings.LONG_PRESS_SPEED}x`, 'speed', true);
          vibrate();
        }, settings.LONG_PRESS_DURATION);
      } else if (document.fullscreenElement && result.video.paused) {
        console.log('[VideoGestures] Video is paused, long press disabled');
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
        if (!gestureState) console.log('[VideoGestures] No gesture state in touchmove');
        return;
      }
      
      // Reset inactivity timer on movement
      resetInactivityTimer();

      const touch = e.touches[0];
      const dx = touch.clientX - gestureState.startX;
      const dy = touch.clientY - gestureState.startY;
      const distance = Math.hypot(dx, dy);

      gestureState.lastX = touch.clientX;
      gestureState.lastY = touch.clientY;

      if (!gestureState.isSwipe && distance > settings.SWIPE_THRESHOLD) {
        console.log('[VideoGestures] Swipe detected, distance:', distance);
        clearTimeout(longPressTimer);
        lastTap.count = 0;
        gestureState.isSwipe = true;
        
        if (gestureState.action === 'long-press-speed') {
          gestureState.video.playbackRate = gestureState.originalPlaybackRate;
          hideIndicator();
        }

        if (document.fullscreenElement) {
          console.log('[VideoGestures] In fullscreen, determining action');
          determineAction(dx, dy);
        } else {
          console.log('[VideoGestures] Not in fullscreen, limited gestures');
        }
      }

      if (gestureState.isSwipe && document.fullscreenElement) {
        e.preventDefault();
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
      e.stopPropagation();

      if (gestureState.action === 'long-press-speed') {
        gestureState.video.playbackRate = gestureState.originalPlaybackRate;
        hideIndicator();
      } else if (gestureState.isSwipe) {
        handleSwipeEnd();
      } else {
        handleTap();
      }

      gestureState = null;
    } catch (e) {
      console.warn('[VideoGestures] Touch end error:', e);
      gestureState = null;
    }
  };

  const onContextMenu = (e) => {
    if (gestureState || pinchGestureActive) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const determineAction = (dx, dy) => {
    try {
      const rect = gestureState.video.getBoundingClientRect();
      const zoneX = (gestureState.startX - rect.left) / rect.width;
      const isVertical = Math.abs(dy) > Math.abs(dx);

      console.log('[VideoGestures] Determining action - zoneX:', zoneX, 'isVertical:', isVertical, 'dx:', dx, 'dy:', dy);

      if (isVertical) {
        if (zoneX < 0.33) {
          console.log('[VideoGestures] Left zone - Volume control');
          gestureState.action = 'volume';
        } else if (zoneX > 0.33 && zoneX < 0.67) {
          console.log('[VideoGestures] Middle zone - Fullscreen control');
          gestureState.action = 'fullscreen';
        } else {
          console.log('[VideoGestures] Right zone - No action');
          gestureState.action = 'none';
        }
      } else {
        if (Number.isFinite(gestureState.video.duration)) {
          console.log('[VideoGestures] Horizontal - Seeking');
          gestureState.action = 'seeking';
        } else {
          console.log('[VideoGestures] Live stream detected');
          showIndicator('fas fa-play', 'Live Stream');
          gestureState.action = 'none';
        }
      }
    } catch (e) {
      console.error('[VideoGestures] Determine action error:', e);
    }
  };

  const handleSwipeAction = (dx, dy) => {
    try {
      console.log('[VideoGestures] Handling swipe action:', gestureState.action, 'dx:', dx, 'dy:', dy);
      
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
        default:
          console.log('[VideoGestures] Unknown action:', gestureState.action);
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

      const icon = seekAmount >= 0 ? 'fas fa-forward' : 'fas fa-backward';
      showIndicator(icon, formatTime(newTime), 'seeking');
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

      const icon = newVolume < 0.01 ? 'fas fa-volume-mute' : 'fas fa-volume-up';
      const text = newVolume < 0.01 ? 'Muted' : `${Math.round(newVolume * 100)}%`;
      
      showIndicator(icon, text, 'volume');
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
      console.log('[VideoGestures] Handling tap, count:', lastTap.count);
      
      if (lastTap.count >= 2) {
        console.log('[VideoGestures] Double tap detected');
        
        if (document.fullscreenElement) {
          console.log('[VideoGestures] In fullscreen, handling seek/play');
          handleDoubleTapSeek();
        } else {
          console.log('[VideoGestures] Not fullscreen, toggling fullscreen');
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

      if (zone < 0.4) {
        gestureState.video.currentTime -= seekTime;
        showIndicator('fas fa-step-backward', `-${seekTime}s`);
      } else if (zone > 0.6) {
        gestureState.video.currentTime += seekTime;
        showIndicator('fas fa-step-forward', `+${seekTime}s`);
      } else {
        if (gestureState.video.paused) {
          const playPromise = gestureState.video.play();
          if (playPromise && playPromise.catch) {
            playPromise.catch(() => {});
          }
          showIndicator('fas fa-play', 'Play');
        } else {
          gestureState.video.pause();
          showIndicator('fas fa-pause', 'Pause');
        }
      }
      
      vibrate();
    } catch (e) {
      console.warn('[VideoGestures] Double tap error:', e);
    }
  };

  const exitFullscreen = () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen();
        showIndicator('fas fa-compress', 'Exit Fullscreen');
        vibrate();
      }
    } catch (e) {
      console.warn('[VideoGestures] Exit fullscreen error:', e);
    }
  };

  const toggleFullscreen = () => {
    try {
      const isFullscreen = !!document.fullscreenElement;
      
      if (isFullscreen) {
        exitFullscreen();
      } else {
        const element = gestureState?.container || document.documentElement;
        if (element && element.requestFullscreen) {
          element.requestFullscreen();
          showIndicator('fas fa-expand', 'Enter Fullscreen');

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
      }
    } catch (e) {
      console.warn('[VideoGestures] Toggle fullscreen error:', e);
    }
  };

  const onFullscreenChange = () => {
    try {
      attachToFullscreen();
      if (!document.fullscreenElement && screen.orientation) {
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
      console.log('[VideoGestures] Found', videos.length, 'video elements');
      
      for (const video of videos) {
        console.log('[VideoGestures] Checking video:', video.src || 'no src');
        
        if (isValidVideo(video) && video.duration >= settings.MIN_VIDEO_DURATION) {
          readyShown = true;
          showToast('fas fa-check-circle', 'Gestures Ready');
          console.log('[VideoGestures] Ready message shown for valid video');
          break;
        }
      }
      
      if (!readyShown && videos.length > 0) {
        console.log('[VideoGestures] Videos found but none are valid yet');
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
      clearTimeout(hideTimer);
      clearTimeout(toastTimer);
      clearTimeout(inactivityTimer);
      
      // Clear video timers
      for (const timer of videoTimers.values()) {
        clearTimeout(timer);
      }
      videoTimers.clear();
      
      // Clear gesture timers
      for (const timer of gestureTimers.values()) {
        clearTimeout(timer);
      }
      gestureTimers.clear();
      
      // Clear WeakSet references
      activeVideos = new WeakSet();
      
      // Clear pinch state
      pinchState = null;
      pinchGestureActive = false;
      
      document.removeEventListener('touchstart', onTouchStart, true);
      document.removeEventListener('touchmove', onTouchMove, true);
      document.removeEventListener('touchend', onTouchEnd, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      
      document.getElementById(STYLE_ID)?.remove();
      indicator?.remove();
      toast?.remove();
      
      gestureState = null;
      console.log('[VideoGestures] Enhanced cleanup completed with pinch gesture support');
    } catch (e) {
      console.warn('[VideoGestures] Cleanup error:', e);
    }
  };

  // Initialize
  const init = () => {
    try {
      createStyles();
      createElements();

      document.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
      document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
      document.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });
      document.addEventListener('contextmenu', onContextMenu, { capture: true });
      document.addEventListener('fullscreenchange', onFullscreenChange, { passive: true });

      window.addEventListener('beforeunload', cleanup);
      window.addEventListener('pagehide', cleanup);

      // Watch for videos
      const observer = new MutationObserver(checkForVideos);
      observer.observe(document.body, { childList: true, subtree: true });
      
      // Initial check
      checkForVideos();
      
      // Start inactivity monitoring
      resetInactivityTimer();
      
      // Periodic cleanup for memory management
      setInterval(() => {
        cleanupInactiveGestures();
      }, 30000); // Every 30 seconds

      console.log('[VideoGestures] Initialized successfully with enhanced memory management and pinch gesture support');
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
