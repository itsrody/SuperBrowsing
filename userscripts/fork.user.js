// ==UserScript==
// @name          Video Gestures Pro Enhanced
// @namespace    https://github.com/itsrody/SuperBrowsing
// @version      8.0
// @description  Adds a powerful, zoned gesture interface with intelligent native player detection to avoid conflicts
// @author       Murtaza Salih
// @match        *://*/*
// @exclude      *://*.youtube.com/*
// @exclude      *://*.dailymotion.com/*
// @exclude      *://*.vimeo.com/*
// @exclude      *://*.netflix.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(async function() {
    'use strict';

    // --- Central Configuration Panel ---
    const DEFAULTS = {
        MIN_VIDEO_DURATION_SECONDS: 90,
        DOUBLE_TAP_SEEK_SECONDS: 5,
        SWIPE_THRESHOLD: 20,
        SEEK_SENSITIVITY: 0.3,
        ENABLE_HAPTIC_FEEDBACK: true,
        HAPTIC_FEEDBACK_DURATION_MS: 20,
        FORCE_LANDSCAPE: true,
        ENABLE_NORMAL_MODE_FULLSCREEN: true,
        NATIVE_PLAYER_DETECTION_TIMEOUT: 1500,
        DOUBLE_TAP_TIMEOUT_MS: 350,
        FULLSCREEN_DETECTION_DELAY: 100
    };
    
    let config = await GM_getValue('config', DEFAULTS);

    GM_registerMenuCommand('Configure Gestures', () => {
        const currentConfig = JSON.stringify(config, null, 2);
        const newConfigStr = prompt('Edit Gesture Settings:', currentConfig);
        if (newConfigStr) {
            try {
                const newConfig = JSON.parse(newConfigStr);
                config = { ...DEFAULTS, ...newConfig }; 
                GM_setValue('config', config);
                alert('Settings saved! Please reload the page for changes to take effect.');
            } catch (e) {
                alert('Error parsing settings. Please ensure it is valid JSON.\n\n' + e);
            }
        }
    });

    // --- Native Player Detection System ---
    const nativePlayerDetection = {
        detectedPlayers: new WeakSet(),
        testingPlayers: new WeakSet(),
        
        // Common selectors for known players with native double-tap
        KNOWN_PLAYER_SELECTORS: [
            '.video-js', '.vjs-tech', // Video.js
            '.plyr', '.plyr__video-wrapper', // Plyr
            '.jwplayer', '.jw-media', // JW Player
            '.flowplayer', '.fp-player', // Flowplayer
            '.videojs', '.vjs-poster', // VideoJS variants
            '.player-container', '.player-wrapper',
            '[data-player]', '[data-video-player]',
            '.custom-player', '.video-player-container'
        ],
        
        // Detect if video has native double-tap fullscreen
        async detectNativeDoubleTap(video) {
            if (this.detectedPlayers.has(video)) return true;
            if (this.testingPlayers.has(video)) return false;
            
            // Check for known player containers
            for (const selector of this.KNOWN_PLAYER_SELECTORS) {
                if (video.closest(selector)) {
                    this.detectedPlayers.add(video);
                    return true;
                }
            }
            
            // Check for native controls
            if (video.controls) {
                this.detectedPlayers.add(video);
                return true;
            }
            
            // Dynamic detection: look for existing event listeners
            const hasNativeListeners = this.checkForNativeListeners(video);
            if (hasNativeListeners) {
                this.detectedPlayers.add(video);
                return true;
            }
            
            // Test with simulated double-tap
            return await this.testDoubleTapResponse(video);
        },
        
        checkForNativeListeners(video) {
            // Check video and its containers for existing touch listeners
            const containers = [video, video.parentElement, video.closest('[class*="player"]')].filter(Boolean);
            
            for (const container of containers) {
                // Look for common player framework indicators
                const classList = container.className.toLowerCase();
                if (classList.includes('player') || 
                    classList.includes('video') || 
                    classList.includes('media')) {
                    
                    // Check for data attributes indicating a player framework
                    if (container.hasAttribute('data-setup') ||
                        container.hasAttribute('data-player') ||
                        container.hasAttribute('data-plyr-provider')) {
                        return true;
                    }
                }
            }
            return false;
        },
        
        async testDoubleTapResponse(video) {
            if (this.testingPlayers.has(video)) return false;
            this.testingPlayers.add(video);
            
            return new Promise((resolve) => {
                const originalFullscreen = document.fullscreenElement;
                let responseDetected = false;
                
                // Create test touch events
                const rect = video.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                const createTouchEvent = (type) => {
                    const touch = new Touch({
                        identifier: 1,
                        target: video,
                        clientX: centerX,
                        clientY: centerY,
                        radiusX: 10,
                        radiusY: 10,
                        rotationAngle: 0,
                        force: 1
                    });
                    
                    return new TouchEvent(type, {
                        touches: type === 'touchend' ? [] : [touch],
                        targetTouches: type === 'touchend' ? [] : [touch],
                        changedTouches: [touch],
                        bubbles: true,
                        cancelable: true
                    });
                };
                
                // Monitor for fullscreen changes
                const fullscreenHandler = () => {
                    if (document.fullscreenElement !== originalFullscreen) {
                        responseDetected = true;
                        // Exit fullscreen if we accidentally triggered it
                        if (document.fullscreenElement && !originalFullscreen) {
                            document.exitFullscreen().catch(() => {});
                        }
                    }
                };
                
                document.addEventListener('fullscreenchange', fullscreenHandler);
                
                // Simulate double-tap
                setTimeout(() => {
                    video.dispatchEvent(createTouchEvent('touchstart'));
                    setTimeout(() => {
                        video.dispatchEvent(createTouchEvent('touchend'));
                        setTimeout(() => {
                            video.dispatchEvent(createTouchEvent('touchstart'));
                            setTimeout(() => {
                                video.dispatchEvent(createTouchEvent('touchend'));
                            }, 10);
                        }, 10);
                    }, 10);
                }, 10);
                
                // Check result after delay
                setTimeout(() => {
                    document.removeEventListener('fullscreenchange', fullscreenHandler);
                    this.testingPlayers.delete(video);
                    
                    if (responseDetected) {
                        this.detectedPlayers.add(video);
                    }
                    resolve(responseDetected);
                }, config.NATIVE_PLAYER_DETECTION_TIMEOUT);
            });
        }
    };

    // --- Styles ---
    function injectStyles() {
        if (document.getElementById('video-gesture-pro-styles')) return;
        const style = document.createElement('style');
        style.id = 'video-gesture-pro-styles';
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');
            .vg-indicator {
                position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                padding: 12px 18px; background-color: rgba(20, 20, 20, 0.92);
                color: #fff; font-family: 'Roboto', sans-serif; font-size: 16px;
                border-radius: 24px; 
                z-index: 2147483647; 
                display: flex;
                align-items: center; gap: 10px; opacity: 0; pointer-events: none;
                transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 8px 24px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.2);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(255,255,255,0.1);
            }
            .vg-indicator.visible { 
                opacity: 1; 
                transform: translate(-50%, -50%) scale(1.02); 
            }
            .vg-indicator svg { 
                width: 26px; height: 26px; fill: #fff; 
                filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
            }
            .vg-indicator.fullscreen-toggle {
                background-color: rgba(33, 150, 243, 0.92);
                border: 1px solid rgba(33, 150, 243, 0.3);
            }
            .vg-indicator.fullscreen-toggle svg {
                fill: #fff;
            }
            .vg-detection-overlay {
                position: absolute; top: 10px; right: 10px;
                background: rgba(255, 152, 0, 0.9); color: white;
                padding: 4px 8px; border-radius: 12px;
                font-family: 'Roboto', sans-serif; font-size: 11px;
                z-index: 2147483647; opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
            }
            .vg-detection-overlay.visible {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    }

    // --- Global State ---
    let touchStartX = 0, touchStartY = 0;
    let currentVideo = null;
    let gestureType = null;
    let tapTimeout = null;
    let tapCount = 0;
    let playerContainer = null;
    let originalParent = null;
    let originalNextSibling = null;
    let originalPlayerStyle = {};
    let normalModeDoubleTapEnabled = new WeakMap(); // Track per-video status

    // --- UI & Feedback ---
    function showIndicator(video, html, className = '') {
        const parent = document.fullscreenElement || video.parentElement;
        if (!parent) return;
        
        if (!parent.gestureIndicator) {
             const indicator = document.createElement('div');
             indicator.className = 'vg-indicator';
             parent.appendChild(indicator);
             parent.gestureIndicator = indicator;
        }
        
        const { gestureIndicator } = parent;
        gestureIndicator.innerHTML = html;
        gestureIndicator.className = `vg-indicator ${className}`;
        gestureIndicator.classList.add('visible');
        
        setTimeout(() => { 
            if (gestureIndicator) gestureIndicator.classList.remove('visible'); 
        }, 1000);
    }

    function showDetectionStatus(video, hasNative) {
        if (!config.ENABLE_NORMAL_MODE_FULLSCREEN) return;
        
        const parent = video.parentElement;
        if (!parent) return;
        
        let overlay = parent.querySelector('.vg-detection-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'vg-detection-overlay';
            parent.style.position = parent.style.position || 'relative';
            parent.appendChild(overlay);
        }
        
        overlay.textContent = hasNative ? 'Native Player' : 'Enhanced Gestures';
        overlay.classList.add('visible');
        
        setTimeout(() => {
            if (overlay) overlay.classList.remove('visible');
        }, 2000);
    }

    function triggerHapticFeedback() {
        if (config.ENABLE_HAPTIC_FEEDBACK && navigator.vibrate) {
            navigator.vibrate(config.HAPTIC_FEEDBACK_DURATION_MS);
        }
    }

    // --- Enhanced Event Handlers ---
    async function onTouchStart(e) {
        let video = e.target.closest('video');
        if (document.fullscreenElement) {
             video = document.fullscreenElement.querySelector('video');
        }

        if (!video || video.duration < config.MIN_VIDEO_DURATION_SECONDS) return;
        
        currentVideo = video;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        gestureType = 'tap';

        // Handle only fullscreen mode double-tap logic (removed normal mode double-tap)
        if (document.fullscreenElement) {
            clearTimeout(tapTimeout);
            tapTimeout = setTimeout(() => { tapCount = 0; }, config.DOUBLE_TAP_TIMEOUT_MS);
            tapCount++;
        }
    }

    function onTouchMove(e) {
        if (!currentVideo || e.touches.length > 1) return;

        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;

        if (Math.abs(deltaX) > config.SWIPE_THRESHOLD || Math.abs(deltaY) > config.SWIPE_THRESHOLD) {
            if (gestureType === 'tap') {
                const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX);
                const rect = currentVideo.getBoundingClientRect();
                const tapZone = (touchStartX - rect.left) / rect.width;

                if (isVerticalSwipe) {
                    if (document.fullscreenElement) {
                        // In fullscreen: center zone for exit fullscreen
                        if (tapZone > 0.33 && tapZone < 0.66) {
                            gestureType = 'swipe-y-fullscreen';
                        } else {
                            gestureType = 'swipe-y';
                        }
                    } else {
                        // In normal mode: swipe up anywhere for fullscreen
                        if (deltaY < -config.SWIPE_THRESHOLD && 
                            config.ENABLE_NORMAL_MODE_FULLSCREEN && 
                            normalModeDoubleTapEnabled.get(currentVideo)) {
                            gestureType = 'swipe-up-fullscreen';
                        }
                    }
                } else if (document.fullscreenElement) {
                    gestureType = 'swipe-x';
                }
            }
        }
        
        if (gestureType && gestureType.startsWith('swipe')) {
            e.preventDefault();
            if (gestureType === 'swipe-x') handleHorizontalSwipe(deltaX);
            if (gestureType === 'swipe-y') handleVerticalSwipe(deltaY);
        }
    }

    async function onTouchEnd(e) {
        if (!currentVideo) return;

        if (gestureType === 'swipe-y-fullscreen') {
            const deltaY = e.changedTouches[0].clientY - touchStartY;
            if (deltaY > config.SWIPE_THRESHOLD) {
                handleFullscreenToggle();
            }
        }
        else if (document.fullscreenElement) {
            // Existing fullscreen double-tap logic
            if (gestureType === 'tap' && tapCount >= 2) {
                e.preventDefault();
                handleDoubleTapSeek();
                clearTimeout(tapTimeout);
                tapCount = 0;
            } else if (gestureType === 'swipe-x') {
                const deltaX = e.changedTouches[0].clientX - touchStartX;
                const seekTime = deltaX * config.SEEK_SENSITIVITY;
                currentVideo.currentTime += seekTime;
                triggerHapticFeedback();
            } else if (gestureType === 'swipe-y') {
                triggerHapticFeedback();
            }
        }
        else if (config.ENABLE_NORMAL_MODE_FULLSCREEN && 
                 normalModeDoubleTapEnabled.get(currentVideo) && 
                 gestureType === 'tap' && tapCount >= 2) {
            // New normal mode double-tap fullscreen
            e.preventDefault();
            e.stopPropagation();
            handleNormalModeFullscreenToggle();
            clearTimeout(tapTimeout);
            tapCount = 0;
        }

        currentVideo = null;
        gestureType = null;
    }

    // --- Enhanced Gesture Logic ---
    function handleNormalModeFullscreenToggle() {
        const fullscreenIcon = `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
        showIndicator(currentVideo, `${fullscreenIcon} <span>Fullscreen</span>`, 'fullscreen-toggle');
        triggerHapticFeedback();
        
        // Use the existing fullscreen toggle logic
        handleFullscreenToggle();
    }

    function handleFullscreenToggle() {
        const isFullscreen = document.fullscreenElement;
        const icon = isFullscreen 
            ? `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`
            : `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
        
        if (!isFullscreen) {
            showIndicator(currentVideo, icon, 'fullscreen-toggle');
        } else {
            showIndicator(currentVideo, icon);
        }
        triggerHapticFeedback();

        if (isFullscreen) {
            document.exitFullscreen();
        } else {
            const wrapper = document.createElement('div');
            wrapper.id = 'vg-fullscreen-wrapper';
            Object.assign(wrapper.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                backgroundColor: 'black', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: '2147483646'
            });

            playerContainer = currentVideo.parentElement;
            originalParent = playerContainer.parentElement;
            originalNextSibling = playerContainer.nextElementSibling;
            
            originalPlayerStyle = {
                width: playerContainer.style.width,
                height: playerContainer.style.height,
                maxWidth: playerContainer.style.maxWidth,
                maxHeight: playerContainer.style.maxHeight,
                position: playerContainer.style.position,
                zIndex: playerContainer.style.zIndex,
            };

            Object.assign(playerContainer.style, {
                width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%',
                position: 'relative', zIndex: '1'
            });

            wrapper.appendChild(playerContainer);
            document.body.appendChild(wrapper);
            
            const fsPromise = wrapper.requestFullscreen();
            
            if (config.FORCE_LANDSCAPE && currentVideo.videoWidth > currentVideo.videoHeight) {
                fsPromise.then(() => {
                    if (screen.orientation && typeof screen.orientation.lock === 'function') {
                        screen.orientation.lock('landscape').catch(err => 
                            console.warn('Could not lock orientation:', err.message));
                    }
                }).catch(err => console.warn('Fullscreen request failed:', err.message));
            }
        }
    }

    function handleDoubleTapSeek() {
        const rect = currentVideo.getBoundingClientRect();
        const tapZone = (touchStartX - rect.left) / rect.width;

        if (tapZone < 0.33) {
            currentVideo.currentTime -= config.DOUBLE_TAP_SEEK_SECONDS;
            showIndicator(currentVideo, 
                `<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6l-8.5 6z"/></svg> -${config.DOUBLE_TAP_SEEK_SECONDS}s`);
        } else if (tapZone > 0.66) {
            currentVideo.currentTime += config.DOUBLE_TAP_SEEK_SECONDS;
            showIndicator(currentVideo, 
                `+${config.DOUBLE_TAP_SEEK_SECONDS}s <svg viewBox="0 0 24 24"><path d="M18 6h-2v12h2zM4 6v12l8.5-6L4 6z"/></svg>`);
        }
        triggerHapticFeedback();
    }

    function handleHorizontalSwipe(deltaX) {
        const seekTime = deltaX * config.SEEK_SENSITIVITY;
        const newTime = currentVideo.currentTime + seekTime;
        const direction = seekTime > 0 ? 'forward' : 'rewind';
        const icon = direction === 'forward' ? 
            `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>` : 
            `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm-2-6l6.5 4.5V7.5L9 12z"/></svg>`;
        showIndicator(currentVideo, `${icon} ${formatTime(newTime)}`);
    }

    function handleVerticalSwipe(deltaY) {
        const rect = currentVideo.getBoundingClientRect();
        const tapZone = (touchStartX - rect.left) / rect.width;
        
        if (tapZone > 0.66) { // Right side for Volume
            const volumeChange = -deltaY / 100;
            currentVideo.volume = Math.max(0, Math.min(1, currentVideo.volume + volumeChange));
            showIndicator(currentVideo, 
                `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg> ${Math.round(currentVideo.volume * 100)}%`);
        } else if (tapZone < 0.33) { // Left side for Playback Speed
            if (deltaY < -config.SWIPE_THRESHOLD) { // Swipe Up
                currentVideo.playbackRate = 2.0;
                const speedIcon = `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`;
                showIndicator(currentVideo, `${speedIcon} <span>2.0x Speed</span>`);
            } else if (deltaY > config.SWIPE_THRESHOLD) { // Swipe Down
                currentVideo.playbackRate = 1.0;
                const speedIcon = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
                showIndicator(currentVideo, `${speedIcon} <span>1.0x Speed</span>`);
            }
        }
    }
    
    function handleFullscreenChange() {
        if (!document.fullscreenElement) {
            const wrapper = document.getElementById('vg-fullscreen-wrapper');
            if (wrapper && originalParent && playerContainer) {
                Object.assign(playerContainer.style, originalPlayerStyle);
                originalParent.insertBefore(playerContainer, originalNextSibling);
                wrapper.remove();
            }
            if (screen.orientation && typeof screen.orientation.unlock === 'function') {
                screen.orientation.unlock();
            }
        }
    }

    // --- Video Detection and Setup ---
    async function setupVideoGestures(video) {
        if (!video || video.duration < config.MIN_VIDEO_DURATION_SECONDS) return;
        if (normalModeDoubleTapEnabled.has(video)) return; // Already processed
        
        if (!config.ENABLE_NORMAL_MODE_FULLSCREEN) {
            normalModeDoubleTapEnabled.set(video, false);
            return;
        }
        
        try {
            const hasNative = await nativePlayerDetection.detectNativeDoubleTap(video);
            const enableGesture = !hasNative;
            
            normalModeDoubleTapEnabled.set(video, enableGesture);
            
            // Show detection status
            setTimeout(() => {
                showDetectionStatus(video, hasNative);
            }, config.FULLSCREEN_DETECTION_DELAY);
            
            console.log(`Video gesture setup: ${enableGesture ? 'Enhanced' : 'Native'} double-tap for`, video);
            
        } catch (error) {
            console.warn('Error during native player detection:', error);
            // Default to disabled on error to avoid conflicts
            normalModeDoubleTapEnabled.set(video, false);
        }
    }

    // --- Video Observer ---
    function observeVideos() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the node itself is a video
                        if (node.tagName === 'VIDEO') {
                            setTimeout(() => setupVideoGestures(node), 500);
                        }
                        // Check for videos within the added node
                        const videos = node.querySelectorAll ? node.querySelectorAll('video') : [];
                        videos.forEach(video => {
                            setTimeout(() => setupVideoGestures(video), 500);
                        });
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Setup existing videos
        document.querySelectorAll('video').forEach(video => {
            setTimeout(() => setupVideoGestures(video), 500);
        });
    }

    // --- Utilities ---
    function formatTime(totalSeconds) {
        const sec = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        const min = Math.floor((totalSeconds / 60) % 60).toString().padStart(2, '0');
        const hr = Math.floor(totalSeconds / 3600);
        return hr > 0 ? `${hr}:${min}:${sec}` : `${min}:${sec}`;
    }

    // --- Initialization ---
    function initialize() {
        injectStyles();
        document.body.addEventListener('touchstart', onTouchStart, { passive: false });
        document.body.addEventListener('touchmove', onTouchMove, { passive: false });
        document.body.addEventListener('touchend', onTouchEnd, { passive: false });
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        
        // Start observing videos
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', observeVideos, { once: true });
        } else {
            observeVideos();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
