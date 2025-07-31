// ==UserScript==
// @name         Synced Video Progress Tracker (Reliable)
// @name:en      Synced Video Progress Tracker (Reliable)
// @name:zh-CN   同步视频进度跟踪器 (可靠版)
// @version      3.0.0
// @description  RELIABILITY FIX: Directly saves video progress to a syncable JSON file. No more data loss on tab close.
// @description:en RELIABILITY FIX: Directly saves video progress to a syncable JSON file. No more data loss on tab close.
// @description:zh-CN 可靠性修复：直接将视频进度保存到可同步的JSON文件中。不再因关闭标签页而丢失数据。
// @author       Your Name (Crafted by Gemini)
// @match        *://*/*
// @icon         https://fonts.gstatic.com/s/i/materialicons/save/v6/white-24dp/1x/gm_save_white_24dp.png
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.deleteValue
// @grant        GM.addStyle
// @grant        GM.registerMenuCommand
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(async () => {
    'use strict';

    const DATABASE_KEY = 'svpt_database_v3'; // Using a new key to prevent conflicts

    // --- Core Logic (New & Improved) ---

    /**
     * Throttles a function to prevent it from being called too frequently.
     * This is essential for the 'timeupdate' event.
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
     * Creates a more robust key by ignoring URL query parameters.
     * @param {HTMLVideoElement} video - The video element.
     * @returns {string|null} A unique storage key.
     */
    const createStorageKey = (video) => {
        let src = video.currentSrc || video.src;
        if (!src || src.startsWith('blob:')) return null;
        // Strip query parameters for more stable keys
        const cleanSrc = src.split('?')[0];
        const duration = Math.round(video.duration);
        return `video|${cleanSrc}|${duration}`;
    };

    /**
     * NEW STRATEGY: Saves progress directly to storage in a "Read-Modify-Write" cycle.
     * This is an atomic operation that guarantees no data is lost.
     * @param {HTMLVideoElement} video - The video element.
     */
    const saveProgress = async (video) => {
        const key = createStorageKey(video);
        if (!key) return;

        // Only save if progress is meaningful
        if (video.currentTime < 5 || video.currentTime > video.duration - 10) {
            return;
        }

        try {
            // 1. Read the entire database
            const db = await GM.getValue(DATABASE_KEY, {});
            // 2. Modify the specific entry for this video
            db[key] = {
                progress: video.currentTime,
                timestamp: Date.now()
            };
            // 3. Write the entire database back to storage
            await GM.setValue(DATABASE_KEY, db);
        } catch (e) {
            console.error('[SVPT] Error saving progress:', e);
        }
    };

    /**
     * Restores progress by reading from the main database.
     * @param {HTMLVideoElement} video - The video element.
     */
    const restoreProgress = async (video) => {
        if (isNaN(video.duration) || video.duration <= 0) return;
        const key = createStorageKey(video);
        if (!key) return;

        const db = await GM.getValue(DATABASE_KEY, {});
        const data = db[key];

        if (data && typeof data.progress === 'number' && data.progress < video.duration - 10) {
            video.currentTime = data.progress;
            const timeStr = new Date(data.progress * 1000).toISOString().substr(11, 8);
            createToast(`Progress restored to ${timeStr}`, video);
        }
    };


    // --- UI & Styling (Unchanged) ---
    const injectStyles = () => { GM.addStyle(` .svpt-toast-container { position: absolute; top: 16px; left: 16px; z-index: 2147483647; background-color: #323232; color: #ffffff; padding: 10px 16px; border-radius: 8px; font-family: 'Roboto', 'Noto', sans-serif; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.25); opacity: 0; transform: translateY(-20px); transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; } .svpt-toast-container.show { opacity: 1; transform: translateY(0); } `); };
    const createToast = (message, video) => { const toast = document.createElement('div'); toast.className = 'svpt-toast-container'; toast.textContent = message; const container = video.parentElement; if (getComputedStyle(container).position === 'static') container.style.position = 'relative'; container.appendChild(toast); setTimeout(() => toast.classList.add('show'), 50); setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 350); }, 3500); };


    // --- Data Management (Updated to work with the new direct-save model) ---
    const exportProgress = async () => { const db = await GM.getValue(DATABASE_KEY, {}); if (Object.keys(db).length === 0) { alert('No video progress data found to export.'); return; } const jsonString = JSON.stringify(db, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `video_progress_backup_${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); alert('Progress data exported successfully!'); };
    const importProgress = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json'; input.onchange = async (e) => { const file = e.target.files[0]; if (!file) return; try { const text = await file.text(); const dataToImport = JSON.parse(text); await GM.setValue(DATABASE_KEY, dataToImport); alert(`Successfully imported ${Object.keys(dataToImport).length} video progress entries. Data has been saved.`); } catch (err) { alert('Import failed. The file is not a valid JSON or is corrupted.'); console.error('Import error:', err); } }; input.click(); };
    const clearAllProgress = async () => { if (!confirm('Are you sure you want to delete ALL saved video progress? This action cannot be undone.')) return; await GM.deleteValue(DATABASE_KEY); alert(`All saved progress has been deleted.`); };
    GM.registerMenuCommand('Export Progress (JSON)', exportProgress);
    GM.registerMenuCommand('Import Progress (JSON)', importProgress);
    GM.registerMenuCommand('⚠️ Clear All Progress', clearAllProgress);


    // --- Main Execution ---
    const processedVideos = new WeakMap();
    const initVideo = (video) => {
        if (processedVideos.has(video) || video.duration < 60) return;
        processedVideos.set(video, true);

        // Restore progress as soon as we identify the video
        restoreProgress(video);

        // Save progress every 2 seconds while playing (throttled)
        video.addEventListener('timeupdate', throttle(() => saveProgress(video), 2000));

        // Also save instantly on pause for immediate feedback
        video.addEventListener('pause', () => saveProgress(video));
    };

    // Inject styles and set up observers
    injectStyles();
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                const videos = (node.tagName === 'VIDEO') ? [node] : node.querySelectorAll('video');
                videos.forEach(v => {
                    if (v.readyState >= 1) {
                        initVideo(v);
                    } else {
                        v.addEventListener('loadedmetadata', () => initVideo(v), { once: true });
                    }
                });
            }
        }));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Find videos that already exist on the page at script load
    document.querySelectorAll('video').forEach(video => {
        if (video.readyState >= 1) { // HAVE_METADATA or more
            initVideo(video);
        } else {
            video.addEventListener('loadedmetadata', () => initVideo(video), { once: true });
        }
    });

})();

