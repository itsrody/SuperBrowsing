// ==UserScript==
// @name         Mobile Video Gesture Control (Class-based)
// @namespace    http://tampermonkey.net/
// @version      5.0.2
// @description  A robust, class-based implementation for mobile video gestures: short swipe to skip, long swipe to seek, long-press for 2x speed. Stable, clean, and maintainable.
// @author       사용자 (re-architected by Gemini)
// @license      MIT
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    /**
     * A map to keep track of which video elements already have a controller.
     * WeakMap allows for garbage collection if the video element is removed from the DOM.
     */
    const videoControllers = new WeakMap();

    class GestureController {
        constructor(video) {
            this.video = video;
            this.overlay = null;
            this.userPlaybackRate = video.playbackRate;

            // Gesture state
            this.startX = 0;
            this.initialTime = 0;
            this.touchStartTime = 0;
            this.isGestureActive = false;
            this.gestureType = null;
            this.longPressTimeout = null;

            this.createOverlay();
            this.bindEvents();
        }

        /**
         * Creates the UI overlay for feedback.
         */
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
                pointerEvents: 'none' // Ensures the overlay doesn't block touch events
            });
            this.video.parentElement.appendChild(overlay);
            this.overlay = overlay;
        }

        /**
         * Binds all necessary event listeners to the video element.
         */
        bindEvents() {
            // Bind 'this' to ensure methods have the correct context when called by event listeners
            this.handleTouchStart = this.handleTouchStart.bind(this);
            this.handleTouchMove = this.handleTouchMove.bind(this);
            this.handleTouchEnd = this.handleTouchEnd.bind(this);
            this.handleRateChange = this.handleRateChange.bind(this);
            this.handleContextMenu = this.handleContextMenu.bind(this); // Bind the new context menu handler

            this.video.addEventListener('touchstart', this.handleTouchStart, { passive: false });
            this.video.addEventListener('touchmove', this.handleTouchMove, { passive: false });
            this.video.addEventListener('touchend', this.handleTouchEnd, { passive: false });
            this.video.addEventListener('ratechange', this.handleRateChange);
            
            // --- CONTEXT MENU FIX ---
            // We listen during the "capture" phase (the `true` at the end).
            // This lets our listener run before most others on the page, ensuring we can cancel the event first.
            this.video.addEventListener('contextmenu', this.handleContextMenu, true);
        }
        
        // New dedicated handler for the context menu
        handleContextMenu(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        handleTouchStart(e) {
            if (e.touches.length > 1) return;

            this.isGestureActive = true;
            this.gestureType = null;
            this.startX = e.touches[0].clientX;
            this.initialTime = this.video.currentTime;
            this.touchStartTime = Date.now();

            this.longPressTimeout = setTimeout(() => {
                if (this.isGestureActive && !this.gestureType) {
                    this.gestureType = 'long-press';
                    this.video.playbackRate = 2.0;
                    this.showOverlay('2x Speed');
                }
            }, 500);
        }

        handleTouchMove(e) {
            if (!this.isGestureActive || this.gestureType === 'long-press') return;

            const deltaX = e.touches[0].clientX - this.startX;

            if (Math.abs(deltaX) > 10) {
                clearTimeout(this.longPressTimeout); // It's a swipe, not a long-press.
                
                // Only show UI for a definitive long swipe
                if (Math.abs(deltaX) > 80) {
                    this.gestureType = 'long-swipe';
                    const timeChange = deltaX * 0.05;
                    const newTime = this.initialTime + timeChange;
                    const timeChangeFormatted = this.formatTimeChange(timeChange);
                    this.showOverlay(`${this.formatCurrentTime(newTime)}<br>(${timeChange >= 0 ? '+' : ''}${timeChangeFormatted})`);
                }
            }
        }

        handleTouchEnd(e) {
            if (!this.isGestureActive) return;
            clearTimeout(this.longPressTimeout);

            const touchDuration = Date.now() - this.touchStartTime;
            const deltaX = e.changedTouches[0].clientX - this.startX;

            // --- Final Gesture Decision Logic ---
            if (this.gestureType === 'long-press') {
                // The primary fix is now the 'contextmenu' listener, but this is a good fallback.
                e.preventDefault();
                this.video.playbackRate = this.userPlaybackRate;
                this.hideOverlay();
            } else if (Math.abs(deltaX) > 30) { // ADJUSTED: A swipe must now move at least 30px
                // A "flick" is a fast swipe over a short distance.
                if (touchDuration < 250 && Math.abs(deltaX) < 80) { // ADJUSTED: Flick distance is now less than 80px
                    const seekAmount = deltaX > 0 ? 5 : -5;
                    this.video.currentTime += seekAmount;
                    this.showOverlay(`${seekAmount > 0 ? '+' : ''}${seekAmount}s`, 600);
                } else { // A longer or slower swipe is a "drag"
                    const timeChange = deltaX * 0.05;
                    this.video.currentTime = Math.max(0, Math.min(this.initialTime + timeChange, this.video.duration));
                    this.hideOverlay();
                }
            } else {
                this.hideOverlay();
            }
            
            this.isGestureActive = false;
        }
        
        handleRateChange() {
            // Store user-initiated playback rate changes, but not our own.
            if (this.gestureType !== 'long-press') {
                this.userPlaybackRate = this.video.playbackRate;
            }
        }

        /**
         * Shows the overlay with specific content. Can hide automatically after a duration.
         */
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

        // --- Formatting Utilities ---
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

        /**
         * Cleans up all event listeners and elements.
         */
        destroy() {
            this.video.removeEventListener('touchstart', this.handleTouchStart, { passive: false });
            this.video.removeEventListener('touchmove', this.handleTouchMove, { passive: false });
            this.video.removeEventListener('touchend', this.handleTouchEnd, { passive: false });
            this.video.removeEventListener('ratechange', this.handleRateChange);
            // Make sure to remove the new listener with the same capture option.
            this.video.removeEventListener('contextmenu', this.handleContextMenu, true);
            this.overlay.remove();
        }
    }

    /**
     * Scans the DOM for new video elements and initializes controllers.
     */
    function scanForVideos() {
        // Find all videos, including those in Shadow DOMs
        const videos = document.querySelectorAll('video');
        const allElements = document.querySelectorAll('*');

        videos.forEach(initializeController);
        allElements.forEach(el => {
            if (el.shadowRoot) {
                el.shadowRoot.querySelectorAll('video').forEach(initializeController);
            }
        });
    }

    function initializeController(video) {
        // Only add a controller if one doesn't already exist
        if (!videoControllers.has(video)) {
            const controller = new GestureController(video);
            videoControllers.set(video, controller);
        }
    }

    // --- Script Execution Start ---
    const observer = new MutationObserver(scanForVideos);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', scanForVideos);

})();
