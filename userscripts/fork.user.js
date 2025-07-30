// ==UserScript==
// @name         Mobile Video Gesture Control (Class-based)
// @namespace    http://tampermonkey.net/
// @version      5.3.0
// @description  A robust, class-based implementation for mobile video gestures with contextual controls and a definitive double-tap conflict fix.
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
            this.container = video.parentElement;
            this.feedbackOverlay = null;
            this.eventShield = null; // NEW: The element that will capture all touches

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

            this.createOverlays();
            this.bindEvents();
        }

        createOverlays() {
            // --- NEW: Event Shield ---
            // This invisible shield sits on top of the video to intercept all touch events.
            const shield = document.createElement('div');
            Object.assign(shield.style, {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                zIndex: '99998' // Just below the feedback overlay
            });
            this.eventShield = shield;

            // Feedback Overlay (the black box with text)
            const feedback = document.createElement('div');
            Object.assign(feedback.style, {
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
            this.feedbackOverlay = feedback;

            // Ensure the container can hold absolutely positioned elements
            if (getComputedStyle(this.container).position === 'static') {
                this.container.style.position = 'relative';
            }
            this.container.appendChild(this.eventShield);
            this.container.appendChild(this.feedbackOverlay);
        }

        bindEvents() {
            this.handleTouchStart = this.handleTouchStart.bind(this);
            this.handleTouchMove = this.handleTouchMove.bind(this);
            this.handleTouchEnd = this.handleTouchEnd.bind(this);
            this.handleRateChange = this.handleRateChange.bind(this);

            // --- IMPORTANT: All touch events are now bound to the shield ---
            this.eventShield.addEventListener('touchstart', this.handleTouchStart, { passive: false });
            this.eventShield.addEventListener('touchmove', this.handleTouchMove, { passive: false });
            this.eventShield.addEventListener('touchend', this.handleTouchEnd, { passive: false });
            
            // These can remain on the video element itself
            this.video.addEventListener('ratechange', this.handleRateChange);
            this.eventShield.addEventListener('contextmenu', e => e.preventDefault());
        }

        handleTouchStart(e) {
            if (e.touches.length > 1) return;

            this.isGestureActive = true;
            this.gestureType = null;
            this.startX = e.touches[0].clientX;
            this.startY = e.touches[0].clientY;
            this.initialTime = this.video.currentTime;
            this.initialVolume = this.video.volume;

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
            if (!this.isGestureActive || this.gestureType === 'long-press' || !document.fullscreenElement) return;

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
                const volumeChange = -deltaY / 200;
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

            if (this.gestureType === null && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
                const now = Date.now();
                if (now - this.lastTapTime < 300) {
                    this.handleDoubleClick();
                    this.lastTapTime = 0;
                } else {
                    this.lastTapTime = now;
                }
            } else if (document.fullscreenElement) {
                if (this.gestureType === 'long-press') {
                    e.preventDefault();
                    this.video.playbackRate = this.userPlaybackRate;
                } else if (this.gestureType === 'horizontal-swipe') {
                    const timeChange = deltaX * 0.05;
                    this.video.currentTime = Math.max(0, Math.min(this.initialTime + timeChange, this.video.duration));
                }
            }

            this.hideOverlay();
            this.isGestureActive = false;
        }

        handleDoubleClick() {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.error(err));
            } else {
                // Use the container for a more stable fullscreen experience
                this.container.requestFullscreen().catch(err => console.error(err));
            }
        }
        
        handleRateChange() {
            if (this.gestureType !== 'long-press') {
                this.userPlaybackRate = this.video.playbackRate;
            }
        }

        showOverlay(htmlContent) {
            this.feedbackOverlay.innerHTML = `<div>${htmlContent}</div>`;
            this.feedbackOverlay.style.display = 'block';
        }

        hideOverlay() {
            this.feedbackOverlay.style.display = 'none';
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
            this.eventShield.removeEventListener('touchstart', this.handleTouchStart);
            this.eventShield.removeEventListener('touchmove', this.handleTouchMove);
            this.eventShield.removeEventListener('touchend', this.handleTouchEnd);
            this.video.removeEventListener('ratechange', this.handleRateChange);
            if (this.feedbackOverlay) this.feedbackOverlay.remove();
            if (this.eventShield) this.eventShield.remove();
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
        if (!videoControllers.has(video) && video.parentElement) {
            const controller = new GestureController(video);
            videoControllers.set(video, controller);
        }
    }

    const observer = new MutationObserver(scanForVideos);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', scanForVideos);

})();
