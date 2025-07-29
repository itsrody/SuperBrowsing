// ==UserScript==
// @name         Universal Video Touch Controls
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds intuitive, Android-like touch gestures to HTML5 video players on any website.
// @author       Gemini
// @match        *://*/*
// @exclude      *://*.youtube.com/*
// @exclude      *://*.vimeo.com/*
// @exclude      *://*.dailymotion.com/*
// @exclude      *://*.twitch.tv/*
// @exclude      *://*.netflix.com/*
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @resource     material_css https://raw.githubusercontent.com/google/material-design-icons/master/iconfont/material-icons.css
// ==/UserScript==

(async () => {
    'use strict';

    // --- Configuration ---
    const MIN_VIDEO_DURATION = 90; // seconds
    const SEEK_TIME = 5; // seconds to seek forward/backward
    const DOUBLE_TAP_MAX_DELAY = 400; // ms
    const SWIPE_THRESHOLD = 50; // pixels

    // --- Inject Material Icons CSS ---
    // We use GM_addStyle and GM_getResourceText for broad compatibility,
    // though ScriptCat could use @resource-css directly.
    const materialIconsCss = GM_getResourceText("material_css");
    GM_addStyle(materialIconsCss);
    GM_addStyle(`
        .uvtc-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 2147483647; /* Max z-index */
            display: flex;
            justify-content: center;
            align-items: center;
            pointer-events: none; /* Pass clicks through unless we handle them */
            font-family: 'Material Icons', sans-serif;
            color: white;
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
            background-color: rgba(0,0,0,0.2);
            -webkit-tap-highlight-color: transparent;
        }
        .uvtc-overlay.uvtc-visible {
            opacity: 1;
        }
        .uvtc-icon {
            font-size: 64px;
            text-shadow: 0px 0px 15px rgba(0,0,0,0.7);
            transform: scale(0.8);
            animation: uvtc-feedback-anim 0.5s ease-out;
        }
        .uvtc-speed-indicator {
            position: absolute;
            top: 20px;
            right: 20px;
            font-size: 24px;
            font-weight: bold;
            background-color: rgba(0, 0, 0, 0.5);
            padding: 5px 10px;
            border-radius: 12px;
            text-shadow: 0px 0px 10px rgba(0,0,0,0.5);
            animation: uvtc-feedback-anim 0.5s ease-out;
        }
        @keyframes uvtc-feedback-anim {
            from { transform: scale(0.5); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
    `);

    let lastTap = { time: 0, x: 0, y: 0 };
    let swipeStart = { x: 0, y: 0, time: 0 };

    /**
     * Finds and initializes all eligible video players on the page.
     */
    function initializeVideoPlayers() {
        document.querySelectorAll('video').forEach(video => {
            // Check if already initialized
            if (video.dataset.uvtcInitialized) return;

            // Wait for metadata to ensure duration and dimensions are available
            video.addEventListener('loadedmetadata', () => {
                const isLandscape = video.videoWidth > video.videoHeight;
                if (video.duration >= MIN_VIDEO_DURATION && isLandscape) {
                    console.log('UVTC: Initializing gestures for video:', video.src);
                    setupGestureLayer(video);
                }
            }, { once: true });

            // If metadata is already loaded, check immediately
            if (video.readyState >= 1) {
                video.dispatchEvent(new Event('loadedmetadata'));
            }
        });
    }

    /**
     * Creates and attaches the gesture overlay to a video element's container.
     * @param {HTMLVideoElement} video
     */
    function setupGestureLayer(video) {
        video.dataset.uvtcInitialized = 'true';
        const container = video.parentElement;
        // Ensure the container is positioned to contain the overlay
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        const gestureLayer = document.createElement('div');
        gestureLayer.style.position = 'absolute';
        gestureLayer.style.top = '0';
        gestureLayer.style.left = '0';
        gestureLayer.style.width = '100%';
        gestureLayer.style.height = '100%';
        gestureLayer.style.zIndex = '2147483646'; // Just below the feedback overlay
        gestureLayer.style.webkitTapHighlightColor = 'transparent';

        const feedbackOverlay = document.createElement('div');
        feedbackOverlay.className = 'uvtc-overlay';

        container.appendChild(gestureLayer);
        container.appendChild(feedbackOverlay);

        // --- Event Listeners ---
        gestureLayer.addEventListener('touchstart', (e) => handleTouchStart(e, video), { passive: true });
        gestureLayer.addEventListener('touchmove', (e) => handleTouchMove(e, video, feedbackOverlay), { passive: true });
        gestureLayer.addEventListener('touchend', (e) => handleTouchEnd(e, video, feedbackOverlay));
    }

    /**
     * Handles the start of a touch event, primarily for double-tap detection.
     * @param {TouchEvent} e
     * @param {HTMLVideoElement} video
     */
    function handleTouchStart(e, video) {
        const touch = e.touches[0];
        const now = Date.now();
        const timeSinceLastTap = now - lastTap.time;
        const tapX = touch.clientX;
        const tapY = touch.clientY;

        if (timeSinceLastTap < DOUBLE_TAP_MAX_DELAY && isCloseTap(tapX, tapY)) {
            // This is a double tap
            e.preventDefault(); // Prevent single tap action
            handleDoubleTap(tapX, video, feedbackOverlay);
            lastTap.time = 0; // Reset to prevent triple taps
        } else {
            // This is a single tap (or the first of a double tap)
            lastTap = { time: now, x: tapX, y: tapY };
        }

        // Store swipe start position
        swipeStart = { x: touch.clientX, y: touch.clientY, time: now };
    }

    /**
     * Determines if two taps are close enough to be a double tap.
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    function isCloseTap(x, y) {
        const dx = x - lastTap.x;
        const dy = y - lastTap.y;
        return (dx * dx + dy * dy) < (SWIPE_THRESHOLD * SWIPE_THRESHOLD);
    }

    /**
     * Handles the logic for a detected double tap.
     * @param {number} tapX
     * @param {HTMLVideoElement} video
     * @param {HTMLElement} feedbackOverlay
     */
    function handleDoubleTap(tapX, video, feedbackOverlay) {
        const isFullscreen = !!document.fullscreenElement;
        if (isFullscreen) {
            const rect = video.getBoundingClientRect();
            const third = rect.width / 3;
            if (tapX < rect.left + third) {
                // Double tap left
                video.currentTime = Math.max(0, video.currentTime - SEEK_TIME);
                showFeedback(feedbackOverlay, 'replay_5');
            } else if (tapX > rect.right - third) {
                // Double tap right
                video.currentTime = Math.min(video.duration, video.currentTime + SEEK_TIME);
                showFeedback(feedbackOverlay, 'forward_5');
            } else {
                // Double tap middle
                video.paused ? video.play() : video.pause();
            }
        } else {
            // Not fullscreen, double tap enters fullscreen
            video.parentElement.requestFullscreen().catch(err => console.error("UVTC: Fullscreen request failed:", err));
        }
    }

    /**
     * Handles touch movement for swipe gestures.
     * @param {TouchEvent} e
     * @param {HTMLVideoElement} video
     * @param {HTMLElement} feedbackOverlay
     */
    function handleTouchMove(e, video, feedbackOverlay) {
        if (!document.fullscreenElement || e.touches.length === 0) return;

        const touch = e.touches[0];
        const dx = touch.clientX - swipeStart.x;
        const dy = touch.clientY - swipeStart.y;

        // Prioritize horizontal swipe for seeking
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD / 2) {
             // To prevent vertical swipes from triggering while seeking
            swipeStart.y = touch.clientY; // Reset vertical start point
            const seekAmount = (dx / video.clientWidth) * (video.duration / 10); // Scale seek with swipe distance
            video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seekAmount));
            // You could add a visual indicator for seeking here if desired
            swipeStart.x = touch.clientX; // Update start for continuous seeking
        }
    }

    /**
     * Handles the end of a touch for vertical swipe gestures.
     * @param {TouchEvent} e
     * @param {HTMLVideoElement} video
     * @param {HTMLElement} feedbackOverlay
     */
    function handleTouchEnd(e, video, feedbackOverlay) {
        if (!document.fullscreenElement) return;

        const touch = e.changedTouches[0];
        const dx = touch.clientX - swipeStart.x;
        const dy = touch.clientY - swipeStart.y;
        const rect = video.getBoundingClientRect();
        const third = rect.width / 3;

        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_THRESHOLD) {
            // It's a vertical swipe
            if (touch.clientX > rect.right - third) {
                // Right side of screen: Playback speed
                if (dy < 0) { // Swipe Up
                    video.playbackRate = 2.0;
                    showFeedback(feedbackOverlay, null, '2.0x');
                } else { // Swipe Down
                    video.playbackRate = 1.0;
                    showFeedback(feedbackOverlay, null, '1.0x');
                }
            } else {
                 // Any other part of screen: Exit fullscreen on swipe up
                 if (dy < 0) {
                     document.exitFullscreen().catch(err => console.error("UVTC: Exit fullscreen failed:", err));
                 }
            }
        }

        // Reset swipe start
        swipeStart = { x: 0, y: 0, time: 0 };
    }

    /**
     * Shows a visual feedback icon or text on the overlay.
     * @param {HTMLElement} overlay
     * @param {string|null} iconName - Material Icon name (e.g., 'play_arrow').
     * @param {string|null} text - Text to display (e.g., '2.0x').
     */
    function showFeedback(overlay, iconName = null, text = null) {
        overlay.innerHTML = ''; // Clear previous feedback
        if (iconName) {
            const icon = document.createElement('span');
            icon.className = 'uvtc-icon material-icons';
            icon.textContent = iconName;
            overlay.appendChild(icon);
        }
        if (text) {
            const speedIndicator = document.createElement('div');
            speedIndicator.className = 'uvtc-speed-indicator';
            speedIndicator.textContent = text;
            overlay.appendChild(speedIndicator);
        }

        overlay.classList.add('uvtc-visible');
        setTimeout(() => {
            overlay.classList.remove('uvtc-visible');
        }, 600);
    }


    // --- Main Execution ---
    // Initial scan
    initializeVideoPlayers();

    // Use a MutationObserver to detect videos added to the page later (e.g., by other scripts)
    const observer = new MutationObserver((mutations) => {
        let needsScan = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                // A simple check is enough; the function handles duplicates.
                needsScan = true;
                break;
            }
        }
        if (needsScan) {
            initializeVideoPlayers();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
