// ==UserScript==
// @name         Universal Video Gestures (Advanced)
// @namespace    http://tampermonkey.net/
// @version      2.4
// @description  Adds swipe-to-seek, momentary long-press for speed, and double-tap for fullscreen to videos longer than 3 minutes. Disables context menu.
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
    const LONG_PRESS_DURATION_MS = 500; // Slightly shorter for better responsiveness
    const SWIPE_THRESHOLD_X_PX = 40;
    const SWIPE_MAX_VERTICAL_Y_PX = 50;

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
        let singleTapTimeout = null;
        let actionTaken = false;
        let isLongPressActive = false;

        video.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); }, true);
        video.addEventListener('contextmenu', e => e.preventDefault(), true);

        video.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) return;
            
            actionTaken = false;
            isLongPressActive = false;
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchStartTime = Date.now();

            longPressTimeout = setTimeout(() => {
                actionTaken = true;
                isLongPressActive = true;
                video.playbackRate = 2.0;
                showIndicator(container, 'Speed: 2x', icons.playSpeed);
            }, LONG_PRESS_DURATION_MS);

        }, { passive: true });

        video.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1 || actionTaken) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;

            if (Math.abs(deltaX) > SWIPE_THRESHOLD_X_PX && Math.abs(deltaY) < SWIPE_MAX_VERTICAL_Y_PX) {
                clearTimeout(longPressTimeout);
                actionTaken = true;

                if (deltaX > 0) {
                    video.currentTime = Math.min(video.duration, video.currentTime + SEEK_TIME_SECONDS);
                    showIndicator(container, `+${SEEK_TIME_SECONDS}s`, icons.fastForward);
                } else {
                    video.currentTime = Math.max(0, video.currentTime - SEEK_TIME_SECONDS);
                    showIndicator(container, `-${SEEK_TIME_SECONDS}s`, icons.rewind);
                }
                touchStartX = touch.clientX;
            } else if (Math.abs(deltaY) > SWIPE_MAX_VERTICAL_Y_PX) {
                 clearTimeout(longPressTimeout);
            }
        }, { passive: true });

        video.addEventListener('touchend', (e) => {
            clearTimeout(longPressTimeout);

            if (isLongPressActive) {
                video.playbackRate = 1.0;
                showIndicator(container, 'Speed: 1x', icons.playSpeed);
                isLongPressActive = false;
                return;
            }

            if (actionTaken) return;

            const now = Date.now();
            const tapDuration = now - touchStartTime;
            
            if (tapDuration < DOUBLE_TAP_THRESHOLD_MS) {
                if ((now - lastTapTime) < DOUBLE_TAP_THRESHOLD_MS) {
                    clearTimeout(singleTapTimeout);
                    lastTapTime = 0;
                    
                    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
                    if (!isFullscreen) {
                        // **FIX**: Request fullscreen on the video element itself, not the container
                        (video.requestFullscreen || video.webkitRequestFullscreen || video.mozRequestFullScreen).call(video);
                        showIndicator(container, 'Enter Fullscreen', icons.fullscreenEnter);
                    } else {
                        (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen).call(document);
                        showIndicator(container, 'Exit Fullscreen', icons.fullscreenExit);
                    }
                } else {
                    lastTapTime = now;
                    singleTapTimeout = setTimeout(() => {
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

            if (video.readyState >= 1) {
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
