// ==UserScript==
// @name         Video Tracker with Sync Control
// @name:en      Video Tracker with Sync Control
// @name:zh-CN   带有同步控件的视频跟踪器
// @version      7.0.0
// @description  Adds a UI to each video to monitor save status and manually save, giving you full control over the sync process.
// @description:en Adds a UI to each video to monitor save status and manually save, giving you full control over the sync process.
// @description:zh-CN 为每个视频添加一个UI，以监控保存状态并手动保存，让您完全控制同步过程。
// @author       Your Name (Crafted by Gemini)
// @match        *://*/*
// @icon         https://fonts.gstatic.com/s/i/materialicons/cloud_sync/v6/white-24dp/1x/gm_cloud_sync_white_24dp.png
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
        SCRIPT_PREFIX: 'vpt7_' // Unique prefix for this forked version
    };

    const processedVideos = new WeakMap();

    // --- Core Logic ---

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
        if (videoSrc && !videoSrc.startsWith('blob:')) return `${CONFIG.SCRIPT_PREFIX}src|${pageUrl}|${videoSrc}`;
        let parent = video.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
            if (parent.id) return `${CONFIG.SCRIPT_PREFIX}id|${pageUrl}|${parent.id}|${duration}`;
            parent = parent.parentElement;
        }
        const allVideos = Array.from(document.querySelectorAll('video'));
        const videoIndex = allVideos.indexOf(video);
        if (videoIndex !== -1) return `${CONFIG.SCRIPT_PREFIX}index|${pageUrl}|${videoIndex}|${duration}`;
        return null;
    };

    const saveProgress = async (video, manual = false) => {
        const key = createStorageKey(video);
        if (!key) return;

        if (video.currentTime > 5 && video.currentTime < video.duration - 10) {
            await GM.setValue(key, {
                progress: video.currentTime,
                duration: video.duration,
                timestamp: Date.now()
            });
            // Update UI to show saved status
            updateSyncControlUI(video, 'saved', manual);
        }
    };

    const restoreProgress = async (video) => {
        const key = createStorageKey(video);
        if (!key) return;
        const data = await GM.getValue(key);
        if (data && typeof data.progress === 'number' && Math.abs(data.duration - video.duration) < 10) {
            if (data.progress < video.duration - 10) {
                video.currentTime = data.progress;
                createToast(`Progress restored to ${new Date(data.progress * 1000).toISOString().substr(11, 8)}`, video);
                // After restoring, the status is 'saved'
                updateSyncControlUI(video, 'saved');
            }
        }
    };

    const deleteProgress = async (video) => {
        const key = createStorageKey(video);
        if (key) await GM.deleteValue(key);
    };

    // --- NEW: Sync Control UI ---

    const injectStyles = () => {
        GM.addStyle(`
            /* Main Toast Notification */
            .vpt-toast { position: absolute; top: 16px; left: 16px; z-index: 2147483647; background-color: rgba(30, 30, 30, 0.8); color: #ffffff; padding: 10px 16px; border-radius: 12px; font-family: 'Roboto', 'Noto', sans-serif; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.25); border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); opacity: 0; transform: translateY(-20px); transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; }
            .vpt-toast.show { opacity: 1; transform: translateY(0); }

            /* Sync Control Container */
            .vpt-sync-container { position: absolute; top: 10px; right: 10px; z-index: 2147483646; display: flex; flex-direction: column; align-items: flex-end; }
            .vpt-sync-icon { cursor: pointer; font-size: 24px; text-shadow: 0 1px 3px rgba(0,0,0,0.5); transition: transform 0.2s ease, color 0.3s ease; filter: drop-shadow(0 1px 2px rgba(0,0,0,.5)); }
            .vpt-sync-icon:hover { transform: scale(1.1); }
            .vpt-sync-icon.status-grey { color: #aaa; }
            .vpt-sync-icon.status-yellow { color: #f0c000; }
            .vpt-sync-icon.status-green { color: #00c853; }
            .vpt-sync-icon.status-saving { color: #0091ea; animation: spin 1s linear infinite; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

            /* Sync Control Panel */
            .vpt-sync-panel { background-color: rgba(40, 40, 40, 0.85); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 8px; margin-top: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); display: none; flex-direction: column; gap: 8px; font-family: sans-serif; font-size: 12px; color: #eee; width: 160px; }
            .vpt-sync-container:hover .vpt-sync-panel { display: flex; }
            .vpt-sync-panel p { margin: 0; text-align: center; }
            .vpt-sync-panel button { background-color: #555; color: white; border: none; border-radius: 5px; padding: 6px 8px; cursor: pointer; transition: background-color 0.2s; text-align: center; }
            .vpt-sync-panel button:hover { background-color: #666; }
            .vpt-sync-panel button:active { background-color: #777; }
        `);
    };

    const createSyncControlUI = (video, container) => {
        const syncContainer = document.createElement('div');
        syncContainer.className = 'vpt-sync-container';

        const icon = document.createElement('div');
        icon.className = 'vpt-sync-icon status-grey';
        icon.innerHTML = '☁️'; // Cloud emoji
        icon.title = 'Sync Status';

        const panel = document.createElement('div');
        panel.className = 'vpt-sync-panel';

        const statusText = document.createElement('p');
        statusText.textContent = 'No progress saved.';

        const saveNowBtn = document.createElement('button');
        saveNowBtn.textContent = 'Save Now';
        saveNowBtn.onclick = (e) => {
            e.stopPropagation();
            saveProgress(video, true); // manual save
        };

        const copyLinkBtn = document.createElement('button');
        copyLinkBtn.textContent = 'Copy Resume Link';
        copyLinkBtn.onclick = (e) => {
            e.stopPropagation();
            const url = new URL(window.location.href);
            url.searchParams.set('t', Math.round(video.currentTime) + 's');
            // Use a temporary textarea to copy to clipboard
            const textarea = document.createElement('textarea');
            textarea.value = url.href;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(() => copyLinkBtn.textContent = 'Copy Resume Link', 1500);
        };

        panel.append(statusText, saveNowBtn, copyLinkBtn);
        syncContainer.append(icon, panel);
        container.appendChild(syncContainer);

        // Store references for later updates
        processedVideos.get(video).ui = { icon, statusText, saveNowBtn };
    };

    const updateSyncControlUI = (video, status, manual = false) => {
        const ui = processedVideos.get(video)?.ui;
        if (!ui) return;

        ui.icon.classList.remove('status-grey', 'status-yellow', 'status-green', 'status-saving');
        switch (status) {
            case 'unsaved':
                ui.icon.classList.add('status-yellow');
                ui.statusText.textContent = 'Unsaved changes...';
                break;
            case 'saving':
                ui.icon.classList.add('status-saving');
                ui.statusText.textContent = 'Saving...';
                break;
            case 'saved':
                ui.icon.classList.add('status-green');
                ui.statusText.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
                if (manual) {
                    ui.saveNowBtn.textContent = 'Saved!';
                    setTimeout(() => ui.saveNowBtn.textContent = 'Save Now', 1500);
                }
                break;
            default: // 'grey'
                ui.icon.classList.add('status-grey');
                ui.statusText.textContent = 'No progress saved.';
        }
    };


    // --- Initialization & Data Management ---
    const createToast = (message, video) => { /* ... same as before ... */ };
    const exportProgress = async () => { /* ... same as before ... */ };
    const importProgress = () => { /* ... same as before ... */ };
    const clearAllProgress = async () => { /* ... same as before ... */ };
    GM.registerMenuCommand('📤 Export Progress', exportProgress);
    GM.registerMenuCommand('📥 Import Progress', importProgress);
    GM.registerMenuCommand('🗑️ Clear All Progress', clearAllProgress);


    const initVideo = (video) => {
        if (processedVideos.has(video) || video.duration < CONFIG.MIN_DURATION_TO_SAVE) return;
        
        // Ensure the video container can host our absolute-positioned UI
        const container = video.parentElement;
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        processedVideos.set(video, {}); // Store video first
        createSyncControlUI(video, container); // Then create its UI

        restoreProgress(video);

        const throttledSave = throttle(() => {
            updateSyncControlUI(video, 'saving');
            saveProgress(video);
        }, CONFIG.SAVE_INTERVAL);

        video.addEventListener('timeupdate', () => {
             // Show that there are unsaved changes as the user watches
            const ui = processedVideos.get(video)?.ui;
            if(ui && ui.icon.classList.contains('status-green')) {
                updateSyncControlUI(video, 'unsaved');
            }
            throttledSave();
        });
        video.addEventListener('pause', () => saveProgress(video, true));
        video.addEventListener('ended', () => deleteProgress(video));
    };

    const handleVideoElement = (video) => {
        if (video.readyState >= 1) initVideo(video);
        else video.addEventListener('loadedmetadata', () => initVideo(video), { once: true });
    };

    injectStyles();
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

})();
