// ==UserScript==
// @name          Video Gestures Pro - Glassmorphism Edition
// @namespace     https://github.com/itsrody/SuperBrowsing
// @version       11.0.0
// @description   Powerful zoned gesture interface with glassmorphism UI for fullscreen video control
// @author        Enhanced by Assistant
// @match         *://*/*
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
// @grant         GM_registerMenuCommand
// @run-at        document-start
// @compatible    scriptcat
// ==/UserScript==

(async function() {
    'use strict';

    // --- Performance Optimization: Use WeakMap for DOM element tracking ---
    const elementCache = new WeakMap();
    const gestureStates = new WeakMap();
    
    // --- Central Configuration ---
    const DEFAULTS = {
        MIN_VIDEO_DURATION_SECONDS: 60,
        DOUBLE_TAP_SEEK_SECONDS: 5,
        SWIPE_THRESHOLD: 20,
        SEEK_SENSITIVITY: 0.3,
        BRIGHTNESS_SENSITIVITY: 200,
        VOLUME_SENSITIVITY: 250,
        ENABLE_HAPTIC_FEEDBACK: true,
        HAPTIC_FEEDBACK_DURATION_MS: 20,
        FORCE_LANDSCAPE: true,
        DOUBLE_TAP_TIMEOUT_MS: 350,
        LONG_PRESS_DURATION_MS: 400,
    };

    let config = await GM_getValue('config', DEFAULTS);

    // --- Enhanced Error Handler with Recovery ---
    class ErrorHandler {
        static errors = [];
        static maxErrors = 10;
        
        static handleError(error, context = '') {
            this.errors.push({ error, context, timestamp: Date.now() });
            
            // Prevent memory leak from error log
            if (this.errors.length > this.maxErrors) {
                this.errors.shift();
            }
            
            console.warn(`[VideoGestures] Error in ${context}:`, error);
            
            // Auto-recovery for critical failures
            if (context.includes('gesture') || context.includes('touch')) {
                resetGestureState();
            }
        }
        
        static wrapFunction(fn, context) {
            return function(...args) {
                try {
                    return fn.apply(this, args);
                } catch (error) {
                    ErrorHandler.handleError(error, context);
                    return null;
                }
            };
        }
    }

    // --- Menu Commands ---
    GM_registerMenuCommand('⚙️ Settings', () => {
        showSettingsPanel();
    });

    GM_registerMenuCommand('⏱️ Set Double-Tap Seek Time', () => {
        const current = config.DOUBLE_TAP_SEEK_SECONDS;
        const input = prompt(
            `Enter seconds to seek on double-tap (1-60):\nCurrent: ${current}s`, 
            current
        );

        if (input !== null) {
            const value = parseInt(input, 10);
            if (!isNaN(value) && value > 0 && value <= 60) {
                config.DOUBLE_TAP_SEEK_SECONDS = value;
                GM_setValue('config', config);
                showNotification(`Seek time set to ${value}s`);
            } else {
                showNotification(`Invalid input. Keeping ${current}s`, 'error');
            }
        }
    });

    // --- Glassmorphism UI Styles ---
    function injectStyles() {
        if (document.getElementById('vg-glassmorphism-styles')) return;

        const style = document.createElement('style');
        style.id = 'vg-glassmorphism-styles';
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
            
            /* Main Indicator - Glassmorphism Design */
            #vg-indicator {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.95);
                padding: 16px 24px;
                background: rgba(255, 255, 255, 0.08);
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.18);
                color: rgba(255, 255, 255, 0.95);
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 15px;
                font-weight: 500;
                border-radius: 20px;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                gap: 12px;
                opacity: 0;
                pointer-events: none;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 
                    0 8px 32px rgba(0, 0, 0, 0.2),
                    0 2px 8px rgba(0, 0, 0, 0.1),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                will-change: transform, opacity;
            }
            
            #vg-indicator.visible {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
            
            #vg-indicator.pulse {
                animation: vg-pulse 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            @keyframes vg-pulse {
                0%, 100% { transform: translate(-50%, -50%) scale(1); }
                50% { transform: translate(-50%, -50%) scale(1.05); }
            }
            
            /* Icon Container */
            #vg-indicator .vg-icon {
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                padding: 6px;
            }
            
            #vg-indicator svg {
                width: 100%;
                height: 100%;
                fill: currentColor;
                filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
            }
            
            /* Text Container */
            #vg-indicator .vg-text {
                font-size: 14px;
                letter-spacing: 0.3px;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
            }
            
            /* Progress Bar */
            #vg-indicator .vg-progress {
                position: absolute;
                bottom: -2px;
                left: 12px;
                right: 12px;
                height: 3px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 2px;
                overflow: hidden;
            }
            
            #vg-indicator .vg-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, 
                    rgba(59, 130, 246, 0.8),
                    rgba(147, 51, 234, 0.8));
                border-radius: 2px;
                transition: width 0.2s ease;
                box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
            }
            
            /* Brightness Overlay */
            #vg-brightness-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: black;
                opacity: 0;
                pointer-events: none;
                z-index: 2147483646;
                transition: opacity 0.15s linear;
                will-change: opacity;
            }
            
            /* Settings Panel */
            #vg-settings-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.95);
                width: min(90vw, 400px);
                max-height: 80vh;
                padding: 24px;
                background: rgba(255, 255, 255, 0.08);
                backdrop-filter: blur(40px) saturate(180%);
                -webkit-backdrop-filter: blur(40px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.18);
                border-radius: 24px;
                color: rgba(255, 255, 255, 0.95);
                font-family: 'Inter', sans-serif;
                z-index: 2147483648;
                opacity: 0;
                pointer-events: none;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 
                    0 20px 60px rgba(0, 0, 0, 0.3),
                    0 4px 12px rgba(0, 0, 0, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                overflow-y: auto;
            }
            
            #vg-settings-panel.visible {
                opacity: 1;
                pointer-events: all;
                transform: translate(-50%, -50%) scale(1);
            }
            
            /* Notification Toast */
            .vg-notification {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                padding: 12px 20px;
                background: rgba(255, 255, 255, 0.08);
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.18);
                border-radius: 16px;
                color: rgba(255, 255, 255, 0.95);
                font-family: 'Inter', sans-serif;
                font-size: 14px;
                z-index: 2147483647;
                opacity: 0;
                pointer-events: none;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 
                    0 8px 24px rgba(0, 0, 0, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
            }
            
            .vg-notification.visible {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
            
            .vg-notification.error {
                background: rgba(239, 68, 68, 0.15);
                border-color: rgba(239, 68, 68, 0.3);
            }
            
            /* Performance optimizations */
            #vg-indicator *,
            #vg-settings-panel *,
            .vg-notification * {
                box-sizing: border-box;
            }
        `;
        
        document.head.appendChild(style);
    }

    // --- UI Elements Management ---
    let uiElements = {
        indicator: null,
        brightnessOverlay: null,
        settingsPanel: null,
        timers: new Map() // Track all timers for cleanup
    };

    function createUIElements() {
        if (uiElements.indicator) return;

        // Main indicator
        uiElements.indicator = document.createElement('div');
        uiElements.indicator.id = 'vg-indicator';
        document.body.appendChild(uiElements.indicator);

        // Brightness overlay
        uiElements.brightnessOverlay = document.createElement('div');
        uiElements.brightnessOverlay.id = 'vg-brightness-overlay';
        document.body.appendChild(uiElements.brightnessOverlay);
    }

    // --- Optimized State Management ---
    let gestureState = null;
    let tapState = { time: 0, count: 0 };
    
    function resetGestureState() {
        // Clear all timers
        uiElements.timers.forEach(timer => clearTimeout(timer));
        uiElements.timers.clear();
        
        gestureState = null;
        tapState = { time: 0, count: 0 };
    }

    // --- Enhanced UI Functions ---
    function showIndicator(content, options = {}) {
        if (!uiElements.indicator) return;
        
        const { icon, text, progress, persistent = false, pulse = true } = options;
        
        let html = '';
        if (icon) {
            html += `<div class="vg-icon">${icon}</div>`;
        }
        if (text) {
            html += `<div class="vg-text">${text}</div>`;
        }
        if (progress !== undefined) {
            html += `
                <div class="vg-progress">
                    <div class="vg-progress-fill" style="width: ${progress}%"></div>
                </div>
            `;
        }
        
        uiElements.indicator.innerHTML = html;
        uiElements.indicator.classList.add('visible');
        
        if (pulse) {
            uiElements.indicator.classList.add('pulse');
            setTimeout(() => {
                uiElements.indicator.classList.remove('pulse');
            }, 400);
        }
        
        // Clear existing timer
        if (uiElements.timers.has('indicator')) {
            clearTimeout(uiElements.timers.get('indicator'));
        }
        
        if (!persistent) {
            const timer = setTimeout(() => {
                hideIndicator();
                uiElements.timers.delete('indicator');
            }, 800);
            uiElements.timers.set('indicator', timer);
        }
    }

    function hideIndicator() {
        if (uiElements.indicator) {
            uiElements.indicator.classList.remove('visible');
        }
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `vg-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Force reflow for animation
        notification.offsetHeight;
        notification.classList.add('visible');
        
        setTimeout(() => {
            notification.classList.remove('visible');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    function showSettingsPanel() {
        // Implementation for settings panel
        showNotification('Settings panel coming soon!');
    }

    function triggerHapticFeedback() {
        if (config.ENABLE_HAPTIC_FEEDBACK && navigator.vibrate) {
            navigator.vibrate(config.HAPTIC_FEEDBACK_DURATION_MS);
        }
    }

    // --- Optimized Video Discovery ---
    function findVideoAndPlayer(target) {
        // Check cache first
        if (elementCache.has(target)) {
            const cached = elementCache.get(target);
            if (cached.timestamp > Date.now() - 1000) {
                return cached.data;
            }
        }
        
        try {
            let video = null;
            
            // Priority: fullscreen video
            if (document.fullscreenElement) {
                video = document.fullscreenElement.querySelector('video');
            }
            
            // Fallback: closest video
            if (!video && target?.closest) {
                video = target.closest('video');
            }
            
            // Last resort: largest playing video
            if (!video) {
                const videos = Array.from(document.querySelectorAll('video'))
                    .filter(v => !v.paused && v.readyState >= 2)
                    .map(v => {
                        const rect = v.getBoundingClientRect();
                        return { video: v, area: rect.width * rect.height };
                    })
                    .sort((a, b) => b.area - a.area);
                
                video = videos[0]?.video;
            }
            
            if (!video) return null;
            
            const container = video.closest('.html5-video-player, .player, .video-js, [data-vjs-player], .jwplayer') 
                || video.parentElement;
            
            const result = { video, container };
            
            // Cache result
            elementCache.set(target, {
                data: result,
                timestamp: Date.now()
            });
            
            return result;
        } catch (error) {
            ErrorHandler.handleError(error, 'video-discovery');
            return null;
        }
    }

    // --- Event Handlers with Memory Management ---
    const handleTouchStart = ErrorHandler.wrapFunction((e) => {
        const result = findVideoAndPlayer(e.target);
        
        if (!result?.video || 
            result.video.duration < config.MIN_VIDEO_DURATION_SECONDS || 
            e.touches.length > 1) {
            resetGestureState();
            return;
        }
        
        e.stopPropagation();
        
        gestureState = {
            video: result.video,
            container: result.container,
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY,
            startTime: Date.now(),
            isSwipe: false,
            action: 'none',
            finalized: false,
            originalPlaybackRate: result.video.playbackRate,
            initialBrightness: 1 - parseFloat(uiElements.brightnessOverlay.style.opacity || 0),
            initialVolume: result.video.volume,
        };
        
        // Handle double tap
        if (Date.now() - tapState.time < config.DOUBLE_TAP_TIMEOUT_MS) {
            tapState.count++;
        } else {
            tapState.count = 1;
        }
        tapState.time = Date.now();
        
        // Setup long press
        if (document.fullscreenElement) {
            const timer = setTimeout(() => {
                handleLongPress();
                uiElements.timers.delete('longPress');
            }, config.LONG_PRESS_DURATION_MS);
            uiElements.timers.set('longPress', timer);
        }
    }, 'touchstart');

    const handleTouchMove = ErrorHandler.wrapFunction((e) => {
        if (!gestureState || e.touches.length > 1) return;
        
        e.stopPropagation();
        
        const deltaX = e.touches[0].clientX - gestureState.startX;
        const deltaY = e.touches[0].clientY - gestureState.startY;
        const distance = Math.hypot(deltaX, deltaY);
        
        if (!gestureState.isSwipe && distance > config.SWIPE_THRESHOLD) {
            // Cancel long press
            if (uiElements.timers.has('longPress')) {
                clearTimeout(uiElements.timers.get('longPress'));
                uiElements.timers.delete('longPress');
            }
            
            tapState.count = 0;
            
            if (gestureState.action === 'long-press-speed') {
                gestureState.video.playbackRate = gestureState.originalPlaybackRate;
                hideIndicator();
            }
            
            gestureState.isSwipe = true;
            
            if (document.fullscreenElement) {
                const rect = gestureState.video.getBoundingClientRect();
                const zoneX = (gestureState.startX - rect.left) / rect.width;
                const isVertical = Math.abs(deltaY) > Math.abs(deltaX);
                
                if (isVertical) {
                    if (zoneX < 0.33) gestureState.action = 'brightness';
                    else if (zoneX > 0.66) gestureState.action = 'volume';
                    else gestureState.action = 'fullscreen';
                } else {
                    gestureState.action = 'seeking';
                }
            }
        }
        
        if (gestureState.isSwipe) {
            e.preventDefault();
            handleSwipeAction(deltaX, deltaY);
        }
    }, 'touchmove');

    const handleTouchEnd = ErrorHandler.wrapFunction((e) => {
        if (!gestureState || gestureState.finalized) return;
        
        // Clear long press timer
        if (uiElements.timers.has('longPress')) {
            clearTimeout(uiElements.timers.get('longPress'));
            uiElements.timers.delete('longPress');
        }
        
        e.stopPropagation();
        gestureState.finalized = true;
        
        if (gestureState.action === 'long-press-speed') {
            gestureState.video.playbackRate = gestureState.originalPlaybackRate;
            hideIndicator();
        } else if (gestureState.isSwipe) {
            finalizeSwipe(e);
        } else if (tapState.count >= 2) {
            e.preventDefault();
            if (document.fullscreenElement) {
                handleDoubleTapSeek(gestureState.video, gestureState.startX);
            } else {
                toggleFullscreen();
            }
            tapState = { time: 0, count: 0 };
        }
        
        resetGestureState();
    }, 'touchend');

    // --- Gesture Actions ---
    function handleLongPress() {
        if (!gestureState || gestureState.isSwipe) return;
        
        gestureState.action = 'long-press-speed';
        gestureState.video.playbackRate = 2.0;
        
        const icon = `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`;
        showIndicator('', {
            icon,
            text: '2.0x Speed',
            persistent: true,
            pulse: true
        });
        
        triggerHapticFeedback();
    }

    function handleSwipeAction(deltaX, deltaY) {
        switch (gestureState.action) {
            case 'seeking':
                handleSeek(deltaX);
                break;
            case 'volume':
                handleVolume(deltaY);
                break;
            case 'brightness':
                handleBrightness(deltaY);
                break;
        }
    }

    function handleSeek(deltaX) {
        const video = gestureState.video;
        const seekTime = deltaX * config.SEEK_SENSITIVITY;
        const newTime = Math.max(0, Math.min(video.duration, video.currentTime + seekTime));
        
        const icon = seekTime > 0 
            ? `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`
            : `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6L20 6v12l-8.5-6z"/></svg>`;
        
        showIndicator('', {
            icon,
            text: formatTime(newTime),
            progress: (newTime / video.duration) * 100
        });
    }

    function handleVolume(deltaY) {
        const video = gestureState.video;
        const change = -deltaY / config.VOLUME_SENSITIVITY;
        const newVolume = Math.max(0, Math.min(1, gestureState.initialVolume + change));
        video.volume = newVolume;
        
        const icon = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
        
        showIndicator('', {
            icon,
            text: `${Math.round(newVolume * 100)}%`,
            progress: newVolume * 100
        });
    }

    function handleBrightness(deltaY) {
        const change = -deltaY / config.BRIGHTNESS_SENSITIVITY;
        const newBrightness = Math.max(0.1, Math.min(1, gestureState.initialBrightness + change));
        
        uiElements.brightnessOverlay.style.opacity = 1 - newBrightness;
        
        const icon = `<svg viewBox="0 0 24 24"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>`;
        
        showIndicator('', {
            icon,
            text: `${Math.round(newBrightness * 100)}%`,
            progress: newBrightness * 100
        });
    }

    function handleDoubleTapSeek(video, touchX) {
        const rect = video.getBoundingClientRect();
        const zone = (touchX - rect.left) / rect.width;
        
        if (zone < 0.4) {
            video.currentTime -= config.DOUBLE_TAP_SEEK_SECONDS;
            const icon = `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6L20 6v12l-8.5-6z"/></svg>`;
            showIndicator('', {
                icon,
                text: `-${config.DOUBLE_TAP_SEEK_SECONDS}s`,
                pulse: true
            });
        } else if (zone > 0.6) {
            video.currentTime += config.DOUBLE_TAP_SEEK_SECONDS;
            const icon = `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`;
            showIndicator('', {
                icon,
                text: `+${config.DOUBLE_TAP_SEEK_SECONDS}s`,
                pulse: true
            });
        } else {
            video.paused ? video.play() : video.pause();
            const icon = video.paused 
                ? `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`
                : `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
            showIndicator('', { icon, pulse: true });
        }
        
        triggerHapticFeedback();
    }

    function toggleFullscreen() {
        const isFullscreen = !!document.fullscreenElement;
        
        const icon = isFullscreen
            ? `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`
            : `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
        
        showIndicator('', { icon, pulse: true });
        triggerHapticFeedback();
        
        if (isFullscreen) {
            document.exitFullscreen();
        } else if (gestureState?.container) {
            const promise = gestureState.container.requestFullscreen();
            
            if (config.FORCE_LANDSCAPE && gestureState.video.videoWidth > gestureState.video.videoHeight) {
                promise?.then(() => {
                    screen.orientation?.lock?.('landscape')?.catch(() => {});
                });
            }
        }
    }

    function finalizeSwipe(e) {
        switch (gestureState.action) {
            case 'seeking':
                const deltaX = e.changedTouches[0].clientX - gestureState.startX;
                const seekTime = deltaX * config.SEEK_SENSITIVITY;
                gestureState.video.currentTime += seekTime;
                triggerHapticFeedback();
                break;
                
            case 'volume':
            case 'brightness':
                triggerHapticFeedback();
                break;
                
            case 'fullscreen':
                const deltaY = e.changedTouches[0].clientY - gestureState.startY;
                if (Math.abs(deltaY) > config.SWIPE_THRESHOLD) {
                    toggleFullscreen();
                }
                break;
        }
    }

    // --- Utilities ---
    function formatTime
