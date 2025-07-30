// ==UserScript==
// @name         Mobile Video Gesture Control (Class-based)
// @namespace    http://tampermonkey.net/
// @version      5.2.0
// @description  A robust, class-based implementation for mobile video gestures with contextual controls for fullscreen mode (volume, seek, speed).
// @author       사용자 (re-architected by Gemini)
// @license      MIT
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const videoControllers = new WeakMap();

    class GestureController {
        constructor(video) {
            this.video = video;
            this.overlay = null;
            this.userPlaybackRate = video.playbackRate;

            // Gesture state
            this.startX = 0;
            this.startY = 0;
            this.initialTime = 0;
            this.initialVolume = 0;
            this.isGestureActive = false;
            this.gestureType = null;
            this.longPressTimeout = null;
            this.lastTapTime = 0;

            this.createOverlay();
            this.bindEvents();
        }

        createOverlay() {
            const overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                padding: '10px 20px',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                color: '#fff',
                fontSize: '18px',
                textAlign: 'center',
                borderRadius: '8px',
                zIndex: '99999',
                display: 'none',
                lineHeight: '1.5',
                pointerEvents: 'none'
            });
            this.video.parentElement.appendChild(overlay);
            this.overlay = overlay;
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
            this.initialVolume = this.video.volume;

            // Only set a timeout for long-press if we are in fullscreen mode.
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

            // Gestures are only active in fullscreen mode (except for double-tap).
            if (!document.fullscreenElement) return;

            const deltaX = e.touches[0].clientX - this.startX;
            const deltaY = e.touches[0].clientY - this.startY;

            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                clearTimeout(this.longPressTimeout);

                if (!this.gestureType) {
                    this.gestureType = Math.abs(deltaY) > Math.abs(deltaX) ? 'vertical-swipe' : 'horizontal-swipe';
                }
            }
            
            if (this.gestureType === 'horizontal-swipe') {
                const timeChange = deltaX * 0.05;
                const newTime = this.initialTime + timeChange;
                const timeChangeFormatted = this.formatTimeChange(timeChange);
                this.showOverlay(`${this.formatCurrentTime(newTime)}<br>(${timeChange >= 0 ? '+' : ''}${timeChangeFormatted})`);
            } else if (this.gestureType === 'vertical-swipe') {
                const volumeChange = -deltaY / 200; // Invert Y-axis and scale down
                const newVolume = Math.max(0, Math.min(1, this.initialVolume + volumeChange));
                this.video.volume = newVolume;
                this.showOverlay(`Volume: ${Math.round(newVolume * 100)}%`);
            }
        }

        handleTouchEnd(e) {
            if (!this.isGestureActive) return;
            clearTimeout(this.longPressTimeout);

            const deltaX = e.changedTouches[0].clientX - this.startX;
            const deltaY = e.changedTouches[0].clientY - this.startY;

            // --- Final Gesture Decision Logic ---

            // 1. Check for Taps (for Double-Tap) - This works in both modes.
            if (this.gestureType === null && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
                const now = Date.now();
                if (now - this.lastTapTime < 300) {
                    this.handleDoubleClick();
                    this.lastTapTime = 0; // Reset after double tap
                } else {
                    this.lastTapTime = now;
                }
            }
            // 2. Handle Fullscreen-Only Gestures
            else if (document.fullscreenElement) {
                if (this.gestureType === 'long-press') {
                    e.preventDefault();
                    this.video.playbackRate = this.userPlaybackRate;
                } else if (this.gestureType === 'horizontal-swipe') {
                    const timeChange = deltaX * 0.05;
                    this.video.currentTime = Math.max(0, Math.min(this.initialTime + timeChange, this.video.duration));
                }
                // Vertical swipe is handled in touchmove, no action needed here.
            }

            this.hideOverlay();
            this.isGestureActive = false;
        }

        handleDoubleClick() {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.error(err));
            } else {
                this.video.requestFullscreen().catch(err => console.error(err));
            }
        }
        
        handleRateChange() {
            if (this.gestureType !== 'long-press') {
                this.userPlaybackRate = this.video.playbackRate;
            }
        }

        showOverlay(htmlContent) {
            this.overlay.innerHTML = `<div>${htmlContent}</div>`;
            this.overlay.style.display = 'block';
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
            if (this.overlay) this.overlay.remove();
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
            const controller = new GestureController(video);
            videoControllers.set(video, controller);
        }
    }

    const observer = new MutationObserver(scanForVideos);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', scanForVideos);

})();
