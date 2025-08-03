// ==UserScript==
// @name          Video Gestures Pro Enhanced
// @namespace     https://github.com/enhanced-userscripts/video-gestures
// @version       12.0.0
// @description   High-performance video gesture controls with optimized UI/UX, reduced memory footprint, enhanced accessibility, and comprehensive error handling
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

    // --- Performance-Optimized Configuration ---
    const CONFIG = {
        // Core settings
        MIN_VIDEO_DURATION_SECONDS: 10, // Reduced from 30 for better usability
        DOUBLE_TAP_SEEK_SECONDS: 5,
        SWIPE_THRESHOLD: 25, // Reduced from 35 for better sensitivity
        SEEK_SENSITIVITY: 0.35, // Increased from 0.2 for more responsive seeking
        BRIGHTNESS_SENSITIVITY: 150, // Reduced from 200 for more sensitive brightness
        VOLUME_SENSITIVITY: 180, // Reduced from 250 for more sensitive volume
        
        // Timing optimizations
        DOUBLE_TAP_TIMEOUT_MS: 300, // Reduced from 350 for faster response
        LONG_PRESS_DURATION_MS: 350, // Reduced from 450 for faster activation
        SINGLE_TAP_TIMEOUT_MS: 280, // Reduced from 400 for faster response
        GESTURE_DEBOUNCE_MS: 8, // Reduced from 16 for more responsive tracking
        
        // UI/UX enhancements
        ENABLE_HAPTIC_FEEDBACK: true,
        HAPTIC_FEEDBACK_DURATION_MS: 8, // Reduced from 15 for lighter haptic
        FORCE_LANDSCAPE: true,
        ANIMATION_DURATION_MS: 150, // Reduced from 200 for smoother animations
        INDICATOR_FADE_DURATION_MS: 800, // Increased from 600 for better visibility
        
        // Performance settings
        MAX_CACHED_VIDEOS: 3,
        CLEANUP_INTERVAL_MS: 30000,
        THROTTLE_RESIZE_MS: 100,
        
        // Accessibility
        ENABLE_SCREEN_READER: false,
        HIGH_CONTRAST_MODE: false,
        REDUCED_MOTION: false,
        
        // Debug
        DEBUG_MODE: false, // Changed to false by default for production
        PERFORMANCE_MONITORING: false // Changed to false by default for production
    };

    // --- Enhanced State Management ---
    class GestureState {
        constructor() {
            this.reset();
            this.videoCache = new Map();
            this.lastCleanup = Date.now();
            this.performanceMetrics = {
                gestureCount: 0,
                averageResponseTime: 0,
                memoryUsage: 0
            };
        }

        reset() {
            this.activeGesture = null;
            this.lastTap = { time: 0, count: 0, x: 0, y: 0 };
            this.timeouts = new Set();
            this.isProcessing = false;
            this.singleTapScheduled = false; // Add flag to prevent multiple single taps
            this.nativeControlsActive = false; // Track native player interaction
            this.lastNativeInteraction = 0; // Timestamp of last native control use
        }

        clearTimeouts() {
            this.timeouts.forEach(id => clearTimeout(id));
            this.timeouts.clear();
        }

        addTimeout(callback, delay) {
            const id = setTimeout(() => {
                callback();
                this.timeouts.delete(id);
            }, delay);
            this.timeouts.add(id);
            return id;
        }

        // Enhanced video caching with LRU eviction
        cacheVideo(video) {
            if (this.videoCache.size >= CONFIG.MAX_CACHED_VIDEOS) {
                const firstKey = this.videoCache.keys().next().value;
                this.videoCache.delete(firstKey);
            }
            
            const videoData = {
                element: video,
                rect: video.getBoundingClientRect(),
                lastAccess: Date.now(),
                container: this.findContainer(video)
            };
            this.videoCache.set(video, videoData);
            return videoData;
        }

        getCachedVideo(video) {
            const cached = this.videoCache.get(video);
            if (cached) {
                cached.lastAccess = Date.now();
                return cached;
            }
            return null;
        }

        findContainer(video) {
            const selectors = [
                '.html5-video-player',
                '.player',
                '.video-js',
                '[data-vjs-player]',
                '.jwplayer',
                '.video-container',
                '.player-container'
            ];
            
            for (const selector of selectors) {
                const container = video.closest(selector);
                if (container) return container;
            }
            return video.parentElement;
        }

        // Periodic cleanup to prevent memory leaks
        performCleanup() {
            const now = Date.now();
            if (now - this.lastCleanup < CONFIG.CLEANUP_INTERVAL_MS) return;

            // Remove stale video cache entries
            for (const [video, data] of this.videoCache) {
                if (!document.contains(video) || 
                    now - data.lastAccess > CONFIG.CLEANUP_INTERVAL_MS * 2) {
                    this.videoCache.delete(video);
                }
            }

            this.lastCleanup = now;
            
            if (CONFIG.PERFORMANCE_MONITORING) {
                this.performanceMetrics.memoryUsage = this.videoCache.size;
                console.log('🧹 Cleanup performed:', this.performanceMetrics);
            }
        }

        // Detect native player control interaction
        markNativeControlsActive() {
            this.nativeControlsActive = true;
            this.lastNativeInteraction = Date.now();
            
            // Clear any pending gesture timeouts to avoid conflicts
            this.clearTimeouts();
            this.singleTapScheduled = false;
            
            // Reset any active gesture state
            if (this.activeGesture) {
                this.activeGesture = null;
            }
            
            if (CONFIG.DEBUG_MODE) {
                console.log('🎮 Native controls detected - blocking gesture system');
            }
            
            // Auto-reset after a short delay
            this.addTimeout(() => {
                this.nativeControlsActive = false;
                if (CONFIG.DEBUG_MODE) {
                    console.log('🎮 Native controls cooldown finished');
                }
            }, 1500); // Increased to 1.5 seconds for better protection
        }

        // Check if native controls were recently used
        isNativeControlsActive() {
            const timeSinceNative = Date.now() - this.lastNativeInteraction;
            return this.nativeControlsActive || timeSinceNative < 750; // Increased to 750ms protection window
        }
    }

    // --- Optimized UI System ---
    class UIManager {
        constructor() {
            this.elements = {};
            this.animationFrameId = null;
            this.pendingUpdates = new Map();
            this.indicatorTimeout = null; // Track indicator timeout separately
            this.init();
        }

        init() {
            this.injectStyles();
            this.createElements();
            this.setupResizeHandler();
        }

        injectStyles() {
            // Use GM_addStyle for better performance than createElement
            // Remove external font loading to prevent blocking
            GM_addStyle(`
                .vge-indicator {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    padding: 10px 16px;
                    background: rgba(0, 0, 0, 0.92);
                    color: white;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    border-radius: 14px;
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.18);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
                    z-index: 2147483647;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    opacity: 0;
                    pointer-events: none;
                    transition: all ${CONFIG.ANIMATION_DURATION_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    will-change: opacity, transform;
                    transform-origin: center;
                }
                
                .vge-indicator.visible {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
                
                .vge-indicator:not(.visible) {
                    transform: translate(-50%, -50%) scale(0.85);
                }
                
                .vge-indicator .icon-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    background: rgba(255, 255, 255, 0.12);
                    border-radius: 7px;
                    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.15);
                    flex-shrink: 0;
                    transition: all ${CONFIG.ANIMATION_DURATION_MS}ms ease;
                }
                
                .vge-indicator.visible .icon-container {
                    background: rgba(255, 255, 255, 0.15);
                }
                
                .vge-indicator svg {
                    width: 16px;
                    height: 16px;
                    fill: white;
                    flex-shrink: 0;
                    transition: all ${CONFIG.ANIMATION_DURATION_MS}ms ease;
                }
                
                @keyframes pulse {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(1.05); opacity: 0.8; }
                }
                
                .vge-brightness-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: black;
                    opacity: 0;
                    pointer-events: none;
                    z-index: 2147483646;
                    transition: opacity 80ms linear;
                    will-change: opacity;
                }
                
                .vge-glow {
                    position: absolute;
                    border: 2px solid #60a5fa;
                    border-radius: 8px;
                    pointer-events: none;
                    opacity: 0;
                    z-index: 2147483645;
                    box-shadow: 0 0 20px rgba(96, 165, 250, 0.4);
                    transition: all 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    will-change: opacity, transform;
                }
                
                .vge-glow.visible {
                    opacity: 0.9;
                    transform: scale(1.02);
                }
                
                .vge-zone-debug {
                    position: absolute;
                    border: 1px dashed rgba(255, 255, 255, 0.3);
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 200ms ease;
                }
                
                .vge-zone-debug.visible {
                    opacity: 1;
                }
                
                @media (prefers-reduced-motion: reduce) {
                    .vge-indicator,
                    .vge-brightness-overlay,
                    .vge-glow,
                    .vge-zone-debug {
                        transition: none;
                    }
                }
                
                @media (prefers-contrast: high) {
                    .vge-indicator {
                        background: black;
                        border: 2px solid white;
                    }
                    
                    .vge-glow {
                        border-color: yellow;
                        box-shadow: 0 0 20px yellow;
                    }
                }
            `);
        }

        createElements() {
            // Wait for body to exist
            if (!document.body) {
                setTimeout(() => this.createElements(), 50);
                return;
            }

            // Indicator
            this.elements.indicator = document.createElement('div');
            this.elements.indicator.className = 'vge-indicator';
            this.elements.indicator.id = 'vge-indicator';
            
            // Brightness overlay
            this.elements.brightnessOverlay = document.createElement('div');
            this.elements.brightnessOverlay.className = 'vge-brightness-overlay';
            this.elements.brightnessOverlay.id = 'vge-brightness-overlay';
            
            // Glow effect
            this.elements.glow = document.createElement('div');
            this.elements.glow.className = 'vge-glow';
            this.elements.glow.id = 'vge-glow';
            
            // Append to body
            try {
                document.body.append(
                    this.elements.indicator,
                    this.elements.brightnessOverlay,
                    this.elements.glow
                );
                if (CONFIG.DEBUG_MODE) {
                    console.log('✅ UI elements created and appended');
                }
            } catch (error) {
                console.error('❌ Failed to create UI elements:', error);
            }
        }

        setupResizeHandler() {
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    this.handleResize();
                }, CONFIG.THROTTLE_RESIZE_MS);
            }, { passive: true });
        }

        handleResize() {
            // Update cached video rectangles
            gestureState.videoCache.forEach((data, video) => {
                data.rect = video.getBoundingClientRect();
            });
        }

        // Batched DOM updates for better performance
        batchUpdate(element, properties) {
            if (!this.animationFrameId) {
                this.animationFrameId = requestAnimationFrame(() => {
                    this.pendingUpdates.forEach((props, el) => {
                        Object.assign(el.style, props);
                    });
                    this.pendingUpdates.clear();
                    this.animationFrameId = null;
                });
            }
            this.pendingUpdates.set(element, properties);
        }

        // Enhanced icon creation with SVG - minimal labels
        createSVGIcon(type, text) {
            const icons = {
                play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
                pause: `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
                seekForward: `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`,
                seekBackward: `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>`,
                speed: `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6zm9-12v12l8.5-6L22 6z"/></svg>`, // Fast forward icon
                volume: `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
                volumeMute: `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
                brightness: `<svg viewBox="0 0 24 24"><path d="M12 9c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3m0-2c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>`,
                fullscreen: `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
                exitFullscreen: `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`
            };
            
            const iconSvg = icons[type] || icons.play;
            
            // Only show text for certain actions (NOT for play/pause/fullscreen)
            const showText = text.includes('%') || text.includes('s') || text.includes(':') || 
                           text === '2x'; // Only show 2x text for speed
            
            if (showText) {
                return `<div class="icon-container">${iconSvg}</div><span>${text}</span>`;
            } else {
                // Icon only for play/pause/fullscreen
                return `<div class="icon-container">${iconSvg}</div>`;
            }
        }

        showIndicator(content, duration = CONFIG.INDICATOR_FADE_DURATION_MS) {
            const indicator = this.elements.indicator;
            if (!indicator || !document.body.contains(indicator)) {
                console.warn('⚠️ Indicator element not ready');
                return;
            }
            
            // Parse content if it contains icon type
            if (typeof content === 'object' && content.type) {
                content = this.createSVGIcon(content.type, content.text);
            }
            
            indicator.innerHTML = content;
            indicator.classList.add('visible');
            
            if (CONFIG.DEBUG_MODE) {
                console.log('📺 Showing indicator:', content.substring ? content.substring(0, 50) + '...' : content);
            }
            
            // Don't clear timeouts for infinite duration (long press)
            if (duration !== Infinity) {
                // Clear any existing indicator timeout to prevent conflicts
                if (this.indicatorTimeout) {
                    clearTimeout(this.indicatorTimeout);
                }
                
                // Set auto-hide timeout
                this.indicatorTimeout = setTimeout(() => {
                    if (indicator && indicator.classList.contains('visible')) {
                        indicator.classList.remove('visible');
                        this.indicatorTimeout = null;
                        if (CONFIG.DEBUG_MODE) {
                            console.log('📺 Indicator auto-hidden after:', duration, 'ms');
                        }
                    }
                }, duration);
            }
        }

        hideIndicator() {
            const indicator = this.elements.indicator;
            if (!indicator) return;
            
            // Clear any pending indicator timeout
            if (this.indicatorTimeout) {
                clearTimeout(this.indicatorTimeout);
                this.indicatorTimeout = null;
            }
            
            indicator.classList.remove('visible');
            
            if (CONFIG.DEBUG_MODE) {
                console.log('📺 Indicator manually hidden');
            }
        }

        showGlow(video, duration = 600) { // Reduced default duration
            if (!video) return;
            
            const glow = this.elements.glow;
            const rect = video.getBoundingClientRect();
            
            this.batchUpdate(glow, {
                left: `${rect.left - 4}px`,
                top: `${rect.top - 4}px`,
                width: `${rect.width + 8}px`,
                height: `${rect.height + 8}px`
            });
            
            glow.classList.add('visible');
            
            gestureState.addTimeout(() => {
                glow.classList.remove('visible');
            }, duration);
        }

        updateBrightness(value) {
            const opacity = Math.max(0, Math.min(1, 1 - value));
            this.batchUpdate(this.elements.brightnessOverlay, { opacity });
        }

        handleFullscreenChange() {
            const fullscreenElement = document.fullscreenElement;
            const targetParent = fullscreenElement || document.body;
            
            // Move UI elements to appropriate container
            targetParent.append(
                this.elements.indicator,
                this.elements.brightnessOverlay
            );
            
            // Keep glow in body for positioning
            if (!document.body.contains(this.elements.glow)) {
                document.body.appendChild(this.elements.glow);
            }
        }
    }

    // --- Enhanced Video Discovery ---
    class VideoManager {
        constructor() {
            this.observer = null;
            this.setupMutationObserver();
        }

        setupMutationObserver() {
            // Wait for body to exist
            if (!document.body) {
                setTimeout(() => this.setupMutationObserver(), 50);
                return;
            }

            try {
                // Throttle mutation processing to avoid performance issues
                let mutationTimeout;
                const processMutations = (mutations) => {
                    if (mutationTimeout) return;
                    
                    mutationTimeout = setTimeout(() => {
                        try {
                            for (const mutation of mutations) {
                                if (mutation.type === 'childList') {
                                    mutation.addedNodes.forEach(node => {
                                        try {
                                            if (node.nodeType === Node.ELEMENT_NODE) {
                                                const videos = node.matches?.('video') ? [node] : 
                                                              node.querySelectorAll?.('video') || [];
                                                videos.forEach(video => {
                                                    try {
                                                        this.registerVideo(video);
                                                    } catch (error) {
                                                        console.warn('Error registering video from mutation:', error);
                                                    }
                                                });
                                            }
                                        } catch (error) {
                                            console.warn('Error processing mutation node:', error);
                                        }
                                    });
                                }
                            }
                        } catch (error) {
                            console.error('Error processing mutations:', error);
                        }
                        mutationTimeout = null;
                    }, 100); // Debounce mutations
                };

                // Watch for new videos being added to DOM
                this.observer = new MutationObserver(processMutations);

                this.observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                
                // Setup native controls detection
                this.setupNativeControlsDetection();
                
                if (CONFIG.DEBUG_MODE) {
                    console.log('✅ MutationObserver setup complete');
                }
            } catch (error) {
                console.error('❌ Failed to setup MutationObserver:', error);
            }
        }

        setupNativeControlsDetection() {
            // Common native control selectors
            const controlSelectors = [
                'button[aria-label*="play"]',
                'button[aria-label*="pause"]',
                'button[title*="play"]',
                'button[title*="pause"]',
                '.vjs-play-control',
                '.ytp-play-button',
                '.jw-icon-playback',
                '.plyr__control--overlaid',
                '.player-play-button',
                '.play-button',
                '.pause-button',
                '[data-testid*="play"]',
                '[data-testid*="pause"]',
                // Additional selectors for better detection
                '.video-stream ~ div button',
                '[role="button"][aria-label*="Play"]',
                '[role="button"][aria-label*="Pause"]',
                '.controls button',
                '.player-controls button'
            ];

            // Enhanced click detection with more aggressive selectors
            document.addEventListener('click', (e) => {
                // Check multiple levels up the DOM tree
                let element = e.target;
                let depth = 0;
                const maxDepth = 5;
                
                while (element && depth < maxDepth) {
                    // Check if this element or its attributes suggest it's a play/pause control
                    if (element.matches && element.matches(controlSelectors.join(','))) {
                        if (CONFIG.DEBUG_MODE) {
                            console.log('🎮 Native control clicked (matched):', element);
                        }
                        gestureState.markNativeControlsActive();
                        return;
                    }
                    
                    // Check for common patterns in text content or attributes
                    const text = element.textContent?.toLowerCase() || '';
                    const ariaLabel = element.getAttribute?.('aria-label')?.toLowerCase() || '';
                    const title = element.getAttribute?.('title')?.toLowerCase() || '';
                    const className = element.className?.toLowerCase() || '';
                    
                    if ((text.includes('play') || text.includes('pause') ||
                         ariaLabel.includes('play') || ariaLabel.includes('pause') ||
                         title.includes('play') || title.includes('pause') ||
                         className.includes('play') || className.includes('pause')) &&
                        (element.tagName === 'BUTTON' || element.tagName === 'DIV' || element.role === 'button')) {
                        if (CONFIG.DEBUG_MODE) {
                            console.log('🎮 Native control clicked (pattern):', element);
                        }
                        gestureState.markNativeControlsActive();
                        return;
                    }
                    
                    element = element.parentElement;
                    depth++;
                }
            }, true);

            // Listen for video play/pause events to detect native control usage
            document.addEventListener('play', (e) => {
                if (e.target.tagName === 'VIDEO' && !gestureState.activeGesture) {
                    if (CONFIG.DEBUG_MODE) {
                        console.log('🎮 Video play event without gesture - likely native control');
                    }
                    gestureState.markNativeControlsActive();
                }
            }, true);

            document.addEventListener('pause', (e) => {
                if (e.target.tagName === 'VIDEO' && !gestureState.activeGesture) {
                    if (CONFIG.DEBUG_MODE) {
                        console.log('🎮 Video pause event without gesture - likely native control');
                    }
                    gestureState.markNativeControlsActive();
                }
            }, true);

            // Listen for keyboard controls (spacebar, k key)
            document.addEventListener('keydown', (e) => {
                if ((e.code === 'Space' || e.key === 'k') && 
                    !e.target.matches('input, textarea, [contenteditable]')) {
                    if (CONFIG.DEBUG_MODE) {
                        console.log('🎮 Keyboard control detected:', e.key);
                    }
                    gestureState.markNativeControlsActive();
                }
            }, true);
        }

        registerVideo(video) {
            if (gestureState.videoCache.has(video)) return;
            
            // Pre-cache video data
            gestureState.cacheVideo(video);
            
            if (CONFIG.DEBUG_MODE) {
                console.log('📹 New video registered:', video);
            }
        }

        findActiveVideo(targetElement) {
            if (CONFIG.DEBUG_MODE) {
                console.log('🔍 Looking for active video, target:', targetElement.tagName);
            }

            // Fast path: check fullscreen first
            if (document.fullscreenElement) {
                const fsVideo = document.fullscreenElement.querySelector('video');
                if (fsVideo) {
                    if (CONFIG.DEBUG_MODE) {
                        console.log('✅ Found fullscreen video');
                    }
                    return gestureState.getCachedVideo(fsVideo) || gestureState.cacheVideo(fsVideo);
                }
            }

            // Check if target is video
            if (targetElement.tagName === 'VIDEO') {
                if (CONFIG.DEBUG_MODE) {
                    console.log('✅ Target is video element');
                }
                return gestureState.getCachedVideo(targetElement) || gestureState.cacheVideo(targetElement);
            }

            // Find closest video
            const closestVideo = targetElement.closest('video');
            if (closestVideo) {
                if (CONFIG.DEBUG_MODE) {
                    console.log('✅ Found closest video');
                }
                return gestureState.getCachedVideo(closestVideo) || gestureState.cacheVideo(closestVideo);
            }

            // Find largest playing video
            const largestVideo = this.findLargestPlayingVideo();
            if (largestVideo) {
                if (CONFIG.DEBUG_MODE) {
                    console.log('✅ Found largest playing video');
                }
                return largestVideo;
            }

            // Fallback: find any video on page
            const anyVideo = document.querySelector('video');
            if (anyVideo) {
                if (CONFIG.DEBUG_MODE) {
                    console.log('✅ Found fallback video');
                }
                return gestureState.getCachedVideo(anyVideo) || gestureState.cacheVideo(anyVideo);
            }

            if (CONFIG.DEBUG_MODE) {
                console.log('❌ No video found anywhere');
            }
            return null;
        }

        findLargestPlayingVideo() {
            let bestVideo = null;
            let maxScore = 0;

            for (const [video, data] of gestureState.videoCache) {
                if (video.paused || video.readyState < 1) continue;
                
                const rect = data.rect;
                const area = rect.width * rect.height;
                const isVisible = rect.width > 0 && rect.height > 0;
                const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;
                
                const score = area * (isVisible ? 1 : 0) * (isInViewport ? 1.5 : 1);
                
                if (score > maxScore) {
                    maxScore = score;
                    bestVideo = data;
                }
            }

            return bestVideo;
        }

        isValidTapArea(point, videoData) {
            // Always allow in fullscreen
            if (document.fullscreenElement) return true;
            
            if (!videoData) return false;
            
            const rect = videoData.rect;
            return point.x >= rect.left && point.x <= rect.right &&
                   point.y >= rect.top && point.y <= rect.bottom;
        }

        cleanup() {
            this.observer?.disconnect();
        }
    }

    // --- Enhanced Gesture Engine ---
    class GestureEngine {
        constructor() {
            this.touchStartTime = 0;
            this.touchMoveCount = 0;
            this.lastMoveTime = 0;
            this.velocity = { x: 0, y: 0 };
            this.initialized = false;
            
            // Delay event listener setup to ensure other components are ready
            setTimeout(() => this.setupEventListeners(), 100);
        }

        setupEventListeners() {
            if (this.initialized) return;
            
            // Ensure required components exist
            if (!gestureState || !uiManager || !videoManager) {
                console.warn('Dependencies not ready, retrying...');
                setTimeout(() => this.setupEventListeners(), 100);
                return;
            }

            try {
                const options = { passive: false, capture: true };
                
                // Bind methods to preserve 'this' context
                this.handleTouchStart = this.handleTouchStart.bind(this);
                this.handleTouchMove = this.handleTouchMove.bind(this);
                this.handleTouchEnd = this.handleTouchEnd.bind(this);
                this.handleContextMenu = this.handleContextMenu.bind(this);
                
                document.addEventListener('touchstart', this.handleTouchStart, options);
                document.addEventListener('touchmove', this.handleTouchMove, options);
                document.addEventListener('touchend', this.handleTouchEnd, options);
                document.addEventListener('contextmenu', this.handleContextMenu, options);
                
                this.initialized = true;
                
                if (CONFIG.DEBUG_MODE) {
                    console.log('✅ Gesture engine initialized');
                }
            } catch (error) {
                console.error('❌ Failed to setup gesture event listeners:', error);
            }
        }

        handleTouchStart(e) {
            try {
                if (CONFIG.DEBUG_MODE) {
                    console.log('👆 Touch start detected', e.touches.length, 'touches');
                }

                // Check if native controls are active
                if (gestureState.isNativeControlsActive()) {
                    if (CONFIG.DEBUG_MODE) {
                        console.log('🎮 Native controls active - blocking gesture');
                    }
                    return;
                }

                // Allow gesture processing
                if (e.touches.length > 1) {
                    if (CONFIG.DEBUG_MODE) {
                        console.log('❌ Multi-touch, ignoring');
                    }
                    this.cleanup();
                    return;
                }

                // Don't prevent single touch processing
                gestureState.isProcessing = false;

                const startTime = performance.now();
                this.touchStartTime = startTime;
                this.touchMoveCount = 0;
                
                const touch = e.touches[0];
                const touchPoint = { x: touch.clientX, y: touch.clientY };
                
                if (CONFIG.DEBUG_MODE) {
                    console.log('📍 Touch point:', touchPoint);
                }
                
                const videoData = videoManager.findActiveVideo(e.target);
                
                if (!videoData) {
                    if (CONFIG.DEBUG_MODE) {
                        console.log('❌ No video data found');
                    }
                    this.cleanup();
                    return;
                }
                
                if (!videoData.element) {
                    if (CONFIG.DEBUG_MODE) {
                        console.log('❌ No video element in data');
                    }
                    this.cleanup();
                    return;
                }
                
                if (videoData.element.duration < CONFIG.MIN_VIDEO_DURATION_SECONDS) {
                    if (CONFIG.DEBUG_MODE) {
                        console.log('❌ Video too short:', videoData.element.duration);
                    }
                    this.cleanup();
                    return;
                }
                
                if (!videoManager.isValidTapArea(touchPoint, videoData)) {
                    if (CONFIG.DEBUG_MODE) {
                        console.log('❌ Invalid tap area');
                    }
                    this.cleanup();
                    return;
                }

                if (CONFIG.DEBUG_MODE) {
                    console.log('✅ Valid touch start, creating gesture');
                }

                // Performance monitoring
                if (CONFIG.PERFORMANCE_MONITORING) {
                    gestureState.performanceMetrics.gestureCount++;
                }

                // Initialize gesture state with error handling
                try {
                    gestureState.activeGesture = {
                        videoData,
                        startPoint: touchPoint,
                        currentPoint: touchPoint,
                        startTime,
                        isSwipe: false,
                        action: 'none',
                        finalized: false,
                        originalPlaybackRate: videoData.element.playbackRate || 1.0,
                        initialBrightness: 1 - parseFloat(uiManager.elements.brightnessOverlay?.style.opacity || 0),
                        initialVolume: videoData.element.volume || 1.0
                    };
                } catch (error) {
                    console.error('Error initializing gesture state:', error);
                    this.cleanup();
                    return;
                }

                this.updateTapCount(touchPoint);
                this.scheduleLongPress();
            } catch (error) {
                console.error('Error in handleTouchStart:', error);
                this.cleanup();
            }
        }

        handleTouchMove(e) {
            if (!gestureState.activeGesture || e.touches.length > 1) return;

            // Check if native controls became active during gesture
            if (gestureState.isNativeControlsActive()) {
                if (CONFIG.DEBUG_MODE) {
                    console.log('🎮 Native controls activated during gesture - aborting');
                }
                this.cleanup();
                return;
            }

            const now = performance.now();
            const deltaTime = now - this.lastMoveTime;
            
            // Debounce move events for performance
            if (deltaTime < CONFIG.GESTURE_DEBOUNCE_MS) return;
            this.lastMoveTime = now;

            const touch = e.touches[0];
            const currentPoint = { x: touch.clientX, y: touch.clientY };
            const gesture = gestureState.activeGesture;
            
            const deltaX = currentPoint.x - gesture.startPoint.x;
            const deltaY = currentPoint.y - gesture.startPoint.y;
            const distance = Math.hypot(deltaX, deltaY);

            // Calculate velocity for better gesture prediction
            if (this.touchMoveCount > 0) {
                this.velocity.x = deltaX / (now - gesture.startTime);
                this.velocity.y = deltaY / (now - gesture.startTime);
            }
            this.touchMoveCount++;

            gesture.currentPoint = currentPoint;

            // Lower threshold for swipe detection and better conditions
            if (!gesture.isSwipe && distance > CONFIG.SWIPE_THRESHOLD && this.touchMoveCount > 2) {
                e.stopPropagation();
                this.initializeSwipe(deltaX, deltaY);
            }

            if (gesture.isSwipe) {
                e.preventDefault();
                this.handleSwipeMove(deltaX, deltaY);
            }
        }

        handleTouchEnd(e) {
            if (CONFIG.DEBUG_MODE) {
                console.log('👆 Touch end detected');
            }

            if (!gestureState.activeGesture || gestureState.activeGesture.finalized) {
                if (CONFIG.DEBUG_MODE) {
                    console.log('❌ No active gesture or already finalized');
                }
                return;
            }

            const endTime = performance.now();
            const gesture = gestureState.activeGesture;
            gesture.finalized = true;

            if (CONFIG.DEBUG_MODE) {
                console.log('⏱️ Gesture duration:', endTime - gesture.startTime, 'ms');
                console.log('🎬 Current action:', gesture.action);
            }

            // Performance tracking
            if (CONFIG.PERFORMANCE_MONITORING) {
                const responseTime = endTime - gesture.startTime;
                const metrics = gestureState.performanceMetrics;
                metrics.averageResponseTime = 
                    (metrics.averageResponseTime + responseTime) / 2;
            }

            const deltaX = gesture.currentPoint.x - gesture.startPoint.x;
            const deltaY = gesture.currentPoint.y - gesture.startPoint.y;
            const movement = Math.hypot(deltaX, deltaY);

            if (CONFIG.DEBUG_MODE) {
                console.log('📏 Movement distance:', movement);
                console.log('🎯 Delta X/Y:', deltaX, deltaY);
                console.log('🔄 Is swipe:', gesture.isSwipe);
            }

            // Handle different gesture types
            if (gesture.action === 'long-press-speed') {
                if (CONFIG.DEBUG_MODE) {
                    console.log('⚡ Finalizing long press');
                }
                this.finalizeLongPress();
                this.cleanup();
            } else if (gesture.isSwipe) {
                if (CONFIG.DEBUG_MODE) {
                    console.log('👋 Finalizing swipe');
                }
                this.finalizeSwipe(deltaX, deltaY, e);
                this.cleanup();
            } else if (movement < 30) { // Tap detection
                if (CONFIG.DEBUG_MODE) {
                    console.log('👆 Handling tap - movement:', movement);
                }
                this.handleTap(e);
                // Don't cleanup immediately for taps - let handleTap manage it
            } else {
                if (CONFIG.DEBUG_MODE) {
                    console.log('❌ Movement too large for tap:', movement);
                }
                this.cleanup();
            }
        }

        handleContextMenu(e) {
            if (gestureState.activeGesture) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }

        updateTapCount(point) {
            const now = Date.now();
            const lastTap = gestureState.lastTap;
            
            const timeDiff = now - lastTap.time;
            const distance = Math.hypot(point.x - lastTap.x, point.y - lastTap.y);
            
            if (timeDiff < CONFIG.DOUBLE_TAP_TIMEOUT_MS && distance < 50) {
                lastTap.count++;
            } else {
                lastTap.count = 1;
            }
            
            lastTap.time = now;
            lastTap.x = point.x;
            lastTap.y = point.y;
        }

        scheduleLongPress() {
            const gesture = gestureState.activeGesture;
            if (!gesture) {
                return;
            }

            gestureState.addTimeout(() => {
                if (gestureState.activeGesture && !gestureState.activeGesture.isSwipe) {
                    this.handleLongPress();
                }
            }, CONFIG.LONG_PRESS_DURATION_MS);
        }

        initializeSwipe(deltaX, deltaY) {
            const gesture = gestureState.activeGesture;
            gesture.isSwipe = true;
            
            gestureState.clearTimeouts();
            gestureState.lastTap.count = 0;

            if (gesture.action === 'long-press-speed') {
                gesture.videoData.element.playbackRate = gesture.originalPlaybackRate;
                uiManager.hideIndicator();
            }

            // Determine swipe action based on direction and location
            if (document.fullscreenElement) {
                const rect = gesture.videoData.rect;
                const touchZoneX = (gesture.startPoint.x - rect.left) / rect.width;
                const isVertical = Math.abs(deltaY) > Math.abs(deltaX);

                // Left zone: brightness, Right zone: volume, Center: fullscreen (vertical swipe), seeking (horizontal swipe)
                if (isVertical) {
                    if (touchZoneX <= 0.35) {
                        gesture.action = 'brightness';
                    } else if (touchZoneX >= 0.65) {
                        gesture.action = 'volume';
                    } else {
                        gesture.action = 'fullscreen';
                    }
                } else {
                    gesture.action = 'seeking';
                }
            } else {
                gesture.action = 'seeking';
            }
        }

        handleSwipeMove(deltaX, deltaY) {
            const gesture = gestureState.activeGesture;
            
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
            const gesture = gestureState.activeGesture;
            const video = gesture.videoData.element;
            const seekTime = deltaX * CONFIG.SEEK_SENSITIVITY;
            const newTime = Math.max(0, Math.min(video.duration, video.currentTime + seekTime));
            
            const iconType = seekTime > 0 ? 'seekForward' : 'seekBackward';
            const timeStr = this.formatTime(newTime);
            
            uiManager.showIndicator({ type: iconType, text: timeStr }, 80);
        }

        updateVolume(deltaY) {
            const gesture = gestureState.activeGesture;
            const video = gesture.videoData.element;
            const change = -deltaY / CONFIG.VOLUME_SENSITIVITY;
            const newVolume = Math.max(0, Math.min(1, gesture.initialVolume + change));
            
            video.volume = newVolume;
            
            const iconType = newVolume === 0 ? 'volumeMute' : 'volume';
            const volumeText = `${Math.round(newVolume * 100)}%`;
            
            uiManager.showIndicator({ type: iconType, text: volumeText }, 80);
        }

        updateBrightness(deltaY) {
            const gesture = gestureState.activeGesture;
            const change = -deltaY / CONFIG.BRIGHTNESS_SENSITIVITY;
            const newBrightness = Math.max(0.1, Math.min(1, gesture.initialBrightness + change));
            
            uiManager.updateBrightness(newBrightness);
            const brightnessText = `${Math.round(newBrightness * 100)}%`;
            uiManager.showIndicator({ type: 'brightness', text: brightnessText }, 80);
        }

        handleLongPress() {
            const gesture = gestureState.activeGesture;
            if (!gesture || gesture.isSwipe) return;

            gesture.action = 'long-press-speed';
            const video = gesture.videoData.element;
            
            // Store original playback rate and set to 2x
            gesture.originalPlaybackRate = video.playbackRate;
            video.playbackRate = 2.0;
            
            // Show enhanced visual feedback for long press with pulsing effect
            if (uiManager && uiManager.elements.indicator) {
                uiManager.showIndicator({ type: 'speed', text: '2x' }, Infinity);
                
                // Add visual enhancement - add a pulsing class for long press
                const indicator = uiManager.elements.indicator;
                indicator.style.animation = 'pulse 1s ease-in-out infinite alternate';
                
                if (CONFIG.DEBUG_MODE) {
                    console.log('🚀 Long press activated - 2x speed with visual feedback');
                }
            } else {
                console.warn('⚠️ UI Manager not ready for long press feedback');
            }
            
            this.triggerHapticFeedback();
        }

        finalizeLongPress() {
            const gesture = gestureState.activeGesture;
            if (!gesture) return;
            
            const video = gesture.videoData.element;
            
            // Restore original playback rate
            video.playbackRate = gesture.originalPlaybackRate || 1.0;
            
            // Remove visual feedback and animation
            const indicator = uiManager.elements.indicator;
            if (indicator) {
                indicator.style.animation = ''; // Remove pulsing animation
            }
            uiManager.hideIndicator();
            
            if (CONFIG.DEBUG_MODE) {
                console.log('🚀 Long press finalized - speed restored to:', video.playbackRate);
            }
        }

        finalizeSwipe(deltaX, deltaY, e) {
            const gesture = gestureState.activeGesture;
            
            switch (gesture.action) {
                case 'seeking':
                    const seekTime = deltaX * CONFIG.SEEK_SENSITIVITY;
                    gesture.videoData.element.currentTime += seekTime;
                    this.triggerHapticFeedback();
                    break;
                    
                case 'volume':
                case 'brightness':
                    this.triggerHapticFeedback();
                    break;
                    
                case 'fullscreen':
                    if (Math.abs(deltaY) > CONFIG.SWIPE_THRESHOLD) {
                        this.toggleFullscreen();
                    }
                    break;
            }

            e.stopPropagation();
        }

        handleTap(e) {
            const tapCount = gestureState.lastTap.count;
            
            if (CONFIG.DEBUG_MODE) {
                console.log('👆 Handle tap - count:', tapCount);
            }
            
            if (tapCount >= 2) {
                if (CONFIG.DEBUG_MODE) {
                    console.log('👆👆 Double tap detected');
                }
                // Clear any pending single tap timeouts
                gestureState.clearTimeouts();
                this.handleDoubleTap(e);
                this.cleanup(); // Clean up after double tap
            } else {
                if (CONFIG.DEBUG_MODE) {
                    console.log('👆 Single tap detected - scheduling');
                }
                this.scheduleSingleTap();
            }
        }

        handleDoubleTap(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Clear all timeouts including any pending single taps
            gestureState.clearTimeouts();
            gestureState.singleTapScheduled = false; // Cancel any pending single tap
            
            const gesture = gestureState.activeGesture;
            
            if (document.fullscreenElement) {
                this.handleDoubleTapSeek();
            } else {
                this.toggleFullscreen();
            }
            
            // Reset tap count after double tap
            gestureState.lastTap = { time: 0, count: 0, x: 0, y: 0 };
        }

        scheduleSingleTap() {
            const currentGesture = gestureState.activeGesture;
            if (!currentGesture) {
                if (CONFIG.DEBUG_MODE) {
                    console.log('❌ No gesture to schedule single tap');
                }
                return;
            }

            // Check if native controls are active before scheduling
            if (gestureState.isNativeControlsActive()) {
                if (CONFIG.DEBUG_MODE) {
                    console.log('🎮 Native controls active - not scheduling single tap');
                }
                return;
            }

            // Prevent multiple scheduling
            if (gestureState.singleTapScheduled) {
                if (CONFIG.DEBUG_MODE) {
                    console.log('❌ Single tap already scheduled, ignoring');
                }
                return;
            }

            // Store gesture data before it gets cleaned up
            const videoData = currentGesture.videoData;
            
            if (CONFIG.DEBUG_MODE) {
                console.log('⏰ Scheduling single tap with timeout:', CONFIG.SINGLE_TAP_TIMEOUT_MS);
            }

            // Clear any existing timeouts to prevent multiple executions
            gestureState.clearTimeouts();
            gestureState.singleTapScheduled = true;

            gestureState.addTimeout(() => {
                // Check if tap count is still 1 (no double tap occurred) AND native controls not active
                if (gestureState.lastTap.count === 1 && !gestureState.isNativeControlsActive()) {
                    if (CONFIG.DEBUG_MODE) {
                        console.log('⏰ Single tap timeout fired - executing');
                    }
                    
                    // Recreate minimal gesture for single tap execution
                    gestureState.activeGesture = { videoData };
                    this.handleSingleTap();
                    
                    // Reset everything after execution
                    gestureState.lastTap = { time: 0, count: 0, x: 0, y: 0 };
                    gestureState.activeGesture = null;
                    gestureState.singleTapScheduled = false;
                    
                    // Clean up after single tap execution
                    this.cleanup();
                } else {
                    if (CONFIG.DEBUG_MODE) {
                        const reason = gestureState.lastTap.count !== 1 ? 
                            `tap count: ${gestureState.lastTap.count}` : 
                            'native controls active';
                        console.log('⏰ Single tap timeout cancelled -', reason);
                    }
                    gestureState.singleTapScheduled = false;
                    // Clean up cancelled single tap
                    this.cleanup();
                }
            }, CONFIG.SINGLE_TAP_TIMEOUT_MS);
        }

        handleSingleTap() {
            if (CONFIG.DEBUG_MODE) {
                console.log('👆 Executing single tap');
            }

            // Double-check native controls before executing
            if (gestureState.isNativeControlsActive()) {
                if (CONFIG.DEBUG_MODE) {
                    console.log('🎮 Native controls active - cancelling single tap');
                }
                return;
            }

            const gesture = gestureState.activeGesture;
            if (!gesture || !gesture.videoData) {
                if (CONFIG.DEBUG_MODE) {
                    console.log('❌ No gesture or video data for single tap');
                }
                return;
            }

            const video = gesture.videoData.element;
            if (!video) {
                if (CONFIG.DEBUG_MODE) {
                    console.log('❌ No video element for single tap');
                }
                return;
            }

            const wasPlaying = !video.paused;
            
            if (CONFIG.DEBUG_MODE) {
                console.log('📹 Video was playing:', wasPlaying, 'Current time:', video.currentTime);
            }
            
            try {
                if (wasPlaying) {
                    video.pause();
                    if (CONFIG.DEBUG_MODE) {
                        console.log('⏸️ Video paused successfully via gesture');
                    }
                } else {
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise.then(() => {
                            if (CONFIG.DEBUG_MODE) {
                                console.log('▶️ Video playing successfully via gesture');
                            }
                        }).catch(error => {
                            console.warn('Play failed:', error);
                        });
                    } else {
                        if (CONFIG.DEBUG_MODE) {
                            console.log('▶️ Video play() called (no promise) via gesture');
                        }
                    }
                }
                
                if (document.fullscreenElement) {
                    const iconType = wasPlaying ? 'pause' : 'play';
                    // Show icon only, no text labels for play/pause
                    uiManager.showIndicator({ type: iconType, text: '' });
                    if (CONFIG.DEBUG_MODE) {
                        console.log('📺 Showing fullscreen indicator:', iconType);
                    }
                } else {
                    uiManager.showGlow(video, 600); // Reduced duration for faster feedback
                    if (CONFIG.DEBUG_MODE) {
                        console.log('✨ Showing glow effect');
                    }
                }
                
                this.triggerHapticFeedback();
            } catch (error) {
                console.error('Error in single tap:', error);
            }
        }

        handleDoubleTapSeek() {
            const gesture = gestureState.activeGesture;
            const video = gesture.videoData.element;
            const rect = gesture.videoData.rect;
            const tapZone = (gesture.startPoint.x - rect.left) / rect.width;
            
            if (tapZone <= 0.35) {
                video.currentTime -= CONFIG.DOUBLE_TAP_SEEK_SECONDS;
                uiManager.showIndicator({ type: 'seekBackward', text: `-${CONFIG.DOUBLE_TAP_SEEK_SECONDS}s` });
            } else if (tapZone >= 0.65) {
                video.currentTime += CONFIG.DOUBLE_TAP_SEEK_SECONDS;
                uiManager.showIndicator({ type: 'seekForward', text: `+${CONFIG.DOUBLE_TAP_SEEK_SECONDS}s` });
            } else {
                // Center area - play/pause
                this.handleSingleTap();
                return;
            }
            
            this.triggerHapticFeedback();
        }

        toggleFullscreen() {
            const isFullscreen = !!document.fullscreenElement;
            
            if (isFullscreen) {
                document.exitFullscreen().catch(console.warn);
                uiManager.showIndicator({ type: 'exitFullscreen', text: '' }); // No text, icon only
            } else {
                const gesture = gestureState.activeGesture;
                const container = gesture.videoData.container;
                const video = gesture.videoData.element;
                
                const fsPromise = container.requestFullscreen().catch(console.warn);
                
                if (CONFIG.FORCE_LANDSCAPE && video.videoWidth > video.videoHeight) {
                    fsPromise.then(() => {
                        if (screen.orientation?.lock) {
                            screen.orientation.lock('landscape').catch(console.warn);
                        }
                    });
                }
                
                uiManager.showIndicator({ type: 'fullscreen', text: '' }); // No text, icon only
            }
            
            this.triggerHapticFeedback();
        }

        triggerHapticFeedback() {
            if (CONFIG.ENABLE_HAPTIC_FEEDBACK && navigator.vibrate) {
                navigator.vibrate(CONFIG.HAPTIC_FEEDBACK_DURATION_MS);
            }
        }

        formatTime(seconds) {
            const hrs = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            
            if (hrs > 0) {
                return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }

        cleanup() {
            gestureState.reset();
        }
    }

    // --- Configuration Manager ---
    class ConfigManager {
        constructor() {
            this.loadConfig();
            this.setupMenuCommands();
        }

        async loadConfig() {
            try {
                const saved = await GM_getValue('vge_config', {});
                
                // Validate and merge configuration
                Object.keys(saved).forEach(key => {
                    if (CONFIG.hasOwnProperty(key)) {
                        // Type validation
                        const currentType = typeof CONFIG[key];
                        const savedType = typeof saved[key];
                        
                        if (currentType === savedType) {
                            CONFIG[key] = saved[key];
                        } else {
                            console.warn(`Config validation failed for ${key}: expected ${currentType}, got ${savedType}`);
                        }
                    }
                });
                
                // Apply accessibility settings
                if (CONFIG.REDUCED_MOTION) {
                    document.documentElement.style.setProperty('--vge-animation-duration', '0ms');
                }
                
                // Validate numeric ranges
                CONFIG.SWIPE_THRESHOLD = Math.max(10, Math.min(100, CONFIG.SWIPE_THRESHOLD));
                CONFIG.SEEK_SENSITIVITY = Math.max(0.1, Math.min(2.0, CONFIG.SEEK_SENSITIVITY));
                CONFIG.VOLUME_SENSITIVITY = Math.max(50, Math.min(500, CONFIG.VOLUME_SENSITIVITY));
                CONFIG.BRIGHTNESS_SENSITIVITY = Math.max(50, Math.min(500, CONFIG.BRIGHTNESS_SENSITIVITY));
                
                if (CONFIG.DEBUG_MODE) {
                    console.log('📁 Config loaded:', CONFIG);
                }
            } catch (error) {
                console.warn('Failed to load config, using defaults:', error);
            }
        }

        async saveConfig() {
            await GM_setValue('vge_config', CONFIG);
        }

        setupMenuCommands() {
            GM_registerMenuCommand('⏱️ Set Seek Time', () => {
                const newValue = prompt('Enter seek time in seconds:', CONFIG.DOUBLE_TAP_SEEK_SECONDS);
                if (newValue && !isNaN(newValue) && newValue > 0) {
                    CONFIG.DOUBLE_TAP_SEEK_SECONDS = parseInt(newValue);
                    this.saveConfig();
                    alert(`Seek time set to ${newValue} seconds`);
                }
            });

            GM_registerMenuCommand('🔧 Performance Settings', () => {
                const settings = [
                    'Debug Mode',
                    'Performance Monitoring', 
                    'Reduced Motion',
                    'High Contrast'
                ].map((name, i) => {
                    const key = ['DEBUG_MODE', 'PERFORMANCE_MONITORING', 'REDUCED_MOTION', 'HIGH_CONTRAST_MODE'][i];
                    return `${i + 1}. ${name}: ${CONFIG[key] ? 'ON' : 'OFF'}`;
                }).join('\n');

                const choice = prompt(`Performance Settings:\n${settings}\n\nEnter number to toggle:`);
                const index = parseInt(choice) - 1;
                
                if (index >= 0 && index < 4) {
                    const keys = ['DEBUG_MODE', 'PERFORMANCE_MONITORING', 'REDUCED_MOTION', 'HIGH_CONTRAST_MODE'];
                    CONFIG[keys[index]] = !CONFIG[keys[index]];
                    this.saveConfig();
                    alert('Setting updated! Refresh page to apply changes.');
                }
            });

            GM_registerMenuCommand('📊 Performance Stats', () => {
                const stats = gestureState.performanceMetrics;
                alert(`Performance Stats:
Gestures: ${stats.gestureCount}
Avg Response: ${stats.averageResponseTime.toFixed(1)}ms
Memory Usage: ${stats.memoryUsage} cached videos`);
            });

            GM_registerMenuCommand('🔄 Reset Settings', () => {
                if (confirm('Reset all settings to defaults?')) {
                    GM_setValue('vge_config', {});
                    alert('Settings reset! Refresh page to apply.');
                }
            });
        }
    }

    // --- Initialize Enhanced System ---
    let gestureState, videoManager, uiManager, gestureEngine, configManager;
    let initializationStarted = false;

    async function initialize() {
        if (initializationStarted) return;
        initializationStarted = true;
        
        try {
            if (CONFIG.DEBUG_MODE) {
                console.log('🚀 Starting Video Gestures Pro Enhanced initialization...');
            }

            // Wait for DOM to be fully ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve, { once: true });
                });
            }
            
            // Additional wait for body to ensure it exists
            let retries = 0;
            while (!document.body && retries < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                retries++;
            }
            
            if (!document.body) {
                throw new Error('Document body not available after timeout');
            }

            // Initialize in correct order to avoid dependencies
            gestureState = new GestureState();
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
            
            uiManager = new UIManager();
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
            
            videoManager = new VideoManager();
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
            
            configManager = new ConfigManager();
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
            
            // Initialize gesture engine last (needs other components)
            gestureEngine = new GestureEngine();

            // Setup fullscreen change handler
            document.addEventListener('fullscreenchange', () => {
                try {
                    uiManager?.handleFullscreenChange();
                } catch (error) {
                    console.error('Error in fullscreen change handler:', error);
                }
            });

            // Periodic cleanup with error handling
            setInterval(() => {
                try {
                    gestureState?.performCleanup();
                } catch (error) {
                    console.error('Error in periodic cleanup:', error);
                }
            }, CONFIG.CLEANUP_INTERVAL_MS);

            // Discover existing videos with error handling
            try {
                document.querySelectorAll('video').forEach(video => {
                    try {
                        videoManager.registerVideo(video);
                    } catch (error) {
                        console.warn('Error registering video:', error);
                    }
                });
            } catch (error) {
                console.warn('Error discovering existing videos:', error);
            }

            if (CONFIG.DEBUG_MODE) {
                console.log('✅ Video Gestures Pro Enhanced initialized successfully');
                window.VGE = { gestureState, uiManager, videoManager, gestureEngine, CONFIG };
                
                // Add enhanced test functions
                window.VGE.test = {
                    showIndicator: (text) => {
                        try {
                            uiManager.showIndicator({ type: 'play', text: text || 'Test' });
                        } catch (error) {
                            console.error('Test showIndicator error:', error);
                        }
                    },
                    showAllIcons: () => {
                        const icons = ['play', 'pause', 'seekForward', 'seekBackward', 'speed', 'volume', 'volumeMute', 'brightness', 'fullscreen', 'exitFullscreen'];
                        let index = 0;
                        const showNext = () => {
                            if (index < icons.length) {
                                try {
                                    uiManager.showIndicator({ type: icons[index], text: icons[index] });
                                    index++;
                                    setTimeout(showNext, 1500);
                                } catch (error) {
                                    console.error('Error showing icon:', error);
                                }
                            }
                        };
                        showNext();
                    },
                    findVideos: () => document.querySelectorAll('video'),
                    getActiveVideo: () => {
                        const videos = document.querySelectorAll('video');
                        console.log('📹 Found videos:', videos.length);
                        return videos[0];
                    },
                    simulateTap: () => {
                        const video = document.querySelector('video');
                        if (video) {
                            const rect = video.getBoundingClientRect();
                            const x = rect.left + rect.width / 2;
                            const y = rect.top + rect.height / 2;
                            console.log('🎯 Simulating tap at:', x, y);
                            
                            // Create touch events with fallback for older browsers
                            const createTouch = (type, clientX, clientY) => {
                                try {
                                    if (typeof Touch !== 'undefined') {
                                        return new TouchEvent(type, {
                                            touches: type === 'touchend' ? [] : [new Touch({
                                                identifier: 0,
                                                target: video,
                                                clientX,
                                                clientY
                                            })],
                                            changedTouches: [new Touch({
                                                identifier: 0,
                                                target: video,
                                                clientX,
                                                clientY
                                            })]
                                        });
                                    } else {
                                        // Fallback for browsers without Touch constructor
                                        const event = document.createEvent('TouchEvent');
                                        event.initTouchEvent(type, true, true, window, 0, 0, 0, clientX, clientY, false, false, false, false, [], [], []);
                                        return event;
                                    }
                                } catch (e) {
                                    // Ultimate fallback to mouse events
                                    const event = new MouseEvent(type === 'touchstart' ? 'mousedown' : 
                                                                type === 'touchend' ? 'mouseup' : 'mousemove', {
                                        clientX, clientY, bubbles: true
                                    });
                                    return event;
                                }
                            };
                            
                            const touchStart = createTouch('touchstart', x, y);
                            const touchEnd = createTouch('touchend', x, y);
                            
                            video.dispatchEvent(touchStart);
                            setTimeout(() => video.dispatchEvent(touchEnd), 100);
                        }
                    },
                    simulateSwipe: (direction = 'right') => {
                        const video = document.querySelector('video');
                        if (video) {
                            const rect = video.getBoundingClientRect();
                            const startX = rect.left + rect.width / 2;
                            const startY = rect.top + rect.height / 2;
                            
                            let endX = startX, endY = startY;
                            switch(direction) {
                                case 'right': endX += 100; break;
                                case 'left': endX -= 100; break;
                                case 'up': endY -= 100; break;
                                case 'down': endY += 100; break;
                            }
                            
                            console.log(`🎯 Simulating ${direction} swipe from:`, startX, startY, 'to:', endX, endY);
                            
                            // Create touch events with fallback
                            const createTouch = (type, clientX, clientY) => {
                                try {
                                    if (typeof Touch !== 'undefined') {
                                        return new TouchEvent(type, {
                                            touches: type === 'touchend' ? [] : [new Touch({
                                                identifier: 0,
                                                target: video,
                                                clientX,
                                                clientY
                                            })],
                                            changedTouches: [new Touch({
                                                identifier: 0,
                                                target: video,
                                                clientX,
                                                clientY
                                            })]
                                        });
                                    } else {
                                        // Fallback for browsers without Touch constructor
                                        const event = document.createEvent('TouchEvent');
                                        event.initTouchEvent(type, true, true, window, 0, 0, 0, clientX, clientY, false, false, false, false, [], [], []);
                                        return event;
                                    }
                                } catch (e) {
                                    // Ultimate fallback to mouse events
                                    const eventType = type === 'touchstart' ? 'mousedown' : 
                                                    type === 'touchend' ? 'mouseup' : 
                                                    type === 'touchmove' ? 'mousemove' : 'mousemove';
                                    return new MouseEvent(eventType, {
                                        clientX, clientY, bubbles: true
                                    });
                                }
                            };
                            
                            const touchStart = createTouch('touchstart', startX, startY);
                            const touchMove = createTouch('touchmove', endX, endY);
                            const touchEnd = createTouch('touchend', endX, endY);
                            
                            video.dispatchEvent(touchStart);
                            setTimeout(() => video.dispatchEvent(touchMove), 50);
                            setTimeout(() => video.dispatchEvent(touchEnd), 150);
                        }
                    }
                };
                
                console.log('🧪 Test functions available at window.VGE.test');
                console.log('Try: VGE.test.showIndicator("Hello!")');
                console.log('Try: VGE.test.showAllIcons()');
                console.log('Try: VGE.test.simulateTap()');
                console.log('Try: VGE.test.simulateSwipe("right")');
            }

        } catch (error) {
            console.error('❌ Failed to initialize Video Gestures Enhanced:', error);
            // Reset initialization flag to allow retry
            initializationStarted = false;
        }
    }

    // Enhanced initialization with better timing and retry logic
    function startInitialization() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => initialize(), 100);
            }, { once: true });
        } else if (document.readyState === 'interactive') {
            // DOM ready but resources still loading
            setTimeout(() => initialize(), 150);
        } else {
            // Document fully loaded
            setTimeout(() => initialize(), 50);
        }
    }

    // Start initialization
    startInitialization();

    // Enhanced cleanup on page unload
    window.addEventListener('beforeunload', () => {
        try {
            videoManager?.cleanup();
            gestureState?.clearTimeouts();
            uiManager?.cleanup?.();
            gestureEngine?.cleanup?.();
            
            // Clear global references
            if (window.VGE) {
                delete window.VGE;
            }
        } catch (error) {
            console.warn('Error during cleanup:', error);
        }
    });

    // Add cleanup method to UIManager
    if (typeof UIManager !== 'undefined') {
        UIManager.prototype.cleanup = function() {
            try {
                // Cancel any pending animation frames
                if (this.animationFrameId) {
                    cancelAnimationFrame(this.animationFrameId);
                    this.animationFrameId = null;
                }
                
                // Clear any indicator timeouts
                if (this.indicatorTimeout) {
                    clearTimeout(this.indicatorTimeout);
                    this.indicatorTimeout = null;
                }
                
                // Remove event listeners if they exist
                if (this.resizeHandler) {
                    window.removeEventListener('resize', this.resizeHandler);
                }
                
                // Clear pending updates
                this.pendingUpdates?.clear();
            } catch (error) {
                console.warn('Error in UIManager cleanup:', error);
            }
        };
    }

    // Add cleanup method to GestureEngine
    if (typeof GestureEngine !== 'undefined') {
        GestureEngine.prototype.cleanup = function() {
            try {
                // Remove event listeners
                const options = { capture: true };
                document.removeEventListener('touchstart', this.handleTouchStart, options);
                document.removeEventListener('touchmove', this.handleTouchMove, options);
                document.removeEventListener('touchend', this.handleTouchEnd, options);
                document.removeEventListener('contextmenu', this.handleContextMenu, options);
            } catch (error) {
                console.warn('Error in GestureEngine cleanup:', error);
            }
        };
    }

})();
