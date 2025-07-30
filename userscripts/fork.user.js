// ==UserScript==
// @name          Video Gestures Pro (Enhanced)
// @namespace    https://github.com/itsrody/SuperBrowsing
// @version      7.5 // Version incremented to reflect fixes
// @description  Adds powerful, zoned touch gestures (seek, volume, playback speed, fullscreen) with Material Design UI feedback to most web videos.
// @author       Murtaza Salih & Gemini
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
    // Default settings for the gestures. These can be configured by the user.
    const DEFAULTS = {
        MIN_VIDEO_DURATION_SECONDS: 90, // Minimum video duration to enable gestures
        DOUBLE_TAP_SEEK_SECONDS: 5,     // Seconds to seek on double tap
        SWIPE_THRESHOLD: 20,            // Minimum pixels for a swipe to be recognized
        SEEK_SENSITIVITY: 0.3,          // Multiplier for horizontal seek sensitivity
        ENABLE_HAPTIC_FEEDBACK: true,   // Enable/disable haptic feedback (vibration)
        HAPTIC_FEEDBACK_DURATION_MS: 20,// Duration of haptic feedback
        FORCE_LANDSCAPE: true           // Force landscape orientation in fullscreen (if supported)
    };
    
    // Load configuration from storage, or use defaults if not found.
    let config = await GM_getValue('config', DEFAULTS);

    // Register a menu command for the user to configure settings via Scriptcat/Tampermonkey.
    GM_registerMenuCommand('Configure Gestures', () => {
        const currentConfig = JSON.stringify(config, null, 2);
        const newConfigStr = prompt('Edit Gesture Settings (JSON format):', currentConfig);
        if (newConfigStr) {
            try {
                const newConfig = JSON.parse(newConfigStr);
                // Merge new config with defaults to ensure all properties are present.
                config = { ...DEFAULTS, ...newConfig }; 
                GM_setValue('config', config);
                // Use a custom message box instead of alert() for better UI.
                showMessageBox('Settings saved! Please reload the page for changes to take effect.', 2000);
            } catch (e) {
                showMessageBox('Error parsing settings. Please ensure it is valid JSON.\n\n' + e.message, 5000, true);
            }
        }
    });

    // --- Custom Message Box (Material Design inspired) ---
    // Replaces alert() for better user experience.
    function showMessageBox(message, duration = 1500, isError = false) {
        let messageBox = document.getElementById('vg-message-box');
        if (!messageBox) {
            messageBox = document.createElement('div');
            messageBox.id = 'vg-message-box';
            Object.assign(messageBox.style, {
                position: 'fixed',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '12px 20px',
                backgroundColor: isError ? '#f44336' : 'rgba(33, 33, 33, 0.95)', // Red for error, dark grey for normal
                color: '#fff',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '15px',
                borderRadius: '8px',
                zIndex: '2147483647',
                opacity: '0',
                transition: 'opacity 0.3s ease, transform 0.3s ease',
                box-shadow: '0 4px 12px rgba(0,0,0,0.2)',
                textAlign: 'center',
                maxWidth: '80%',
                wordBreak: 'break-word'
            });
            document.body.appendChild(messageBox);
        }
        messageBox.textContent = message;
        messageBox.style.opacity = '1';
        messageBox.style.transform = 'translateX(-50%) scale(1)';

        setTimeout(() => {
            messageBox.style.opacity = '0';
            messageBox.style.transform = 'translateX(-50%) scale(0.9)';
            // Remove after transition to clean up DOM
            setTimeout(() => {
                if (messageBox && messageBox.parentElement) {
                    messageBox.parentElement.removeChild(messageBox);
                }
            }, 300);
        }, duration);
    }

    // --- Styles ---
    // Injects CSS for the gesture indicator overlay.
    function injectStyles() {
        if (document.getElementById('video-gesture-pro-styles')) return;
        const style = document.createElement('style');
        style.id = 'video-gesture-pro-styles';
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');
            .vg-indicator {
                position: absolute; 
                top: 50%; 
                left: 50%;
                transform: translate(-50%, -50%) scale(0.9); /* Start slightly scaled down */
                padding: 12px 20px; 
                background-color: rgba(30, 30, 30, 0.9); /* Dark background */
                color: #fff; 
                font-family: 'Roboto', sans-serif; 
                font-size: 17px; /* Slightly larger font */
                font-weight: 500; /* Medium weight for readability */
                border-radius: 28px; /* More rounded corners (Material Design) */
                z-index: 2147483647; /* Ensure it's always on top */
                display: flex;
                align-items: center; 
                gap: 10px; /* More space between icon and text */
                opacity: 0; 
                pointer-events: none; /* Do not block touch events */
                transition: opacity 0.2s ease, transform 0.2s ease;
                box-shadow: 0 6px 20px rgba(0,0,0,0.4); /* Stronger, softer shadow */
            }
            .vg-indicator.visible { 
                opacity: 1; 
                transform: translate(-50%, -50%) scale(1); /* Scale up on visible */
            }
            .vg-indicator svg { 
                width: 28px; /* Larger icons */
                height: 28px; 
                fill: #fff; 
                flex-shrink: 0; /* Prevent icon from shrinking */
            }
            /* Styles to apply to the video element when its container is in fullscreen */
            .vg-fullscreen-active video {
                width: 100%;
                height: 100%;
                object-fit: contain; /* Ensures video fits without cropping, showing black bars if aspect ratio differs */
                background-color: black; /* Ensure black background for bars */
            }
            /* Ensure the fullscreen element itself takes full screen */
            .vg-fullscreen-active {
                width: 100% !important;
                height: 100% !important;
                max-width: 100% !important;
                max-height: 100% !important;
                position: fixed !important; /* Override potential relative/absolute positioning */
                top: 0 !important;
                left: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                background-color: black; /* Ensure background is black */
                display: flex !important; /* Use flex to center video */
                align-items: center !important;
                justify-content: center !important;
            }
            /* Hide scrollbars during fullscreen */
            html.vg-fullscreen-scroll-lock, body.vg-fullscreen-scroll-lock {
                overflow: hidden !important;
            }
        `;
        document.head.appendChild(style);
    }

    // --- Global State ---
    let touchStartX = 0, touchStartY = 0; // Initial touch coordinates
    let currentVideo = null;              // The video element currently being interacted with
    let gestureType = null;               // Current gesture being performed (e.g., 'tap', 'swipe-x')
    let tapTimeout = null;                // Timeout for double tap detection
    let tapCount = 0;                     // Counter for taps
    let playerContainer = null;           // The immediate parent of the video element (or the video itself if it's the fullscreen element)
    let originalPlayerStyle = {};         // Stores original CSS styles of the playerContainer

    // --- UI & Feedback ---
    // Displays a Material Design-inspired overlay indicator for gestures.
    function showIndicator(video, htmlContent) {
        // Determine the parent for the indicator (fullscreen element or video's direct parent)
        const parent = document.fullscreenElement || video.parentElement;
        if (!parent) return;

        // Create indicator if it doesn't exist
        if (!parent.gestureIndicator) {
             const indicator = document.createElement('div');
             indicator.className = 'vg-indicator';
             parent.appendChild(indicator);
             parent.gestureIndicator = indicator;
        }
        const { gestureIndicator } = parent;
        gestureIndicator.innerHTML = htmlContent;
        gestureIndicator.classList.add('visible');

        // Hide indicator after a short delay
        setTimeout(() => { 
            if (gestureIndicator) gestureIndicator.classList.remove('visible'); 
        }, 800);
    }

    // Triggers haptic feedback (vibration) if enabled.
    function triggerHapticFeedback() {
        if (config.ENABLE_HAPTIC_FEEDBACK && navigator.vibrate) {
            navigator.vibrate(config.HAPTIC_FEEDBACK_DURATION_MS);
        }
    }

    // --- Event Handlers ---
    // Handles the start of a touch event.
    function onTouchStart(e) {
        // Find the video element. If in fullscreen, find it within the fullscreen element.
        let video = e.target.closest('video');
        if (document.fullscreenElement) {
            // If already in fullscreen, ensure we're targeting the video within the fullscreen element.
            video = document.fullscreenElement.querySelector('video') || video; 
        }

        // Only proceed if a video is found and its duration is above the minimum threshold.
        if (!video || video.duration < config.MIN_VIDEO_DURATION_SECONDS) {
            currentVideo = null; // Reset current video if conditions not met
            return;
        }
        
        currentVideo = video;
        // Determine the player container. It's usually the direct parent, but some players might have complex structures.
        // For fullscreen, we will request fullscreen on this container.
        playerContainer = currentVideo.parentElement; 
        // If the video itself is the fullscreen element, use it.
        if (!playerContainer || playerContainer === document.body) {
            playerContainer = currentVideo;
        }

        // Record initial touch coordinates.
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        gestureType = 'tap'; // Assume a tap initially

        // Double tap detection logic (only relevant in fullscreen for now as per request)
        if (document.fullscreenElement) {
            const DOUBLE_TAP_TIMEOUT_MS = 350; // Max time between taps for double tap
            clearTimeout(tapTimeout); // Clear any previous tap timeout
            tapTimeout = setTimeout(() => { tapCount = 0; }, DOUBLE_TAP_TIMEOUT_MS);
            tapCount++;
        }
    }

    // Handles touch movement.
    function onTouchMove(e) {
        if (!currentVideo || e.touches.length > 1) return; // Ignore if no video or multi-touch

        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;

        // Determine if a swipe has occurred based on threshold.
        if (Math.abs(deltaX) > config.SWIPE_THRESHOLD || Math.abs(deltaY) > config.SWIPE_THRESHOLD) {
            if (gestureType === 'tap') { // If it was initially a tap, now it's a swipe
                const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX);
                // No need for rect or touchZoneX here, as we determine gesture type first
                
                if (!document.fullscreenElement && isVerticalSwipe && deltaY < -config.SWIPE_THRESHOLD) {
                    // Normal view: Swipe Up for Fullscreen
                    gestureType = 'swipe-up-fullscreen';
                } else if (document.fullscreenElement) {
                    // Fullscreen: Determine swipe type based on direction
                    gestureType = isVerticalSwipe ? 'swipe-y' : 'swipe-x';
                }
            }
        }
        
        // Prevent default browser scrolling/zooming if a gesture is active.
        if (gestureType && gestureType.startsWith('swipe')) {
            e.preventDefault(); 
            // For horizontal seek, update indicator in real-time during move.
            if (gestureType === 'swipe-x') {
                handleHorizontalSeekIndicator(deltaX);
            }
        }
    }

    // Handles the end of a touch event.
    function onTouchEnd(e) {
        if (!currentVideo) return; // Ignore if no current video

        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        const rect = currentVideo.getBoundingClientRect();
        const touchZoneX = (touchStartX - rect.left) / rect.width; // 0 to 1 across video width

        if (document.fullscreenElement) {
            // Fullscreen Gestures
            if (gestureType === 'tap' && tapCount >= 2) {
                e.preventDefault(); // Prevent native double-tap if any
                handleDoubleTapSeek(touchZoneX);
                clearTimeout(tapTimeout);
                tapCount = 0;
            } else if (gestureType === 'swipe-x') {
                // Horizontal drag for seeking
                handleHorizontalSeek(deltaX);
            } else if (gestureType === 'swipe-y') {
                // Vertical swipe for speed/volume based on zone
                handleVerticalSwipe(deltaY, touchZoneX);
            } else if (gestureType === 'tap' && tapCount === 1) {
                // Single tap in fullscreen, could be for native controls or pause/play
                // We let native player handle single taps unless it's a specific gesture.
                // No explicit action here to avoid conflicts.
            }
        } else {
            // Normal View Gestures
            if (gestureType === 'swipe-up-fullscreen' && deltaY < -config.SWIPE_THRESHOLD) {
                // Swipe Up to enter fullscreen
                handleFullscreenToggle();
            }
        }

        // Reset state after gesture
        currentVideo = null;
        gestureType = null;
        clearTimeout(tapTimeout);
        tapCount = 0;
    }

    // --- Gesture Logic ---

    // Handles toggling fullscreen mode.
    async function handleFullscreenToggle() {
        const isFullscreen = document.fullscreenElement;
        // Material Design-like SVG icons for fullscreen toggle.
        const icon = isFullscreen 
            ? `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>` // Exit Fullscreen
            : `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`; // Enter Fullscreen
        showIndicator(currentVideo, `${icon} ${isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}`);
        triggerHapticFeedback();

        if (isFullscreen) {
            // Exit fullscreen
            document.exitFullscreen();
        } else {
            // Enter fullscreen
            if (!playerContainer) {
                console.warn('Video Gestures Pro: playerContainer not found for fullscreen.');
                return;
            }

            // Store original styles to restore later.
            // We need to capture computed styles for properties that might be set by CSS rules.
            const computedStyle = window.getComputedStyle(playerContainer);
            originalPlayerStyle = {
                width: computedStyle.width,
                height: computedStyle.height,
                maxWidth: computedStyle.maxWidth,
                maxHeight: computedStyle.maxHeight,
                position: computedStyle.position,
                zIndex: computedStyle.zIndex,
                transform: computedStyle.transform,
                top: computedStyle.top,
                left: computedStyle.left,
                right: computedStyle.right,
                bottom: computedStyle.bottom,
                margin: computedStyle.margin,
                padding: computedStyle.padding,
                backgroundColor: computedStyle.backgroundColor,
                display: computedStyle.display,
                alignItems: computedStyle.alignItems,
                justifyContent: computedStyle.justifyContent,
                overflow: computedStyle.overflow, // Capture overflow
            };

            // Add a class to the playerContainer for fullscreen styling via CSS
            playerContainer.classList.add('vg-fullscreen-active');
            // Lock scroll on html/body to prevent accidental scrolling
            document.documentElement.classList.add('vg-fullscreen-scroll-lock');
            document.body.classList.add('vg-fullscreen-scroll-lock');

            try {
                const fsPromise = playerContainer.requestFullscreen();
                await fsPromise; // Wait for fullscreen to be active

                // Attempt to force landscape orientation if configured and video is wider than tall.
                if (config.FORCE_LANDSCAPE && currentVideo.videoWidth > currentVideo.videoHeight) {
                    if (screen.orientation && typeof screen.orientation.lock === 'function') {
                        screen.orientation.lock('landscape').catch(err => console.warn('Video Gestures Pro: Could not lock orientation:', err.message));
                    } else {
                        console.log('Video Gestures Pro: Screen orientation lock API not available.');
                    }
                }
            } catch (err) {
                console.error('Video Gestures Pro: Fullscreen request failed:', err);
                // Clean up classes if fullscreen fails
                playerContainer.classList.remove('vg-fullscreen-active');
                document.documentElement.classList.remove('vg-fullscreen-scroll-lock');
                document.body.classList.remove('vg-fullscreen-scroll-lock');
            }
        }
    }

    // Handles double tap for seeking forward/backward.
    function handleDoubleTapSeek(touchZoneX) {
        if (touchZoneX < 0.33) { // Left zone: Fast Backward
            currentVideo.currentTime = Math.max(0, currentVideo.currentTime - config.DOUBLE_TAP_SEEK_SECONDS);
            // Material Design icon for rewind
            showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm-2-6l6.5 4.5V7.5L9 12z"/></svg> -${config.DOUBLE_TAP_SEEK_SECONDS}s`);
        } else if (touchZoneX > 0.66) { // Right zone: Fast Forward
            currentVideo.currentTime = Math.min(currentVideo.duration, currentVideo.currentTime + config.DOUBLE_TAP_SEEK_SECONDS);
            // Material Design icon for fast forward
            showIndicator(currentVideo, `+${config.DOUBLE_TAP_SEEK_SECONDS}s <svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`);
        }
        triggerHapticFeedback();
    }

    // Displays the seek indicator during horizontal drag.
    function handleHorizontalSeekIndicator(deltaX) {
        const seekTime = deltaX * config.SEEK_SENSITIVITY;
        const newTime = currentVideo.currentTime + seekTime;
        const directionIcon = seekTime > 0 
            ? `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>` // Fast Forward
            : `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm-2-6l6.5 4.5V7.5L9 12z"/></svg>`; // Rewind
        showIndicator(currentVideo, `${directionIcon} ${formatTime(newTime)}`);
    }

    // Applies the horizontal seek after touch ends.
    function handleHorizontalSeek(deltaX) {
        const seekTime = deltaX * config.SEEK_SENSITIVITY;
        currentVideo.currentTime = Math.max(0, Math.min(currentVideo.duration, currentVideo.currentTime + seekTime));
        triggerHapticFeedback();
    }

    // Handles vertical swipes for playback speed and volume.
    function handleVerticalSwipe(deltaY, touchZoneX) {
        if (touchZoneX < 0.33) { // Left zone: Playback Speed
            if (deltaY < -config.SWIPE_THRESHOLD) { // Swipe Up: 2x Speed
                currentVideo.playbackRate = 2.0;
                // Material Design icon for speed increase
                const speedIcon = `<svg viewBox="0 0 24 24"><path d="M10 16.5v-9l6 4.5-6 4.5zM7 7v10h2V7H7z"/></svg>`; 
                showIndicator(currentVideo, `${speedIcon} <span>2.0x Speed</span>`);
            } else if (deltaY > config.SWIPE_THRESHOLD) { // Swipe Down: 1x Speed
                currentVideo.playbackRate = 1.0;
                // Material Design icon for normal speed
                const speedIcon = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`; 
                showIndicator(currentVideo, `${speedIcon} <span>1.0x Speed</span>`);
            }
        } else if (touchZoneX > 0.33 && touchZoneX < 0.66) { // Middle zone: Exit Fullscreen
            if (deltaY > config.SWIPE_THRESHOLD) { // Swipe Down to exit fullscreen
                handleFullscreenToggle(); // Call the toggle function to exit
            }
        }
        // Note: Volume control (right zone) from original script is removed as per request.
        triggerHapticFeedback();
    }
    
    // Handles fullscreen change events (e.g., user exits fullscreen via system controls).
    function handleFullscreenChange() {
        if (!document.fullscreenElement) {
            // If exiting fullscreen, restore original player container position and styles.
            if (playerContainer) {
                playerContainer.classList.remove('vg-fullscreen-active');
                // Restore original styles using the captured object
                for (const prop in originalPlayerStyle) {
                    playerContainer.style[prop] = originalPlayerStyle[prop];
                }
            }
            // Unlock screen orientation if it was locked.
            if (screen.orientation && typeof screen.orientation.unlock === 'function') {
                screen.orientation.unlock();
            }
            // Unlock scroll on html/body
            document.documentElement.classList.remove('vg-fullscreen-scroll-lock');
            document.body.classList.remove('vg-fullscreen-scroll-lock');
        }
    }

    // --- Utilities ---
    // Formats time in seconds into HH:MM:SS or MM:SS format.
    function formatTime(totalSeconds) {
        const sec = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        const min = Math.floor((totalSeconds / 60) % 60).toString().padStart(2, '0');
        const hr = Math.floor(totalSeconds / 3600);
        return hr > 0 ? `${hr}:${min}:${sec}` : `${min}:${sec}`;
    }

    // --- Initialization ---
    // Initializes the script by injecting styles and adding event listeners.
    function initialize() {
        injectStyles();
        // Add touch event listeners to the document body.
        // passive: false is crucial for e.preventDefault() to work, preventing default browser actions like scrolling.
        document.body.addEventListener('touchstart', onTouchStart, { passive: false });
        document.body.addEventListener('touchmove', onTouchMove, { passive: false });
        document.body.addEventListener('touchend', onTouchEnd, { passive: false });
        // Listen for native fullscreen changes.
        document.addEventListener('fullscreenchange', handleFullscreenChange);
    }

    // Ensure initialization happens after the DOM is ready.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
