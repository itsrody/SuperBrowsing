// ==UserScript==
// @name          Video Gestures Pro (with Progress Saving)
// @namespace    https://github.com/itsrody/SuperBrowsing
// @version      11.0
// @description  Adds a powerful, zoned gesture interface and automatically saves/restores video progress.
// @author       Murtaza Salih (with Gemini improvements)
// @match        *://*/*
// @exclude      *://*.netflix.com/*
// @exclude      *://netflix.com/*
// @exclude      *://*.youtube.com/*
// @exclude      *://youtube.com/*
// @exclude      *://*.instagram.com/*
// @exclude      *://instagram.com/*
// @exclude      *://*.facebook.com/*
// @exclude      *://facebook.com/*
// @exclude      *://*.reddit.com/*
// @exclude      *://reddit.com/*
// @exclude      *://*.tiktok.com/*
// @exclude      *://tiktok.com/*
// @exclude      *://*.dailymotion.com/*
// @exclude      *://dailymotion.com/*
// @exclude      *://*.hulu.com/*
// @exclude      *://hulu.com/*
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.deleteValue
// @grant        GM.listValues
// @grant        GM.addStyle
// @grant        GM.registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(async function() {
    'use strict';

    // --- Central Configuration Panel ---
    const DEFAULTS = {
        MIN_DURATION_TO_SAVE: 60,
        SAVE_INTERVAL: 2000,
        CLEANUP_DAYS: 60,
        DOUBLE_TAP_SEEK_SECONDS: 10,
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

    const SCRIPT_PREFIX = 'vgs_'; // Video Gesture Saver prefix
    const LAST_CLEANUP_KEY = `${SCRIPT_PREFIX}last_cleanup`;

    let config = await GM.getValue('config', DEFAULTS);

    GM_registerMenuCommand('Configure Gestures', () => {
        const currentConfig = JSON.stringify(config, null, 2);
        const newConfigStr = prompt('Edit Gesture Settings:', currentConfig);
        if (newConfigStr) {
            try {
                const newConfig = JSON.parse(newConfigStr);
                config = { ...DEFAULTS, ...newConfig };
                GM.setValue('config', config);
                alert('Settings saved! Please reload the page for changes to take effect.');
            } catch (e) {
                alert('Error parsing settings. Please ensure it is valid JSON.\n\n' + e);
            }
        }
    });


    // --- Styles, Indicator & Overlays ---
    let globalIndicator = null;
    let indicatorTimeout = null;
    let brightnessOverlay = null;

    function initializeUI() {
        if (document.getElementById('vg-global-indicator')) return;

        GM.addStyle(`
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');
            #vg-global-indicator {
                position: fixed; top: 50%; left: 50%;
                transform: translate(-50%, -50%) scale(0.9);
                padding: 10px 16px; background-color: rgba(30, 30, 30, 0.9);
                color: #fff; font-family: 'Roboto', sans-serif; font-size: 16px;
                border-radius: 20px; z-index: 2147483647;
                display: flex; align-items: center; gap: 8px;
                opacity: 0; pointer-events: none;
                transition: opacity 0.2s ease, transform 0.2s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            #vg-global-indicator.visible {
                opacity: 1; transform: translate(-50%, -50%) scale(1);
            }
            #vg-global-indicator svg { width: 24px; height: 24px; fill: #fff; }

            #vg-brightness-overlay {
                position: fixed; top: 0; left: 0;
                width: 100vw; height: 100vh;
                background-color: black;
                opacity: 0;
                pointer-events: none;
                z-index: 2147483646;
                transition: opacity 0.1s linear;
            }
            /* Styles for the Resume List Modal */
            .vgs-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 999999999; display: flex; align-items: center; justify-content: center; } .vgs-modal-content { background: #282c34; color: #eee; padding: 20px 30px; border-radius: 12px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.4); } .vgs-modal-close { position: absolute; top: 10px; right: 15px; font-size: 28px; font-weight: bold; cursor: pointer; color: #aaa; } .vgs-modal-close:hover { color: #fff; } .vgs-modal-content h2 { margin-top: 0; border-bottom: 1px solid #444; padding-bottom: 10px; } .vgs-resume-list { display: flex; flex-direction: column; gap: 10px; } .vgs-resume-item { display: block; padding: 10px; background: #3a3f4b; border-radius: 8px; text-decoration: none; color: #eee; transition: background 0.2s ease; } .vgs-resume-item:hover { background: #4a4f5b; } .vgs-resume-title { display: block; font-weight: bold; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .vgs-resume-details { font-size: 0.9em; color: #ccc; }
        `);

        globalIndicator = document.createElement('div');
        globalIndicator.id = 'vg-global-indicator';
        document.body.appendChild(globalIndicator);

        brightnessOverlay = document.createElement('div');
        brightnessOverlay.id = 'vg-brightness-overlay';
        document.body.appendChild(brightnessOverlay);
    }

    // --- State Management ---
    let activeGesture = null;
    let lastTap = { time: 0, count: 0 };
    let longPressTimeout = null;
    const processedVideos = new WeakMap();

    // --- UI & Feedback ---
    function showIndicator(html, stayVisible = false) {
        if (!globalIndicator) return;
        globalIndicator.innerHTML = html;
        globalIndicator.classList.add('visible');
        if (indicatorTimeout) clearTimeout(indicatorTimeout);
        if (!stayVisible) {
            indicatorTimeout = setTimeout(() => {
                globalIndicator.classList.remove('visible');
            }, 800);
        }
    }

    function hideIndicator() {
         if (globalIndicator) globalIndicator.classList.remove('visible');
    }

    function triggerHapticFeedback() {
        if (config.ENABLE_HAPTIC_FEEDBACK && navigator.vibrate) {
            navigator.vibrate(config.HAPTIC_FEEDBACK_DURATION_MS);
        }
    }

    // --- Video & Player Discovery ---
    function findVideoAndPlayer(targetElement) {
        let video = null;
        if (document.fullscreenElement) {
            video = document.fullscreenElement.querySelector('video');
        }
        if (!video) video = targetElement.closest('video');
        if (!video) {
            let largestVideo = null;
            let maxArea = 0;
            document.querySelectorAll('video').forEach(v => {
                if (v.paused || v.readyState < 1) return;
                const rect = v.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    const area = rect.width * rect.height;
                    if (area > maxArea) {
                        maxArea = area;
                        largestVideo = v;
                    }
                }
            });
            video = largestVideo;
        }

        if (!video) return null;

        const playerSelectors = '.html5-video-player, .player, .video-js, [data-vjs-player], .jwplayer';
        const playerContainer = video.closest(playerSelectors);

        return {
            video: video,
            container: playerContainer || video.parentElement
        };
    }

    // --- Progress Saving Logic ---
    const throttle = (func, limit) => {
        let inThrottle;
        return function() {
            if (!inThrottle) {
                func.apply(this, arguments);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };

    const createStorageKey = (video) => {
        const pageUrl = window.location.href.split('?')[0].split('#')[0];
        const duration = Math.round(video.duration);
        const videoSrc = (video.currentSrc || video.src || '').split('?')[0].split('#')[0];
        if (videoSrc && !videoSrc.startsWith('blob:')) return `${SCRIPT_PREFIX}src|${pageUrl}|${videoSrc}`;
        let parent = video.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
            if (parent.id) return `${SCRIPT_PREFIX}id|${pageUrl}|${parent.id}|${duration}`;
            parent = parent.parentElement;
        }
        const allVideos = Array.from(document.querySelectorAll('video'));
        const videoIndex = allVideos.indexOf(video);
        if (videoIndex !== -1) return `${SCRIPT_PREFIX}index|${pageUrl}|${videoIndex}|${duration}`;
        return null;
    };

    const saveProgress = async (video) => {
        const key = createStorageKey(video);
        if (!key) return;
        if (video.currentTime > 5 && video.currentTime < video.duration - 10) {
            const title = document.title;
            await GM.setValue(key, {
                progress: video.currentTime,
                duration: video.duration,
                timestamp: Date.now(),
                title: title,
                pageUrl: window.location.href
            });
        }
    };

    const restoreProgress = async (video) => {
        const key = createStorageKey(video);
        if (!key) return;
        const data = await GM.getValue(key);
        if (data && typeof data.progress === 'number' && Math.abs(data.duration - video.duration) < 10) {
            if (data.progress < video.duration - 10) {
                video.currentTime = data.progress;
                // Use the main gesture indicator for the message
                showIndicator(`Restored to ${formatTime(data.progress)}`);
            }
        }
    };

    const deleteProgress = async (video) => {
        const key = createStorageKey(video);
        if (key) {
            await GM.deleteValue(key);
        }
    };


    // --- Event Handlers ---
    function onTouchStart(e) {
        const result = findVideoAndPlayer(e.target);

        if (!result || !result.video || result.video.duration < config.MIN_DURATION_TO_SAVE || e.touches.length > 1) {
            activeGesture = null;
            return;
        }
        
        e.stopPropagation();

        activeGesture = {
            video: result.video,
            container: result.container,
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY,
            isSwipe: false,
            action: 'none',
            finalized: false,
            originalPlaybackRate: result.video.playbackRate,
            initialBrightness: 1 - parseFloat(brightnessOverlay.style.opacity || 0),
            initialVolume: result.video.volume,
        };

        if (Date.now() - lastTap.time < config.DOUBLE_TAP_TIMEOUT_MS) {
            lastTap.count++;
        } else {
            lastTap.count = 1;
        }
        lastTap.time = Date.now();

        clearTimeout(longPressTimeout);
        if (document.fullscreenElement) {
            longPressTimeout = setTimeout(() => handleLongPress(), config.LONG_PRESS_DURATION_MS);
        }
    }

    function onTouchMove(e) {
        if (!activeGesture || e.touches.length > 1) return;
        
        e.stopPropagation();
        
        const deltaX = e.touches[0].clientX - activeGesture.startX;
        const deltaY = e.touches[0].clientY - activeGesture.startY;

        if (!activeGesture.isSwipe && Math.hypot(deltaX, deltaY) > config.SWIPE_THRESHOLD) {
            clearTimeout(longPressTimeout);
            lastTap.count = 0;
            
            if (activeGesture.action === 'long-press-speed') {
                activeGesture.video.playbackRate = activeGesture.originalPlaybackRate;
                hideIndicator();
            }

            activeGesture.isSwipe = true;
            
            if (document.fullscreenElement) {
                const rect = activeGesture.video.getBoundingClientRect();
                const touchZoneX = (activeGesture.startX - rect.left) / rect.width;
                const isVertical = Math.abs(deltaY) > Math.abs(deltaX);

                if (isVertical) {
                    if (touchZoneX < 0.33) activeGesture.action = 'brightness';
                    else if (touchZoneX > 0.66) activeGesture.action = 'volume';
                    else activeGesture.action = 'fullscreen';
                } else {
                    activeGesture.action = 'seeking';
                }
            }
        }

        if (activeGesture.isSwipe) {
            e.preventDefault();
            switch (activeGesture.action) {
                case 'seeking': handleHorizontalSwipe(deltaX); break;
                case 'volume': handleVerticalSwipe(deltaY, 'volume'); break;
                case 'brightness': handleVerticalSwipe(deltaY, 'brightness'); break;
            }
        }
    }

    function onTouchEnd(e) {
        if (!activeGesture || activeGesture.finalized) return;
        
        clearTimeout(longPressTimeout);
        e.stopPropagation();
        activeGesture.finalized = true;

        if (activeGesture.action === 'long-press-speed') {
            activeGesture.video.playbackRate = activeGesture.originalPlaybackRate;
            hideIndicator();
        } else if (activeGesture.isSwipe) {
            if (activeGesture.action === 'seeking') {
                const deltaX = e.changedTouches[0].clientX - activeGesture.startX;
                const seekTime = deltaX * config.SEEK_SENSITIVITY;
                activeGesture.video.currentTime += seekTime;
                triggerHapticFeedback();
            } else if (activeGesture.action === 'volume' || activeGesture.action === 'brightness') {
                triggerHapticFeedback();
            } else if (activeGesture.action === 'fullscreen') {
                 const deltaY = e.changedTouches[0].clientY - activeGesture.startY;
                 if (Math.abs(deltaY) > config.SWIPE_THRESHOLD) {
                    handleFullscreenToggle();
                 }
            }
        } else {
            if (lastTap.count >= 2) {
                e.preventDefault();
                if (document.fullscreenElement) {
                    handleDoubleTapSeek(activeGesture.video, activeGesture.startX);
                } else {
                    handleFullscreenToggle();
                }
                lastTap = { time: 0, count: 0 };
            }
        }

        activeGesture = null;
    }

    function onContextMenu(e) {
        if (activeGesture) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }

    // --- Gesture Logic ---
    function handleLongPress() {
        if (!activeGesture || activeGesture.isSwipe) return;

        activeGesture.action = 'long-press-speed';
        activeGesture.video.playbackRate = 2.0;
        const speedIcon = `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`;
        showIndicator(`${speedIcon} <span>2.0x Speed</span>`, true);
        triggerHapticFeedback();
    }

    function handleFullscreenToggle() {
        const isFullscreen = document.fullscreenElement;
        const icon = isFullscreen
            ? `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`
            : `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
        showIndicator(icon);
        triggerHapticFeedback();

        if (isFullscreen) {
            document.exitFullscreen();
        } else {
            const { container, video } = activeGesture;
            const fsPromise = container.requestFullscreen();

            if (config.FORCE_LANDSCAPE && video.videoWidth > video.videoHeight) {
                fsPromise.then(() => {
                    if (screen.orientation && typeof screen.orientation.lock === 'function') {
                        screen.orientation.lock('landscape').catch(err => console.warn('Could not lock orientation:', err.message));
                    }
                }).catch(err => console.warn('Fullscreen request failed:', err.message));
            }
        }
    }

    function handleDoubleTapSeek(video, touchStartX) {
        const rect = video.getBoundingClientRect();
        const tapZone = (touchStartX - rect.left) / rect.width;
        const seekIconBack = `<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6l-8.5 6z"/></svg>`;
        const seekIconFwd = `<svg viewBox="0 0 24 24"><path d="M18 6h-2v12h2zM4 6v12l8.5-6L4 6z"/></svg>`;

        if (tapZone < 0.4) {
            video.currentTime -= config.DOUBLE_TAP_SEEK_SECONDS;
            showIndicator(`${seekIconBack} -${config.DOUBLE_TAP_SEEK_SECONDS}s`);
        } else if (tapZone > 0.6) {
            video.currentTime += config.DOUBLE_TAP_SEEK_SECONDS;
            showIndicator(`+${config.DOUBLE_TAP_SEEK_SECONDS}s ${seekIconFwd}`);
        } else {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }
        triggerHapticFeedback();
    }

    function handleHorizontalSwipe(deltaX) {
        if (!activeGesture) return;
        const { video } = activeGesture;
        const seekTime = deltaX * config.SEEK_SENSITIVITY;
        const newTime = video.currentTime + seekTime;
        const icon = seekTime > 0 ? `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>` : `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm-2-6l6.5 4.5V7.5L9 12z"/></svg>`;
        showIndicator(`${icon} ${formatTime(newTime)}`);
    }

    function handleVerticalSwipe(deltaY, type) {
        if (!activeGesture) return;
        
        if (type === 'volume') {
            const { video } = activeGesture;
            const change = -deltaY / config.VOLUME_SENSITIVITY;
            let newVolume = activeGesture.initialVolume + change;
            newVolume = Math.max(0, Math.min(1, newVolume));
            video.volume = newVolume;
            showIndicator(`<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg> ${Math.round(video.volume * 100)}%`);
        } else if (type === 'brightness') {
            const change = -deltaY / config.BRIGHTNESS_SENSITIVITY;
            let newBrightness = activeGesture.initialBrightness + change;
            newBrightness = Math.max(0.1, Math.min(1, newBrightness));
            
            brightnessOverlay.style.opacity = 1 - newBrightness;

            const brightnessIcon = `<svg viewBox="0 0 24 24"><path d="M20 8.69V4h-4.69L12 0 8.69 4H4v4.69L0 12l4 3.31V20h4.69L12 24l3.31-4H20v-4.69L24 12l-4-3.31M12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>`;
            showIndicator(`${brightnessIcon} ${Math.round(newBrightness * 100)}%`);
        }
    }

    function handleFullscreenChange() {
        if (document.fullscreenElement) {
            document.fullscreenElement.appendChild(globalIndicator);
            document.fullscreenElement.appendChild(brightnessOverlay);
        } else {
            document.body.appendChild(globalIndicator);
            document.body.appendChild(brightnessOverlay);
            if (screen.orientation && typeof screen.orientation.unlock === 'function') {
                screen.orientation.unlock();
            }
        }
    }

    // --- Utilities ---
    function formatTime(totalSeconds) {
        const sec = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        const min = Math.floor((totalSeconds / 60) % 60).toString().padStart(2, '0');
        const hr = Math.floor(totalSeconds / 3600);
        return hr > 0 ? `${hr}:${min}:${sec}` : `${min}:${sec}`;
    }

    // --- Progress Saving Menu Command Functions ---
    const showResumeList = async () => {
        const allKeys = (await GM.listValues()).filter(k => k.startsWith(SCRIPT_PREFIX) && k !== LAST_CLEANUP_KEY);
        if (allKeys.length === 0) {
            alert('No saved video progress found.');
            return;
        }

        let allProgress = [];
        for (const key of allKeys) {
            const data = await GM.getValue(key);
            if (data && data.title && data.pageUrl) {
                allProgress.push(data);
            }
        }

        allProgress.sort((a, b) => b.timestamp - a.timestamp);

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'vgs-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="vgs-modal-content">
                <span class="vgs-modal-close">&times;</span>
                <h2>Resume Watching</h2>
                <div class="vgs-resume-list">
                    ${allProgress.map(data => {
                        const url = new URL(data.pageUrl);
                        url.searchParams.set('t', Math.round(data.progress) + 's');
                        const progressTime = formatTime(data.progress);
                        const totalTime = formatTime(data.duration);
                        return `<a href="${url.href}" class="vgs-resume-item">
                                    <span class="vgs-resume-title">${data.title}</span>
                                    <span class="vgs-resume-details">
                                        At ${progressTime} / ${totalTime} on <strong>${url.hostname}</strong>
                                    </span>
                                </a>`;
                    }).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);

        const closeModal = () => document.body.removeChild(modalOverlay);
        modalOverlay.querySelector('.vgs-modal-close').onclick = closeModal;
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) closeModal();
        };
    };

    const runCleanup = async () => {
        if (config.CLEANUP_DAYS <= 0) return;
        const lastCleanup = await GM.getValue(LAST_CLEANUP_KEY, 0);
        const oneDay = 24 * 60 * 60 * 1000;
        if (Date.now() - lastCleanup < oneDay) return;
        const allKeys = (await GM.listValues()).filter(k => k.startsWith(SCRIPT_PREFIX) && k !== LAST_CLEANUP_KEY);
        const cutoffTime = Date.now() - (config.CLEANUP_DAYS * oneDay);
        for (const key of allKeys) {
            const data = await GM.getValue(key);
            if (data && data.timestamp < cutoffTime) {
                await GM.deleteValue(key);
            }
        }
        await GM.setValue(LAST_CLEANUP_KEY, Date.now());
    };

    const exportProgress = async () => { const allKeys = (await GM.listValues()).filter(k => k.startsWith(SCRIPT_PREFIX)); if (allKeys.length === 0) { alert('No progress data found to export.'); return; } const data = {}; for (const key of allKeys) { data[key] = await GM.getValue(key); } const jsonString = JSON.stringify(data, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `video_progress_backup_${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); };
    const importProgress = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json'; input.onchange = async (e) => { const file = e.target.files[0]; if (!file) return; try { const text = await file.text(); const data = JSON.parse(text); let count = 0; for (const key in data) { if (key.startsWith(SCRIPT_PREFIX)) { await GM.setValue(key, data[key]); count++; } } alert(`Successfully imported ${count} entries.`); } catch (err) { alert('Import failed. The file is not a valid JSON.'); } }; input.click(); };
    const clearAllProgress = async () => { if (!confirm('Are you sure you want to delete ALL saved video progress? This cannot be undone.')) return; const allKeys = (await GM.listValues()).filter(k => k.startsWith(SCRIPT_PREFIX)); for (const key of allKeys) { await GM.deleteValue(key); } alert(`Deleted ${allKeys.length} entries.`); };
    

    // --- Initialization ---
    function initialize() {
        initializeUI();

        // Register Menu Commands
        GM.registerMenuCommand('▶️ Resume Watching', showResumeList);
        GM.registerMenuCommand('📤 Export Progress', exportProgress);
        GM.registerMenuCommand('📥 Import Progress', importProgress);
        GM.registerMenuCommand('🗑️ Clear All Progress', clearAllProgress);

        // Set up gesture listeners
        document.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
        document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
        document.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('contextmenu', onContextMenu, { capture: true });
        
        // --- Progress Saving Initialization ---
        runCleanup();

        const initVideoForSaving = (video) => {
            if (processedVideos.has(video) || video.duration < config.MIN_DURATION_TO_SAVE) return;
            processedVideos.set(video, true);
            restoreProgress(video);
            const throttledSave = throttle(() => saveProgress(video), config.SAVE_INTERVAL);
            video.addEventListener('timeupdate', throttledSave);
            video.addEventListener('pause', () => saveProgress(video));
            video.addEventListener('ended', () => deleteProgress(video));
        };

        const handleVideoElement = (video) => {
            if (video.readyState >= 1) initVideoForSaving(video);
            else video.addEventListener('loadedmetadata', () => initVideoForSaving(video), { once: true });
        };

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        if (node.tagName === 'VIDEO') handleVideoElement(node);
                        else node.querySelectorAll('video').forEach(handleVideoElement);
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        document.querySelectorAll('video').forEach(handleVideoElement);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
