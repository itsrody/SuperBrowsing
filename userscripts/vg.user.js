// ==UserScript==
// @name         Mobile Video Gestures
// @namespace    http://tampermonkey.net/
// @version      3.5.7
// @description  Advanced video gestures for Android Firefox with Liquid Glass UI
// @icon         data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👆</text></svg>
// @author       Antigravity
// @match        *://*/*
// @exclude      *youtube.com*
// @exclude      *netflix.com*
// @exclude      *dailymotion.com*
// @exclude      *hulu.com*
// @exclude      *disneyplus.com*
// @exclude      *hbomax.com*
// @exclude      *osn.com*
// @exclude      *primevideo.com*
// @exclude      *twitch.tv*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    // Version constant for logging
    const VERSION = '3.5.7';

    // =========================================================================
    // TRUSTED TYPES & PERFORMANCE HACKS
    // =========================================================================
    // 1. Trusted Types Support (for strict CSP environments)
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        try {
            window.trustedTypes.createPolicy('default', {
                createHTML: string => string,
                createScript: string => string,
                createScriptURL: string => string
            });
        } catch (e) {
            console.warn("[VG] Trusted Types policy creation failed:", e);
        }
    }

    // 2. Performance & Anti-Fingerprinting Hacks
    // Hide our overrides from basic detection
    const NATIVE_TOSTRING = Function.prototype.toString;
    const FAKE_methods = ['toString', 'attachShadow', 'drawImage'];
    Function.prototype.toString = function toString() {
        if (FAKE_methods.includes(this.name)) {
            return `function ${this.name}() { [native code] }`;
        }
        return NATIVE_TOSTRING.call(this);
    };

    // 3. Shadow DOM Interception (Aggressive Video Detection)
    const NATIVE_ATTACH_SHADOW = Element.prototype.attachShadow;
    const shadowRoots = [];
    Element.prototype.attachShadow = function attachShadow(...args) {
        const shadowRoot = NATIVE_ATTACH_SHADOW.apply(this, args);
        shadowRoots.push(shadowRoot);
        // Immediately observe the new shadow root for videos
        // Safe check to avoid Temporal Dead Zone if VideoScanner is not yet defined
        if (typeof VideoScanner !== 'undefined' && VideoScanner.observer) {
            VideoScanner.observer.observe(shadowRoot, { childList: true, subtree: true });
            // Also scan immediately
            setTimeout(() => VideoScanner.scanRoot(shadowRoot), 0);
        }
        return shadowRoot;
    };

    // 4. Canvas Video Detection (for obscured/canvas-rendered players)
    const NATIVE_DRAW_IMAGE = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function drawImage(...args) {
        const element = args[0];
        if (element && element.tagName === 'VIDEO' && !element.dataset.vgCanvasChecked) {
            element.dataset.vgCanvasChecked = "true";
            // If the video is being drawn to canvas but is hidden/detached, we can still try to attach gestures 
            // to the canvas or the video itself if it's just 'display:none'
            if (!document.contains(element)) {
                // Heuristic: If video is detached but drawn, it might be a memory-only video source.
                // We can't attach gestures to a detached element easily without a container.
                // But `mobileGE` suggests appending it to DOM if missing? 
                // "ele.style.display = 'none'; this.canvas.insertAdjacentElement('afterend', ele);"
                // This seems risky for existing layouts. 
                // For now, we just ensure it's registered in our scanner if it exists in DOM.
            }
            if (VideoScanner) VideoScanner.processVideo(element);
        }
        return NATIVE_DRAW_IMAGE.apply(this, args);
    };

    // =========================================================================
    // CONFIGURATION
    // =========================================================================
    const Config = {
        seekStep: GM_getValue('seekStep', 5),
        edgeWidth: GM_getValue('edgeWidth', 20),
        longPressSpeed: GM_getValue('longPressSpeed', 2.0),
        minVideoDuration: GM_getValue('minVideoDuration', 60),
        volumeSensitivity: 0.5,
        brightnessSensitivity: 0.5,
        swipeSeekSensitivity: 90, // seconds per full screen width
        isDebug: true,
        allowDesktop: false,

        save: function () {
            GM_setValue('seekStep', this.seekStep);
            GM_setValue('edgeWidth', this.edgeWidth);
            GM_setValue('longPressSpeed', this.longPressSpeed);
            GM_setValue('minVideoDuration', this.minVideoDuration);
        }
    };

    // =========================================================================
    // GESTURE TIMING CONSTANTS (extracted magic numbers)
    // =========================================================================
    const TIMING = {
        LONG_PRESS_MS: 400,           // Time to trigger long press
        SWIPE_THRESHOLD_PX: 18,       // Pixels to move before swipe starts
        DIRECTION_RATIO: 1.5,         // How much more movement needed in primary direction
        SPEED_LOCK_SWIPE_PX: 80,      // Pixels to swipe up to lock speed
        EXIT_FULLSCREEN_SWIPE_PX: 100, // Pixels to swipe down to exit fullscreen
        DOUBLE_TAP_MS: 300,           // Max time between taps for double-tap
        PINCH_THRESHOLD_PX: 50,       // Minimum pinch distance to trigger
        TOAST_DURATION_MS: 600,       // Toast display duration
        INDICATOR_FADE_MS: 150,       // Fade out duration
        HAPTIC_SHORT_MS: 20,          // Short vibration
        HAPTIC_LONG_MS: 30            // Long vibration
    };

    // =========================================================================
    // LOGGER
    // =========================================================================
    const Log = {
        info: (msg, ...args) => Config.isDebug && console.log(`[VG] ${msg}`, ...args),
        warn: (msg, ...args) => console.warn(`[VG] ${msg}`, ...args),
        error: (msg, ...args) => console.error(`[VG] ${msg}`, ...args)
    };

    // =========================================================================
    // UTILITIES
    // =========================================================================
    const Utils = {
        isMobile: function () {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        },

        throttle: function (fn, delay) {
            let lastCall = 0;
            let timeout = null;
            return function (...args) {
                const now = Date.now();
                if (now - lastCall >= delay) {
                    lastCall = now;
                    fn.apply(this, args);
                } else if (!timeout) {
                    timeout = setTimeout(() => {
                        lastCall = Date.now();
                        timeout = null;
                        fn.apply(this, args);
                    }, delay - (now - lastCall));
                }
            };
        },

        debounce: function (fn, delay) {
            let timeout = null;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => fn.apply(this, args), delay);
            };
        },

        safeCall: function (fn, context) {
            return function (...args) {
                try {
                    return fn.apply(context || this, args);
                } catch (e) {
                    Log.error("Error in gesture handler:", e);
                }
            };
        },

        formatTime: function (seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        },

        clamp: function (value, min, max) {
            return Math.max(min, Math.min(max, value));
        },

        // Orientation detection
        isLandscape: function () {
            return window.innerWidth > window.innerHeight;
        },

        getOrientation: function () {
            return this.isLandscape() ? 'landscape' : 'portrait';
        },

        // Safe area insets (for notch/gesture bar)
        // Note: These are read from CSS custom properties set by our stylesheet
        getSafeAreas: function () {
            try {
                const style = getComputedStyle(document.documentElement);
                return {
                    top: parseInt(style.getPropertyValue('--sat')) || 0,
                    right: parseInt(style.getPropertyValue('--sar')) || 0,
                    bottom: parseInt(style.getPropertyValue('--sab')) || 0,
                    left: parseInt(style.getPropertyValue('--sal')) || 0
                };
            } catch (e) {
                return { top: 0, right: 0, bottom: 0, left: 0 };
            }
        }
    };

    // =========================================================================
    // TAMPERMONKEY MENU
    // =========================================================================
    function registerMenuCommands() {
        GM_registerMenuCommand(`⏱️ Seek Step (${Config.seekStep}s)`, () => {
            const input = prompt("Enter seek time in seconds:", Config.seekStep);
            if (input && !isNaN(input)) {
                Config.seekStep = parseInt(input, 10);
                Config.save();
            }
        });

        GM_registerMenuCommand(`📐 Edge Width (${Config.edgeWidth}%)`, () => {
            const input = prompt("Enter edge width percentage (10-40):", Config.edgeWidth);
            if (input && !isNaN(input)) {
                let val = parseInt(input, 10);
                Config.edgeWidth = Utils.clamp(val, 10, 40);
                Config.save();
            }
        });

        GM_registerMenuCommand(`🚀 Speed Multiplier (${Config.longPressSpeed}x)`, () => {
            const input = prompt("Enter speed multiplier (1.5-4.0):", Config.longPressSpeed);
            if (input && !isNaN(input)) {
                Config.longPressSpeed = Utils.clamp(parseFloat(input), 1.5, 4.0);
                Config.save();
            }
        });

        GM_registerMenuCommand(`⏳ Min Duration (${Config.minVideoDuration}s)`, () => {
            const input = prompt("Minimum video duration to enable gestures (seconds):", Config.minVideoDuration);
            if (input && !isNaN(input)) {
                Config.minVideoDuration = Math.max(0, parseInt(input, 10));
                Config.save();
            }
        });
    }

    // =========================================================================
    // LIQUID UI (Visual Feedback)
    // =========================================================================
    const LiquidUI = {
        style: `
            .vg-overlay-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 2147483647;
                display: flex;
                justify-content: center;
                align-items: center;
                overflow: hidden;
                will-change: transform;
                transform: translateZ(0);
                --vg-bg-opacity: 0.45;
                --vg-blur: 20px;
            }

            /* Dark Mode Variant - for light video content */
            .vg-overlay-container.light-content {
                --vg-bg-opacity: 0.65;
                --vg-blur: 16px;
            }

            /* Compact Icon Box - top notification pill style */
            .vg-icon-box {
                position: absolute;
                top: 6%;
                left: 50%;
                transform: translateX(-50%) translateY(-8px);
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border-radius: 20px;
                padding: 8px 14px;
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 6px;
                opacity: 0;
                transition: opacity 0.15s, transform 0.15s;
            }
            .vg-icon-box.visible {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            .vg-icon-box .vg-icon svg {
                width: 18px;
                height: 18px;
                fill: white;
            }
            .vg-icon-box .vg-text {
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 14px;
                font-weight: 600;
                margin: 0;
            }

            /* Seek indicator positioned on edges */
            .vg-seek-indicator {
                position: absolute;
                top: 50%;
                transform: translateY(-50%) scale(0.9);
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border-radius: 50%;
                padding: 16px;
                opacity: 0;
                transition: opacity 0.12s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .vg-seek-indicator.left { left: 15%; }
            .vg-seek-indicator.right { right: 15%; }
            .vg-seek-indicator.visible {
                opacity: 1;
                transform: translateY(-50%) scale(1);
            }
            .vg-seek-indicator svg {
                width: 32px;
                height: 32px;
                fill: white;
            }
            .vg-seek-indicator .vg-seek-text {
                position: absolute;
                bottom: -24px;
                left: 50%;
                transform: translateX(-50%);
                color: white;
                font-size: 13px;
                font-weight: 600;
                font-family: -apple-system, sans-serif;
                white-space: nowrap;
            }

            /* Toast - compact top notification */
            .vg-toast {
                position: absolute;
                top: 6%;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 600;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                opacity: 0;
                transform: translateY(-8px);
                transition: opacity 0.15s, transform 0.15s;
            }
            .vg-toast.visible {
                opacity: 1;
                transform: translateY(0);
            }

            /* Progress Bar for Volume/Brightness */
            .vg-progress-container {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                padding: 12px;
                background: rgba(0, 0, 0, 0.45);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border-radius: 24px;
                opacity: 0;
                transition: opacity 0.15s;
            }
            .vg-progress-container.left { left: 4%; }
            .vg-progress-container.right { right: 4%; }
            .vg-progress-container.visible { opacity: 1; }
            .vg-progress-bar {
                width: 5px;
                height: 100px;
                background: rgba(255, 255, 255, 0.25);
                border-radius: 3px;
                overflow: hidden;
                position: relative;
            }
            .vg-progress-fill {
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                background: white;
                border-radius: 3px;
                transition: height 0.1s ease-out;
            }
            .vg-progress-icon svg {
                width: 24px;
                height: 24px;
                fill: white;
            }
            .vg-percent-text {
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 12px;
                font-weight: 600;
                margin-top: 4px;
            }

            /* Speed Indicator - persistent at top during long press */
            .vg-speed-indicator {
                position: absolute;
                top: 6%;
                left: 50%;
                transform: translateX(-50%) translateY(-8px);
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border-radius: 20px;
                padding: 8px 16px;
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 6px;
                opacity: 0;
                transition: opacity 0.15s, transform 0.15s;
            }
            .vg-speed-indicator.visible {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            .vg-speed-indicator svg {
                width: 18px;
                height: 18px;
                fill: white;
            }
            .vg-speed-indicator .vg-speed-text {
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 14px;
                font-weight: 600;
            }
        `,

        icons: {
            play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
            pause: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
            forward: '<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',
            rewind: '<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>',
            fullscreen: '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
            exitFullscreen: '<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',
            speed: '<svg viewBox="0 0 24 24"><path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"/></svg>',
            aspect: '<svg viewBox="0 0 24 24"><path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/></svg>',
            volumeHigh: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
            volumeMute: '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
            brightness: '<svg viewBox="0 0 24 24"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/></svg>',
            lock: '<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>',
            unlock: '<svg viewBox="0 0 24 24"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/></svg>'
        },

        init: function () {
            GM_addStyle(this.style);
            Log.info("LiquidUI initialized");
        },

        createOverlay: function (videoElement) {
            if (!videoElement.parentElement) {
                Log.warn("Video has no parent element");
                return null;
            }
            let container = videoElement.parentElement.querySelector('.vg-overlay-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'vg-overlay-container';
                videoElement.parentElement.appendChild(container);
                const parentStyle = window.getComputedStyle(videoElement.parentElement);
                if (parentStyle.position === 'static') {
                    videoElement.parentElement.style.position = 'relative';
                }
            }
            return container;
        },

        showIcon: function (container, iconName, text, options = {}) {
            if (!container) return;
            const existing = container.querySelector('.vg-icon-box');
            if (existing) existing.remove();

            const box = document.createElement('div');
            // All icons use the same compact style (top notification)
            box.className = 'vg-icon-box';

            const iconDiv = document.createElement('div');
            iconDiv.className = 'vg-icon';
            iconDiv.innerHTML = this.icons[iconName] || '';
            box.appendChild(iconDiv);

            // Add text label for play/pause
            const textDiv = document.createElement('div');
            textDiv.className = 'vg-text';
            if (iconName === 'play') {
                textDiv.innerText = text || 'Play';
            } else if (iconName === 'pause') {
                textDiv.innerText = text || 'Pause';
            } else if (text) {
                textDiv.innerText = text;
            }
            if (textDiv.innerText) {
                box.appendChild(textDiv);
            }

            container.appendChild(box);

            // Force reflow for animation
            void box.offsetWidth;
            box.classList.add('visible');

            const duration = options.duration || 600;
            setTimeout(() => {
                box.classList.remove('visible');
                setTimeout(() => box.remove(), 150);
            }, duration);
        },

        // Edge-positioned seek indicator (for double-tap seek)
        showSeekIndicator: function (container, direction, text) {
            if (!container) return;
            const className = `vg-seek-indicator ${direction}`;
            let indicator = container.querySelector(`.vg-seek-indicator.${direction}`);

            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = className;

                const icon = direction === 'left' ? this.icons.rewind : this.icons.forward;
                indicator.innerHTML = icon;

                const textEl = document.createElement('div');
                textEl.className = 'vg-seek-text';
                indicator.appendChild(textEl);

                container.appendChild(indicator);
            }

            indicator.querySelector('.vg-seek-text').innerText = text;

            // Force reflow
            void indicator.offsetWidth;
            indicator.classList.add('visible');

            clearTimeout(indicator._hideTimeout);
            indicator._hideTimeout = setTimeout(() => {
                indicator.classList.remove('visible');
            }, 600);
        },

        showToast: function (container, text) {
            if (!container) return;
            let toast = container.querySelector('.vg-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.className = 'vg-toast';
                container.appendChild(toast);
            }
            toast.innerText = text;
            toast.classList.add('visible');

            clearTimeout(toast._hideTimeout);
            toast._hideTimeout = setTimeout(() => {
                toast.classList.remove('visible');
            }, 1200);
        },

        showProgress: function (container, type, value, side) {
            if (!container) return;
            const className = `vg-progress-${type}`;
            let progressContainer = container.querySelector(`.${className}`);

            if (!progressContainer) {
                progressContainer = document.createElement('div');
                progressContainer.className = `vg-progress-container ${className} ${side}`;

                const iconDiv = document.createElement('div');
                iconDiv.className = 'vg-progress-icon';
                iconDiv.innerHTML = type === 'volume' ? this.icons.volumeHigh : this.icons.brightness;

                const barContainer = document.createElement('div');
                barContainer.className = 'vg-progress-bar';

                const fill = document.createElement('div');
                fill.className = 'vg-progress-fill';
                barContainer.appendChild(fill);

                progressContainer.appendChild(iconDiv);
                progressContainer.appendChild(barContainer);
                container.appendChild(progressContainer);
            }

            const fill = progressContainer.querySelector('.vg-progress-fill');
            const percentage = Utils.clamp(value * 100, 0, 100);
            fill.style.height = `${percentage}%`;

            const iconDiv = progressContainer.querySelector('.vg-progress-icon');
            if (type === 'volume') {
                iconDiv.innerHTML = value === 0 ? this.icons.volumeMute : this.icons.volumeHigh;
            }

            // Update or create percentage text
            let percentText = progressContainer.querySelector('.vg-percent-text');
            if (!percentText) {
                percentText = document.createElement('div');
                percentText.className = 'vg-percent-text';
                progressContainer.appendChild(percentText);
            }
            percentText.innerText = `${Math.round(percentage)}%`;

            progressContainer.classList.add('visible');

            clearTimeout(progressContainer._hideTimeout);
            progressContainer._hideTimeout = setTimeout(() => {
                progressContainer.classList.remove('visible');
            }, 1500);
        },

        // Persistent speed indicator (shows until manually hidden)
        showSpeedIndicator: function (container, speed) {
            if (!container) return;
            let indicator = container.querySelector('.vg-speed-indicator');

            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'vg-speed-indicator';

                // Forward icon (represents fast forward)
                indicator.innerHTML = this.icons.forward;

                const textEl = document.createElement('span');
                textEl.className = 'vg-speed-text';
                indicator.appendChild(textEl);

                container.appendChild(indicator);
            }

            indicator.querySelector('.vg-speed-text').innerText = `${speed}x`;

            // Force reflow
            void indicator.offsetWidth;
            indicator.classList.add('visible');
        },

        hideSpeedIndicator: function (container) {
            if (!container) return;
            const indicator = container.querySelector('.vg-speed-indicator');
            if (indicator) {
                indicator.classList.remove('visible');
            }
        }
    };

    // =========================================================================
    // GESTURE STATE (Per-Video using WeakMap)
    // =========================================================================
    const videoStates = new WeakMap();

    function getVideoState(video) {
        if (!videoStates.has(video)) {
            videoStates.set(video, {
                // Position tracking
                startX: 0,
                startY: 0,
                lastX: 0,
                lastY: 0,

                // Timing
                startTime: 0,
                lastMoveTime: 0,
                lastTapTime: 0,

                // Velocity tracking (pixels per ms)
                velocityX: 0,
                velocityY: 0,

                // Gesture state
                tapCount: 0,
                isSwiping: false,
                swipeDirection: null,  // 'horizontal' or 'vertical' - locked after threshold
                isMultiTouch: false,
                touchCount: 0,
                isLongPressing: false,

                // Timers
                longPressTimer: null,
                tapTimer: null,

                // Pinch
                initialPinchDist: 0,
                lastPinchDist: 0,

                // References
                overlay: null,
                video: null,
                lastEvent: null,

                // Values
                playbackRateBefore: 1.0,
                seekStartTime: null,
                volumeStartValue: 1,
                brightnessStartValue: 1,

                // Flags
                isLocked: false,
                gestureHandled: false,

                // Sticky Speed Mode
                isSpeedLocked: false,
                lockedSpeed: 1.0,

                // Cached dimensions (performance)
                cachedWidth: 0,
                cachedHeight: 0,

                // Visibility tracking
                isVisible: true,

                // Cleanup
                abortController: new AbortController()
            });
        }
        return videoStates.get(video);
    }

    // Fullscreen state cache - initialize with actual state
    let isFullscreenCached = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);

    function updateFullscreenCache() {
        isFullscreenCached = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);

        // MobileGE inspired: Request orientation lock when entering fullscreen
        if (isFullscreenCached && Utils.isMobile()) {
            // Try local lock first
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(() => {
                    // If local lock fails (e.g. inside iframe), request top to lock
                    if (window.top !== window.self) {
                        window.top.postMessage({ type: 'VG_ORIENTATION_LOCK' }, '*');
                    }
                });
            }
        }
    }

    document.addEventListener('fullscreenchange', updateFullscreenCache);
    document.addEventListener('webkitfullscreenchange', updateFullscreenCache);
    document.addEventListener('mozfullscreenchange', updateFullscreenCache);

    // =========================================================================
    // GESTURE CONTROLLER
    // =========================================================================
    const GestureController = {
        attach: function (video) {
            if (video.dataset.vgAttached) return;
            video.dataset.vgAttached = "true";
            Log.info("Attaching gestures to:", video.src || video.currentSrc || "blob/stream");

            const overlay = LiquidUI.createOverlay(video);
            if (!overlay) {
                Log.warn("Could not create overlay, skipping");
                return;
            }

            const state = getVideoState(video);
            state.overlay = overlay;
            state.video = video;

            // IMPORTANT: Attach to VIDEO element directly, not container
            // This prevents breaking player controls
            let target = video;

            // CHECK: pointer-events: none support (Click-Through Support)
            // Some custom players put an overlay on top of the video and set the video to pointer-events: none.
            // In this case, we need to listen on the parent (the container) to capture gestures.
            try {
                const computed = window.getComputedStyle(video);
                if (computed.pointerEvents === 'none') {
                    Log.info("Video has pointer-events: none, attaching to parent container");
                    target = video.parentElement || video.parentNode || video;
                    // Mark the state so we know we are in this mode
                    state.attachTarget = target;
                }
            } catch (e) {
                Log.warn("Could not check pointer-events", e);
            }

            const signal = state.abortController.signal;

            // Use bubble phase (capture: false) to let controls handle first
            const opts = { passive: false, capture: false, signal };

            const self = this;
            target.addEventListener('touchstart', Utils.safeCall(function (e) {
                self.onTouchStart(e, video);
            }), opts);
            target.addEventListener('touchmove', Utils.safeCall(function (e) {
                self.onTouchMove(e, video);
            }), opts);
            target.addEventListener('touchend', Utils.safeCall(function (e) {
                self.onTouchEnd(e, video);
            }), opts);
            target.addEventListener('touchcancel', Utils.safeCall(function (e) {
                self.onTouchEnd(e, video);
            }), opts);

            // Block context menu in fullscreen or during gestures
            target.addEventListener('contextmenu', function (e) {
                const s = getVideoState(video);
                const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);

                // Block context menu if:
                // 1. Long pressing (speed gesture active)
                // 2. In fullscreen mode (we handle all gestures there)
                // 3. Any active gesture is happening
                if (s.isLongPressing || isFs || s.isSwiping || s.touchCount > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, { capture: true, signal });

            // Cleanup observer is now handled centrally by VideoScanner
            // to avoid creating thousands of observers for infinite scroll pages

            Log.info("Gestures attached successfully");
        },

        findPlayerContainer: function (video) {
            // Intelligent Video Box Detection (inspired by MobileGE)
            // Strategy: Climb up while the parent is roughly the same size as the video (visual wrapper)

            let current = video;
            const videoArea = video.clientWidth * video.clientHeight;
            if (videoArea === 0) return video.parentElement || video; // Not visible yet

            let container = video.parentElement;
            let bestContainer = container;

            // Limit depth to avoid infinite loops
            for (let i = 0; i < 8 && container && container !== document.body; i++) {
                const parentArea = container.clientWidth * container.clientHeight;

                // If parent is 0 size, skip (layout issue or hidden)
                if (parentArea === 0) {
                    container = container.parentElement;
                    continue;
                }

                // Ratio check: is parent area less than 1.5x video area?
                // MobileGE uses strict 1.1x, we can be a bit looser (1.5x) to catch controls
                // Also check if it looks like a player via class names
                const isRoughlySameSize = parentArea <= videoArea * 1.5;
                const matchesClass = /player|wrapper|container|video|content|fluid/i.test(container.className || '');

                if (isRoughlySameSize || matchesClass) {
                    bestContainer = container;
                } else {
                    // Parent is significantly larger, likely the structural layout (column, article, etc.)
                    // Stop climbing unless we explicitly found a 'player' class earlier that we prefer
                    // But actually, usually the largest "tight" wrapper is the player.
                    break;
                }
                container = container.parentElement;
            }
            return bestContainer || video.parentElement || video;
        },

        // Removed observeRemoval - handled by VideoScanner now

        isInteractive: function (element) {
            if (!element || !element.tagName) return false;

            const tag = element.tagName.toLowerCase();

            // Allow gestures on video element itself
            if (tag === 'video') return false;

            // Known interactive elements
            if (['button', 'input', 'a', 'select', 'textarea', 'label'].includes(tag)) return true;

            // Check if element has pointer cursor (strong signal of interactivity)
            try {
                const computed = window.getComputedStyle(element);
                if (computed.cursor === 'pointer') return true;
                if (computed.pointerEvents === 'none') {
                    // detailed check if this is an overlay passing through touches but has interactive children?
                    // actually if it's none, it won't receive events, so this check is redundant for target,
                    // but good for checking parents.
                }
            } catch (e) { }

            // Check common interactive data attributes
            if (element.hasAttribute('data-clickable') ||
                element.hasAttribute('data-controls') ||
                element.hasAttribute('data-action') ||
                element.hasAttribute('onclick')) return true;

            // SVG icons inside controls (expanded for more players)
            if (['svg', 'path', 'use', 'g', 'circle', 'rect'].includes(tag)) {
                // Check if inside any known player control
                if (element.closest?.('.jw-icon, .jw-button, .vjs-control, .plyr__control, .mejs__button, .fp-ui, .clappr-control, .bc-player-control, [class*="control"]')) return true;
            }

            const role = element.getAttribute?.('role');
            if (role === 'button' || role === 'slider' || role === 'progressbar' || role === 'menuitem') return true;

            // Check class names for control patterns (comprehensive list)
            const classes = (element.className || '').toString().toLowerCase();
            const controlPatterns = [
                // Generic patterns
                'control', 'btn', 'button', 'seek', 'volume', 'progress', 'slider', 'scrub', 'timeline', 'playback',
                'play-pause', 'mute', 'fullscreen', 'settings', 'caption', 'subtitle', 'quality', 'speed',
                // JW Player
                'jw-icon', 'jw-button', 'jw-slider', 'jw-rail', 'jw-knob', 'jw-overlay', 'jw-menu', 'jw-controlbar',
                // Video.js
                'vjs-control', 'vjs-button', 'vjs-slider', 'vjs-menu', 'vjs-progress', 'vjs-play', 'vjs-volume',
                // Plyr
                'plyr__control', 'plyr__progress', 'plyr__menu', 'plyr__volume',
                // MediaElement.js
                'mejs__button', 'mejs__time', 'mejs__volume', 'mejs__overlay', 'mejs__controls',
                // Flowplayer
                'fp-ui', 'fp-controls', 'fp-bar', 'fp-timeline', 'fp-volume', 'fp-menu', 'fp-play', 'fp-icon',
                // Clappr
                'clappr-control', 'media-control', 'bar-container', 'seek-bar', 'drawer-container',
                // Brightcove
                'bc-player', 'vjs-big-play', 'vjs-dock',
                // Shaka Player
                'shaka-controls', 'shaka-seek-bar', 'shaka-volume', 'shaka-overflow-menu',
                // THEOplayer
                'theo-', 'theoplayer', 'vjs-theo',
                // jPlayer
                'jp-controls', 'jp-progress', 'jp-volume', 'jp-play', 'jp-pause', 'jp-stop', 'jp-mute', 'jp-gui',
                // Kaltura
                'kaltura-player', 'playkit-', 'kp-', 'kaltura-',
                // Dash.js / hls.js (usually use video.js or custom)
                'dash-video-player', 'hls-video',
                // VdoCipher
                'vdo-', 'vdocipher',
                // Wistia
                'wistia_click', 'w-vulcan', 'wistia-player', 'w-control',
                // Cloudinary
                'cld-video-player', 'vjs-cloudinary',
                // Gumlet
                'gumlet-player',
                // AblePlayer (accessibility)
                'able-', 'ableplayer',
                // Afterglow
                'afterglow',
                // Projekktor
                'pp-controls', 'pp-', 'projekktor',
                // DPlayer
                'dplayer-', 'dplayer-controller',
                // ArtPlayer
                'art-', 'artplayer',
                // Fluid Player
                'fluid_video_wrapper', 'fluid-',
                // Radiant Media Player
                'rmp-', 'rmp-control',
                // Native HTML5
                'html5-video-player', 'html5-video-controls',
                // Generic / Custom / Homebrew patterns
                'player-', 'overlay-', 'clickable-', 'wrapper-', 'ui-', 'hud-', 'osd-'
            ];
            if (controlPatterns.some(p => classes.includes(p))) return true;

            // Check parent chain for common control wrappers (comprehensive)
            const controlSelector = [
                'button', 'a', '[role="button"]', '[role="slider"]',
                // JW Player
                '.jw-controls', '.jw-controlbar', '.jw-display', '.jw-icon-display',
                // Video.js
                '.vjs-control-bar', '.vjs-menu', '.vjs-modal-dialog',
                // Plyr
                '.plyr__controls', '.plyr__menu',
                // MediaElement.js
                '.mejs__controls', '.mejs__overlay', '.mejs__layer',
                // Flowplayer
                '.fp-controls', '.fp-ui', '.fp-header',
                // Clappr
                '.media-control', '.media-control-layer', '.player-poster',
                // Brightcove
                '.bc-player-default_default', '.vjs-dock-text',
                // Shaka
                '.shaka-controls-container', '.shaka-overflow-menu',
                // THEOplayer
                '.theoplayer-container', '.theo-primary-color',
                // jPlayer
                '.jp-gui', '.jp-controls', '.jp-interface',
                // Kaltura
                '.playkit-player', '.playkit-gui',
                // Wistia
                '.wistia_embed', '.w-vulcan-v2-button',
                // Cloudinary
                '.cld-video-player',
                // DPlayer
                '.dplayer-controller', '.dplayer-icons',
                // ArtPlayer
                '.art-controls', '.art-bottom',
                // Fluid Player
                '.fluid_controls_container',
                // Radiant Media Player
                '.rmp-control-bar',
                // Generic patterns
                '[class*="controls"]', '[class*="overlay"]', '[class*="controlbar"]', '[class*="toolbar"]'
            ].join(', ');
            if (element.closest?.(controlSelector)) return true;

            return false;
        },

        getZone: function (x, width) {
            const leftEdge = width * (Config.edgeWidth / 100);
            const rightEdge = width * (1 - (Config.edgeWidth / 100));
            if (x < leftEdge) return 'left';
            if (x > rightEdge) return 'right';
            return 'middle';
        },

        isFullscreen: function () {
            // Use cached value updated by fullscreenchange event for performance
            return isFullscreenCached;
        },

        isVideoFullscreen: function (video) {
            const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
            return fsElement && (fsElement === video || fsElement.contains?.(video));
        },

        // --- Touch Handlers ---

        onTouchStart: function (e, video) {
            const state = getVideoState(video);

            if (state.isLocked) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            if (this.isInteractive(e.target)) {
                return;
            }

            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const now = Date.now();

                // Initialize position tracking
                state.startX = touch.clientX;
                state.startY = touch.clientY;
                state.lastX = touch.clientX;
                state.lastY = touch.clientY;

                // Initialize timing
                state.startTime = now;
                state.lastMoveTime = now;

                // Reset velocity
                state.velocityX = 0;
                state.velocityY = 0;

                // Reset gesture state
                state.isSwiping = false;
                state.swipeDirection = null;
                state.isMultiTouch = false;
                state.touchCount = 1;
                state.isLongPressing = false;
                state.gestureHandled = false;
                state.seekStartTime = null;

                // Store initial values
                state.volumeStartValue = video.volume;
                state.brightnessStartValue = this.getBrightness(video);

                // Long press timer
                clearTimeout(state.longPressTimer);
                state.longPressTimer = setTimeout(() => {
                    // Only trigger if finger hasn't moved much
                    if (!state.isSwiping && !state.isMultiTouch) {
                        state.isLongPressing = true;
                        this.onLongPressStart(video, state);
                    }
                }, TIMING.LONG_PRESS_MS);
            } else if (e.touches.length === 2) {
                // Second finger detected - switch to pinch mode
                clearTimeout(state.longPressTimer);
                state.isMultiTouch = true;
                state.isSwiping = false;
                state.swipeDirection = null;
                state.touchCount = 2;

                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                state.initialPinchDist = Math.sqrt(dx * dx + dy * dy);
                state.lastPinchDist = state.initialPinchDist;
            }
        },

        onTouchMove: function (e, video) {
            const state = getVideoState(video);
            const now = Date.now();

            if (state.isLocked) return;

            // Update touch count
            state.touchCount = e.touches.length;

            // Check for transition to multi-touch
            if (e.touches.length >= 2) {
                state.isMultiTouch = true;
                state.isSwiping = false;
                state.swipeDirection = null;
                clearTimeout(state.longPressTimer);
            }

            if (e.touches.length === 1 && !state.isMultiTouch) {
                const touch = e.touches[0];
                const x = touch.clientX;
                const y = touch.clientY;
                const diffX = x - state.startX;
                const diffY = y - state.startY;
                const absDiffX = Math.abs(diffX);
                const absDiffY = Math.abs(diffY);

                // Calculate velocity (pixels per millisecond)
                const timeDelta = now - state.lastMoveTime;
                if (timeDelta > 0) {
                    state.velocityX = (x - state.lastX) / timeDelta;
                    state.velocityY = (y - state.lastY) / timeDelta;
                }
                state.lastX = x;
                state.lastY = y;
                state.lastMoveTime = now;

                // Determine swipe initiation with direction locking
                const swipeThreshold = TIMING.SWIPE_THRESHOLD_PX;
                const directionRatio = TIMING.DIRECTION_RATIO;

                if (!state.isSwiping) {
                    if (absDiffX > swipeThreshold || absDiffY > swipeThreshold) {
                        state.isSwiping = true;
                        clearTimeout(state.longPressTimer);

                        // Lock direction based on initial movement
                        if (absDiffX > absDiffY * directionRatio) {
                            state.swipeDirection = 'horizontal';
                        } else if (absDiffY > absDiffX * directionRatio) {
                            state.swipeDirection = 'vertical';
                        } else {
                            // Ambiguous - use velocity to decide
                            state.swipeDirection = Math.abs(state.velocityX) > Math.abs(state.velocityY)
                                ? 'horizontal' : 'vertical';
                        }
                    }
                }

                if (state.isSwiping) {
                    if (e.cancelable) e.preventDefault();
                    this.onSwipe(diffX, diffY, video, state);
                }
            } else if (e.touches.length === 2 && state.initialPinchDist > 0) {
                // Pinch gesture with improved tracking
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const currentDist = Math.sqrt(dx * dx + dy * dy);
                const diff = currentDist - state.lastPinchDist;

                // Use cumulative difference from last pinch point
                if (Math.abs(currentDist - state.initialPinchDist) > TIMING.PINCH_THRESHOLD_PX) {
                    this.handlePinch(video, currentDist > state.initialPinchDist, state);
                    state.initialPinchDist = currentDist;  // Reset baseline
                }
                state.lastPinchDist = currentDist;
            }
        },

        onTouchEnd: function (e, video) {
            const state = getVideoState(video);

            clearTimeout(state.longPressTimer);

            // Track remaining fingers
            const remainingTouches = e.touches?.length || 0;

            if (state.isLongPressing) {
                this.onLongPressEnd(video, state);
                state.isLongPressing = false;
                e.preventDefault();
                e.stopPropagation();
                this.resetGestureState(state);
                return;
            }

            if (state.initialPinchDist > 0 || state.isMultiTouch) {
                // Was a pinch/multi-touch gesture, cleanup
                if (remainingTouches === 0) {
                    this.resetGestureState(state);
                }
                return;
            }

            if (!state.isSwiping && !state.isMultiTouch && e.changedTouches?.length === 1) {
                this.handleTap(video, state, e.changedTouches[0].clientX, e);
            }

            if (remainingTouches === 0) {
                this.resetGestureState(state);
            }
        },

        resetGestureState: function (state) {
            state.isSwiping = false;
            state.swipeDirection = null;
            state.isMultiTouch = false;
            state.touchCount = 0;
            state.gestureHandled = false;
            state.seekStartTime = null;
            state.initialPinchDist = 0;
            state.lastPinchDist = 0;
            state.velocityX = 0;
            state.velocityY = 0;
        },

        // --- Gesture Actions ---

        onLongPressStart: function (video, state) {
            // Check if speed is already locked
            if (state.isSpeedLocked) {
                Log.info("Speed locked at", state.lockedSpeed + "x, tap to unlock");
                LiquidUI.showSpeedIndicator(state.overlay, state.lockedSpeed);
                return;
            }

            Log.info("Long press → Speed", Config.longPressSpeed + "x");
            state.playbackRateBefore = video.playbackRate;
            video.playbackRate = Config.longPressSpeed;

            // Show persistent speed indicator (stays until release)
            LiquidUI.showSpeedIndicator(state.overlay, Config.longPressSpeed);

            if (navigator.vibrate) navigator.vibrate(30);
        },

        onLongPressEnd: function (video, state) {
            // If speed is locked, don't restore
            if (state.isSpeedLocked) {
                LiquidUI.hideSpeedIndicator(state.overlay);
                return;
            }

            Log.info("Long press end → Normal speed");
            video.playbackRate = state.playbackRateBefore;

            // Hide the speed indicator
            LiquidUI.hideSpeedIndicator(state.overlay);
        },

        // Lock speed at current rate (called from swipe up during long press)
        lockSpeed: function (video, state) {
            state.isSpeedLocked = true;
            state.lockedSpeed = video.playbackRate;
            LiquidUI.showToast(state.overlay, `Speed locked: ${state.lockedSpeed}x`);
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
        },

        // Unlock speed (called from single tap when speed is locked)
        unlockSpeed: function (video, state) {
            state.isSpeedLocked = false;
            video.playbackRate = 1.0;
            LiquidUI.showToast(state.overlay, 'Speed: 1x');
            if (navigator.vibrate) navigator.vibrate(30);
        },

        onSwipe: function (dx, dy, video, state) {
            const zone = this.getZone(state.startX, window.innerWidth);

            // Use locked direction for more reliable gesture handling
            const isHorizontal = state.swipeDirection === 'horizontal';
            const isVertical = state.swipeDirection === 'vertical';

            // Sticky Speed Mode: swipe up during long press to lock speed
            if (state.isLongPressing && isVertical && dy < -TIMING.SPEED_LOCK_SWIPE_PX && !state.gestureHandled) {
                state.gestureHandled = true;
                this.lockSpeed(video, state);
                return;
            }

            if (isHorizontal) {
                // Horizontal: Seek
                const percent = dx / window.innerWidth;
                const seekTime = percent * Config.swipeSeekSensitivity;

                if (state.seekStartTime === null) {
                    state.seekStartTime = video.currentTime;
                }

                const targetTime = Utils.clamp(state.seekStartTime + seekTime, 0, video.duration || Infinity);
                video.currentTime = targetTime;

                // Mini Timestamp: show "1:23 / 5:45 (+15s)" format
                const currentFormatted = Utils.formatTime(targetTime);
                const durationFormatted = Utils.formatTime(video.duration || 0);
                const sign = seekTime > 0 ? '+' : '';
                const delta = Math.round(seekTime);
                LiquidUI.showToast(state.overlay, `${currentFormatted} / ${durationFormatted}  (${sign}${delta}s)`);
            } else if (isVertical && this.isFullscreen()) {
                // Vertical in Fullscreen
                const delta = -dy / (window.innerHeight * 0.5);

                if (zone === 'right') {
                    // Volume
                    const newVolume = Utils.clamp(state.volumeStartValue + delta * Config.volumeSensitivity, 0, 1);
                    video.volume = newVolume;
                    LiquidUI.showProgress(state.overlay, 'volume', newVolume, 'right');
                } else if (zone === 'left') {
                    // Brightness
                    const newBrightness = Utils.clamp(state.brightnessStartValue + delta * Config.brightnessSensitivity, 0.2, 2);
                    this.setBrightness(video, newBrightness);
                    LiquidUI.showProgress(state.overlay, 'brightness', (newBrightness - 0.2) / 1.8, 'left');
                } else if (zone === 'middle' && dy > TIMING.EXIT_FULLSCREEN_SWIPE_PX && !state.gestureHandled) {
                    // Swipe down middle: Exit fullscreen (only once)
                    state.gestureHandled = true;
                    if (document.exitFullscreen) document.exitFullscreen();
                    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                    LiquidUI.showIcon(state.overlay, 'exitFullscreen', 'Exit');
                }
            }
        },

        handleTap: function (video, state, x, event) {
            const now = Date.now();
            // Store event for later use in gesture handlers
            state.lastEvent = event;

            if (now - state.lastTapTime < 300) {
                clearTimeout(state.tapTimer);
                this.onDoubleTap(video, state, x);
                state.tapCount = 0;
                state.lastTapTime = 0;
            } else {
                state.tapCount = 1;
                state.lastTapTime = now;

                state.tapTimer = setTimeout(() => {
                    if (state.tapCount === 1) {
                        this.onSingleTap(video, state);
                    }
                    state.tapCount = 0;
                    state.lastEvent = null;
                }, 300);
            }
        },

        onSingleTap: function (video, state) {
            // If speed is locked, tap to unlock
            if (state.isSpeedLocked) {
                this.unlockSpeed(video, state);
                return;
            }

            // Single tap behavior:
            // - In fullscreen: toggle play/pause AND let player show its controls (both happen)
            // - In normal view: pass through to player only (show controls)

            if (this.isFullscreen()) {
                // Fullscreen: toggle play/pause, but also let player show UI
                Log.info("Single tap (fullscreen) → Toggle play/pause + show player UI");

                // DON'T stop propagation - allow player to also show its controls
                // This gives the benefit of both: play/pause + visible controls

                if (video.paused) {
                    // Error recovery: handle play() promise rejection
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(e => {
                            Log.warn("Play failed:", e.message);
                            LiquidUI.showToast(state.overlay, 'Cannot play');
                        });
                    }
                    LiquidUI.showIcon(state.overlay, 'play');
                } else {
                    video.pause();
                    LiquidUI.showIcon(state.overlay, 'pause');
                }
            } else {
                // Normal view: just let the player show its controls
                Log.info("Single tap (normal view) → Let player show controls");
            }

            state.lastEvent = null;
        },

        onDoubleTap: function (video, state, x) {
            const zone = this.getZone(x, window.innerWidth);
            Log.info("Double tap in zone:", zone);

            // Determine if we will handle this gesture
            const willHandle = !this.isFullscreen() || zone === 'left' || zone === 'right';

            // Stop event propagation if we're handling it
            // This prevents the player's double-tap handler from also firing
            if (willHandle && state.lastEvent) {
                state.lastEvent.stopPropagation();
                state.lastEvent.stopImmediatePropagation?.();
                state.lastEvent.preventDefault();
            }

            if (!this.isFullscreen()) {
                // Enter fullscreen
                const fsTarget = this.findPlayerContainer(video);
                if (fsTarget.requestFullscreen) fsTarget.requestFullscreen();
                else if (fsTarget.webkitRequestFullscreen) fsTarget.webkitRequestFullscreen();
                else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
                LiquidUI.showIcon(state.overlay, 'fullscreen', 'Fullscreen');
            } else {
                // Seek from edges only
                if (zone === 'left') {
                    video.currentTime = Math.max(0, video.currentTime - Config.seekStep);
                    LiquidUI.showSeekIndicator(state.overlay, 'left', `-${Config.seekStep}s`);
                    if (navigator.vibrate) navigator.vibrate(20);
                } else if (zone === 'right') {
                    video.currentTime = Math.min(video.duration, video.currentTime + Config.seekStep);
                    LiquidUI.showSeekIndicator(state.overlay, 'right', `+${Config.seekStep}s`);
                    if (navigator.vibrate) navigator.vibrate(20);
                }
                // Note: middle zone double-tap in fullscreen is NOT handled by us,
                // so the player's native handler can still work (e.g., exit fullscreen)
            }

            state.lastEvent = null;
        },

        handlePinch: function (video, isPinchOut, state) {
            if (isPinchOut) {
                video.style.objectFit = 'cover';
                LiquidUI.showIcon(state.overlay, 'aspect', 'Fill');
            } else {
                video.style.objectFit = 'contain';
                LiquidUI.showIcon(state.overlay, 'aspect', 'Fit');
            }
            Log.info("Pinch → objectFit:", video.style.objectFit);
        },

        // --- Brightness Helpers ---

        getBrightness: function (video) {
            const match = video.style.filter?.match(/brightness\(([\d.]+)\)/);
            return match ? parseFloat(match[1]) : 1;
        },

        setBrightness: function (video, value) {
            const existing = video.style.filter?.replace(/brightness\([^)]+\)/g, '').trim() || '';
            video.style.filter = `${existing} brightness(${value})`.trim();
        }
    };

    // =========================================================================
    // VIDEO SCANNER (with Shadow DOM support)
    // =========================================================================
    const VideoScanner = {
        observer: null,

        start: function () {
            Log.info("VideoScanner starting...");
            this.scan();

            // Throttled observer
            const throttledScan = Utils.throttle(() => this.scan(), 500);

            this.observer = new MutationObserver((mutations) => {
                let shouldScan = false;
                for (const m of mutations) {
                    // Check for added nodes
                    if (m.addedNodes.length > 0) {
                        shouldScan = true;
                    }
                    // Check for removed nodes (cleanup)
                    if (m.removedNodes.length > 0) {
                        m.removedNodes.forEach(node => {
                            if (node.nodeName === 'VIDEO') {
                                this.cleanupVideo(node);
                            } else if (node.querySelectorAll) {
                                // Check children of removed node
                                const removedVideos = node.querySelectorAll('video');
                                removedVideos.forEach(v => this.cleanupVideo(v));
                            }
                        });
                    }
                }
                if (shouldScan) throttledScan();
            });
            this.observer.observe(document.body, { childList: true, subtree: true });
        },

        cleanupVideo: function (video) {
            if (videoStates.has(video)) {
                Log.info("Video removed from DOM, cleaning up");
                const state = videoStates.get(video);
                state.abortController.abort();
                videoStates.delete(video);
                delete video.dataset.vgAttached;
                delete video.dataset.vgChecked;
            }
        },

        scan: function () {
            this.scanRoot(document);
        },

        scanRoot: function (root) {
            const videos = this.findAllVideos(root);
            if (videos.length) Log.info("Found", videos.length, "video(s) in", root.nodeName || 'shadowRoot');
            videos.forEach(v => this.processVideo(v));
        },

        findAllVideos: function (root) {
            const videos = [...root.querySelectorAll('video')];

            // Shadow DOM traversal
            root.querySelectorAll('*').forEach(el => {
                if (el.shadowRoot) {
                    videos.push(...this.findAllVideos(el.shadowRoot));
                }
            });

            return videos;
        },

        processVideo: function (video) {
            if (video.dataset.vgChecked) return;
            video.dataset.vgChecked = "true";

            if (video.readyState >= 1) {
                this.checkDuration(video);
            } else {
                video.addEventListener('loadedmetadata', () => this.checkDuration(video), { once: true });
                // Fallback timeout
                setTimeout(() => {
                    if (!video.dataset.vgAttached) this.checkDuration(video);
                }, 3000);
            }
        },

        checkDuration: function (video) {
            const duration = video.duration;
            Log.info("Video duration:", duration);

            if (duration && duration >= Config.minVideoDuration) {
                GestureController.attach(video);
            } else if (isNaN(duration) || duration === Infinity) {
                // Live stream
                Log.info("Live stream detected, attaching");
                GestureController.attach(video);
            } else {
                Log.info("Video too short, ignoring");
            }
        }
    };

    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    function init() {
        if (!Utils.isMobile() && !Config.allowDesktop) {
            Log.info("Desktop detected, script paused");
            return;
        }

        Log.info(`Initializing Video Gestures v${VERSION}...`);
        registerMenuCommands();
        LiquidUI.init();

        // Global styles for performance
        GM_addStyle(`
            /* Scope touch-action to video and overlay only to prevent breaking page scrolling */
            video, .vg-overlay-container {
                touch-action: manipulation !important;
            }
            .vg-overlay-container {
                overscroll-behavior: none !important;
            }
        `);

        if (document.body) {
            VideoScanner.start();
        } else {
            document.addEventListener('DOMContentLoaded', () => VideoScanner.start());
        }

        // Cross-Frame Synchronization
        window.addEventListener('message', (e) => {
            const data = e.data;
            if (!data) return;

            if (data.type === 'VG_FULLSCREEN_REQUEST') {
                // Iframe requested fullscreen
                const iframes = document.querySelectorAll('iframe');
                for (let iframe of iframes) {
                    if (iframe.contentWindow === e.source) {
                        const requestFs = iframe.requestFullscreen || iframe.webkitRequestFullscreen;
                        if (requestFs) requestFs.call(iframe);
                        break;
                    }
                }
            } else if (data.type === 'VG_ORIENTATION_LOCK') {
                // Iframe requested orientation lock
                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(() => { });
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
