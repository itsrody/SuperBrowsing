// ==UserScript==
// @name         Video Gestures
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Adds swipe-to-seek, long-press for speed, and double-tap for fullscreen to videos longer than 3 minutes. Optimized for Scriptcat on Firefox for Android.
// @author       Your Name
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration Constants ---
    const VIDEO_MIN_DURATION_SECONDS = 180; // 3 minutes
    const SEEK_TIME_SECONDS = 10;
    const DOUBLE_TAP_THRESHOLD_MS = 400;
    const LONG_PRESS_DURATION_MS = 600;
    const SWIPE_THRESHOLD_X_PX = 40; // Min horizontal distance for a swipe
    const SWIPE_MAX_VERTICAL_Y_PX = 50; // Max vertical distance to still be a horizontal swipe

    // --- Style Injection ---
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .uvg-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease-out;
                z-index: 2147483647;
            }
            .uvg-indicator {
                background-color: rgba(0, 0, 0, 0.65);
                color: white;
                padding: 12px 20px;
                border-radius: 24px;
                font-family: 'Roboto', 'Arial', sans-serif;
                font-size: 16px;
                display: flex;
                align-items: center;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }
            .uvg-indicator svg {
                width: 24px;
                height: 24px;
                margin-right: 8px;
            }
        `;
        document.head.appendChild(style);
    }

    // --- Gesture Indicator Management ---
    function showIndicator(container, text, svgIcon) {
        let overlay = container.querySelector('.uvg-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'uvg-overlay';
            container.appendChild(overlay);
        }
        overlay.innerHTML = `<div class="uvg-indicator">${svgIcon}<span>${text}</span></div>`;
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });
        setTimeout(() => {
            overlay.style.opacity = '0';
        }, 800);
    }

    // --- SVG Icons ---
    const icons = {
        fastForward: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`,
        rewind: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm-2-6l6.5 4.5V7.5L9 12z"/></svg>`,
        playSpeed: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 16.5v-9l6 4.5-6 4.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`,
        fullscreenEnter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
        fullscreenExit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`
    };

    // --- Gesture Handling Logic ---
    function addGestureControls(video) {
        const container = video.parentElement;
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        // Gesture state variables
        let touchStartX = 0, touchStartY = 0;
        let touchStartTime = 0;
        let lastTapTime = 0;
        let longPressTimeout = null;
        let actionTaken = false; // Flag to prevent multiple actions from one touch sequence

        // Stop native click events to prevent conflicts
        video.addEventListener('click', e => e.preventDefault(), true);

        video.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) return; // Ignore multi-touch gestures
            
            actionTaken = false;
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchStartTime = Date.now();

            // Start a timer for long press
            longPressTimeout = setTimeout(() => {
                actionTaken = true; // Mark that an action has been performed
                if (video.playbackRate === 1.0) {
                    video.playbackRate = 2.0;
                    showIndicator(container, 'Speed: 2x', icons.playSpeed);
                } else {
                    video.playbackRate = 1.0;
                    showIndicator(container, 'Speed: 1x', icons.playSpeed);
                }
            }, LONG_PRESS_DURATION_MS);

        }, { passive: true });

        video.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1 || actionTaken) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;

            // Check if it's a horizontal swipe
            if (Math.abs(deltaX) > SWIPE_THRESHOLD_X_PX && Math.abs(deltaY) < SWIPE_MAX_VERTICAL_Y_PX) {
                clearTimeout(longPressTimeout); // It's a swipe, not a long press
                actionTaken = true;

                if (deltaX > 0) { // Swipe right -> Fast Forward
                    video.currentTime = Math.min(video.duration, video.currentTime + SEEK_TIME_SECONDS);
                    showIndicator(container, `+${SEEK_TIME_SECONDS}s`, icons.fastForward);
                } else { // Swipe left -> Rewind
                    video.currentTime = Math.max(0, video.currentTime - SEEK_TIME_SECONDS);
                    showIndicator(container, `-${SEEK_TIME_SECONDS}s`, icons.rewind);
                }
                // Reset start position to allow for continuous swiping without lifting finger
                touchStartX = touch.clientX;
            } else if (Math.abs(deltaY) > SWIPE_MAX_VERTICAL_Y_PX) {
                // If it's a vertical swipe, cancel the long press timer
                 clearTimeout(longPressTimeout);
            }
        }, { passive: true });

        video.addEventListener('touchend', (e) => {
            clearTimeout(longPressTimeout);
            if (actionTaken) return; // An action (swipe, long press) was already handled

            const now = Date.now();
            const tapDuration = now - touchStartTime;
            
            // It's a tap, not a swipe or long press
            if (tapDuration < DOUBLE_TAP_THRESHOLD_MS) {
                if ((now - lastTapTime) < DOUBLE_TAP_THRESHOLD_MS) {
                    // --- Double Tap Action: Fullscreen ---
                    lastTapTime = 0; // Reset tap timer
                    const isFullscreen = !!document.fullscreenElement;
                    if (!isFullscreen) {
                        (container.requestFullscreen || container.webkitRequestFullscreen || container.mozRequestFullScreen).call(container);
                        showIndicator(container, 'Enter Fullscreen', icons.fullscreenEnter);
                    } else {
                        (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen).call(document);
                        showIndicator(container, 'Exit Fullscreen', icons.fullscreenExit);
                    }
                } else {
                    // --- Single Tap Action: Play/Pause ---
                    // This is the first tap, wait to see if a second one comes.
                    // We trigger play/pause via a timeout. If a double tap occurs, this gets cancelled.
                    // But a simple play/pause is better.
                    lastTapTime = now;
                    // We add a small delay to allow the double-tap to register.
                    setTimeout(() => {
                        // if lastTapTime is still the same, it means no double tap happened
                        if (lastTapTime === now) {
                             if (video.paused) {
                                video.play();
                            } else {
                                video.pause();
                            }
                        }
                    }, DOUBLE_TAP_THRESHOLD_MS);
                }
            }
        });

        video.dataset.gestureControlsAdded = 'true';
        console.log('Advanced gesture controls added to video:', video);
    }

    // --- Video Detection ---
    function findAndInitializeVideos() {
        document.querySelectorAll('video').forEach(video => {
            if (video.dataset.gestureControlsAdded) return;

            const checkDuration = () => {
                if (video.duration >= VIDEO_MIN_DURATION_SECONDS) {
                    addGestureControls(video);
                    video.removeEventListener('loadedmetadata', checkDuration);
                    video.removeEventListener('durationchange', checkDuration);
                }
            };

            if (video.readyState >= 1) { // HAVE_METADATA
                checkDuration();
            } else {
                video.addEventListener('loadedmetadata', checkDuration);
                video.addEventListener('durationchange', checkDuration);
            }
        });
    }

    // --- Main Execution ---
    function main() {
        addStyles();
        findAndInitializeVideos();

        const observer = new MutationObserver(() => findAndInitializeVideos());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    main();

})();
