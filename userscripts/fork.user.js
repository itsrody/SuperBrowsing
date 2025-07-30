// ==UserScript==
// @name          Video Gestures Pro
// @namespace    https://github.com/itsrody/SuperBrowsing
// @version      7.8 // Increased version number for this update
// @description  Adds a powerful, zoned gesture interface (seek, volume, playback speed, fullscreen) to most web videos.
// @author       Murtaza Salih
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
        MIN_VIDEO_DURATION_SECONDS: 90,
        DOUBLE_TAP_SEEK_SECONDS: 5,
        SWIPE_THRESHOLD: 20,
        SEEK_SENSITIVITY: 0.3,
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
        `;
        document.head.appendChild(style);
    }

    // --- Global State ---
    let touchStartX = 0, touchStartY = 0;
    let currentVideo = null;
    let gestureType = null;
    let tapTimeout = null;
    let tapCount = 0;
    let playerContainer = null;
    let originalParent = null;
    let originalNextSibling = null;
    let originalPlayerStyle = {};
    let originalVideoStyle = {}; // To store original video element styles

    // --- UI & Feedback ---
    function showIndicator(video, html) {
        const parent = document.fullscreenElement || video.parentElement;
        if (!parent) return;
        if (!parent.gestureIndicator) {
             const indicator = document.createElement('div');
             indicator.className = 'vg-indicator';
             parent.appendChild(indicator);
             parent.gestureIndicator = indicator;
        }
        const { gestureIndicator } = parent;
        gestureIndicator.innerHTML = html;
        gestureIndicator.classList.add('visible');
        setTimeout(() => { if (gestureIndicator) gestureIndicator.classList.remove('visible'); }, 800);
    }

    function triggerHapticFeedback() {
        if (config.ENABLE_HAPTIC_FEEDBACK && navigator.vibrate) {
            navigator.vibrate(config.HAPTIC_FEEDBACK_DURATION_MS);
        }
    }

    // --- Event Handlers ---
    function onTouchStart(e) {
        let video = e.target.closest('video');
        if (document.fullscreenElement) {
             video = document.fullscreenElement.querySelector('video');
        }

        if (!video || video.duration < config.MIN_VIDEO_DURATION_SECONDS) return;
        
        currentVideo = video;
        
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        gestureType = 'tap';

        if (document.fullscreenElement) {
            const DOUBLE_TAP_TIMEOUT_MS = 350;
            tapTimeout = setTimeout(() => { tapCount = 0; }, DOUBLE_TAP_TIMEOUT_MS);
            tapCount++;
        }
    }

    function onTouchMove(e) {
        if (!currentVideo || e.touches.length > 1) return;

        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;

        if (Math.abs(deltaX) > config.SWIPE_THRESHOLD || Math.abs(deltaY) > config.SWIPE_THRESHOLD) {
            if (gestureType === 'tap') {
                const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX);
                const rect = currentVideo.getBoundingClientRect();
                const tapZone = (touchStartX - rect.left) / rect.width;

                // Only detect swipe-y-fullscreen if already in fullscreen or if it's a specific middle zone vertical swipe
                // Reverting to previous logic where it triggers fullscreen toggle primarily for exiting
                if (isVerticalSwipe && tapZone > 0.33 && tapZone < 0.66) {
                    gestureType = 'swipe-y-fullscreen';
                } else if (document.fullscreenElement) { // Other swipes (seek/volume/speed) only in fullscreen
                    gestureType = isVerticalSwipe ? 'swipe-y' : 'swipe-x';
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
        if (!currentVideo) return;

        // Reverting this logic to only trigger fullscreen toggle when already in fullscreen
        // and a downward swipe occurs. This aligns with the MbGE observation for stability.
        if (gestureType === 'swipe-y-fullscreen') {
            const deltaY = e.changedTouches[0].clientY - touchStartY;
            if (document.fullscreenElement && deltaY > config.SWIPE_THRESHOLD) { // Downward swipe to exit fullscreen
                handleFullscreenToggle();
            }
        }
        else if (document.fullscreenElement) {
            if (gestureType === 'tap' && tapCount >= 2) {
                e.preventDefault();
                handleDoubleTapSeek();
                clearTimeout(tapTimeout);
                tapCount = 0;
            } else if (gestureType === 'swipe-x') {
                const deltaX = e.changedTouches[0].clientX - touchStartX;
                const seekTime = deltaX * config.SEEK_SENSITIVITY;
                currentVideo.currentTime += seekTime;
                triggerHapticFeedback();
            } else if (gestureType === 'swipe-y') {
                triggerHapticFeedback();
            }
        }

        currentVideo = null;
        gestureType = null;
    }

    // --- Gesture Logic ---
    function handleFullscreenToggle() {
        const isFullscreen = document.fullscreenElement;
        const icon = isFullscreen 
            ? `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`
            : `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
        showIndicator(currentVideo, icon);
        triggerHapticFeedback();

        if (isFullscreen) {
            const wrapper = document.getElementById('vg-fullscreen-wrapper');
            if (wrapper && playerContainer && originalParent) { // Ensure all references exist
                // Get the video element from the playerContainer within the wrapper
                // This is safer than relying on the global 'currentVideo' which might be null
                const videoElementToRestore = playerContainer.querySelector('video');

                // Restore original player container styles
                Object.assign(playerContainer.style, originalPlayerStyle);
                
                // Restore original video element styles, if we have a reference to it and its original styles
                if (videoElementToRestore && originalVideoStyle) {
                    Object.assign(videoElementToRestore.style, originalVideoStyle); 
                }

                originalParent.insertBefore(playerContainer, originalNextSibling);
                wrapper.remove();
            }
            if (screen.orientation && typeof screen.orientation.unlock === 'function') {
                screen.orientation.unlock();
            }
        } else {
            const wrapper = document.createElement('div');
            wrapper.id = 'vg-fullscreen-wrapper';
            Object.assign(wrapper.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                backgroundColor: 'black', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: '2147483646'
            });

            playerContainer = currentVideo.parentElement;
            originalParent = playerContainer.parentElement;
            originalNextSibling = playerContainer.nextElementSibling;
            
            // Store original styles of player container
            originalPlayerStyle = {
                width: playerContainer.style.width,
                height: playerContainer.style.height,
                maxWidth: playerContainer.style.maxWidth,
                maxHeight: playerContainer.style.maxHeight,
                position: playerContainer.style.position,
                zIndex: playerContainer.style.zIndex,
            };

            // Store original styles of the video element itself
            originalVideoStyle = {
                width: currentVideo.style.width,
                height: currentVideo.style.height,
                objectFit: currentVideo.style.objectFit,
                maxWidth: currentVideo.style.maxWidth, 
                maxHeight: currentVideo.style.maxHeight,
            };

            // Apply fullscreen styles to player container
            Object.assign(playerContainer.style, {
                width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%',
                position: 'relative', zIndex: '1'
            });

            // Apply fullscreen styles to the video element itself
            Object.assign(currentVideo.style, {
                width: '100%',
                height: '100%',
                objectFit: 'contain', 
                maxWidth: '100%',
                maxHeight: '100%',
            });


            wrapper.appendChild(playerContainer);
            document.body.appendChild(wrapper);
            
            const fsPromise = wrapper.requestFullscreen();
            
            if (config.FORCE_LANDSCAPE && currentVideo.videoWidth > currentVideo.videoHeight) {
                fsPromise.then(() => {
                    if (screen.orientation && typeof screen.orientation.lock === 'function') {
                        screen.orientation.lock('landscape').catch(err => console.warn('Could not lock orientation:', err.message));
                    }
                }).catch(err => console.warn('Fullscreen request failed:', err.message));
            }
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
        } else if (tapZone < 0.33) { // Left side for Playback Speed
            if (deltaY < -config.SWIPE_THRESHOLD) { // Swipe Up
                currentVideo.playbackRate = 2.0;
                const speedIcon = `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`;
                showIndicator(currentVideo, `${speedIcon} <span>2.0x Speed</span>`);
            } else if (deltaY > config.SWIPE_THRESHOLD) { // Swipe Down
                currentVideo.playbackRate = 1.0;
                const speedIcon = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
                showIndicator(currentVideo, `${speedIcon} <span>1.0x Speed</span>`);
            }
        }
    }
    
    function handleFullscreenChange() {
        if (!document.fullscreenElement) {
            const wrapper = document.getElementById('vg-fullscreen-wrapper');
            if (wrapper && originalParent && playerContainer) {
                // Get the video element from the playerContainer within the wrapper
                // This is safer than relying on the global 'currentVideo' which might be null
                const videoElementToRestore = playerContainer.querySelector('video');

                // Restore original player container styles
                Object.assign(playerContainer.style, originalPlayerStyle);
                
                // Restore original video element styles, if we have a reference to it and its original styles
                if (videoElementToRestore && originalVideoStyle) {
                    Object.assign(videoElementToRestore.style, originalVideoStyle); 
                }

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
