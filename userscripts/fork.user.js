// ==UserScript==
// @name         Mobile Video Seek Gesture (Fixed Double Tap)
// @namespace    http://tampermonkey.net/
// @version      5.2
// @description  모바일 브라우저에서 좌우 더블 탭으로 동영상 5초 탐색, 중앙 상하 스와이프로 풀스크린, 길게 눌러 2배속 재생 (Shadow DOM 포함)
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
    let startY = 0;
    let initialTime = 0;
    let longPressTimeout = null; // For 2x speed
    let isSpeedingUp = false; // Current 2x speed state
    let gestureDetected = false; // Flag to indicate if any gesture (swipe, double-tap) has started
    let userPlaybackRates = new Map(); // Stores user's last set playback rate

    // Double-tap specific variables
    let lastTapTime = 0;
    let tapCount = 0;
    let tapTimeout = null;

    // Constants for gesture detection
    const SWIPE_THRESHOLD = 15; // Minimum pixels for a swipe to be recognized
    const DOUBLE_TAP_TIME_THRESHOLD = 300; // Max milliseconds between taps for double-tap
    const DOUBLE_TAP_DISTANCE_THRESHOLD = 30; // Max pixels distance between taps for double-tap
    const SEEK_AMOUNT = 5; // Seconds to seek forward/backward on double-tap

    // Screen regions for gestures (percentages of video width)
    const LEFT_REGION_END = 0.3; // Left 30% for double-tap backward
    const RIGHT_REGION_START = 0.7; // Right 30% for double-tap forward
    const MIDDLE_REGION_START = 0.3; // Middle 40% for fullscreen swipe
    const MIDDLE_REGION_END = 0.7;

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

        // Prevent default browser behavior (like zooming) for potential gestures
        // This is crucial for preventing blackouts on double-tap and general scrolling
        if (e.touches.length === 1) { // Only prevent if single touch for gesture detection
            e.preventDefault();
        }

        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        initialTime = video.currentTime;
        gestureDetected = false; // Reset gesture detection flag

        // Clear any pending long press timeout
        clearTimeout(longPressTimeout);
        longPressTimeout = null;

        // Double-tap detection logic
        const currentTime = new Date().getTime();
        const timeDiff = currentTime - lastTapTime;
        // Calculate distance from the *first* touch of the current tap sequence
        // to the *last* touch of the previous tap sequence.
        // For the first tap, lastX/lastY will be undefined, so use current startX/startY
        const distance = Math.sqrt(
            Math.pow(startX - (e.touches[0].lastX || startX), 2) +
            Math.pow(startY - (e.touches[0].lastY || startY), 2)
        );

        if (timeDiff < DOUBLE_TAP_TIME_THRESHOLD && distance < DOUBLE_TAP_DISTANCE_THRESHOLD) {
            tapCount++;
            clearTimeout(tapTimeout); // Clear previous single-tap timeout
        } else {
            tapCount = 1;
        }

        lastTapTime = currentTime;
        // Store the *current* touch position for the *next* tap's distance calculation
        e.touches[0].lastX = startX;
        e.touches[0].lastY = startY;

        // Set a timeout to reset tapCount if no second tap within the threshold
        tapTimeout = setTimeout(() => {
            tapCount = 0;
        }, DOUBLE_TAP_TIME_THRESHOLD);

        // If a double-tap is detected, we prevent long press and other gestures
        if (tapCount === 2) {
            gestureDetected = true; // Mark as gesture detected to prevent long press
            // Handle double-tap immediately
            handleDoubleTap(video, startX);
            // After handling, reset tapCount and clear timeout for next interaction
            tapCount = 0;
            clearTimeout(tapTimeout);
            // No return here, as preventDefault is already at the top.
        } else {
            // Start long press timeout for 2x speed if no double tap
            longPressTimeout = setTimeout(() => {
                if (!gestureDetected) { // Only activate if no other gesture was detected
                    userPlaybackRates.set(video, video.playbackRate); // Save current rate
                    video.playbackRate = 2.0; // Set to 2x speed
                    video.overlay.innerHTML = `<div>2x Speed</div>`;
                    video.overlay.style.display = 'block';
                    isSpeedingUp = true;
                    gestureDetected = true; // Mark as gesture detected
                }
            }, 500); // 0.5 seconds for long press
        }
    }

    // Handle touch move event
    function onTouchMove(e, video) {
        if (!video) return;

        let currentX = e.touches[0].clientX;
        let currentY = e.touches[0].clientY;
        let deltaX = currentX - startX;
        let deltaY = currentY - startY;

        // If a significant movement occurs, it's a swipe, not a long press or tap
        if (Math.abs(deltaX) > SWIPE_THRESHOLD || Math.abs(deltaY) > SWIPE_THRESHOLD) {
            clearTimeout(longPressTimeout); // Cancel long press
            gestureDetected = true; // Mark as gesture detected
            clearTimeout(tapTimeout); // Cancel any pending double-tap
            tapCount = 0; // Reset tap count
            e.preventDefault(); // Prevent default scrolling/panning when a swipe is detected
        }

        // Only process if not currently speeding up from long press
        if (!isSpeedingUp) {
            // Check for fullscreen swipe in the middle region
            if (startX > video.clientWidth * MIDDLE_REGION_START && startX < video.clientWidth * MIDDLE_REGION_END) {
                if (Math.abs(deltaY) > SWIPE_THRESHOLD) {
                    // e.preventDefault() is already called above if a swipe is detected
                    if (deltaY < 0) { // Swipe up
                        video.overlay.innerHTML = `<div>Fullscreen</div>`;
                        video.overlay.style.display = 'block';
                        video._fullscreenAction = 'enter'; // Store action for touchend
                    } else { // Swipe down
                        video.overlay.innerHTML = `<div>Exit Fullscreen</div>`;
                        video.overlay.style.display = 'block';
                        video._fullscreenAction = 'exit'; // Store action for touchend
                    }
                }
            }
        }
    }

    // Handle touch end event
    function onTouchEnd(video) {
        if (!video) return;

        // Clear long press and tap timeouts
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
        clearTimeout(tapTimeout); // Ensure tap timeout is cleared

        // If currently in 2x speed mode, revert
        if (isSpeedingUp) {
            video.playbackRate = userPlaybackRates.get(video) || 1.0; // Revert to original speed
            isSpeedingUp = false;
        }

        // Handle fullscreen action if a fullscreen swipe was detected
        if (video._fullscreenAction) {
            if (video._fullscreenAction === 'enter') {
                if (video.requestFullscreen) {
                    video.requestFullscreen();
                } else if (video.webkitRequestFullscreen) { /* Safari */
                    video.webkitRequestFullscreen();
                } else if (video.msRequestFullscreen) { /* IE11 */
                    video.msRequestFullscreen();
                }
                video.overlay.innerHTML = `<div>Entering Fullscreen</div>`;
            } else if (video._fullscreenAction === 'exit') {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) { /* Safari */
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) { /* IE11 */
                    document.msExitFullscreen();
                }
                video.overlay.innerHTML = `<div>Exiting Fullscreen</div>`;
            }
            video.overlay.style.display = 'block'; // Keep overlay visible briefly
            setTimeout(() => {
                video.overlay.style.display = 'none';
                video.overlay.innerHTML = '';
            }, 500); // Hide after 0.5 seconds
            video._fullscreenAction = null; // Reset action
        } else {
            // Hide and clear overlay if no other action keeps it visible
            video.overlay.style.display = 'none';
            video.overlay.innerHTML = '';
        }

        // Reset gesture detection flag for the next interaction
        gestureDetected = false;
    }

    // Handle double tap action
    function handleDoubleTap(video, xPosition) {
        let newTime = video.currentTime;
        let seekDirection = '';
        let seekText = '';

        if (xPosition < video.clientWidth * LEFT_REGION_END) { // Double tap on left side
            newTime = Math.max(0, video.currentTime - SEEK_AMOUNT);
            seekDirection = '-';
            seekText = `-${formatTimeChange(SEEK_AMOUNT)}`;
        } else if (xPosition > video.clientWidth * RIGHT_REGION_START) { // Double tap on right side
            newTime = Math.min(video.duration, video.currentTime + SEEK_AMOUNT);
            seekDirection = '+';
            seekText = `+${formatTimeChange(SEEK_AMOUNT)}`;
        } else {
            // Double tap in the middle, do nothing for now or add a default action
            return;
        }

        video.currentTime = newTime;
        video.overlay.innerHTML = `
            <div>${formatCurrentTime(newTime)}</div>
            <div>(${seekText})</div>
        `;
        video.overlay.style.display = 'block';
        setTimeout(() => {
            video.overlay.style.display = 'none';
            video.overlay.innerHTML = '';
        }, 500); // Hide after 0.5 seconds
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
        if (!video || video._gestureAdded) return;
        video._gestureAdded = true;

        createOverlay(video);

        // Initialize playback rate if not already set by user
        let userRate = userPlaybackRates.get(video) || 1.0;
        video.playbackRate = userRate;

        // Save user-initiated playback rate changes
        video.addEventListener('ratechange', () => {
            if (!isSpeedingUp) { // Only save if not our script-initiated 2x speed
                userPlaybackRates.set(video, video.playbackRate);
            }
        });

        // Attach touch event listeners with passive: false to allow preventDefault
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

    // Initial scan when the page loads and when DOM content is ready
    window.addEventListener('load', scanForVideos);
    document.addEventListener('DOMContentLoaded', scanForVideos);
})();
