// ==UserScript==
// @name         Advanced Video Gesture Controls
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Adds intuitive, contextual touch gesture controls with a conflict-free, Shadow DOM-based feedback layer.
// @author       Your Name
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const DEBUG = false; // Set to true for detailed console logs
    const NATIVE_CONTROLS_HEIGHT_PERCENT = 15;

    function log(...args) {
        if (DEBUG) {
            console.log('[VideoGestures]', ...args);
        }
    }

    /**
     * @class FeedbackManager
     * @description A singleton to manage a single, global feedback UI layer inside a Shadow DOM for conflict-free display.
     */
    const FeedbackManager = {
        host: null,
        shadowRoot: null,
        indicator: null,
        timer: null,

        init() {
            if (this.host) return;
            
            this.host = document.createElement('div');
            this.host.id = 'video-gesture-feedback-host';
            document.body.appendChild(this.host);

            this.shadowRoot = this.host.attachShadow({ mode: 'open' });

            const style = document.createElement('style');
            style.textContent = `
                :host {
                    pointer-events: none;
                }
                #indicator {
                    position: fixed;
                    z-index: 2147483647;
                    padding: 20px;
                    border-radius: 15px;
                    background-color: rgba(20, 20, 20, 0.7);
                    backdrop-filter: blur(12px) saturate(150%);
                    -webkit-backdrop-filter: blur(12px) saturate(150%);
                    color: white;
                    text-align: center;
                    display: none;
                    transition: opacity 0.2s ease;
                    opacity: 0;
                }
                #indicator.visible {
                    display: block;
                    opacity: 1;
                }
            `;
            this.shadowRoot.appendChild(style);

            this.indicator = document.createElement('div');
            this.indicator.id = 'indicator';
            this.shadowRoot.appendChild(this.indicator);
        },

        show(video, iconType, text = '') {
            if (!this.indicator) this.init();
            
            const rect = video.getBoundingClientRect();
            this.indicator.style.left = `${rect.left + rect.width / 2}px`;
            this.indicator.style.top = `${rect.top + rect.height / 2}px`;
            this.indicator.style.transform = 'translate(-50%, -50%)';

            const icons = {
                play: `<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
                pause: `<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
                'fast-forward': `<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="M13 6v12l8.5-6M4 18l8.5-6L4 6v12z"/></svg>`,
                rewind: `<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="m11 18 8.5-6L11 6v12zm-2 0V6l-8.5 6L9 18z"/></svg>`,
                volume: `<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
                brightness: `<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/></svg>`,
                'fullscreen-enter': `<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`,
                'fullscreen-exit': `<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`,
                'zoom-in': `<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`,
                'zoom-out': `<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H2v6M16 3h6v6M8 21H2v-6M16 21h6v-6"/></svg>`,
                error: `<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
            };
            this.indicator.innerHTML = `${icons[iconType] || ''}${text ? `<br><span style="font-size: 16px; font-weight: bold;">${text}</span>` : ''}`;
            this.indicator.classList.add('visible');
            
            if (this.timer) clearTimeout(this.timer);
            this.timer = setTimeout(() => this.hide(), 800);
        },

        hide() {
            if (this.indicator) {
                this.indicator.classList.remove('visible');
            }
        },

        hideWithDelay(delay) {
            if (this.timer) clearTimeout(this.timer);
            this.timer = setTimeout(() => this.hide(), delay);
        }
    };

    class VideoGestureControl {
        constructor(video) {
            this.video = video;
            this.container = null;
            this.overlay = null;
            this.resizeObserver = null;
            this.brightnessOverlay = null;

            this.touchStartX = 0;
            this.touchStartY = 0;
            this.lastTap = 0;
            this.longPressTimer = null;
            this.isDragging = false;
            this.dragMode = 'none';
            this.initialPinchDistance = 0;
            this.initialVolume = 0;
            this.initialBrightness = 0;
            this.originalPlaybackRate = 1.0;

            this.init();
        }

        init() {
            if (this.video.readyState >= 1) {
                this.createOverlays();
            } else {
                this.video.addEventListener('loadedmetadata', () => this.createOverlays(), { once: true });
            }
            document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
        }

        createOverlays() {
            this.container = this.video.parentElement;
            if (!this.container) return;

            const parentStyle = window.getComputedStyle(this.container);
            if (parentStyle.position === 'static') {
                this.container.style.position = 'relative';
            }

            this.overlay = document.createElement('div');
            this.overlay.style.position = 'absolute';
            this.overlay.style.zIndex = '2147483646';
            this.container.appendChild(this.overlay);

            this.brightnessOverlay = document.createElement('div');
            this.brightnessOverlay.style.position = 'absolute';
            this.brightnessOverlay.style.backgroundColor = 'black';
            this.brightnessOverlay.style.opacity = '0';
            this.brightnessOverlay.style.pointerEvents = 'none';
            this.brightnessOverlay.style.zIndex = '2147483645';
            this.container.appendChild(this.brightnessOverlay);
            
            this.updateOverlayPositions();
            this.attachObservers();
            this.attachEventListeners();
        }
        
        updateOverlayPositions() {
            if (!this.overlay || !this.video) return;
            const rect = {
                left: this.video.offsetLeft,
                top: this.video.offsetTop,
                width: this.video.offsetWidth,
                height: this.video.offsetHeight,
            };
            this.overlay.style.left = `${rect.left}px`;
            this.overlay.style.top = `${rect.top}px`;
            this.overlay.style.width = `${rect.width}px`;
            this.overlay.style.height = `${rect.height}px`;

            this.brightnessOverlay.style.left = `${rect.left}px`;
            this.brightnessOverlay.style.top = `${rect.top}px`;
            this.brightnessOverlay.style.width = `${rect.width}px`;
            this.brightnessOverlay.style.height = `${rect.height}px`;
        }

        attachObservers() {
            this.resizeObserver = new ResizeObserver(() => this.updateOverlayPositions());
            this.resizeObserver.observe(this.video);
        }

        attachEventListeners() {
            this.overlay.addEventListener('touchstart', (e) => this.handleTouchStart(e));
            this.overlay.addEventListener('touchmove', (e) => this.handleTouchMove(e));
            this.overlay.addEventListener('touchend', (e) => this.handleTouchEnd(e));
            this.overlay.addEventListener('contextmenu', e => e.preventDefault());
        }

        handleTouchStart(e) {
            const rect = this.overlay.getBoundingClientRect();
            const deadZoneTop = rect.bottom - (rect.height * (NATIVE_CONTROLS_HEIGHT_PERCENT / 100));
            const touch = e.touches[0];

            if (touch.clientY > deadZoneTop) return;

            e.stopPropagation();
            if (e.touches.length > 2) return;

            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
            this.isDragging = false;
            this.dragMode = 'none';

            if (e.touches.length === 2) {
                clearTimeout(this.longPressTimer);
                this.initialPinchDistance = this.getPinchDistance(e);
            } else if (e.touches.length === 1) {
                this.initialVolume = this.video.volume;
                this.initialBrightness = parseFloat(this.brightnessOverlay.style.opacity);
                this.originalPlaybackRate = this.video.playbackRate;
                this.longPressTimer = setTimeout(() => {
                    this.dragMode = 'longpress';
                    this.video.playbackRate = 2.0;
                    FeedbackManager.show(this.video, 'fast-forward', '2x Speed');
                    this.vibrate();
                }, 500);
            }
        }

        handleTouchMove(e) {
            e.stopPropagation();
            if (e.touches.length > 2 || this.dragMode === 'longpress') return;

            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const deltaX = touch.clientX - this.touchStartX;
                const deltaY = touch.clientY - this.touchStartY;

                if (!this.isDragging && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
                    this.isDragging = true;
                    clearTimeout(this.longPressTimer);
                    
                    const rect = this.overlay.getBoundingClientRect();
                    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
                        if (this.video.duration === Infinity) {
                            this.dragMode = 'none';
                            FeedbackManager.show(this.video, 'error', 'Live');
                        } else {
                            this.dragMode = 'seek';
                        }
                    } else {
                        if (this.touchStartX < rect.left + rect.width / 3) {
                            this.dragMode = 'brightness';
                        } else if (this.touchStartX > rect.left + rect.width * 2 / 3) {
                            this.dragMode = 'volume';
                        } else {
                            this.dragMode = 'none';
                        }
                    }
                }

                if (this.isDragging) {
                    switch (this.dragMode) {
                        case 'seek':
                            const seekAmount = (deltaX / this.overlay.clientWidth) * 30;
                            this.video.currentTime += seekAmount;
                            FeedbackManager.show(this.video, seekAmount > 0 ? 'fast-forward' : 'rewind');
                            this.touchStartX = touch.clientX;
                            break;
                        case 'volume':
                            const volChange = -deltaY / this.overlay.clientHeight;
                            const newVol = Math.max(0, Math.min(1, this.initialVolume + volChange));
                            this.video.volume = newVol;
                            FeedbackManager.show(this.video, 'volume', `${Math.round(newVol * 100)}%`);
                            break;
                        case 'brightness':
                            const brightChange = -deltaY / this.overlay.clientHeight;
                            const newBright = Math.max(0, Math.min(0.8, this.initialBrightness + brightChange));
                            this.brightnessOverlay.style.opacity = newBright;
                            FeedbackManager.show(this.video, 'brightness', `${Math.round((1-newBright) * 100)}%`);
                            break;
                    }
                }
            } else if (e.touches.length === 2) {
                const currentPinchDistance = this.getPinchDistance(e);
                const pinchDelta = currentPinchDistance - this.initialPinchDistance;
                if (Math.abs(pinchDelta) > 20) {
                    if (pinchDelta > 0) {
                        this.video.style.objectFit = 'cover';
                        FeedbackManager.show(this.video, 'zoom-in', 'Fill');
                    } else {
                        this.video.style.objectFit = 'contain';
                        FeedbackManager.show(this.video, 'zoom-out', 'Fit');
                    }
                    this.initialPinchDistance = currentPinchDistance;
                }
            }
        }

        handleTouchEnd(e) {
            e.stopPropagation();
            clearTimeout(this.longPressTimer);

            if (this.video.playbackRate === 2.0) {
                this.video.playbackRate = this.originalPlaybackRate || 1.0;
                FeedbackManager.hide();
            }

            const now = new Date().getTime();
            const timeSinceLastTap = now - this.lastTap;

            if (!this.isDragging) {
                if (e.changedTouches.length === 2) {
                    this.togglePlay();
                    this.vibrate();
                } else if (e.changedTouches.length === 1 && timeSinceLastTap < 300) {
                    this.lastTap = 0;

                    const touch = e.changedTouches[0];
                    const rect = this.overlay.getBoundingClientRect();
                    const touchX = touch.clientX - rect.left;

                    if (touchX < rect.width / 3) {
                        this.video.currentTime -= 10;
                        FeedbackManager.show(this.video, 'rewind', '-10s');
                    } else if (touchX > rect.width * 2 / 3) {
                        this.video.currentTime += 10;
                        FeedbackManager.show(this.video, 'fast-forward', '+10s');
                    } else {
                        this.toggleFullscreen();
                    }
                    this.vibrate();
                }
            }
            
            if (this.dragMode === 'volume' || this.dragMode === 'brightness' || this.dragMode === 'none') {
                FeedbackManager.hideWithDelay(500);
            }

            this.lastTap = now;
            this.isDragging = false;
            this.dragMode = 'none';
        }

        togglePlay() {
            if (this.video.paused) {
                this.video.play().catch(e => log("Play interrupted:", e));
                FeedbackManager.show(this.video, 'play');
            } else {
                this.video.pause();
                FeedbackManager.show(this.video, 'pause');
            }
        }

        async toggleFullscreen() {
            if (!document.fullscreenElement) {
                try {
                    const orientation = this.video.videoWidth > this.video.videoHeight ? 'landscape' : 'portrait';
                    if (screen.orientation && screen.orientation.lock) {
                        await screen.orientation.lock(orientation);
                    }
                    await (this.container || this.video).requestFullscreen();
                } catch (err) {
                    (this.container || this.video).requestFullscreen().catch(e => log("FS request failed:", e));
                }
            } else {
                await document.exitFullscreen();
            }
        }

        handleFullscreenChange() {
            const fullscreenEl = document.fullscreenElement;
            const isOurVideoFullscreen = fullscreenEl && (fullscreenEl === this.container || fullscreenEl.contains(this.video));

            if (isOurVideoFullscreen) {
                 FeedbackManager.show(this.video, 'fullscreen-enter');
            } else {
                if (screen.orientation && screen.orientation.unlock) {
                    screen.orientation.unlock();
                }
                FeedbackManager.hide();
            }
        }

        getPinchDistance(e) {
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            return Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));
        }

        vibrate() {
            if ('vibrate' in navigator) navigator.vibrate(50);
        }

        destroy() {
            log('Destroying instance for video:', this.video);
            document.removeEventListener('fullscreenchange', () => this.handleFullscreenChange());
            if (this.resizeObserver) this.resizeObserver.disconnect();
            if (this.overlay) this.overlay.remove();
            if (this.brightnessOverlay) this.brightnessOverlay.remove();
            processedVideos.delete(this.video);
        }
    }

    const processedVideos = new WeakMap();

    function setupVideo(video) {
        if (!video.isConnected) return;
        const rect = video.getBoundingClientRect();
        if (rect.width > 50 && rect.height > 50 && !processedVideos.has(video)) {
            log('Setting up for video element ->', video);
            processedVideos.set(video, new VideoGestureControl(video));
        }
    }

    function scanNodeForVideos(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
        
        const videos = node.matches('video') ? [node] : Array.from(node.querySelectorAll('video'));
        videos.forEach(setupVideo);

        const allElements = node.querySelectorAll('*');
        allElements.forEach(el => {
            if (el.shadowRoot) scanNodeForVideos(el.shadowRoot);
        });
    }

    function main() {
        log('Script loaded. Scanning for videos.');
        FeedbackManager.init();
        scanNodeForVideos(document.body);

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach(node => scanNodeForVideos(node));
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const videos = node.matches('video') ? [node] : Array.from(node.querySelectorAll('video'));
                        videos.forEach(video => {
                            if (processedVideos.has(video)) {
                                processedVideos.get(video).destroy();
                            }
                        });
                    }
                });
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.body) {
        main();
    } else {
        new MutationObserver((_, obs) => {
            if (document.body) {
                main();
                obs.disconnect();
            }
        }).observe(document.documentElement, { childList: true });
    }
})();
