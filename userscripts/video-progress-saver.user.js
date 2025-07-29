// ==UserScript==
// @name         Video Progress Saver (Background Version)
// @namespace    https://github.com/itsrody/SuperBrowsing
// @version      2.0
// @description  Automatically saves and restores progress for HTML5 videos using a central background script.
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addStyle
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @grant        GM.script.call
// @background
// ==/UserScript==

// =================================================================================
// THIS SCRIPT HAS TWO PARTS:
// 1. The BACKGROUND SCRIPT runs persistently in the browser. It's the "brain"
//    that stores and manages all video progress data.
// 2. The CONTENT SCRIPT is injected into webpages. It's the "eyes and ears"
//    that finds videos and communicates with the background script.
// ScriptCat handles this separation automatically using the @background directive.
// =================================================================================


// --- 1. BACKGROUND SCRIPT ---

// This code only runs in the background context.
if (typeof window === 'undefined') {
    // --- Configuration ---
    const CONFIG = {
        // How long to keep progress data for a video that hasn't been watched (in days).
        DATA_EXPIRATION_DAYS: 90,
        // Prefix for all storage keys to avoid conflicts.
        STORAGE_PREFIX: 'vps_progress_'
    };

    // --- Core API Functions ---
    // These functions are exposed to be called by the content script.

    // Saves progress for a given video key.
    const saveProgress = async ({ key, currentTime, duration }) => {
        if (!key || !currentTime || !duration) return;
        const data = {
            progress: currentTime,
            duration: duration,
            timestamp: Date.now()
        };
        await GM_setValue(key, data);
    };

    // Retrieves progress for a given video key.
    const getProgress = async ({ key }) => {
        if (!key) return null;
        return await GM_getValue(key);
    };

    // Deletes the progress for a specific video key.
    const deleteProgress = async ({ key }) => {
        if (!key) return;
        await GM_deleteValue(key);
        console.log(`[Background] Deleted progress for key: ${key}`);
    };

    // Deletes all saved video progress.
    const deleteAllProgress = async () => {
        const allKeys = await GM_listValues();
        let deletedCount = 0;
        for (const key of allKeys) {
            if (key.startsWith(CONFIG.STORAGE_PREFIX)) {
                await GM_deleteValue(key);
                deletedCount++;
            }
        }
        GM_notification(`Deleted ${deletedCount} saved video progress entries.`, 'Video Progress Saver');
        console.log(`[Background] Deleted ${deletedCount} entries.`);
    };

    // --- Maintenance Functions ---

    // Periodically cleans up old, expired video progress data.
    const cleanupOldData = async () => {
        console.log('[Background] Running cleanup of old video progress...');
        const allKeys = await GM_listValues();
        const now = Date.now();
        const expirationMs = CONFIG.DATA_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
        let cleanedCount = 0;

        for (const key of allKeys) {
            if (key.startsWith(CONFIG.STORAGE_PREFIX)) {
                const data = await GM_getValue(key);
                if (data && (now - data.timestamp > expirationMs)) {
                    await GM_deleteValue(key);
                    cleanedCount++;
                }
            }
        }
        if (cleanedCount > 0) {
            console.log(`[Background] Cleaned up ${cleanedCount} expired entries.`);
        }
    };

    // --- Initialization ---

    // Expose the API functions to be callable from content scripts.
    GM.script.api('saveProgress', saveProgress);
    GM.script.api('getProgress', getProgress);
    GM.script.api('deleteProgress', deleteProgress);

    // Register menu commands for the user.
    GM_registerMenuCommand('Clear All Saved Progress', deleteAllProgress);

    // Run the cleanup task once when the script starts, and then every day.
    cleanupOldData();
    setInterval(cleanupOldData, 1000 * 60 * 60 * 24); // 24 hours
}


// --- 2. CONTENT SCRIPT ---

// This code only runs on webpages.
if (typeof window !== 'undefined') {
    // --- Configuration ---
    const CONFIG = {
        MIN_DURATION_TO_SAVE: 180, // 3 minutes
        SAVE_INTERVAL: 2000, // 2 seconds
        TOAST_TIMEOUT: 4000, // 4 seconds
        STORAGE_PREFIX: 'vps_progress_' // Must match the background script's prefix
    };

    const processedVideos = new WeakMap();

    // --- Core Functions ---

    /**
     * Creates a highly reliable, unique key for storing video progress.
     * Prefers the video's direct `src` URL. Falls back to a combination of
     * page origin, pathname, and video duration for blob URLs.
     * @param {HTMLVideoElement} video - The video element.
     * @returns {string|null} A unique storage key or null if one cannot be created.
     */
    const createStorageKey = (video) => {
        const duration = Math.round(video.duration);
        let identifier = video.currentSrc || video.src;

        // If the src is a blob, it's not persistent. Use page URL as a fallback.
        if (identifier && identifier.startsWith('blob:')) {
            identifier = `${location.origin}${location.pathname}`;
        }

        if (!identifier) return null;

        // Create a clean key by removing query strings and hashes from URLs.
        const cleanIdentifier = identifier.split('?')[0].split('#')[0];
        return `${CONFIG.STORAGE_PREFIX}${cleanIdentifier}_${duration}`;
    };

    /**
     * Initializes a single video element.
     * @param {HTMLVideoElement} video - The video element to handle.
     */
    const handleVideo = (video) => {
        // Wait for metadata to be loaded to ensure we have a duration.
        video.addEventListener('loadedmetadata', async () => {
            if (processedVideos.has(video) || video.duration < CONFIG.MIN_DURATION_TO_SAVE) {
                return;
            }
            processedVideos.set(video, true);

            const key = createStorageKey(video);
            if (!key) return; // Cannot track this video.

            // 1. Restore Progress
            const data = await GM.script.call('getProgress', { key });
            if (data && typeof data.progress === 'number' && data.progress < video.duration - 10) {
                video.currentTime = data.progress;
                const progressTime = new Date(data.progress * 1000).toISOString().substr(11, 8);
                const totalTime = new Date(data.duration * 1000).toISOString().substr(11, 8);
                createToast(`Restored to ${progressTime} / ${totalTime}`, video);
            }

            // 2. Save Progress periodically
            const throttledSave = throttle(() => {
                GM.script.call('saveProgress', {
                    key,
                    currentTime: video.currentTime,
                    duration: video.duration
                });
            }, CONFIG.SAVE_INTERVAL);

            video.addEventListener('timeupdate', throttledSave);

            // 3. Add a menu command to clear progress for this specific video
            GM_registerMenuCommand('Clear Progress for This Video', () => {
                GM.script.call('deleteProgress', { key });
                createToast('Cleared saved progress for this video.', video);
            });

        }, { once: true });
    };

    // --- UI & Utility Functions ---

    const createToast = (message, video) => {
        const toast = document.createElement('div');
        toast.className = 'vps-progress-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        const rect = video.getBoundingClientRect();
        toast.style.top = `${rect.top + window.scrollY + 10}px`;
        toast.style.left = `${rect.left + window.scrollX + 10}px`;
        setTimeout(() => toast.remove(), CONFIG.TOAST_TIMEOUT);
    };

    const throttle = (func, delay) => {
        let inProgress = false;
        return (...args) => {
            if (inProgress) return;
            inProgress = true;
            setTimeout(() => {
                func(...args);
                inProgress = false;
            }, delay);
        };
    };

    // --- Initialization ---

    GM_addStyle(`
        .vps-progress-toast {
            position: absolute;
            z-index: 2147483647;
            background-color: rgba(30, 30, 30, 0.85);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-family: 'Roboto', sans-serif;
            font-size: 13px;
            transition: opacity 0.5s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
    `);

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'VIDEO') {
                        handleVideo(node);
                    } else {
                        node.querySelectorAll('video').forEach(handleVideo);
                    }
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll('video').forEach(handleVideo);
}
