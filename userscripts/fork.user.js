// ==UserScript==
// @name         Mobile Video Gesture Control (Definitive Final Version)
// @namespace    http://tampermonkey.net/
// @version      11.0.0
// @description  Final version built on a proven architecture. Uses a temporary event shield to eliminate all conflicts while preserving all player functions.
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

            this.userPlaybackRate = video.playbackRate;

            // Gesture state
            this.startX = 0;
            this.startY = 0;
            this.initialTime = 0;
            this.gestureType = null;
            this.longPressTimeout = null;
            this.touchStartTime = 0;

            if (!this.container) return;

            this.createFeedbackOverlay();
            this.bindEvents();
        }

        createFeedbackOverlay() {
            const feedback = document.createElement('div');
            Object.assign(feedback.style, {
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                padding: '10px 20px',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                color: '#fff',
                fontSize: '18px',
                textAlign: 'center',
                borderRadius: '8px',
                zIndex: '2147483647',
                display: 'none',
                lineHeight: '1.5',
                pointerEvents: 'none'
            });
            this.feedbackOverlay = feedback;
            if (getComputedStyle(this.container).position === 'static') {
                this.container.style.position = 'relative';
            }
            this.container.appendChild(this.feedbackOverlay);
        }

        bindEvents() {
            this.handleTouchStart = this.handleTouchStart.bind(this);
            this.video.addEventListener('touchstart', this.handleTouchStart, { passive: false });
            this.video.addEventListener('ratechange', () => {
                if (this.gestureType !== 'long-press') {
                    this.userPlaybackRate = this.video.playbackRate;
                }
            });
        }

        handleTouchStart(e) {
            if (e.touches.length > 1 || document.querySelector('.gesture-shield-v11')) return;
            e.preventDefault();

            this.gestureType = null;
            this.startX = e.touches[0].clientX;
            this.startY = e.touches[0].clientY;
            this.initialTime = this.video.currentTime;
            this.touchStartTime = Date.now();

            // 1. Create the temporary shield
            const shield = document.createElement('div');
            shield.className = 'gesture-shield-v11';
            shield.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483646;';
            document.body.appendChild(shield);

            // 2. Define and bind event handlers for the shield
            const handleTouchMove = (moveEvent) => {
                if (this.gestureType === 'long-press') return;
                const deltaX = moveEvent.touches[0].clientX - this.startX;
                const deltaY = moveEvent.touches[0].clientY - this.startY;

                if (Math.abs(deltaX) > 15 || Math.abs(deltaY) > 15) {
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
            };

            const cleanupAndRemoveShield = () => {
                shield.removeEventListener('touchmove', handleTouchMove);
                shield.removeEventListener('touchend', handleTouchEnd);
                shield.removeEventListener('touchcancel', cleanupAndRemoveShield);
                shield.remove();
            };

            const handleTouchEnd = (endEvent) => {
                clearTimeout(this.longPressTimeout);

                const deltaX = endEvent.changedTouches[0].clientX - this.startX;
                const touchDuration = Date.now() - this.touchStartTime;

                if (this.gestureType === 'vertical-swipe') {
                    if (document.fullscreenElement) {
                        document.exitFullscreen().catch(err => console.error(err));
                    } else {
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

                if (!this.gestureType) {
                    this.video.click(); // It was a simple tap, forward it.
                }
                
                if (!this.feedbackOverlay.innerHTML.includes('s')) {
                    this.hideOverlay();
                }

                // 3. Destroy the shield
                cleanupAndRemoveShield();
            };

            shield.addEventListener('touchmove', handleTouchMove, { passive: false });
            shield.addEventListener('touchend', handleTouchEnd, { passive: false });
            shield.addEventListener('touchcancel', cleanupAndRemoveShield, { passive: false }); // Safety net
            shield.addEventListener('contextmenu', evt => evt.preventDefault());

            if (document.fullscreenElement) {
                this.longPressTimeout = setTimeout(() => {
                    if (!this.gestureType) {
                        this.gestureType = 'long-press';
                        this.video.playbackRate = 2.0;
                        this.showOverlay('2x Speed');
                    }
                }, 500);
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
