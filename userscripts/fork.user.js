// ==UserScript==
// @name         Improved Mobile Video Seek Gesture
// @namespace    http://tampermonkey.net/
// @version      4.5
// @description  Adds touch gestures to any HTML5 video player on mobile browsers. Swipe to seek, long-press for 2x speed. Automatically locks landscape orientation in fullscreen for landscape videos. Prevents context menu interference.
// @author       Your Name
// @license      MIT
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- State and Configuration Variables ---
    let startX = 0;
    let initialTime = 0;
    let seeking = false;
    let timeChange = 0;
    let longPressTimeout = null;
    let isSpeedingUp = false;
    let movedEnoughForSeek = false;
    const userPlaybackRates = new Map(); // Stores the user's original playback speed for each video.

    // --- UI and Formatting Functions ---

    /**
     * Creates and attaches a feedback overlay to a video element.
     * @param {HTMLVideoElement} video The video element to attach the overlay to.
     */
    function createOverlay(video) {
        if (video.overlay) video.overlay.remove(); // Remove existing overlay if any

        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '50%';
        overlay.style.left = '50%';
        overlay.style.transform = 'translate(-50%, -50%)';
        overlay.style.padding = '10px 20px';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        overlay.style.color = '#fff';
        overlay.style.fontSize = '18px';
        overlay.style.textAlign = 'center';
        overlay.style.borderRadius = '8px';
        overlay.style.zIndex = '99999'; // High z-index to appear on top
        overlay.style.display = 'none';
        overlay.style.lineHeight = '1.5';
        overlay.style.pointerEvents = 'none'; // Prevent overlay from capturing touch events

        // Append to the video's parent to be positioned correctly
        if (video.parentElement) {
            video.parentElement.style.position = 'relative'; // Ensure parent is a positioning context
            video.parentElement.appendChild(overlay);
        }
        video.overlay = overlay; // Store a reference to the overlay on the video object
    }

    /**
     * Formats seconds into a HH:MM:SS or MM:SS string.
     * @param {number} seconds The total seconds to format.
     * @returns {string} The formatted time string.
     */
    function formatCurrentTime(seconds) {
        const absSeconds = Math.abs(seconds);
        const hours = Math.floor(absSeconds / 3600);
        const minutes = Math.floor((absSeconds % 3600) / 60);
        const secs = Math.floor(absSeconds % 60);
        const pad = (num) => (num < 10 ? '0' : '') + num;

        if (hours > 0) {
            return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
        }
        return `${pad(minutes)}:${pad(secs)}`;
    }

    /**
     * Formats the change in time for display in the overlay.
     * @param {number} seconds The change in seconds.
     * @returns {string} The formatted time change string (e.g., "+15.20s").
     */
    function formatTimeChange(seconds) {
        const sign = seconds < 0 ? '-' : '+';
        const absSeconds = Math.abs(seconds);
        return `${sign}${absSeconds.toFixed(1)}s`;
    }

    // --- Gesture Event Handlers ---

    const preventContextMenu = (e) => e.preventDefault();

    function onTouchStart(e, video) {
        if (!video) return;
        startX = e.touches[0].clientX;
        initialTime = video.currentTime;
        seeking = true;
        movedEnoughForSeek = false;
        video.overlay.style.display = 'block';

        // NEW: Add a listener to prevent the context menu from appearing on long press.
        video.addEventListener('contextmenu', preventContextMenu);

        // Start a timer for long-press detection
        longPressTimeout = setTimeout(() => {
            if (!movedEnoughForSeek) { // Only speed up if not already swiping
                userPlaybackRates.set(video, video.playbackRate);
                video.playbackRate = 2.0;
                video.overlay.innerHTML = `<div>2x Speed</div>`;
                isSpeedingUp = true;
            }
        }, 500); // 500ms for long press
    }

    function onTouchMove(e, video) {
        if (!seeking || !video || isSpeedingUp) return;
        const deltaX = e.touches[0].clientX - startX;

        // If movement exceeds a threshold, cancel the long-press and start seeking
        if (Math.abs(deltaX) > 10) {
            if (!movedEnoughForSeek) {
                movedEnoughForSeek = true;
                clearTimeout(longPressTimeout);
                // NEW: Since this is a swipe, not a long press, we can allow the context menu again.
                video.removeEventListener('contextmenu', preventContextMenu);
            }
        }

        if (!movedEnoughForSeek) return;

        timeChange = deltaX * 0.1; // Sensitivity for seeking
        let newTime = initialTime + timeChange;
        newTime = Math.max(0, Math.min(newTime, video.duration)); // Clamp time within video bounds

        // Update overlay with seek information
        video.overlay.innerHTML = `
            <div>${formatCurrentTime(newTime)}</div>
            <div>(${formatTimeChange(timeChange)})</div>
        `;
    }

    function onTouchEnd(video) {
        seeking = false;
        clearTimeout(longPressTimeout);
        longPressTimeout = null;

        // NEW: Always clean up the context menu listener when the touch ends.
        video.removeEventListener('contextmenu', preventContextMenu);

        if (isSpeedingUp) {
            // Restore original playback speed after long-press
            video.playbackRate = userPlaybackRates.get(video) || 1.0;
            isSpeedingUp = false;
        } else if (movedEnoughForSeek) {
            // Apply the seek time
            let newTime = initialTime + timeChange;
            video.currentTime = Math.max(0, Math.min(newTime, video.duration));
        }

        // Hide and clear the overlay
        video.overlay.style.display = 'none';
        video.overlay.innerHTML = '';
    }


    // --- Core Logic for Attaching Gestures ---

    /**
     * Checks video properties and adds gesture controls if criteria are met.
     * @param {HTMLVideoElement} video The video element to potentially add controls to.
     */
    function addGestureControls(video) {
        // Use a flag to ensure we don't try to initialize controls more than once.
        if (!video || video._gestureInitStarted) return;
        video._gestureInitStarted = true;

        const setupGestures = () => {
            // --- Condition Checks ---
            // 1. Video has a landscape aspect ratio (width > height)
            // 2. Video is longer than 3 minutes (180 seconds)
            const hasLandscapeAspectRatio = video.videoWidth > video.videoHeight;
            const isLongEnough = video.duration > 180;

            // If the video has a landscape aspect ratio, add the fullscreen orientation lock.
            if (hasLandscapeAspectRatio) {
                video.addEventListener('fullscreenchange', () => {
                    const isFullscreen = document.fullscreenElement === video;
                    try {
                        if (isFullscreen) {
                            // When entering fullscreen, try to lock orientation to landscape.
                            screen.orientation.lock('landscape').catch(() => {});
                        } else {
                            // When exiting fullscreen, unlock the orientation.
                            screen.orientation.unlock();
                        }
                    } catch (err) {
                        console.log("Userscript: Screen Orientation API not supported.", err);
                    }
                });
            }

            // If gesture conditions are not met, stop here.
            if (!hasLandscapeAspectRatio || !isLongEnough) {
                return;
            }

            // Mark that gestures have been successfully added.
            video._gestureAdded = true;

            createOverlay(video);

            // Store the user's current playback rate
            userPlaybackRates.set(video, video.playbackRate);
            video.addEventListener('ratechange', () => {
                if (!isSpeedingUp) {
                    userPlaybackRates.set(video, video.playbackRate);
                }
            });

            // Attach touch event listeners
            video.addEventListener('touchstart', (e) => onTouchStart(e, video));
            video.addEventListener('touchmove', (e) => onTouchMove(e, video));
            video.addEventListener('touchend', () => onTouchEnd(video));
        };

        // Video metadata (like duration and dimensions) may not be loaded immediately.
        // We must wait for the 'loadedmetadata' event.
        if (video.readyState >= 1) { // HAVE_METADATA
            // If metadata is already available, run the setup.
            setupGestures();
        } else {
            // Otherwise, add a one-time event listener to run the setup when it's ready.
            video.addEventListener('loadedmetadata', setupGestures, { once: true });
        }
    }


    // --- Improved Video Discovery ---

    /**
     * Efficiently finds and processes video elements within a given node,
     * including those inside Shadow DOM.
     * @param {Node} node The root node to start the search from.
     */
    function findAndProcessVideos(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) {
            return; // Process only element nodes
        }

        // Case 1: The node itself is a video
        if (node.tagName === 'VIDEO') {
            addGestureControls(node);
        }

        // Case 2: The node contains video elements in its light DOM
        node.querySelectorAll('video').forEach(addGestureControls);

        // Case 3: The node or its children have a Shadow DOM
        // We need to check all descendants for shadow roots.
        const elements = node.querySelectorAll('*');
        for (const el of elements) {
            if (el.shadowRoot) {
                // If a shadow root is found, recursively search within it
                findAndProcessVideos(el.shadowRoot);
            }
        }
    }

    // Use a MutationObserver to detect when new nodes are added to the page.
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                // For each added node, check if it is or contains a video.
                mutation.addedNodes.forEach(node => {
                    findAndProcessVideos(node);
                });
            }
        }
    });

    // Start observing the entire document for added nodes.
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Perform an initial scan for videos that are already on the page when the script runs.
    findAndProcessVideos(document.body);

})();
