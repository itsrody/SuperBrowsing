// ==UserScript==
// @name        Video Gestures
// @namespace   https://github.com/gemini-code-assist
// @version     3.0
// @description Adds intuitive touch gestures to fullscreen videos longer than 3 minutes. Features a modern, Material Design interface.
// @author      Gemini
// @match       *://*/*
// @grant       none
// @homepageURL https://github.com/gemini-code-assist/userscripts
// @license     MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    const MIN_VIDEO_DURATION_SECONDS = 180; // 3 minutes
    const LONG_PRESS_DURATION_MS = 500; // Time for long press to activate 2x speed
    const SEEK_SENSITIVITY = 0.1; // Higher value = faster seeking
    const MIN_SWIPE_DISTANCE_PX = 20; // Minimum swipe distance to trigger a seek

    // --- Material Design SVG Icons ---
    const ICONS = {
        fastForward: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',
        rewind: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M11 18V6l-8.5 6 8.5 6zm-2-6l6.5 4.5V7.5L9 12z"/></svg>',
        playSpeed: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M10 16.5v-9l6 4.5-6 4.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>',
    };

    // --- Script State ---
    let activeVideo = null;
    let startX = 0;
    let initialTime = 0;
    let isGesturing = false;
    let isSpeedingUp = false;
    let longPressTimeout = null;
    let overlay = null;
    const userPlaybackRates = new Map();

    /**
     * Creates and injects the Material Design overlay and styles into the page.
     * This is done only once.
     */
    function createGlobalOverlay() {
        if (document.getElementById('gm-video-overlay-container')) return;

        const style = document.createElement('style');
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');

            #gm-video-overlay-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 2147483647;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease-in-out;
                font-family: 'Roboto', sans-serif;
            }
            #gm-video-overlay-content {
                background-color: rgba(0, 0, 0, 0.6);
                color: white;
                padding: 16px 24px;
                border-radius: 28px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }
            .gm-video-overlay-icon {
                margin-bottom: 4px;
            }
            .gm-video-overlay-time {
                font-size: 22px;
                font-weight: 500;
            }
            .gm-video-overlay-change {
                font-size: 16px;
                font-weight: 400;
                opacity: 0.8;
            }
        `;
        document.head.appendChild(style);

        overlay = document.createElement('div');
        overlay.id = 'gm-video-overlay-container';
        document.body.appendChild(overlay);
    }

    /**
     * Updates the content and visibility of the overlay.
     * @param {object} options - The content to display.
     * @param {string} options.icon - The SVG icon to show.
     * @param {string} options.time - The main time string.
     * @param {string} [options.change] - The secondary time change string.
     * @param {boolean} show - Whether to show or hide the overlay.
     */
    function updateOverlay({ icon, time, change }, show) {
        if (!overlay) return;
        if (show) {
            let contentHTML = `
                <div class="gm-video-overlay-icon">${icon}</div>
                <div class="gm-video-overlay-time">${time}</div>
            `;
            if (change) {
                contentHTML += `<div class="gm-video-overlay-change">(${change})</div>`;
            }
            overlay.innerHTML = `<div id="gm-video-overlay-content">${contentHTML}</div>`;
            overlay.style.opacity = '1';
        } else {
            overlay.style.opacity = '0';
        }
    }


    /**
     * Checks if a video is a valid target for gestures.
     * @param {HTMLVideoElement} video - The video element to check.
     * @returns {boolean} - True if the video is valid.
     */
    function isValidTarget(video) {
        return video &&
               video.nodeName === 'VIDEO' &&
               video.duration >= MIN_VIDEO_DURATION_SECONDS &&
               document.fullscreenElement === video;
    }

    /**
     * Handles the start of a touch gesture.
     * @param {TouchEvent} e - The touch event.
     */
    function onTouchStart(e) {
        const video = e.target;
        if (!isValidTarget(video)) {
            activeVideo = null;
            return;
        }

        activeVideo = video;
        startX = e.touches[0].clientX;
        initialTime = activeVideo.currentTime;
        isGesturing = true;

        // Start long press timer for speed up
        longPressTimeout = setTimeout(() => {
            if (!isGesturing) return; // Abort if touch has ended

            // Check if user has swiped significantly
            const movedDistance = Math.abs(e.touches[0].clientX - startX);
            if (movedDistance < MIN_SWIPE_DISTANCE_PX) {
                isSpeedingUp = true;
                if (!userPlaybackRates.has(activeVideo)) {
                    userPlaybackRates.set(activeVideo, activeVideo.playbackRate);
                }
                activeVideo.playbackRate = 2.0;
                updateOverlay({ icon: ICONS.playSpeed, time: '2.0x Speed' }, true);
            }
            longPressTimeout = null;
        }, LONG_PRESS_DURATION_MS);
    }

    /**
     * Handles touch movement for seeking.
     * @param {TouchEvent} e - The touch event.
     */
    function onTouchMove(e) {
        if (!isGesturing || !activeVideo || isSpeedingUp) return;

        const deltaX = e.touches[0].clientX - startX;

        // If we move enough, cancel the long press timer
        if (Math.abs(deltaX) > MIN_SWIPE_DISTANCE_PX && longPressTimeout) {
            clearTimeout(longPressTimeout);
            longPressTimeout = null;
        }

        const timeChange = deltaX * SEEK_SENSITIVITY;
        let newTime = initialTime + timeChange;
        newTime = Math.max(0, Math.min(newTime, activeVideo.duration)); // Clamp time

        updateOverlay({
            icon: timeChange > 0 ? ICONS.fastForward : ICONS.rewind,
            time: formatTime(newTime),
            change: `${timeChange >= 0 ? '+' : ''}${Math.round(timeChange)}s`
        }, true);
    }

    /**
     * Handles the end of a touch gesture.
     */
    function onTouchEnd() {
        if (!isGesturing || !activeVideo) return;

        clearTimeout(longPressTimeout);
        longPressTimeout = null;

        if (isSpeedingUp) {
            // Restore original playback speed
            activeVideo.playbackRate = userPlaybackRates.get(activeVideo) || 1.0;
            userPlaybackRates.delete(activeVideo);
        } else {
            // Apply the seek time if not speeding up
            const deltaX = event.changedTouches[0].clientX - startX;
            if (Math.abs(deltaX) > MIN_SWIPE_DISTANCE_PX) {
                 const timeChange = deltaX * SEEK_SENSITIVITY;
                 let newTime = initialTime + timeChange;
                 activeVideo.currentTime = Math.max(0, Math.min(newTime, activeVideo.duration));
            }
        }
        
        updateOverlay({}, false); // Hide overlay
        
        // Reset state
        isGesturing = false;
        isSpeedingUp = false;
        activeVideo = null;
    }

    /**
     * Formats seconds into a HH:MM:SS or MM:SS string.
     * @param {number} totalSeconds - The time in seconds.
     * @returns {string} - The formatted time string.
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

    /**
     * Initializes the script.
     */
    function init() {
        createGlobalOverlay();
        // Use event delegation on the document to catch events on any video element
        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchmove', onTouchMove, { passive: true });
        document.addEventListener('touchend', onTouchEnd, { passive: true });
    }

    // Run the script
    init();

})();
