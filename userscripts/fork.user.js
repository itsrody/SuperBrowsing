// ==UserScript==
// @name         Synced Smart Video Progress Tracker
// @name:en      Synced Smart Video Progress Tracker
// @name:zh-CN   同步型智能视频进度跟踪器
// @version      2.0.0
// @description  Saves all video progress into a single JSON object, which syncs across devices via ScriptCat's sync API every 2.5 minutes.
// @description:en Saves all video progress into a single JSON object, which syncs across devices via ScriptCat's sync API every 2.5 minutes.
// @description:zh-CN 将所有视频进度保存到单个JSON对象中，通过ScriptCat的同步功能每2.5分钟跨设备同步一次。
// @author       Your Name (Crafted by Gemini)
// @match        *://*/*
// @icon         https://fonts.gstatic.com/s/i/materialicons/sync/v6/white-24dp/1x/gm_sync_white_24dp.png
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

    const DATABASE_KEY = 'svpt_database';
    const SYNC_INTERVAL = 150 * 1000; // 2.5 minutes

    let progressDatabase = {};
    let isDatabaseDirty = false; // A flag to check if the database has new data to save

    // --- Database & Syncing Logic ---

    /**
     * Loads the entire progress database from storage into memory.
     */
    const loadDatabase = async () => {
        progressDatabase = await GM.getValue(DATABASE_KEY, {});
        console.log('[SVPT] Progress database loaded.');
    };

    /**
     * Saves the in-memory database to storage if it has changed.
     * This function is called periodically to sync data.
     */
    const syncDatabaseToStorage = async () => {
        if (!isDatabaseDirty) {
            // console.log('[SVPT] No changes to sync.');
            return;
        }
        await GM.setValue(DATABASE_KEY, progressDatabase);
        isDatabaseDirty = false;
        console.log(`[SVPT] Database synced to storage at ${new Date().toLocaleTimeString()}`);
    };


    // --- Core Video Logic ---

    /**
     * Creates a robust, unique key for storing video progress.
     * @param {HTMLVideoElement} video - The video element.
     * @returns {string} A unique storage key.
     */
    const createStorageKey = (video) => {
        const url = window.location.href.split('?')[0];
        const duration = Math.round(video.duration);
        // Using '|' as a separator for clarity
        return `video|${url}|${duration}`;
    };

    /**
     * Saves the video's current time to the in-memory database.
     * @param {HTMLVideoElement} video - The video element.
     */
    const saveProgress = (video) => {
        // Don't save if progress is too close to the start or end
        if (video.currentTime < 5 || video.currentTime > video.duration - 10) {
            return;
        }

        const key = createStorageKey(video);
        const data = {
            progress: video.currentTime,
            timestamp: Date.now()
        };

        // Update the database in memory and mark it as "dirty" for the next sync
        progressDatabase[key] = data;
        isDatabaseDirty = true;
    };

    /**
     * Restores video progress from the in-memory database.
     * @param {HTMLVideoElement} video - The video element to restore progress for.
     */
    const restoreProgress = (video) => {
        if (isNaN(video.duration) || video.duration <= 0) return;

        const key = createStorageKey(video);
        const data = progressDatabase[key];

        if (data && typeof data.progress === 'number' && data.progress < video.duration - 10) {
            video.currentTime = data.progress;
            const timeStr = new Date(data.progress * 1000).toISOString().substr(11, 8);
            createToast(`Progress restored to ${timeStr}`, video);
        }
    };


    // --- UI & Styling (Unchanged) ---

    const injectStyles = () => {
        GM.addStyle(`
            .svpt-toast-container {
                position: absolute;
                top: 16px; left: 16px;
                z-index: 2147483647;
                background-color: #323232;
                color: #ffffff;
                padding: 10px 16px;
                border-radius: 8px;
                font-family: 'Roboto', 'Noto', sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.25);
                opacity: 0;
                transform: translateY(-20px);
                transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: none;
            }
            .svpt-toast-container.show { opacity: 1; transform: translateY(0); }
        `);
    };

    const createToast = (message, video) => {
        const toast = document.createElement('div');
        toast.className = 'svpt-toast-container';
        toast.textContent = message;
        const container = video.parentElement;
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 50);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 350);
        }, 3500);
    };


    // --- Data Management (Updated for Database model) ---

    const exportProgress = () => {
        if (Object.keys(progressDatabase).length === 0) {
            alert('No video progress data found to export.');
            return;
        }

        const jsonString = JSON.stringify(progressDatabase, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `video_progress_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Progress data exported successfully!');
    };

    const importProgress = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const dataToImport = JSON.parse(text);
                // Overwrite the in-memory database and save it immediately
                progressDatabase = dataToImport;
                await GM.setValue(DATABASE_KEY, progressDatabase);
                isDatabaseDirty = false; // It's now clean
                alert(`Successfully imported ${Object.keys(dataToImport).length} video progress entries. Data has been synced.`);
            } catch (err) {
                alert('Import failed. The file is not a valid JSON or is corrupted.');
                console.error('Import error:', err);
            }
        };
        input.click();
    };

    const clearAllProgress = async () => {
        if (!confirm('Are you sure you want to delete ALL saved video progress? This action cannot be undone.')) {
            return;
        }
        progressDatabase = {};
        await GM.deleteValue(DATABASE_KEY);
        isDatabaseDirty = false;
        alert(`All saved progress has been deleted.`);
    };


    // --- Initialization and Event Handling ---

    const processedVideos = new WeakMap();
    const initVideo = (video) => {
        if (processedVideos.has(video)) return;
        processedVideos.set(video, true);

        let saveInterval;
        video.addEventListener('loadedmetadata', () => restoreProgress(video), { once: true });
        video.addEventListener('play', () => {
            clearInterval(saveInterval);
            saveInterval = setInterval(() => saveProgress(video), 2000);
        });
        video.addEventListener('pause', () => {
            clearInterval(saveInterval);
            saveProgress(video); // Save instantly on pause
        });
        video.addEventListener('ended', () => clearInterval(saveInterval));
    };

    // 1. Load the database from storage on script start
    await loadDatabase();

    // 2. Start the periodic sync to storage
    setInterval(syncDatabaseToStorage, SYNC_INTERVAL);

    // 3. Register menu commands
    GM.registerMenuCommand('Export Progress (JSON)', exportProgress);
    GM.registerMenuCommand('Import Progress (JSON)', importProgress);
    GM.registerMenuCommand('⚠️ Clear All Progress', clearAllProgress);

    // 4. Inject styles and set up observers
    injectStyles();
    document.querySelectorAll('video').forEach(video => {
        if (video.readyState >= 1) initVideo(video);
        else video.addEventListener('loadedmetadata', () => initVideo(video), { once: true });
    });
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                if (node.tagName === 'VIDEO') initVideo(node);
                else node.querySelectorAll('video').forEach(initVideo);
            }
        }));
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();

