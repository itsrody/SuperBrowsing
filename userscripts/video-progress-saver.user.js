// ==UserScript==
// @name         Video Progress Saver (Background Version)
// @namespace    https://github.com/itsrody/SuperBrowsing
// @version      2.1
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

if (typeof window === 'undefined') {
    const CONFIG = {
        DATA_EXPIRATION_DAYS: 90,
        STORAGE_PREFIX: 'vps_progress_'
    };

    // --- Core API Functions ---
    const saveProgress = async ({ key, currentTime, duration }) => {
        if (!key || !currentTime || !duration) return;
        // Don't save progress at the very beginning or end of the video
        if (currentTime < 5 || currentTime > duration - 10) return;
        const data = {
            progress: currentTime,
            duration: duration,
            timestamp: Date.now()
        };
        await GM_setValue(key, data);
    };

    const getProgress = async ({ key }) => {
        if (!key) return null;
        return await GM_getValue(key);
    };

    // ** FIX: New function to delete multiple keys at once **
    const deleteMultipleProgress = async ({ keys }) => {
        if (!keys || !Array.isArray(keys)) return;
        for (const key of keys) {
            await GM_deleteValue(key);
        }
        console.log(`[Background] Deleted ${keys.length} progress entries for the page.`);
        GM_notification(`Cleared saved progress for ${keys.length} video(s) on this page.`, 'Video Progress Saver');
    };

    const deleteAllProgress = async () => {
        const allKeys = await GM_listValues();
        let deletedCount = 0;
        for (const key of allKeys) {
            if (key.startsWith(CONFIG.STORAGE_PREFIX)) {
                await GM_deleteValue(key);
                deletedCount++;
            }
        }
        GM_notification(`Deleted all ${deletedCount} saved video progress entries.`, 'Video Progress Saver');
        console.log(`[Background] Deleted all ${deletedCount} entries.`);
    };

    // --- Maintenance Functions ---
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
    GM.script.api('saveProgress', saveProgress);
    GM.script.api('getProgress', getProgress);
    GM.script.api('deleteMultipleProgress', deleteMultipleProgress); // Expose the new function

    GM_registerMenuCommand('Clear All Saved Progress', deleteAllProgress);

    cleanupOldData();
    setInterval(cleanupOldData, 1000 * 60 * 60 * 24); // 24 hours
}


// --- 2. CONTENT SCRIPT ---

if (typeof window !== 'undefined') {
    const CONFIG = {
        MIN_DURATION_TO_SAVE: 180,
        SAVE_INTERVAL: 2000,
        TOAST_TIMEOUT: 4000,
        STORAGE_PREFIX: 'vps_progress_'
    };

    const processedVideos = new WeakMap();

    /**
     * ** FIX: More robust key generation **
     * Creates a highly reliable, unique key for storing video progress.
     * It ensures the video src is an absolute URL before creating the key.
     * @param {HTMLVideoElement} video - The video element.
     * @returns {string|null} A unique storage key or null if one cannot be created.
     */
    const createStorageKey = (video) => {
        const duration = Math.round(video.duration);
        let identifier = video.currentSrc || video.src;

        if (!identifier) {
            console.warn('[VPS] Video has no src attribute.', video);
            return null;
        }

        if (identifier.startsWith('blob:')) {
            identifier = `${location.origin}${location.pathname}`;
        } else {
            try {
                // Resolve relative URLs to absolute ones
                identifier = new URL(identifier, location.href).href;
            } catch (e) {
                console.warn('[VPS] Could not create absolute URL for video src:', identifier, e);
                return null; // Don't proceed with an invalid identifier
            }
        }

        const cleanIdentifier = identifier.split('?')[0].split('#')[0];
        return `${CONFIG.STORAGE_PREFIX}${cleanIdentifier}_${duration}`;
    };

    const handleVideo = (video) => {
        video.addEventListener('loadedmetadata', async () => {
            if (processedVideos.has(video) || video.duration < CONFIG.MIN_DURATION_TO_SAVE) {
                return;
            }
            processedVideos.set(video, true);

            const key = createStorageKey(video);
            if (!key) {
                 console.warn('[VPS] Could not generate a valid key for video:', video);
                 return;
            }
            console.log(`[VPS] Tracking video with key: ${key}`);

            // 1. Restore Progress
            const data = await GM.script.call('getProgress', { key });
            if (data && typeof data.progress === 'number' && data.progress < video.duration - 10) {
                video.currentTime = data.progress;
                const progressTime = new Date(data.progress * 1000).toISOString().substr(11, 8);
                const totalTime = new Date(data.duration * 1000).toISOString().substr(11, 8);
                createToast(`Restored to ${progressTime} / ${totalTime}`, video);
                 console.log(`[VPS] Restored progress for ${key} to ${data.progress}`);
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
    const initialize = () => {
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

        // ** FIX: New, reliable menu command **
        GM_registerMenuCommand('Clear Progress on This Page', () => {
            const keysToDelete = [];
            document.querySelectorAll('video').forEach(video => {
                if (video.duration >= CONFIG.MIN_DURATION_TO_SAVE) {
                    const key = createStorageKey(video);
                    if (key) {
                        keysToDelete.push(key);
                    }
                }
            });
            if (keysToDelete.length > 0) {
                GM.script.call('deleteMultipleProgress', { keys: keysToDelete });
            } else {
                alert('No tracked videos found on this page.');
            }
        });

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
        console.log('[VPS] Video Progress Saver is active.');
    };

    // ** FIX: Wait for the body to be ready before initializing **
    if (document.body) {
        initialize();
    } else {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    }
}
