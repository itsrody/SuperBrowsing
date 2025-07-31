// ==UserScript==
// @name         Synced Smart Video Progress Tracker
// @name:en      Synced Smart Video Progress Tracker
// @name:zh-CN   同步型智能视频进度跟踪器
// @version      2.2.0
// @description  Saves video progress and syncs the data file every 30 seconds. Prevents data loss on tab close.
// @description:en Saves video progress and syncs the data file every 30 seconds. Prevents data loss on tab close.
// @description:zh-CN 保存视频进度并每30秒同步一次数据文件。防止关闭标签页时数据丢失。
// @author       Your Name (Crafted by Gemini)
// @match        *://*/*
// @icon         https://fonts.gstatic.com/s/i/materialicons/sync_saved_locally/v6/white-24dp/1x/gm_sync_saved_locally_white_24dp.png
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

    const DATABASE_KEY = 'svpt_database_v2';
    // UPDATED: Sync interval is now 30 seconds.
    const SYNC_INTERVAL = 30 * 1000;

    let progressDatabase = {};
    let isDatabaseDirty = false;

    // --- Database & Syncing Logic ---

    const loadDatabase = async () => {
        progressDatabase = await GM.getValue(DATABASE_KEY, {});
        console.log('[SVPT] Progress database loaded.');
    };

    const syncDatabaseToStorage = async () => {
        if (!isDatabaseDirty) return;
        try {
            await GM.setValue(DATABASE_KEY, progressDatabase);
            isDatabaseDirty = false;
            console.log(`[SVPT] Database synced to storage at ${new Date().toLocaleTimeString()}`);
        } catch (e) {
            console.error('[SVPT] Failed to sync database:', e);
        }
    };

    // --- Core Video Logic ---

    const createStorageKey = (video) => {
        let src = video.currentSrc || video.src;
        if (!src || src.startsWith('blob:')) return null;
        const duration = Math.round(video.duration);
        return `video|${src}|${duration}`;
    };

    const saveProgress = (video) => {
        const key = createStorageKey(video);
        if (!key) return;

        if (video.currentTime > 5 && video.currentTime < video.duration - 10) {
            progressDatabase[key] = {
                progress: video.currentTime,
                timestamp: Date.now()
            };
            isDatabaseDirty = true;
        }
    };

    const restoreProgress = (video) => {
        if (isNaN(video.duration) || video.duration <= 0) return;
        const key = createStorageKey(video);
        if (!key) return;

        const data = progressDatabase[key];
        if (data && typeof data.progress === 'number' && data.progress < video.duration - 10) {
            video.currentTime = data.progress;
            const timeStr = new Date(data.progress * 1000).toISOString().substr(11, 8);
            createToast(`Progress restored to ${timeStr}`, video);
        }
    };

    // --- UI & Styling ---
    const injectStyles = () => {
        GM.addStyle(`
            .svpt-toast-container {
                position: absolute; top: 16px; left: 16px; z-index: 2147483647;
                background-color: #323232; color: #ffffff; padding: 10px 16px;
                border-radius: 8px; font-family: 'Roboto', 'Noto', sans-serif;
                font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.25);
                opacity: 0; transform: translateY(-20px);
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
        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 50);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 350);
        }, 3500);
    };

    // --- Data Management ---
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
                progressDatabase = dataToImport;
                await syncDatabaseToStorage(); // Force immediate sync
                isDatabaseDirty = false;
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

    GM.registerMenuCommand('Export Progress (JSON)', exportProgress);
    GM.registerMenuCommand('Import Progress (JSON)', importProgress);
    GM.registerMenuCommand('⚠️ Clear All Progress', clearAllProgress);

    // --- Main Execution ---
    const main = async () => {
        await loadDatabase();
        setInterval(syncDatabaseToStorage, SYNC_INTERVAL);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                syncDatabaseToStorage();
            }
        });

        const processedVideos = new WeakMap();
        const initVideo = (video) => {
            if (processedVideos.has(video) || video.duration < 60) return;
            processedVideos.set(video, true);

            let saveInterval;
            restoreProgress(video);

            video.addEventListener('play', () => {
                clearInterval(saveInterval);
                saveInterval = setInterval(() => saveProgress(video), 2000);
            });
            video.addEventListener('pause', () => {
                clearInterval(saveInterval);
                saveProgress(video);
            });
            video.addEventListener('ended', () => clearInterval(saveInterval));
        };

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.tagName === 'VIDEO') {
                        node.addEventListener('loadedmetadata', () => initVideo(node), { once: true });
                    } else {
                        node.querySelectorAll('video').forEach(v => v.addEventListener('loadedmetadata', () => initVideo(v), { once: true }));
                    }
                }
            }));
        });
        observer.observe(document.body, { childList: true, subtree: true });

        document.querySelectorAll('video').forEach(video => {
            if (video.readyState >= 1) initVideo(video);
            else video.addEventListener('loadedmetadata', () => initVideo(video), { once: true });
        });
    };

    injectStyles();
    main();

})();

