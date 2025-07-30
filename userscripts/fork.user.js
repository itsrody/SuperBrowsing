// ==UserScript==
// @name         Mobile Video Seek Gesture (Revised Gesture Logic)
// @namespace    http://tampermonkey.net/
// @version      5.3
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
    let activeGesture = null; // 'longPress', 'horizontalSeek', 'fullscreenSwipe', 'none'
    let userPlaybackRates = new Map(); // Stores user's last set playback rate

    // Double-tap specific variables
    let lastTapTime = 0;
    let tapCount = 0;
    let tapStartX = 0; // Store startX for double-tap region check
    let tapStartY = 0; // Store startY for double-tap distance check

    // Constants for gesture detection
    const SWIPE_THRESHOLD = 20; // Minimum pixels for a swipe to be recognized
    const DOUBLE_TAP_TIME_THRESHOLD = 300; // Max milliseconds between taps for double-tap
    const DOUBLE_TAP_DISTANCE_THRESHOLD = 40; // Max pixels distance between taps for double-tap
    const LONG_PRESS_DELAY = 500; // Milliseconds for long press activation
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
        overlay.style.whiteSpace = 'nowrap'; // Prevent text wrapping

        // Append overlay to the video's parent element
        if (video.parentElement) {
            video.parentElement.appendChild(overlay);
        } else {
            // Fallback if no parent (unlikely for video elements)
            document.body.appendChild(overlay);
        }
        video.overlay = overlay; // Store overlay reference on the video object
    }

    // Show overlay with content
    function showOverlay(video, content) {
        if (video.overlay) {
            video.overlay.innerHTML = content;
            video.overlay.style.display = 'block';
        }
    }

    // Hide overlay after a delay
    function hideOverlay(video, delay = 0) {
        if (video.overlay) {
            if (delay > 0) {
                setTimeout(() => {
                    video.overlay.style.display = 'none';
                    video.overlay.innerHTML = '';
                }, delay);
            } else {
                video.overlay.style.display = 'none';
                video.overlay.innerHTML = '';
            }
        }
    }

    // Handle touch start event
    function onTouchStart(e, video) {
        if (!video || e.touches.length !== 1) return; // Only process single touches

        // Prevent default browser behavior (like zooming) for potential gestures
        // This is crucial for preventing blackouts on double-tap and general scrolling
        e.preventDefault();

        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        initialTime = video.currentTime;
        activeGesture = null; // Reset active gesture

        // Clear any pending long press timeout
        clearTimeout(longPressTimeout);
        longPressTimeout = null;

        // Start long press timeout for 2x speed
        longPressTimeout = setTimeout(() => {
            if (!activeGesture) { // Only activate if no other gesture has started
                activeGesture = 'longPress';
                userPlaybackRates.set(video, video.playbackRate); // Save current rate
                video.playbackRate = 2.0; // Set to 2x speed
                showOverlay(video, `<div>2x Speed</div>`);
                isSpeedingUp = true;
            }
        }, LONG_PRESS_DELAY); // 0.5 seconds for long press

        // Store tap start coordinates for double-tap distance check
        tapStartX = startX;
        tapStartY = startY;
    }

    // Handle touch move event
    function onTouchMove(e, video) {
        if (!video || e.touches.length !== 1) return;

        let currentX = e.touches[0].clientX;
        let currentY = e.touches[0].clientY;
        let deltaX = currentX - startX;
        let deltaY = currentY - startY;

        // If a significant movement occurs, it's a swipe, not a long press or tap
        if (Math.abs(deltaX) > SWIPE_THRESHOLD || Math.abs(deltaY) > SWIPE_THRESHOLD) {
            clearTimeout(longPressTimeout); // Cancel long press
            if (!activeGesture) { // Determine gesture type if not already set
                if (Math.abs(deltaX) > Math.abs(deltaY)) { // Horizontal swipe
                    activeGesture = 'horizontalSeek';
                } else { // Vertical swipe
                    // Check for fullscreen swipe in the middle region
                    if (startX > video.clientWidth * MIDDLE_REGION_START && startX < video.clientWidth * MIDDLE_REGION_END) {
                        activeGesture = 'fullscreenSwipe';
                    } else {
                        // Vertical swipe outside middle region, ignore as a custom gesture
                        activeGesture = 'none';
                    }
                }
            }
        }

        // Update overlay based on active gesture
        if (activeGesture === 'horizontalSeek') {
            // This gesture is no longer active, as we are using double-tap for seek.
            // If this block is reached, it means a horizontal swipe was detected,
            // but we don't have a continuous seek. So, we'll just ignore it for now
            // or consider it a "no-op" swipe.
            // For now, let's ensure the overlay is hidden if this state is reached.
            hideOverlay(video);
        } else if (activeGesture === 'fullscreenSwipe') {
            if (deltaY < 0) { // Swipe up
                showOverlay(video, `<div>Fullscreen</div>`);
                video._fullscreenAction = 'enter'; // Store action for touchend
            } else { // Swipe down
                showOverlay(video, `<div>Exit Fullscreen</div>`);
                video._fullscreenAction = 'exit'; // Store action for touchend
            }
        }
    }

    // Handle touch end event
    function onTouchEnd(e, video) {
        if (!video) return;

        // Clear all pending timeouts
        clearTimeout(longPressTimeout);
        longPressTimeout = null;

        // If currently in 2x speed mode, revert
        if (isSpeedingUp) {
            video.playbackRate = userPlaybackRates.get(video) || 1.0; // Revert to original speed
            isSpeedingUp = false;
            hideOverlay(video, 500); // Hide after a brief delay
        }

        // Handle fullscreen action if a fullscreen swipe was detected
        if (activeGesture === 'fullscreenSwipe' && video._fullscreenAction) {
            if (video._fullscreenAction === 'enter') {
                if (video.requestFullscreen) {
                    video.requestFullscreen();
                } else if (video.webkitRequestFullscreen) { /* Safari */
                    video.webkitRequestFullscreen();
                } else if (video.msRequestFullscreen) { /* IE11 */
                    video.msRequestFullscreen();
                }
                showOverlay(video, `<div>Entering Fullscreen</div>`);
            } else if (video._fullscreenAction === 'exit') {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) { /* Safari */
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) { /* IE11 */
                    document.msExitFullscreen();
                }
                showOverlay(video, `<div>Exiting Fullscreen</div>`);
            }
            hideOverlay(video, 500); // Hide after 0.5 seconds
            video._fullscreenAction = null; // Reset action
        } else if (!activeGesture) {
            // This block handles single taps and double taps
            const currentTime = new Date().getTime();
            const timeDiff = currentTime - lastTapTime;
            const distance = Math.sqrt(
                Math.pow(e.changedTouches[0].clientX - tapStartX, 2) +
                Math.pow(e.changedTouches[0].clientY - tapStartY, 2)
            );

            if (timeDiff < DOUBLE_TAP_TIME_THRESHOLD && distance < DOUBLE_TAP_DISTANCE_THRESHOLD) {
                tapCount++;
            } else {
                tapCount = 1;
            }

            lastTapTime = currentTime;

            if (tapCount === 2) {
                // Double-tap detected
                handleDoubleTap(video, e.changedTouches[0].clientX);
                tapCount = 0; // Reset for next double-tap
            } else {
                // This was a single tap, or the first tap of a potential double-tap
                // If it's just a single tap and no other gesture was active,
                // we might want to hide the overlay immediately if it was shown by long press
                // but then cancelled by a quick tap.
                hideOverlay(video);
            }
        } else {
            // If an active gesture was detected (e.g., longPress but released before 2x),
            // ensure overlay is hidden.
            hideOverlay(video);
        }

        // Reset active gesture for the next interaction
        activeGesture = null;
    }

    // Handle double tap action
    function handleDoubleTap(video, xPosition) {
        let newTime = video.currentTime;
        let seekText = '';

        if (xPosition < video.clientWidth * LEFT_REGION_END) { // Double tap on left side
            newTime = Math.max(0, video.currentTime - SEEK_AMOUNT);
            seekText = `-${formatTimeChange(SEEK_AMOUNT)}`;
        } else if (xPosition > video.clientWidth * RIGHT_REGION_START) { // Double tap on right side
            newTime = Math.min(video.duration, video.currentTime + SEEK_AMOUNT);
            seekText = `+${formatTimeChange(SEEK_AMOUNT)}`;
        } else {
            // Double tap in the middle, do nothing for now (or add a custom action)
            return;
        }

        video.currentTime = newTime;
        showOverlay(video, `
            <div>${formatCurrentTime(newTime)}</div>
            <div>(${seekText})</div>
        `);
        hideOverlay(video, 500); // Hide after 0.5 seconds
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
        video.addEventListener('touchend', (e) => onTouchEnd(e, video), { passive: false }); // Pass event object
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
