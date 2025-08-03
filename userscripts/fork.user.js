// ==UserScript==
// @name          Video Gestures Ultra
// @namespace     https://github.com/enhanced-userscripts/video-gestures-ultra
// @version       12.0.0
// @description   Ultra-robust video gesture controls with advanced conflict resolution, Shadow DOM support, and mobile-first design
// @author        Enhanced UserScripts Team
// @match         *://*/*
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_registerMenuCommand
// @grant         GM_addStyle
// @run-at        document-start
// ==/UserScript==

(function() {
    'use strict';

    // === ULTRA CONFIGURATION ===
    const ULTRA_CONFIG = {
        // Core gesture settings
        GESTURE_SENSITIVITY: {
            swipe: 20,          // Lower = more sensitive
            tap: 30,            // Movement threshold for tap detection
            longPress: 400,     // ms for long press activation
            doubleTap: 350,     // ms between taps for double tap
            debounce: 12        // ms debounce for performance
        },
        
        // Video control settings
        VIDEO_CONTROLS: {
            minDuration: 10,    // Minimum video duration to activate
            seekStep: 10,       // Seconds to seek on double tap
            speedMultiplier: 2, // Speed for long press
            volumeStep: 0.1,    // Volume change step
            brightnessStep: 0.1 // Brightness change step
        },
        
        // Conflict resolution
        CONFLICT_RESOLUTION: {
            nativeBlockDuration: 1000,     // ms to block after native control use
            touchCancelGrace: 200,         // ms grace period for touch cancel
            multiTouchIgnore: true,        // Ignore multi-touch
            shadowDomSupport: true,        // Enable Shadow DOM detection
            preventDefaultSelective: true  // Only preventDefault when necessary
        },
        
        // UI settings
        UI_CONFIG: {
            indicatorDuration: 800,
            animationSpeed: 200,
            hapticFeedback: true,
            highContrast: false,
            reducedMotion: false
        },
        
        // Performance
        PERFORMANCE: {
            maxCachedVideos: 5,
            cleanupInterval: 45000,
            maxEventListeners: 50
        },
        
        // Debug
        DEBUG: false
    };

    // === ULTRA GESTURE STATE MACHINE ===
    class UltraGestureState {
        constructor() {
            this.reset();
            this.videoRegistry = new Map();
            this.eventListeners = new Set();
            this.nativeBlockedUntil = 0;
            this.lastCleanup = Date.now();
        }

        reset() {
            this.activeGesture = null;
            this.tapState = { count: 0, lastTime: 0, lastX: 0, lastY: 0 };
            this.timeouts = new Set();
            this.touchActive = false;
            this.isProcessingGesture = false;
        }

        blockNativeControls(duration = ULTRA_CONFIG.CONFLICT_RESOLUTION.nativeBlockDuration) {
            this.nativeBlockedUntil = Date.now() + duration;
            this.log('🚫 Native controls blocked for', duration, 'ms');
        }

        isNativeBlocked() {
            return Date.now() < this.nativeBlockedUntil;
        }

        addTimeout(callback, delay) {
            const id = setTimeout(() => {
                callback();
                this.timeouts.delete(id);
            }, delay);
            this.timeouts.add(id);
            return id;
        }

        clearAllTimeouts() {
            this.timeouts.forEach(id => clearTimeout(id));
            this.timeouts.clear();
        }

        log(...args) {
            if (ULTRA_CONFIG.DEBUG) {
                console.log('[VGU]', ...args);
            }
        }

        registerVideo(video) {
            if (this.videoRegistry.has(video)) return;
            
            const videoData = {
                element: video,
                rect: video.getBoundingClientRect(),
                container: this.findVideoContainer(video),
                lastAccess: Date.now(),
                shadowRoot: video.getRootNode()
            };
            
            this.videoRegistry.set(video, videoData);
            this.log('📹 Registered video:', video);
        }

        findVideoContainer(video) {
            const containers = [
                '.html5-video-player', '.player', '.video-js', '[data-vjs-player]',
                '.jwplayer', '.video-container', '.player-container', '.plyr',
                '.flowplayer', '.videojs', '.mejs-container', '.video-wrapper'
            ];
            
            for (const selector of containers) {
                const container = video.closest(selector);
                if (container) return container;
            }
            return video.parentElement;
        }

        cleanup() {
            const now = Date.now();
            if (now - this.lastCleanup < ULTRA_CONFIG.PERFORMANCE.cleanupInterval) return;

            // Remove stale video entries
            for (const [video, data] of this.videoRegistry) {
                if (!document.contains(video) || now - data.lastAccess > 60000) {
                    this.videoRegistry.delete(video);
                }
            }

            this.lastCleanup = now;
            this.log('🧹 Cleanup complete. Videos cached:', this.videoRegistry.size);
        }
    }

    // === ULTRA VIDEO MANAGER ===
    class UltraVideoManager {
        constructor(gestureState) {
            this.gestureState = gestureState;
            this.mutationObserver = null;
            this.setupVideoDiscovery();
            this.setupNativeControlsDetection();
        }

        setupVideoDiscovery() {
            // Initial scan
            this.scanForVideos();
            
            // Watch for new videos (including Shadow DOM)
            this.mutationObserver = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.scanNodeForVideos(node);
                        }
                    });
                });
            });

            if (document.body) {
                this.mutationObserver.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            } else {
                document.addEventListener('DOMContentLoaded', () => {
                    this.mutationObserver.observe(document.body, {
                        childList: true,
                        subtree: true
                    });
                });
            }
        }

        scanForVideos() {
            // Regular DOM videos
            document.querySelectorAll('video').forEach(video => {
                this.gestureState.registerVideo(video);
            });

            // Shadow DOM videos (for modern players)
            if (ULTRA_CONFIG.CONFLICT_RESOLUTION.shadowDomSupport) {
                this.scanShadowRoots(document.body);
            }
        }

        scanShadowRoots(element) {
            if (!element) return;
            
            // Check if element has shadow root
            if (element.shadowRoot) {
                element.shadowRoot.querySelectorAll('video').forEach(video => {
                    this.gestureState.registerVideo(video);
                });
                // Recursively scan shadow DOM
                this.scanShadowRoots(element.shadowRoot);
            }

            // Scan children
            element.querySelectorAll('*').forEach(child => {
                if (child.shadowRoot) {
                    this.scanShadowRoots(child);
                }
            });
        }

        scanNodeForVideos(node) {
            if (node.matches && node.matches('video')) {
                this.gestureState.registerVideo(node);
            }
            
            node.querySelectorAll?.('video').forEach(video => {
                this.gestureState.registerVideo(video);
            });

            // Check shadow DOM if enabled
            if (ULTRA_CONFIG.CONFLICT_RESOLUTION.shadowDomSupport && node.shadowRoot) {
                this.scanShadowRoots(node);
            }
        }

        setupNativeControlsDetection() {
            const nativeSelectors = [
                'button[aria-label*="play" i]', 'button[aria-label*="pause" i]',
                'button[title*="play" i]', 'button[title*="pause" i]',
                '.vjs-play-control', '.ytp-play-button', '.jw-icon-playback',
                '.plyr__control--overlaid', '.flowplayer .fp-play',
                '[data-plyr="play"]', '.mejs-playpause-button'
            ];

            // Enhanced click detection with event delegation
            document.addEventListener('click', (e) => {
                if (this.isNativeControl(e.target, nativeSelectors)) {
                    this.gestureState.blockNativeControls();
                }
            }, true);

            // Keyboard controls
            document.addEventListener('keydown', (e) => {
                if ((e.code === 'Space' || e.key === 'k') && 
                    !e.target.matches('input, textarea, [contenteditable]')) {
                    this.gestureState.blockNativeControls();
                }
            }, true);

            // Video events
            document.addEventListener('play', (e) => {
                if (e.target.tagName === 'VIDEO' && !this.gestureState.activeGesture) {
                    this.gestureState.blockNativeControls();
                }
            }, true);

            document.addEventListener('pause', (e) => {
                if (e.target.tagName === 'VIDEO' && !this.gestureState.activeGesture) {
                    this.gestureState.blockNativeControls();
                }
            }, true);
        }

        isNativeControl(element, selectors) {
            let current = element;
            let depth = 0;
            
            while (current && depth < 5) {
                if (current.matches && current.matches(selectors.join(','))) {
                    return true;
                }
                
                const text = current.textContent?.toLowerCase() || '';
                const aria = current.getAttribute?.('aria-label')?.toLowerCase() || '';
                const title = current.getAttribute?.('title')?.toLowerCase() || '';
                const className = current.className?.toLowerCase() || '';
                
                if ((text.includes('play') || text.includes('pause') ||
                     aria.includes('play') || aria.includes('pause') ||
                     title.includes('play') || title.includes('pause') ||
                     className.includes('play') || className.includes('pause')) &&
                    (current.tagName === 'BUTTON' || current.role === 'button')) {
                    return true;
                }
                
                current = current.parentElement;
                depth++;
            }
            
            return false;
        }

        findTargetVideo(touchTarget) {
            // Check fullscreen first
            if (document.fullscreenElement) {
                const fsVideo = document.fullscreenElement.querySelector('video') ||
                               (document.fullscreenElement.tagName === 'VIDEO' ? document.fullscreenElement : null);
                if (fsVideo) {
                    const cached = this.gestureState.videoRegistry.get(fsVideo);
                    if (cached) {
                        cached.lastAccess = Date.now();
                        return cached;
                    }
                }
            }

            // Check if touch target is video
            if (touchTarget.tagName === 'VIDEO') {
                const cached = this.gestureState.videoRegistry.get(touchTarget);
                if (cached) {
                    cached.lastAccess = Date.now();
                    return cached;
                }
            }

            // Find closest video
            const closestVideo = touchTarget.closest('video');
            if (closestVideo) {
                const cached = this.gestureState.videoRegistry.get(closestVideo);
                if (cached) {
                    cached.lastAccess = Date.now();
                    return cached;
                }
            }

            // Find largest playing video
            return this.findBestVideo();
        }

        findBestVideo() {
            let bestVideo = null;
            let bestScore = 0;

            for (const [video, data] of this.gestureState.videoRegistry) {
                if (video.readyState < 1) continue;
                
                const rect = video.getBoundingClientRect();
                const area = rect.width * rect.height;
                const isVisible = rect.width > 0 && rect.height > 0;
                const isPlaying = !video.paused;
                const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;
                
                const score = area * 
                    (isVisible ? 1 : 0) * 
                    (isPlaying ? 1.5 : 1) * 
                    (isInViewport ? 2 : 1);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestVideo = data;
                }
            }

            if (bestVideo) {
                bestVideo.lastAccess = Date.now();
            }

            return bestVideo;
        }

        isValidGestureArea(point, videoData) {
            if (document.fullscreenElement) return true;
            if (!videoData) return false;
            
            const rect = videoData.rect;
            return point.x >= rect.left && point.x <= rect.right &&
                   point.y >= rect.top && point.y <= rect.bottom;
        }
    }

    // === ULTRA UI MANAGER ===
    class UltraUIManager {
        constructor() {
            this.elements = {};
            this.animationQueue = new Map();
            this.init();
        }

        init() {
            this.injectStyles();
            this.createElements();
        }

        injectStyles() {
            GM_addStyle(`
                .vgu-indicator {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    padding: 12px 18px;
                    background: rgba(0, 0, 0, 0.9);
                    color: white;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 16px;
                    font-weight: 600;
                    border-radius: 16px;
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
                    z-index: 2147483647;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    opacity: 0;
                    pointer-events: none;
                    transition: all ${ULTRA_CONFIG.UI_CONFIG.animationSpeed}ms cubic-bezier(0.2, 0.8, 0.2, 1);
                    transform-origin: center;
                }
                
                .vgu-indicator.visible {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
                
                .vgu-indicator:not(.visible) {
                    transform: translate(-50%, -50%) scale(0.8);
                }
                
                .vgu-icon {
                    width: 20px;
                    height: 20px;
                    fill: currentColor;
                    flex-shrink: 0;
                }
                
                .vgu-brightness-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: black;
                    opacity: 0;
                    pointer-events: none;
                    z-index: 2147483646;
                    transition: opacity 100ms linear;
                }
                
                .vgu-glow {
                    position: absolute;
                    border: 3px solid #007AFF;
                    border-radius: 12px;
                    pointer-events: none;
                    opacity: 0;
                    z-index: 2147483645;
                    box-shadow: 0 0 30px rgba(0, 122, 255, 0.5);
                    transition: all 300ms ease;
                }
                
                .vgu-glow.visible {
                    opacity: 1;
                    transform: scale(1.03);
                }
                
                @keyframes vgu-pulse {
                    0%, 100% { transform: translate(-50%, -50%) scale(1); }
                    50% { transform: translate(-50%, -50%) scale(1.05); }
                }
                
                .vgu-indicator.pulse {
                    animation: vgu-pulse 1s ease-in-out infinite;
                }
                
                @media (prefers-reduced-motion: reduce) {
                    .vgu-indicator, .vgu-glow {
                        transition: none !important;
                        animation: none !important;
                    }
                }
                
                @media (prefers-contrast: high) {
                    .vgu-indicator {
                        background: black;
                        border: 2px solid white;
                        color: white;
                    }
                }
            `);
        }

        createElements() {
            const createWhenReady = () => {
                if (!document.body) {
                    setTimeout(createWhenReady, 50);
                    return;
                }

                // Indicator
                this.elements.indicator = document.createElement('div');
                this.elements.indicator.className = 'vgu-indicator';
                
                // Brightness overlay
                this.elements.brightnessOverlay = document.createElement('div');
                this.elements.brightnessOverlay.className = 'vgu-brightness-overlay';
                
                // Glow effect
                this.elements.glow = document.createElement('div');
                this.elements.glow.className = 'vgu-glow';
                
                document.body.append(
                    this.elements.indicator,
                    this.elements.brightnessOverlay,
                    this.elements.glow
                );
            };
            
            createWhenReady();
        }

        showIndicator(iconType, text = '', duration = ULTRA_CONFIG.UI_CONFIG.indicatorDuration, pulse = false) {
            const indicator = this.elements.indicator;
            if (!indicator) return;

            const icons = {
                play: `<svg class="vgu-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
                pause: `<svg class="vgu-icon" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
                seekForward: `<svg class="vgu-icon" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`,
                seekBackward: `<svg class="vgu-icon" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>`,
                speed: `<svg class="vgu-icon" viewBox="0 0 24 24"><path d="M13,2.05V5.08C16.39,5.57 19,8.47 19,12C19,12.9 18.82,13.75 18.5,14.54L21.12,16.07C21.68,14.83 22,13.45 22,12C22,6.82 18.05,2.55 13,2.05M12,19C8.13,19 5,15.87 5,12C5,8.13 8.13,5 12,5V2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C13.54,22 14.95,21.56 16.14,20.83L14,18.69C13.39,18.89 12.71,19 12,19Z"/></svg>`,
                volume: `<svg class="vgu-icon" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>`,
                brightness: `<svg class="vgu-icon" viewBox="0 0 24 24"><path d="M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8M12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18M20,8.69V4H15.31L12,0.69L8.69,4H4V8.69L0.69,12L4,15.31V20H8.69L12,23.31L15.31,20H20V15.31L23.31,12L20,8.69Z"/></svg>`,
                fullscreen: `<svg class="vgu-icon" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`
            };

            const icon = icons[iconType] || icons.play;
            indicator.innerHTML = text ? `${icon}<span>${text}</span>` : icon;
            
            indicator.classList.toggle('pulse', pulse);
            indicator.classList.add('visible');

            if (duration !== Infinity) {
                setTimeout(() => {
                    indicator.classList.remove('visible', 'pulse');
                }, duration);
            }
        }

        hideIndicator() {
            if (this.elements.indicator) {
                this.elements.indicator.classList.remove('visible', 'pulse');
            }
        }

        showGlow(video, duration = 600) {
            if (!video || !this.elements.glow) return;
            
            const rect = video.getBoundingClientRect();
            const glow = this.elements.glow;
            
            Object.assign(glow.style, {
                left: `${rect.left - 6}px`,
                top: `${rect.top - 6}px`,
                width: `${rect.width + 12}px`,
                height: `${rect.height + 12}px`
            });
            
            glow.classList.add('visible');
            setTimeout(() => glow.classList.remove('visible'), duration);
        }

        updateBrightness(value) {
            if (this.elements.brightnessOverlay) {
                this.elements.brightnessOverlay.style.opacity = Math.max(0, Math.min(1, 1 - value));
            }
        }
    }

    // === ULTRA GESTURE ENGINE ===
    class UltraGestureEngine {
        constructor(gestureState, videoManager, uiManager) {
            this.gestureState = gestureState;
            this.videoManager = videoManager;
            this.uiManager = uiManager;
            this.setupEventListeners();
        }

        setupEventListeners() {
            const options = { passive: false, capture: true };
            
            document.addEventListener('touchstart', this.handleTouchStart.bind(this), options);
            document.addEventListener('touchmove', this.handleTouchMove.bind(this), options);
            document.addEventListener('touchend', this.handleTouchEnd.bind(this), options);
            document.addEventListener('touchcancel', this.handleTouchCancel.bind(this), options);
            document.addEventListener('contextmenu', this.handleContextMenu.bind(this), options);
        }

        handleTouchStart(e) {
            this.gestureState.log('👆 Touch start:', e.touches.length, 'touches');
            
            // Block if native controls recently used
            if (this.gestureState.isNativeBlocked()) {
                this.gestureState.log('🚫 Blocked by native controls');
                return;
            }

            // Ignore multi-touch if configured
            if (ULTRA_CONFIG.CONFLICT_RESOLUTION.multiTouchIgnore && e.touches.length > 1) {
                this.gestureState.log('❌ Multi-touch ignored');
                return;
            }

            const touch = e.touches[0];
            const touchPoint = { x: touch.clientX, y: touch.clientY };
            const videoData = this.videoManager.findTargetVideo(e.target);

            if (!videoData || 
                videoData.element.duration < ULTRA_CONFIG.VIDEO_CONTROLS.minDuration ||
                !this.videoManager.isValidGestureArea(touchPoint, videoData)) {
                this.gestureState.log('❌ Invalid gesture area or video');
                return;
            }

            this.gestureState.touchActive = true;
            this.gestureState.activeGesture = {
                videoData,
                startPoint: touchPoint,
                currentPoint: touchPoint,
                startTime: performance.now(),
                isSwipe: false,
                action: null,
                originalPlaybackRate: videoData.element.playbackRate,
                initialBrightness: 1 - parseFloat(this.uiManager.elements.brightnessOverlay.style.opacity || 0),
                initialVolume: videoData.element.volume
            };

            this.updateTapCount(touchPoint);
            this.scheduleLongPress();
        }

        handleTouchMove(e) {
            if (!this.gestureState.activeGesture || !this.gestureState.touchActive) return;

            const touch = e.touches[0];
            const gesture = this.gestureState.activeGesture;
            const currentPoint = { x: touch.clientX, y: touch.clientY };
            
            const deltaX = currentPoint.x - gesture.startPoint.x;
            const deltaY = currentPoint.y - gesture.startPoint.y;
            const distance = Math.hypot(deltaX, deltaY);

            gesture.currentPoint = currentPoint;

            if (!gesture.isSwipe && distance > ULTRA_CONFIG.GESTURE_SENSITIVITY.swipe) {
                this.initializeSwipe(deltaX, deltaY);
                if (ULTRA_CONFIG.CONFLICT_RESOLUTION.preventDefaultSelective) {
                    e.preventDefault();
                }
            }

            if (gesture.isSwipe) {
                this.handleSwipeMove(deltaX, deltaY);
                e.preventDefault();
            }
        }

        handleTouchEnd(e) {
            if (!this.gestureState.activeGesture || !this.gestureState.touchActive) return;

            this.gestureState.touchActive = false;
            const gesture = this.gestureState.activeGesture;
            
            const deltaX = gesture.currentPoint.x - gesture.startPoint.x;
            const deltaY = gesture.currentPoint.y - gesture.startPoint.y;
            const movement = Math.hypot(deltaX, deltaY);

            if (gesture.action === 'long-press') {
                this.finalizeLongPress();
            } else if (gesture.isSwipe) {
                this.finalizeSwipe(deltaX, deltaY);
            } else if (movement < ULTRA_CONFIG.GESTURE_SENSITIVITY.tap) {
                this.handleTap();
            }

            this.cleanup();
        }

        handleTouchCancel(e) {
            this.gestureState.log('🚫 Touch cancelled');
            if (this.gestureState.activeGesture?.action === 'long-press') {
                this.finalizeLongPress();
            }
            this.cleanup();
        }

        handleContextMenu(e) {
            if (this.gestureState.activeGesture) {
                e.preventDefault();
            }
        }

        updateTapCount(point) {
            const now = Date.now();
            const tapState = this.gestureState.tapState;
            
            if (now - tapState.lastTime < ULTRA_CONFIG.GESTURE_SENSITIVITY.doubleTap &&
                Math.hypot(point.x - tapState.lastX, point.y - tapState.lastY) < 50) {
                tapState.count++;
            } else {
                tapState.count = 1;
            }
            
            Object.assign(tapState, { lastTime: now, lastX: point.x, lastY: point.y });
        }

        scheduleLongPress() {
            this.gestureState.addTimeout(() => {
                if (this.gestureState.activeGesture && !this.gestureState.activeGesture.isSwipe) {
                    this.handleLongPress();
                }
            }, ULTRA_CONFIG.GESTURE_SENSITIVITY.longPress);
        }

        handleLongPress() {
            const gesture = this.gestureState.activeGesture;
            if (!gesture) return;

            gesture.action = 'long-press';
            gesture.videoData.element.playbackRate = ULTRA_CONFIG.VIDEO_CONTROLS.speedMultiplier;
            
            this.uiManager.showIndicator('speed', `${ULTRA_CONFIG.VIDEO_CONTROLS.speedMultiplier}x`, Infinity, true);
            this.triggerHaptic();
        }

        finalizeLongPress() {
            const gesture = this.gestureState.activeGesture;
            if (!gesture) return;
            
            gesture.videoData.element.playbackRate = gesture.originalPlaybackRate;
            this.uiManager.hideIndicator();
        }

        initializeSwipe(deltaX, deltaY) {
            const gesture = this.gestureState.activeGesture;
            gesture.isSwipe = true;
            this.gestureState.clearAllTimeouts();

            if (gesture.action === 'long-press') {
                this.finalizeLongPress();
            }

            // Determine swipe action
            if (document.fullscreenElement) {
                const rect = gesture.videoData.rect;
                const zoneX = (gesture.startPoint.x - rect.left) / rect.width;
                const isVertical = Math.abs(deltaY) > Math.abs(deltaX);

                if (isVertical) {
                    gesture.action = zoneX < 0.3 ? 'brightness' : 
                                   zoneX > 0.7 ? 'volume' : 'fullscreen';
                } else {
                    gesture.action = 'seeking';
                }
            } else {
                gesture.action = Math.abs(deltaX) > Math.abs(deltaY) ? 'seeking' : 'fullscreen';
            }
        }

        handleSwipeMove(deltaX, deltaY) {
            const gesture = this.gestureState.activeGesture;
            
            switch (gesture.action) {
                case 'seeking':
                    this.updateSeeking(deltaX);
                    break;
                case 'volume':
                    this.updateVolume(deltaY);
                    break;
                case 'brightness':
                    this.updateBrightness(deltaY);
                    break;
            }
        }

        updateSeeking(deltaX) {
            const gesture = this.gestureState.activeGesture;
            const video = gesture.videoData.element;
            const seekAmount = deltaX * 0.1;
            const newTime = Math.max(0, Math.min(video.duration, video.currentTime + seekAmount));
            
            const iconType = seekAmount > 0 ? 'seekForward' : 'seekBackward';
            const timeStr = this.formatTime(newTime);
            
            this.uiManager.showIndicator(iconType, timeStr, 100);
        }

        updateVolume(deltaY) {
            const gesture = this.gestureState.activeGesture;
            const video = gesture.videoData.element;
            const change = -deltaY * 0.003;
            const newVolume = Math.max(0, Math.min(1, gesture.initialVolume + change));
            
            video.volume = newVolume;
            this.uiManager.showIndicator('volume', `${Math.round(newVolume * 100)}%`, 100);
        }

        updateBrightness(deltaY) {
            const gesture = this.gestureState.activeGesture;
            const change = -deltaY * 0.003;
            const newBrightness = Math.max(0.1, Math.min(1, gesture.initialBrightness + change));
            
            this.uiManager.updateBrightness(newBrightness);
            this.uiManager.showIndicator('brightness', `${Math.round(newBrightness * 100)}%`, 100);
        }

        finalizeSwipe(deltaX, deltaY) {
            const gesture = this.gestureState.activeGesture;
            
            switch (gesture.action) {
                case 'seeking':
                    gesture.videoData.element.currentTime += deltaX * 0.1;
                    break;
                case 'fullscreen':
                    if (Math.abs(deltaY) > 50) {
                        this.toggleFullscreen();
                    }
                    break;
            }
            
            this.triggerHaptic();
        }

        handleTap() {
            const tapCount = this.gestureState.tapState.count;
            
            if (tapCount >= 2) {
                this.handleDoubleTap();
            } else {
                this.scheduleSingleTap();
            }
        }

        handleDoubleTap() {
            const gesture = this.gestureState.activeGesture;
            
            if (document.fullscreenElement) {
                const rect = gesture.videoData.rect;
                const zoneX = (gesture.startPoint.x - rect.left) / rect.width;
                
                if (zoneX < 0.3) {
                    gesture.videoData.element.currentTime -= ULTRA_CONFIG.VIDEO_CONTROLS.seekStep;
                    this.uiManager.showIndicator('seekBackward', `-${ULTRA_CONFIG.VIDEO_CONTROLS.seekStep}s`);
                } else if (zoneX > 0.7) {
                    gesture.videoData.element.currentTime += ULTRA_CONFIG.VIDEO_CONTROLS.seekStep;
                    this.uiManager.showIndicator('seekForward', `+${ULTRA_CONFIG.VIDEO_CONTROLS.seekStep}s`);
                } else {
                    this.togglePlayPause();
                }
            } else {
                this.toggleFullscreen();
            }
            
            this.gestureState.tapState = { count: 0, lastTime: 0, lastX: 0, lastY: 0 };
            this.triggerHaptic();
        }

        scheduleSingleTap() {
            this.gestureState.addTimeout(() => {
                if (this.gestureState.tapState.count === 1) {
                    this.togglePlayPause();
                    this.gestureState.tapState = { count: 0, lastTime: 0, lastX: 0, lastY: 0 };
                }
            }, ULTRA_CONFIG.GESTURE_SENSITIVITY.doubleTap);
        }

        togglePlayPause() {
            const gesture = this.gestureState.activeGesture;
            const video = gesture.videoData.element;
            const wasPlaying = !video.paused;
            
            if (wasPlaying) {
                video.pause();
            } else {
                video.play().catch(() => {});
            }
            
            if (document.fullscreenElement) {
                this.uiManager.showIndicator(wasPlaying ? 'pause' : 'play');
            } else {
                this.uiManager.showGlow(video);
            }
            
            this.triggerHaptic();
        }

        toggleFullscreen() {
            const isFullscreen = !!document.fullscreenElement;
            
            if (isFullscreen) {
                document.exitFullscreen().catch(() => {});
                this.uiManager.showIndicator('fullscreen');
            } else {
                const gesture = this.gestureState.activeGesture;
                gesture.videoData.container.requestFullscreen().catch(() => {});
                this.uiManager.showIndicator('fullscreen');
            }
            
            this.triggerHaptic();
        }

        triggerHaptic() {
            if (ULTRA_CONFIG.UI_CONFIG.hapticFeedback && navigator.vibrate) {
                navigator.vibrate(10);
            }
        }

        formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }

        cleanup() {
            this.gestureState.clearAllTimeouts();
            this.gestureState.reset();
        }
    }

    // === ULTRA INITIALIZATION ===
    class VideoGesturesUltra {
        constructor() {
            this.gestureState = new UltraGestureState();
            this.videoManager = new UltraVideoManager(this.gestureState);
            this.uiManager = new UltraUIManager();
            this.gestureEngine = new UltraGestureEngine(
                this.gestureState, 
                this.videoManager, 
                this.uiManager
            );
            
            this.setupCleanupInterval();
            this.setupConfigMenu();
            
            if (ULTRA_CONFIG.DEBUG) {
                window.VGU = this;
                console.log('🚀 Video Gestures Ultra initialized');
            }
        }

        setupCleanupInterval() {
            setInterval(() => {
                this.gestureState.cleanup();
            }, ULTRA_CONFIG.PERFORMANCE.cleanupInterval);
        }

        setupConfigMenu() {
            GM_registerMenuCommand('⚙️ Toggle Debug Mode', () => {
                ULTRA_CONFIG.DEBUG = !ULTRA_CONFIG.DEBUG;
                alert(`Debug mode: ${ULTRA_CONFIG.DEBUG ? 'ON' : 'OFF'}`);
            });

            GM_registerMenuCommand('🎯 Adjust Sensitivity', () => {
                const newValue = prompt('Swipe sensitivity (10-50):', ULTRA_CONFIG.GESTURE_SENSITIVITY.swipe);
                if (newValue && !isNaN(newValue)) {
                    ULTRA_CONFIG.GESTURE_SENSITIVITY.swipe = Math.max(10, Math.min(50, parseInt(newValue)));
                    alert(`Sensitivity set to ${ULTRA_CONFIG.GESTURE_SENSITIVITY.swipe}`);
                }
            });

            GM_registerMenuCommand('📊 Performance Stats', () => {
                const stats = `Videos cached: ${this.gestureState.videoRegistry.size}
Event listeners: ${this.gestureState.eventListeners.size}
Native blocked: ${this.gestureState.isNativeBlocked() ? 'Yes' : 'No'}`;
                alert(stats);
            });
        }
    }

    // === LAUNCH ===
    function launch() {
        try {
            new VideoGesturesUltra();
        } catch (error) {
            console.error('❌ Video Gestures Ultra failed to initialize:', error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', launch, { once: true });
    } else {
        launch();
    }

    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
        if (window.VGU) {
            window.VGU.gestureState.clearAllTimeouts();
        }
    });

})();
