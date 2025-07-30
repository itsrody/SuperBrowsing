// ==UserScript==
// @name          Video Gestures Pro Enhanced
// @namespace     https://github.com/itsrody/SuperBrowsing
// @version       8.0
// @description   Advanced gesture interface for web videos with comprehensive controls, picture-in-picture, speed controls, and accessibility features
// @author        Enhanced by Claude
// @match         *://*/*
// @exclude       *://*.youtube.com/*
// @exclude       *://*.dailymotion.com/*
// @exclude       *://*.vimeo.com/*
// @exclude       *://*.netflix.com/*
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_registerMenuCommand
// @grant         GM_addStyle
// @run-at        document-start
// ==/UserScript==

(async function() {
    'use strict';

    // --- Enhanced Configuration Panel ---
    const DEFAULTS = {
        MIN_VIDEO_DURATION_SECONDS: 90,
        DOUBLE_TAP_SEEK_SECONDS: 10,
        TRIPLE_TAP_SEEK_SECONDS: 30,
        SWIPE_THRESHOLD: 20,
        SEEK_SENSITIVITY: 0.5,
        VOLUME_SENSITIVITY: 0.8,
        ENABLE_HAPTIC_FEEDBACK: true,
        HAPTIC_FEEDBACK_DURATION_MS: 20,
        FORCE_LANDSCAPE: true,
        ENABLE_PIP: true,
        ENABLE_SPEED_SHORTCUTS: true,
        ENABLE_BRIGHTNESS_CONTROL: true,
        BRIGHTNESS_SENSITIVITY: 0.3,
        SHOW_TIME_PREVIEW: true,
        GESTURE_ZONES_VISIBLE: false,
        AUTO_HIDE_CONTROLS: true,
        CONTROL_HIDE_DELAY: 3000,
        ENABLE_KEYBOARD_SHORTCUTS: true,
        ENABLE_SCROLL_WHEEL: true,
        LONG_PRESS_THRESHOLD: 500,
        ENABLE_GESTURE_TRAILS: true,
        SPEED_PRESETS: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0],
        THEME: 'dark' // 'dark', 'light', 'auto'
    };
    
    let config = await GM_getValue('config', DEFAULTS);
    let gestureHistory = [];
    let brightnessOverlay = null;
    let controlsHideTimeout = null;
    let longPressTimeout = null;
    let isLongPress = false;

    // --- Enhanced Menu Commands ---
    GM_registerMenuCommand('⚙️ Configure Gestures', showConfigDialog);
    GM_registerMenuCommand('📊 View Gesture Stats', showGestureStats);
    GM_registerMenuCommand('🔄 Reset to Defaults', resetToDefaults);
    GM_registerMenuCommand('💡 Show Help', showHelpDialog);

    function showConfigDialog() {
        const dialog = createConfigDialog();
        document.body.appendChild(dialog);
    }

    function createConfigDialog() {
        const overlay = document.createElement('div');
        overlay.className = 'vg-config-overlay';
        overlay.innerHTML = `
            <div class="vg-config-dialog">
                <div class="vg-config-header">
                    <h2>Video Gestures Pro Settings</h2>
                    <button class="vg-close-btn">&times;</button>
                </div>
                <div class="vg-config-content">
                    <div class="vg-config-section">
                        <h3>Basic Settings</h3>
                        <label>
                            <span>Minimum Video Duration (seconds):</span>
                            <input type="number" name="MIN_VIDEO_DURATION_SECONDS" value="${config.MIN_VIDEO_DURATION_SECONDS}" min="0">
                        </label>
                        <label>
                            <span>Double Tap Seek (seconds):</span>
                            <input type="number" name="DOUBLE_TAP_SEEK_SECONDS" value="${config.DOUBLE_TAP_SEEK_SECONDS}" min="1" max="60">
                        </label>
                        <label>
                            <span>Swipe Sensitivity:</span>
                            <input type="range" name="SEEK_SENSITIVITY" value="${config.SEEK_SENSITIVITY}" min="0.1" max="2" step="0.1">
                            <span class="value">${config.SEEK_SENSITIVITY}</span>
                        </label>
                    </div>
                    
                    <div class="vg-config-section">
                        <h3>Advanced Features</h3>
                        <label class="checkbox">
                            <input type="checkbox" name="ENABLE_PIP" ${config.ENABLE_PIP ? 'checked' : ''}>
                            <span>Enable Picture-in-Picture</span>
                        </label>
                        <label class="checkbox">
                            <input type="checkbox" name="ENABLE_BRIGHTNESS_CONTROL" ${config.ENABLE_BRIGHTNESS_CONTROL ? 'checked' : ''}>
                            <span>Enable Brightness Control</span>
                        </label>
                        <label class="checkbox">
                            <input type="checkbox" name="SHOW_TIME_PREVIEW" ${config.SHOW_TIME_PREVIEW ? 'checked' : ''}>
                            <span>Show Time Preview</span>
                        </label>
                        <label class="checkbox">
                            <input type="checkbox" name="ENABLE_HAPTIC_FEEDBACK" ${config.ENABLE_HAPTIC_FEEDBACK ? 'checked' : ''}>
                            <span>Haptic Feedback</span>
                        </label>
                    </div>
                    
                    <div class="vg-config-section">
                        <h3>UI & Accessibility</h3>
                        <label>
                            <span>Theme:</span>
                            <select name="THEME">
                                <option value="dark" ${config.THEME === 'dark' ? 'selected' : ''}>Dark</option>
                                <option value="light" ${config.THEME === 'light' ? 'selected' : ''}>Light</option>
                                <option value="auto" ${config.THEME === 'auto' ? 'selected' : ''}>Auto</option>
                            </select>
                        </label>
                        <label class="checkbox">
                            <input type="checkbox" name="GESTURE_ZONES_VISIBLE" ${config.GESTURE_ZONES_VISIBLE ? 'checked' : ''}>
                            <span>Show Gesture Zones</span>
                        </label>
                        <label class="checkbox">
                            <input type="checkbox" name="AUTO_HIDE_CONTROLS" ${config.AUTO_HIDE_CONTROLS ? 'checked' : ''}>
                            <span>Auto-hide Controls</span>
                        </label>
                    </div>
                </div>
                <div class="vg-config-footer">
                    <button class="vg-btn-secondary" id="vg-reset-btn">Reset Defaults</button>
                    <button class="vg-btn-primary" id="vg-save-btn">Save Changes</button>
                </div>
            </div>
        `;

        // Event listeners for the dialog
        const closeBtn = overlay.querySelector('.vg-close-btn');
        const saveBtn = overlay.querySelector('#vg-save-btn');
        const resetBtn = overlay.querySelector('#vg-reset-btn');

        closeBtn.onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        
        saveBtn.onclick = () => {
            const formData = new FormData(overlay.querySelector('.vg-config-content'));
            const newConfig = { ...config };
            
            for (const [key, value] of formData.entries()) {
                if (config.hasOwnProperty(key)) {
                    if (typeof config[key] === 'boolean') {
                        newConfig[key] = value === 'on';
                    } else if (typeof config[key] === 'number') {
                        newConfig[key] = parseFloat(value) || config[key];
                    } else {
                        newConfig[key] = value;
                    }
                }
            }
            
            config = newConfig;
            GM_setValue('config', config);
            showToast('Settings saved successfully!');
            overlay.remove();
        };

        resetBtn.onclick = () => {
            if (confirm('Reset all settings to defaults?')) {
                config = { ...DEFAULTS };
                GM_setValue('config', config);
                showToast('Settings reset to defaults');
                overlay.remove();
            }
        };

        return overlay;
    }

    function resetToDefaults() {
        if (confirm('Reset all settings to defaults?')) {
            config = { ...DEFAULTS };
            GM_setValue('config', config);
            alert('Settings reset to defaults. Please reload the page.');
        }
    }

    function showGestureStats() {
        const stats = GM_getValue('gestureStats', {});
        const statsText = Object.entries(stats)
            .map(([gesture, count]) => `${gesture}: ${count} times`)
            .join('\n') || 'No gesture statistics available yet.';
        alert(`Gesture Usage Statistics:\n\n${statsText}`);
    }

    function showHelpDialog() {
        const helpContent = `
Video Gestures Pro - Help

🎯 GESTURE ZONES:
• Left third: Playback speed & brightness control
• Center third: Play/pause & fullscreen toggle
• Right third: Volume control

👆 GESTURES:
• Single tap: Play/pause (fullscreen only)
• Double tap (left): Rewind ${config.DOUBLE_TAP_SEEK_SECONDS}s
• Double tap (right): Forward ${config.DOUBLE_TAP_SEEK_SECONDS}s
• Triple tap (center): Toggle fullscreen
• Long press: Show context menu
• Swipe left/right: Seek backward/forward
• Swipe up/down (left): Speed control
• Swipe up/down (right): Volume control
• Swipe up/down (center): Fullscreen toggle
• Pinch: Zoom (if supported)

⌨️ KEYBOARD (when enabled):
• Space: Play/pause
• Arrow keys: Seek & volume
• F: Fullscreen
• P: Picture-in-Picture
• +/-: Speed control

🖱️ MOUSE (when enabled):
• Scroll wheel: Volume control
• Scroll + Shift: Speed control
• Scroll + Ctrl: Brightness control
        `;
        alert(helpContent);
    }

    // --- Enhanced Styles ---
    function injectStyles() {
        if (document.getElementById('video-gesture-pro-styles')) return;
        
        const isDarkTheme = config.THEME === 'dark' || 
            (config.THEME === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

        GM_addStyle(`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
            
            .vg-indicator {
                position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                padding: 12px 20px; 
                background: ${isDarkTheme ? 'rgba(20, 20, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
                color: ${isDarkTheme ? '#fff' : '#333'};
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
                font-size: 16px; font-weight: 500;
                border-radius: 12px; 
                z-index: 2147483647; 
                display: flex; align-items: center; gap: 10px; 
                opacity: 0; pointer-events: none;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                backdrop-filter: blur(10px);
                border: 1px solid ${isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
            }
            
            .vg-indicator.visible { 
                opacity: 1; 
                transform: translate(-50%, -50%) scale(1); 
            }
            
            .vg-indicator svg { 
                width: 24px; height: 24px; 
                fill: ${isDarkTheme ? '#fff' : '#333'}; 
            }

            .vg-progress-bar {
                position: absolute; bottom: 0; left: 0; right: 0;
                height: 4px; background: rgba(255,255,255,0.3);
                z-index: 2147483646;
            }
            
            .vg-progress-fill {
                height: 100%; background: #ff4757;
                transition: width 0.1s linear;
            }

            .vg-gesture-zones {
                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                pointer-events: none; z-index: 2147483645;
                opacity: ${config.GESTURE_ZONES_VISIBLE ? '0.3' : '0'};
                transition: opacity 0.3s ease;
            }
            
            .vg-zone {
                position: absolute; top: 0; bottom: 0; width: 33.33%;
                border: 2px dashed rgba(255,255,255,0.5);
            }
            
            .vg-zone:nth-child(1) { left: 0; }
            .vg-zone:nth-child(2) { left: 33.33%; }
            .vg-zone:nth-child(3) { right: 0; }

            .vg-brightness-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.5); pointer-events: none;
                z-index: 2147483644; transition: opacity 0.3s ease;
            }

            .vg-toast {
                position: fixed; top: 20px; right: 20px;
                padding: 12px 20px; background: #2d3748; color: white;
                border-radius: 8px; z-index: 2147483647;
                font-family: 'Inter', sans-serif; font-size: 14px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                transform: translateX(100%); transition: transform 0.3s ease;
            }
            
            .vg-toast.visible { transform: translateX(0); }

            /* Config Dialog Styles */
            .vg-config-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7); z-index: 2147483647;
                display: flex; align-items: center; justify-content: center;
                backdrop-filter: blur(5px);
            }
            
            .vg-config-dialog {
                background: ${isDarkTheme ? '#1a202c' : '#ffffff'};
                color: ${isDarkTheme ? '#ffffff' : '#1a202c'};
                border-radius: 12px; max-width: 600px; width: 90%;
                max-height: 80vh; overflow: hidden;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            
            .vg-config-header {
                padding: 20px; border-bottom: 1px solid ${isDarkTheme ? '#2d3748' : '#e2e8f0'};
                display: flex; justify-content: space-between; align-items: center;
            }
            
            .vg-config-header h2 {
                margin: 0; font-size: 20px; font-weight: 600;
            }
            
            .vg-close-btn {
                background: none; border: none; font-size: 24px;
                color: ${isDarkTheme ? '#a0aec0' : '#718096'};
                cursor: pointer; padding: 0; width: 30px; height: 30px;
                display: flex; align-items: center; justify-content: center;
                border-radius: 50%; transition: background 0.2s ease;
            }
            
            .vg-close-btn:hover {
                background: ${isDarkTheme ? '#2d3748' : '#f7fafc'};
            }
            
            .vg-config-content {
                padding: 20px; max-height: 60vh; overflow-y: auto;
            }
            
            .vg-config-section {
                margin-bottom: 24px;
            }
            
            .vg-config-section h3 {
                margin: 0 0 16px 0; font-size: 16px; font-weight: 600;
                color: ${isDarkTheme ? '#e2e8f0' : '#4a5568'};
            }
            
            .vg-config-section label {
                display: flex; align-items: center; margin-bottom: 12px;
                font-size: 14px;
            }
            
            .vg-config-section label span:first-child {
                flex: 1; margin-right: 12px;
            }
            
            .vg-config-section input, .vg-config-section select {
                padding: 8px 12px; border: 1px solid ${isDarkTheme ? '#4a5568' : '#cbd5e0'};
                border-radius: 6px; background: ${isDarkTheme ? '#2d3748' : '#ffffff'};
                color: ${isDarkTheme ? '#ffffff' : '#1a202c'};
                font-size: 14px; min-width: 120px;
            }
            
            .vg-config-section .checkbox {
                justify-content: flex-start;
            }
            
            .vg-config-section .checkbox input {
                margin-right: 8px; min-width: auto;
            }
            
            .vg-config-footer {
                padding: 20px; border-top: 1px solid ${isDarkTheme ? '#2d3748' : '#e2e8f0'};
                display: flex; gap: 12px; justify-content: flex-end;
            }
            
            .vg-btn-primary, .vg-btn-secondary {
                padding: 10px 20px; border: none; border-radius: 6px;
                font-size: 14px; font-weight: 500; cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .vg-btn-primary {
                background: #4299e1; color: white;
            }
            
            .vg-btn-primary:hover {
                background: #3182ce;
            }
            
            .vg-btn-secondary {
                background: ${isDarkTheme ? '#4a5568' : '#e2e8f0'};
                color: ${isDarkTheme ? '#ffffff' : '#4a5568'};
            }
            
            .vg-btn-secondary:hover {
                background: ${isDarkTheme ? '#2d3748' : '#cbd5e0'};
            }
        `);
    }

    // --- Enhanced Global State ---
    let touchStartX = 0, touchStartY = 0;
    let currentVideo = null;
    let gestureType = null;
    let tapTimeout = null;
    let tapCount = 0;
    let playerContainer = null;
    let originalParent = null;
    let originalNextSibling = null;
    let originalPlayerStyle = {};
    let gestureTrail = [];
    let progressBar = null;

    // --- Enhanced UI & Feedback ---
    function showIndicator(video, html, duration = 1000) {
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
        gestureIndicator.classList.add('visible');
        
        clearTimeout(gestureIndicator.timeout);
        gestureIndicator.timeout = setTimeout(() => {
            if (gestureIndicator) gestureIndicator.classList.remove('visible');
        }, duration);
    }

    function showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'vg-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('visible'), 100);
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function updateProgressBar(video) {
        if (!config.SHOW_TIME_PREVIEW) return;
        
        const parent = document.fullscreenElement || video.parentElement;
        if (!parent) return;
        
        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.className = 'vg-progress-bar';
            progressBar.innerHTML = '<div class="vg-progress-fill"></div>';
            parent.appendChild(progressBar);
        }
        
        const fill = progressBar.querySelector('.vg-progress-fill');
        const progress = (video.currentTime / video.duration) * 100;
        fill.style.width = `${progress}%`;
    }

    function createGestureZones(parent) {
        if (!config.GESTURE_ZONES_VISIBLE) return;
        
        const zones = document.createElement('div');
        zones.className = 'vg-gesture-zones';
        zones.innerHTML = `
            <div class="vg-zone"></div>
            <div class="vg-zone"></div>
            <div class="vg-zone"></div>
        `;
        parent.appendChild(zones);
    }

    function updateBrightness(level) {
        if (!config.ENABLE_BRIGHTNESS_CONTROL) return;
        
        if (!brightnessOverlay) {
            brightnessOverlay = document.createElement('div');
            brightnessOverlay.className = 'vg-brightness-overlay';
            document.body.appendChild(brightnessOverlay);
        }
        
        const opacity = Math.max(0, Math.min(0.9, 1 - level));
        brightnessOverlay.style.opacity = opacity;
    }

    function trackGesture(gestureType) {
        const stats = GM_getValue('gestureStats', {});
        stats[gestureType] = (stats[gestureType] || 0) + 1;
        GM_setValue('gestureStats', stats);
        
        gestureHistory.push({
            type: gestureType,
            timestamp: Date.now(),
            video: currentVideo ? currentVideo.src : 'unknown'
        });
        
        // Keep only last 100 gestures
        if (gestureHistory.length > 100) {
            gestureHistory = gestureHistory.slice(-100);
        }
    }

    function triggerHapticFeedback(pattern = [config.HAPTIC_FEEDBACK_DURATION_MS]) {
        if (config.ENABLE_HAPTIC_FEEDBACK && navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }

    // --- Enhanced Event Handlers ---
    function onTouchStart(e) {
        let video = e.target.closest('video');
        if (document.fullscreenElement) {
            video = document.fullscreenElement.querySelector('video');
        }

        if (!video || video.duration < config.MIN_VIDEO_DURATION_SECONDS) return;
        
        currentVideo = video;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        gestureType = 'tap';
        isLongPress = false;

        // Long press detection
        longPressTimeout = setTimeout(() => {
            isLongPress = true;
            handleLongPress();
        }, config.LONG_PRESS_THRESHOLD);

        // Tap counting logic
        const DOUBLE_TAP_TIMEOUT_MS = 350;
        const TRIPLE_TAP_TIMEOUT_MS = 500;
        
        clearTimeout(tapTimeout);
        tapCount++;
        
        if (tapCount === 1) {
            tapTimeout = setTimeout(() => {
                if (tapCount === 1) handleSingleTap();
                tapCount = 0;
            }, DOUBLE_TAP_TIMEOUT_MS);
        } else if (tapCount === 2) {
            tapTimeout = setTimeout(() => {
                if (tapCount === 2) handleDoubleTap();
                else if (tapCount === 3) handleTripleTap();
                tapCount = 0;
            }, TRIPLE_TAP_TIMEOUT_MS);
        } else if (tapCount === 3) {
            clearTimeout(tapTimeout);
            handleTripleTap();
            tapCount = 0;
        }

        // Update progress bar
        updateProgressBar(video);
    }

    function onTouchMove(e) {
        if (!currentVideo || e.touches.length > 1) return;

        clearTimeout(longPressTimeout);
        
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;

        if (Math.abs(deltaX) > config.SWIPE_THRESHOLD || Math.abs(deltaY) > config.SWIPE_THRESHOLD) {
            if (gestureType === 'tap') {
                const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX);
                const rect = currentVideo.getBoundingClientRect();
                const tapZone = (touchStartX - rect.left) / rect.width;

                if (isVerticalSwipe && tapZone > 0.33 && tapZone < 0.66) {
                    gestureType = 'swipe-y-fullscreen';
                } else {
                    gestureType = isVerticalSwipe ? 'swipe-y' : 'swipe-x';
                }
                
                trackGesture(gestureType);
            }
        }
        
        if (gestureType && gestureType.startsWith('swipe')) {
            e.preventDefault();
            if (gestureType === 'swipe-x') handleHorizontalSwipe(deltaX);
            if (gestureType === 'swipe-y') handleVerticalSwipe(deltaY);
        }

        // Gesture trail effect
        if (config.ENABLE_GESTURE_TRAILS) {
            gestureTrail.push({ x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() });
            if (gestureTrail.length > 10) gestureTrail.shift();
        }
    }

    function onTouchEnd(e) {
        if (!currentVideo) return;

        clearTimeout(longPressTimeout);

        if (isLongPress) return; // Long press was handled

        if (gestureType === 'swipe-y-fullscreen') {
            const deltaY = e.changedTouches[0].clientY - touchStartY;
            if (Math.abs(deltaY) > config.SWIPE_THRESHOLD) {
                handleFullscreenToggle();
            }
        } else if (gestureType === 'swipe-x') {
            const deltaX = e.changedTouches[0].clientX - touchStartX;
            const seekTime = (deltaX * config.SEEK_SENSITIVITY) / 10;
            currentVideo.currentTime = Math.max(0, Math.min(currentVideo.duration, currentVideo.currentTime + seekTime));
            triggerHapticFeedback();
            trackGesture('seek-swipe');
        } else if (gestureType === 'swipe-y') {
            triggerHapticFeedback();
        }

        currentVideo = null;
        gestureType = null;
        gestureTrail = [];
    }

    // --- Enhanced Gesture Logic ---
    function handleSingleTap() {
        if (!document.fullscreenElement) return;
        
        const rect = currentVideo.getBoundingClientRect();
        const tapZone = (touchStartX - rect.left) / rect.width;
        
        if (tapZone > 0.33 && tapZone < 0.66) {
            // Center zone - play/pause
            if (currentVideo.paused) {
                currentVideo.play();
                showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Play`);
            } else {
                currentVideo.pause();
                showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause`);
            }
            trackGesture('single-tap-play-pause');
        }
    }

    function handleDoubleTap() {
        if (!document.fullscreenElement) return;
        
        const rect = currentVideo.getBoundingClientRect();
        const tapZone = (touchStartX - rect.left) / rect.width;

        if (tapZone < 0.33) {
            currentVideo.currentTime = Math.max(0, currentVideo.currentTime - config.DOUBLE_TAP_SEEK_SECONDS);
            showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6l-8.5 6z"/></svg> -${config.DOUBLE_TAP_SEEK_SECONDS}s`);
            trackGesture('double-tap-rewind');
        } else if (tapZone > 0.66) {
            currentVideo.currentTime = Math.min(currentVideo.duration, currentVideo.currentTime + config.DOUBLE_TAP_SEEK_SECONDS);
            showIndicator(currentVideo, `+${config.DOUBLE_TAP_SEEK_SECONDS}s <svg viewBox="0 0 24 24"><path d="M18 6h-2v12h2zM4 6v12l8.5-6L4 6z"/></svg>`);
            trackGesture('double-tap-forward');
        }
        
        triggerHapticFeedback([50, 50, 50]);
        updateProgressBar(currentVideo);
    }

    function handleTripleTap() {
        const rect = currentVideo.getBoundingClientRect();
        const tapZone = (touchStartX - rect.left) / rect.width;
        
        if (tapZone > 0.33 && tapZone < 0.66) {
            // Center zone - toggle fullscreen
            handleFullscreenToggle();
            trackGesture('triple-tap-fullscreen');
        } else if (tapZone < 0.33) {
            // Left zone - jump to beginning
            currentVideo.currentTime = 0;
            showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6l-8.5 6z"/></svg> Start`);
            trackGesture('triple-tap-start');
        } else if (tapZone > 0.66) {
            // Right zone - toggle Picture-in-Picture
            if (config.ENABLE_PIP) {
                handlePictureInPicture();
                trackGesture('triple-tap-pip');
            }
        }
        
        triggerHapticFeedback([50, 50, 50, 50, 50, 50]);
    }

    function handleLongPress() {
        showContextMenu();
        triggerHapticFeedback([100, 50, 100]);
        trackGesture('long-press');
    }

    function showContextMenu() {
        const menu = document.createElement('div');
        menu.className = 'vg-context-menu';
        menu.innerHTML = `
            <div class="vg-menu-item" data-action="pip">📺 Picture-in-Picture</div>
            <div class="vg-menu-item" data-action="speed">⚡ Speed Settings</div>
            <div class="vg-menu-item" data-action="brightness">☀️ Brightness</div>
            <div class="vg-menu-item" data-action="settings">⚙️ Settings</div>
        `;
        
        menu.style.cssText = `
            position: absolute;
            left: ${touchStartX}px;
            top: ${touchStartY}px;
            background: rgba(20, 20, 20, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 8px;
            padding: 8px 0;
            z-index: 2147483647;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        `;
        
        menu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            switch(action) {
                case 'pip': handlePictureInPicture(); break;
                case 'speed': showSpeedMenu(); break;
                case 'brightness': showBrightnessControl(); break;
                case 'settings': showConfigDialog(); break;
            }
            menu.remove();
        });
        
        document.body.appendChild(menu);
        setTimeout(() => menu.remove(), 5000);
    }

    function handlePictureInPicture() {
        if (!config.ENABLE_PIP || !document.pictureInPictureEnabled) {
            showToast('Picture-in-Picture not supported');
            return;
        }
        
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture();
            showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg> Exit PiP`);
        } else {
            currentVideo.requestPictureInPicture().then(() => {
                showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg> Picture-in-Picture`);
            }).catch(err => {
                showToast('Failed to enter Picture-in-Picture');
            });
        }
    }

    function showSpeedMenu() {
        const menu = document.createElement('div');
        menu.className = 'vg-speed-menu';
        
        const speedButtons = config.SPEED_PRESETS.map(speed => 
            `<button class="vg-speed-btn ${currentVideo.playbackRate === speed ? 'active' : ''}" data-speed="${speed}">${speed}x</button>`
        ).join('');
        
        menu.innerHTML = `
            <div class="vg-speed-header">Playback Speed</div>
            <div class="vg-speed-buttons">${speedButtons}</div>
        `;
        
        menu.style.cssText = `
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(20, 20, 20, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 12px; padding: 20px;
            z-index: 2147483647;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        `;
        
        menu.addEventListener('click', (e) => {
            if (e.target.classList.contains('vg-speed-btn')) {
                const speed = parseFloat(e.target.dataset.speed);
                currentVideo.playbackRate = speed;
                showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M13,8V16L18,12M4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12Z"/></svg> ${speed}x Speed`);
                menu.remove();
            }
        });
        
        document.body.appendChild(menu);
        setTimeout(() => menu.remove(), 5000);
    }

    function handleFullscreenToggle() {
        const isFullscreen = document.fullscreenElement;
        const icon = isFullscreen 
            ? `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`
            : `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
        
        showIndicator(currentVideo, `${icon} ${isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}`);
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
            
            // Store original styles
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
            
            // Add gesture zones
            createGestureZones(wrapper);
            
            const fsPromise = wrapper.requestFullscreen();
            
            if (config.FORCE_LANDSCAPE && currentVideo.videoWidth > currentVideo.videoHeight) {
                fsPromise.then(() => {
                    if (screen.orientation && typeof screen.orientation.lock === 'function') {
                        screen.orientation.lock('landscape').catch(err => 
                            console.warn('Could not lock orientation:', err.message)
                        );
                    }
                }).catch(err => console.warn('Fullscreen request failed:', err.message));
            }
        }
    }

    function handleHorizontalSwipe(deltaX) {
        const seekTime = (deltaX * config.SEEK_SENSITIVITY) / 10;
        const newTime = Math.max(0, Math.min(currentVideo.duration, currentVideo.currentTime + seekTime));
        const direction = seekTime > 0 ? 'forward' : 'backward';
        
        const icon = direction === 'forward' 
            ? `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>` 
            : `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6L18 7.5v9L11.5 12z"/></svg>`;
        
        showIndicator(currentVideo, `${icon} ${formatTime(newTime)}`, 500);
        updateProgressBar(currentVideo);
    }

    function handleVerticalSwipe(deltaY) {
        const rect = currentVideo.getBoundingClientRect();
        const tapZone = (touchStartX - rect.left) / rect.width;
        
        if (tapZone > 0.66) { 
            // Right side - Volume control
            const volumeChange = (-deltaY / 100) * config.VOLUME_SENSITIVITY;
            const newVolume = Math.max(0, Math.min(1, currentVideo.volume + volumeChange));
            currentVideo.volume = newVolume;
            
            const volumeIcon = newVolume === 0 
                ? `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`
                : `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
            
            showIndicator(currentVideo, `${volumeIcon} ${Math.round(newVolume * 100)}%`, 500);
            
        } else if (tapZone < 0.33) { 
            // Left side - Speed and Brightness control
            if (deltaY < -config.SWIPE_THRESHOLD) { 
                // Swipe Up - Increase speed
                const currentSpeed = currentVideo.playbackRate;
                const speedIndex = config.SPEED_PRESETS.indexOf(currentSpeed);
                const newSpeedIndex = Math.min(config.SPEED_PRESETS.length - 1, speedIndex + 1);
                const newSpeed = config.SPEED_PRESETS[newSpeedIndex] || 2.0;
                
                currentVideo.playbackRate = newSpeed;
                showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg> ${newSpeed}x Speed`, 500);
                
            } else if (deltaY > config.SWIPE_THRESHOLD) { 
                // Swipe Down - Decrease speed or control brightness
                if (config.ENABLE_BRIGHTNESS_CONTROL && deltaY > config.SWIPE_THRESHOLD * 2) {
                    const brightnessChange = deltaY / 200;
                    const currentBrightness = parseFloat(currentVideo.style.filter?.match(/brightness\(([^)]+)\)/)?.[1] || '1');
                    const newBrightness = Math.max(0.1, Math.min(2, currentBrightness - brightnessChange));
                    
                    currentVideo.style.filter = `brightness(${newBrightness})`;
                    updateBrightness(newBrightness);
                    showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/></svg> ${Math.round(newBrightness * 100)}%`, 500);
                } else {
                    const currentSpeed = currentVideo.playbackRate;
                    const speedIndex = config.SPEED_PRESETS.indexOf(currentSpeed);
                    const newSpeedIndex = Math.max(0, speedIndex - 1);
                    const newSpeed = config.SPEED_PRESETS[newSpeedIndex] || 0.5;
                    
                    currentVideo.playbackRate = newSpeed;
                    showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> ${newSpeed}x Speed`, 500);
                }
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
            
            // Clean up UI elements
            if (progressBar) {
                progressBar.remove();
                progressBar = null;
            }
        }
    }

    // --- Keyboard Shortcuts ---
    function onKeyDown(e) {
        if (!config.ENABLE_KEYBOARD_SHORTCUTS) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        const video = document.querySelector('video');
        if (!video) return;
        
        switch(e.code) {
            case 'Space':
                e.preventDefault();
                if (video.paused) video.play();
                else video.pause();
                trackGesture('keyboard-play-pause');
                break;
                
            case 'ArrowLeft':
                e.preventDefault();
                video.currentTime = Math.max(0, video.currentTime - (e.shiftKey ? 30 : 10));
                trackGesture('keyboard-seek-backward');
                break;
                
            case 'ArrowRight':
                e.preventDefault();
                video.currentTime = Math.min(video.duration, video.currentTime + (e.shiftKey ? 30 : 10));
                trackGesture('keyboard-seek-forward');
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                video.volume = Math.min(1, video.volume + 0.1);
                trackGesture('keyboard-volume-up');
                break;
                
            case 'ArrowDown':
                e.preventDefault();
                video.volume = Math.max(0, video.volume - 0.1);
                trackGesture('keyboard-volume-down');
                break;
                
            case 'KeyF':
                e.preventDefault();
                currentVideo = video;
                handleFullscreenToggle();
                trackGesture('keyboard-fullscreen');
                break;
                
            case 'KeyP':
                e.preventDefault();
                currentVideo = video;
                handlePictureInPicture();
                trackGesture('keyboard-pip');
                break;
        }
    }

    // --- Mouse/Wheel Support ---
    function onWheel(e) {
        if (!config.ENABLE_SCROLL_WHEEL) return;
        
        const video = e.target.closest('video');
        if (!video) return;
        
        e.preventDefault();
        
        if (e.ctrlKey && config.ENABLE_BRIGHTNESS_CONTROL) {
            // Brightness control
            const currentBrightness = parseFloat(video.style.filter?.match(/brightness\(([^)]+)\)/)?.[1] || '1');
            const brightnessChange = e.deltaY > 0 ? -0.1 : 0.1;
            const newBrightness = Math.max(0.1, Math.min(2, currentBrightness + brightnessChange));
            
            video.style.filter = `brightness(${newBrightness})`;
            updateBrightness(newBrightness);
            showIndicator(video, `<svg viewBox="0 0 24 24"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6 6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/></svg> ${Math.round(newBrightness * 100)}%`);
            
        } else if (e.shiftKey) {
            // Speed control
            const currentSpeed = video.playbackRate;
            const speedChange = e.deltaY > 0 ? -0.25 : 0.25;
            const newSpeed = Math.max(0.25, Math.min(4, currentSpeed + speedChange));
            
            video.playbackRate = newSpeed;
            showIndicator(video, `<svg viewBox="0 0 24 24"><path d="M13,8V16L18,12M4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12Z"/></svg> ${newSpeed}x Speed`);
            
        } else {
            // Volume control
            const volumeChange = e.deltaY > 0 ? -0.05 : 0.05;
            const newVolume = Math.max(0, Math.min(1, video.volume + volumeChange));
            video.volume = newVolume;
            
            const volumeIcon = newVolume === 0 
                ? `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`
                : `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
            
            showIndicator(video, `${volumeIcon} ${Math.round(newVolume * 100)}%`);
        }
        
        trackGesture('wheel-control');
    }

    // --- Utilities ---
    function formatTime(totalSeconds) {
        const sec = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        const min = Math.floor((totalSeconds / 60) % 60).toString().padStart(2, '0');
        const hr = Math.floor(totalSeconds / 3600);
        return hr > 0 ? `${hr}:${min}:${sec}` : `${min}:${sec}`;
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // --- Auto-hide Controls ---
    function showControls(video) {
        if (!config.AUTO_HIDE_CONTROLS) return;
        
        const controls = video.getAttribute('controls');
        if (controls === null) {
            video.setAttribute('controls', '');
        }
        
        clearTimeout(controlsHideTimeout);
        controlsHideTimeout = setTimeout(() => {
            video.removeAttribute('controls');
        }, config.CONTROL_HIDE_DELAY);
    }

    // --- Enhanced Initialization ---
    function initialize() {
        injectStyles();
        
        // Touch events
        document.addEventListener('touchstart', onTouchStart, { passive: false });
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd, { passive: false });
        
        // Keyboard events
        if (config.ENABLE_KEYBOARD_SHORTCUTS) {
            document.addEventListener('keydown', onKeyDown);
        }
        
        // Mouse events
        if (config.ENABLE_SCROLL_WHEEL) {
            document.addEventListener('wheel', onWheel, { passive: false });
        }
        
        // Fullscreen changes
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        
        // Video events
        document.addEventListener('play', (e) => {
            if (e.target.tagName === 'VIDEO') {
                showControls(e.target);
                updateProgressBar(e.target);
            }
        }, true);
        
        document.addEventListener('pause', (e) => {
            if (e.target.tagName === 'VIDEO') {
                showControls(e.target);
            }
        }, true);
        
        // Theme detection
        if (config.THEME === 'auto') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addListener(() => {
                document.getElementById('video-gesture-pro-styles')?.remove();
                injectStyles();
            });
        }
        
        console.log('Video Gestures Pro Enhanced v8.0 initialized');
        showToast('Video Gestures Pro Enhanced loaded!', 2000);
    }

    // --- Error Handling ---
    window.addEventListener('error', (e) => {
        if (e.filename?.includes('video-gestures')) {
            console.error('Video Gestures Pro Error:', e.error);
            showToast('Gesture error occurred', 2000);
        }
    });

    // --- Performance Monitoring ---
    let performanceMetrics = {
        gestureCount: 0,
        averageResponseTime: 0,
        errors: 0
    };

    function updatePerformanceMetrics(startTime) {
        const responseTime = performance.now() - startTime;
        performanceMetrics.gestureCount++;
        performanceMetrics.averageResponseTime = 
            (performanceMetrics.averageResponseTime + responseTime) / 2;
    }

    // Start the enhanced userscript
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        GM_setValue('performanceMetrics', performanceMetrics);
    });

})();
