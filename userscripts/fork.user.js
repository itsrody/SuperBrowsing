// ==UserScript==
// @name         Video Progress Tracker Pro
// @name:en      Video Progress Tracker Pro
// @name:zh-CN   专业视频进度跟踪器
// @version      8.1.0
// @description  Adds a cross-device "Resume Watching" list and automatically cleans up old, stale progress entries.
// @description:en Adds a cross-device "Resume Watching" list and automatically cleans up old, stale progress entries.
// @description:zh-CN 添加跨设备的“继续观看”列表，并自动清理旧的、过时的进度条目。
// @author       Your Name (Crafted by Gemini)
// @match        *://*/*
// @icon         https://fonts.gstatic.com/s/i/materialicons/playlist_play/v6/white-24dp/1x/gm_playlist_play_white_24dp.png
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
// @setting { "key": "cleanupDays", "label": "Auto-delete progress older than (days, 0=disable)", "type": "number", "default": 60 }
// ==/UserScript==

(async () => {
    'use strict';

    // --- Configuration ---
    const CONFIG = {
        MIN_DURATION_TO_SAVE: await GM.getValue('minDuration', 90),
        SAVE_INTERVAL: await GM.getValue('saveInterval', 2000),
        CLEANUP_DAYS: await GM.getValue('cleanupDays', 60),
        SCRIPT_PREFIX: 'vpt8_', // Unique prefix for this major version
        LAST_CLEANUP_KEY: 'vpt8_last_cleanup'
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

    const saveProgress = async (video) => {
        const key = createStorageKey(video);
        if (!key) return;
        if (video.currentTime > 5 && video.currentTime < video.duration - 10) {
            const title = document.title.replace(/ - YouTube$/, '').replace(/ - Twitch$/, '');
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
                createToast(`Progress restored to ${new Date(data.progress * 1000).toISOString().substr(11, 8)}`, video);
            }
        }
    };

    const deleteProgress = async (video) => {
        const key = createStorageKey(video);
        if (key) {
            await GM.deleteValue(key);
            console.log(`[VPT] Deleted progress for video: ${key}`);
        }
    };

    // --- Features: Resume List & Cleanup ---

    const showResumeList = async () => {
        const allKeys = (await GM.listValues()).filter(k => k.startsWith(CONFIG.SCRIPT_PREFIX) && k !== CONFIG.LAST_CLEANUP_KEY);
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
        modalOverlay.className = 'vpt-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="vpt-modal-content">
                <span class="vpt-modal-close">&times;</span>
                <h2>Resume Watching</h2>
                <div class="vpt-resume-list">
                    ${allProgress.map(data => {
                        const url = new URL(data.pageUrl);
                        url.searchParams.set('t', Math.round(data.progress) + 's');
                        const progressTime = new Date(data.progress * 1000).toISOString().substr(11, 8);
                        const totalTime = new Date(data.duration * 1000).toISOString().substr(11, 8);
                        return `<a href="${url.href}" class="vpt-resume-item">
                                    <span class="vpt-resume-title">${data.title}</span>
                                    <span class="vpt-resume-details">
                                        At ${progressTime} / ${totalTime} on <strong>${url.hostname}</strong>
                                    </span>
                                </a>`;
                    }).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);

        const closeModal = () => document.body.removeChild(modalOverlay);
        modalOverlay.querySelector('.vpt-modal-close').onclick = closeModal;
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) closeModal();
        };
    };

    const runCleanup = async () => {
        if (CONFIG.CLEANUP_DAYS <= 0) return;

        const lastCleanup = await GM.getValue(CONFIG.LAST_CLEANUP_KEY, 0);
        const oneDay = 24 * 60 * 60 * 1000;

        if (Date.now() - lastCleanup < oneDay) return;

        console.log('[VPT] Running stale progress cleanup...');
        const allKeys = (await GM.listValues()).filter(k => k.startsWith(CONFIG.SCRIPT_PREFIX) && k !== CONFIG.LAST_CLEANUP_KEY);
        const cutoffTime = Date.now() - (CONFIG.CLEANUP_DAYS * oneDay);
        let deletedCount = 0;

        for (const key of allKeys) {
            const data = await GM.getValue(key);
            if (data && data.timestamp < cutoffTime) {
                await GM.deleteValue(key);
                deletedCount++;
            }
        }

        if (deletedCount > 0) {
            console.log(`[VPT] Cleaned up ${deletedCount} stale progress entries.`);
        }
        await GM.setValue(CONFIG.LAST_CLEANUP_KEY, Date.now());
    };

    const setCleanupDays = async () => {
        const currentDays = CONFIG.CLEANUP_DAYS;
        const newDaysStr = prompt(`Set auto-delete for progress older than (days).\nEnter 0 to disable cleanup.\n\nCurrent value: ${currentDays} days`, currentDays);

        if (newDaysStr === null) return;

        const newDays = parseInt(newDaysStr, 10);
        if (isNaN(newDays) || newDays < 0) {
            alert('Invalid input. Please enter a non-negative number.');
            return;
        }

        await GM.setValue('cleanupDays', newDays);
        CONFIG.CLEANUP_DAYS = newDays;

        alert(newDays === 0 ? 'Automatic cleanup has been disabled.' : `Progress older than ${newDays} days will now be automatically deleted.`);
    };

    // --- UI, Data Management, and Initialization ---

    const injectStyles = () => {
        GM.addStyle(`
            .vpt-toast {
                position: absolute;
                top: 16px;
                left: 16px;
                z-index: 2147483647;
                background-color: rgba(30, 30, 30, 0.8);
                color: #ffffff;
                padding: 10px 16px;
                border-radius: 12px;
                font-family: 'Roboto', 'Noto', sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.25);
                border: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                opacity: 0;
                transform: translateY(-20px);
                transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: none;
            }
            .vpt-toast.show {
                opacity: 1;
                transform: translateY(0);
            }
            .vpt-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 999999999; display: flex; align-items: center; justify-content: center; } .vpt-modal-content { background: #282c34; color: #eee; padding: 20px 30px; border-radius: 12px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.4); } .vpt-modal-close { position: absolute; top: 10px; right: 15px; font-size: 28px; font-weight: bold; cursor: pointer; color: #aaa; } .vpt-modal-close:hover { color: #fff; } .vpt-modal-content h2 { margin-top: 0; border-bottom: 1px solid #444; padding-bottom: 10px; } .vpt-resume-list { display: flex; flex-direction: column; gap: 10px; } .vpt-resume-item { display: block; padding: 10px; background: #3a3f4b; border-radius: 8px; text-decoration: none; color: #eee; transition: background 0.2s ease; } .vpt-resume-item:hover { background: #4a4f5b; } .vpt-resume-title { display: block; font-weight: bold; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .vpt-resume-details { font-size: 0.9em; color: #ccc; }
        `);
    };

    const createToast = (message, video) => {
        const toast = document.createElement('div');
        toast.className = 'vpt-toast';
        toast.textContent = message;

        const container = video.parentElement;
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 50);

        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 350);
            }
        }, 5000);
    };

    const exportProgress = async () => { const allKeys = (await GM.listValues()).filter(k => k.startsWith(CONFIG.SCRIPT_PREFIX)); if (allKeys.length === 0) { alert('No progress data found to export.'); return; } const data = {}; for (const key of allKeys) { data[key] = await GM.getValue(key); } const jsonString = JSON.stringify(data, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `video_progress_backup_${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); alert(`Exported ${allKeys.length} entries.`); };
    const importProgress = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json'; input.onchange = async (e) => { const file = e.target.files[0]; if (!file) return; try { const text = await file.text(); const data = JSON.parse(text); let count = 0; for (const key in data) { if (key.startsWith(CONFIG.SCRIPT_PREFIX)) { await GM.setValue(key, data[key]); count++; } } alert(`Successfully imported ${count} entries.`); } catch (err) { alert('Import failed. The file is not a valid JSON.'); console.error(err); } }; input.click(); };
    const clearAllProgress = async () => { if (!confirm('Are you sure you want to delete ALL saved video progress for this script? This cannot be undone.')) return; const allKeys = (await GM.listValues()).filter(k => k.startsWith(CONFIG.SCRIPT_PREFIX)); for (const key of allKeys) { await GM.deleteValue(key); } alert(`Deleted ${allKeys.length} entries.`); };
    
    GM.registerMenuCommand('▶️ Resume Watching', showResumeList);
    GM.registerMenuCommand('⚙️ Set Cleanup Days', setCleanupDays);
    GM.registerMenuCommand('📤 Export Progress', exportProgress);
    GM.registerMenuCommand('📥 Import Progress', importProgress);
    GM.registerMenuCommand('🗑️ Clear All Progress', clearAllProgress);

    const initVideo = (video) => {
        if (processedVideos.has(video) || video.duration < CONFIG.MIN_DURATION_TO_SAVE) return;
        processedVideos.set(video, true);
        restoreProgress(video);
        const throttledSave = throttle(() => saveProgress(video), CONFIG.SAVE_INTERVAL);
        video.addEventListener('timeupdate', throttledSave);
        video.addEventListener('pause', () => saveProgress(video));
        video.addEventListener('ended', () => deleteProgress(video));
    };

    const handleVideoElement = (video) => {
        if (video.readyState >= 1) initVideo(video);
        else video.addEventListener('loadedmetadata', () => initVideo(video), { once: true });
    };

    // --- Script Entry Point ---
    injectStyles();
    runCleanup();

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
