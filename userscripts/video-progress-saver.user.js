// ==UserScript==
// @name         Video Progress Saver (UI-Matched Fork)
// @namespace    https://github.com/itsrody/SuperBrowsing
// @version      8.4.0
// @description  Saves and restores video progress with a UI matched to Video Gestures Pro.
// @author       Your Name (Crafted by Gemini)
// @match        *://*/*
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.deleteValue
// @grant        GM.listValues
// @grant        GM.addStyle
// @grant        GM.registerMenuCommand
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(async () => {
    'use strict';

    // --- Configuration ---
    const CONFIG = {
        MIN_DURATION_TO_SAVE: await GM.getValue('minDuration', 90),
        SAVE_INTERVAL: await GM.getValue('saveInterval', 2000),
        CLEANUP_DAYS: await GM.getValue('cleanupDays', 60),
        SCRIPT_PREFIX: 'vps_fork_', // Unique prefix for this forked version
        LAST_CLEANUP_KEY: 'vps_fork_last_cleanup'
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
    
    const formatTime = (totalSeconds) => {
        const sec = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        const min = Math.floor((totalSeconds / 60) % 60).toString().padStart(2, '0');
        const hr = Math.floor(totalSeconds / 3600);
        return hr > 0 ? `${hr}:${min}:${sec}` : `${min}:${sec}`;
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
            const title = document.title;
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
                const restoreIcon = `<svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 0 1 7-7 7 7 0 0 1 7 7 7 7 0 0 1-7 7v2a9 9 0 0 0 9-9 9 9 0 0 0-9-9zm-1 5v5l4.25 2.52.75-1.23-3.5-2.08V8H12z"/></svg>`;
                showIndicator(`${restoreIcon} Restored to ${formatTime(data.progress)}`, video);
            }
        }
    };

    const deleteProgress = async (video) => {
        const key = createStorageKey(video);
        if (key) {
            await GM.deleteValue(key);
        }
    };

    // --- Features: Cleanup ---

    const runCleanup = async () => {
        if (CONFIG.CLEANUP_DAYS <= 0) return;

        const lastCleanup = await GM.getValue(CONFIG.LAST_CLEANUP_KEY, 0);
        const oneDay = 24 * 60 * 60 * 1000;

        if (Date.now() - lastCleanup < oneDay) return;

        const allKeys = (await GM.listValues()).filter(k => k.startsWith(CONFIG.SCRIPT_PREFIX) && k !== CONFIG.LAST_CLEANUP_KEY);
        const cutoffTime = Date.now() - (CONFIG.CLEANUP_DAYS * oneDay);
        for (const key of allKeys) {
            const data = await GM.getValue(key);
            if (data && data.timestamp < cutoffTime) {
                await GM.deleteValue(key);
            }
        }
        await GM.setValue(CONFIG.LAST_CLEANUP_KEY, Date.now());
    };

    // --- UI, Data Management, and Initialization ---

    const initializeUI = () => {
        GM.addStyle(`
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');
            .vps-indicator {
                position: absolute; 
                top: 16px; 
                right: 16px;
                transform: translateY(-20px) scale(0.95);
                padding: 10px 16px; 
                background-color: rgba(30, 30, 30, 0.9);
                color: #fff; 
                font-family: 'Roboto', sans-serif; 
                font-size: 16px;
                border-radius: 20px; 
                z-index: 2147483647;
                display: flex; 
                align-items: center; 
                gap: 8px;
                opacity: 0; 
                pointer-events: none;
                transition: opacity 0.3s ease, transform 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            .vps-indicator.visible {
                opacity: 1; 
                transform: translateY(0) scale(1);
            }
            .vps-indicator svg { 
                width: 24px; 
                height: 24px; 
                fill: #fff; 
            }
        `);
    };

    const showIndicator = (message, video) => {
        const container = video.parentElement;
        if (!container) return;

        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        const indicator = document.createElement('div');
        indicator.className = 'vps-indicator';
        indicator.innerHTML = message;
        container.appendChild(indicator);

        setTimeout(() => {
            indicator.classList.add('visible');
        }, 50);

        setTimeout(() => {
            indicator.classList.remove('visible');
            setTimeout(() => {
                if (indicator.parentElement) {
                    indicator.parentElement.removeChild(indicator);
                }
            }, 400);
        }, 3000);
    };

    const exportProgress = async () => { const allKeys = (await GM.listValues()).filter(k => k.startsWith(CONFIG.SCRIPT_PREFIX)); if (allKeys.length === 0) { alert('No progress data found to export.'); return; } const data = {}; for (const key of allKeys) { data[key] = await GM.getValue(key); } const jsonString = JSON.stringify(data, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `video_progress_backup_${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); };
    const importProgress = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json'; input.onchange = async (e) => { const file = e.target.files[0]; if (!file) return; try { const text = await file.text(); const data = JSON.parse(text); let count = 0; for (const key in data) { if (key.startsWith(CONFIG.SCRIPT_PREFIX)) { await GM.setValue(key, data[key]); count++; } } alert(`Successfully imported ${count} entries.`); } catch (err) { alert('Import failed. The file is not a valid JSON.'); } }; input.click(); };
    const clearAllProgress = async () => { if (!confirm('Are you sure you want to delete ALL saved video progress? This cannot be undone.')) return; const allKeys = (await GM.listValues()).filter(k => k.startsWith(CONFIG.SCRIPT_PREFIX)); for (const key of allKeys) { await GM.deleteValue(key); } alert(`Deleted ${allKeys.length} entries.`); };
    
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
    initializeUI();
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
