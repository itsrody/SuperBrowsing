// ==UserScript==
// @name         Video Progress Saver
// @namespace    http://tampermonkey.net/
// @version      1.6.6
// @description  Automatically saves and restores HTML5 video playback progress with a custom UI and two-way Firebase sync.
// @author       Gemini & You
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NDAgNjQwIj48IS0tIUZvbnQgQXdlc29tZSBGcmVlIDcuMC4wIGJ5IEBmb250YXdlc29tZSAtIGh0dHBzOi8vZm9udGF3ZXNvbWUuY29tIExpY2Vuc2UgLSBodHRwczovL2ZvbnRhd2Vzb21lLmNvbS9saWNlbnNlL2ZyZWUgQ29weXJpZ2h0IDIwMjUgRm9udGljb25zLCBJbmMuLS0+PHBhdGggZmlsbD0iIzc0QzBGQyIgZD0iTTMyMCAxMjhDNDI2IDEyOCA1MTIgMjE0IDUxMiAzMjBDNTEyIDQyNiA0MjYgNTEyIDMyMCA1MTJDMjU0LjggNTEyIDE5Ny4xIDQ3OS41IDE2Mi4yIDQyOS43QzE1Mi4zIDQxNS4yIDEzMi4zIDQxMS43IDExNy44IDQyMS44QzEwMy4zIDQzMS45IDk5LjggNDUxLjkgMTA5LjkgNDY2LjRDMTU2LjEgNTMyLjYgMjMzIDU3NiAzMjAgNTc2QzQ2MS40IDU3NiA1NzYgNDYxLjQgNTc2IDMyMEM1NzYgMTc4LjYgNDYxLjQgNjQgMzIwIDY0QzIzNC4zIDY0IDE1OC41IDEwNi4xIDExMiAxNzAuN0wxMTIgMTQ4QzExMiAxMjYuMyA5Ny43IDExMiA4MCAxMTJDNjIuMyAxMTIgNDggMTI2LjMgNDggMTQ0TDQ4IDI1NkM0OCAyNzMuNyA2Mi4zIDI4OCA4MCAyODhMMTA0LjYgMjg4QzEwNS4xIDI4OCAxMDUuNiAyODggMTA2LjEgMjg4TDE5Mi4xIDI4OEMyMDkuOCAyODggMjI0LjEgMjczLjcgMjI0LjEgMjU2QzIyNC4xIDIzOC4zIDIwOS44IDIyNCAxOTIuMSAyMjRMMTUzLjggMjI0QzE4Ni45IDE2Ni42IDI0OSAxMjggMzIwIDEyOHpNMzQ0IDIxNkMzNDQgMjAyLjcgMzMzLjMgMTkyIDMyMCAxOTJDMzA2LjcgMTkyIDI5NiAyMDIuNyAyOTYgMjE2TDI5NiAzMjBDMjk2IDMyNi40IDI5OC41IDMzMi41IDMwMyAzMzdMMzc1IDQwOUMzODQuNCA0MTguNCAzOTkuNiA0MTguNCA0MDguOSA0MDlDNDE4LjIgMzk5LjYgNDE4LjMgMzg0LjQgNDA4LjkgMzc1LjFMMzQzLjkgMzEwLjFMMzQzLjkgMjE2eiIvPjwvc3ZnPg==
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      firebasestorage.googleapis.com
// @connect      *.firebaseio.com
// @connect      *.firebasedatabase.app
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const CONFIG = {
        SAVE_INTERVAL_SECONDS: 6,
        MIN_VIDEO_DURATION_SECONDS: 60,
        STORAGE_KEY: 'vps_video_progress',
        FIREBASE_CONFIG_KEY: 'vps_firebase_config',
    };

    // --- STYLES ---
    const UI_STYLES = `
        .vps-restore-toast {
            position: absolute; top: 20px; right: 20px; padding: 10px 15px; border-radius: 12px;
            background: rgba(30, 30, 30, 0.7); backdrop-filter: blur(10px) saturate(180%); -webkit-backdrop-filter: blur(10px) saturate(180%);
            color: #fff; border: 1px solid rgba(255, 255, 255, 0.125); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px;
            z-index: 99999; opacity: 0; transform: translateY(-20px); transition: all 0.5s ease; pointer-events: none;
            display: flex; align-items: center; gap: 10px;
        }
        .vps-restore-toast.vps-show { opacity: 1; transform: translateY(0); }
        .vps-toast-icon { flex-shrink: 0; }

        .vps-dialog-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
            z-index: 100000; display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.3s ease;
        }
        .vps-dialog-overlay.vps-show { opacity: 1; }
        .vps-dialog {
            background: rgba(44, 44, 44, 0.75); backdrop-filter: blur(12px) saturate(150%); -webkit-backdrop-filter: blur(12px) saturate(150%);
            color: #f1f1f1; border-radius: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            box-shadow: 0 10px 40px rgba(0,0,0,0.4); border: 1px solid rgba(255, 255, 255, 0.1);
            width: 90%; max-width: 500px; transform: scale(0.95); transition: transform 0.3s ease; overflow: hidden;
        }
        .vps-dialog-overlay.vps-show .vps-dialog { transform: scale(1); }
        .vps-dialog-header { padding: 16px 24px; font-size: 1.2em; font-weight: 600; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
        .vps-dialog-body { padding: 24px; line-height: 1.6; max-height: 70vh; overflow-y: auto; }
        .vps-dialog-body p { margin: 0 0 10px; }
        .vps-dialog-body label { display: block; margin-bottom: 5px; font-size: 0.9em; color: #aaa; }
        .vps-dialog-body input[type="text"] {
            width: 100%; padding: 10px; margin-bottom: 15px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2);
            background: #3a3a3a; color: #f1f1f1; font-family: sans-serif; font-size: 14px; box-sizing: border-box;
        }
        .vps-dialog-body hr { border: none; height: 1px; background-color: rgba(255, 255, 255, 0.1); margin: 10px 0 20px; }
        .vps-dialog-footer {
            padding: 16px 24px; display: flex; justify-content: flex-end; gap: 12px; background: rgba(0,0,0,0.2);
        }
        .vps-dialog-button {
            padding: 10px 20px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;
        }
        .vps-dialog-button:active { transform: scale(0.98); }
        .vps-dialog-button.primary { background: #74C0FC; color: #1a1a1a; }
        .vps-dialog-button.danger { background: #E57373; color: #1a1a1a; }
        .vps-dialog-button.secondary { background: #555; color: #fff; }
    `;

    /**
     * --- DIALOG MODULE --- 
     */
    const Dialog = {
        show(options) {
            return new Promise((resolve) => {
                const overlay = document.createElement('div');
                overlay.className = 'vps-dialog-overlay';

                const dialog = document.createElement('div');
                dialog.className = 'vps-dialog';
                dialog.innerHTML = `
                    <div class="vps-dialog-header">${options.title}</div>
                    <div class="vps-dialog-body">${options.body}</div>
                    <div class="vps-dialog-footer"></div>
                `;

                const footer = dialog.querySelector('.vps-dialog-footer');
                (options.buttons || [{ id: 'ok', text: 'OK', class: 'primary' }]).forEach(btn => {
                    const button = document.createElement('button');
                    button.className = `vps-dialog-button ${btn.class || 'secondary'}`;
                    button.textContent = btn.text;
                    button.onclick = () => {
                        const result = { button: btn.id };
                        if (options.form) {
                            result.formData = {};
                            dialog.querySelectorAll('[name]').forEach(input => { result.formData[input.name] = input.value; });
                        }
                        resolve(result);
                        this.close(overlay);
                    };
                    footer.appendChild(button);
                });

                overlay.onclick = (e) => {
                    if (e.target === overlay && options.cancellable) {
                        resolve({ button: 'cancel' });
                        this.close(overlay);
                    }
                };

                overlay.appendChild(dialog);
                document.body.appendChild(overlay);
                setTimeout(() => overlay.classList.add('vps-show'), 10);
            });
        },

        close(overlay) {
            overlay.classList.remove('vps-show');
            setTimeout(() => overlay.remove(), 300);
        },

        showLoader(title) {
            const overlay = document.createElement('div');
            overlay.className = 'vps-dialog-overlay vps-show';
            overlay.innerHTML = `
                <div class="vps-dialog">
                    <div class="vps-dialog-header">${title}</div>
                    <div class="vps-dialog-body"><p>Please wait...</p></div>
                </div>
            `;
            document.body.appendChild(overlay);
            return { close: () => this.close(overlay) };
        }
    };

    /**
     * --- FIREBASE SYNC MODULE ---
     */
    const Firebase = {
        config: { enabled: false, databaseURL: '', path: '', projectId: '' },
        async init() {
            const storedConfig = await GM_getValue(CONFIG.FIREBASE_CONFIG_KEY, {});
            this.config = { ...this.config, ...storedConfig };
        },
        isEnabled() { return this.config.enabled && this.config.databaseURL && this.config.path; },
        _getSafeKey(key) { return encodeURIComponent(key).replace(/\./g, '%2E'); },
        async get(key) {
            if (!this.isEnabled()) return null;
            const url = `${this.config.databaseURL}/${this.config.path}/${this._getSafeKey(key)}.json`;
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            return response.ok ? await response.json() : null;
        },
        async set(key, data) {
            if (!this.isEnabled()) return;
            const url = `${this.config.databaseURL}/${this.config.path}/${this._getSafeKey(key)}.json`;
            await fetch(url, { method: 'PUT', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        },
        async getAll() {
            if (!this.isEnabled()) return null;
            const url = `${this.config.databaseURL}/${this.config.path}.json`;
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            return response.ok ? (await response.json() || {}) : null;
        },
        async setAll(data) {
            if (!this.isEnabled()) return;
            const url = `${this.config.databaseURL}/${this.config.path}.json`;
            await fetch(url, { method: 'PUT', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        }
    };

    /**
     * --- STORAGE MODULE ---
     */
    const Storage = {
        async get(key) { return await GM_getValue(key, null); },
        async set(key, value) { return await GM_setValue(key, value); },
        async getAll() { return await GM_getValue(CONFIG.STORAGE_KEY, {}); },
        async saveAll(data) { return await this.set(CONFIG.STORAGE_KEY, data); },
        async getEntry(videoKey) {
            const localData = (await this.getAll())[videoKey] || null;
            if (!Firebase.isEnabled()) return localData;
            const remoteData = await Firebase.get(videoKey);
            if (!localData && !remoteData) return null;
            if (localData && !remoteData) return localData;
            if (!localData && remoteData) return remoteData;
            return localData.lastUpdate > remoteData.lastUpdate ? localData : remoteData;
        },
        async updateEntry(videoKey, entryData) {
            const allData = await this.getAll();
            const newEntry = { ...allData[videoKey], ...entryData, id: allData[videoKey]?.id || Date.now(), lastUpdate: Date.now(), userAgent: navigator.userAgent };
            allData[videoKey] = newEntry;
            await this.saveAll(allData);
            if (Firebase.isEnabled()) await Firebase.set(videoKey, newEntry);
        }
    };

    /**
     * --- UI MODULE ---
     */
    const UI = {
        init() {
            GM_addStyle(UI_STYLES);
        },
        showRestoredMessage(videoElement, timestamp) {
            const container = videoElement.parentElement;
            if (!container) return;
            if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
            const toast = document.createElement('div');
            toast.className = 'vps-restore-toast';
            const minutes = Math.floor(timestamp / 60);
            const seconds = Math.floor(timestamp % 60).toString().padStart(2, '0');
            toast.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="#FFFFFF" class="vps-toast-icon"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.25 2.52.77-1.28-3.52-2.09V8H12z"/></svg><span>Restored to ${minutes}:${seconds}</span>`;
            container.appendChild(toast);
            setTimeout(() => toast.classList.add('vps-show'), 100);
            setTimeout(() => { toast.classList.remove('vps-show'); setTimeout(() => toast.remove(), 600); }, 4000);
        }
    };

    /**
     * --- VIDEO MANAGER MODULE ---
     */
    const VideoManager = {
        trackedVideos: new WeakSet(),
        init() {
            this.discoverVideos();
            new MutationObserver(() => this.discoverVideos()).observe(document.body, { childList: true, subtree: true });
        },
        discoverVideos() {
            document.querySelectorAll('video').forEach(video => {
                if (!this.trackedVideos.has(video) && video.src) this.trackVideo(video);
            });
        },
        getVideoKey() {
            try {
                const topUrl = new URL(window.top.location.href);
                if (topUrl.hostname.includes('youtube.com') && topUrl.pathname === '/watch') {
                    const videoId = topUrl.searchParams.get('v');
                    if (videoId) return `youtube_${videoId}`;
                }
                return window.top.location.href;
            } catch (e) { return window.location.href; }
        },
        trackVideo(video) {
            this.trackedVideos.add(video);
            let lastSavedTime = -1;

            const getTopLevelInfo = () => {
                try {
                    const url = window.top.location.href;
                    return { pageTitle: window.top.document.title, pageUrl: url };
                } catch (e) {
                    return { pageTitle: document.title, pageUrl: window.location.href };
                }
            };

            const getInfo = () => ({
                ...getTopLevelInfo(),
                timestamp: video.currentTime,
                duration: video.duration,
                videoSrc: video.src
            });

            video.addEventListener('loadedmetadata', async () => {
                if (video.duration < CONFIG.MIN_VIDEO_DURATION_SECONDS) return;
                const data = await Storage.getEntry(this.getVideoKey());
                if (data && data.timestamp > 0 && data.timestamp < data.duration - 5) {
                    video.currentTime = data.timestamp;
                    UI.showRestoredMessage(video, data.timestamp);
                }
            }, { once: true });

            video.addEventListener('timeupdate', async () => {
                if (video.paused || video.seeking || video.ended || video.duration < CONFIG.MIN_VIDEO_DURATION_SECONDS) return;
                if (Math.abs(video.currentTime - lastSavedTime) > CONFIG.SAVE_INTERVAL_SECONDS) {
                    lastSavedTime = video.currentTime;
                    await Storage.updateEntry(this.getVideoKey(), getInfo());
                }
            });

            video.addEventListener('pause', async () => {
                if (video.duration < CONFIG.MIN_VIDEO_DURATION_SECONDS || video.currentTime < 1 || video.currentTime > video.duration - 1) return;
                await Storage.updateEntry(this.getVideoKey(), getInfo());
            });
        }
    };

    /**
     * --- MENU MODULE ---
     */
    const Menu = {
        init() {
            // Register commands only in the top-level window to avoid duplicates.
            if (window.self !== window.top) return;

            GM_registerMenuCommand('⚙️ Configure Sync', () => this.configureSync());
            GM_registerMenuCommand('🔄 Sync Now', () => this.syncNow());
            GM_registerMenuCommand('📤 Export All Progress', () => this.exportData());
            GM_registerMenuCommand('📥 Import All Progress', () => this.importData());
            GM_registerMenuCommand('🗑️ Clear Local Progress', () => this.clearData());
        },

        async configureSync() {
            const config = await Storage.get(CONFIG.FIREBASE_CONFIG_KEY) || {};
            const formHtml = `
                <p>Enter your Firebase project details below. The <strong>Database URL</strong> and <strong>Path</strong> are required.</p>
                <label for="vps-projectId">Project ID</label>
                <input type="text" id="vps-projectId" name="projectId" placeholder="e.g., my-cool-project" value="${config.projectId || ''}">
                <label for="vps-dbUrl">Database URL (Required)</label>
                <input type="text" id="vps-dbUrl" name="databaseURL" placeholder="https://my-project.firebaseio.com" value="${config.databaseURL || ''}">
                <label for="vps-apiKey">API Key</label>
                <input type="text" id="vps-apiKey" name="apiKey" placeholder="AIzaSy..." value="${config.apiKey || ''}">
                <label for="vps-authDomain">Auth Domain</label>
                <input type="text" id="vps-authDomain" name="authDomain" placeholder="my-project.firebaseapp.com" value="${config.authDomain || ''}">
                <label for="vps-storageBucket">Storage Bucket</label>
                <input type="text" id="vps-storageBucket" name="storageBucket" placeholder="my-project.appspot.com" value="${config.storageBucket || ''}">
                <hr>
                <label for="vps-path">Collection Path (Required)</label>
                <input type="text" id="vps-path" name="path" placeholder="e.g., videoProgress" value="${config.path || 'videoProgress'}">
            `;

            const { button, formData } = await Dialog.show({
                title: '⚙️ Configure Sync',
                cancellable: true,
                form: true,
                body: formHtml,
                buttons: [
                    ...(config.enabled ? [{ id: 'disable', text: 'Disable Sync', class: 'danger' }] : []),
                    { id: 'cancel', text: 'Cancel', class: 'secondary' },
                    { id: 'save', text: 'Save & Reload', class: 'primary' }
                ]
            });

            if (button === 'save') {
                try {
                    const dbURL = formData.databaseURL;
                    if (!dbURL || typeof dbURL !== 'string') throw new Error('Config must include a "databaseURL" string.');
                    if (!dbURL.startsWith('https://')) throw new Error('"databaseURL" must start with https://');
                    if (!dbURL.includes('.firebaseio.com') && !dbURL.includes('.firebasedatabase.app')) {
                        throw new Error('"databaseURL" does not appear to be a valid Firebase URL.');
                    }
                    if (!formData.path) throw new Error('Collection path is required.');

                    const newConfig = {
                        enabled: true,
                        apiKey: formData.apiKey || '',
                        authDomain: formData.authDomain || '',
                        databaseURL: dbURL,
                        projectId: formData.projectId || '',
                        storageBucket: formData.storageBucket || '',
                        path: formData.path.replace(/^\/|\/$/g, '')
                    };

                    await Storage.set(CONFIG.FIREBASE_CONFIG_KEY, newConfig);
                    await Dialog.show({ title: 'Success', body: '<p>Firebase sync configured. The page will now reload.</p>' });
                    location.reload();
                } catch (e) { await Dialog.show({ title: 'Error', body: `<p>Configuration failed: ${e.message}</p>` }); }
            } else if (button === 'disable') {
                config.enabled = false;
                await Storage.set(CONFIG.FIREBASE_CONFIG_KEY, config);
                await Dialog.show({ title: 'Sync Disabled', body: '<p>Firebase sync has been disabled. The page will reload.</p>' });
                location.reload();
            }
        },

        async syncNow() {
            if (window.self !== window.top) return;
            if (!Firebase.isEnabled()) return Dialog.show({ title: 'Error', body: '<p>Firebase sync is not configured.</p>' });
            const loader = Dialog.showLoader('🔄 Syncing Now');
            try {
                const [localData, remoteData] = await Promise.all([Storage.getAll(), Firebase.getAll()]);
                if (remoteData === null) throw new Error('Could not fetch data from Firebase. Check console.');

                const allKeys = new Set([...Object.keys(localData), ...Object.keys(remoteData)]);
                const mergedData = {};
                for (const key of allKeys) {
                    const local = localData[key], remote = remoteData[key];
                    if (local && !remote) mergedData[key] = local;
                    else if (!local && remote) mergedData[key] = remote;
                    else if (local && remote) mergedData[key] = (local.lastUpdate || 0) > (remote.lastUpdate || 0) ? local : remote;
                }
                await Promise.all([Storage.saveAll(mergedData), Firebase.setAll(mergedData)]);
                loader.close();
                await Dialog.show({ title: 'Sync Complete', body: '<p>Local and remote data have been merged. Page will reload.</p>' });
                location.reload();
            } catch (error) {
                loader.close();
                await Dialog.show({ title: 'Sync Failed', body: `<p>${error.message}</p>` });
            }
        },

        async exportData() {
            if (window.self !== window.top) return;
            const data = await Storage.getAll();
            if (Object.keys(data).length === 0) return Dialog.show({ title: 'Export', body: '<p>No data to export.</p>' });
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `vps-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            a.remove();
        },

        async importData() {
            if (window.self !== window.top) return;
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const data = JSON.parse(await file.text());
                    if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('Invalid file format.');
                    const { button } = await Dialog.show({ title: '📥 Import Progress', body: '<p>Overwrite all local progress with the selected file?</p>', buttons: [{id: 'cancel', text: 'Cancel'}, {id: 'ok', text: 'Confirm', class: 'primary'}] });
                    if (button === 'ok') {
                        await Storage.saveAll(data);
                        await Dialog.show({ title: 'Import Successful', body: '<p>Use "Sync Now" to push to Firebase. Page will reload.</p>' });
                        location.reload();
                    }
                } catch (error) { await Dialog.show({ title: 'Import Failed', body: `<p>${error.message}</p>` }); }
                finally { input.remove(); }
            };
            input.click();
        },

        async clearData() {
            if (window.self !== window.top) return;
            const { button } = await Dialog.show({
                title: '🗑️ Clear Local Progress',
                body: '<p>Are you sure you want to delete ALL locally saved progress?</p><p>This does not affect remote data.</p>',
                buttons: [{id: 'cancel', text: 'Cancel'}, {id: 'ok', text: 'Confirm Clear', class: 'danger'}]
            });
            if (button === 'ok') {
                await Storage.saveAll({});
                await Dialog.show({ title: 'Success', body: '<p>All local progress has been cleared.</p>' });
            }
        }
    };

    // --- INITIALIZATION ---
    async function main() {
        await Firebase.init();
        UI.init();
        VideoManager.init();
        Menu.init();
    }

    main();

})();
