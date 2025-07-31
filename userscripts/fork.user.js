// ==UserScript==
// @name         Video Progress Tracker (Stable & Reliable)
// @name:en      Video Progress Tracker (Stable & Reliable)
// @name:zh-CN   视频进度跟踪器 (稳定可靠版)
// @version      4.0.0
// @description  A completely new, stable version based on proven logic. Saves each video's progress individually for reliable cross-device syncing.
// @description:en A completely new, stable version based on proven logic. Saves each video's progress individually for reliable cross-device syncing.
// @description:zh-CN 全新稳定版，基于成熟逻辑。独立保存每个视频的进度，实现可靠的跨设备同步。
// @author       Your Name (Crafted by Gemini)
// @match        *://*/*
// @icon         https://fonts.gstatic.com/s/i/materialicons/save/v6/white-24dp/1x/gm_save_white_24dp.png
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
        SCRIPT_PREFIX: 'vpt4_' // Unique prefix for this version's storage keys
    };

    // --- Core Logic (Simple & Direct) ---

    /**
     * Throttles a function to prevent it from being called too frequently.
     * @param {function} func The function to throttle.
     * @param {number} limit The minimum time between calls in milliseconds.
     * @returns {function} The new throttled function.
     */
    const throttle = (func, limit) => {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };

    /**
     * Creates a unique key for storing a video's progress.
     * Based on the page URL (without queries) and the video's source URL.
     * @param {HTMLVideoElement} video - The video element.
     * @returns {string|null} A unique storage key.
     */
    const createStorageKey = (video) => {
        const pageUrl = window.location.href.split('?')[0].split('#')[0];
        const videoSrc = (video.currentSrc || video.src).split('?')[0].split('#')[0];
        if (!videoSrc || videoSrc.startsWith('blob:')) return null;
        return `${CONFIG.SCRIPT_PREFIX}${pageUrl}|${videoSrc}`;
    };

    /**
     * Saves a video's progress directly to storage under its own key.
     * @param {HTMLVideoElement} video - The video element.
     */
    const saveProgress = async (video) => {
        const key = createStorageKey(video);
        if (!key) return;

        // Only save if progress is meaningful
        if (video.currentTime > 5 && video.currentTime < video.duration - 10) {
            const data = {
                progress: video.currentTime,
                duration: video.duration,
                timestamp: Date.now()
            };
            await GM.setValue(key, data);
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

        if (data && typeof data.progress === 'number' && Math.abs(data.duration - video.duration) < 5) {
            if (data.progress < video.duration - 10) {
                video.currentTime = data.progress;
                const timeStr = new Date(data.progress * 1000).toISOString().substr(11, 8);
                createToast(`Progress restored to ${timeStr}`, video);
            }
        }
    };

    // --- UI & Styling ---
    const injectStyles = () => { GM.addStyle(` .vpt-toast { position: absolute; top: 16px; left: 16px; z-index: 2147483647; background-color: #323232; color: #ffffff; padding: 10px 16px; border-radius: 8px; font-family: 'Roboto', 'Noto', sans-serif; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.25); opacity: 0; transform: translateY(-20px); transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; } .vpt-toast.show { opacity: 1; transform: translateY(0); } `); };
    const createToast = (message, video) => { const toast = document.createElement('div'); toast.className = 'vpt-toast'; toast.textContent = message; const container = video.parentElement; if (getComputedStyle(container).position === 'static') container.style.position = 'relative'; container.appendChild(toast); setTimeout(() => toast.classList.add('show'), 50); setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 350); }, 3500); };

    // --- Data Management ---
    const exportProgress = async () => { const allKeys = (await GM.listValues()).filter(k => k.startsWith(CONFIG.SCRIPT_PREFIX)); if (allKeys.length === 0) { alert('No progress data found to export.'); return; } const data = {}; for (const key of allKeys) { data[key] = await GM.getValue(key); } const jsonString = JSON.stringify(data, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `video_progress_backup_${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); alert(`Exported ${allKeys.length} entries.`); };
    const importProgress = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json'; input.onchange = async (e) => { const file = e.target.files[0]; if (!file) return; try { const text = await file.text(); const data = JSON.parse(text); let count = 0; for (const key in data) { if (key.startsWith(CONFIG.SCRIPT_PREFIX)) { await GM.setValue(key, data[key]); count++; } } alert(`Successfully imported ${count} entries.`); } catch (err) { alert('Import failed. The file is not a valid JSON.'); console.error(err); } }; input.click(); };
    const clearAllProgress = async () => { if (!confirm('Are you sure you want to delete ALL saved video progress for this script? This cannot be undone.')) return; const allKeys = (await GM.listValues()).filter(k => k.startsWith(CONFIG.SCRIPT_PREFIX)); for (const key of allKeys) { await GM.deleteValue(key); } alert(`Deleted ${allKeys.length} entries.`); };
    GM.registerMenuCommand('Export Progress', exportProgress);
    GM.registerMenuCommand('Import Progress', importProgress);
    GM.registerMenuCommand('⚠️ Clear All Progress', clearAllProgress);

    // --- Initialization ---
    const processedVideos = new WeakMap();
    const initVideo = (video) => {
        if (processedVideos.has(video) || video.duration < CONFIG.MIN_DURATION_TO_SAVE) {
            return;
        }
        processedVideos.set(video, true);

        // Restore progress once metadata is ready
        restoreProgress(video);

        // Save progress every X seconds while playing
        const throttledSave = throttle(() => saveProgress(video), CONFIG.SAVE_INTERVAL);
        video.addEventListener('timeupdate', throttledSave);

        // Also save instantly on pause
        video.addEventListener('pause', () => saveProgress(video));
    };

    // Inject styles and find all videos on the page
    injectStyles();
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                    const videos = (node.tagName === 'VIDEO') ? [node] : node.querySelectorAll('video');
                    videos.forEach(v => {
                        if (v.readyState >= 1) initVideo(v);
                        else v.addEventListener('loadedmetadata', () => initVideo(v), { once: true });
                    });
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.querySelectorAll('video').forEach(video => {
        if (video.readyState >= 1) initVideo(video);
        else video.addEventListener('loadedmetadata', () => initVideo(video), { once: true });
    });

})();

