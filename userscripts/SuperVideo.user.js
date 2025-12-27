// ==UserScript==
// @name          SuperVideo
// @namespace     https://github.com/itsrody/SuperBrowsing
// @version       7.0.8
// @icon          data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNGRjZCNkIiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iI0ZGNTM4QSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0ZGMTY3NyIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHg9IjgiIHk9IjI0IiB3aWR0aD0iMTEyIiBoZWlnaHQ9IjgwIiByeD0iMTIiIGZpbGw9InVybCgjYSkiLz48cGF0aCBkPSJNNTIgNDRMODQgNjQgNTIgODRWNDR6IiBmaWxsPSIjZmZmIi8+PGNpcmNsZSBjeD0iMzIiIGN5PSI0MCIgcj0iOCIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIwLjMiLz48Y2lyY2xlIGN4PSI5NiIgY3k9Ijg4IiByPSI2IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMiIvPjwvc3ZnPg==
// @description   Advanced video gestures, smart resume, and subtitle support
// @author        Murtaza Salih
// @match         *://*/*
// @match         *://*.dood.*/*
// @match         *://dood.*/*
// @match         *://*.dsvplay.com/*
// @match         *://dsvplay.com/*
// @match         *://*.dood.*/*
// @match         *://dood.*/*
// @match         *://*.dood.to/*
// @match         *://*.dood.so/*
// @match         *://*.dood.la/*
// @match         *://*.dood.wf/*
// @match         *://*.dood.cx/*
// @match         *://*.dood.sh/*
// @match         *://*.dood.watch/*
// @match         *://*.dood.pm/*
// @match         *://*.dood.ws/*
// @match         *://*.d000d.com/*
// @match         *://*.ds2play.com/*
// @exclude       *://*.netflix.com/*
// @exclude       *://netflix.com/*
// @exclude       *://*.youtube.com/*
// @exclude       *://youtube.com/*
// @exclude       *://*.instagram.com/*
// @exclude       *://instagram.com/*
// @exclude       *://*.facebook.com/*
// @exclude       *://facebook.com/*
// @exclude       *://*.reddit.com/*
// @exclude       *://reddit.com/*
// @exclude       *://*.tiktok.com/*
// @exclude       *://tiktok.com/*
// @exclude       *://*.dailymotion.com/*
// @exclude       *://dailymotion.com/*
// @exclude       *://*.hulu.com/*
// @exclude       *://hulu.com/*
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_deleteValue
// @grant         GM_addStyle
// @grant         GM_registerMenuCommand

// @grant         unsafeWindow
// @run-at        document-start
// ==/UserScript==

(async () => {
    'use strict';

    // Anti-Anti-Debugger / Anti-Adblock Killer
    const neutralizeAntiDebugger = () => {
        // 1. Prevent console clearing
        const noop = () => { };
        if (window.console) {
            try {
                // Protect console.clear from being used to hide logs
                // check() function uses console.clear() -> detect this
                const originalClear = console.clear;
                console.clear = function () {
                    // console.warn('[SuperVideo] Blocked console.clear()');
                };

                // Allow user to restore it if needed: console.clear._restore = () => { console.clear = originalClear; }
            } catch (e) { }
        }

        // 2. Trap debugger loops (setInterval/setTimeout with 'debugger')
        const trapDebugger = (originalAuth, type) => {
            return function (callback, delay, ...args) {
                if (typeof callback === 'function') {
                    const code = callback.toString();
                    // Detect the specific check() function signature or generic debugger loops
                    if (code.includes('debugger') ||
                        (code.includes('console.clear') && code.includes('Date().getTime()'))) {
                        console.warn(`[SuperVideo] Blocked anti-debugger ${type} loop`);
                        return undefined; // Block it
                    }
                }
                return originalAuth.apply(this, [callback, delay, ...args]);
            };
        };

        try {
            window.setInterval = trapDebugger(window.setInterval, 'setInterval');
            window.setTimeout = trapDebugger(window.setTimeout, 'setTimeout');
        } catch (e) { }
    };
    neutralizeAntiDebugger();

    // Check if mobile device
    const isMobile = () => {
        return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
            (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    };

    // ============================================================================
    // ERROR HANDLING & VALIDATION SYSTEM
    // ============================================================================

    /**
     * Centralized error handler with severity levels and recovery strategies
     */
    const ErrorHandler = (() => {
        const errorLog = [];
        const MAX_ERROR_LOG = 50;
        const ERROR_STORAGE_KEY = 'vg_error_log';

        /**
         * Report an error with context and severity
         * @param {string} context - Where the error occurred
         * @param {Error} error - The error object
         * @param {string} severity - 'debug'|'warn'|'error'|'fatal'
         */
        const report = (context, error, severity = 'warn') => {
            const entry = {
                context,
                message: error?.message || String(error),
                stack: error?.stack || '',
                timestamp: Date.now(),
                severity,
                userAgent: navigator.userAgent
            };

            // Log to console with appropriate level
            const logMethod = console[severity] || console.warn;
            logMethod(`[SuperVideo] ${context}:`, error);

            // Store in memory log
            errorLog.push(entry);
            if (errorLog.length > MAX_ERROR_LOG) {
                errorLog.shift();
            }

            // Persist critical errors
            if (severity === 'error' || severity === 'fatal') {
                try {
                    GM_setValue(ERROR_STORAGE_KEY, errorLog.slice(-10)).catch(() => { });
                } catch (e) {
                    // Silent fail if storage is unavailable
                }
            }

            // User notification for fatal errors only
            if (severity === 'fatal' && typeof showToast === 'function') {
                setTimeout(() => {
                    showToast('alert', 'Critical error - check console', 5000);
                }, 100);
            }
        };

        /**
         * Get error logs for debugging
         */
        const getErrors = () => [...errorLog];

        /**
         * Clear error log
         */
        const clearErrors = () => {
            errorLog.length = 0;
            try {
                GM_setValue(ERROR_STORAGE_KEY, []).catch(() => { });
            } catch (e) { }
        };

        return { report, getErrors, clearErrors };
    })();

    /**
     * Safe wrapper for GM_getValue with validation
     * @template T
     * @param {string} key - Storage key
     * @param {T} defaultValue - Default value if key doesn't exist or validation fails
     * @param {Function} validator - Optional validation function
     * @returns {Promise<T>}
     */
    const safeGMGet = async (key, defaultValue, validator = null) => {
        try {
            const value = await GM_getValue(key, defaultValue);

            // Type validation
            if (validator && !validator(value)) {
                ErrorHandler.report(`safeGMGet:${key}`, new Error('Validation failed'), 'warn');
                return defaultValue;
            }

            return value;
        } catch (error) {
            ErrorHandler.report(`safeGMGet:${key}`, error, 'error');
            return defaultValue;
        }
    };

    /**
     * Safe wrapper for GM_setValue with validation
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @returns {Promise<void>}
     */
    const safeGMSet = async (key, value) => {
        try {
            // Validate value is serializable
            if (value === undefined) {
                throw new Error('Cannot store undefined value');
            }

            // Test JSON serialization
            const testSerialization = JSON.stringify(value);
            if (!testSerialization) {
                throw new Error('Value is not serializable');
            }

            await GM_setValue(key, value);
        } catch (error) {
            ErrorHandler.report(`safeGMSet:${key}`, error, 'error');
            throw error; // Re-throw for caller to handle
        }
    };

    /**
     * Configuration validator
     * @param {Object} config - Configuration object to validate
     * @returns {boolean}
     */
    const validateConfig = (config) => {
        if (!config || typeof config !== 'object') return false;

        // Check critical numeric values
        const numericChecks = [
            { key: 'MIN_VIDEO_DURATION', min: 0, max: 3600 },
            { key: 'DOUBLE_TAP_SEEK', min: 1, max: 60 },
            { key: 'SWIPE_THRESHOLD', min: 5, max: 100 },
            { key: 'SEEK_SENSITIVITY', min: 0.1, max: 2 },
            { key: 'HAPTIC_DURATION', min: 5, max: 100 },
            { key: 'LONG_PRESS_DURATION', min: 100, max: 2000 },
            { key: 'LONG_PRESS_SPEED', min: 0.5, max: 5 }
        ];

        for (const check of numericChecks) {
            const value = config[check.key];
            if (value !== undefined) {
                if (typeof value !== 'number' || value < check.min || value > check.max) {
                    return false;
                }
            }
        }

        return true;
    };

    /**
     * Clamp numeric value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number}
     */
    const clamp = (value, min, max) => {
        if (!Number.isFinite(value)) return min;
        return Math.max(min, Math.min(max, value));
    };

    /**
     * Validate and sanitize resume data
     * @param {Object} data - Resume data object
     * @returns {Object} - Sanitized data or empty object
     */
    const validateResumeData = (data) => {
        if (!data || typeof data !== 'object') return {};

        const sanitized = {};
        const DATA_VERSION = 2;

        for (const [key, entry] of Object.entries(data)) {
            // Validate entry structure
            if (!entry || typeof entry !== 'object') continue;

            // Validate required fields
            if (typeof entry.resumeTime !== 'number' || !Number.isFinite(entry.resumeTime)) continue;
            if (typeof entry.timestamp !== 'number') continue;
            if (typeof entry.url !== 'string' || entry.url.length === 0) continue;

            // Create sanitized entry
            sanitized[key] = {
                resumeTime: clamp(entry.resumeTime, 0, 86400), // Max 24 hours
                timestamp: entry.timestamp,
                confidence: clamp(entry.confidence || 100, 0, 100),
                version: entry.version || DATA_VERSION,
                title: (entry.title || '').substring(0, 200), // Limit title length
                url: entry.url,
                duration: clamp(entry.duration || 0, 0, 86400),
                resume: typeof entry.resume === 'boolean' ? entry.resume : true
            };

            // Optional fields with validation
            if (entry.sub_fileName && typeof entry.sub_fileName === 'string') {
                sanitized[key].sub_fileName = entry.sub_fileName.substring(0, 100);
            }
            if (entry.SUB_FONT_SIZE && typeof entry.SUB_FONT_SIZE === 'number') {
                sanitized[key].SUB_FONT_SIZE = clamp(entry.SUB_FONT_SIZE, 8, 48);
            }
        }

        return sanitized;
    };

    // Constants
    const STYLE_ID = 'vg-styles';
    const INDICATOR_ID = 'vg-indicator';
    const TOAST_ID = 'vg-toast';

    // Default configuration
    const CONFIG = {
        MIN_VIDEO_DURATION: 60,
        DOUBLE_TAP_SEEK: 5,
        SWIPE_THRESHOLD: 25,
        SEEK_SENSITIVITY: 0.4,
        HAPTIC_FEEDBACK: true,
        HAPTIC_DURATION: 15,
        FORCE_LANDSCAPE: true,
        DOUBLE_TAP_TIMEOUT: 300,
        LONG_PRESS_DURATION: 450,
        LONG_PRESS_SPEED: 2.0,
        DEAD_ZONE_SIZE: 30, // pixels from edges
        GESTURE_TIMEOUT: 10000, // 10 seconds
        TAP_ZONES: { BACKWARD: 0.4, FORWARD: 0.6 },
        INDICATOR_UPDATE_THROTTLE: 80, // ms
        RESUME_PLAYBACK: true,
        AUTO_RESUME: true, // Automatically resume without prompting
        RESUME_THRESHOLD: 5, // seconds
        SUB_FONT_SIZE: 16, // Default persistence
        SHOW_TOASTS: true, // Visual feedback enabled by default
        PREVENT_SLEEP: true // Keep screen awake by default
    };

    // Load saved config with validation
    let savedConfig = {};
    try {
        savedConfig = await safeGMGet('vg_config', {}, validateConfig);
        if (!validateConfig(savedConfig)) {
            ErrorHandler.report('ConfigLoad', new Error('Invalid config loaded, using defaults'), 'warn');
            savedConfig = {};
        }
    } catch (e) {
        ErrorHandler.report('ConfigLoad', e, 'error');
    }

    // Merge configs
    const settings = { ...CONFIG, ...savedConfig };

    // Save config function with validation
    const saveConfig = async () => {
        try {
            if (!validateConfig(settings)) {
                throw new Error('Invalid settings cannot be saved');
            }
            await safeGMSet('vg_config', settings);
        } catch (e) {
            ErrorHandler.report('ConfigSave', e, 'error');
            throw e;
        }
    };



    // Format time helper
    const formatTime = (seconds) => {
        if (!Number.isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const hours = Math.floor(mins / 60);
        if (hours > 0) {
            return `${hours}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    // ============================================================================
    // FULLSCREEN API (Cross-browser Compatible)
    // ============================================================================

    /**
     * Unified Fullscreen API with proper vendor prefix support
     * Order: Standard → Firefox → Chrome → IE (ensures Firefox compatibility)
     */
    const FullscreenAPI = {
        /**
         * Get current fullscreen element (cross-browser)
         */
        get element() {
            return document.fullscreenElement ||           // Standard (modern browsers)
                document.mozFullScreenElement ||        // Firefox
                document.webkitFullscreenElement ||     // Chrome/Safari
                document.msFullscreenElement ||         // IE11
                null;
        },

        /**
         * Request fullscreen on an element (cross-browser)
         */
        request(element) {
            const methods = [
                'requestFullscreen',        // Standard
                'mozRequestFullScreen',     // Firefox (capital S)
                'webkitRequestFullscreen',  // Chrome/Safari
                'msRequestFullscreen'       // IE11
            ];

            for (const method of methods) {
                if (element[method]) {
                    return element[method]();
                }
            }
            return Promise.reject(new Error('Fullscreen not supported'));
        },

        /**
         * Exit fullscreen (cross-browser)
         */
        exit() {
            const methods = [
                'exitFullscreen',           // Standard
                'mozCancelFullScreen',      // Firefox
                'webkitExitFullscreen',     // Chrome/Safari
                'msExitFullscreen'          // IE11
            ];

            for (const method of methods) {
                if (document[method]) {
                    return document[method]();
                }
            }
            return Promise.reject(new Error('Fullscreen not supported'));
        },

        /**
         * Add fullscreen change listener (all browser variants)
         */
        addChangeListener(callback, options = { passive: true }) {
            const events = [
                'fullscreenchange',         // Standard
                'mozfullscreenchange',      // Firefox
                'webkitfullscreenchange',   // Chrome/Safari
                'MSFullscreenChange'        // IE11
            ];

            events.forEach(event =>
                document.addEventListener(event, callback, options)
            );

            // Return cleanup function
            return () => events.forEach(event =>
                document.removeEventListener(event, callback)
            );
        }
    };

    // Legacy aliases for backward compatibility
    const getFullscreenElement = () => FullscreenAPI.element;
    const requestFullscreen = (element) => FullscreenAPI.request(element);
    const exitFullscreen = () => FullscreenAPI.exit();

    // --- Trusted Types Support ---
    let ttPolicy = null;
    // Feature detection for Trusted Types
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        try {
            ttPolicy = window.trustedTypes.createPolicy('superVideoPolicy', {
                createHTML: (string) => string // We trust our own content generation
            });
        } catch (e) {
            ErrorHandler.report('TrustedTypesPolicy', e, 'warn');
        }
    }

    const setInnerHTML = (element, html) => {
        if (ttPolicy) {
            element.innerHTML = ttPolicy.createHTML(html);
        } else {
            element.innerHTML = html;
        }
    };

    // --- Frame-Perfect Seeking ---
    // Uses requestVideoFrameCallback for frame-accurate seeking when available
    // Create styles using GM_addStyle for CSP bypass
    const createStyles = () => {
        if (document.getElementById(STYLE_ID)) return;

        const css = `
            /* Optimize video element for gestures */
            .vg-optimized {
                touch-action: none !important; /* Disable browser handling of gestures on video */
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                user-select: none !important;
            }

        /* External fonts and icons removed for privacy and performance */
        #${INDICATOR_ID}, #${TOAST_ID} {
            position: fixed !important;
            z-index: 2147483647 !important;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif !important;
            font-weight: 500 !important;
            pointer-events: none !important;

            /* Hardware Acceleration Hints */
            will-change: transform, opacity !important;
            backface-visibility: hidden !important;
            isolation: isolate !important;
            /* Fallback for contain */
            overflow: hidden !important;

            /* Base state: Hidden, scaled down, transparent */
            opacity: 0 !important;
            visibility: hidden !important;
            transform: translate(-50%, -50%) scale(0.9) !important;

            /* Transition: Smooth spring-like curve */
            transition:
            opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            visibility 0s linear 0.4s !important; /* Delay visibility hidden until fade out done */
        }

        @supports (contain: layout) {
            #${INDICATOR_ID}, #${TOAST_ID} {
                contain: layout style paint !important;
            }
        }

        /* Allow clicks on toast */
        #${TOAST_ID} {
            pointer-events: auto !important;
            cursor: pointer !important;
        }

        /* Top Pill Style - Glassmorphism Design */
        #${INDICATOR_ID}.vg-pill, #${TOAST_ID} {
            top: 15% !important;
            left: 50% !important;
            padding: 10px 20px !important;

            /* Dark glassmorphism: visible on bright scenes */
            background: linear-gradient(135deg,
            rgba(0, 0, 0, 0.55) 0%,
            rgba(0, 0, 0, 0.40) 100%) !important;
            backdrop-filter: blur(24px) saturate(150%) !important;
            -webkit-backdrop-filter: blur(24px) saturate(150%) !important;

            /* Subtle border for definition */
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
            background-clip: padding-box !important;

            color: rgba(255, 255, 255, 0.95) !important;
            border-radius: 24px !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 10px !important;

            /* Layered shadows for depth */
            box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.4),
            0 2px 8px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;

            min-width: auto !important;
            white-space: nowrap !important;
            justify-content: center !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            letter-spacing: 0.3px !important;
            transform-origin: center !important;
        }

        /* Animated gradient border */
        #${INDICATOR_ID}.vg-pill::before, #${TOAST_ID}::before {
            content: '' !important;
            position: absolute !important;
            inset: -1px !important;
            border-radius: 25px !important;
            padding: 1px !important;
            background: linear-gradient(135deg,
            rgba(255, 255, 255, 0.3) 0%,
            rgba(255, 255, 255, 0.1) 50%,
            rgba(255, 255, 255, 0.2) 100%) !important;
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0) !important;
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0) !important;
            -webkit-mask-composite: xor !important;
            mask-composite: exclude !important;
            pointer-events: none !important;
        }

        .vg-text {
            white-space: nowrap !important; /* Strict no-wrap */
        }

        /* Active State */
        #${INDICATOR_ID}.vg-pill.visible, #${TOAST_ID}.visible {
            opacity: 1 !important;
            visibility: visible !important;
            transform: translate(-50%, -50%) scale(1.1) !important; /* Larger base scale */
            transition:
            opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            visibility 0s !important; /* Instant visibility on show */
        }

        /* Edge Circle Style (Seeking) */
        #${INDICATOR_ID}.vg-edge {
            top: 50% !important;
            padding: 20px !important;
            background: rgba(0, 0, 0, 0.3) !important;
            -webkit-backdrop-filter: blur(24px) saturate(150%) !important;
            backdrop-filter: blur(24px) saturate(150%) !important;
            color: #fff !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 64px !important;
            height: 64px !important;
            box-shadow: 0 0 20px rgba(0,0,0,0.4) !important;
            /* Initial transform override for edge */
            transform: translate(-50%, -50%) scale(0.8) !important;
        }

        /* Specific Edge Positioning & Transform Origin */
        #${INDICATOR_ID}.vg-edge.left {
            left: 48px !important; /* Move inward */
            /* Remove border-radius overrides to keep it circular */
            transform: translate(-50%, -50%) scale(0.8) !important;
        }

        #${INDICATOR_ID}.vg-edge.right {
            right: 48px !important; /* Move inward */
            left: auto !important;
            transform: translate(50%, -50%) scale(0.8) !important;
        }

        /* Visible State for Edge */
        #${INDICATOR_ID}.vg-edge.visible {
            opacity: 1 !important;
            visibility: visible !important;
            /* Transition inherited from base, explicitly set visibility to instant */
            transition:
            opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            visibility 0s !important;
        }

        .vg-pill.morphing, .vg-pill.resume {
            transition: all var(--morph-duration, 500ms) cubic-bezier(0.4, 0, 0.2, 1);
            will-change: left, top, width, height, transform;
        }

        #${INDICATOR_ID}.vg-edge.left.visible {
            transform: translate(-50%, -50%) scale(1) !important;
        }

        #${INDICATOR_ID}.vg-edge.right.visible {
            transform: translate(50%, -50%) scale(1) !important;
        }

        /* Inner Content Layout */
        .vg-row {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
        }

        .vg-column {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
        }

        .vg-icon {
            width: 20px !important;
            height: 20px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }

        .vg-edge .vg-icon {
            width: 28px !important;
            height: 28px !important;
        }

        .vg-icon svg {
            width: 100% !important;
            height: 100% !important;
            fill: currentColor !important;
        }

        .vg-text {
            font-size: 14px !important;
            line-height: 1.2 !important; /* Adjusted from 1 for better vertical centering */
            padding-top: 1px !important; /* Optical correction */
        }

        .vg-subtext {
            font-size: 11px !important;
            opacity: 0.8 !important;
            margin-top: 2px !important;
        }

        /* Progress Bar for Seek (in Pill if needed, or overlay) */
        /* Currently not using pill for seek, so maybe omitted or adapted */
        .vg-progress {
            position: absolute !important;
            bottom: 0 !important;
            left: 0 !important;
            height: 3px !important;
            background: rgba(255,255,255,0.3) !important;
            width: 100% !important;
        }

        .vg-progress-bar {
            height: 100% !important;
            background: #fff !important;
            width: 0%;
        }

        @media (prefers-reduced-motion: reduce) {
            #${INDICATOR_ID}, #${TOAST_ID} {
            transition: none !important;
            }
        }

        /* Pulse Animations for Streak */
        @keyframes vg-pulse-left {
            0% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(1.15); } /* Pop */
            100% { transform: translate(-50%, -50%) scale(1); }
        }

        @keyframes vg-pulse-right {
            0% { transform: translate(50%, -50%) scale(1); }
            50% { transform: translate(50%, -50%) scale(1.15); }
            100% { transform: translate(50%, -50%) scale(1); }
        }

        .vg-animate-left {
            animation: vg-pulse-left 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
        }

        .vg-animate-right {
            animation: vg-pulse-right 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
        }

        /* Boing / Rubber Band for Limits */
        @keyframes vg-rubber-band {
            0% { transform: translate(-50%, -50%) scale(1); }
            30% { transform: translate(-50%, -50%) scale(1.25, 0.75); } /* Squash */
            40% { transform: translate(-50%, -50%) scale(0.75, 1.25); } /* Stretch */
            50% { transform: translate(-50%, -50%) scale(1.15, 0.85); }
            65% { transform: translate(-50%, -50%) scale(0.95, 1.05); }
            75% { transform: translate(-50%, -50%) scale(1.05, 0.95); }
            100% { transform: translate(-50%, -50%) scale(1); }
        }

        .vg-limit-hit {
            animation: vg-rubber-band 0.6s ease-in-out !important;
            color: #ff4aa1 !important; /* Visual 'Limit' Red/Pink tint? Or just physics? Let's keep color standard for now, maybe subtle red border? */
            border-color: rgba(255, 100, 100, 0.5) !important;
        }
        /* Subtitle Overlay Style */
        .vg-subtitle-overlay {
            position: absolute !important;
            bottom: 10% !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            text-align: center !important;
            color: #fff !important;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            font-size: 16px;
            text-shadow: 0 0 4px #000, 0 0 4px #000, 0 2px 4px rgba(0,0,0,0.8) !important;
            pointer-events: none !important;
            z-index: 2147483647 !important;
            white-space: pre-wrap !important;
            line-height: 1.4 !important;
            transition: opacity 0.2s !important;
            padding: 4px 12px !important;
            background: rgba(0,0,0,0.3) !important; /* Slight dim for readability */
            border-radius: 4px !important;

            /* Performance */
            will-change: transform !important;
            text-rendering: optimizeSpeed !important;
            backface-visibility: hidden !important;
            /* Fallback for contain */
            overflow: hidden !important;
        }

        @supports (contain: layout) {
            .vg-subtitle-overlay {
                contain: layout style paint !important;
            }
        }

        .vg-subtitle-overlay.hidden { opacity: 0 !important; }

        /* ========================================================================
           RESUME TOAST MORPHING ANIMATIONS - Firefox/Gecko Optimized
           ======================================================================== */

        /* Mark as resume toast */
        #${TOAST_ID}.resume {
            /* Uses existing pill styling */
        }

        /* Morphing state - transitioning from pill to circle */
        #${TOAST_ID}.resume.morphing {
            padding: 12px !important;
            border-radius: 50% !important;
            min-width: auto !important;
            width: 44px !important;
            height: 44px !important;

            /* Firefox/Gecko-optimized transitions - GPU accelerated */
            transition:
                padding 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
                border-radius 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
                width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
                height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
                left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
                top 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
                transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) !important;

            /* Performance optimizations */
            will-change: transform, opacity, border-radius !important;
            isolation: isolate !important;
            overflow: hidden !important; /* Fallback for contain */
            backface-visibility: hidden !important;
        }

        @supports (contain: layout) {
            #${TOAST_ID}.resume.morphing {
                contain: layout style paint !important;
            }
        }

        /* Hide text during morph */
        #${TOAST_ID}.resume.morphing .vg-text {
            opacity: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
            transition: opacity 0.15s, width 0.15s !important;
        }

        /* Final circle state - icon only */
        #${TOAST_ID}.resume.circle {
            padding: 12px !important;
            border-radius: 50% !important;
            width: 44px !important;
            height: 44px !important;
            gap: 0 !important;

            /* Maintain performance hints */
            will-change: transform, opacity !important;
        }

        @supports (contain: layout) {
            #${TOAST_ID}.resume.circle {
                contain: layout style paint !important;
            }
        }

        /* Hide text in circle mode */
        #${TOAST_ID}.resume.circle .vg-text {
            display: none !important;
        }

        /* Scale down icon slightly */
        #${TOAST_ID}.resume.circle .vg-icon {
            width: 20px !important;
            height: 20px !important;
        }

        /* Clean up will-change after animation settles */
        #${TOAST_ID}.resume.circle.settled {
            will-change: auto !important;
        }
        `;

        // Use GM_addStyle if available (Standard for userscripts)
        if (typeof GM_addStyle !== 'undefined') {
            GM_addStyle(css);
            // Create a dummy element to prevent re-injection if checked by ID
            const dummy = document.createElement('div');
            dummy.id = STYLE_ID;
            dummy.style.display = 'none';
            document.head.appendChild(dummy);
        } else {
            // Fallback
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = css;
            document.head.appendChild(style);
        }
    };

    // UI elements
    let indicator = null;
    let toast = null;
    let hideTimer = null;
    let toastTimer = null;

    // Memory management
    let activeVideos = new WeakSet();
    let videoTimers = new WeakMap();
    const videoOriginalStyles = new WeakMap();

    // --- Memory Safety: Bounded Cache Implementation ---
    // Prevents unbounded cache growth with automatic LRU eviction
    class BoundedWeakMap {
        constructor(maxSize = 100) {
            this.map = new WeakMap();
            this.keys = new Set(); // Track keys for size limit
            this.maxSize = maxSize;
        }

        set(key, value) {
            if (!this.map.has(key) && this.keys.size >= this.maxSize) {
                // Evict oldest (first in Set)
                const oldest = this.keys.values().next().value;
                this.keys.delete(oldest);
                // WeakMap will auto-GC when key is no longer referenced
            }

            this.map.set(key, value);
            this.keys.add(key);
        }

        get(key) {
            return this.map.get(key);
        }

        has(key) {
            return this.map.has(key);
        }

        delete(key) {
            this.keys.delete(key);
            return this.map.delete(key);
        }

        get size() {
            return this.keys.size;
        }

        clear() {
            this.keys.clear();
            // WeakMap doesn't have clear(), but clearing keys helps GC
        }
    }

    // --- Video Lifecycle Management ---
    // Tracks video elements and automatically cleans up when removed from DOM
    const VideoLifecycle = (() => {
        const videos = new WeakMap(); // video -> { attached: boolean, cleanupFns: [], observer: MutationObserver }

        const attach = (video) => {
            if (videos.has(video)) return;

            const cleanupFns = [];

            // Track removal from DOM
            const observer = new MutationObserver(() => {
                if (!document.contains(video)) {
                    detach(video);
                    observer.disconnect();
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
            cleanupFns.push(() => observer.disconnect());

            videos.set(video, { attached: true, cleanupFns, observer });
        };

        const detach = (video) => {
            const state = videos.get(video);
            if (!state) return;

            state.attached = false;

            // Run all cleanup functions
            state.cleanupFns.forEach(fn => {
                try {
                    fn();
                } catch (e) {
                    ErrorHandler.report('VideoLifecycle:Cleanup', e, 'warn');
                }
            });

            // Clean up all caches
            elementCache.delete(video);
            containerCache.delete(video);
            videoOriginalStyles.delete(video);
            VideoTracker.delete(video);
            negativeElementCache.delete(video);
            interactiveCache.delete(video);

            videos.delete(video);
        };

        const addCleanup = (video, cleanupFn) => {
            const state = videos.get(video);
            if (state) {
                state.cleanupFns.push(cleanupFn);
            }
        };

        const isAttached = (video) => {
            const state = videos.get(video);
            return state ? state.attached : false;
        };

        return { attach, detach, addCleanup, isAttached };
    })();

    // --- Safe Event Listener Wrapper ---
    // Automatically cleans up event listeners when video is removed
    const SafeEventListener = (video, event, handler, options) => {
        video.addEventListener(event, handler, options);

        // Register cleanup
        const cleanup = () => {
            video.removeEventListener(event, handler, options);
        };

        VideoLifecycle.addCleanup(video, cleanup);

        return cleanup; // Return cleanup function for manual removal if needed
    };

    // --- Lazy Event Delegation: Centralized Video State ---
    // Stores per-video tracking state without per-video listeners
    const VideoTracker = new WeakMap(); // { lastSaveTime, restored, tracking }

    const getVideoState = (video) => {
        if (!VideoTracker.has(video)) {
            VideoTracker.set(video, {
                lastSaveTime: 0,
                restored: false,
                tracking: false
            });
        }
        return VideoTracker.get(video);
    };


    let lastActiveTime = Date.now();

    // Suspended toast system for undo resume toast
    let suspendedToast = null; // Stores suspended toast data: { iconName, text, onClick, expiresAt }
    let suspendCheckInterval = null;

    const createElements = () => {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = INDICATOR_ID;
            document.body.appendChild(indicator);
        }

        if (!toast) {
            toast = document.createElement('div');
            toast.id = TOAST_ID;
            document.body.appendChild(toast);
        }
    };

    // ============================================================================
    // NOTIFICATION COORDINATION SYSTEM
    // ============================================================================




    // Set default transition durations
    const root = document.documentElement;
    root.style.setProperty('--morph-duration', '500ms');
    root.style.setProperty('--fade-duration', '300ms');


    let currentVideoContext = null; // Track current video for iframe positioning


    const showIndicator = (iconName, text, type = '', sticky = false, progress = null, targetVideo = null) => {
        if (!indicator) return;

        // Check if there's a suspended undo toast - hide it when indicator shows
        if (suspendedToast && Date.now() < suspendedToast.expiresAt && toast) {
            console.log('[SuperVideo] Indicator showing - suspending undo toast');
            // Force immediate opacity change without transition for instant hide
            toast.style.transition = 'none';
            toast.style.opacity = '0';
            // Remove visible class after opacity is 0
            setTimeout(() => {
                toast.classList.remove('visible');
                console.log('[SuperVideo] Undo toast hidden');
            }, 50);
        }

        const iconSvg = getIconSvg(iconName);
        let uiClass = 'vg-pill'; // Default to pill
        let content = '';

        // Get viewport context (iframe-aware)
        const viewport = targetVideo ? getVideoViewport(targetVideo) : (currentVideoContext || { isIframe: false, left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, element: document.body });

        // Position indicator relative to viewport
        indicator.style.position = 'fixed';
        indicator.style.left = '50%';
        indicator.style.top = '15%';
        indicator.style.transform = 'translateX(-50%)';

        // Append to fullscreen element if in fullscreen, otherwise body
        const fullscreenElement = FullscreenAPI.element;
        const targetParent = fullscreenElement || document.body;

        if (indicator.parentElement !== targetParent) {
            targetParent.appendChild(indicator);
        }

        // Determine UI Style
        // Fix: 'seeking' (drag) now uses Top Pill as requested.
        // Edge style is ONLY for step-backward/forward (taps) or direct icon usage.
        if ((iconName.includes('backward') || iconName.includes('forward')) && type !== 'speed' && type !== 'seeking') {
            // Edge style (for double-tap seek)
            const isLeft = iconName.includes('backward');
            uiClass = `vg-edge ${isLeft ? 'left' : 'right'}`;

            // Content for Edge
            content = `<span class="vg-icon">${iconSvg}</span>`;

            if (text) {
                content = `
                            <div class="vg-column">
                                <span class="vg-icon">${iconSvg}</span>
                                ${text ? `<span class="vg-subtext">${text}</span>` : ''}
                            </div>
                        `;
            }

            // Pulse Animation Logic for Streak
            if (indicator.classList.contains('visible') && type && (type.includes('seek') || iconName.includes('step'))) {
                const animClass = isLeft ? 'vg-animate-left' : 'vg-animate-right';
                indicator.classList.remove('vg-animate-left', 'vg-animate-right');
                void indicator.offsetWidth; // Force reflow
                indicator.classList.add(animClass);
            }

        } else {
            // Pill style
            content = `<div class="vg-row"><span class="vg-icon">${iconSvg}</span><span class="vg-text">${text}</span></div>`;
        }

        indicator.className = `${uiClass} visible ${type || ''}`.trim();
        setInnerHTML(indicator, content);

        clearTimeout(hideTimer);
        if (!sticky) {
            hideTimer = setTimeout(() => {
                hideIndicator();
            }, (type && type.includes('seek')) ? 600 : 1500); // Shorter for seek, normal for others
        }
    };

    const hideIndicator = () => {
        if (!indicator) return;

        // Don't cancel immediately if simple fade out, but if we need to force hide:
        indicator.classList.remove('visible');

        // After indicator hides, check if suspended undo toast should be restored
        setTimeout(() => {
            if (suspendedToast && Date.now() < suspendedToast.expiresAt && toast) {
                console.log('[SuperVideo] Indicator hidden - restoring undo toast');
                const remaining = suspendedToast.expiresAt - Date.now();
                // Restore the toast with smooth transition
                if (remaining > 0) {
                    showToast(suspendedToast.iconName, suspendedToast.text, remaining, suspendedToast.onClick);
                    console.log('[SuperVideo] Undo toast restored, remaining:', Math.round(remaining / 1000), 's');
                } else {
                    console.log('[SuperVideo] Undo toast expired during indicator display');
                    suspendedToast = null;
                }
            }
        }, 400); // Wait a bit longer for indicator to fully fade

        // We rely on CSS transition

        // We rely on CSS transition
    };

    const showToast = (iconName, text, duration = 2000, onClick = null, targetVideo = null) => {
        if (!toast) return;

        // Check if there's a suspended undo toast that's still valid
        const hasSuspendedToast = suspendedToast && Date.now() < suspendedToast.expiresAt;

        if (hasSuspendedToast && iconName !== 'undo') {
            // New toast interrupting undo toast - fade out then show new
            console.log('[SuperVideo] New toast interrupting undo toast - fading out');
            toast.style.transition = 'opacity 0.2s';
            toast.style.opacity = '0';
            // Wait for fade then update content
            setTimeout(() => {
                updateContent();
            }, 200);
            return; // Exit early, updateContent will be called after fade
        }

        updateContent();

        function updateContent() {

            const iconSvg = getIconSvg(iconName);

            // Get viewport context (iframe-aware)
            const viewport = targetVideo ? getVideoViewport(targetVideo) : (currentVideoContext || { isIframe: false, left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, element: document.body });

            // Position toast relative to viewport
            if (viewport.isIframe) {
                toast.style.position = 'absolute';
                toast.style.left = `${viewport.left + viewport.width / 2}px`;
                toast.style.top = `${viewport.top + viewport.height * 0.15}px`;
            } else {
                toast.style.position = 'fixed';
                toast.style.left = '50%';
                toast.style.top = '15%';
            }

            toast.className = 'vg-pill visible';
            toast.style.transition = 'opacity 0.3s';
            toast.style.opacity = '1'; // Fade in
            setInnerHTML(toast, `<div class="vg-row"><span class="vg-icon">${iconSvg}</span><span class="vg-text">${text}</span></div>`);

            // Handle Click
            toast.onclick = null; // Clear previous
            if (onClick) {
                toast.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onClick();
                    // If this is undo toast being clicked, clear suspended state
                    if (iconName === 'undo') {
                        suspendedToast = null;
                    }
                };
            }

            clearTimeout(toastTimer);

            // Special handling for undo toast
            if (iconName === 'undo') {
                toastTimer = setTimeout(() => {
                    toast.style.opacity = '0';
                    setTimeout(() => {
                        toast.classList.remove('visible');
                        toast.onclick = null;
                    }, 300);
                    // Clear suspended state when undo toast expires naturally
                    suspendedToast = null;
                    console.log('[SuperVideo] Undo toast expired and cleared');
                }, duration);
            } else {
                // Regular toast
                toastTimer = setTimeout(() => {
                    toast.style.opacity = '0';
                    setTimeout(() => {
                        toast.classList.remove('visible');
                        toast.onclick = null;
                    }, 300);

                    // After this toast hides, check if suspended undo toast should be restored
                    if (hasSuspendedToast) {
                        setTimeout(() => {
                            if (suspendedToast && Date.now() < suspendedToast.expiresAt) {
                                console.log('[SuperVideo] Restoring suspended undo toast');
                                const remaining = suspendedToast.expiresAt - Date.now();
                                showToast(suspendedToast.iconName, suspendedToast.text, remaining, suspendedToast.onClick);
                            } else if (suspendedToast) {
                                console.log('[SuperVideo] Suspended undo toast expired, not restoring');
                                suspendedToast = null;
                            }
                        }, 350); // Wait for fade out
                    }
                }, duration);
            }
        } // End of updateContent function
    };

    /**
     * Show resume toast with morph coordination
     * Wrapper around showToast that enables morphing when other notifications appear
     */
    /**
     * Show resume toast
     */
    const showResumeToast = (iconName, text, duration, onClick) => {
        // If this is an undo toast, register it as suspendable
        if (iconName === 'undo') {
            suspendedToast = {
                iconName,
                text,
                onClick,
                expiresAt: Date.now() + duration
            };
            console.log('[SuperVideo] Registered undo toast as suspendable, expires in', duration / 1000, 'seconds');
        }

        // Show toast normally
        showToast(iconName, text, duration, onClick);

        // Mark toast element as resume toast
        const toastEl = document.getElementById(TOAST_ID);
        if (toastEl) {
            toastEl.classList.add('resume');
        }
    };

    const showDualToast = (leftAction, rightAction, duration = 6000, targetVideo = null) => {
        if (!toast) return;

        // Get viewport context
        const viewport = targetVideo ? getVideoViewport(targetVideo) : (currentVideoContext || { isIframe: false, left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, element: document.body });

        // Position toast
        if (viewport.isIframe) {
            toast.style.position = 'absolute';
            toast.style.left = `${viewport.left + viewport.width / 2}px`;
            toast.style.top = `${viewport.top + viewport.height * 0.15}px`;
        } else {
            toast.style.position = 'fixed';
            toast.style.left = '50%';
            toast.style.top = '15%';
        }

        toast.className = 'vg-pill visible vg-dual-toast';

        // Icons
        const leftIcon = getIconSvg(leftAction.icon);
        const rightIcon = getIconSvg(rightAction.icon);

        // Construct HTML
        const html = `
                <div class="vg-row" style="gap: 12px;">
                    <div id="vg-btn-left" class="vg-btn" style="cursor: pointer; display: flex; align-items: center; opacity: 0.9; transition: opacity 0.2s;">
                        <span class="vg-icon" title="${leftAction.title || ''}">${leftIcon}</span>
                    </div>
                    <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.3);"></div>
                    <div id="vg-btn-right" class="vg-btn" style="cursor: pointer; display: flex; align-items: center; gap: 6px; opacity: 0.9; transition: opacity 0.2s;">
                        <span class="vg-icon">${rightIcon}</span>
                        <span class="vg-text">${rightAction.text}</span>
                    </div>
                </div>
            `;
        setInnerHTML(toast, html);

        // Attach listeners
        const leftBtn = toast.querySelector('#vg-btn-left');
        const rightBtn = toast.querySelector('#vg-btn-right');

        if (leftBtn && leftAction.callback) {
            leftBtn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                leftBtn.style.opacity = '0.5';
                leftAction.callback();
            };
        }

        if (rightBtn && rightAction.callback) {
            rightBtn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                rightBtn.style.opacity = '0.5';
                rightAction.callback();
            };
        }

        // Clear global click just in case
        toast.onclick = null;

        clearTimeout(toastTimer);
        if (duration > 0) {
            toastTimer = setTimeout(() => {
                toast.classList.remove('visible');
                toast.onclick = null;
            }, duration);
        }
    };

    const attachToFullscreen = () => {
        const fsElement = getFullscreenElement();
        if (fsElement) {
            if (indicator && indicator.parentElement !== fsElement) {
                fsElement.appendChild(indicator);
            }
            if (toast && toast.parentElement !== fsElement) {
                fsElement.appendChild(toast);
            }
        }
        else {
            if (indicator && indicator.parentElement !== document.body) {
                document.body.appendChild(indicator);
            }
            if (toast && toast.parentElement !== document.body) {
                document.body.appendChild(toast);
            }
        }
    };

    // Cached window dimensions (updated on resize)
    let cachedScreenWidth = window.innerWidth;
    let cachedScreenHeight = window.innerHeight;
    window.addEventListener('resize', () => {
        cachedScreenWidth = window.innerWidth;
        cachedScreenHeight = window.innerHeight;
    }, { passive: true });

    // Dead zone detection (uses cached dimensions)
    const isInDeadZone = (x, y) => {
        const deadZone = settings.DEAD_ZONE_SIZE;
        return x < deadZone ||
            x > cachedScreenWidth - deadZone ||
            y < deadZone ||
            y > cachedScreenHeight - deadZone;
    };

    // Video activity tracking
    const trackVideoActivity = (video) => {
        if (!video || activeVideos.has(video)) return;

        activeVideos.add(video);
        lastActiveTime = Date.now();

        // Attach lifecycle tracking for automatic cleanup
        VideoLifecycle.attach(video);

        // Clear existing timer
        if (videoTimers.has(video)) {
            clearTimeout(videoTimers.get(video));
        }

        // Set cleanup timer
        const timer = setTimeout(() => {
            cleanupVideoTracking(video);
        }, settings.GESTURE_TIMEOUT);

        videoTimers.set(video, timer);

        // Register timer cleanup with lifecycle
        VideoLifecycle.addCleanup(video, () => {
            if (videoTimers.has(video)) {
                clearTimeout(videoTimers.get(video));
                videoTimers.delete(video);
            }
        });

        // Attach Resume Manager
        if (typeof ResumeManager !== 'undefined') {
            ResumeManager.attach(video);
        }

        // Firefox/Android Optimization: Add CSS class for touch-action
        video.classList.add('vg-optimized');
    };

    const cleanupVideoTracking = (video) => {
        activeVideos.delete(video);
        // Remove optimization class
        video.classList.remove('vg-optimized');

        if (videoTimers.has(video)) {
            clearTimeout(videoTimers.get(video));
            videoTimers.delete(video);
        }
    };

    // Inactivity timer management (debounced - only update if >100ms since last)
    let lastInactivityReset = 0;
    const resetInactivityTimer = () => {
        const now = Date.now();
        if (now - lastInactivityReset < 100) return; // Debounce
        lastInactivityReset = now;
        lastActiveTime = now;
    };

    // Haptics
    const vibrate = () => {
        if (settings.HAPTIC_FEEDBACK && navigator.vibrate) {
            try {
                navigator.vibrate(settings.HAPTIC_DURATION);
            } catch (e) {
                // Ignore
            }
        }
    };

    // Video finding cache - with bounded sizes to prevent memory leaks
    const elementCache = new BoundedWeakMap(100); // Most recently accessed elements
    const negativeElementCache = new BoundedWeakMap(200); // Cache for elements confirmed NOT to be videos (larger as this is common)
    const containerCache = new BoundedWeakMap(50); // Video containers
    // Cache for interactive checks to avoid expensive DOM traversal
    const interactiveCache = new BoundedWeakMap(200); // UI elements checked frequently

    // Video finder
    const findVideo = (targetElement, x, y) => {
        try {
            // 0. Negative cache check (Fastest exit)
            if (targetElement && negativeElementCache.has(targetElement)) {
                return null;
            }

            // GECKO OPTIMIZATION: Try to unwrap element to find hidden videos (Firefox/MV2 Feature)
            // Some sites hide video elements behind proxies.
            if (unsafeWindow && unsafeWindow.wrappedJSObject && targetElement) {
                try {
                    const unwrapped = targetElement.wrappedJSObject;
                    if (unwrapped && unwrapped.tagName === 'VIDEO' && isValidVideo(unwrapped, false)) {
                        return { video: unwrapped, container: findContainer(unwrapped) };
                    }
                } catch (e) { }
            }

            // 1. Try fullscreen first (fastest)
            const fsElement = getFullscreenElement();
            if (fsElement) {
                const video = fsElement.querySelector('video');
                if (video && isValidVideo(video)) {
                    return { video, container: fsElement };
                }
            }

            // 2. Check cache for target element
            if (targetElement && elementCache.has(targetElement)) {
                const video = elementCache.get(targetElement);
                if (isValidVideo(video)) {
                    return { video, container: findContainer(video) };
                }
                // Cache invalid, remove it
                elementCache.delete(targetElement);
            }

            // 3. Try standard DOM traversal
            if (targetElement) {
                // Optimization: Check target itself first
                if (targetElement.tagName === 'VIDEO' && isValidVideo(targetElement)) {
                    elementCache.set(targetElement, targetElement);
                    return { video: targetElement, container: findContainer(targetElement) };
                }

                const video = targetElement.closest('video');
                if (video && isValidVideo(video)) {
                    elementCache.set(targetElement, video);
                    return { video, container: findContainer(video) };
                }
            }

            // 4. Try point search with Shadow DOM support (expensive, limit iterations)
            // Optimization: Only do this if we really have to
            if (typeof x === 'number' && typeof y === 'number') {
                const elements = document.elementsFromPoint(x, y);
                // Reduce check count for performance
                const maxCheck = Math.min(elements.length, 5);

                for (let i = 0; i < maxCheck; i++) {
                    const element = elements[i];

                    // Fast path: direct video hit
                    if (element.tagName === 'VIDEO' && isValidVideo(element)) {
                        elementCache.set(targetElement, element);
                        return { video: element, container: findContainer(element) };
                    }

                    if (elementCache.has(element)) {
                        const video = elementCache.get(element);
                        if (isValidVideo(video)) {
                            return { video, container: findContainer(video) };
                        }
                    }

                    const video = element.closest?.('video');
                    if (video && isValidVideo(video)) {
                        elementCache.set(element, video);
                        if (targetElement) elementCache.set(targetElement, video);
                        return { video, container: findContainer(video) };
                    }

                    // Check child videos (limited to first match)
                    const childVideo = element.querySelector?.('video');
                    if (childVideo && isValidVideo(childVideo)) {
                        elementCache.set(element, childVideo);
                        return { video: childVideo, container: findContainer(childVideo) };
                    }

                    // Check shadow roots (rare, expensive)
                    if (element.shadowRoot) {
                        try {
                            const shadowVideo = element.shadowRoot.querySelector('video');
                            if (shadowVideo && isValidVideo(shadowVideo)) {
                                elementCache.set(targetElement, shadowVideo);
                                return { video: shadowVideo, container: findContainer(shadowVideo) };
                            }
                        } catch (e) { /* ignore security errors */ }
                    }
                }
            }

            // 5. Check same-origin iframes for videos
            try {
                const iframes = document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    try {
                        // Only works for same-origin iframes
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (!iframeDoc) continue;

                        // Check if touch point is within iframe bounds
                        const rect = iframe.getBoundingClientRect();
                        if (typeof x === 'number' && typeof y === 'number') {
                            if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                                continue;
                            }
                        }

                        // Find video inside iframe
                        const iframeVideo = iframeDoc.querySelector('video');
                        if (iframeVideo && isValidVideo(iframeVideo)) {
                            elementCache.set(targetElement, iframeVideo);
                            return { video: iframeVideo, container: iframe };
                        }
                    } catch (e) {
                        // Cross-origin iframe - skip silently
                    }
                }
            } catch (e) { /* ignore */ }

            // 6. Fallback: no video found
            if (targetElement) {
                negativeElementCache.set(targetElement, true);
            }
            return null;
        } catch (e) {
            ErrorHandler.report('FindVideo', e, 'warn');
            return null;
        }
    };

    // Video validation - relaxed for better compatibility
    const isValidVideo = (video, strictMode = false) => {
        try {
            if (!video) return false;

            // Strict mode: for resume/save operations (need valid duration)
            // Relaxed mode: for gesture detection (allow loading videos)
            if (strictMode) {
                if (video.readyState < 1) return false;
                if (!Number.isFinite(video.duration)) return false;
            }

            const rect = video.getBoundingClientRect();
            // Relaxed size requirement (50px min for small embedded players)
            if (rect.width < 50 || rect.height < 50) return false;

            // Check if visible
            const style = window.getComputedStyle(video);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            if (parseFloat(style.opacity) < 0.1) return false;

            return true;
        } catch (e) {
            return false;
        }
    };

    const findContainer = (video) => {
        try {
            if (containerCache.has(video)) {
                const container = containerCache.get(video);
                if (container.isConnected) return container;
            }

            const selectors = [
                // Generic players
                '.html5-video-player', '.player', '.video-js', '[data-vjs-player]',
                '.jwplayer', '.flowplayer', '#player-container', '.plyr',
                // kt_player
                '.ktplayer', '.kt-player', '[data-ktplayer]',
                '.ktplayer-container', '.kt-player-wrapper', '.kt-video-wrapper',
                // KVS player v6
                '.kvs-player', '.kvs_player', '[data-kvs-player]',
                '.kvs-player-container', '.kvs-video-wrapper', '#kvs_player',
                // KVS player v7 (uses Flowplayer)
                '[data-flowplayer-instance-id]', '.is-splash', '.is-poster',
                // Vimeo
                '.vp-video-wrapper', '.player_area', '[data-player]',
                // Streamtape
                '.video-container', '#video_container', '.main-video',
                // VK
                '.videoplayer_media', '.VideoPlayer', '.mv_video_box',
                // Mega
                '.video-block', '.viewer-vjs-wrap', '.video-theatre-mode',
                // Google Drive
                '.html5-video-container', '.ndfHFb-c4YZDc',
                // Doodstream (Existing + Enhanced)
                '#video_player', '.vjs-dood', '.dood-player', 'div[class*="dood"] > video',
                // Other common patterns
                '.media-player', '.embed-player', '.video-embed',
                '[class*="player"]', '[class*="video-container"]'
            ];

            for (const selector of selectors) {
                const container = video.closest(selector);
                if (container) {
                    containerCache.set(video, container);
                    handleDoodstreamOverlays(video, container);
                }
            }

            const parent = video.parentElement || document.body;
            return video.closest?.(selectors.join(',')) || video.parentElement || video;
        } catch (e) {
            return video.parentElement || document.body;
        }
    };

    // --- Video Scoring & Deep Scanning ---
    const scoreVideo = (v) => {
        try {
            const rect = v.getBoundingClientRect();
            const area = rect.width * rect.height;
            const isVisible = area > 0 && rect.top < window.innerHeight && rect.bottom > 0;
            if (!isVisible) return -1;

            let score = area;
            if (!v.paused) score *= 3; // Massive boost for playing
            if (v.readyState > 0) score *= 1.2;
            if (v.ended) score *= 0.5;

            // Boost for Fullscreen
            if (document.fullscreenElement && (document.fullscreenElement === v || document.fullscreenElement.contains(v))) {
                score *= 5;
            }

            return score;
        } catch (e) { return 0; }
    };

    // Recursive helper to find all videos including Shadow DOM
    const deepScanVideos = (root = document) => {
        let videos = [];
        try {
            // 1. Standard Query
            const standard = Array.from(root.querySelectorAll('video'));
            videos.push(...standard);

            // 2. Shadow DOM Scan (Queue-based mostly for performance)
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
                acceptNode: (node) => node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
            });

            while (walker.nextNode()) {
                const node = walker.currentNode;
                if (node.shadowRoot) {
                    const shadowVideos = Array.from(node.shadowRoot.querySelectorAll('video'));
                    videos.push(...shadowVideos);
                    // Note: We don't recurse deeply into nested shadows to avoid infinite loops/perf hits,
                    // unless we use a recursive function. This 1-level deep is usually enough for Web Components.
                }
            }
        } catch (e) { ErrorHandler.report('DeepScanVideos', e, 'warn'); }

        return videos;
    };

    const getBestVideo = () => {
        const videos = deepScanVideos();
        if (videos.length === 0) return null;
        if (videos.length === 1) return videos[0];

        let best = null;
        let maxScore = -1;

        videos.forEach(v => {
            const score = scoreVideo(v);
            if (score > maxScore) {
                maxScore = score;
                best = v;
            }
        });

        return best || videos[0];
    };


    const handleDoodstreamOverlays = (video, container) => {
        if (!window.location.hostname.includes('dood')) return;

        // Anti-Anti-Debugger: Prevent console clearing
        if (window.console && console.clear) {
            try { console.clear = () => { }; } catch (e) { }
        }

        // Strategy 1: CSS Injection - Global and Persistent
        // Force clicks to fall through high z-index layers except controls
        const cssId = 'start-overlay-buster'; // Generic name to avoid detection
        if (!document.getElementById(cssId)) {
            const style = document.createElement('style');
            style.id = cssId;
            style.textContent = `
                    /* Allow clicks to pass through high z-index layers to the video */
                    div[style*="z-index"] { pointer-events: none !important; }

                    /* But restore interactions for controls and modals */
                    .vjs-control-bar, .vjs-modal-dialog,
                    .vjs-control, .vjs-button,
                    .dood-control-bar, [class*="control"] {
                        pointer-events: auto !important;
                    }
                `;
            (document.head || document.documentElement).appendChild(style);
        }

        // Strategy 2: MutationObserver - Watch for new ad injections
        if (!container.dataset.overlayWatched) {
            container.dataset.overlayWatched = 'true';

            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1 && node.tagName === 'DIV') {
                            const style = window.getComputedStyle(node);
                            // If it covers the screen and isn't controls
                            if (parseInt(style.zIndex) > 10 &&
                                !node.classList.contains('vjs-control-bar')) {
                                node.style.pointerEvents = 'none';
                            }
                        }
                    }
                }
            });

            observer.observe(container, { childList: true, subtree: true });
        }
    };

    // Get video viewport (iframe-aware and fullscreen-aware)
    const getVideoViewport = (video) => {
        if (!video) {
            return { isIframe: false, left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, element: document.body };
        }

        // Check if in fullscreen mode
        // Use unified FullscreenAPI
        const fullscreenElement = FullscreenAPI.element;
        if (fullscreenElement) {
            // Always use fixed positioning for fullscreen mode
            return {
                isIframe: false,
                left: 0,
                top: 0,
                width: window.innerWidth,
                height: window.innerHeight,
                element: document.body
            };
        }

        // Check if video is in an iframe (multiple detection methods)
        let frameElement = null;

        // Method 1: Direct frameElement access
        try {
            frameElement = video.ownerDocument?.defaultView?.frameElement;
        } catch (e) {
            // Cross-origin iframe - frameElement access blocked
        }

        // DEBUG: Log iframe detection results
        const isInIframe = window.self !== window.top;

        // Method 2: Check if we're in a different window context
        if (!frameElement && window.self !== window.top) {
            // We're in an iframe but can't access frameElement (cross-origin)
            // Use window dimensions as iframe dimensions
            return {
                isIframe: true,
                left: 0,
                top: 0,
                width: window.innerWidth,
                height: window.innerHeight,
                element: document.body
            };
        }

        // Method 3: Use accessible frameElement
        if (frameElement) {
            const rect = frameElement.getBoundingClientRect();
            return {
                isIframe: true,
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                element: frameElement.parentElement || document.body
            };
        }

        // Check if video is inside specific container elements that should be treated as viewport boundaries
        const containerSelectors = [
            // Plyr-specific containers (priority)
            '.plyr',
            '[data-plyr]',
            '.plyr__video-wrapper',
            // Generic player containers
            '.player-holder',
            '.player-warp',
            '#player-holder',
            '#player-warp',
            '#video-id',
            '.video-id',
            '[id*="player-holder"]',
            '[id*="player-warp"]',
            '[class*="player-holder"]',
            '[class*="player-warp"]',
            // Doodstream specific
            '.dood-player',
            '#video_player',
            '.vjs-dood'
        ];

        for (const selector of containerSelectors) {
            try {
                const container = video.closest(selector);
                if (container) {
                    const rect = container.getBoundingClientRect();

                    // Check if we're in an iframe context OR it's a Plyr container
                    const isInIframe = window.self !== window.top;
                    const isPlyrContainer = selector === '.plyr' || selector === '[data-plyr]' || selector === '.plyr__video-wrapper';

                    // For iframes or Plyr, always use container bounds regardless of size
                    // For others, only treat as custom viewport if significantly smaller than window
                    const shouldUseContainer = isInIframe || isPlyrContainer ||
                        (rect.width < window.innerWidth * 0.95 || rect.height < window.innerHeight * 0.95);

                    if (shouldUseContainer) {
                        return {
                            isIframe: true, // Use absolute positioning
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height,
                            element: container
                        };
                    }
                }
            } catch (e) {
                // Selector might be invalid, continue
            }
        }

        // Default viewport (no special container)
        return {
            isIframe: false,
            left: 0,
            top: 0,
            width: window.innerWidth,
            height: window.innerHeight,
            element: document.body
        };
    };

    // --- Desktop Mode Module (Mouse & Keyboard) ---
    const DesktopMode = (() => {
        let speedTimer = null;
        let rampRaf = null;
        let isSpeeding = false;
        let originalRate = 1.0;
        let activeVideo = null;

        // Smooth Speed Ramp (from start to end over duration)
        const rampSpeed = (video, targetRate, duration = 300) => {
            if (!video) return;

            const startRate = video.playbackRate;
            const startTime = performance.now();

            if (rampRaf) cancelAnimationFrame(rampRaf);

            const animate = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out cubic
                const ease = 1 - Math.pow(1 - progress, 3);

                const current = startRate + (targetRate - startRate) * ease;
                video.playbackRate = current;

                if (progress < 1) {
                    rampRaf = requestAnimationFrame(animate);
                } else {
                    video.playbackRate = targetRate; // Ensure final exact value
                    rampRaf = null;
                }
            };

            rampRaf = requestAnimationFrame(animate);
        };

        const handlePointerDown = (e) => {
            // Only Mouse, Left Button
            if (e.pointerType !== 'mouse' || e.button !== 0) return;

            // Skip if clicking on actual controls, but allow Plyr poster/overlay play button
            if (e.target.tagName !== 'VIDEO' && isInteractive(e.target)) {
                // Exception: Plyr poster and center play button should still trigger long-press
                const isPlyrPlayableArea = e.target.classList?.contains('plyr__poster') ||
                    e.target.classList?.contains('plyr__control--overlaid') ||
                    e.target.closest?.('.plyr__poster, .plyr__control--overlaid');
                if (!isPlyrPlayableArea) return;
            }

            // Try multiple detection strategies for custom players
            let result = findVideo(e.target, e.clientX, e.clientY);

            // Fallback: check if target is inside a known player container
            if (!result?.video) {
                const container = e.target.closest('.plyr, .video-js, .jwplayer, .html5-video-player, .ktplayer, .kt-player, .kvs-player, .kvs_player, .flowplayer, [data-plyr], [data-ktplayer], [data-kvs-player], [data-flowplayer-instance-id]');
                if (container) {
                    // For Plyr, video is often inside .plyr__video-wrapper
                    // For kt_player, video might be in .kt-video-wrapper
                    // For KVS player, video might be in .kvs-video-wrapper
                    // For Flowplayer/KVS v7, video is inside .fp-player
                    const video = container.querySelector('.plyr__video-wrapper video, .kt-video-wrapper video, .kvs-video-wrapper video, .fp-player video, video');
                    if (video && isValidVideo(video)) {
                        result = { video, container };
                    }
                }
            }

            if (!result?.video) return;

            activeVideo = result.video;
            originalRate = result.video.playbackRate;

            // Update video context for iframe-aware positioning
            currentVideoContext = getVideoViewport(result.video);

            // Long Press Timer
            speedTimer = setTimeout(() => {
                isSpeeding = true;
                // Save rate again just in case it changed
                originalRate = Math.min(activeVideo.playbackRate, 1.5);
                if (originalRate > 1.9) originalRate = 1.0;

                rampSpeed(activeVideo, settings.LONG_PRESS_SPEED, 400);
                showIndicator('forward', `${settings.LONG_PRESS_SPEED}x Speed`, 'speed', true, null, activeVideo);
                if (navigator.vibrate) navigator.vibrate(50);
            }, settings.LONG_PRESS_DURATION);

            // We don't stop propagation here to allow clicking play/pause normally if short click
        };

        const handlePointerUp = (e) => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return;

            clearTimeout(speedTimer);

            if (isSpeeding && activeVideo) {
                isSpeeding = false;
                rampSpeed(activeVideo, 1.0, 300); // Ramp back to 1x (or originalRate if we tracked it robustly)
                hideIndicator();
                if (navigator.vibrate) navigator.vibrate(30);

                // Prevent click (Play/Pause) if we were speeding?
                // Usually the 'click' event fires after mouseup.
                // modifying e.preventDefault here might not stop 'click'.
                // But native behaviors usually fine.
            }
            activeVideo = null;
        };

        const handleKeyDown = (e) => {
            // Ignore if typing in input
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) return;

            // Settings hotkey: 's' key (when focus is on webpage, not input elements)
            if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                SettingsUI.toggle();
                return;
            }

            const key = e.key.toLowerCase();

            // Use global getBestVideo helper
            const video = getBestVideo();
            if (!video) return;

            // Arrow Up / Arrow Down (Volume)
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                if (video) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();

                    const newVolume = e.key === 'ArrowUp' ? Math.min(video.volume + 0.1, 1) : Math.max(video.volume - 0.1, 0);
                    video.volume = newVolume;
                    video.muted = newVolume === 0;
                    showToast('volume-up', `Volume ${Math.round(newVolume * 100)}%`, 1000, null, video);
                }
            }

            if (key === 'm') {
                if (video) {
                    // Stop site from handling it
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();

                    video.muted = !video.muted;
                    showToast(video.muted ? 'volume-off' : 'volume-up', video.muted ? 'Muted' : 'Unmuted', 1000, null, video);
                }
            }

            // Arrow Keys (Streak Seek)
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                if (video) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();

                    applySeekWithStreak(video, e.key === 'ArrowLeft' ? 'backward' : 'forward');
                }
            }
        };

        const init = () => {
            document.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true });
            document.addEventListener('pointerup', handlePointerUp, { capture: true, passive: true });
            document.addEventListener('keydown', handleKeyDown, { capture: true }); // Capture to override site shortcuts if needed
        };

        const cleanup = () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('pointerup', handlePointerUp, true);
            document.removeEventListener('keydown', handleKeyDown, true);
        };

        return { init, cleanup };
    })();

    // --- Subtitle Manager Module ---
    // --- Subtitle Manager Module (Simplified) ---
    const SubtitleManager = (() => {
        let cues = [];
        let overlay = null;
        let fileInput = null;
        let activeVideo = null;
        let isVisible = true;
        let isEnabled = false;
        let timeUpdateHandler = null;
        let lastCue = null;
        let currentFileName = null;
        let currentFontSize = settings.SUB_FONT_SIZE || 16;

        const reset = () => {
            cues = [];
            isEnabled = false;
            currentFileName = null;
            if (overlay) {
                overlay.textContent = '';
                overlay.style.display = 'none';
            }
        };

        const parseTime = (t) => {
            const parts = t.split(':');
            let seconds = 0;
            if (parts.length === 3) {
                seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2].replace(',', '.'));
            } else if (parts.length === 2) {
                seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1].replace(',', '.'));
            }
            return seconds;
        };

        const isRTL = (s) => /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(s);

        const parseSRT = (text) => {
            text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const regex = /(\d+)\n(\d{2}:\d{2}:\d{2}[,.]\d{3}) --> (\d{2}:\d{2}:\d{2}[,.]\d{3})\n([\s\S]*?)(?=\n\n|\n$|$)/g;
            const parsed = [];
            let match;
            while ((match = regex.exec(text)) !== null) {
                parsed.push({
                    start: parseTime(match[2]),
                    end: parseTime(match[3]),
                    text: match[4].trim()
                });
            }
            return parsed;
        };

        const createOverlay = () => {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'vg-subtitle-overlay hidden';
                overlay.style.fontSize = `${currentFontSize}px`;
            }
        };

        const handleFile = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (evt) => {
                const text = evt.target.result;
                cues = parseSRT(text);
                currentFileName = file.name;

                isEnabled = true;
                isVisible = true;
                showToast('check-circle', 'Subtitles Loaded');

                createOverlay();
                if (!activeVideo) activeVideo = findActiveVideo();

                if (activeVideo && overlay) {
                    // Support for Plyr and standard players
                    const container = activeVideo.closest('.plyr') || activeVideo.parentNode;
                    if (container && !container.contains(overlay)) {
                        container.appendChild(overlay);
                    }
                    overlay.classList.remove('hidden');
                    attachToVideo(activeVideo);
                }

                // Link to resume data
                setTimeout(() => {
                    const vid = activeVideo || findActiveVideo();
                    if (vid && ResumeManager) ResumeManager.saveProgress(vid);
                }, 500);

                updateSubtitle();
            };
            reader.readAsText(file);
            // Reset input so same file can be selected again
            e.target.value = '';
        };

        const init = () => {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.srt,.vtt';
            fileInput.style.display = 'none';
            fileInput.addEventListener('change', handleFile);
            document.body.appendChild(fileInput);
            createOverlay();

            document.addEventListener('keydown', (e) => {
                if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) return;
                const key = e.key.toLowerCase();

                // 'u' - Upload Subtitle
                if (key === 'u') {
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    const video = activeVideo || findActiveVideo();
                    // Check if we have a saved subtitle to suggest?
                    // Simplified: Just open file picker.
                    if (fileInput) fileInput.click();
                    return;
                }

                // 'd' - Delete/Unlink
                if (key === 'd') {
                    e.preventDefault();
                    const v = findActiveVideo();
                    if (v) {
                        if (ResumeManager) ResumeManager.clearSubtitle(v);
                        reset();
                        showToast('trash', 'Subtitle Unlinked', 2000);
                    }
                    return;
                }

                // 'h' - Toggle Visibility
                if (key === 'h') {
                    e.preventDefault();
                    if (!isEnabled) {
                        showToast('upload', 'Upload Subtitle First (U)');
                        return;
                    }
                    isVisible = !isVisible;
                    if (overlay) {
                        overlay.style.visibility = isVisible ? 'visible' : 'hidden';
                        showToast(isVisible ? 'cc-filled' : 'cc-outline', isVisible ? 'Subs Shown' : 'Subs Hidden');
                    }
                    return;
                }

                // Font Size
                if (key === '=' || key === '+' || key === '-' || key === '_') {
                    e.preventDefault();
                    if (!isEnabled) return;

                    const diff = (key === '=' || key === '+') ? 2 : -2;
                    currentFontSize = Math.max(10, currentFontSize + diff);
                    if (overlay) overlay.style.fontSize = `${currentFontSize}px`;
                    settings.SUB_FONT_SIZE = currentFontSize;
                    saveConfig();
                    showToast(diff > 0 ? 'plus' : 'minus', `Size: ${currentFontSize}px`);
                    return;
                }

            }, { capture: true });
        };

        // Helper to find video (mapped to global helper)
        const findActiveVideo = getBestVideo;

        const attachToVideo = (video) => {
            if (activeVideo && activeVideo !== video) {
                activeVideo.removeEventListener('timeupdate', updateSubtitle);
            }
            activeVideo = video;
            activeVideo.removeEventListener('timeupdate', updateSubtitle);
            activeVideo.addEventListener('timeupdate', updateSubtitle);

            // Ensure overlay is in DOM
            createOverlay();
            const container = video.closest('.plyr') || video.parentNode;
            if (container && overlay && !container.contains(overlay)) {
                container.appendChild(overlay);
            }
        };

        const updateSubtitle = () => {
            if (!activeVideo || !cues.length || !isVisible || !overlay) return;

            const t = activeVideo.currentTime;
            const activeCue = cues.find(c => t >= c.start && t <= c.end);

            if (activeCue) {
                if (activeCue !== lastCue) {
                    setInnerHTML(overlay, activeCue.text.replace(/\n/g, '<br>'));
                    overlay.style.direction = isRTL(activeCue.text) ? 'rtl' : 'ltr';
                    overlay.style.display = 'block';
                    lastCue = activeCue;
                }
            } else {
                overlay.style.display = 'none';
                lastCue = null;
            }

            // Fullscreen Re-parent check
            const fs = FullscreenAPI.element;
            if (fs && !fs.contains(overlay)) fs.appendChild(overlay);
        };

        const getCurrentInfo = () => ({
            fileName: currentFileName,
            fontSize: currentFontSize,
            hasSubs: cues.length > 0
        });

        return { init, getCurrentInfo };
    })();

    // --- Resume Manager Module (Simplified) ---
    const ResumeManager = (() => {
        let resumeData = {};
        const SAVE_KEY = 'vg_resume_data';
        const RESUME_EXPIRY_DAYS = 30;
        let isDataLoaded = false;
        let saveTimeout = null;
        const videoState = new WeakMap();
        const pendingAttachQueue = []; // Queue for videos trying to attach before data loads
        let isIncognito = false; // Track if we're in incognito mode
        const videoIdCache = new WeakMap(); // Cache video IDs to avoid repeated btoa() calls
        const pageLoadTime = Date.now(); // Unique identifier for this page load

        // Detect incognito/private browsing mode
        const detectIncognito = async () => {
            try {
                // Method 1: Try to use FileSystem API (fails in incognito)
                if ('storage' in navigator && 'estimate' in navigator.storage) {
                    const estimate = await navigator.storage.estimate();
                    // In incognito, quota is usually much smaller
                    if (estimate.quota < 120000000) { // Less than ~120MB suggests incognito
                        return true;
                    }
                }

                // Method 2: Check if persistent storage is available
                if (navigator.storage && navigator.storage.persisted) {
                    const isPersisted = await navigator.storage.persisted();
                    if (!isPersisted) {
                        // Try requesting persistence
                        const canPersist = await navigator.storage.persist();
                        if (!canPersist) {
                            return true; // Likely incognito
                        }
                    }
                }

                // Method 3: SessionStorage availability (always available, but indicates we need fallback)
                return false;
            } catch (e) {
                // If we can't detect, assume normal mode
                return false;
            }
        };

        // Constants for video type detection
        const MAX_VIDEO_DURATION = 18000; // 5 hours in seconds (anything longer is likely live/DVR)
        const MIN_VIDEO_DURATION = 60; // 1 minute minimum

        // Generate a unique key (CACHED for performance)
        const getVideoId = (video) => {
            // Check cache first
            if (videoIdCache.has(video)) {
                const cached = videoIdCache.get(video);
                // Verify duration hasn't changed significantly (invalidates cache)
                if (Math.abs(cached.duration - video.duration) < 1) {
                    return cached.id;
                }
            }

            try {
                const duration = video.duration;

                // Skip live streams and DVR content
                if (!isFinite(duration) || duration === 0) {
                    // Infinite duration or not yet loaded
                    return null;
                }

                if (duration > MAX_VIDEO_DURATION) {
                    // Very long video - likely live stream with DVR or very long VOD
                    console.log('[SuperVideo] Skipping resume for very long video (possible live/DVR):', duration);
                    return null;
                }

                if (duration < MIN_VIDEO_DURATION) {
                    // Too short - likely preview/ad/short clip
                    return null;
                }

                const url = window.location.href.split('#')[0].split('?')[0];
                const durationRounded = Math.round(duration);
                const id = `v1:${btoa(url)}:${durationRounded}`;

                // Cache the result
                videoIdCache.set(video, { id, duration: durationRounded });

                return id;
            } catch (e) {
                return null;
            }
        };


        // Validate resume entry schema to prevent crashes from corrupted data
        const validateResumeEntry = (entry) => {
            if (!entry || typeof entry !== 'object') return false;

            // Required fields
            if (typeof entry.resumeTime !== 'number' || !isFinite(entry.resumeTime)) return false;
            if (typeof entry.duration !== 'number' || !isFinite(entry.duration)) return false;
            if (typeof entry.timestamp !== 'number' || !isFinite(entry.timestamp)) return false;

            // Sanity checks
            if (entry.resumeTime < 0 || entry.resumeTime > entry.duration) return false;
            if (entry.duration < MIN_VIDEO_DURATION || entry.duration > MAX_VIDEO_DURATION) return false;
            if (entry.timestamp > Date.now() + 86400000) return false; // Future timestamp = corrupted

            return true;
        };

        const loadData = async () => {
            try {
                // Detect incognito mode first
                isIncognito = await detectIncognito();
                if (isIncognito) {
                    console.log('[SuperVideo] Incognito mode detected - using hybrid storage strategy');
                }

                // Try loading from GM storage first
                resumeData = await safeGMGet(SAVE_KEY, {});

                // In incognito mode, also try loading from sessionStorage as fallback
                if (isIncognito) {
                    try {
                        const sessionData = sessionStorage.getItem(SAVE_KEY);
                        if (sessionData) {
                            const parsed = JSON.parse(sessionData);
                            // Merge session data with GM data (session data takes precedence as it's more recent)
                            resumeData = { ...resumeData, ...parsed };
                        }
                    } catch (e) {
                        // SessionStorage might be disabled, continue
                    }
                }

                // CRITICAL: Validate all loaded entries and remove corrupted ones
                let validationCleaned = false;
                Object.keys(resumeData).forEach(key => {
                    if (!validateResumeEntry(resumeData[key])) {
                        console.warn('[SuperVideo] Removing corrupted resume entry:', key);
                        delete resumeData[key];
                        validationCleaned = true;
                    }
                });

                // Cleanup old entries (after validation)
                const now = Date.now();
                const expiryMs = RESUME_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
                let expiryCleaned = false;
                Object.keys(resumeData).forEach(key => {
                    if (now - (resumeData[key].timestamp || 0) > expiryMs) {
                        delete resumeData[key];
                        expiryCleaned = true;
                    }
                });

                // Save if any cleanup occurred
                if (validationCleaned || expiryCleaned) {
                    console.log(`[SuperVideo] Cleaned ${validationCleaned ? 'corrupted' : ''} ${expiryCleaned ? 'expired' : ''} entries`);
                    saveData();
                }

                isDataLoaded = true;

                // Process pending attach queue
                console.log(`[SuperVideo] ResumeManager loaded, processing ${pendingAttachQueue.length} queued videos`);
                while (pendingAttachQueue.length > 0) {
                    const video = pendingAttachQueue.shift();
                    if (video && video.isConnected) { // Check if still in DOM
                        attachInternal(video);
                    }
                }
            } catch (e) {
                console.error('[SuperVideo] Resume Load Error', e);
                resumeData = {};
                isDataLoaded = true; // Set to true anyway to prevent infinite queuing
            }
        };

        let hasUnsavedChanges = false; // Track if there are unsaved changes
        let lastSaveTime = 0; // Track when we last saved

        const saveData = async () => {
            try {
                await safeGMSet(SAVE_KEY, resumeData);

                // In incognito mode, also save to sessionStorage for session persistence
                if (isIncognito) {
                    try {
                        sessionStorage.setItem(SAVE_KEY, JSON.stringify(resumeData));
                    } catch (e) {
                        console.warn('[SuperVideo] SessionStorage save failed', e);
                    }
                }

                hasUnsavedChanges = false;
                lastSaveTime = Date.now();
            } catch (e) {
                console.error('[SuperVideo] Async save failed', e);
            }
        };

        // Synchronous fallback for beforeunload (uses localStorage as backup)
        const saveDataSync = () => {
            try {
                // First, try to save via GM (it might work synchronously in some browsers)
                if (typeof GM_setValue !== 'undefined') {
                    try {
                        GM_setValue(SAVE_KEY, JSON.stringify(resumeData));
                        hasUnsavedChanges = false;
                    } catch (e) { }
                }

                // Always save to sessionStorage in incognito mode
                if (isIncognito) {
                    try {
                        sessionStorage.setItem(SAVE_KEY, JSON.stringify(resumeData));
                        hasUnsavedChanges = false;
                    } catch (e) { }
                }

                // Fallback to localStorage (synchronous)
                try {
                    localStorage.setItem(SAVE_KEY + '_backup', JSON.stringify(resumeData));
                    hasUnsavedChanges = false;
                } catch (e) {
                    console.error('[SuperVideo] Sync save failed', e);
                }
            } catch (e) {
                console.error('[SuperVideo] Sync save failed', e);
            }
        };

        // Get the top-level window title (parent page, not iframe)
        const getPageTitle = () => {
            try {
                // Try to get the top window title (parent page)
                if (window.top && window.top !== window) {
                    try {
                        // This might fail due to cross-origin restrictions
                        return window.top.document.title || document.title;
                    } catch (e) {
                        // Cross-origin iframe - try to use window.name or fallback
                        // If we can't access parent, use current document title
                        return document.title;
                    }
                }
                // Not in iframe, use current title
                return document.title;
            } catch (e) {
                return document.title;
            }
        };

        const saveProgress = (video) => {
            // CRITICAL: Check if resume feature is enabled
            if (!settings.RESUME_PLAYBACK) return;
            if (!isDataLoaded || !video.duration) return;
            const time = video.currentTime;

            // Use percentage-based boundaries instead of fixed seconds
            // Skip first 5% and last 5% of video to avoid saving at very start/end
            const startBoundary = video.duration * 0.05; // 5% from start
            const endBoundary = video.duration * 0.95;   // 5% from end

            // Also enforce minimum absolute boundaries for very short videos
            const minStartBoundary = Math.max(startBoundary, 3); // At least 3 seconds
            const maxEndBoundary = Math.min(endBoundary, video.duration - 3); // At least 3 seconds from end

            if (time < minStartBoundary || time > maxEndBoundary) return;

            const id = getVideoId(video);
            if (!id) return;

            resumeData[id] = {
                resumeTime: time,
                timestamp: Date.now(),
                title: getPageTitle(), // Get parent page title, not iframe title
                duration: video.duration
            };

            hasUnsavedChanges = true; // Mark that we have unsaved changes

            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveData, 2000);
        };

        const checkResume = (video) => {
            // Check if resume feature is enabled
            if (!settings.RESUME_PLAYBACK) {
                console.log('[SuperVideo] Resume disabled in settings');
                return;
            }

            const id = getVideoId(video);
            console.log('[SuperVideo] CheckResume - Video ID:', id);

            if (!id) {
                console.log('[SuperVideo] No video ID generated');
                return;
            }

            if (!resumeData[id]) {
                console.log('[SuperVideo] No resume data for ID:', id);
                console.log('[SuperVideo] Available resume keys:', Object.keys(resumeData));
                return;
            }

            const saved = resumeData[id];
            const time = saved.resumeTime;

            console.log('[SuperVideo] Resume data found:', { time, currentTime: video.currentTime, duration: video.duration });

            // Check if user previously dismissed this resume prompt (for THIS page load only)
            const dismissKey = `${id}_dismissed_${pageLoadTime}`;
            if (sessionStorage.getItem(dismissKey)) {
                console.log('[SuperVideo] Resume dismissed this session');
                return; // User dismissed it this session, don't ask again
            }


            if (time > 5 && Math.abs(video.currentTime - time) > 5) {
                // Check if auto-resume is enabled
                if (settings.AUTO_RESUME) {
                    // Auto-resume: just apply and show undo toast
                    console.log('[SuperVideo] Auto-resuming to', formatTime(time));
                    video.currentTime = time;
                    video.play().catch(() => { });

                    // Show undo toast directly
                    showResumeToast('undo', 'Undo Resume', 10000, () => {
                        video.currentTime = 0;
                        video.pause();
                    });
                } else {
                    // Manual resume: show prompt with auto-dismiss
                    let resumeToastDismissed = false;
                    let resumeApplied = false;

                    // Auto-dismiss handlers
                    const autoDismissOnPlay = () => {
                        if (!resumeApplied && !resumeToastDismissed) {
                            hideToast();
                            resumeToastDismissed = true;
                            cleanup();
                        }
                    };

                    const autoDismissOnSeek = () => {
                        if (!resumeApplied && !resumeToastDismissed) {
                            hideToast();
                            resumeToastDismissed = true;
                            // User seeked manually, mark as dismissed for session
                            sessionStorage.setItem(dismissKey, 'true');
                            cleanup();
                        }
                    };

                    const cleanup = () => {
                        video.removeEventListener('play', autoDismissOnPlay);
                        video.removeEventListener('playing', autoDismissOnPlay);
                        video.removeEventListener('seeked', autoDismissOnSeek);
                    };

                    // Add auto-dismiss listeners
                    video.addEventListener('play', autoDismissOnPlay, { once: true });
                    video.addEventListener('playing', autoDismissOnPlay, { once: true });
                    video.addEventListener('seeked', autoDismissOnSeek, { once: true });

                    // Show resume prompt (reduced to 4 seconds for less blocking)
                    showResumeToast('play', `Resume ${formatTime(time)}?`, 4000, () => {
                        resumeApplied = true;
                        cleanup(); // Remove auto-dismiss listeners

                        video.currentTime = time;
                        video.play().catch(() => { });

                        // "Undo" capability - EXTENDED to 10 seconds
                        showResumeToast('undo', 'Undo Resume', 10000, () => {
                            video.currentTime = 0;
                            video.pause();
                        });
                    });

                    // If toast is manually dismissed (not from auto-dismiss), mark as dismissed
                    setTimeout(() => {
                        if (!resumeApplied && !resumeToastDismissed) {
                            // User manually waited out the toast without clicking
                            sessionStorage.setItem(dismissKey, 'true');
                            cleanup();
                        }
                    }, 4000);
                }
            }
        };

        // Internal attach function (called after data is loaded)
        const attachInternal = (video) => {
            // CRITICAL: Detach existing listeners first to prevent memory leak
            // This handles cases where attach is called multiple times on same video
            if (videoState.has(video)) {
                console.warn('[SuperVideo] Video already attached, detaching first to prevent memory leak');
                detach(video);
            }

            const pauseHandler = () => saveProgress(video);

            // Use setInterval instead of throttled timeupdate for better performance
            // Saves progress every 5 seconds while playing
            const saveInterval = setInterval(() => {
                if (!video.paused && video.currentTime > 0) {
                    saveProgress(video);
                }
            }, 5000);

            // Metadata handler for resume check (stored for cleanup)
            const metadataHandler = () => checkResume(video);

            // Duration change handler - retry resume check when duration loads
            let durationRetryAttempted = false;
            const durationChangeHandler = () => {
                if (!durationRetryAttempted) {
                    const id = getVideoId(video);
                    if (id && resumeData[id]) {
                        // Duration is now available, retry resume check
                        console.log('[SuperVideo] Duration loaded, retrying resume check');
                        checkResume(video);
                        durationRetryAttempted = true;
                    }
                }
            };

            video.addEventListener('pause', pauseHandler);
            video.addEventListener('durationchange', durationChangeHandler);

            // Check resume
            if (video.readyState >= 1 && video.duration > 0) {
                checkResume(video);
            } else {
                video.addEventListener('loadedmetadata', metadataHandler, { once: true });
            }

            // Store all handlers for cleanup
            videoState.set(video, {
                saveInterval,
                pauseHandler,
                metadataHandler,
                durationChangeHandler,
                isAttached: true
            });
        };

        // Public attach function (queues if data not loaded yet)
        const attach = (video) => {
            if (!video) return;

            if (isDataLoaded) {
                attachInternal(video);
            } else {
                // Queue for later processing
                if (!pendingAttachQueue.includes(video)) {
                    pendingAttachQueue.push(video);
                }
            }
        };

        const detach = (video) => {
            const handlers = videoState.get(video);
            if (handlers) {
                // Clear interval instead of removing timeupdate listener
                if (handlers.saveInterval) {
                    clearInterval(handlers.saveInterval);
                }

                // Remove all event listeners
                video.removeEventListener('pause', handlers.pauseHandler);

                // Also remove metadata listener if it wasn't triggered yet
                if (handlers.metadataHandler) {
                    video.removeEventListener('loadedmetadata', handlers.metadataHandler);
                }
                // Remove durationchange listener
                if (handlers.durationChangeHandler) {
                    video.removeEventListener('durationchange', handlers.durationChangeHandler);
                }
                videoState.delete(video);
            }
        };

        // Automatic cleanup for videos removed from DOM (prevents memory leaks)
        const cleanupDisconnectedVideos = () => {
            // Note: WeakMap doesn't have iteration, so we maintain a separate tracking mechanism
            // This is called periodically to clean up videos that are no longer in the DOM
            const videos = document.querySelectorAll('video');
            const connectedVideos = new Set(videos);

            // We can't iterate WeakMap, but we can check videos we encounter
            // For now, we rely on proper detach calls and the WeakMap garbage collection
            // The key fix is preventing duplicate attachments above
        };

        const init = async () => {
            await loadData();
            document.querySelectorAll('video').forEach(attach);

            // Periodic cleanup every 30 seconds to catch any edge cases
            setInterval(() => {
                // Re-check all videos and attach any new ones
                document.querySelectorAll('video').forEach(video => {
                    // Only attach if not already attached
                    if (!videoState.has(video)) {
                        attach(video);
                    }
                });
            }, 30000);
        };

        // Improved force save - always saves if there are unsaved changes
        const forceSave = () => {
            // Clear pending timeout if exists
            if (saveTimeout) {
                clearTimeout(saveTimeout);
                saveTimeout = null;
            }

            // Save if there are unsaved changes OR if save was pending
            if (hasUnsavedChanges) {
                console.log('[SuperVideo] Force saving resume data');
                // Use sync save for reliability (e.g., during beforeunload)
                saveDataSync();
            }
        };

        // Stub for compatibility
        const clearSubtitle = () => { };
        const getResumeEntry = (video) => { const id = getVideoId(video); return id ? resumeData[id] : null; };
        const toggleSiteResume = () => { }; // Removed feature for simplicity
        const isResumeEnabledForSite = () => true;

        return {
            init,
            attach,
            detach,
            saveProgress,
            getResumeEntry,
            clearSubtitle,
            forceSave,
            saveDataSync, // Expose for beforeunload
            toggleSiteResume,
            isResumeEnabledForSite,
            getVideoId
        };
    })();

    // Gesture state
    let gestureState = null;
    let lastTap = { time: 0, count: 0 };
    let seekStreak = { value: 0, timer: null, type: null }; // Accumulative seek state
    let longPressTimer = null;
    let inactivityTimer = null;

    // Pinch gesture state
    let pinchState = null;
    let pinchGestureActive = false;
    const PINCH_MIN_DISTANCE = 50; // Minimum distance between fingers

    // Pinch gesture handlers
    const handlePinchStart = (e) => {
        try {
            if (!getFullscreenElement()) {
                return;
            }

            if (e.touches.length !== 2) return;

            const touch1 = e.touches[0];
            const touch2 = e.touches[1];

            const result = findVideo(e.target,
                (touch1.clientX + touch2.clientX) / 2,
                (touch1.clientY + touch2.clientY) / 2
            );

            if (!result?.video) {
                return;
            }

            // Prevent conflicts with single-touch gestures
            if (gestureState) {
                clearTimeout(longPressTimer);
                gestureState = null;
            }

            e.preventDefault();
            e.stopPropagation();

            const initialDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );

            if (initialDistance < PINCH_MIN_DISTANCE) {
                return;
            }

            pinchState = {
                video: result.video,
                container: result.container,
                initialDistance,
                currentDistance: initialDistance,
                startTime: Date.now(),
                touch1: { x: touch1.clientX, y: touch1.clientY },
                touch2: { x: touch2.clientX, y: touch2.clientY },
                hasTriggered: false,
                aspectRatio: getCurrentAspectRatio(result.video)
            };

            pinchGestureActive = true;

            // Track video activity
            trackVideoActivity(result.video);
            resetInactivityTimer();

        } catch (e) {
            ErrorHandler.report('PinchGesture:Start', e, 'error');
        }
    };

    const handlePinchMove = (e) => {
        try {
            if (!pinchState || e.touches.length !== 2) return;

            e.preventDefault();
            e.stopPropagation();

            const touch1 = e.touches[0];
            const touch2 = e.touches[1];

            const currentDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );

            pinchState.currentDistance = currentDistance;

            const distanceChange = currentDistance - pinchState.initialDistance;
            const changePercent = Math.abs(distanceChange) / pinchState.initialDistance;

            // Update touch positions for stability check
            pinchState.touch1 = { x: touch1.clientX, y: touch1.clientY };
            pinchState.touch2 = { x: touch2.clientX, y: touch2.clientY };

            // Trigger aspect ratio change if threshold is met
            if (changePercent > 0.15 && !pinchState.hasTriggered) { // 15% change threshold
                pinchState.hasTriggered = true;

                if (distanceChange > 0) {
                    // Pinch out - switch to fill/zoom mode
                    setVideoAspectRatio(pinchState.video, 'fill');
                    showIndicator('expand', 'Fill Screen', 'aspect');
                } else {
                    // Pinch in - switch to fit/normal mode
                    setVideoAspectRatio(pinchState.video, 'fit');
                    showIndicator('compress', 'Fit Screen', 'aspect');
                }

                vibrate();
            }

            resetInactivityTimer();

        } catch (e) {
            ErrorHandler.report('PinchGesture:Move', e, 'error');
        }
    };

    const handlePinchEnd = (e) => {
        try {
            if (!pinchState) return;

            pinchState = null;
            pinchGestureActive = false;

        } catch (e) {
            ErrorHandler.report('PinchGesture:End', e, 'error');
        }
    };

    // Video aspect ratio management
    const getCurrentAspectRatio = (video) => {
        try {
            const style = getComputedStyle(video);
            return style.objectFit || 'fill';
        } catch (e) {
            return 'fill';
        }
    };

    const setVideoAspectRatio = (video, mode) => {
        try {
            if (!video) return;

            // Store original styles if not already stored
            if (!videoOriginalStyles.has(video)) {
                videoOriginalStyles.set(video, {
                    objectFit: getComputedStyle(video).objectFit || 'contain',
                    transform: getComputedStyle(video).transform || 'none',
                    width: video.style.width,
                    height: video.style.height
                });
            }

            switch (mode) {
                case 'fill': {
                    // Smart Zoom: Calculate exact scale needed to fill screen
                    const videoRatio = video.videoWidth / video.videoHeight;
                    // Use physical screen dimensions to bypass safe area (notch/punch hole)
                    const screenRatio = window.screen.width / window.screen.height;

                    if (!videoRatio || !screenRatio) return;

                    let scale = 1;
                    if (screenRatio > videoRatio) {
                        // Screen is wider than video (Pillarbox) -> Scale by width difference
                        scale = screenRatio / videoRatio;
                    } else {
                        // Screen is taller/narrower than video (Letterbox) -> Scale by height difference
                        scale = videoRatio / screenRatio;
                    }

                    // SUPER FILL: Add 2% buffer to bleed past the punch hole/notch
                    scale = scale * 1.02;

                    video.style.objectFit = 'contain'; // Ensure base is contained
                    video.style.transform = `scale(${scale})`;
                    video.style.transformOrigin = 'center';
                    video.style.width = '100%';
                    video.style.height = '100%';
                    break;
                }

                case 'fit':
                    // Fit entire video (Letterbox/Pillarbox as needed)
                    video.style.objectFit = 'contain';
                    video.style.transform = 'scale(1)';
                    video.style.transformOrigin = 'center';
                    video.style.width = '100%';
                    video.style.height = '100%';
                    break;

                case 'original':
                    // Restore original styles
                    const originalStyles = videoOriginalStyles.get(video);
                    if (originalStyles) {
                        video.style.objectFit = originalStyles.objectFit;
                        video.style.transform = originalStyles.transform;
                        video.style.width = originalStyles.width;
                        video.style.height = originalStyles.height;
                    }
                    break;
            }

        } catch (e) {
            ErrorHandler.report('SetVideoAspectRatio', e, 'error');
        }
    };

    // Helper to check for interactive UI elements - OPTIMIZED
    const interactiveTags = new Set(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'LABEL']);
    const interactiveRoles = new Set(['button', 'slider', 'menuitem', 'tab', 'progressbar']);

    // Pre-join selectors once (expensive to join on every call)
    const interactiveSelectorsJoined = [
        // JWPlayer
        '.jw-controls', '.jw-controlbar', '.jw-icon', '.jw-slider',
        // VideoJS
        '.vjs-control-bar', '.vjs-control', '.vjs-button', '.vjs-slider',
        // YouTube
        '.ytp-chrome-bottom', '.ytp-chrome-controls', '.ytp-button',
        // Plyr - comprehensive
        '.plyr__controls', '.plyr__control', '.plyr__progress', '.plyr__menu',
        '.plyr__tooltip', '.plyr__volume', '.plyr__time', '.plyr__captions',
        // Doodstream
        '.dood-control-bar', '.vjs-control-bar',
        // kt_player
        '.ktplayer-controls', '.kt-controls', '.ktplayer-control-bar',
        '.ktplayer-button', '.kt-button', '.ktplayer-progress', '.kt-progress',
        '.ktplayer-volume', '.kt-volume', '.ktplayer-settings', '.kt-settings',
        // KVS player v6
        '.kvs-controls', '.kvs_controls', '.kvs-control-bar', '.kvs_control_bar',
        '.kvs-button', '.kvs_button', '.kvs-progress', '.kvs_progress',
        '.kvs-volume', '.kvs_volume', '.kvs-settings', '.kvs_settings',
        // KVS player v7 / Flowplayer controls (specific controls only, not entire UI)
        '.fp-controls', '.fp-timeline', '.fp-volume', '.fp-volumeslider',
        '.fp-fullscreen', '.fp-elapsed', '.fp-remaining', '.fp-duration',
        '.fp-mute', '.fp-play', '.fp-pause', '.fp-speed', '.fp-menu',
        '.fp-unload', '.fp-embed', '.fp-share',
        // MediaElement
        '.mejs__controls', '.mejs__button',
        // Vimeo
        '.vp-controls', '.vp-controls-wrapper', '.play-bar', '.vp-prefs',
        // VK
        '.videoplayer_btn', '.videoplayer_controls', '.mv_controls',
        // Mega
        '.viewer-bottom-bar', '.video-controls-wrapper', '.video-time-bar',
        // Google Drive
        '.ndfHFb-c4YZDc-auswjd', '.ndfHFb-vyDMJf-aZ2wEe', '.drive-viewer-controls',
        // Doodstream
        '.vjs-dood-skin', '.dood-control-bar',
        // Streamtape
        '.video-controls', '.controlbar',
        // Generic patterns
        '.player-controls', '.media-controls', '.control-bar', '.controls',
        '.video-controls', '.playback-controls', '.progress-bar', '.seek-bar',
        '.timeline', '.scrubber', '[class*="control-bar"]', '[class*="controls"]'
    ].join(',');

    const isInteractive = (element) => {
        if (!element || element.tagName === 'VIDEO') return false;

        // Check cache first
        if (interactiveCache.has(element)) {
            return interactiveCache.get(element);
        }

        let result = false;

        // Fast tag check (O(1))
        if (interactiveTags.has(element.tagName)) {
            result = true;
        } else {
            // Interactive roles
            const role = element.getAttribute?.('role');
            if (role && interactiveRoles.has(role)) {
                result = true;
            } else {
                // Data attributes (fast check before expensive closest)
                if (element.hasAttribute?.('data-plyr') ||
                    element.hasAttribute?.('data-vjs-player') ||
                    element.hasAttribute?.('data-jw-player')) {
                    result = true;
                } else {
                    // Only check closest if element is likely inside controls (expensive)
                    // Optimized: Don't check closest for simple containers usually
                    if (element.closest?.(interactiveSelectorsJoined)) {
                        result = true;
                    }
                }
            }
        }

        // Cache the result
        interactiveCache.set(element, result);
        return result;
    };

    // --- Gesture Arbiter: Prevents Race Conditions with Native Players ---
    // Implements early gesture claiming to prevent conflicts with browser and player gestures
    const GestureArbiter = (() => {
        let claimedGesture = null;
        const CLAIM_THRESHOLD = 15; // pixels - minimum movement to claim gesture
        const HORIZONTAL_RATIO = 1.5; // dx must be 1.5x dy for horizontal claim

        const shouldClaim = (currentTouch, startTouch) => {
            const dx = Math.abs(currentTouch.clientX - startTouch.clientX);
            const dy = Math.abs(currentTouch.clientY - startTouch.clientY);
            const distance = Math.hypot(dx, dy);

            // Claim immediately if in fullscreen (high confidence)
            if (getFullscreenElement()) {
                return distance > 10;
            }

            // Claim if horizontal swipe detected (seeking gesture)
            const isHorizontal = dx > dy * HORIZONTAL_RATIO;
            if (isHorizontal && distance > CLAIM_THRESHOLD) {
                return true;
            }

            // Don't claim for vertical or ambiguous gestures (allow native scroll/pull-to-refresh)
            return false;
        };

        const claim = (gestureType) => {
            claimedGesture = gestureType;

            // Prevent browser gestures
            document.body.style.touchAction = 'none';
            document.body.style.overscrollBehavior = 'none';

            // Notify parent/child frames to cancel their gestures
            // This prevents conflicts in iframe scenarios
            try {
                // Notify parent
                if (window.parent !== window) {
                    window.parent.postMessage({
                        type: 'SUPERVIDEO_GESTURE_CLAIM',
                        source: 'SuperVideo'
                    }, '*');
                }

                // Notify all child iframes
                document.querySelectorAll('iframe').forEach(iframe => {
                    try {
                        iframe.contentWindow?.postMessage({
                            type: 'SUPERVIDEO_GESTURE_CLAIM',
                            source: 'SuperVideo'
                        }, '*');
                    } catch (e) {
                        // Cross-origin iframe - ignore
                    }
                });
            } catch (e) {
                // Ignore postMessage errors
            }
        };

        const release = () => {
            claimedGesture = null;
            document.body.style.touchAction = '';
            document.body.style.overscrollBehavior = '';
        };

        const getClaimed = () => claimedGesture;

        const isClaimed = () => claimedGesture !== null;

        // Listen for gesture claims from other frames
        window.addEventListener('message', (e) => {
            if (e.data.type === 'SUPERVIDEO_GESTURE_CLAIM' && e.data.source === 'SuperVideo') {
                // Another frame claimed the gesture, cancel ours
                if (gestureState) {
                    gestureState = null;
                    clearTimeout(longPressTimer);
                }
            }
        });

        return { shouldClaim, claim, release, getClaimed, isClaimed };
    })();

    // Touch handlers (updated for pinch support)
    const onTouchStart = (e) => {
        try {
            // Handle multi-touch for pinch gestures
            if (e.touches.length === 2) {
                handlePinchStart(e);
                return;
            } else if (e.touches.length > 2) {
                return;
            }

            const touch = e.touches[0];

            // If touch starts on an interactive element, ignore the gesture to allow UI interaction.
            if (isInteractive(touch.target)) {
                return;
            }

            const result = findVideo(e.target, touch.clientX, touch.clientY);

            if (!result?.video) {
                return;
            }

            if (result.video.duration < settings.MIN_VIDEO_DURATION) {
                return;
            }

            // By not calling preventDefault or stopPropagation here, we allow simple taps
            // to be processed by the underlying player for play/pause functionality.
            // The gesture is "claimed" in onTouchMove if the user starts swiping.

            gestureState = {
                video: result.video,
                container: result.container,
                startX: touch.clientX,
                startY: touch.clientY,
                lastX: touch.clientX,
                lastY: touch.clientY,
                isSwipe: false,
                action: null,
                claimed: false, // Property to track if the gesture is claimed
                originalPlaybackRate: result.video.playbackRate,

                baseCurrentTime: result.video.currentTime,
                lastIndicatorUpdate: 0,
                limitHit: false, // For boing physics
                snappedToStart: false, // For visual snap back
                // Inertia State
                velocity: 0,
                lastDragTime: Date.now(),
                lastDragX: 0,
                rafId: null
            };

            // Double-tap detection
            const now = Date.now();
            if (now - lastTap.time < settings.DOUBLE_TAP_TIMEOUT) {
                lastTap.count++;
            } else {
                lastTap.count = 1;
            }
            lastTap.time = now;

            // Check for dead zones
            if (isInDeadZone(touch.clientX, touch.clientY)) {
                return;
            }

            // Long-press setup (only if video is playing)
            if (getFullscreenElement() && !result.video.paused) {
                longPressTimer = setTimeout(() => {
                    if (!gestureState || gestureState.isSwipe) return;

                    const moved = Math.hypot(
                        gestureState.lastX - gestureState.startX,
                        gestureState.lastY - gestureState.startY
                    );

                    if (moved > 10) return;

                    gestureState.action = 'long-press-speed';
                    gestureState.video.playbackRate = settings.LONG_PRESS_SPEED;
                    showIndicator('forward', `${settings.LONG_PRESS_SPEED}x`, 'speed', true);
                    vibrate();
                }, settings.LONG_PRESS_DURATION);
            }

            // Track video activity
            trackVideoActivity(result.video);

            // JIT Listeners: Attach only when gesture starts
            document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
            document.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });

            // Performance: Hint browser about incoming transform changes
            if (gestureState.video) {
                gestureState.video.style.willChange = 'transform';
            }

            // Reset inactivity timer
            resetInactivityTimer();
        } catch (e) {
            ErrorHandler.report('TouchGesture:Start', e, 'error');
        }
    };

    const onTouchMove = (e) => {
        try {
            // Handle pinch gesture movement
            if (e.touches.length === 2 && pinchState) {
                handlePinchMove(e);
                return;
            }

            if (!gestureState || e.touches.length > 1) {
                return;
            }

            // Reset inactivity timer on movement
            resetInactivityTimer();

            const touch = e.touches[0];
            const dx = touch.clientX - gestureState.startX;
            const dy = touch.clientY - gestureState.startY;
            const distance = Math.hypot(dx, dy);

            // EARLY CLAIM: Use GestureArbiter to prevent conflicts with native players
            // This is critical for Firefox Android where native gestures can interfere
            if (!gestureState.claimed && GestureArbiter.shouldClaim(touch, { clientX: gestureState.startX, clientY: gestureState.startY })) {
                // Claim ASAP to prevent browser/player from handling the gesture
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                gestureState.claimed = true;
                GestureArbiter.claim('seek');
            }

            gestureState.lastX = touch.clientX;
            gestureState.lastY = touch.clientY;

            if (!gestureState.isSwipe && distance > settings.SWIPE_THRESHOLD) {
                clearTimeout(longPressTimer);
                lastTap.count = 0;
                gestureState.isSwipe = true;

                if (gestureState.action === 'long-press-speed') {
                    gestureState.video.playbackRate = gestureState.originalPlaybackRate;
                    hideIndicator();
                }

                if (getFullscreenElement()) {
                    determineAction(dx, dy);
                }
            }

            if (gestureState.isSwipe && getFullscreenElement()) {
                handleSwipeAction(dx, dy);
            }
        } catch (e) {
            ErrorHandler.report('TouchGesture:Move', e, 'error');
        }
    };

    const onTouchEnd = (e) => {
        try {
            // JIT: Remove listeners immediately
            document.removeEventListener('touchmove', onTouchMove, { passive: false, capture: true });
            document.removeEventListener('touchend', onTouchEnd, { passive: false, capture: true });

            // Handle pinch gesture end
            if (pinchState && e.touches.length < 2) {
                handlePinchEnd(e);
                return;
            }

            if (!gestureState) return;

            clearTimeout(longPressTimer);

            if (gestureState.action === 'long-press-speed') {
                e.stopPropagation();
                gestureState.video.playbackRate = gestureState.originalPlaybackRate;
                hideIndicator();
            } else if (gestureState.isSwipe) {
                e.stopPropagation();
                handleSwipeEnd();
            } else {
                // This is a tap or double tap
                if (lastTap.count >= 2) {
                    // This is a double tap, handle it and stop propagation to prevent conflicts
                    e.preventDefault();
                    e.stopPropagation();
                    handleTap();
                }
                // For single taps, do nothing and let the event propagate to the player
            }

            // Cleanup will-change
            if (gestureState && gestureState.video) {
                gestureState.video.style.willChange = 'auto';
            }

            // Release gesture claim to restore browser touch handling
            if (gestureState && gestureState.claimed) {
                GestureArbiter.release();
            }

            gestureState = null;
        } catch (e) {
            ErrorHandler.report('TouchGesture:End', e, 'warn');
            if (gestureState?.video) gestureState.video.style.willChange = 'auto';
            gestureState = null;
        }
    };

    const onContextMenu = (e) => {
        if (gestureState || pinchGestureActive) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    const determineAction = (dx, dy) => {
        try {
            const isVertical = Math.abs(dy) > Math.abs(dx);

            if (isVertical) {
                // Vertical swipe is now exclusively for Fullscreen Drag (Exit/PiP)
                gestureState.action = 'fullscreen-drag';
            }
            else {
                if (Number.isFinite(gestureState.video.duration)) {
                    gestureState.action = 'seeking';
                } else {
                    showIndicator('play', 'Live Stream');
                    gestureState.action = 'none';
                }
            }
        } catch (e) {
            console.error('[SuperVideo] Determine action error:', e);
        }
    };

    const handleSwipeAction = (dx, dy) => {
        try {
            switch (gestureState.action) {
                case 'seeking':
                    handleSeeking(dx);
                    break;
                case 'fullscreen-drag':
                    handleFullscreenDrag(dy);
                    break;
                case 'none':
                    break;
            }
        } catch (e) {
            console.error('[SuperVideo] Swipe action error:', e);
        }
    };

    const handleSeeking = (dx) => {
        try {
            if (!Number.isFinite(gestureState.video.duration)) return;

            // Simple seek calculation - no velocity tracking
            let seekAmount = dx * settings.SEEK_SENSITIVITY;
            seekAmount = Math.max(-120, Math.min(120, seekAmount));

            const newTime = Math.max(0, Math.min(
                gestureState.video.duration,
                gestureState.baseCurrentTime + seekAmount
            ));

            // Direct assignment - no frame callback
            gestureState.video.currentTime = newTime;

            const now = Date.now();

            // Simple indicator update with throttling
            if (now - (gestureState.lastIndicatorUpdate || 0) > settings.INDICATOR_UPDATE_THROTTLE) {
                const icon = seekAmount >= 0 ? 'forward' : 'backward';
                // Rich Info: Current / Total
                const text = `${formatTime(newTime)} / ${formatTime(gestureState.video.duration)}`;
                const progress = (newTime / gestureState.video.duration) * 100;

                showIndicator(icon, text, 'seeking', false, progress);
                gestureState.lastIndicatorUpdate = now;
            }
        } catch (e) {
            ErrorHandler.report('UpdateSeekPosition', e, 'warn');
        }
    };

    // Shared Streak Logic (Double Tap & Keyboard)
    const applySeekWithStreak = (video, direction) => {
        if (!video) return;
        if (!settings.DOUBLE_TAP_SEEK) return;

        // If switching direction, reset streak and hide old indicator
        if (seekStreak.type && seekStreak.type !== direction) {
            hideIndicator(); // Hide old indicator immediately
            seekStreak.value = 0;
            seekStreak.type = direction;
        } else if (!seekStreak.type) {
            seekStreak.type = direction;
        }

        seekStreak.value += settings.DOUBLE_TAP_SEEK;

        clearTimeout(seekStreak.timer);

        // Apply seek
        if (direction === 'backward') {
            video.currentTime = Math.max(0, video.currentTime - settings.DOUBLE_TAP_SEEK);
            showIndicator('step-backward', `-${seekStreak.value}s`, null, true, null, video);
        } else {
            video.currentTime = Math.min(video.duration || Infinity, video.currentTime + settings.DOUBLE_TAP_SEEK);
            showIndicator('step-forward', `+${seekStreak.value}s`, null, true, null, video);
        }

        seekStreak.timer = setTimeout(() => {
            seekStreak.value = 0;
            seekStreak.type = null;
            hideIndicator(); // Hide indicator when streak completes
        }, 800);

        if (navigator.vibrate) navigator.vibrate(50);
    };

    const handleFullscreenDrag = (dy) => {
        try {
            if (dy > 0) {
                // ELASTIC PULL VISUALS
                // Resistive drag: dy^0.8 for "heavy" feel
                const dragY = Math.pow(dy, 0.85) * 1.5;
                // Scale down slightly: 1 -> 0.9
                const scale = Math.max(0.85, 1 - (dy / 3000));

                gestureState.video.style.transform = `translateY(${dragY}px) scale(${scale})`;
                gestureState.video.style.transition = 'none'; // Instant follow

                if (dy > settings.SWIPE_THRESHOLD) {
                    showIndicator('compress', 'Release to Exit', 'aspect');
                } else {
                    hideIndicator();
                }
            }
        } catch (e) {
            ErrorHandler.report('FullscreenDrag', e, 'warn');
        }
    };

    const handleSwipeEnd = () => {
        try {
            if (gestureState.action === 'seeking') {
                // Check if cancelled
                if (gestureState.seekCancelled) {
                    vibrate();
                    gestureState.video.currentTime = gestureState.baseCurrentTime;
                    showIndicator('check-circle', 'Cancelled', 'toast');
                    return;
                }

                vibrate();

                // Simple immediate hide - no inertia/momentum
                hideIndicator();

            } else if (gestureState.action === 'fullscreen-drag') {
                const dy = gestureState.lastY - gestureState.startY;

                // Reset Video Transform
                // If we are exiting, browser handling might clash, but best to clear cleanly.
                // If staying, we MUST animate back ("Boing").

                if (dy > settings.SWIPE_THRESHOLD * 2) { // Exit threshold
                    // Simple exit - clear transform immediately
                    gestureState.video.style.transform = '';
                    gestureState.video.style.transition = '';
                    exitFullscreen();
                } else {
                    // Simple snap back - no bouncy animation
                    gestureState.video.style.transition = '';
                    gestureState.video.style.transform = '';
                    hideIndicator();
                }
            }
        } catch (e) {
            ErrorHandler.report('SwipeEnd', e, 'warn');
        }
    };

    const handleTap = () => {
        try {
            if (lastTap.count >= 2) {
                if (getFullscreenElement()) {
                    handleDoubleTapSeek();
                } else {
                    toggleFullscreen();
                }
                lastTap = { time: 0, count: 0 };
            }
        } catch (e) {
            ErrorHandler.report('HandleTap', e, 'error');
        }
    };

    const handleDoubleTapSeek = () => {
        try {
            const rect = gestureState.video.getBoundingClientRect();
            const zone = (gestureState.startX - rect.left) / rect.width;
            const baseSeekTime = settings.DOUBLE_TAP_SEEK;
            let type = null;

            if (zone < settings.TAP_ZONES.BACKWARD) {
                type = 'backward';
            } else if (zone > settings.TAP_ZONES.FORWARD) {
                type = 'forward';
            } else {
                // Center tap (Play/Pause)
                if (gestureState.video.paused) {
                    const playPromise = gestureState.video.play();
                    if (playPromise && playPromise.catch) {
                        playPromise.catch(() => { });
                    }
                    showIndicator('play', 'Play');
                } else {
                    gestureState.video.pause();
                    showIndicator('pause', 'Pause');
                }
                // Clear any existing streak on center tap
                seekStreak = { value: 0, timer: null, type: null };
                vibrate();
                return;
            }

            // Accumulative Logic
            clearTimeout(seekStreak.timer);

            // formatting: if switching direction, reset
            if (seekStreak.type !== type) {
                seekStreak.value = 0;
                seekStreak.type = type;
            }

            seekStreak.value += baseSeekTime;

            // Apply incremental seek to video
            if (type === 'backward') {
                gestureState.video.currentTime -= baseSeekTime;
                showIndicator('step-backward', `-${seekStreak.value}s`);
            } else {
                gestureState.video.currentTime += baseSeekTime;
                showIndicator('step-forward', `+${seekStreak.value}s`);
            }

            // Set streak timeout (reset after 800ms of no taps)
            seekStreak.timer = setTimeout(() => {
                seekStreak.value = 0;
                seekStreak.type = null;
            }, 800);

            vibrate();
        } catch (e) {
            ErrorHandler.report('DoubleTapSeek', e, 'warn');
        }
    };


    const toggleFullscreen = () => {
        try {
            const isFullscreen = !!getFullscreenElement();

            if (isFullscreen) {
                FullscreenAPI.exit().catch(() => { });
                showIndicator('compress', 'Exit Fullscreen');
                vibrate();
            } else {
                const element = gestureState?.container || document.documentElement;
                FullscreenAPI.request(element).catch(() => { });
                showIndicator('expand', 'Enter Fullscreen');

                if (settings.FORCE_LANDSCAPE && gestureState?.video) {
                    const { videoWidth, videoHeight } = gestureState.video;
                    if (videoWidth > videoHeight && screen.orientation) {
                        setTimeout(() => {
                            screen.orientation.lock('landscape').catch(() => { });
                        }, 100);
                    }
                }

                vibrate();
            }
        } catch (e) {
            ErrorHandler.report('ToggleFullscreen', e, 'warn');
        }
    };

    const onFullscreenChange = () => {
        try {
            // Reset video context for fresh viewport detection
            currentVideoContext = null;

            attachToFullscreen();
            if (!getFullscreenElement() && screen.orientation && screen.orientation.unlock) {
                try {
                    const unlockResult = screen.orientation.unlock();
                    if (unlockResult && unlockResult.catch) {
                        unlockResult.catch(() => { });
                    }
                } catch (e) {
                    // Ignore unlock errors
                }
            }
        } catch (e) {
            ErrorHandler.report('FullscreenChange', e, 'warn');
        }
    };

    // Cleanup
    const cleanup = () => {
        try {
            // Clear all timers
            clearTimeout(longPressTimer);
            clearTimeout(hideTimer);
            clearTimeout(toastTimer);
            clearTimeout(inactivityTimer);

            // Clear video timers - WeakMap doesn't have .values() or .clear()
            // Just reassign to new WeakMap (old one will be GC'd)
            videoTimers = new WeakMap();

            // Clear WeakSet references
            activeVideos = new WeakSet();

            // Clear pinch state
            pinchState = null;
            pinchGestureActive = false;

            document.removeEventListener('touchstart', onTouchStart, true);
            document.removeEventListener('touchmove', onTouchMove, true);
            document.removeEventListener('touchend', onTouchEnd, true);
            document.removeEventListener('contextmenu', onContextMenu, true);
            // Cleanup function (removeFullscreenListener is handled by FullscreenAPI)
            document.removeEventListener('fullscreenchange', onFullscreenChange);

            document.getElementById(STYLE_ID)?.remove();
            indicator?.remove();
            toast?.remove();

            gestureState = null;
        } catch (e) {
            ErrorHandler.report('GlobalCleanup', e, 'warn');
        }
    };

    // Initialize
    const getIconSvg = (name) => {
        const icons = {
            'play': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
            'pause': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
            'forward': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',
            'backward': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z"/></svg>',
            'step-forward': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>',
            'step-backward': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z"/></svg>',
            'expand': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
            'compress': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',
            'check-circle': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
            'alert': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
            'volume-up': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
            'volume-off': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
            'cc-filled': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="white" /><path fill="black" d="M11 14v-.5a.5.5 0 0 0-.5-.5h-2a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h2a.5.5 0 0 0 .5-.5V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1zm6 0v-.5a.5.5 0 0 0-.5-.5h-2a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h2a.5.5 0 0 0 .5-.5V10a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1z"/></svg>',
            'cc-outline': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2" /><path fill="currentColor" d="M11 14v-.5a.5.5 0 0 0-.5-.5h-2a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h2a.5.5 0 0 0 .5-.5V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1zm6 0v-.5a.5.5 0 0 0-.5-.5h-2a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h2a.5.5 0 0 0 .5-.5V10a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1z"/></svg>',
            'upload': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>',
            'plus': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
            'minus': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M19 13H5v-2h14v2z"/></svg>',
            'trash': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
            'file-text': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
            'refresh': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
            'undo': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>',
            'redo': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>',
            'download': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg>',
            'close': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
            'settings': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81a.488.488 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
            'reset': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',
        };
        return icons[name] || '';
    };


    // --- Settings UI Module (Phase 5: Shadow DOM) ---
    const SettingsUI = (() => {
        const HOST_ID = 'vg-settings-host';

        // Styles adapted for Shadow DOM (no #ID prefix needed for root)
        const STYLES = `
            :host {
                all: initial;
                position: fixed;
                top: 0; left: 0;
                width: 100vw; height: 100vh;
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                pointer-events: none; /* Let clicks pass through when hidden/transparent */
                display: block;
            }
            
            .overlay {
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                display: flex;
                justify-content: center;
                align-items: center;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: auto; /* Capture clicks on overlay */
            }
            .overlay.visible { opacity: 1; }
            
            .vg-settings-panel {
                background: rgba(30, 30, 30, 0.85);
                width: 90%;
                max-width: 380px;
                max-height: 85vh;
                border-radius: 20px;
                box-shadow: 0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15);
                border: 1px solid rgba(255,255,255,0.08);
                display: flex;
                flex-direction: column;
                transform: scale(0.95);
                transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
                overflow: hidden;
                color: #fff;
            }
            .overlay.visible .vg-settings-panel { transform: scale(1); }

            .vg-header {
                padding: 16px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(255,255,255,0.08);
                background: rgba(255,255,255,0.02);
            }
            .vg-title {
                font-size: 17px;
                font-weight: 600;
                color: #fff;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .vg-close-btn {
                cursor: pointer;
                width: 32px; height: 32px;
                display: flex; align-items: center; justify-content: center;
                border-radius: 50%;
                background: rgba(255,255,255,0.1);
                color: #ddd;
                transition: background 0.2s;
                flex-shrink: 0;
            }
            .vg-close-btn:hover { background: rgba(255,255,255,0.2); color: #fff; }
            .vg-close-btn svg {
                width: 18px;
                height: 18px;
            }

            .vg-scroll-content {
                padding: 16px;
                overflow-y: auto;
                overscroll-behavior: contain;
            }
            /* Scrollbar Styling */
            .vg-scroll-content::-webkit-scrollbar { width: 8px; }
            .vg-scroll-content::-webkit-scrollbar-track { background: transparent; }
            .vg-scroll-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
            .vg-scroll-content::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }

            .vg-section-title {
                font-size: 13px;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                font-weight: 600;
                color: rgba(255,255,255,0.6);
                margin-bottom: 10px;
                margin-top: 16px;
                padding-left: 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .vg-section-title:first-child { margin-top: 0; }
            .vg-section-title svg {
                width: 16px;
                height: 16px;
                opacity: 0.7;
            }

            .vg-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                min-height: 36px;
                padding: 4px 0;
            }
            .vg-row:last-child { margin-bottom: 0; }
            
            .vg-label {
                font-size: 15px;
                color: #eee;
                flex: 1;
            }
            .vg-label-desc {
                font-size: 12px;
                color: rgba(255,255,255,0.5);
                margin-top: 4px;
                display: block;
            }

            /* iOS Toggle */
            .vg-toggle {
                position: relative;
                width: 44px; height: 26px;
                background: rgba(120, 120, 128, 0.32);
                border-radius: 13px;
                transition: background 0.3s;
                cursor: pointer;
            }
            .vg-toggle::after {
                content: '';
                position: absolute;
                top: 2px; left: 2px;
                width: 22px; height: 22px;
                background: #fff;
                border-radius: 50%;
                box-shadow: 0 3px 8px rgba(0,0,0,0.15);
                transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
            }
            .vg-toggle.active { background: #34c759; }
            .vg-toggle.active::after { transform: translateX(18px); }

            /* Slider */
            .vg-slider-container {
                width: 140px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .vg-slider {
                -webkit-appearance: none;
                width: 100%;
                height: 4px;
                background: rgba(255,255,255,0.2);
                border-radius: 2px;
                outline: none;
                cursor: pointer;
            }
            .vg-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 20px; height: 20px;
                background: #fff;
                border-radius: 50%;
                box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                cursor: pointer;
                transition: transform 0.1s;
            }
            .vg-slider::-webkit-slider-thumb:active { transform: scale(1.1); }
            .vg-value {
                font-size: 14px;
                color: rgba(255,255,255,0.7);
                width: 32px;
                text-align: right;
                font-variant-numeric: tabular-nums;
            }

            .vg-btn-action {
                width: 100%;
                padding: 10px 16px;
                border-radius: 10px;
                background: rgba(255,255,255,0.08);
                color: #fff;
                border: none;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                margin-top: 6px;
                transition: background 0.2s;
                display: flex; align-items: center; justify-content: center; gap: 8px;
            }
            .vg-btn-action svg {
                width: 16px;
                height: 16px;
            }
            .vg-btn-action:hover { background: rgba(255,255,255,0.15); }
            .vg-btn-action.danger { color: #ff453a; background: rgba(255, 69, 58, 0.1); }
            .vg-btn-action.danger:hover { background: rgba(255, 69, 58, 0.2); }
        `;

        const createEl = (tag, className, html) => {
            const el = document.createElement(tag);
            if (className) el.className = className;
            if (html) el.innerHTML = html;
            return el;
        };

        const render = () => {
            console.log('[SuperVideo] Opening Settings Panel (Shadow DOM)');

            // Remove existing host
            document.getElementById(HOST_ID)?.remove();

            // 1. Create Host
            const host = document.createElement('div');
            host.id = HOST_ID;

            // 2. Attach Shadow
            const shadow = host.attachShadow({ mode: 'open' });

            // 3. Inject Styles
            const styleEl = document.createElement('style');
            styleEl.textContent = STYLES;
            shadow.appendChild(styleEl);

            // 4. Create Overlay Container
            const overlay = createEl('div', 'overlay', '');

            // 5. Build Panel
            const panel = createEl('div', 'vg-settings-panel');

            // Header
            panel.innerHTML += `
                <div class="vg-header">
                    <div class="vg-title">
                        ${getIconSvg('settings')} Settings
                    </div>
                    <div class="vg-close-btn">${getIconSvg('close')}</div>
                </div>
            `;

            // Content
            const content = createEl('div', 'vg-scroll-content');

            // --- General Section ---
            content.appendChild(createEl('div', 'vg-section-title', 'General'));
            addToggle(content, 'Smart Resume', 'Start where you left off', 'RESUME_PLAYBACK');
            addToggle(content, 'Auto Resume', 'Resume automatically without asking', 'AUTO_RESUME');
            addToggle(content, 'Visual Feedback', 'Show icons and toasts', 'SHOW_TOASTS');
            addToggle(content, 'Prevent Sleep', 'Keep screen awake while playing', 'PREVENT_SLEEP');

            // --- Gestures Section ---
            content.appendChild(createEl('div', 'vg-section-title', 'Gestures'));
            addSlider(content, 'Double Tap Seek', 'DOUBLE_TAP_SEEK', 5, 60, 5, 's');
            addSlider(content, 'Long Press Speed', 'LONG_PRESS_SPEED', 1.5, 5, 0.5, 'x');
            addSlider(content, 'Seek Sensitivity', 'SEEK_SENSITIVITY', 0.1, 1.0, 0.1, '', val => val.toFixed(1));

            // --- Actions ---
            content.appendChild(createEl('div', 'vg-section-title', 'Data & Reset'));

            const clearBtn = createEl('button', 'vg-btn-action', `${getIconSvg('trash')} Clear Resume Data`);
            clearBtn.onclick = async () => {
                if (confirm('Clear all saved resume positions?')) {
                    await safeGMSet('vg_resume_data_v1', {});
                    alert('Resume data cleared.');
                }
            };
            content.appendChild(clearBtn);

            const resetBtn = createEl('button', 'vg-btn-action danger', `${getIconSvg('reset')} Reset Settings`);
            resetBtn.onclick = async () => {
                if (confirm('Reset all settings to default?')) {
                    Object.assign(settings, CONFIG);
                    await saveConfig();
                    close();
                    render();
                }
            };
            content.appendChild(resetBtn);

            panel.appendChild(content);
            overlay.appendChild(panel);
            shadow.appendChild(overlay);

            // 6. Append Host to Document
            // Try documentElement first (safest for overlays), then body
            (document.documentElement || document.body).appendChild(host);

            // 7. Bind Events
            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close();
            });
            // Close button
            panel.querySelector('.vg-close-btn').addEventListener('click', close);
            // Prevent click propagation from panel to overlay
            panel.addEventListener('click', e => e.stopPropagation());

            // 8. Animate In
            requestAnimationFrame(() => overlay.classList.add('visible'));
        };

        const addToggle = (parent, label, desc, key) => {
            const row = createEl('div', 'vg-row');
            row.innerHTML = `
                <div>
                    <div class="vg-label">${label}</div>
                    <div class="vg-label-desc">${desc}</div>
                </div>
            `;

            const toggle = createEl('div', `vg-toggle ${settings[key] ? 'active' : ''}`);
            toggle.onclick = async () => {
                settings[key] = !settings[key];
                toggle.classList.toggle('active');
                await saveConfig();
            };

            row.appendChild(toggle);
            parent.appendChild(row);
        };

        const addSlider = (parent, label, key, min, max, step, unit = '', formatFn = null) => {
            const row = createEl('div', 'vg-row');
            const currentVal = settings[key];
            const displayVal = formatFn ? formatFn(currentVal) : currentVal;

            row.innerHTML = `
                <div class="vg-label">${label}</div>
                <div class="vg-slider-container">
                    <span class="vg-value">${displayVal}${unit}</span>
                    <input type="range" class="vg-slider" min="${min}" max="${max}" step="${step}" value="${currentVal}">
                </div>
            `;

            const input = row.querySelector('input');
            const valueDisplay = row.querySelector('.vg-value');

            input.oninput = (e) => {
                const val = parseFloat(e.target.value);
                valueDisplay.textContent = (formatFn ? formatFn(val) : val) + unit;
            };

            input.onchange = async (e) => {
                const val = parseFloat(e.target.value);
                settings[key] = val;
                await saveConfig();
            };

            parent.appendChild(row);
        };

        const close = () => {
            const host = document.getElementById(HOST_ID);
            if (host && host.shadowRoot) {
                const overlay = host.shadowRoot.querySelector('.overlay');
                if (overlay) {
                    overlay.classList.remove('visible');
                    setTimeout(() => host.remove(), 300);
                } else {
                    host.remove();
                }
            }
        };

        const isOpen = () => {
            return !!document.getElementById(HOST_ID);
        };

        const toggle = () => {
            if (isOpen()) {
                close();
            } else {
                render();
            }
        };

        return { open: render, close, toggle, isOpen };
    })();

    console.log('[SuperVideo] SettingsUI defined:', typeof SettingsUI, SettingsUI);


    // --- Defuser Module: Neutralize Anti-Debug Protections ---
    const Defuser = (() => {
        const init = () => {
            // 0. Firefox 'Nuclear' Option - unsafeWindow
            // If we are in GM context, we manipulate the page's actual window object
            const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

            // 1. Block console.clear
            try {
                if (win.console && typeof win.console.clear === 'function') {
                    // Overwrite on the page object directly
                    win.console.clear = function () { console.log('[SuperVideo] Console clear blocked'); };
                }
            } catch (e) { }

            // 2. Nuke 'debugger' in Function/eval/setInterval
            try {
                // A. Helper to sanitize code strings
                const isHarmful = (code) => {
                    if (typeof code !== 'string') return false;
                    // Common obfuscation patterns
                    if (code.includes('debugger')) return true;
                    // Detect "call(null)" loop patterns often used with debugger
                    return false;
                };

                // B. Proxy Function Constructor
                if (win.Function) {
                    const _Function = win.Function;
                    const ProtectedFunction = new Proxy(_Function, {
                        construct(target, args) {
                            const src = args[0] || '';
                            if (isHarmful(src)) {
                                console.warn('[SuperVideo] Defuser: Blocked dynamic Function debugger.');
                                return function () { };
                            }
                            return new target(...args);
                        },
                        apply(target, thisArg, args) {
                            const src = args[0] || '';
                            if (isHarmful(src)) {
                                console.warn('[SuperVideo] Defuser: Blocked dynamic Function call debugger.');
                                return function () { };
                            }
                            return target.apply(thisArg, args);
                        }
                    });


                    // Force overwrite
                    try { win.Function = ProtectedFunction; } catch (e) { }
                }

                // C. Proxy eval
                if (win.eval) {
                    const _eval = win.eval;
                    // We can't easily proxy eval directly in strict mode, but we can try to replace if allowing
                    // Often protected sites use window.eval
                    win.eval = function (code) {
                        if (isHarmful(code)) {
                            console.warn('[SuperVideo] Defuser: Blocked eval debugger.');
                            return;
                        }
                        return _eval(code);
                    };
                }

                // D. Proxy setInterval (for debugger loops)
                if (win.setInterval) {
                    const _setInterval = win.setInterval;
                    win.setInterval = function (handler, timeout, ...args) {
                        // Check if handler matches our criteria
                        let shouldBlock = false;
                        if (typeof handler === 'string' && isHarmful(handler)) shouldBlock = true;
                        if (typeof handler === 'function') {
                            const str = handler.toString();
                            if (isHarmful(str)) shouldBlock = true;
                        }

                        if (shouldBlock) {
                            console.warn('[SuperVideo] Defuser: Blocked setInterval debugger loop.');
                            return -1; // invalid ID
                        }
                        return _setInterval(handler, timeout, ...args);
                    };
                }

            } catch (e) { console.warn('[SuperVideo] Defuser partial failure:', e); }

            // 3. Prevent F12 / ContextMenu Blocking (Capture Phase)
            const protectEvents = (e) => {
                if (e.key === 'F12' ||
                    ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') ||
                    ((e.metaKey && e.altKey && e.key.toLowerCase() === 'i'))) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            };
            try {
                // Attach to both current and unsafeWindow to be sure
                window.addEventListener('keydown', protectEvents, { capture: true, passive: false });
                win.addEventListener('keydown', protectEvents, { capture: true, passive: false });

                const onCtx = (e) => { e.stopPropagation(); e.stopImmediatePropagation(); };
                window.addEventListener('contextmenu', onCtx, { capture: true, passive: false });
                win.addEventListener('contextmenu', onCtx, { capture: true, passive: false });
            } catch (e) { }
        };
        return { init };
    })();

    const init = () => {
        try {
            Defuser.init(); // Run Defuser first
            createStyles();
            createElements();

            // ... (rest of init)


            // Firefox/Gecko: Aggressive capture for maximum reliability
            document.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });

            // Firefox Android: Prevent context menu from interfering with long-press gestures
            document.addEventListener('contextmenu', (e) => {
                if (gestureState && gestureState.active) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
                onContextMenu(e);
            }, { capture: true, passive: false });



            document.addEventListener('fullscreenchange', onFullscreenChange, { passive: true });
            // Use unified fullscreen API for all browsers
            const removeFullscreenListener = FullscreenAPI.addChangeListener(onFullscreenChange);

            window.addEventListener('beforeunload', cleanup);
            window.addEventListener('pagehide', cleanup);

            resetInactivityTimer();

            // Periodic cache cleanup to prevent memory buildup
            setInterval(() => {
                // Clear negative cache periodically (most volatile)
                negativeElementCache.clear();

                // Log cache sizes in debug mode
                if (settings.DEBUG) {
                    console.log('[SuperVideo] Cache sizes:', {
                        element: elementCache.size,
                        negative: negativeElementCache.size,
                        container: containerCache.size,
                        interactive: interactiveCache.size
                    });
                }
            }, 30000); // Every 30 seconds

            // Register Settings UI (Top Frame Only)
            if (window.self === window.top) {
                try {
                    console.log('[SuperVideo] Registering Settings Menu Command (Top Frame)');
                    console.log('[SuperVideo] SettingsUI available:', typeof SettingsUI, SettingsUI);
                    GM_registerMenuCommand('⚙️ SuperVideo Settings', () => {
                        console.log('[SuperVideo] Settings Menu Clicked in Top Frame');
                        console.log('[SuperVideo] SettingsUI.open:', typeof SettingsUI.open);
                        try {
                            SettingsUI.open();
                        } catch (err) {
                            console.error('[SuperVideo] Error opening settings:', err);
                            alert('Settings error: ' + err.message);
                        }
                    });
                } catch (e) {
                    console.error('[SuperVideo] Failed to register menu command', e);
                }
            }

            // Initialize modules
            try { console.log('[SuperVideo] DesktopMode Init'); DesktopMode.init(); } catch (e) { console.error('DesktopMode Failed', e); }
            try { console.log('[SuperVideo] SubtitleManager Init'); SubtitleManager.init(); } catch (e) { console.error('SubtitleManager Failed', e); }
            try { console.log('[SuperVideo] ResumeManager Init'); ResumeManager.init(); } catch (e) { console.error('ResumeManager Failed', e); }
            // Handle page unload - save pending resume data
            window.addEventListener('beforeunload', () => {
                // Force save if debounce is pending
                if (typeof ResumeManager !== 'undefined' && ResumeManager.forceSave) {
                    ResumeManager.forceSave();
                }
            }, { once: false });

            // --- MutationObserver for Dynamic Videos & Iframes (SPA compatibility) ---
            const videoObserver = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType !== 1) continue;

                        // Check if node itself is a video
                        if (node.tagName === 'VIDEO') {
                            trackVideoActivity(node);
                        }

                        // Check for videos inside added node
                        if (node.querySelectorAll) {
                            const videos = node.querySelectorAll('video');
                            videos.forEach(v => trackVideoActivity(v));

                            // Also check for iframes with videos
                            const iframes = node.querySelectorAll('iframe');
                            iframes.forEach(iframe => {
                                // Wait for iframe to load, then scan for videos
                                iframe.addEventListener('load', () => {
                                    try {
                                        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                                        if (iframeDoc) {
                                            const iframeVideos = iframeDoc.querySelectorAll('video');
                                            iframeVideos.forEach(v => trackVideoActivity(v));
                                        }
                                    } catch (e) { /* cross-origin */ }
                                }, { once: true });
                            });
                        }

                        // Check if node itself is an iframe
                        if (node.tagName === 'IFRAME') {
                            node.addEventListener('load', () => {
                                try {
                                    const iframeDoc = node.contentDocument || node.contentWindow?.document;
                                    if (iframeDoc) {
                                        const iframeVideos = iframeDoc.querySelectorAll('video');
                                        iframeVideos.forEach(v => trackVideoActivity(v));
                                    }
                                } catch (e) { /* cross-origin */ }
                            }, { once: true });
                        }
                    }
                }
            });

            videoObserver.observe(document.body, {
                childList: true,
                subtree: true
            });

            // --- Media Session API (Android notification controls) ---
            if ('mediaSession' in navigator) {
                const findActiveForSession = () => {
                    const videos = document.querySelectorAll('video');
                    for (const v of videos) {
                        if (!v.paused && isValidVideo(v)) return v;
                    }
                    return videos[0] || null;
                };

                navigator.mediaSession.setActionHandler('play', () => {
                    const v = findActiveForSession();
                    if (v) { v.play(); showToast('play', 'Play'); }
                });

                navigator.mediaSession.setActionHandler('pause', () => {
                    const v = findActiveForSession();
                    if (v) { v.pause(); showToast('pause', 'Pause'); }
                });

                navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                    const v = findActiveForSession();
                    if (v) {
                        const skip = details.seekOffset || 10;
                        v.currentTime = Math.max(0, v.currentTime - skip);
                        showToast('backward', `- ${skip} s`);
                    }
                });

                navigator.mediaSession.setActionHandler('seekforward', (details) => {
                    const v = findActiveForSession();
                    if (v) {
                        const skip = details.seekOffset || 10;
                        v.currentTime = Math.min(v.duration || Infinity, v.currentTime + skip);
                        showToast('forward', `+ ${skip} s`);
                    }
                });
            }

        } catch (e) {
            ErrorHandler.report('Initialization', e, 'fatal');
        }
    };

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    // Handle Back/Forward Cache Restoration
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
            console.log('[SuperVideo] Restored from bfcache');
            init();
        }
    });

})();
