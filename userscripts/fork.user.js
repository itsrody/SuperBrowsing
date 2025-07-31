// ==UserScript==
// @name         Enhanced Video Gestures (Classic Style)
// @name:en      Enhanced Video Gestures (Classic Style)
// @version      2.1.0
// @description  Adds Android-style touch gestures with a classic, minimalist overlay style and intelligent conflict prevention.
// @author       Your Name (Based on itsrody's script, enhanced by Gemini)
// @match        *://*/*
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.addStyle
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    const CONFIG = {
        DOUBLE_TAP_TIME: 300, // Time in ms to detect a double tap
        SWIPE_THRESHOLD: 30, // Minimum pixels to move to trigger a swipe
        LONG_PRESS_TIME: 500, // Time in ms to detect a long press for playback speed
        OVERLAY_TIMEOUT: 800, // How long to show the overlay icons
    };

    // Use a WeakMap to store state for each video element
    const videoStates = new WeakMap();

    // --- Fullscreen Conflict Detection ---
    /**
     * Checks if the native player likely has its own double-tap-to-fullscreen gesture.
     * @param {HTMLElement} videoWrapper - The element that contains the video.
     * @returns {Promise<boolean>} - True if a native gesture is detected.
     */
    function detectNativeFullscreenGesture(videoWrapper) {
        return new Promise(resolve => {
            let detected = false;
            const timeout = 150; // Wait 150ms for a reaction

            const onFullscreenChange = () => {
                detected = true;
            };

            document.addEventListener('fullscreenchange', onFullscreenChange);

            // Dispatch a fake double-click event to probe the player
            const dblClickEvent = new MouseEvent('dblclick', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            videoWrapper.dispatchEvent(dblClickEvent);

            setTimeout(() => {
                document.removeEventListener('fullscreenchange', onFullscreenChange);
                if (detected) {
                    console.log('[Gestures] Native double-tap fullscreen detected. Disabling custom gesture.');
                }
                resolve(detected);
            }, timeout);
        });
    }


    // --- Gesture Handling Logic ---

    function handleTouchStart(e) {
        const video = e.currentTarget.video;
        const state = videoStates.get(video);
        if (!state || e.touches.length > 1) return;

        state.touchStartX = e.touches[0].clientX;
        state.touchStartY = e.touches[0].clientY;
        state.isSwiping = false;
        state.longPressTimer = setTimeout(() => onLongPress(video), CONFIG.LONG_PRESS_TIME);
    }

    function handleTouchMove(e) {
        const video = e.currentTarget.video;
        const state = videoStates.get(video);
        if (!state || e.touches.length > 1) return;

        const deltaX = e.touches[0].clientX - state.touchStartX;
        const deltaY = e.touches[0].clientY - state.touchStartY;

        if (Math.abs(deltaX) > CONFIG.SWIPE_THRESHOLD || Math.abs(deltaY) > CONFIG.SWIPE_THRESHOLD) {
            clearTimeout(state.longPressTimer);
            state.isSwiping = true;
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                const seekAmount = (deltaX / video.offsetWidth) * 60;
                video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seekAmount));
                showOverlay(state.overlay, ` ${formatTime(video.currentTime)} / ${formatTime(video.duration)}`);
            } else {
                const change = -deltaY / video.offsetHeight;
                if (state.touchStartX < window.innerWidth / 2) {
                    showOverlay(state.overlay, '☀️ Brightness');
                } else {
                    video.volume = Math.max(0, Math.min(1, video.volume + change));
                    showOverlay(state.overlay, `🔊 ${Math.round(video.volume * 100)}%`);
                }
            }
        }
    }

    function handleTouchEnd(e) {
        const video = e.currentTarget.video;
        const state = videoStates.get(video);
        if (!state) return;

        clearTimeout(state.longPressTimer);

        if (state.isLongPressing) {
            video.playbackRate = state.originalPlaybackRate;
            state.isLongPressing = false;
            hideOverlay(state.overlay);
            return;
        }

        if (state.isSwiping) {
            hideOverlay(state.overlay);
            return;
        }

        if (state.tapTimer) {
            clearTimeout(state.tapTimer);
            state.tapTimer = null;
            onDoubleTap(video, state);
        } else {
            state.tapTimer = setTimeout(() => {
                state.tapTimer = null;
                onSingleTap(video);
            }, CONFIG.DOUBLE_TAP_TIME);
        }
    }

    function onSingleTap(video) {
        video.paused ? video.play() : video.pause();
    }

    function onDoubleTap(video, state) {
        const rect = video.getBoundingClientRect();
        const tapPosition = (state.touchStartX - rect.left) / rect.width;

        if (tapPosition < 0.3) {
            video.currentTime -= 10;
            showOverlay(state.overlay, '« 10s');
        } else if (tapPosition > 0.7) {
            video.currentTime += 10;
            showOverlay(state.overlay, '10s »');
        } else {
            if (!state.hasNativeFullscreen) {
                toggleFullscreen(video, state);
            } else {
                video.paused ? video.play() : video.pause();
            }
        }
    }

    function onLongPress(video) {
        const state = videoStates.get(video);
        if (state.isSwiping) return;
        state.isLongPressing = true;
        state.originalPlaybackRate = video.playbackRate;
        video.playbackRate = 2.0;
        showOverlay(state.overlay, '▶️▶️ Speed 2x');
    }

    function toggleFullscreen(video, state) {
        if (!document.fullscreenElement) {
            state.videoWrapper.requestFullscreen();
            showOverlay(state.overlay, '⛶ Enter Fullscreen');
        } else {
            document.exitFullscreen();
            showOverlay(state.overlay, '⛶ Exit Fullscreen');
        }
    }


    // --- UI & Helper Functions ---

    function formatTime(seconds) {
        const date = new Date(seconds * 1000);
        const hh = date.getUTCHours();
        const mm = date.getUTCMinutes();
        const ss = date.getUTCSeconds().toString().padStart(2, '0');
        if (hh) {
            return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
        }
        return `${mm}:${ss}`;
    }

    function showOverlay(overlay, text) {
        overlay.textContent = text;
        overlay.style.opacity = '1';
        if (overlay.hideTimer) clearTimeout(overlay.hideTimer);
        overlay.hideTimer = setTimeout(() => hideOverlay(overlay), CONFIG.OVERLAY_TIMEOUT);
    }

    function hideOverlay(overlay) {
        overlay.style.opacity = '0';
    }


    // --- Initialization ---

    function injectStyles() {
        // NEW: Adopted classic styling for the overlay
        GM.addStyle(`
            .gesture-overlay {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: rgba(0, 0, 0, 0.55);
                color: white;
                padding: 10px 18px;
                border-radius: 6px;
                font-size: 16px;
                font-family: sans-serif;
                font-weight: bold;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.4s ease;
                z-index: 2147483647;
            }
        `);
    }

    async function initVideo(video) {
        if (videoStates.has(video)) return;

        const videoWrapper = video.parentElement;
        if (!videoWrapper) return;

        const overlay = document.createElement('div');
        overlay.className = 'gesture-overlay';
        videoWrapper.style.position = 'relative';
        videoWrapper.appendChild(overlay);

        const hasNativeFullscreen = await detectNativeFullscreenGesture(videoWrapper);

        videoStates.set(video, {
            overlay: overlay,
            videoWrapper: videoWrapper,
            hasNativeFullscreen: hasNativeFullscreen,
            touchStartX: 0,
            touchStartY: 0,
            isSwiping: false,
            isLongPressing: false,
            tapTimer: null,
            originalPlaybackRate: video.playbackRate,
        });

        const gestureTarget = videoWrapper;
        gestureTarget.video = video;
        gestureTarget.addEventListener('touchstart', handleTouchStart, { passive: false });
        gestureTarget.addEventListener('touchmove', handleTouchMove, { passive: false });
        gestureTarget.addEventListener('touchend', handleTouchEnd, { passive: false });
    }

    // --- Main Execution ---
    injectStyles();

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.tagName === 'VIDEO') {
                        initVideo(node);
                    } else {
                        node.querySelectorAll('video').forEach(initVideo);
                    }
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    document.querySelectorAll('video').forEach(initVideo);

})();
