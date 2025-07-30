// ==UserScript==
// @name         Mobile Video Seek Gesture (Enhanced)
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  모바일 브라우저에서 좌우 스와이프 제스처로 동영상 5초 탐색, 좌측 상하 스와이프 제스처로 2배속/1배속 재생 (Shadow DOM 포함)
// @author       사용자
// @license      MIT
// @match        *://*/*
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/524654/Mobile%20Video%20Seek%20Gesture.user.js
// @updateURL https://update.greasyfork.org/scripts/524654/Mobile%20Video%20Seek%20Gesture.meta.js
// ==/UserScript==

(function() {
    'use strict';

    let startX = 0;
    let startY = 0; // New: Y-coordinate for vertical gestures
    let initialTime = 0;
    let gestureType = null; // 'horizontal' for seek, 'vertical-up' for 2x, 'vertical-down' for 1x
    let userPlaybackRates = new Map(); // Stores user's last set playback rate

    // Constants for gesture detection
    const SWIPE_THRESHOLD = 10; // Minimum pixels to consider it a swipe
    const LEFT_SCREEN_PERCENTAGE = 0.3; // Left 30% of the screen for vertical gestures
    const SEEK_AMOUNT = 5; // Seconds to seek forward/backward

    // Create or update the video overlay for visual feedback
    function createOverlay(video) {
        // Remove existing overlay if present
        if (video.overlay) video.overlay.remove();

        let overlay = document.createElement('div');
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
        overlay.style.zIndex = '9999';
        overlay.style.display = 'none'; // Hidden by default
        overlay.style.lineHeight = '1.5';
        overlay.style.pointerEvents = 'none'; // Allow clicks to pass through to video

        // Append overlay to the video's parent element
        // This ensures it stays within the video's bounds and z-index context
        if (video.parentElement) {
            video.parentElement.appendChild(overlay);
        } else {
            // Fallback if no parent (unlikely for video elements)
            document.body.appendChild(overlay);
        }
        video.overlay = overlay; // Store overlay reference on the video object
    }

    // Handle touch start event
    function onTouchStart(e, video) {
        if (!video) return;

        // Reset gesture state
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        initialTime = video.currentTime;
        gestureType = null; // No gesture detected yet

        // Show overlay immediately
        video.overlay.style.display = 'block';
        video.overlay.innerHTML = ''; // Clear previous content
    }

    // Handle touch move event
    function onTouchMove(e, video) {
        if (!video) return;

        let currentX = e.touches[0].clientX;
        let currentY = e.touches[0].clientY;
        let deltaX = currentX - startX;
        let deltaY = currentY - startY;

        // If a gesture type hasn't been determined yet
        if (gestureType === null) {
            // Determine if it's a horizontal or vertical swipe
            if (Math.abs(deltaX) > SWIPE_THRESHOLD || Math.abs(deltaY) > SWIPE_THRESHOLD) {
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    gestureType = 'horizontal'; // Horizontal swipe for seeking
                } else {
                    // Check if vertical swipe is on the left side of the video
                    if (startX < video.clientWidth * LEFT_SCREEN_PERCENTAGE) {
                        if (deltaY < -SWIPE_THRESHOLD) {
                            gestureType = 'vertical-up'; // Swipe up on left for 2x
                        } else if (deltaY > SWIPE_THRESHOLD) {
                            gestureType = 'vertical-down'; // Swipe down on left for 1x
                        }
                    } else {
                        // Vertical swipe not on the left side, ignore for now
                        gestureType = 'none';
                    }
                }
            }
        }

        // Update overlay based on detected gesture type
        if (gestureType === 'horizontal') {
            let seekDirection = deltaX > 0 ? '+' : '-';
            let newTimePreview = initialTime + (deltaX > 0 ? SEEK_AMOUNT : -SEEK_AMOUNT);
            // Clamp preview time to video duration
            newTimePreview = Math.max(0, Math.min(newTimePreview, video.duration));

            video.overlay.innerHTML = `
                <div>${formatCurrentTime(newTimePreview)}</div>
                <div>(${seekDirection}${formatTimeChange(SEEK_AMOUNT)})</div>
            `;
        } else if (gestureType === 'vertical-up') {
            video.overlay.innerHTML = `<div>2x Speed</div>`;
        } else if (gestureType === 'vertical-down') {
            video.overlay.innerHTML = `<div>1x Speed</div>`;
        }
        // Prevent default scrolling behavior for active gestures
        if (gestureType !== null && gestureType !== 'none') {
            e.preventDefault();
        }
    }

    // Handle touch end event
    function onTouchEnd(video) {
        if (!video) return;

        // Apply action based on detected gesture type
        if (gestureType === 'horizontal') {
            let deltaX = e.changedTouches[0].clientX - startX;
            let newTime = video.currentTime;
            if (deltaX > SWIPE_THRESHOLD) { // Swipe right
                newTime = video.currentTime + SEEK_AMOUNT;
            } else if (deltaX < -SWIPE_THRESHOLD) { // Swipe left
                newTime = video.currentTime - SEEK_AMOUNT;
            }
            // Clamp new time to video duration
            video.currentTime = Math.max(0, Math.min(newTime, video.duration));
        } else if (gestureType === 'vertical-up') {
            // Store current rate before changing to 2x
            userPlaybackRates.set(video, video.playbackRate);
            video.playbackRate = 2.0;
        } else if (gestureType === 'vertical-down') {
            // Restore original rate or default to 1x
            video.playbackRate = userPlaybackRates.get(video) || 1.0;
        }

        // Hide and clear overlay after gesture completion
        video.overlay.style.display = 'none';
        video.overlay.innerHTML = '';
        gestureType = null; // Reset gesture type for next interaction
    }

    // Format time into HH:MM:SS or MM:SS
    function formatCurrentTime(seconds) {
        let absSeconds = Math.abs(seconds);
        let hours = Math.floor(absSeconds / 3600);
        let minutes = Math.floor((absSeconds % 3600) / 60);
        let secs = Math.floor(absSeconds % 60);

        if (hours > 0) {
            return `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}:${secs < 10 ? '0' : ''}${secs}`;
        } else {
            return `${minutes < 10 ? '0' : ''}${minutes}:${secs < 10 ? '0' : ''}${secs}`;
        }
    }

    // Format time change (e.g., +5.00 or -0:15)
    function formatTimeChange(seconds) {
        let sign = seconds < 0 ? '-' : '';
        let absSeconds = Math.abs(seconds);
        let hours = Math.floor(absSeconds / 3600);
        let minutes = Math.floor((absSeconds % 3600) / 60);
        let secs = Math.floor(absSeconds % 60);
        let fraction = Math.round((absSeconds % 1) * 100); // Get milliseconds as hundredths

        if (absSeconds >= 3600) {
            return `${sign}${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}:${secs < 10 ? '0' : ''}${secs}`;
        } else if (absSeconds >= 60) {
            return `${sign}${minutes < 10 ? '0' : ''}${minutes}:${secs < 10 ? '0' : ''}${secs}`;
        } else {
            return `${sign}${secs < 10 ? '0' : ''}${secs}.${fraction < 10 ? '0' : ''}${fraction}`;
        }
    }

    // Add gesture controls to a video element
    function addGestureControls(video) {
        // Prevent adding controls multiple times
        if (video._gestureAdded) return;
        video._gestureAdded = true;

        createOverlay(video);

        // Initialize playback rate if not already set by user
        let userRate = userPlaybackRates.get(video) || 1.0;
        video.playbackRate = userRate;

        // Save user-initiated playback rate changes
        video.addEventListener('ratechange', () => {
            // Only save if not a script-initiated speed change (e.g., from vertical swipe)
            // This is a bit tricky with the new logic, but generally, if the user manually
            // changes the speed via the video player controls, we want to remember it.
            // For now, we'll assume direct user interaction on controls should override.
            // A more robust solution might involve checking if the change was from our script.
            // For this version, we'll simplify and always store the rate if it changes.
            userPlaybackRates.set(video, video.playbackRate);
        });

        // Attach touch event listeners
        video.addEventListener('touchstart', (e) => onTouchStart(e, video), { passive: false });
        video.addEventListener('touchmove', (e) => onTouchMove(e, video), { passive: false });
        video.addEventListener('touchend', (e) => onTouchEnd(video), { passive: false });
    }

    // Recursively find videos within Shadow DOMs
    function findVideosInShadow(root) {
        if (!root) return;
        let videos = root.querySelectorAll('video');
        videos.forEach(addGestureControls);
        root.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) findVideosInShadow(el.shadowRoot);
        });
    }

    // Scan the entire document for video elements
    function scanForVideos() {
        document.querySelectorAll('video').forEach(addGestureControls);
        document.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) findVideosInShadow(el.shadowRoot);
        });
    }

    // Observe DOM changes to detect dynamically added videos
    const observer = new MutationObserver(scanForVideos);
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial scan when the page loads
    window.addEventListener('load', scanForVideos);
    // Also run on DOMContentLoaded to catch videos available earlier
    document.addEventListener('DOMContentLoaded', scanForVideos);
})();
