// ==UserScript==
// @name          Video Gestures Pro
// @namespace    https://github.com/itsrody/SuperBrowsing
// @version      8.4
// @description  Adds a powerful, zoned gesture interface (seek, volume, playback speed, fullscreen) to most web videos using a robust state machine.
// @author       Murtaza Salih (with Gemini improvements)
// @match        *://*/*
// @exclude      *://*.netflix.com/*
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
        ENABLE_HAPTIC_FEEDBACK: true,
        HAPTIC_FEEDBACK_DURATION_MS: 20,
        FORCE_LANDSCAPE: true,
        DOUBLE_TAP_TIMEOUT_MS: 350,
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


    // --- Styles ---
    function injectStyles() {
        if (document.getElementById('video-gesture-pro-styles')) return;
        const style = document.createElement('style');
        style.id = 'video-gesture-pro-styles';
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');
            .vg-indicator {
                position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                padding: 10px 16px; background-color: rgba(30, 30, 30, 0.9);
                color: #fff; font-family: 'Roboto', sans-serif; font-size: 16px;
                border-radius: 20px;
                z-index: 2147483647;
                display: flex;
                align-items: center; gap: 8px; opacity: 0; pointer-events: none;
                transition: opacity 0.2s ease, transform 0.2s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            .vg-indicator.visible { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            .vg-indicator svg { width: 24px; height: 24px; fill: #fff; }
            
            /* *** FIX: Ensure player UI remains visible and video scales correctly *** */
            #vg-fullscreen-wrapper > * {
                width: 100% !important;
                height: 100% !important;
                max-width: none !important;
                max-height: none !important;
                top: 0 !important;
                left: 0 !important;
                transform: none !important;
            }
            #vg-fullscreen-wrapper video {
                object-fit: contain !important;
            }
        `;
        document.head.appendChild(style);
    }

    // --- State Management ---
    let activeGesture = null; // The state machine object for the current gesture
    let lastTap = { time: 0, count: 0 }; // For tracking double taps
    let playerContainer = null;
    let originalParent = null;
    let originalNextSibling = null;
    let originalPlayerStyle = {};

    // --- UI & Feedback ---
    function showIndicator(video, html) {
        const parent = document.fullscreenElement || video.parentElement;
        if (!parent) return;

        if (!parent.gestureIndicator) {
             const indicator = document.createElement('div');
             indicator.className = 'vg-indicator';
             if (getComputedStyle(parent).position === 'static') {
                 parent.style.position = 'relative';
             }
             parent.appendChild(indicator);
             parent.gestureIndicator = indicator;
        }
        const { gestureIndicator } = parent;
        gestureIndicator.innerHTML = html;
        gestureIndicator.classList.add('visible');

        if (parent.indicatorTimeout) clearTimeout(parent.indicatorTimeout);

        parent.indicatorTimeout = setTimeout(() => {
            if (gestureIndicator) gestureIndicator.classList.remove('visible');
        }, 800);
    }

    function triggerHapticFeedback() {
        if (config.ENABLE_HAPTIC_FEEDBACK && navigator.vibrate) {
            navigator.vibrate(config.HAPTIC_FEEDBACK_DURATION_MS);
        }
    }

    // --- Improved Video Discovery ---
    function findActiveVideo(targetElement) {
        if (document.fullscreenElement) {
            const videoInFs = document.fullscreenElement.querySelector('video');
            if (videoInFs) return videoInFs;
        }
        const closestVideo = targetElement.closest('video');
        if (closestVideo) return closestVideo;

        const playerContainer = targetElement.closest('.html5-video-player, .player, .video-js, [data-vjs-player]');
        if (playerContainer) {
            const videoInContainer = playerContainer.querySelector('video');
            if (videoInContainer) return videoInContainer;
        }

        let largestVideo = null;
        let maxArea = 0;
        document.querySelectorAll('video').forEach(video => {
            if (video.paused || video.readyState < 1) return;
            const rect = video.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const area = rect.width * rect.height;
                if (area > maxArea) {
                    maxArea = area;
                    largestVideo = video;
                }
            }
        });
        return largestVideo;
    }


    // --- Event Handlers using State Machine ---
    function onTouchStart(e) {
        const video = findActiveVideo(e.target);

        if (!video || video.duration < config.MIN_VIDEO_DURATION_SECONDS || e.touches.length > 1) {
            activeGesture = null;
            return;
        }
        
        e.stopPropagation();

        activeGesture = {
            video: video,
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY,
            isSwipe: false,
            action: 'none',
            finalized: false,
        };

        if (Date.now() - lastTap.time < config.DOUBLE_TAP_TIMEOUT_MS) {
            lastTap.count++;
        } else {
            lastTap.count = 1;
        }
        lastTap.time = Date.now();
    }

    function onTouchMove(e) {
        if (!activeGesture || e.touches.length > 1) return;
        
        e.stopPropagation();
        
        const deltaX = e.touches[0].clientX - activeGesture.startX;
        const deltaY = e.touches[0].clientY - activeGesture.startY;

        if (!activeGesture.isSwipe && Math.hypot(deltaX, deltaY) > config.SWIPE_THRESHOLD) {
            activeGesture.isSwipe = true;
            lastTap.count = 0;
            
            const rect = activeGesture.video.getBoundingClientRect();
            const touchZoneX = (activeGesture.startX - rect.left) / rect.width;

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (document.fullscreenElement) activeGesture.action = 'seeking';
            } else {
                if (touchZoneX < 0.33) activeGesture.action = 'speed';
                else if (touchZoneX > 0.66) activeGesture.action = 'volume';
                else activeGesture.action = 'fullscreen';
            }
        }

        if (activeGesture.isSwipe) {
            e.preventDefault();
            switch (activeGesture.action) {
                case 'seeking': handleHorizontalSwipe(deltaX); break;
                case 'volume': handleVerticalSwipe(deltaY, 'volume'); break;
                case 'speed': handleVerticalSwipe(deltaY, 'speed'); break;
            }
        }
    }

    function onTouchEnd(e) {
        if (!activeGesture || activeGesture.finalized) return;
        
        e.stopPropagation();
        activeGesture.finalized = true;

        if (activeGesture.isSwipe) {
            if (activeGesture.action === 'seeking') {
                const deltaX = e.changedTouches[0].clientX - activeGesture.startX;
                const seekTime = deltaX * config.SEEK_SENSITIVITY;
                activeGesture.video.currentTime += seekTime;
                triggerHapticFeedback();
            } else if (activeGesture.action === 'volume' || activeGesture.action === 'speed') {
                triggerHapticFeedback();
            } else if (activeGesture.action === 'fullscreen') {
                 const deltaY = e.changedTouches[0].clientY - activeGesture.startY;
                 if (Math.abs(deltaY) > config.SWIPE_THRESHOLD) {
                    handleFullscreenToggle(activeGesture.video);
                 }
            }
        } else {
            if (lastTap.count >= 2) {
                e.preventDefault();
                if (document.fullscreenElement) {
                    handleDoubleTapSeek(activeGesture.video, activeGesture.startX);
                } else {
                    handleFullscreenToggle(activeGesture.video);
                }
                lastTap = { time: 0, count: 0 };
            }
        }

        activeGesture = null;
    }

    // --- Gesture Logic ---
    function handleFullscreenToggle(video) {
        const isFullscreen = document.fullscreenElement;
        const icon = isFullscreen
            ? `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`
            : `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
        showIndicator(video, icon);
        triggerHapticFeedback();

        if (isFullscreen) {
            document.exitFullscreen();
        } else {
            const wrapper = document.createElement('div');
            wrapper.id = 'vg-fullscreen-wrapper';
            Object.assign(wrapper.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                backgroundColor: 'black', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: '2147483646'
            });

            playerContainer = video.closest('.html5-video-player, .player, .video-js, [data-vjs-player]') || video.parentElement;

            originalParent = playerContainer.parentElement;
            originalNextSibling = playerContainer.nextElementSibling;

            originalPlayerStyle = {
                width: playerContainer.style.width,
                height: playerContainer.style.height,
                maxWidth: playerContainer.style.maxWidth,
                maxHeight: playerContainer.style.maxHeight,
                position: playerContainer.style.position,
                zIndex: playerContainer.style.zIndex,
            };

            // We no longer need to apply inline styles here as the CSS rule handles it better
            
            wrapper.appendChild(playerContainer);
            document.body.appendChild(wrapper);

            const fsPromise = wrapper.requestFullscreen();

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

        if (tapZone < 0.4) {
            video.currentTime -= config.DOUBLE_TAP_SEEK_SECONDS;
            showIndicator(video, `<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6l-8.5 6z"/></svg> -${config.DOUBLE_TAP_SEEK_SECONDS}s`);
        } else if (tapZone > 0.6) {
            video.currentTime += config.DOUBLE_TAP_SEEK_SECONDS;
            showIndicator(video, `+${config.DOUBLE_TAP_SEEK_SECONDS}s <svg viewBox="0 0 24 24"><path d="M18 6h-2v12h2zM4 6v12l8.5-6L4 6z"/></svg>`);
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
        showIndicator(video, `${icon} ${formatTime(newTime)}`);
    }

    function handleVerticalSwipe(deltaY, type) {
        if (!activeGesture) return;
        const { video } = activeGesture;

        if (type === 'volume') {
            const volumeChange = -deltaY / 150;
            video.volume = Math.max(0, Math.min(1, video.volume + volumeChange));
            showIndicator(video, `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg> ${Math.round(video.volume * 100)}%`);
        } else if (type === 'speed') {
            if (deltaY < -config.SWIPE_THRESHOLD) {
                video.playbackRate = 2.0;
                const speedIcon = `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`;
                showIndicator(video, `${speedIcon} <span>2.0x Speed</span>`);
            } else if (deltaY > config.SWIPE_THRESHOLD) {
                video.playbackRate = 1.0;
                const speedIcon = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
                showIndicator(video, `${speedIcon} <span>1.0x Speed</span>`);
            }
        }
    }

    function handleFullscreenChange() {
        if (!document.fullscreenElement) {
            const wrapper = document.getElementById('vg-fullscreen-wrapper');
            if (wrapper && originalParent && playerContainer) {
                // Restore original inline styles when exiting fullscreen
                Object.assign(playerContainer.style, originalPlayerStyle);
                originalParent.insertBefore(playerContainer, originalNextSibling);
                wrapper.remove();
            }
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
        injectStyles();
        document.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
        document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
        document.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });
        document.addEventListener('fullscreenchange', handleFullscreenChange);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
