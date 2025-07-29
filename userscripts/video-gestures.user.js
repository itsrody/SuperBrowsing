// ==UserScript==
// @name         Universal Video Touch Gestures
// @namespace    http://your-namespace.com
// @version      3.1
// @description  Adds universal touch gestures (seek, fast-forward) to web videos (>3 min) with an Android Material Design UI.
// @author       Your Name
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    const MIN_VIDEO_DURATION_SECONDS = 180; // 3 minutes
    const LONG_PRESS_DELAY_MS = 500; // 0.5 seconds to trigger 2x speed
    const SEEK_SENSITIVITY = 0.1; // Higher value = faster seeking

    // --- Material Design Styles ---
    // Injects the necessary CSS for the UI into the page head.
    function injectStyles() {
        // Avoid injecting styles multiple times
        if (document.getElementById('video-gesture-styles')) return;

        const style = document.createElement('style');
        style.id = 'video-gesture-styles';
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');

            .video-gesture-indicator {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.9);
                padding: 12px 16px;
                background-color: rgba(30, 30, 30, 0.85);
                color: #ffffff;
                font-family: 'Roboto', sans-serif;
                font-size: 16px;
                text-align: center;
                border-radius: 24px; /* Pill shape */
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                opacity: 0;
                pointer-events: none; /* Prevent indicator from blocking other controls */
                transition: opacity 0.2s ease-out, transform 0.2s ease-out;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
                line-height: 1.5;
            }

            .video-gesture-indicator.visible {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }

            .video-gesture-indicator svg {
                width: 24px;
                height: 24px;
                fill: #ffffff;
            }
        `;
        document.head.appendChild(style);
    }

    // --- Global State ---
    let startX = 0;
    let initialTime = 0;
    let isSeeking = false;
    let timeChange = 0;
    let longPressTimeout = null;
    let isSpeedingUp = false;
    let hasMovedEnoughForSeek = false;
    const userPlaybackRates = new Map();

    // --- UI and Gesture Logic ---

    /**
     * Creates the gesture indicator UI for a given video.
     * @param {HTMLVideoElement} video - The video element to attach the indicator to.
     */
    function createGestureIndicator(video) {
        if (video.gestureIndicator) return; // Already created

        const indicator = document.createElement('div');
        indicator.className = 'video-gesture-indicator';
        // The parent needs to be positioned for the absolute positioning to work correctly.
        if (getComputedStyle(video.parentElement).position === 'static') {
            video.parentElement.style.position = 'relative';
        }
        video.parentElement.appendChild(indicator);
        video.gestureIndicator = indicator;
    }

    /**
     * Updates the indicator's content (icon and text).
     * @param {HTMLVideoElement} video - The video element.
     * @param {string} htmlContent - The HTML content to display.
     */
    function updateIndicator(video, htmlContent) {
        if (!video.gestureIndicator) return;
        video.gestureIndicator.innerHTML = htmlContent;
        video.gestureIndicator.classList.add('visible');
    }

    /**
     * Hides the indicator.
     * @param {HTMLVideoElement} video - The video element.
     */
    function hideIndicator(video) {
        if (!video.gestureIndicator) return;
        video.gestureIndicator.classList.remove('visible');
    }

    // --- Event Handlers ---

    function onTouchStart(e, video) {
        startX = e.touches[0].clientX;
        initialTime = video.currentTime;
        isSeeking = true;
        hasMovedEnoughForSeek = false;
        timeChange = 0;

        // Long press to activate 2x speed
        longPressTimeout = setTimeout(() => {
            if (!hasMovedEnoughForSeek) { // Only if not already seeking
                userPlaybackRates.set(video, video.playbackRate);
                video.playbackRate = 2.0;
                isSpeedingUp = true;
                const speedIcon = `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`;
                updateIndicator(video, `${speedIcon} <span>2.0x Speed</span>`);
            }
        }, LONG_PRESS_DELAY_MS);
    }

    function onTouchMove(e, video) {
        if (!isSeeking || isSpeedingUp) return;

        const deltaX = e.touches[0].clientX - startX;
        if (Math.abs(deltaX) > 10 && !hasMovedEnoughForSeek) {
            hasMovedEnoughForSeek = true;
            clearTimeout(longPressTimeout); // Cancel long press if user starts swiping
        }

        if (hasMovedEnoughForSeek) {
            timeChange = deltaX * SEEK_SENSITIVITY;
            const newTime = Math.max(0, Math.min(initialTime + timeChange, video.duration));
            const timeDiffFormatted = formatTime(Math.abs(timeChange));
            const direction = timeChange >= 0 ? 'forward' : 'rewind';
            const icon = direction === 'forward'
                ? `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`
                : `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm-2-6l6.5 4.5V7.5L9 12z"/></svg>`;

            updateIndicator(video, `
                ${icon}
                <div>
                    <span>${formatTime(newTime)}</span> / <span>${formatTime(video.duration)}</span>
                </div>
            `);
        }
    }

    function onTouchEnd(e, video) {
        clearTimeout(longPressTimeout);

        if (isSpeedingUp) {
            video.playbackRate = userPlaybackRates.get(video) || 1.0;
            isSpeedingUp = false;
        } else if (hasMovedEnoughForSeek) {
            const newTime = initialTime + timeChange;
            video.currentTime = Math.max(0, Math.min(newTime, video.duration));
        }

        setTimeout(() => hideIndicator(video), 300); // Hide after a small delay
        isSeeking = false;
        hasMovedEnoughForSeek = false;
    }

    // --- Utility Functions ---

    /**
     * Formats seconds into HH:MM:SS or MM:SS format.
     * @param {number} totalSeconds - The time in seconds.
     * @returns {string} The formatted time string.
     */
    function formatTime(totalSeconds) {
        const seconds = Math.floor(totalSeconds % 60);
        const minutes = Math.floor((totalSeconds / 60) % 60);
        const hours = Math.floor(totalSeconds / 3600);

        const paddedSeconds = seconds.toString().padStart(2, '0');
        const paddedMinutes = minutes.toString().padStart(2, '0');

        if (hours > 0) {
            return `${hours}:${paddedMinutes}:${paddedSeconds}`;
        }
        return `${minutes}:${paddedSeconds}`;
    }

    // --- Main Logic ---

    /**
     * Adds gesture controls to a video element if it meets the criteria.
     * @param {HTMLVideoElement} video - The video element.
     */
    function addGestureControls(video) {
        // Use a flag to prevent adding listeners multiple times
        if (video._gestureControlsAdded) return;
        video._gestureControlsAdded = true; // Mark as processed immediately

        const setupControls = () => {
            // Check video duration. Only apply to videos longer than the minimum.
            if (video.duration < MIN_VIDEO_DURATION_SECONDS) {
                console.log('Video gesture script: Skipping video shorter than 3 minutes.');
                return;
            }

            console.log('Video gesture script: Initializing for video.');
            createGestureIndicator(video);

            // Store the initial playback rate
            userPlaybackRates.set(video, video.playbackRate);
            video.addEventListener('ratechange', () => {
                if (!isSpeedingUp) {
                    userPlaybackRates.set(video, video.playbackRate);
                }
            });

            // Attach touch event listeners
            video.addEventListener('touchstart', (e) => onTouchStart(e, video), { passive: true });
            video.addEventListener('touchmove', (e) => onTouchMove(e, video), { passive: true });
            video.addEventListener('touchend', (e) => onTouchEnd(e, video), { passive: true });
        };

        // The 'duration' property may not be available immediately.
        // Wait for the 'loadedmetadata' event to ensure we can check it.
        if (video.readyState >= 1) { // METADATA is already loaded
            setupControls();
        } else {
            video.addEventListener('loadedmetadata', setupControls, { once: true });
        }
    }

    /**
     * Scans the entire document, including Shadow DOMs, for video elements.
     * @param {Document|ShadowRoot} rootNode - The node to start scanning from.
     */
    function scanForVideos(rootNode) {
        rootNode.querySelectorAll('video').forEach(addGestureControls);
        rootNode.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) {
                scanForVideos(el.shadowRoot);
            }
        });
    }

    // --- Initialization ---
    injectStyles();

    // Initial scan when the script runs
    scanForVideos(document);

    // Use MutationObserver to detect videos added to the DOM later
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                scanForVideos(document.body);
                // We can break here because scanForVideos will handle all new videos at once.
                break;
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
