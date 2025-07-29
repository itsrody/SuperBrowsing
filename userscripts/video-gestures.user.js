// ==UserScript==
// @name         Universal Video Touch Gestures
// @namespace    http://your-namespace.com
// @version      3.4
// @description  Adds universal swipe gestures (seek, playback speed) to web videos (>3 min) with an Android Material Design UI.
// @author       Your Name
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    const MIN_VIDEO_DURATION_SECONDS = 180; // 3 minutes
    const SEEK_SENSITIVITY = 0.1; // Higher value = faster seeking for swipe
    const SWIPE_THRESHOLD = 20; // Minimum pixels moved to register a swipe

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
    let startY = 0;
    let initialTime = 0;
    let isGestureActive = false;
    let timeChange = 0;
    let gestureType = null; // Can be 'seek' or 'speed'

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
        startY = e.touches[0].clientY;
        initialTime = video.currentTime;
        isGestureActive = true;
        timeChange = 0;
        gestureType = null; // Reset gesture type on new touch
    }

    function onTouchMove(e, video) {
        if (!isGestureActive) return;

        const deltaX = e.touches[0].clientX - startX;
        const deltaY = e.touches[0].clientY - startY;

        // Determine gesture type on first significant movement
        if (!gestureType) {
            if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
                gestureType = 'seek';
            } else if (Math.abs(deltaY) > SWIPE_THRESHOLD) {
                gestureType = 'speed';
            }
        }

        if (gestureType === 'seek') {
            timeChange = deltaX * SEEK_SENSITIVITY;
            const newTime = Math.max(0, Math.min(initialTime + timeChange, video.duration));
            const direction = timeChange >= 0 ? 'forward' : 'rewind';
            const icon = direction === 'forward'
                ? `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`
                : `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm-2-6l6.5 4.5V7.5L9 12z"/></svg>`;
            updateIndicator(video, `${icon} <div><span>${formatTime(newTime)}</span> / <span>${formatTime(video.duration)}</span></div>`);
        } else if (gestureType === 'speed') {
            if (deltaY < -SWIPE_THRESHOLD) { // Swipe Up
                video.playbackRate = 2.0;
                const speedIcon = `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`;
                updateIndicator(video, `${speedIcon} <span>2.0x Speed</span>`);
            } else if (deltaY > SWIPE_THRESHOLD) { // Swipe Down
                video.playbackRate = 1.0;
                const speedIcon = `<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`;
                updateIndicator(video, `${speedIcon} <span>1.0x Speed</span>`);
            }
        }
    }

    function onTouchEnd(e, video) {
        if (gestureType === 'seek') {
            const newTime = initialTime + timeChange;
            video.currentTime = Math.max(0, Math.min(newTime, video.duration));
        }

        // Hide indicator after a delay regardless of gesture
        setTimeout(() => hideIndicator(video), 500);

        isGestureActive = false;
        gestureType = null;
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
            video.addEventListener('touchstart', (e) => onTouchStart(e, video), { passive: true });
            video.addEventListener('touchmove', (e) => onTouchMove(e, video), { passive: true });
            video.addEventListener('touchend', (e) => onTouchEnd(e, video), { passive: true });
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
