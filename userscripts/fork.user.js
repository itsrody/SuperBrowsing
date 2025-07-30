// ==UserScript==
// @name         Mobile Video Gesture Control
// @namespace    http://tampermonkey.net/
// @version      4.4
// @description  Adds touch gestures to any HTML5 video on mobile: swipe to seek, long-press for 2x speed, double-tap to toggle landscape-fullscreen, and disables the context menu. Works with Shadow DOM.
// @author       사용자 (updated by Gemini)
// @license      MIT
// @match        *://*/*
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/524654/Mobile%20Video%20Seek%20Gesture.user.js
// @updateURL https://update.greasyfork.org/scripts/524654/Mobile%20Video%20Seek%20Gesture.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // --- State Management Variables ---
    let startX = 0;
    let initialTime = 0;
    let seeking = false;
    let timeChange = 0;
    let longPressTimeout = null;
    let isSpeedingUp = false;
    let movedEnoughForSeek = false;
    let userPlaybackRates = new Map();
    let lastTapTime = 0; // NEW: For detecting double-taps

    // --- Gesture UI & Logic ---

    function createOverlay(video) {
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
        overlay.style.display = 'none';
        overlay.style.lineHeight = '1.5';
        const container = video.parentElement || document.body;
        container.style.position = 'relative'; // Ensure parent can contain the absolute overlay
        container.appendChild(overlay);
        video.overlay = overlay;
    }

    function onTouchStart(e, video) {
        if (!video) return;

        // --- NEW: Double-Tap Logic ---
        const currentTime = new Date().getTime();
        const timeSinceLastTap = currentTime - lastTapTime;

        if (timeSinceLastTap < 300) { // 300ms threshold for a double-tap
            e.preventDefault(); // Prevent zoom or other default double-tap actions
            toggleLandscapeFullscreen(video);
            // Reset tap time to prevent triple-tap from re-triggering
            lastTapTime = 0;
            // Cancel any pending long-press
            clearTimeout(longPressTimeout);
            return; // Exit here to not interfere with seek/speed gestures
        }
        lastTapTime = currentTime;
        // --- End of Double-Tap Logic ---


        if (e.touches.length > 1) {
            seeking = false;
            return;
        }
        startX = e.touches[0].clientX;
        initialTime = video.currentTime;
        seeking = true;
        movedEnoughForSeek = false;
        video.overlay.style.display = 'block';

        longPressTimeout = setTimeout(() => {
            if (!movedEnoughForSeek) {
                userPlaybackRates.set(video, video.playbackRate);
                video.playbackRate = 2.0;
                video.overlay.innerHTML = `<div>2x Speed</div>`;
                isSpeedingUp = true;
            }
        }, 500);
    }

    function onTouchMove(e, video) {
        if (!seeking || !video || isSpeedingUp) return;
        // If finger moves, it's not a tap, so reset tap time
        lastTapTime = 0;
        let deltaX = e.touches[0].clientX - startX;

        if (Math.abs(deltaX) > 10) {
            movedEnoughForSeek = true;
            clearTimeout(longPressTimeout);
        }

        timeChange = deltaX * 0.05;
        let newTime = initialTime + timeChange;
        newTime = Math.max(0, Math.min(newTime, video.duration));

        let timeChangeFormatted = formatTimeChange(timeChange);
        video.overlay.innerHTML = `
            <div>${formatCurrentTime(newTime)}</div>
            <div>(${timeChange >= 0 ? '+' : ''}${timeChangeFormatted})</div>
        `;
    }

    function onTouchEnd(video) {
        seeking = false;
        // Do not clear the longPressTimeout here if it's already fired
        if(longPressTimeout) clearTimeout(longPressTimeout);

        if (isSpeedingUp) {
            video.playbackRate = userPlaybackRates.get(video) || 1.0;
            isSpeedingUp = false;
        } else if (movedEnoughForSeek) {
            let newTime = initialTime + timeChange;
            newTime = Math.max(0, Math.min(newTime, video.duration));
            video.currentTime = newTime;
        }
        video.overlay.style.display = 'none';
        video.overlay.innerHTML = '';
    }

    // --- Time Formatting Utilities ---
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

    function formatTimeChange(seconds) {
        let sign = seconds < 0 ? '-' : '';
        let absSeconds = Math.abs(seconds);
        if (absSeconds >= 60) {
            return `${sign}${formatCurrentTime(absSeconds)}`;
        } else {
            let secs = Math.floor(absSeconds);
            let fraction = Math.round((absSeconds % 1) * 10);
            return `${sign}${secs < 10 ? '0' : ''}${secs}.${fraction}`;
        }
    }

    // --- Fullscreen and Orientation Logic (Now a Toggle) ---
    async function toggleLandscapeFullscreen(video) {
        // If we are already in fullscreen, exit.
        if (document.fullscreenElement) {
            try {
                await document.exitFullscreen();
                // The 'fullscreenchange' event listener will handle unlocking orientation.
            } catch (err) {
                console.error("Userscript Error: Failed to exit fullscreen.", err);
            }
            return;
        }

        // If not in fullscreen, enter.
        if (!/Mobi|Android/i.test(navigator.userAgent)) return;
        if (video.videoWidth <= video.videoHeight) return; // Only for landscape videos

        try {
            const fullscreenTarget = video.parentElement || video;
            await fullscreenTarget.requestFullscreen();
            await screen.orientation.lock('landscape');
        } catch (err) {
            console.error("Userscript Error: Failed to enter landscape fullscreen.", err);
        }
    }

    function handleFullscreenChange() {
        if (!document.fullscreenElement) {
            try {
                screen.orientation.unlock();
            } catch (err) {
                // Ignore errors.
            }
        }
    }

    // --- Video Discovery and Initialization ---
    function addGestureControls(video) {
        if (!video || video._gestureAdded) return;
        video._gestureAdded = true;

        createOverlay(video);

        video.addEventListener('ratechange', () => {
            if (!isSpeedingUp) {
                userPlaybackRates.set(video, video.playbackRate);
            }
        });

        // All gesture logic is now handled in the touch events.
        video.addEventListener('touchstart', (e) => onTouchStart(e, video), { passive: false });
        video.addEventListener('touchmove', (e) => onTouchMove(e, video));
        video.addEventListener('touchend', () => onTouchEnd(video));

        video.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    function findVideosInShadow(root) {
        if (!root) return;
        root.querySelectorAll('video').forEach(addGestureControls);
        root.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) findVideosInShadow(el.shadowRoot);
        });
    }

    function scanForVideos() {
        document.querySelectorAll('video').forEach(addGestureControls);
        findVideosInShadow(document.body);
    }

    // --- Script Execution Start ---
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    const observer = new MutationObserver(scanForVideos);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('load', scanForVideos);

})();
