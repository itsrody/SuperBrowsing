// ==UserScript==
// @name          Video Touch Gestures
// @namespace     https://github.com/itsrody/SuperBrowsing
// @version       2.0.1
// @description   Optimized video gesture interface with Font Awesome icons and improved performance
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

  console.log('[VideoGestures] Starting initialization...');

  // Constants
  const STYLE_ID = 'vg-styles';
  const INDICATOR_ID = 'vg-indicator';
  const TOAST_ID = 'vg-toast';

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
    LONG_PRESS_SPEED: 2.0
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
      @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css');
      
      #${INDICATOR_ID}, #${TOAST_ID} {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        padding: 16px 20px !important;
        background: rgba(0, 0, 0, 0.85) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        backdrop-filter: blur(10px) !important;
        color: white !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 16px !important;
        font-weight: 500 !important;
        border-radius: 12px !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.2s ease !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
        user-select: none !important;
        white-space: nowrap !important;
      }

      #${INDICATOR_ID}.visible, #${TOAST_ID}.visible {
        opacity: 1 !important;
      }

      #${INDICATOR_ID} i, #${TOAST_ID} i {
        font-size: 20px !important;
        min-width: 20px !important;
        text-align: center !important;
      }

      #${INDICATOR_ID}.seeking {
        background: rgba(0, 0, 0, 0.85) !important;
      }

      #${INDICATOR_ID}.volume {
        background: rgba(0, 0, 0, 0.85) !important;
      }

      #${INDICATOR_ID}.speed {
        background: rgba(0, 0, 0, 0.85) !important;
      }
    `;
    
    document.head.appendChild(style);
    console.log('[VideoGestures] Styles created');
  };

  // UI elements
  let indicator = null;
  let toast = null;
  let hideTimer = null;
  let toastTimer = null;

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

    indicator.innerHTML = `<i class="${iconClass}"></i><span>${text}</span>`;
    indicator.className = `visible ${type}`;

    clearTimeout(hideTimer);
    if (!sticky) {
      hideTimer = setTimeout(() => {
        if (indicator) indicator.classList.remove('visible');
      }, 1000);
    }
  };

  const hideIndicator = () => {
    if (indicator) indicator.classList.remove('visible');
  };

  const showToast = (iconClass, text, duration = 1500) => {
    if (!toast) return;

    toast.innerHTML = `<i class="${iconClass}"></i><span>${text}</span>`;
    toast.classList.add('visible');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toast) toast.classList.remove('visible');
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
      if (!video || video.readyState < 2) return false;
      const rect = video.getBoundingClientRect();
      return rect.width > 200 && rect.height > 150 && 
             video.duration > 0 && !video.paused;
    } catch (e) {
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

  // Touch handlers
  const onTouchStart = (e) => {
    try {
      if (e.touches.length > 1) return;

      const touch = e.touches[0];
      const result = findVideo(e.target, touch.clientX, touch.clientY);
      
      if (!result?.video || result.video.duration < settings.MIN_VIDEO_DURATION) {
        return;
      }

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

      // Long-press setup
      if (document.fullscreenElement) {
        longPressTimer = setTimeout(() => {
          if (!gestureState || gestureState.isSwipe) return;

          const moved = Math.hypot(
            gestureState.lastX - gestureState.startX,
            gestureState.lastY - gestureState.startY
          );
          
          if (moved > 10) return;

          gestureState.action = 'long-press-speed';
          gestureState.video.playbackRate = settings.LONG_PRESS_SPEED;
          showIndicator('fas fa-forward', `${settings.LONG_PRESS_SPEED}x`, 'speed', true);
          vibrate();
        }, settings.LONG_PRESS_DURATION);
      }
    } catch (e) {
      console.warn('[VideoGestures] Touch start error:', e);
    }
  };

  const onTouchMove = (e) => {
    try {
      if (!gestureState || e.touches.length > 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - gestureState.startX;
      const dy = touch.clientY - gestureState.startY;
      const distance = Math.hypot(dx, dy);

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

        if (document.fullscreenElement) {
          determineAction(dx, dy);
        }
      }

      if (gestureState.isSwipe && document.fullscreenElement) {
        e.preventDefault();
        handleSwipeAction(dx, dy);
      }
    } catch (e) {
      console.warn('[VideoGestures] Touch move error:', e);
    }
  };

  const onTouchEnd = (e) => {
    try {
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
    if (gestureState) {
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
        if (zoneX < 0.33) {
          gestureState.action = 'volume';
        } else if (zoneX > 0.33 && zoneX < 0.67) {
          gestureState.action = 'fullscreen';
        }
        // Right zone has no gestures
      } else {
        if (Number.isFinite(gestureState.video.duration)) {
          gestureState.action = 'seeking';
        } else {
          showIndicator('fas fa-play', 'Live Stream');
        }
      }
    } catch (e) {
      console.warn('[VideoGestures] Determine action error:', e);
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
      }
    } catch (e) {
      console.warn('[VideoGestures] Swipe action error:', e);
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
      if (lastTap.count >= 2) {
        if (document.fullscreenElement) {
          handleDoubleTapSeek();
        } else {
          toggleFullscreen();
        }
        lastTap = { time: 0, count: 0 };
      }
    } catch (e) {
      console.warn('[VideoGestures] Tap error:', e);
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
      for (const video of videos) {
        if (isValidVideo(video) && video.duration >= settings.MIN_VIDEO_DURATION) {
          readyShown = true;
          showToast('fas fa-check-circle', 'Gestures Ready');
          console.log('[VideoGestures] Ready message shown');
          break;
        }
      }
    } catch (e) {
      console.warn('[VideoGestures] Video check error:', e);
    }
  };

  // Cleanup
  const cleanup = () => {
    try {
      clearTimeout(longPressTimer);
      clearTimeout(hideTimer);
      clearTimeout(toastTimer);
      
      document.removeEventListener('touchstart', onTouchStart, true);
      document.removeEventListener('touchmove', onTouchMove, true);
      document.removeEventListener('touchend', onTouchEnd, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      
      document.getElementById(STYLE_ID)?.remove();
      indicator?.remove();
      toast?.remove();
      
      gestureState = null;
      console.log('[VideoGestures] Cleanup completed');
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

      console.log('[VideoGestures] Initialized successfully');
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
