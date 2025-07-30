// ==UserScript==
// @name         Mobile Video Gesture Control (Class-based)
// @namespace    http://tampermonkey.net/
// @version      5.4.0
// @description  Definitive fullscreen overlay fix. A robust, class-based implementation for mobile video gestures with a new contextual gesture model.
// @author       사용자 (re-architected by Gemini)
// @license      MIT
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const videoControllers = new WeakMap();

    // --- NEW: Global Overlay Management ---
    let globalOverlay = null;

    /**
     * Creates a single, global overlay that will be shared by all video controllers.
     */
    function createGlobalOverlay() {
        if (globalOverlay) return;
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '10px 20px',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            color: '#fff',
            fontSize: '18px',
            textAlign: 'center',
            borderRadius: '8px',
            zIndex: '2147483647', // Max z-index to ensure it's always on top
            display: 'none',
            lineHeight: '1.5',
            pointerEvents: 'none'
        });
        document.body.appendChild(overlay);
        globalOverlay = overlay;
    }

    /**
     * Listens for fullscreen changes and moves the global overlay into the correct
     * rendering layer to ensure it's always visible.
     */
    document.addEventListener('fullscreenchange', () => {
        if (!globalOverlay) return;
        const fullscreenElement = document.fullscreenElement;
        if (fullscreenElement) {
            // Move the overlay into the fullscreen element to make it visible.
            fullscreenElement.appendChild(globalOverlay);
        } else {
            // Move it back to the body when exiting fullscreen.
            document.body.appendChild(globalOverlay);
        }
    });


    class GestureController {
        // The constructor no longer creates the overlay. It receives the global one.
        constructor(video, overlay) {
            this.video = video;
            this.overlay = overlay; // Use the shared global overlay
            this.userPlaybackRate = video.playbackRate;

            // Gesture state
            this.startX = 0;
            this.startY = 0;
            this.initialTime = 0;
            this.isGestureActive = false;
            this.gestureType = null;
            this.longPressTimeout = null;
            this.touchStartTime = 0;

            this.bindEvents();
        }

        bindEvents() {
            this.handleTouchStart = this.handleTouchStart.bind(this);
            this.handleTouchMove = this.handleTouchMove.bind(this);
            this.handleTouchEnd = this.handleTouchEnd.bind(this);
            this.handleRateChange = this.handleRateChange.bind(this);
            this.handleContextMenu = this.handleContextMenu.bind(this);

            this.video.addEventListener('touchstart', this.handleTouchStart, { passive: false });
            this.video.addEventListener('touchmove', this.handleTouchMove, { passive: false });
            this.video.addEventListener('touchend', this.handleTouchEnd, { passive: false });
            this.video.addEventListener('ratechange', this.handleRateChange);
            this.video.addEventListener('contextmenu', this.handleContextMenu, true);
        }

        handleContextMenu(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        handleTouchStart(e) {
            if (e.touches.length > 1) return;

            this.isGestureActive = true;
            this.gestureType = null;
            this.startX = e.touches[0].clientX;
            this.startY = e.touches[0].clientY;
            this.initialTime = this.video.currentTime;
            this.touchStartTime = Date.now();

            if (document.fullscreenElement) {
                this.longPressTimeout = setTimeout(() => {
                    if (this.isGestureActive && !this.gestureType) {
                        this.gestureType = 'long-press';
                        this.video.playbackRate = 2.0;
                        this.showOverlay('2x Speed');
                    }
                }, 500);
            }
        }

        handleTouchMove(e) {
            if (!this.isGestureActive || this.gestureType === 'long-press') return;

            const deltaX = e.touches[0].clientX - this.startX;
            const deltaY = e.touches[0].clientY - this.startY;

            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                clearTimeout(this.longPressTimeout);

                if (!this.gestureType) {
                    this.gestureType = Math.abs(deltaY) > Math.abs(deltaX) ? 'vertical-swipe' : 'horizontal-swipe';
                }
            }
            
            if (document.fullscreenElement && this.gestureType === 'horizontal-swipe') {
                const timeChange = deltaX * 0.05;
                const newTime = this.initialTime + timeChange;
                const timeChangeFormatted = this.formatTimeChange(timeChange);
                this.showOverlay(`${this.formatCurrentTime(newTime)}<br>(${timeChange >= 0 ? '+' : ''}${timeChangeFormatted})`);
            }
        }

        handleTouchEnd(e) {
            if (!this.isGestureActive) return;
            clearTimeout(this.longPressTimeout);

            const deltaX = e.changedTouches[0].clientX - this.startX;
            const deltaY = e.changedTouches[0].clientY - this.startY;
            const touchDuration = Date.now() - this.touchStartTime;

            if (this.gestureType === 'vertical-swipe') {
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(err => console.error(err));
                } else {
                    this.video.requestFullscreen().catch(err => console.error(err));
                }
            } else if (document.fullscreenElement) {
                if (this.gestureType === 'long-press') {
                    e.preventDefault();
                    this.video.playbackRate = this.userPlaybackRate;
                } else if (this.gestureType === 'horizontal-swipe') {
                    if (touchDuration < 250 && Math.abs(deltaX) < 100) {
                        const seekAmount = deltaX > 0 ? 5 : -5;
                        this.video.currentTime += seekAmount;
                        this.showOverlay(`${seekAmount > 0 ? '+' : ''}${seekAmount}s`, 600);
                    } else {
                        const timeChange = deltaX * 0.05;
                        this.video.currentTime = Math.max(0, Math.min(this.initialTime + timeChange, this.video.duration));
                    }
                }
            }

            if (!this.overlay.innerHTML.includes('s')) {
                 this.hideOverlay();
            }
            this.isGestureActive = false;
        }
        
        handleRateChange() {
            if (this.gestureType !== 'long-press') {
                this.userPlaybackRate = this.video.playbackRate;
            }
        }

        showOverlay(htmlContent, duration = 0) {
            this.overlay.innerHTML = `<div>${htmlContent}</div>`;
            this.overlay.style.display = 'block';
            if (duration > 0) {
                setTimeout(() => this.hideOverlay(), duration);
            }
        }

        hideOverlay() {
            this.overlay.style.display = 'none';
        }

        formatTimeChange(seconds) {
            const sign = seconds < 0 ? '-' : '';
            return `${sign}${this.formatCurrentTime(Math.abs(seconds))}`;
        }

        formatCurrentTime(seconds) {
            seconds = Math.max(0, seconds);
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            const pad = (n) => (n < 10 ? '0' + n : n);
            return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
        }

        destroy() {
            this.video.removeEventListener('touchstart', this.handleTouchStart);
            this.video.removeEventListener('touchmove', this.handleTouchMove);
            this.video.removeEventListener('touchend', this.handleTouchEnd);
            this.video.removeEventListener('ratechange', this.handleRateChange);
            this.video.removeEventListener('contextmenu', this.handleContextMenu, true);
            // The overlay is global, so we don't remove it here.
        }
    }

    function scanForVideos() {
        const videos = Array.from(document.querySelectorAll('video'));
        document.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) {
                videos.push(...el.shadowRoot.querySelectorAll('video'));
            }
        });
        new Set(videos).forEach(initializeController);
    }

    function initializeController(video) {
        if (!videoControllers.has(video)) {
            // Pass the global overlay to the controller.
            const controller = new GestureController(video, globalOverlay);
            videoControllers.set(video, controller);
        }
    }

    // --- Script Execution Start ---
    createGlobalOverlay(); // Create the one-and-only overlay.
    const observer = new MutationObserver(scanForVideos);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', scanForVideos);

})();
