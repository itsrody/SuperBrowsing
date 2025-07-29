// ==UserScript==
// @name         Universal Video Touch Gestures (Pro)
// @namespace    http://your-namespace.com
// @version      4.5
// @description  Adds a powerful, zoned gesture interface (seek, volume, brightness, fullscreen, 2x speed) to most web videos.
// @author       Your Name
// @match        *://*/*
// @exclude      *://*.youtube.com/*
// @exclude      *://*.dailymotion.com/*
// @exclude      *://*.vimeo.com/*
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
        SEEK_SENSITIVITY: 0.1,
        ENABLE_HAPTIC_FEEDBACK: true,
        HAPTIC_FEEDBACK_DURATION_MS: 20,
        FORCE_LANDSCAPE: true
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
        `;
        document.head.appendChild(style);
    }

    // --- Global State ---
    let touchStartX = 0, touchStartY = 0;
    let currentVideo = null;
    let gestureType = null; // tap, swipe-x, swipe-y, swipe-y-exit, long-press
    let tapTimeout = null, longPressTimeout = null;
    let tapCount = 0;
    let originalPlaybackRate = 1.0;
    let videoOriginalParent = null;
    let videoOriginalNextSibling = null;

    // --- UI & Feedback ---
    function createElements(video) {
        if (video.gestureIndicator) return;
        const parent = video.parentElement;
        if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

        const indicator = document.createElement('div');
        indicator.className = 'vg-indicator';
        parent.appendChild(indicator);
        video.gestureIndicator = indicator;
    }

    function showIndicator(video, html) {
        if (!video.gestureIndicator) createElements(video);
        const { gestureIndicator } = video;
        gestureIndicator.innerHTML = html;
        gestureIndicator.classList.add('visible');
        setTimeout(() => gestureIndicator.classList.remove('visible'), 800);
    }

    function triggerHapticFeedback() {
        if (config.ENABLE_HAPTIC_FEEDBACK && navigator.vibrate) {
            navigator.vibrate(config.HAPTIC_FEEDBACK_DURATION_MS);
        }
    }

    // --- Event Handlers ---
    function onTouchStart(e) {
        const video = e.target.closest('video');
        if (!video || video.duration < config.MIN_VIDEO_DURATION_SECONDS) return;
        
        currentVideo = video;
        
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        gestureType = 'tap';

        longPressTimeout = setTimeout(() => {
            if (gestureType !== 'tap' || !document.fullscreenElement) return;
            
            gestureType = 'long-press';
            e.preventDefault();
            
            originalPlaybackRate = currentVideo.playbackRate;
            currentVideo.playbackRate = 2.0;
            showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg> <span>2.0x Speed</span>`);
            triggerHapticFeedback();
        }, 500);

        const DOUBLE_TAP_TIMEOUT_MS = 350;
        tapTimeout = setTimeout(() => { tapCount = 0; }, DOUBLE_TAP_TIMEOUT_MS);
        tapCount++;
    }

    function onTouchMove(e) {
        if (!currentVideo || e.touches.length > 1 || gestureType === 'long-press') return;

        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;

        if (Math.abs(deltaX) > config.SWIPE_THRESHOLD || Math.abs(deltaY) > config.SWIPE_THRESHOLD) {
            clearTimeout(longPressTimeout);
            if (gestureType === 'tap') {
                const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX);
                if (document.fullscreenElement) {
                    if (isVerticalSwipe) {
                        const rect = currentVideo.getBoundingClientRect();
                        const tapZone = (touchStartX - rect.left) / rect.width;
                        if (tapZone > 0.33 && tapZone < 0.66) {
                            gestureType = 'swipe-y-exit';
                        } else {
                            gestureType = 'swipe-y';
                        }
                    } else {
                        gestureType = 'swipe-x';
                    }
                }
            }
        }
        
        if (gestureType && gestureType.startsWith('swipe')) {
            e.preventDefault();
            if (gestureType === 'swipe-x') handleHorizontalSwipe(deltaX);
            if (gestureType === 'swipe-y') handleVerticalSwipe(deltaY);
        }
    }

    function onTouchEnd(e) {
        clearTimeout(longPressTimeout);
        if (!currentVideo) return;

        if (gestureType === 'tap' && tapCount >= 2) {
            e.preventDefault();
            if (document.fullscreenElement) {
                handleDoubleTapSeek();
            } else {
                handleDoubleTapFullscreen();
            }
            clearTimeout(tapTimeout);
            tapCount = 0;
        } 
        else if (document.fullscreenElement) {
            if (gestureType === 'swipe-y-exit') {
                const deltaY = e.changedTouches[0].clientY - touchStartY;
                if (deltaY > config.SWIPE_THRESHOLD) {
                    handleFullscreenExit();
                }
            } else if (gestureType === 'long-press') {
                currentVideo.playbackRate = originalPlaybackRate;
                triggerHapticFeedback();
            } else if (gestureType === 'swipe-x') {
                const deltaX = e.changedTouches[0].clientX - touchStartX;
                const seekTime = deltaX * config.SEEK_SENSITIVITY;
                currentVideo.currentTime += seekTime;
                triggerHapticFeedback();
            } else if (gestureType === 'swipe-y') {
                triggerHapticFeedback();
            }
        }

        setTimeout(() => {
             if (currentVideo && currentVideo.gestureIndicator) {
                currentVideo.gestureIndicator.classList.remove('visible');
            }
        }, 300);

        currentVideo = null;
        gestureType = null;
    }

    // --- Gesture Logic ---
    function handleFullscreenExit() {
        const icon = `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`;
        showIndicator(currentVideo, icon);
        triggerHapticFeedback();
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    }

    function handleDoubleTapFullscreen() {
        const icon = `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
        showIndicator(currentVideo, icon);
        triggerHapticFeedback();

        // ** UNIVERSAL FIX: Create our own wrapper for fullscreen **
        const wrapper = document.createElement('div');
        wrapper.id = 'vg-fullscreen-wrapper';
        Object.assign(wrapper.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'black', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: '2147483646'
        });

        // Save the video's original location
        videoOriginalParent = currentVideo.parentElement;
        videoOriginalNextSibling = currentVideo.nextElementSibling;

        // Move the video into our wrapper
        wrapper.appendChild(currentVideo);
        document.body.appendChild(wrapper);
        
        const fsPromise = wrapper.requestFullscreen();
        
        if (config.FORCE_LANDSCAPE && currentVideo.videoWidth > currentVideo.videoHeight) {
            fsPromise.then(() => {
                if (screen.orientation && typeof screen.orientation.lock === 'function') {
                    screen.orientation.lock('landscape').catch(err => {
                        console.warn('Could not lock screen orientation:', err.message);
                    });
                }
            }).catch(err => console.warn('Fullscreen request failed:', err.message));
        }
    }

    function handleDoubleTapSeek() {
        const rect = currentVideo.getBoundingClientRect();
        const tapZone = (touchStartX - rect.left) / rect.width;

        if (tapZone < 0.33) {
            currentVideo.currentTime -= config.DOUBLE_TAP_SEEK_SECONDS;
            showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6l-8.5 6z"/></svg> -${config.DOUBLE_TAP_SEEK_SECONDS}s`);
        } else if (tapZone > 0.66) {
            currentVideo.currentTime += config.DOUBLE_TAP_SEEK_SECONDS;
            showIndicator(currentVideo, `+${config.DOUBLE_TAP_SEEK_SECONDS}s <svg viewBox="0 0 24 24"><path d="M18 6h-2v12h2zM4 6v12l8.5-6L4 6z"/></svg>`);
        }
        triggerHapticFeedback();
    }

    function handleHorizontalSwipe(deltaX) {
        const seekTime = deltaX * config.SEEK_SENSITIVITY;
        const newTime = currentVideo.currentTime + seekTime;
        const direction = seekTime > 0 ? 'forward' : 'rewind';
        const icon = direction === 'forward' ? `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>` : `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm-2-6l6.5 4.5V7.5L9 12z"/></svg>`;
        showIndicator(currentVideo, `${icon} ${formatTime(newTime)}`);
    }

    function handleVerticalSwipe(deltaY) {
        const rect = currentVideo.getBoundingClientRect();
        const tapZone = (touchStartX - rect.left) / rect.width;
        
        if (tapZone > 0.66) { // Right side for Volume
            const volumeChange = -deltaY / 100;
            currentVideo.volume = Math.max(0, Math.min(1, currentVideo.volume + volumeChange));
            showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg> ${Math.round(currentVideo.volume * 100)}%`);
        } else if (tapZone < 0.33) { // Left side for Brightness
            showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg> Brightness`);
        }
    }
    
    function handleFullscreenChange() {
        if (!document.fullscreenElement) {
            // When exiting fullscreen, move video back to its original parent
            const wrapper = document.getElementById('vg-fullscreen-wrapper');
            if (wrapper && videoOriginalParent) {
                videoOriginalParent.insertBefore(currentVideo, videoOriginalNextSibling);
                wrapper.remove();
            }
            // Unlock orientation
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
        document.body.addEventListener('touchstart', onTouchStart, { passive: false });
        document.body.addEventListener('touchmove', onTouchMove, { passive: false });
        document.body.addEventListener('touchend', onTouchEnd, { passive: false });
        document.addEventListener('fullscreenchange', handleFullscreenChange);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
