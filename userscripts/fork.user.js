// ==UserScript==
// @name         Mobile Video Seek & Fullscreen Gesture
// @namespace    http://tampermonkey.net/
// @version      4.3
// @description  Adds touch gestures to any HTML5 video on mobile: swipe to seek, long-press for 2x speed, auto-landscape-fullscreen, and disables the context menu. Works with Shadow DOM.
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
        // Try to append to a more specific container if possible
        const container = video.parentElement || document.body;
        container.appendChild(overlay);
        video.overlay = overlay;
    }

    function onTouchStart(e, video) {
        if (!video) return;
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
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
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

    // --- Fullscreen and Orientation Logic ---

    async function enterLandscapeFullscreen(video) {
        if (!/Mobi|Android/i.test(navigator.userAgent)) {
            return;
        }
        // The check is now more reliable because this function is called after metadata is loaded.
        if (video.videoWidth <= video.videoHeight) {
            return;
        }
        const isAlreadyFullscreen = document.fullscreenElement && document.fullscreenElement.contains(video);
        if (isAlreadyFullscreen) {
            return;
        }
        try {
            // Making the parent element fullscreen is often more stable.
            const fullscreenTarget = video.parentElement || video;
            await fullscreenTarget.requestFullscreen();
            // Wait a brief moment for fullscreen transition before locking orientation
            await new Promise(resolve => setTimeout(resolve, 100));
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
                // Ignore errors, as orientation might not have been locked by us.
            }
        }
    }


    // --- Video Discovery and Initialization ---

    function addGestureControls(video) {
        if (!video || video._gestureAdded) return;
        video._gestureAdded = true;

        createOverlay(video);

        let userRate = userPlaybackRates.get(video) || 1.0;
        video.playbackRate = userRate;

        video.addEventListener('ratechange', () => {
            if (!isSpeedingUp) {
                userPlaybackRates.set(video, video.playbackRate);
            }
        });

        // --- FIXED: Fullscreen Trigger Logic ---
        // This function will now be called at the right time.
        const attemptFullscreen = () => enterLandscapeFullscreen(video);

        // Listen for the 'play' event.
        video.addEventListener('play', () => {
            // Check if video metadata is already loaded (readyState > 0).
            if (video.readyState > 0) {
                attemptFullscreen();
            } else {
                // If not, wait for the 'loadedmetadata' event to fire once.
                video.addEventListener('loadedmetadata', attemptFullscreen, { once: true });
            }
        });

        video.addEventListener('touchstart', (e) => onTouchStart(e, video));
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
