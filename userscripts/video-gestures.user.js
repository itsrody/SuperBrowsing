// ==UserScript==
// @name          Video Gestures Pro (Long-Press Fork)
// @namespace    https://github.com/itsrody/SuperBrowsing
// @version      10.0.2
// @description  Adds a powerful, zoned gesture interface that works only in fullscreen mode.
// @author       Murtaza Salih (with Gemini improvements)
// @match        *://*/*
// @exclude      *://*.netflix.com/*
// @exclude      *://netflix.com/*
// @exclude      *://*.youtube.com/*
// @exclude      *://youtube.com/*
// @exclude      *://*.instagram.com/*
// @exclude      *://instagram.com/*
// @exclude      *://*.facebook.com/*
// @exclude      *://facebook.com/*
// @exclude      *://*.reddit.com/*
// @exclude      *://reddit.com/*
// @exclude      *://*.tiktok.com/*
// @exclude      *://tiktok.com/*
// @exclude      *://*.dailymotion.com/*
// @exclude      *://dailymotion.com/*
// @exclude      *://*.hulu.com/*
// @exclude      *://hulu.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(async function() {
    'use strict';

    // --- Central Configuration Panel ---
    const DEFAULTS = {
        MIN_VIDEO_DURATION_SECONDS: 60,
        DOUBLE_TAP_SEEK_SECONDS: 5,
        SWIPE_THRESHOLD: 20,
        SEEK_SENSITIVITY: 0.3,
        BRIGHTNESS_SENSITIVITY: 200, // Lower is more sensitive
        VOLUME_SENSITIVITY: 250,     // Higher value means more gradual/smoother change
        ENABLE_HAPTIC_FEEDBACK: true,
        HAPTIC_FEEDBACK_DURATION_MS: 20,
        FORCE_LANDSCAPE: true,
        DOUBLE_TAP_TIMEOUT_MS: 350,
        LONG_PRESS_DURATION_MS: 400, // Time to hold for long-press
    };

    let config = await GM_getValue('config', DEFAULTS);

    // --- Error Handling Utility (Non-Breaking Addition) ---
    class ErrorHandler {
        static handleError(error, context = '') {
            console.warn(`[VideoGestures] Error in ${context}:`, error);
            
            // Reset gesture state on critical errors to prevent stuck states
            if (context.includes('gesture') || context.includes('touch')) {
                activeGesture = null;
                if (longPressTimeout) {
                    clearTimeout(longPressTimeout);
                    longPressTimeout = null;
                }
            }
        }
        
        static wrapFunction(fn, context) {
            return function(...args) {
                try {
                    return fn.apply(this, args);
                } catch (error) {
                    ErrorHandler.handleError(error, context);
                    return null; // Safe fallback
                }
            };
        }
    }

    GM_registerMenuCommand('⏱️ Set Double-Tap Seek Time', () => {
        const currentSeekTime = config.DOUBLE_TAP_SEEK_SECONDS;
        const newSeekTimeStr = prompt(
            `Enter seconds to seek on double-tap (1-60):\nCurrent: ${currentSeekTime}s`, 
            currentSeekTime
        );

        if (newSeekTimeStr !== null) { // User didn't cancel
            const newSeekTime = parseInt(newSeekTimeStr, 10);
            
            // Enhanced validation with better user feedback
            if (!isNaN(newSeekTime) && newSeekTime > 0 && newSeekTime <= 60) {
                config.DOUBLE_TAP_SEEK_SECONDS = newSeekTime;
                GM_setValue('config', config);
                alert(`Double-tap seek time set to ${newSeekTime} seconds.`);
            } else {
                alert(`Invalid input "${newSeekTimeStr}". Please enter a number between 1-60 seconds.\nCurrent value (${currentSeekTime}s) unchanged.`);
            }
        }
    });


    // --- Styles, Indicator & Overlays ---
    let globalIndicator = null;
    let indicatorTimeout = null;
    let brightnessOverlay = null;

    function initializeOverlays() {
        if (document.getElementById('vg-global-indicator')) return;

        const style = document.createElement('style');
        style.id = 'video-gesture-pro-styles';
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');
            #vg-global-indicator {
                position: fixed; top: 50%; left: 50%;
                transform: translate(-50%, -50%) scale(0.9);
                padding: 10px 16px; background-color: rgba(30, 30, 30, 0.9);
                color: #fff; font-family: 'Roboto', sans-serif; font-size: 16px;
                border-radius: 20px; z-index: 2147483647;
                display: flex; align-items: center; gap: 8px;
                opacity: 0; pointer-events: none;
                transition: opacity 0.2s ease, transform 0.2s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            #vg-global-indicator.visible {
                opacity: 1; transform: translate(-50%, -50%) scale(1);
            }
            #vg-global-indicator svg { width: 24px; height: 24px; fill: #fff; }

            #vg-brightness-overlay {
                position: fixed; top: 0; left: 0;
                width: 100vw; height: 100vh;
                background-color: black;
                opacity: 0;
                pointer-events: none;
                z-index: 2147483646;
                transition: opacity 0.1s linear;
            }
        `;
        document.head.appendChild(style);

        globalIndicator = document.createElement('div');
        globalIndicator.id = 'vg-global-indicator';
        document.body.appendChild(globalIndicator);

        brightnessOverlay = document.createElement('div');
        brightnessOverlay.id = 'vg-brightness-overlay';
        document.body.appendChild(brightnessOverlay);
    }

    // --- State Management ---
    let activeGesture = null;
    let lastTap = { time: 0, count: 0 };
    let longPressTimeout = null;

    // --- Memory Management (Non-Breaking Addition) ---
    function cleanup() {
        // Clear all timeouts to prevent memory leaks
        if (longPressTimeout) {
            clearTimeout(longPressTimeout);
            longPressTimeout = null;
        }
        
        if (indicatorTimeout) {
            clearTimeout(indicatorTimeout);
            indicatorTimeout = null;
        }
        
        // Reset gesture state
        activeGesture = null;
        lastTap = { time: 0, count: 0 };
        
        // Clean up UI elements safely
        try {
            if (globalIndicator && globalIndicator.parentElement) {
                globalIndicator.remove();
                globalIndicator = null;
            }
            
            if (brightnessOverlay && brightnessOverlay.parentElement) {
                brightnessOverlay.remove();
                brightnessOverlay = null;
            }
            
            // Remove style element
            const styleEl = document.getElementById('video-gesture-pro-styles');
            if (styleEl) {
                styleEl.remove();
            }
        } catch (e) {
            console.warn('[VideoGestures] Cleanup warning:', e);
        }
    }

    // --- UI & Feedback ---
    function showIndicator(html, stayVisible = false) {
        if (!globalIndicator) return;
        globalIndicator.innerHTML = html;
        globalIndicator.classList.add('visible');
        
        // Always clear existing timeout to prevent leaks
        if (indicatorTimeout) {
            clearTimeout(indicatorTimeout);
            indicatorTimeout = null;
        }
        
        if (!stayVisible) {
            indicatorTimeout = setTimeout(() => {
                if (globalIndicator) {
                    globalIndicator.classList.remove('visible');
                }
                indicatorTimeout = null;
            }, 800);
        }
    }

    function hideIndicator() {
         if (globalIndicator) globalIndicator.classList.remove('visible');
    }

    function triggerHapticFeedback() {
        if (config.ENABLE_HAPTIC_FEEDBACK && navigator.vibrate) {
            navigator.vibrate(config.HAPTIC_FEEDBACK_DURATION_MS);
        }
    }

    // --- Improved Video & Player Discovery ---
    function findVideoAndPlayer(targetElement) {
        try {
            let video = null;
            
            // Safe fullscreen check
            if (document.fullscreenElement) {
                video = document.fullscreenElement.querySelector('video');
            }
            
            // Safe closest video check
            if (!video && targetElement && typeof targetElement.closest === 'function') {
                video = targetElement.closest('video');
            }
            
            // Safe video search with validation
            if (!video) {
                let largestVideo = null;
                let maxArea = 0;
                document.querySelectorAll('video').forEach(v => {
                    try {
                        if (!v || v.paused || v.readyState < 1) return;
                        const rect = v.getBoundingClientRect();
                        if (rect && rect.width > 0 && rect.height > 0) {
                            const area = rect.width * rect.height;
                            if (area > maxArea) {
                                maxArea = area;
                                largestVideo = v;
                            }
                        }
                    } catch (e) {
                        // Skip problematic video elements silently
                    }
                });
                video = largestVideo;
            }

            if (!video) return null;

            // Safe container search
            let container = null;
            try {
                const playerSelectors = '.html5-video-player, .player, .video-js, [data-vjs-player], .jwplayer';
                container = video.closest(playerSelectors);
            } catch (e) {
                // Fallback to parent element
            }

            return {
                video: video,
                container: container || video.parentElement
            };
        } catch (error) {
            ErrorHandler.handleError(error, 'video-discovery');
            return null;
        }
    }


    // --- Event Handlers using State Machine ---
    function onTouchStart(e) {
        try {
            const result = findVideoAndPlayer(e.target);

            if (!result || !result.video || result.video.duration < config.MIN_VIDEO_DURATION_SECONDS || e.touches.length > 1) {
                activeGesture = null;
                return;
            }
            
            e.stopPropagation();

            activeGesture = {
                video: result.video,
                container: result.container,
                startX: e.touches[0].clientX,
                startY: e.touches[0].clientY,
                isSwipe: false,
                action: 'none',
                finalized: false,
                originalPlaybackRate: result.video.playbackRate,
                initialBrightness: 1 - parseFloat(brightnessOverlay.style.opacity || 0),
                initialVolume: result.video.volume,
            };

            if (Date.now() - lastTap.time < config.DOUBLE_TAP_TIMEOUT_MS) {
                lastTap.count++;
            } else {
                lastTap.count = 1;
            }
            lastTap.time = Date.now();

            // Always clear existing timeout before setting new one
            if (longPressTimeout) {
                clearTimeout(longPressTimeout);
                longPressTimeout = null;
            }
            
            if (document.fullscreenElement) {
                longPressTimeout = setTimeout(() => {
                    try {
                        handleLongPress();
                    } catch (error) {
                        ErrorHandler.handleError(error, 'long-press');
                    }
                }, config.LONG_PRESS_DURATION_MS);
            }
        } catch (error) {
            ErrorHandler.handleError(error, 'touchstart');
        }
    }

    function onTouchMove(e) {
        try {
            if (!activeGesture || e.touches.length > 1) return;
            
            e.stopPropagation();
            
            const deltaX = e.touches[0].clientX - activeGesture.startX;
            const deltaY = e.touches[0].clientY - activeGesture.startY;

            if (!activeGesture.isSwipe && Math.hypot(deltaX, deltaY) > config.SWIPE_THRESHOLD) {
                if (longPressTimeout) {
                    clearTimeout(longPressTimeout);
                    longPressTimeout = null;
                }
                lastTap.count = 0;
                
                if (activeGesture.action === 'long-press-speed') {
                    activeGesture.video.playbackRate = activeGesture.originalPlaybackRate;
                    hideIndicator();
                }

                activeGesture.isSwipe = true;
                
                if (document.fullscreenElement) {
                    const rect = activeGesture.video.getBoundingClientRect();
                    const touchZoneX = (activeGesture.startX - rect.left) / rect.width;
                    const isVertical = Math.abs(deltaY) > Math.abs(deltaX);

                    if (isVertical) {
                        if (touchZoneX < 0.33) activeGesture.action = 'brightness';
                        else if (touchZoneX > 0.66) activeGesture.action = 'volume';
                        else activeGesture.action = 'fullscreen';
                    } else {
                        activeGesture.action = 'seeking';
                    }
                }
            }

            if (activeGesture.isSwipe) {
                e.preventDefault();
                switch (activeGesture.action) {
                    case 'seeking': handleHorizontalSwipe(deltaX); break;
                    case 'volume': handleVerticalSwipe(deltaY, 'volume'); break;
                    case 'brightness': handleVerticalSwipe(deltaY, 'brightness'); break;
                }
            }
        } catch (error) {
            ErrorHandler.handleError(error, 'touchmove');
        }
    }

    function onTouchEnd(e) {
        try {
            if (!activeGesture || activeGesture.finalized) return;
            
            if (longPressTimeout) {
                clearTimeout(longPressTimeout);
                longPressTimeout = null;
            }
            e.stopPropagation();
            activeGesture.finalized = true;

            if (activeGesture.action === 'long-press-speed') {
                activeGesture.video.playbackRate = activeGesture.originalPlaybackRate;
                hideIndicator();
            } else if (activeGesture.isSwipe) {
                if (activeGesture.action === 'seeking') {
                    const deltaX = e.changedTouches[0].clientX - activeGesture.startX;
                    const seekTime = deltaX * config.SEEK_SENSITIVITY;
                    activeGesture.video.currentTime += seekTime;
                    triggerHapticFeedback();
                } else if (activeGesture.action === 'volume' || activeGesture.action === 'brightness') {
                    triggerHapticFeedback();
                } else if (activeGesture.action === 'fullscreen') {
                     const deltaY = e.changedTouches[0].clientY - activeGesture.startY;
                     if (Math.abs(deltaY) > config.SWIPE_THRESHOLD) {
                        handleFullscreenToggle();
                     }
                }
            } else {
                if (lastTap.count >= 2) {
                    e.preventDefault();
                    if (document.fullscreenElement) {
                        handleDoubleTapSeek(activeGesture.video, activeGesture.startX);
                    } else {
                        handleFullscreenToggle();
                    }
                    lastTap = { time: 0, count: 0 };
                }
            }

            activeGesture = null;
        } catch (error) {
            ErrorHandler.handleError(error, 'touchend');
            // Always reset state on error
            activeGesture = null;
        }
    }

    function onContextMenu(e) {
        if (activeGesture) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }

    // --- Gesture Logic ---
    function handleLongPress() {
        if (!activeGesture || activeGesture.isSwipe) return;

        activeGesture.action = 'long-press-speed';
        activeGesture.video.playbackRate = 2.0;
        const speedIcon = `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`;
        showIndicator(`${speedIcon} <span>2.0x Speed</span>`, true);
        triggerHapticFeedback();
    }

    function handleFullscreenToggle() {
        const isFullscreen = document.fullscreenElement;
        const icon = isFullscreen
            ? `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`
            : `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
        showIndicator(icon);
        triggerHapticFeedback();

        if (isFullscreen) {
            document.exitFullscreen();
        } else {
            const { container, video } = activeGesture;
            const fsPromise = container.requestFullscreen();

            if (config.FORCE_LANDSCAPE && video.videoWidth > video.videoHeight) {
                fsPromise.then(() => {
                    if (screen.orientation && typeof screen.orientation.lock === 'function') {
                        screen.orientation.lock('landscape').catch(err => console.warn('Could not lock orientation:', err.message));
                    }
                }).catch(err => console.warn('Fullscreen request failed:', err.message));
            }
        }
    }

    function handleDoubleTapSeek(video, touchStartX) {
        const rect = video.getBoundingClientRect();
        const tapZone = (touchStartX - rect.left) / rect.width;
        const seekIconBack = `<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6l-8.5 6z"/></svg>`;
        const seekIconFwd = `<svg viewBox="0 0 24 24"><path d="M18 6h-2v12h2zM4 6v12l8.5-6L4 6z"/></svg>`;

        if (tapZone < 0.4) {
            video.currentTime -= config.DOUBLE_TAP_SEEK_SECONDS;
            showIndicator(`${seekIconBack} -${config.DOUBLE_TAP_SEEK_SECONDS}s`);
        } else if (tapZone > 0.6) {
            video.currentTime += config.DOUBLE_TAP_SEEK_SECONDS;
            showIndicator(`+${config.DOUBLE_TAP_SEEK_SECONDS}s ${seekIconFwd}`);
        } else {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }
        triggerHapticFeedback();
    }

    function handleHorizontalSwipe(deltaX) {
        if (!activeGesture) return;
        const { video } = activeGesture;
        const seekTime = deltaX * config.SEEK_SENSITIVITY;
        const newTime = video.currentTime + seekTime;
        const icon = seekTime > 0 ? `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>` : `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm-2-6l6.5 4.5V7.5L9 12z"/></svg>`;
        showIndicator(`${icon} ${formatTime(newTime)}`);
    }

    function handleVerticalSwipe(deltaY, type) {
        if (!activeGesture) return;
        
        if (type === 'volume') {
            const { video } = activeGesture;
            const change = -deltaY / config.VOLUME_SENSITIVITY;
            let newVolume = activeGesture.initialVolume + change;
            newVolume = Math.max(0, Math.min(1, newVolume));
            video.volume = newVolume;
            showIndicator(`<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg> ${Math.round(video.volume * 100)}%`);
        } else if (type === 'brightness') {
            const change = -deltaY / config.BRIGHTNESS_SENSITIVITY;
            let newBrightness = activeGesture.initialBrightness + change;
            newBrightness = Math.max(0.1, Math.min(1, newBrightness));
            
            brightnessOverlay.style.opacity = 1 - newBrightness;

            const brightnessIcon = `<svg viewBox="0 0 24 24"><path d="M20 8.69V4h-4.69L12 0 8.69 4H4v4.69L0 12l4 3.31V20h4.69L12 24l3.31-4H20v-4.69L24 12l-4-3.31M12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>`;
            showIndicator(`${brightnessIcon} ${Math.round(newBrightness * 100)}%`);
        }
    }

    function handleFullscreenChange() {
        if (document.fullscreenElement) {
            document.fullscreenElement.appendChild(globalIndicator);
            document.fullscreenElement.appendChild(brightnessOverlay);
        } else {
            document.body.appendChild(globalIndicator);
            document.body.appendChild(brightnessOverlay);
            if (screen.orientation && typeof screen.orientation.unlock === 'function') {
                screen.orientation.unlock();
            }
        }
    }

    // --- Utilities ---
    function formatTime(totalSeconds) {
        const sec = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        const min = Math.floor((totalSeconds / 60) % 60).toString().padStart(2, '0');
        const hr = Math.floor(totalSeconds / 3600);
        return hr > 0 ? `${hr}:${min}:${sec}` : `${min}:${sec}`;
    }

    // --- Initialization ---
    function initialize() {
        initializeOverlays();
        document.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
        document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
        document.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('contextmenu', onContextMenu, { capture: true });
        
        // Add cleanup handlers to prevent memory leaks
        window.addEventListener('beforeunload', cleanup);
        window.addEventListener('pagehide', cleanup);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
