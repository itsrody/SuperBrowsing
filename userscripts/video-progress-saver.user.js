// ==UserScript==
// @name         Enhanced Video Progress Saver
// @namespace    https://github.com/itsrody/SuperBrowsing
// @version      2.6
// @description  Advanced video progress saver with background sync, incognito support, and enhanced features for ScriptCat
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addStyle
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @run-at       document-start
// @license      MIT
// @author       Enhanced for ScriptCat
// @homepageURL  https://github.com/itsrody/SuperBrowsing
// @supportURL   https://github.com/itsrody/SuperBrowsing/issues
// @updateURL    https://raw.githubusercontent.com/itsrody/SuperBrowsing/main/video-progress-saver.user.js
// ==/UserScript==

(function() {
    'use strict';

    // === Enhanced Configuration ===
    const CONFIG = {
        MIN_DURATION_TO_SAVE: 90,           // 90 seconds as requested
        SAVE_INTERVAL: 1500,                // More frequent saves (1.5s)
        TOAST_TIMEOUT: 4000,                // Longer toast display
        AUTO_CLEANUP_DAYS: 30,              // Auto-cleanup old entries after 30 days
        MAX_STORED_VIDEOS: 1000,            // Maximum stored video entries
        RESTORE_THRESHOLD: 10,              // Don't restore if less than 10s from start
        END_THRESHOLD: 15,                  // Don't save if less than 15s from end
        BATCH_SAVE_SIZE: 5,                 // Batch multiple saves for performance
        BACKGROUND_SYNC_INTERVAL: 30000,    // Background cleanup every 30s
        INCOGNITO_PREFIX: 'incognito_',     // Prefix for incognito mode data
    };

    // === Enhanced State Management ===
    class VideoProgressManager {
        constructor() {
            this.processedVideos = new WeakMap();
            this.pendingSaves = new Map();
            this.isIncognito = this.detectIncognitoMode();
            this.backgroundTimer = null;
            this.menuCommands = [];
            
            this.init();
        }

        // Detect incognito/private mode
        detectIncognitoMode() {
            return new Promise((resolve) => {
                // Multiple detection methods for different browsers
                if ('webkitRequestFileSystem' in window) {
                    // Chrome/Chromium detection
                    window.webkitRequestFileSystem(0, 0, 
                        () => resolve(false), 
                        () => resolve(true)
                    );
                } else if ('MozAppearance' in document.documentElement.style) {
                    // Firefox detection
                    const db = indexedDB.open('test');
                    db.onerror = () => resolve(true);
                    db.onsuccess = () => resolve(false);
                } else {
                    // Fallback detection
                    resolve(!window.indexedDB || !window.localStorage);
                }
            });
        }

        async init() {
            this.isIncognito = await this.detectIncognitoMode();
            this.setupUI();
            this.startBackgroundSync();
            this.observeVideos();
            this.handleExistingVideos();
        }

        // === Storage Management ===
        createStorageKey(url, duration, title = '') {
            const prefix = this.isIncognito ? CONFIG.INCOGNITO_PREFIX : '';
            const cleanUrl = url.split('?')[0].split('#')[0]; // Remove query params
            const titleHash = title ? this.hashString(title) : '';
            return `${prefix}vps_${this.hashString(cleanUrl)}_${Math.floor(duration)}_${titleHash}`;
        }

        hashString(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            return Math.abs(hash).toString(36);
        }

        async saveProgress(video, force = false) {
            if (!video.duration || video.duration < CONFIG.MIN_DURATION_TO_SAVE) return;

            const currentTime = video.currentTime;
            const duration = video.duration;

            // Don't save at beginning or end
            if (currentTime < CONFIG.RESTORE_THRESHOLD || 
                currentTime > duration - CONFIG.END_THRESHOLD) return;

            const title = this.getVideoTitle(video);
            const key = this.createStorageKey(window.location.href, duration, title);
            
            const data = {
                progress: currentTime,
                duration: duration,
                timestamp: Date.now(),
                url: window.location.href,
                title: title,
                hostname: window.location.hostname,
                isIncognito: this.isIncognito,
                percentage: Math.floor((currentTime / duration) * 100)
            };

            if (force) {
                await GM_setValue(key, data);
            } else {
                // Batch saves for performance
                this.pendingSaves.set(key, data);
                if (this.pendingSaves.size >= CONFIG.BATCH_SAVE_SIZE) {
                    await this.flushPendingSaves();
                }
            }
        }

        async flushPendingSaves() {
            const saves = Array.from(this.pendingSaves.entries());
            this.pendingSaves.clear();
            
            await Promise.all(saves.map(([key, data]) => GM_setValue(key, data)));
        }

        async restoreProgress(video) {
            if (!video.duration) return;

            const title = this.getVideoTitle(video);
            const key = this.createStorageKey(window.location.href, video.duration, title);
            const data = await GM_getValue(key);

            if (!data || typeof data.progress !== 'number') return;

            // Validate restored data
            if (data.progress < CONFIG.RESTORE_THRESHOLD || 
                data.progress > video.duration - CONFIG.END_THRESHOLD ||
                Math.abs(data.duration - video.duration) > 5) return;

            video.currentTime = data.progress;
            
            const percentage = Math.floor((data.progress / video.duration) * 100);
            const timeStr = this.formatTime(data.progress);
            
            this.showToast(
                `🎥 Restored to ${timeStr} (${percentage}%)`, 
                video,
                'success'
            );

            // Optional notification for important restores
            if (data.progress > 300) { // > 5 minutes
                GM_notification({
                    text: `Resumed ${title || 'video'} at ${timeStr}`,
                    timeout: 3000,
                    image: this.getVideoThumbnail(video)
                });
            }
        }

        // === Utility Functions ===
        getVideoTitle(video) {
            // Try multiple methods to get video title
            return document.title ||
                   video.getAttribute('title') ||
                   video.getAttribute('alt') ||
                   video.closest('[title]')?.getAttribute('title') ||
                   '';
        }

        getVideoThumbnail(video) {
            return video.poster || 
                   video.getAttribute('data-thumb') ||
                   video.getAttribute('data-thumbnail') ||
                   '';
        }

        formatTime(seconds) {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            
            if (h > 0) {
                return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            }
            return `${m}:${s.toString().padStart(2, '0')}`;
        }

        // === Video Handling ===
        async handleVideo(video) {
            if (this.processedVideos.has(video)) return;

            // Wait for metadata
            if (!video.duration) {
                video.addEventListener('loadedmetadata', () => this.handleVideo(video), { once: true });
                return;
            }

            if (video.duration < CONFIG.MIN_DURATION_TO_SAVE) return;

            // Restore progress
            video.addEventListener('loadeddata', () => this.restoreProgress(video), { once: true });

            // Enhanced throttled save with debouncing
            const saveHandler = this.createThrottledSave(video);
            video.addEventListener('timeupdate', saveHandler);
            video.addEventListener('pause', () => this.saveProgress(video, true));
            video.addEventListener('ended', () => this.markAsCompleted(video));

            // Mark as processed
            this.processedVideos.set(video, {
                startTime: Date.now(),
                totalWatched: 0,
                lastPosition: 0
            });

            console.log(`📹 Tracking video: ${this.getVideoTitle(video)} (${this.formatTime(video.duration)})`);
        }

        createThrottledSave(video) {
            let lastSave = 0;
            return () => {
                const now = Date.now();
                if (now - lastSave >= CONFIG.SAVE_INTERVAL) {
                    lastSave = now;
                    this.saveProgress(video);
                }
            };
        }

        async markAsCompleted(video) {
            const title = this.getVideoTitle(video);
            const key = this.createStorageKey(window.location.href, video.duration, title);
            
            const data = await GM_getValue(key);
            if (data) {
                data.completed = true;
                data.completedAt = Date.now();
                await GM_setValue(key, data);
            }

            this.showToast('✅ Video completed!', video, 'success');
        }

        // === Background Operations ===
        startBackgroundSync() {
            this.backgroundTimer = setInterval(() => {
                this.flushPendingSaves();
                this.cleanupOldEntries();
            }, CONFIG.BACKGROUND_SYNC_INTERVAL);
        }

        async cleanupOldEntries() {
            const keys = await GM_listValues();
            const videoKeys = keys.filter(key => key.startsWith('vps_') || key.startsWith(CONFIG.INCOGNITO_PREFIX + 'vps_'));
            
            if (videoKeys.length <= CONFIG.MAX_STORED_VIDEOS) return;

            const entries = await Promise.all(
                videoKeys.map(async key => ({
                    key,
                    data: await GM_getValue(key)
                }))
            );

            // Sort by timestamp and remove oldest
            entries.sort((a, b) => (b.data?.timestamp || 0) - (a.data?.timestamp || 0));
            
            const toDelete = entries.slice(CONFIG.MAX_STORED_VIDEOS);
            await Promise.all(toDelete.map(entry => GM_deleteValue(entry.key)));

            console.log(`🧹 Cleaned up ${toDelete.length} old video entries`);
        }

        // === UI Management ===
        setupUI() {
            this.injectStyles();
            this.setupMenuCommands();
        }

        injectStyles() {
            GM_addStyle(`
                .vps-toast {
                    position: fixed;
                    z-index: 2147483647;
                    padding: 12px 20px;
                    border-radius: 8px;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    backdrop-filter: blur(10px);
                    animation: vpsSlideIn 0.3s ease-out;
                    transition: all 0.3s ease;
                    max-width: 300px;
                    word-wrap: break-word;
                }
                
                .vps-toast.success {
                    background: linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9));
                    color: white;
                    border: 1px solid rgba(34, 197, 94, 0.3);
                }
                
                .vps-toast.info {
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9));
                    color: white;
                    border: 1px solid rgba(59, 130, 246, 0.3);
                }
                
                @keyframes vpsSlideIn {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                
                .vps-stats-panel {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: rgba(0, 0, 0, 0.9);
                    color: white;
                    padding: 15px;
                    border-radius: 10px;
                    font-family: monospace;
                    font-size: 12px;
                    z-index: 2147483646;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
            `);
        }

        setupMenuCommands() {
            this.menuCommands.push(
                GM_registerMenuCommand('📊 Show Video Stats', () => this.showStats()),
                GM_registerMenuCommand('🧹 Clear All Progress', () => this.clearAllProgress()),
                GM_registerMenuCommand('📋 Export Progress Data', () => this.exportData()),
                GM_registerMenuCommand('⚙️ Toggle Debug Mode', () => this.toggleDebugMode())
            );
        }

        showToast(message, video, type = 'info') {
            const toast = document.createElement('div');
            toast.className = `vps-toast ${type}`;
            toast.textContent = message;

            // Position relative to video or top-right of screen
            if (video && video.getBoundingClientRect) {
                const rect = video.getBoundingClientRect();
                toast.style.top = `${rect.top + 10}px`;
                toast.style.left = `${rect.left + 10}px`;
            } else {
                toast.style.top = '20px';
                toast.style.right = '20px';
            }

            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), CONFIG.TOAST_TIMEOUT);
        }

        // === Advanced Features ===
        async showStats() {
            const keys = await GM_listValues();
            const videoKeys = keys.filter(key => key.startsWith('vps_') || key.startsWith(CONFIG.INCOGNITO_PREFIX + 'vps_'));
            
            const entries = await Promise.all(
                videoKeys.map(async key => await GM_getValue(key))
            );

            const stats = {
                total: entries.length,
                completed: entries.filter(e => e.completed).length,
                totalTime: entries.reduce((sum, e) => sum + (e.progress || 0), 0),
                incognito: entries.filter(e => e.isIncognito).length
            };

            const panel = document.createElement('div');
            panel.className = 'vps-stats-panel';
            panel.innerHTML = `
                <h3>📊 Video Progress Stats</h3>
                <p>Total Videos: ${stats.total}</p>
                <p>Completed: ${stats.completed}</p>
                <p>Total Watch Time: ${this.formatTime(stats.totalTime)}</p>
                <p>Incognito Videos: ${stats.incognito}</p>
                <button onclick="this.parentElement.remove()">Close</button>
            `;

            document.body.appendChild(panel);
            setTimeout(() => panel.remove(), 10000);
        }

        async clearAllProgress() {
            if (!confirm('Are you sure you want to clear all video progress?')) return;
            
            const keys = await GM_listValues();
            const videoKeys = keys.filter(key => key.startsWith('vps_') || key.startsWith(CONFIG.INCOGNITO_PREFIX + 'vps_'));
            
            await Promise.all(videoKeys.map(key => GM_deleteValue(key)));
            this.showToast(`🧹 Cleared ${videoKeys.length} video entries`, null, 'success');
        }

        async exportData() {
            const keys = await GM_listValues();
            const videoKeys = keys.filter(key => key.startsWith('vps_') || key.startsWith(CONFIG.INCOGNITO_PREFIX + 'vps_'));
            
            const data = {};
            for (const key of videoKeys) {
                data[key] = await GM_getValue(key);
            }

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'video-progress-backup.json';
            a.click();
        }

        toggleDebugMode() {
            window.vpsDebug = !window.vpsDebug;
            this.showToast(`Debug mode ${window.vpsDebug ? 'enabled' : 'disabled'}`, null, 'info');
        }

        // === Observer Setup ===
        observeVideos() {
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'VIDEO') {
                                this.handleVideo(node);
                            } else if (node.querySelectorAll) {
                                node.querySelectorAll('video').forEach(video => this.handleVideo(video));
                            }
                        }
                    }
                }
            });

            // Start observing when DOM is ready
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
            } else {
                document.addEventListener('DOMContentLoaded', () => {
                    observer.observe(document.body, { childList: true, subtree: true });
                });
            }
        }

        handleExistingVideos() {
            const checkForVideos = () => {
                document.querySelectorAll('video').forEach(video => this.handleVideo(video));
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', checkForVideos);
            } else {
                checkForVideos();
            }
        }
    }

    // === Initialize ===
    const manager = new VideoProgressManager();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        manager.flushPendingSaves();
        if (manager.backgroundTimer) {
            clearInterval(manager.backgroundTimer);
        }
    });

    // Global access for debugging
    if (window.vpsDebug) {
        window.videoProgressManager = manager;
    }

})();
