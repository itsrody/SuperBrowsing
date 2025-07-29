// ==UserScript==
// @name         Video Gestures
// @namespace    https://github.com/itsrody/SuperBrowsing
// @version      1.2
// @description  Adds mobile-friendly video navigation gestures (seek, fast-forward, playback speed) to videos longer than 3 minutes on any webpage. Optimized for Scriptcat on Firefox for Android.
// @author      Murtaza Salih
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const VIDEO_MIN_DURATION_SECONDS = 180; // 3 minutes
    const SEEK_TIME_SECONDS = 10;
    const DOUBLE_TAP_THRESHOLD_MS = 500;

    // --- Style Injection ---
    // Injects the necessary CSS for the gesture indicators into the page head.
    // Styles are designed to mimic Android's Material Design.
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .uvg-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease-out;
                z-index: 2147483647; /* Max z-index */
            }
            .uvg-indicator {
                background-color: rgba(0, 0, 0, 0.6);
                color: white;
                padding: 12px 20px;
                border-radius: 24px;
                font-family: 'Roboto', 'Arial', sans-serif;
                font-size: 16px;
                display: flex;
                align-items: center;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            }
            .uvg-indicator svg {
                width: 24px;
                height: 24px;
                margin-right: 8px;
            }
        `;
        document.head.appendChild(style);
    }

    // --- Gesture Indicator Management ---
    // Creates and shows a visual indicator for the gesture performed.
    function showIndicator(container, text, svgIcon) {
        let overlay = container.querySelector('.uvg-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'uvg-overlay';
            container.appendChild(overlay);
        }

        overlay.innerHTML = `<div class="uvg-indicator">${svgIcon}<span>${text}</span></div>`;

        // Make it visible
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });

        // Hide it after a short duration
        setTimeout(() => {
            overlay.style.opacity = '0';
        }, 800);
    }

    // --- SVG Icons ---
    const icons = {
        fastForward: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`,
        rewind: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm-2-6l6.5 4.5V7.5L9 12z"/></svg>`,
        playSpeed: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 16.5v-9l6 4.5-6 4.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`
    };

    // --- Gesture Handling Logic ---
    // Attaches gesture listeners to a video element.
    function addGestureControls(video) {
        // Create a wrapper for the video to hold our overlay
        const parent = video.parentElement;
        if (parent.style.position === '' || parent.style.position === 'static') {
            parent.style.position = 'relative';
        }

        let lastTap = 0;
        let tapTimeout = null;

        video.addEventListener('click', (e) => {
            // Prevent interfering with the video's own click-to-play/pause
            if (e.detail > 1) {
                 e.preventDefault();
                 e.stopPropagation();
            }
        });

        video.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const timeSinceLastTap = currentTime - lastTap;

            if (timeSinceLastTap < DOUBLE_TAP_THRESHOLD_MS && timeSinceLastTap > 0) {
                // Double tap detected
                clearTimeout(tapTimeout);
                lastTap = 0; // Reset tap timer

                const videoRect = video.getBoundingClientRect();
                const tapX = e.changedTouches[0].clientX - videoRect.left;
                const videoWidth = video.clientWidth;

                if (tapX < videoWidth * 0.35) {
                    // Double tap on the left side: Rewind
                    video.currentTime = Math.max(0, video.currentTime - SEEK_TIME_SECONDS);
                    showIndicator(parent, `-${SEEK_TIME_SECONDS}s`, icons.rewind);
                } else if (tapX > videoWidth * 0.65) {
                    // Double tap on the right side: Fast Forward
                    video.currentTime = Math.min(video.duration, video.currentTime + SEEK_TIME_SECONDS);
                    showIndicator(parent, `+${SEEK_TIME_SECONDS}s`, icons.fastForward);
                } else {
                    // Double tap in the center: Toggle Playback Speed
                    if (video.playbackRate === 1.0) {
                        video.playbackRate = 2.0;
                        showIndicator(parent, 'Speed: 2x', icons.playSpeed);
                    } else {
                        video.playbackRate = 1.0;
                        showIndicator(parent, 'Speed: 1x', icons.playSpeed);
                    }
                }
                 e.preventDefault(); // Prevent default behavior like zoom
            } else {
                // This is the first tap, or taps are too far apart.
                lastTap = currentTime;
                // If it's just a single tap, let the video's default play/pause handle it.
                // We use a small timeout to distinguish single from double taps.
                tapTimeout = setTimeout(() => {
                    // If no second tap occurs, this timeout will run.
                    // We don't need to do anything here, default behavior proceeds.
                }, DOUBLE_TAP_THRESHOLD_MS);
            }
        });

        // Mark this video as processed
        video.dataset.gestureControlsAdded = 'true';
        console.log('Gesture controls added to video:', video);
    }

    // --- Video Detection ---
    // Scans the document for eligible video elements and initializes them.
    function findAndInitializeVideos() {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            // Check if controls have already been added and if video is long enough
            if (video.dataset.gestureControlsAdded) {
                return;
            }

            const checkDuration = () => {
                if (video.duration >= VIDEO_MIN_DURATION_SECONDS) {
                    addGestureControls(video);
                    // Remove the listener once the controls are added
                    video.removeEventListener('loadedmetadata', checkDuration);
                    video.removeEventListener('durationchange', checkDuration);
                }
            };

            // If metadata is already loaded, check duration immediately
            if (video.readyState >= 1) { // HAVE_METADATA
                checkDuration();
            } else {
                // Otherwise, wait for the metadata to load
                video.addEventListener('loadedmetadata', checkDuration);
                video.addEventListener('durationchange', checkDuration); // Fallback
            }
        });
    }

    // --- Main Execution ---
    // Initial setup and observation for dynamically added videos.
    function main() {
        addStyles();
        findAndInitializeVideos();

        // Use a MutationObserver to detect videos added to the page later (e.g., on SPAs)
        const observer = new MutationObserver((mutations) => {
            let videoAdded = false;
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeName === 'VIDEO' || (node.querySelector && node.querySelector('video'))) {
                       videoAdded = true;
                    }
                });
            });
            if(videoAdded) {
               findAndInitializeVideos();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Run the script
    main();

})();
