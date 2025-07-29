// ==UserScript==
// @name         Universal Video Touch Gestures
// @namespace    http://your-namespace.com
// @version      3.3
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
    const SEEK_SENSITIVITY = 0.1; // Higher value = faster seeking for swipe
    const DOUBLE_TAP_SEEK_SECONDS = 10; // Seconds to seek on double-tap
    const DOUBLE_TAP_TIMEOUT_MS = 300; // Max time between taps for a double-tap

    // --- Material Design Styles ---
    function injectStyles() {
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
                border-radius: 24px;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                opacity: 0;
                pointer-events: none;
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
    let tapTimer = null;
    let tapCount = 0;

    // --- UI and Gesture Logic ---

    function createGestureIndicator(video) {
        if (video.gestureIndicator) return;
        const indicator = document.createElement('div');
        indicator.className = 'video-gesture-indicator';
        if (getComputedStyle(video.parentElement).position === 'static') {
            video.parentElement.style.position = 'relative';
        }
        video.parentElement.appendChild(indicator);
        video.gestureIndicator = indicator;
    }

    function updateIndicator(video, htmlContent) {
        if (!video.gestureIndicator) return;
        video.gestureIndicator.innerHTML = htmlContent;
        video.gestureIndicator.classList.add('visible');
    }

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

        // Long press logic
        longPressTimeout = setTimeout(() => {
            if (!hasMovedEnoughForSeek) {
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
            // A swipe cancels both long press and double-tap intentions
            clearTimeout(longPressTimeout);
            clearTimeout(tapTimer);
            tapCount = 0;
        }

        if (hasMovedEnoughForSeek) {
            timeChange = deltaX * SEEK_SENSITIVITY;
            const newTime = Math.max(0, Math.min(initialTime + timeChange, video.duration));
            const direction = timeChange >= 0 ? 'forward' : 'rewind';
            const icon = direction === 'forward'
                ? `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`
                : `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm-2-6l6.5 4.5V7.5L9 12z"/></svg>`;
            updateIndicator(video, `${icon} <div><span>${formatTime(newTime)}</span> / <span>${formatTime(video.duration)}</span></div>`);
        }
    }

    function onTouchEnd(e, video) {
        clearTimeout(longPressTimeout);

        if (isSpeedingUp) {
            video.playbackRate = userPlaybackRates.get(video) || 1.0;
            isSpeedingUp = false;
            setTimeout(() => hideIndicator(video), 300);
        } else if (hasMovedEnoughForSeek) {
            const newTime = initialTime + timeChange;
            video.currentTime = Math.max(0, Math.min(newTime, video.duration));
            setTimeout(() => hideIndicator(video), 300);
        } else {
            // This is a tap, not a swipe or long press
            handleTap(e, video);
        }

        isSeeking = false;
        hasMovedEnoughForSeek = false;
    }

    function handleTap(e, video) {
        tapCount++;
        clearTimeout(tapTimer); // Clear previous timer

        if (tapCount > 1) { // Double-tap or more
            // Determine tap area
            const videoRect = video.getBoundingClientRect();
            const tapZone = (startX - videoRect.left) / videoRect.width;

            if (tapZone < 0.33) { // Left side
                video.currentTime = Math.max(0, video.currentTime - DOUBLE_TAP_SEEK_SECONDS);
                showSeekFeedback(video, 'backward');
            } else if (tapZone > 0.66) { // Right side
                video.currentTime = Math.min(video.duration, video.currentTime + DOUBLE_TAP_SEEK_SECONDS);
                showSeekFeedback(video, 'forward');
            }
            // Taps in the middle do nothing to allow for default play/pause
            
            tapCount = 0; // Reset after action
        } else {
            tapTimer = setTimeout(() => {
                tapCount = 0; // Reset if it's just a single tap
            }, DOUBLE_TAP_TIMEOUT_MS);
        }
    }

    function showSeekFeedback(video, direction) {
        const icon = direction === 'forward'
            ? `<svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z M18 6h-2v12h2V6z"/></svg>`
            : `<svg viewBox="0 0 24 24"><path d="M14 18l1.41-1.41L10.83 12l4.58-4.59L14 6l-6 6 6 6z M6 6h2v12H6V6z"/></svg>`;
        const text = `<span>${DOUBLE_TAP_SEEK_SECONDS}s</span>`;
        updateIndicator(video, `${icon} ${text}`);
        setTimeout(() => hideIndicator(video), 500);
    }

    // --- Utility Functions ---

    function formatTime(totalSeconds) {
        const seconds = Math.floor(totalSeconds % 60);
        const minutes = Math.floor((totalSeconds / 60) % 60);
        const hours = Math.floor(totalSeconds / 3600);
        const paddedSeconds = seconds.toString().padStart(2, '0');
        const paddedMinutes = minutes.toString().padStart(2, '0');
        return hours > 0 ? `${hours}:${paddedMinutes}:${paddedSeconds}` : `${minutes}:${paddedSeconds}`;
    }

    // --- Main Logic ---

    function addGestureControls(video) {
        if (video._gestureControlsAdded) return;
        video._gestureControlsAdded = true;

        const setupControls = () => {
            if (video.duration < MIN_VIDEO_DURATION_SECONDS) return;
            createGestureIndicator(video);
            userPlaybackRates.set(video, video.playbackRate);
            video.addEventListener('ratechange', () => {
                if (!isSpeedingUp) userPlaybackRates.set(video, video.playbackRate);
            });
            video.addEventListener('touchstart', (e) => onTouchStart(e, video), { passive: true });
            video.addEventListener('touchmove', (e) => onTouchMove(e, video), { passive: true });
            video.addEventListener('touchend', (e) => onTouchEnd(e, video), { passive: false }); // Needs to be not passive to prevent default on double tap
        };

        if (video.readyState >= 1) {
            setupControls();
        } else {
            video.addEventListener('loadedmetadata', setupControls, { once: true });
        }
    }

    function scanForVideos(rootNode) {
        if (!rootNode) return;
        try {
            rootNode.querySelectorAll('video').forEach(addGestureControls);
            rootNode.querySelectorAll('*').forEach(el => {
                if (el.shadowRoot) scanForVideos(el.shadowRoot);
            });
        } catch (error) {
            console.error('Video gesture script: Error scanning for videos.', error);
        }
    }

    function initialize() {
        scanForVideos(document.body);
        const observer = new MutationObserver(() => scanForVideos(document.body));
        observer.observe(document.body, { childList: true, subtree: true });
    }

    injectStyles();

    if (document.body) {
        initialize();
    } else {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    }
})();
