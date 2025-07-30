// ==UserScript==
// @name         Mobile Video Gesture Control (Event Shield)
// @namespace    http://tampermonkey.net/
// @version      6.0.0
// @description  Definitive Edition: Uses an event shield to eliminate all gesture conflicts and guarantee UI visibility in fullscreen.
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
            this.eventShield = null; // The element that will capture all touches

            this.userPlaybackRate = video.playbackRate;

            // Gesture state
            this.startX = 0;
            this.startY = 0;
            this.initialTime = 0;
            this.isGestureActive = false;
            this.gestureType = null;
            this.longPressTimeout = null;
            this.touchStartTime = 0;

            // A check to ensure we have a valid container to work with.
            if (!this.container) {
                console.error("Video Gesture Script: Video element has no parent container.", video);
                return;
            }

            this.createOverlays();
            this.bindEvents();
        }

        createOverlays() {
            // Ensure the container can hold absolutely positioned children.
            // This is critical for the shield and overlay to be positioned correctly.
            if (getComputedStyle(this.container).position === 'static') {
                this.container.style.position = 'relative';
            }

            // --- The Event Shield ---
            const shield = document.createElement('div');
            Object.assign(shield.style, {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                zIndex: '99998', // High enough to be on top of the video.
                userSelect: 'none', // Prevents text selection during gestures.
                '-webkit-touch-callout': 'none' // Disables the callout menu on iOS.
            });
            this.eventShield = shield;

            // --- The Feedback Overlay ---
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
                zIndex: '99999', // Higher than the shield.
                display: 'none',
                lineHeight: '1.5',
                pointerEvents: 'none'
            });
            this.feedbackOverlay = feedback;

            this.container.appendChild(this.eventShield);
            this.container.appendChild(this.feedbackOverlay);
        }

        bindEvents() {
            this.handleTouchStart = this.handleTouchStart.bind(this);
            this.handleTouchMove = this.handleTouchMove.bind(this);
            this.handleTouchEnd = this.handleTouchEnd.bind(this);
            this.handleRateChange = this.handleRateChange.bind(this);

            // --- All touch events are now bound to the shield ---
            this.eventShield.addEventListener('touchstart', this.handleTouchStart, { passive: false });
            this.eventShield.addEventListener('touchmove', this.handleTouchMove, { passive: false });
            this.eventShield.addEventListener('touchend', this.handleTouchEnd, { passive: false });
            this.eventShield.addEventListener('contextmenu', e => e.preventDefault());

            this.video.addEventListener('ratechange', this.handleRateChange);
        }

        handleTouchStart(e) {
            if (e.touches.length > 1) return;
            e.preventDefault(); // Prevent default actions like scrolling the page.

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
            e.preventDefault();

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
            e.preventDefault();
            clearTimeout(this.longPressTimeout);

            const deltaX = e.changedTouches[0].clientX - this.startX;
            const touchDuration = Date.now() - this.touchStartTime;

            if (this.gestureType === 'vertical-swipe') {
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(err => console.error(err));
                } else {
                    // Request fullscreen on the container, not the video.
                    this.container.requestFullscreen().catch(err => console.error(err));
                }
            } else if (document.fullscreenElement) {
                if (this.gestureType === 'long-press') {
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

            if (!this.feedbackOverlay.innerHTML.includes('s')) {
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
            this.feedbackOverlay.innerHTML = `<div>${htmlContent}</div>`;
            this.feedbackOverlay.style.display = 'block';
            if (duration > 0) {
                setTimeout(() => this.hideOverlay(), duration);
            }
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
            this.eventShield.remove();
            this.feedbackOverlay.remove();
            // We no longer need to remove individual listeners from the shield
            // as the shield itself is destroyed.
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
