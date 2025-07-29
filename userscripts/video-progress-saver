// ==UserScript==
// @name         Video Progress Saver
// @namespace   https://github.com/itsrody/SuperBrowsing
// @version      1.1
// @description  Automatically saves and restores progress for HTML5 videos on any website. A lightweight, high-performance fork of the h5player feature.
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    const CONFIG = {
        // Minimum video duration in seconds to activate saving.
        MIN_DURATION_TO_SAVE: 180, // 3 minutes
        // How often to save the progress to storage (in milliseconds).
        SAVE_INTERVAL: 2000, // 2 seconds
        // How long after restoring progress the "restored" message is shown.
        TOAST_TIMEOUT: 3000 // 3 seconds
    };

    // Use a WeakMap to track which video elements have already been initialized.
    // This is memory-efficient and prevents re-attaching listeners.
    const processedVideos = new WeakMap();

    // --- Core Functions ---

    /**
     * Creates a unique key for storing video progress.
     * The key is based on the page URL and the video's total duration.
     * @param {number} duration - The total duration of the video in seconds.
     * @returns {string} A unique storage key.
     */
    const createStorageKey = (duration) => `h5p_progress_${window.location.href}_${duration}`;

    /**
     * Saves the video's current time to storage.
     * @param {string} key - The unique storage key for the video.
     * @param {number} currentTime - The current playback time in seconds.
     * @param {number} duration - The total duration of the video.
     */
    const saveProgress = async (key, currentTime, duration) => {
        if (currentTime > 5 && currentTime < duration - 10) { // Don't save at the very beginning or end
            const data = {
                progress: currentTime,
                duration: duration,
                timestamp: Date.now()
            };
            await GM_setValue(key, data);
        }
    };

    /**
     * Restores video progress from storage.
     * @param {HTMLVideoElement} video - The video element to restore progress for.
     */
    const restoreProgress = async (video) => {
        const key = createStorageKey(video.duration);
        const data = await GM_getValue(key);

        if (data && typeof data.progress === 'number' && data.progress < video.duration - 10) {
            // Only restore if the saved progress is significant and not at the end.
            video.currentTime = data.progress;
            createToast(`Restored progress to ${new Date(data.progress * 1000).toISOString().substr(11, 8)}`, video);
        }
    };

    /**
     * Throttles a function so it only runs once every `delay` milliseconds.
     * @param {function} func - The function to throttle.
     * @param {number} delay - The throttle delay in milliseconds.
     * @returns {function} The throttled function.
     */
    const throttle = (func, delay) => {
        let inProgress = false;
        return (...args) => {
            if (inProgress) {
                return;
            }
            inProgress = true;
            setTimeout(() => {
                func(...args);
                inProgress = false;
            }, delay);
        };
    };

    /**
     * Initializes a single video element by attaching event listeners for saving and restoring progress.
     * @param {HTMLVideoElement} video - The video element to handle.
     */
    const handleVideo = (video) => {
        if (processedVideos.has(video) || video.duration < CONFIG.MIN_DURATION_TO_SAVE) {
            return;
        }

        // 1. Restore progress once the video's metadata is loaded.
        video.addEventListener('loadeddata', () => restoreProgress(video), { once: true });

        // 2. Save progress periodically during playback (throttled).
        const throttledSave = throttle(() => {
            const key = createStorageKey(video.duration);
            saveProgress(key, video.currentTime, video.duration);
        }, CONFIG.SAVE_INTERVAL);

        video.addEventListener('timeupdate', throttledSave);

        // 3. Mark the video as processed.
        processedVideos.set(video, true);
        console.log('H5 Video Progress Saver is now tracking:', video);
    };

    // --- UI Functions ---

    /**
     * Creates a simple toast notification to show when progress is restored.
     * @param {string} message - The message to display.
     * @param {HTMLVideoElement} video - The video element to position the toast relative to.
     */
    const createToast = (message, video) => {
        const toast = document.createElement('div');
        toast.className = 'h5p-progress-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        // Position the toast at the top-left corner of the video
        const rect = video.getBoundingClientRect();
        toast.style.top = `${rect.top + window.scrollY + 10}px`;
        toast.style.left = `${rect.left + window.scrollX + 10}px`;

        setTimeout(() => toast.remove(), CONFIG.TOAST_TIMEOUT);
    };

    // --- Initialization ---

    // Inject the CSS for the toast notification.
    GM_addStyle(`
        .h5p-progress-toast {
            position: absolute;
            z-index: 99999999;
            background-color: rgba(0, 0, 0, 0.5);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-family: sans-serif;
            font-size: 12px;
            transition: opacity 0.5s;
        }
    `);

    // Use a MutationObserver to efficiently detect new videos added to the page.
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

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Also run on any videos that already exist on the page when the script loads.
    document.querySelectorAll('video').forEach(handleVideo);

})();
