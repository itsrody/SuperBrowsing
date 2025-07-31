// ==UserScript==
// @name          Video Gestures Pro (Long-Press Fork)
// @namespace    https://github.com/itsrody/SuperBrowsing
// @version      9.5
// @description  Adds a powerful, zoned gesture interface, including long-press to speed up, brightness, and volume control, to most web videos.
// @author       Murtaza Salih (with Gemini improvements)
// @match        *://*/*
// @exclude      *://*.netflix.com/*
// @exclude      *://*.youtube.com/*
// @exclude      *://*.instagram.com/*
// @exclude      *://*.facebook.com/*
// @exclude      *://*.reddit.com/*
// @exclude      *://*.tiktok.com/*
// @exclude      *://*.dailymotion.com/*
// @exclude      *://*.hulu.com/*
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
        DOUBLE_TAP_SEEK_SECONDS: 10,
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

    GM_registerMenuCommand('Configure Gestures', () => {
        const currentConfig = JSON.stringify(config, null, 2);
        const newConfigStr = prompt('Edit Gesture Settings:', currentConfig);
        if (newConfigStr) {
            try {
                const newConfig = JSON.parse(newConfigStr);
                config = { ...DEFAULTS, ...newConfig };
                GM_setValue('config', config);
                alert('Settings saved! Please reload the page for changes to take effect.');
            } catch (e) {
                alert('Error parsing settings. Please ensure it is valid JSON.\n\n' + e);
            }
        }
    });


    // --- Styles & Global Indicator ---
    let globalIndicator = null;
    let indicatorTimeout = null;

    function initializeIndicator() {
        if (document.getElementById('vg-global-indicator')) return;

        const style = document.createElement('style');
        style.id = 'video-gesture-pro-styles';
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');
            #vg-global-indicator {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.9);
                padding: 10px 16px;
                background-color: rgba(30, 30, 30, 0.9);
                color: #fff;
                font-family: 'Roboto', sans-serif;
                font-size: 16px;
                border-radius: 20px;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                gap: 8px;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease, transform 0.2s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            #vg-global-indicator.visible {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
            #vg-global-indicator svg { width: 24px; height: 24px; fill: #fff; }
        `;
        document.head.appendChild(style);

        globalIndicator = document.createElement('div');
        globalIndicator.id = 'vg-global-indicator';
        document.body.appendChild(globalIndicator);
    }

    // --- State Management ---
    let activeGesture = null;
    let lastTap = { time: 0, count: 0 };
    let longPressTimeout = null;

    // --- UI & Feedback ---
    function showIndicator(html, stayVisible = false) {
        if (!globalIndicator) return;

        globalIndicator.innerHTML = html;
        globalIndicator.classList.add('visible');

        if (indicatorTimeout) clearTimeout(indicatorTimeout);

        if (!stayVisible) {
            indicatorTimeout = setTimeout(() => {
                globalIndicator.classList.remove('visible');
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
        let video = null;
        if (document.fullscreenElement) {
            video = document.fullscreenElement.querySelector('video');
        }
        if (!video) {
            video = targetElement.closest('video');
        }

        if (!video) {
            let largestVideo = null;
            let maxArea = 0;
            document.querySelectorAll('video').forEach(v => {
                if (v.paused || v.readyState < 1) return;
                const rect = v.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    const area = rect.width * rect.height;
                    if (area > maxArea) {
                        maxArea = area;
                        largestVideo = v;
                    }
                }
            });
            video = largestVideo;
        }

        if (!video) return null;

        const playerSelectors = '.html5-video-player, .player, .video-js, [data-vjs-player], .jwplayer';
        const playerContainer = video.closest(playerSelectors);

        return {
            video: video,
            container: playerContainer || video.parentElement
        };
    }


    // --- Event Handlers using State Machine ---
    function onTouchStart(e) {
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
            initialBrightness: parseFloat(document.documentElement.style.filter.match(/brightness\((\d+\.?\d*)\)/)?.[1] || 1),
            initialVolume: result.video.volume,
        };

        if (Date.now() - lastTap.time < config.DOUBLE_TAP_TIMEOUT_MS) {
            lastTap.count++;
        } else {
            lastTap.count = 1;
        }
        lastTap.time = Date.now();

        // Start timer for long-press action
        clearTimeout(longPressTimeout);
        longPressTimeout = setTimeout(() => handleLongPress(), config.LONG_PRESS_DURATION_MS);
    }

    function onTouchMove(e) {
        if (!activeGesture || e.touches.length > 1) return;
        
        e.stopPropagation();
        
        const deltaX = e.touches[0].clientX - activeGesture.startX;
        const deltaY = e.touches[0].clientY - activeGesture.startY;

        if (!activeGesture.isSwipe && Math.hypot(deltaX, deltaY) > config.SWIPE_THRESHOLD) {
            clearTimeout(longPressTimeout);
            lastTap.count = 0;
            
            if (activeGesture.action === 'long-press-speed') {
                activeGesture.video.playbackRate = activeGesture.originalPlaybackRate;
                hideIndicator();
            }

            activeGesture.isSwipe = true;
            
            const rect = activeGesture.video.getBoundingClientRect();
            const touchZoneX = (activeGesture.startX - rect.left) / rect.width;

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (document.fullscreenElement) activeGesture.action = 'seeking';
            } else {
                if (touchZoneX < 0.33) activeGesture.action = 'brightness';
                else if (touchZoneX > 0.66) activeGesture.action = 'volume';
                else activeGesture.action = 'fullscreen';
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
    }

    function onTouchEnd(e) {
        if (!activeGesture || activeGesture.finalized) return;
        
        clearTimeout(longPressTimeout);
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

        const rect = activeGesture.video.getBoundingClientRect();
        const touchZoneX = (activeGesture.startX - rect.left) / rect.width;

        if (touchZoneX > 0.33 && touchZoneX < 0.66) {
            activeGesture.action = 'long-press-speed';
            activeGesture.video.playbackRate = 2.0;
            const speedIcon = `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`;
            showIndicator(`${speedIcon} <span>2.0x Speed</span>`, true);
            triggerHapticFeedback();
        }
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
            newVolume = Math.max(0, Math.min(1, newVolume)); // Clamp between 0 and 1
            video.volume = newVolume;
            showIndicator(`<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg> ${Math.round(video.volume * 100)}%`);
        } else if (type === 'brightness') {
            const change = -deltaY / config.BRIGHTNESS_SENSITIVITY;
            let newBrightness = activeGesture.initialBrightness + change;
            newBrightness = Math.max(0.1, Math.min(2, newBrightness)); // Clamp between 10% and 200%
            const brightnessIcon = `<svg viewBox="0 0 24 24"><path d="M20 8.69V4h-4.69L12 0 8.69 4H4v4.69L0 12l4 3.31V20h4.69L12 24l3.31-4H20v-4.69L24 12l-4-3.31M12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>`;
            document.documentElement.style.filter = `brightness(${newBrightness})`;
            showIndicator(`${brightnessIcon} ${Math.round(newBrightness * 100)}%`);
        }
    }

    function handleFullscreenChange() {
        if (document.fullscreenElement) {
            document.fullscreenElement.appendChild(globalIndicator);
        } else {
            document.body.appendChild(globalIndicator);
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
        initializeIndicator();
        document.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
        document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
        document.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('contextmenu', onContextMenu, { capture: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
