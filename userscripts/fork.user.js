// ==UserScript==
// @name         Video Progress Tracker (Stable & Reliable)
// @name:en      Video Progress Tracker (Stable & Reliable)
// @name:zh-CN   视频进度跟踪器 (稳定可靠版)
// @version      6.2.0
// @description  A completely new, stable version built from deep research. Features a robust, multi-layered video identification system to work on modern websites.
// @description:en A completely new, stable version built from deep research. Features a robust, multi-layered video identification system to work on modern websites.
// @description:zh-CN 基于深入研究构建的全新稳定版。具有强大的多层视频识别系统，可在现代网站上可靠工作。
// @author       Your Name (Crafted by Gemini)
// @match        *://*/*
// @icon         https://fonts.gstatic.com/s/i/materialicons/saved_search/v6/white-24dp/1x/gm_saved_search_white_24dp.png
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.deleteValue
// @grant        GM.listValues
// @grant        GM.addStyle
// @grant        GM.registerMenuCommand
// @run-at       document-end
// @license      MIT
// @setting { "key": "minDuration", "label": "Minimum Duration to Save (seconds)", "type": "number", "default": 90 }
// @setting { "key": "saveInterval", "label": "How often to save during playback (ms)", "type": "number", "default": 2000 }
// ==/UserScript==

(async () => {
    'use strict';

    // --- Configuration ---
    const CONFIG = {
        MIN_DURATION_TO_SAVE: await GM.getValue('minDuration', 90),
        SAVE_INTERVAL: await GM.getValue('saveInterval', 2000),
        SCRIPT_PREFIX: 'vpt6_' // Unique prefix for this version's storage keys
    };

    // A WeakMap to ensure we only initialize each video element once.
    const processedVideos = new WeakMap();

    // --- Core Logic (New Architecture) ---

    /**
     * Throttles a function to prevent it from being called too frequently.
     * This is essential for the 'timeupdate' event to avoid performance issues.
     * @param {function} func The function to throttle.
     * @param {number} limit The minimum time between calls in milliseconds.
     * @returns {function} The new throttled function.
     */
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

    /**
     * NEW: Creates a robust, multi-layered unique key for a video.
     * This is the most critical part of the script. It tries several methods
     * to ensure a video can be identified, even if its source URL is temporary.
     * @param {HTMLVideoElement} video - The video element.
     * @returns {string|null} A unique storage key, or null if impossible.
     */
    const createStorageKey = (video) => {
        const pageUrl = window.location.href.split('?')[0].split('#')[0];
        const duration = Math.round(video.duration);

        // Strategy 1: Use the video source URL if it's a real, non-blob URL. This is the most reliable.
        const videoSrc = (video.currentSrc || video.src || '').split('?')[0].split('#')[0];
        if (videoSrc && !videoSrc.startsWith('blob:')) {
            return `${CONFIG.SCRIPT_PREFIX}src|${pageUrl}|${videoSrc}`;
        }

        // Strategy 2: If src fails, find a unique ID on a parent element. Many sites use this for media players.
        let parent = video.parentElement;
        for (let i = 0; i < 5 && parent; i++) { // Check up to 5 levels up the DOM
            if (parent.id) {
                return `${CONFIG.SCRIPT_PREFIX}id|${pageUrl}|${parent.id}|${duration}`;
            }
            parent = parent.parentElement;
        }

        // Strategy 3: As a last resort, use the video's index on the page combined with its duration.
        const allVideos = Array.from(document.querySelectorAll('video'));
        const videoIndex = allVideos.indexOf(video);
        if (videoIndex !== -1) {
            return `${CONFIG.SCRIPT_PREFIX}index|${pageUrl}|${videoIndex}|${duration}`;
        }

        console.warn('[VPT] Could not generate a stable key for video:', video);
        return null; // Unable to create a key
    };

    /**
     * Saves a video's progress directly to storage under its own unique key.
     * @param {HTMLVideoElement} video - The video element.
     */
    const saveProgress = async (video) => {
        const key = createStorageKey(video);
        if (!key) return; // Don't save if we can't identify the video

        // Only save if progress is meaningful (not at the very start or end)
        if (video.currentTime > 5 && video.currentTime < video.duration - 10) {
            await GM.setValue(key, {
                progress: video.currentTime,
                duration: video.duration,
                timestamp: Date.now()
            });
        }
    };

    /**
     * Restores progress for a video by reading its specific key from storage.
     * @param {HTMLVideoElement} video - The video element.
     */
    const restoreProgress = async (video) => {
        const key = createStorageKey(video);
        if (!key) return;

        const data = await GM.getValue(key);

        // Check if data exists and if the saved duration roughly matches the current video's duration.
        if (data && typeof data.progress === 'number' && Math.abs(data.duration - video.duration) < 10) {
            if (data.progress < video.duration - 10) {
                video.currentTime = data.progress;
                const timeStr = new Date(data.progress * 1000).toISOString().substr(11, 8);
                createToast(`Progress restored to ${timeStr}`, video);
            }
        }
    };

    /**
     * Deletes the progress key for a video, typically after it has finished playing.
     * @param {HTMLVideoElement} video
     */
    const deleteProgress = async (video) => {
        const key = createStorageKey(video);
        if (key) {
            await GM.deleteValue(key);
            console.log(`[VPT] Deleted progress for finished video: ${key}`);
        }
    };

    // --- UI, Data Management, and Initialization ---
    const injectStyles = () => {
        GM.addStyle(`
            .vpt-toast {
                position: absolute;
                top: 16px;
                left: 16px;
                z-index: 2147483647;
                background-color: rgba(30, 30, 30, 0.8); /* 80% opacity */
                color: #ffffff;
                padding: 10px 16px;
                border-radius: 12px; /* More rounded corners */
                font-family: 'Roboto', 'Noto', sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.25);
                border: 1px solid rgba(255, 255, 255, 0.1); /* Subtle border for glass effect */

                /* Blur effect */
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);

                /* Animation */
                opacity: 0;
                transform: translateY(-20px);
                transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: none;
            }
            .vpt-toast.show {
                opacity: 1;
                transform: translateY(0);
            }
        `);
    };
    const createToast = (message, video) => { const toast = document.createElement('div'); toast.className = 'vpt-toast'; toast.textContent = message; const container = video.parentElement; if (getComputedStyle(container).position === 'static') container.style.position = 'relative'; container.appendChild(toast); setTimeout(() => toast.classList.add('show'), 50); setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 350); }, 3500); };
    const exportProgress = async () => { const allKeys = (await GM.listValues()).filter(k => k.startsWith(CONFIG.SCRIPT_PREFIX)); if (allKeys.length === 0) { alert('No progress data found to export.'); return; } const data = {}; for (const key of allKeys) { data[key] = await GM.getValue(key); } const jsonString = JSON.stringify(data, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `video_progress_backup_${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); alert(`Exported ${allKeys.length} entries.`); };
    const importProgress = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json'; input.onchange = async (e) => { const file = e.target.files[0]; if (!file) return; try { const text = await file.text(); const data = JSON.parse(text); let count = 0; for (const key in data) { if (key.startsWith(CONFIG.SCRIPT_PREFIX)) { await GM.setValue(key, data[key]); count++; } } alert(`Successfully imported ${count} entries.`); } catch (err) { alert('Import failed. The file is not a valid JSON.'); console.error(err); } }; input.click(); };
    const clearAllProgress = async () => { if (!confirm('Are you sure you want to delete ALL saved video progress for this script? This cannot be undone.')) return; const allKeys = (await GM.listValues()).filter(k => k.startsWith(CONFIG.SCRIPT_PREFIX)); for (const key of allKeys) { await GM.deleteValue(key); } alert(`Deleted ${allKeys.length} entries.`); };
    
    // Updated menu commands with emojis
    GM.registerMenuCommand('📤 Export Progress', exportProgress);
    GM.registerMenuCommand('📥 Import Progress', importProgress);
    GM.registerMenuCommand('🗑️ Clear All Progress', clearAllProgress);

    /**
     * The main handler for each video element.
     * Ensures a video is valid and attaches all necessary event listeners.
     * @param {HTMLVideoElement} video
     */
    const initVideo = (video) => {
        // 1. Check if video has already been processed or is too short.
        if (processedVideos.has(video) || video.duration < CONFIG.MIN_DURATION_TO_SAVE) {
            return;
        }
        processedVideos.set(video, true);
        console.log('[VPT] Initializing video:', video);

        // 2. Restore progress as soon as we can.
        restoreProgress(video);

        // 3. Create a throttled save function for this specific video instance.
        const throttledSave = throttle(() => saveProgress(video), CONFIG.SAVE_INTERVAL);

        // 4. Attach event listeners.
        video.addEventListener('timeupdate', throttledSave);
        video.addEventListener('pause', () => saveProgress(video)); // Save instantly on pause
        video.addEventListener('ended', () => deleteProgress(video)); // Clean up after finishing
    };

    /**
     * A wrapper to handle video elements safely, waiting for metadata if needed.
     * @param {HTMLVideoElement} video
     */
    const handleVideoElement = (video) => {
        // readyState >= 1 means metadata (like duration) is loaded.
        if (video.readyState >= 1) {
            initVideo(video);
        } else {
            // If metadata isn't loaded yet, wait for it.
            video.addEventListener('loadedmetadata', () => initVideo(video), { once: true });
        }
    };

    // --- Script Entry Point ---
    injectStyles();

    // Use a MutationObserver to detect videos added to the page dynamically.
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'VIDEO') {
                        handleVideoElement(node);
                    } else {
                        // Also check for videos inside the new node.
                        node.querySelectorAll('video').forEach(handleVideoElement);
                    }
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Find any videos that already exist on the page when the script loads.
    document.querySelectorAll('video').forEach(handleVideoElement);

})();
