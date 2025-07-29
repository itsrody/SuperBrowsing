// ==UserScript==
// @name         Video Gestures
// @namespace    https://github.com/itsrody/SuperBrowsing
// @version      1.1
// @description  Adds intuitive, Android-style touch gestures to HTML5 videos (longer than 3 minutes) on any website. Optimized for performance.
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // --- Configuration ---
    const CONFIG = {
        MIN_DURATION_SECONDS: 180, // 3 minutes
        DOUBLE_TAP_INTERVAL: 300,  // ms
        SEEK_STEP: 5,              // seconds
        SWIPE_THRESHOLD: 10,       // pixels
    };

    const processedVideos = new WeakMap();

    // --- UI Module ---
    const UIManager = {
        create(video) {
            const container = document.createElement('div');
            container.className = 'vg-container';
            video.parentElement.insertBefore(container, video);
            container.appendChild(video);

            const indicator = document.createElement('div');
            indicator.className = 'vg-indicator';
            container.appendChild(indicator);

            const ff_rew_container = document.createElement('div');
            ff_rew_container.className = 'vg-ff-rew-container';
            container.appendChild(ff_rew_container);


            return { container, indicator, ff_rew_container };
        },

        showIndicator(indicatorEl, icon, text) {
            indicatorEl.innerHTML = `<div>${icon}</div><div>${text}</div>`;
            indicatorEl.style.opacity = '1';
            if (this.hideTimer) clearTimeout(this.hideTimer);
            this.hideTimer = setTimeout(() => {
                indicatorEl.style.opacity = '0';
            }, 800);
        },

        showRewind(ff_rew_container) {
            const rewindIndicator = document.createElement('div');
            rewindIndicator.className = 'vg-rewind-indicator';
            rewindIndicator.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8zm-2 5h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>';
            ff_rew_container.appendChild(rewindIndicator);
            setTimeout(() => rewindIndicator.remove(), 600);
        },

        showFastForward(ff_rew_container) {
            const ffIndicator = document.createElement('div');
            ffIndicator.className = 'vg-ff-indicator';
            ffIndicator.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M4 13c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6zm10-1h-2v2h2v-2zm-4 0h-2v2h2v-2z"/></svg>';
            ff_rew_container.appendChild(ffIndicator);
            setTimeout(() => ffIndicator.remove(), 600);
        },

        formatTime: (seconds) => new Date(seconds * 1000).toISOString().substr(11, 8),
    };

    // --- Gesture Handling ---
    const GestureHandler = {
        init(video, ui) {
            const state = {
                touchStartX: 0,
                touchStartY: 0,
                lastTapTime: 0,
                isSwiping: false,
                swipeType: null, // 'seek' or 'volume' or 'brightness'
                initialTime: 0,
                initialVolume: 0,
                initialBrightness: 1,
            };

            ui.container.addEventListener('touchstart', (e) => this.handleTouchStart(e, state, video));
            ui.container.addEventListener('touchmove', (e) => this.handleTouchMove(e, state, video, ui));
            ui.container.addEventListener('touchend', (e) => this.handleTouchEnd(e, state, video, ui));
        },

        handleTouchStart(e, state, video) {
            if (e.touches.length > 1) return;
            const touch = e.touches[0];
            state.touchStartX = touch.clientX;
            state.touchStartY = touch.clientY;
            state.isSwiping = false;
            state.swipeType = null;
            state.initialTime = video.currentTime;
            state.initialVolume = video.volume;
            state.initialBrightness = video.style.filter.match(/brightness\((\d+\.?\d*)\)/)?.[1] || 1;
        },

        handleTouchMove(e, state, video, ui) {
            if (e.touches.length > 1) return;
            e.preventDefault();
            const touch = e.touches[0];
            const deltaX = touch.clientX - state.touchStartX;
            const deltaY = touch.clientY - state.touchStartY;

            if (!state.isSwiping) {
                if (Math.abs(deltaX) > CONFIG.SWIPE_THRESHOLD || Math.abs(deltaY) > CONFIG.SWIPE_THRESHOLD) {
                    state.isSwiping = true;
                    if (Math.abs(deltaX) > Math.abs(deltaY)) {
                        state.swipeType = 'seek';
                    } else {
                        state.swipeType = state.touchStartX < video.clientWidth / 2 ? 'brightness' : 'volume';
                    }
                }
            }

            if (state.isSwiping) {
                switch (state.swipeType) {
                    case 'seek':
                        const seekAmount = (deltaX / video.clientWidth) * 120; // 2 minutes of seeking per screen width
                        const newTime = Math.max(0, Math.min(video.duration, state.initialTime + seekAmount));
                        UIManager.showIndicator(
                            ui.indicator,
                            '↔',
                            `${UIManager.formatTime(newTime)} / ${UIManager.formatTime(video.duration)}`
                        );
                        video.currentTime = newTime;
                        break;
                    case 'volume':
                        const newVolume = Math.max(0, Math.min(1, state.initialVolume - deltaY / 200));
                        video.volume = newVolume;
                        UIManager.showIndicator(ui.indicator, '🔊', `${Math.round(newVolume * 100)}%`);
                        break;
                    case 'brightness':
                         const newBrightness = Math.max(0, Math.min(2, Number(state.initialBrightness) - deltaY / 200));
                         video.style.filter = `brightness(${newBrightness})`;
                         UIManager.showIndicator(ui.indicator, '☀️', `${Math.round(newBrightness * 100)}%`);
                         break;
                }
            }
        },

        handleTouchEnd(e, state, video, ui) {
            if (state.isSwiping) return;

            // Double Tap Logic
            const now = Date.now();
            if (now - state.lastTapTime < CONFIG.DOUBLE_TAP_INTERVAL) {
                const touchX = state.touchStartX;
                const videoWidth = video.clientWidth;

                if (touchX < videoWidth * 0.35) {
                    video.currentTime -= CONFIG.SEEK_STEP;
                    UIManager.showRewind(ui.ff_rew_container);
                } else if (touchX > videoWidth * 0.65) {
                    video.currentTime += CONFIG.SEEK_STEP;
                    UIManager.showFastForward(ui.ff_rew_container);
                } else {
                    if (video.playbackRate !== 2.0) {
                        video.playbackRate = 2.0;
                        UIManager.showIndicator(ui.indicator, '⏩', 'Playback speed: 2.0x');
                    } else {
                        video.playbackRate = 1.0;
                        UIManager.showIndicator(ui.indicator, '▶️', 'Playback speed: 1.0x');
                    }
                }
                state.lastTapTime = 0;
            } else {
                if (e.target === video || e.target.classList.contains('vg-container')) {
                    if (video.paused) video.play();
                    else video.pause();
                }
                state.lastTapTime = now;
            }
        },
    };

    // --- Main Initialization ---
    function initializeVideo(video) {
        if (processedVideos.has(video) || video.dataset.vgInitialized) return;

        if (video.readyState < 1) {
            video.addEventListener('loadedmetadata', () => initializeVideo(video), { once: true });
            return;
        }

        // ADDED: Only initialize for videos longer than the configured minimum duration
        if (video.duration < CONFIG.MIN_DURATION_SECONDS) {
            console.log(`[Video Gestures] Skipping short video (duration: ${Math.round(video.duration)}s)`);
            return;
        }

        const ui = UIManager.create(video);
        GestureHandler.init(video, ui);
        video.dataset.vgInitialized = 'true';
        processedVideos.set(video, true);
        console.log('[Video Gestures] Initialized for:', video);
    }

    // --- Styles ---
    GM_addStyle(`
        .vg-container { position: relative; display: inline-block; line-height: 0; }
        .vg-container .vg-indicator, .vg-container .vg-ff-rew-container { z-index: 2147483647; }
        .vg-indicator {
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.7); color: white;
            padding: 10px 20px; border-radius: 8px;
            font-family: sans-serif; font-size: 16px;
            text-align: center; opacity: 0;
            transition: opacity 0.2s; pointer-events: none;
        }
        .vg-ff-rew-container {
            position: absolute; top: 0; left: 0;
            width: 100%; height: 100%;
            display: flex; justify-content: space-around; align-items: center;
            pointer-events: none; overflow: hidden;
        }
        .vg-rewind-indicator, .vg-ff-indicator {
            width: 35%; height: 100%;
            display: flex; justify-content: center; align-items: center;
            animation: vg-fade-in-out 0.6s forwards;
        }
        @keyframes vg-fade-in-out {
            0% { opacity: 0; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1); }
            100% { opacity: 0; transform: scale(1.2); }
        }
    `);

    // --- DOM Observer ---
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const videos = node.matches('video') ? [node] : node.querySelectorAll('video');
                    videos.forEach(initializeVideo);
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll('video').forEach(initializeVideo);

})();
