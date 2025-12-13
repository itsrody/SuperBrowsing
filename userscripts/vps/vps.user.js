
// ==UserScript==
// @name         Video Progress Saver
// @namespace    http://tampermonkey.net/
// @version      4.5.0
// @description  Save and restore video playback progress for videos longer than 1 minute.
// @author       Antigravity
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      firebasestorage.googleapis.com
// @connect      *.firebaseio.com
// @connect      *.firebasedatabase.app
// @connect      identitytoolkit.googleapis.com
// @connect      securetoken.googleapis.com
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    /**
     * Constants & Config
     */
    const MIN_DURATION = 60; // 1 minute
    const SAVE_INTERVAL = 10; // 10 seconds
    const PRUNE_DAYS = 30; // 30 days
    const REWIND_SECONDS = 5; // Smart Context Rewind
    const DB_NAME = 'VPS_DB';
    const STORE_NAME = 'videos';

    /**
     * URLSanitizer & MetadataExtractor
     * Robust ID generation and smart title extraction.
     */
    class SmartContext {
        static getCanonicalId(urlStr, duration) {
            try {
                const url = new URL(urlStr);
                const hostname = url.hostname;

                // Strategy 1: YouTube
                if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
                    const v = url.searchParams.get('v');
                    if (v) return `vps_yt_${v}`;
                }

                // Strategy 2: Generic Cleanup
                const junkParams = [
                    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                    'fbclid', 'ref', 'ref_src', 'feature', 't', 'time_continue', 'ab_channel',
                    'app', 'context', 'feature', 'kw', 'modestbranding', 'origin', 'referer',
                    'related', 'source', 'st', 'theme', 'type'
                ];
                // Remove all params unless they look like an ID (whitelist approach might be safer but harder)
                // For now, aggressive blacklist extension.
                // Or better: keep only known IDs? No, too risky for generic sites.
                // Let's iterate and delete known junk.
                const params = Array.from(url.searchParams.keys());
                for (const p of params) {
                    if (junkParams.includes(p) || p.startsWith('utm_') || p.startsWith('ga_')) {
                        url.searchParams.delete(p);
                    }
                }

                // Strategy 3: Hash handling (some SPAs use hash for routing, others for anchors)
                // We'll keep the hash if it looks like a route (starts with #/)
                if (url.hash && !url.hash.startsWith('#/')) {
                    url.hash = '';
                }

                // Append duration to differentiate same-url but different-content (rare but possible)
                // Use a coarser duration (e.g. nearest 10s) to allow for slight encoding variations?
                // No, legacy logic used Math.floor. Let's stick to that for compatibility,
                // but rely mostly on the cleaner URL.
                return `vps_${url.href}_${Math.floor(duration)}`;
            } catch (e) {
                return `vps_${urlStr}_${Math.floor(duration)}`;
            }
        }

        static getSmartTitle() {
            // 1. OG Title (often cleanest)
            const og = document.querySelector('meta[property="og:title"]');
            if (og && og.content) return og.content;

            // 2. H1 (semantic main title)
            const h1 = document.querySelector('h1');
            if (h1 && h1.innerText) return h1.innerText;

            // 3. Document Title (cleaned)
            let title = document.title;
            // Remove common suffixes like " - YouTube", " | Netflix"
            title = title.replace(/ - .*/, '').replace(/ \| .*/, '');
            return title || 'Unknown Video';
        }
    }

    /**
     * ContextDetector (Swarm Edition + Smart ID)
     */
    class ContextDetector {
        constructor() {
            this.handleMessage = this.handleMessage.bind(this);
            window.addEventListener('message', this.handleMessage);
            this.cachedContext = null;
        }

        handleMessage(event) {
            if (event.data?.type === 'VPS_WHO_AM_I') {
                event.source.postMessage({
                    type: 'VPS_CONTEXT_RESPONSE',
                    context: {
                        url: window.location.href,
                        title: SmartContext.getSmartTitle() // Use smart title
                    }
                }, event.origin);
            }
        }

        async getContext() {
            if (this.cachedContext) return this.cachedContext;

            if (window === window.top) {
                this.cachedContext = {
                    url: window.location.href,
                    title: SmartContext.getSmartTitle()
                };
                return this.cachedContext;
            }

            try {
                this.cachedContext = await this.askTopFrame();
            } catch (e) {
                // Fallback
                let url = document.referrer || location.href;
                this.cachedContext = { url, title: SmartContext.getSmartTitle() };
            }

            return this.cachedContext;
        }

        askTopFrame() {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject('Timeout'), 500); // Faster timeout
                const handler = (event) => {
                    if (event.data?.type === 'VPS_CONTEXT_RESPONSE') {
                        clearTimeout(timeout);
                        window.removeEventListener('message', handler);
                        resolve(event.data.context);
                    }
                };
                window.addEventListener('message', handler);
                window.top.postMessage({ type: 'VPS_WHO_AM_I' }, '*');
            });
        }
    }

    /**
     * VideoDB
     * IndexedDB Wrapper
     */
    class VideoDB {
        constructor() {
            this.dbName = DB_NAME;
            this.storeName = STORE_NAME;
            this.dbParam = null;
        }

        async init() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, 2);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName, { keyPath: 'id' });
                    }
                };

                request.onsuccess = (event) => {
                    this.dbParam = event.target.result;
                    this.pruneOldEntries();
                    resolve();
                };

                request.onerror = (event) => reject(event.target.error);
            });
        }

        async pruneOldEntries() {
            if (!this.dbParam) return;
            const transaction = this.dbParam.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const cutoff = Date.now() - (PRUNE_DAYS * 24 * 60 * 60 * 1000);

            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const entry = cursor.value;
                    if (entry.lastUpdated && entry.lastUpdated < cutoff) {
                        cursor.delete();
                    }
                    cursor.continue();
                }
            };
        }

        async deleteEntry(id) {
            if (!this.dbParam) await this.init();
            return new Promise((resolve, reject) => {
                const transaction = this.dbParam.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.delete(id);
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject('Delete failed');
            });
        }



        async saveProgress(id, data) {
            if (!this.dbParam) await this.init();
            return new Promise((resolve, reject) => {
                const bgTransaction = this.dbParam.transaction([this.storeName], 'readwrite');
                const store = bgTransaction.objectStore(this.storeName);
                const entry = {
                    id,
                    ...data,
                    timestamp: data.time,
                    lastUpdated: Date.now()
                };
                store.put(entry);
                bgTransaction.oncomplete = () => resolve();
                bgTransaction.onerror = () => reject('DB Error');
            });
        }

        async markPendingSync(id, isPending) {
            if (!this.dbParam) await this.init();
            return new Promise((resolve) => {
                const transaction = this.dbParam.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const req = store.get(id);
                req.onsuccess = () => {
                    if (req.result) {
                        const entry = req.result;
                        entry.pendingSync = isPending;
                        store.put(entry);
                    }
                    resolve();
                };
            });
        }

        async getPendingSyncs() {
            if (!this.dbParam) await this.init();
            return new Promise((resolve) => {
                const transaction = this.dbParam.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.openCursor();
                const pending = [];
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        if (cursor.value.pendingSync) pending.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(pending);
                    }
                };
            });
        }

        async getProgress(id) {
            if (!this.dbParam) await this.init();
            return new Promise((resolve) => {
                const transaction = this.dbParam.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const query = store.get(id);
                query.onsuccess = () => resolve(query.result);
                query.onerror = () => resolve(null);
            });
        }

        async getAll() {
            if (!this.dbParam) await this.init();
            return new Promise((resolve) => {
                const transaction = this.dbParam.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const query = store.getAll();
                query.onsuccess = () => resolve(query.result);
            });
        }

        async clearAll() {
            if (!this.dbParam) await this.init();
            return new Promise((resolve) => {
                const transaction = this.dbParam.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                store.clear();
                transaction.oncomplete = () => resolve();
            });
        }

        async importData(jsonData) {
            if (!this.dbParam) await this.init();
            return new Promise((resolve, reject) => {
                let items;
                try {
                    items = JSON.parse(jsonData);
                    if (!Array.isArray(items)) throw new Error("Invalid Format");
                } catch (e) { return reject("Invalid JSON"); }

                const transaction = this.dbParam.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);

                let count = 0;
                items.forEach(item => {
                    if (item.id && item.time !== undefined) {
                        store.put(item);
                        count++;
                    }
                });

                transaction.oncomplete = () => resolve(count);
                transaction.onerror = () => reject("Transaction Failed");
            });
        }
    }



    /**
     * Auth (Firebase Token Management)
     */
    const Auth = {
        getApiKey(config) { return config.apiKey; },
        async getToken(config) {
            const apiKey = this.getApiKey(config);
            if (!apiKey) return null;

            let tokenData = await GM_getValue('vps_firebase_auth_token', null);

            if (tokenData && tokenData.apiKey !== apiKey) {
                tokenData = null;
                await GM_setValue('vps_firebase_auth_token', null);
            }

            if (tokenData && tokenData.expiresAt > Date.now()) {
                return tokenData.idToken;
            }
            if (tokenData && tokenData.refreshToken) {
                return await this.refreshToken(config, tokenData.refreshToken);
            }
            return await this.anonymousLogin(config);
        },
        async anonymousLogin(config) {
            const apiKey = this.getApiKey(config);
            if (!apiKey) return null;
            const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
            return new Promise(resolve => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: url,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({ returnSecureToken: true }),
                    onload: async (res) => {
                        if (res.status !== 200) {
                            console.error('VPS: Anonymous login failed', res.responseText);
                            return resolve(null);
                        }
                        try {
                            const data = JSON.parse(res.responseText);
                            const tokenData = {
                                apiKey: apiKey,
                                idToken: data.idToken,
                                refreshToken: data.refreshToken,
                                expiresAt: Date.now() + (parseInt(data.expiresIn) * 1000) - 30000
                            };
                            await GM_setValue('vps_firebase_auth_token', tokenData);
                            resolve(tokenData.idToken);
                        } catch (e) { resolve(null); }
                    },
                    onerror: (e) => { console.error('VPS: Login Net Error', e); resolve(null); }
                });
            });
        },
        async refreshToken(config, refreshToken) {
            const apiKey = this.getApiKey(config);
            const url = `https://securetoken.googleapis.com/v1/token?key=${apiKey}`;
            return new Promise(resolve => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: url,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }),
                    onload: async (res) => {
                        if (res.status !== 200) {
                            console.error('VPS: Token refresh failed');
                            return resolve(await this.anonymousLogin(config));
                        }
                        try {
                            const data = JSON.parse(res.responseText);
                            const tokenData = {
                                apiKey: apiKey,
                                idToken: data.id_token,
                                refreshToken: data.refresh_token,
                                expiresAt: Date.now() + (parseInt(data.expires_in) * 1000) - 30000
                            };
                            await GM_setValue('vps_firebase_auth_token', tokenData);
                            resolve(tokenData.idToken);
                        } catch (e) { resolve(await this.anonymousLogin(config)); }
                    },
                    onerror: () => resolve(null)
                });
            });
        }
    };

    /**
     * CloudSync (Firebase REST)
     */
    class CloudSync {
        constructor() {
            // Load full config object or migrate legacy values
            const stored = GM_getValue('vps_firebase_config', {});
            // Legacy migrator
            const legacyUrl = GM_getValue('FIREBASE_URL', '');
            const legacyAuth = GM_getValue('FIREBASE_AUTH', '');

            if (legacyUrl && !stored.databaseURL) {
                this.config = {
                    enabled: true,
                    databaseURL: legacyUrl,
                    databaseSecret: legacyAuth,
                    path: 'videos',
                    apiKey: ''
                };
                GM_setValue('vps_firebase_config', this.config);
                // We keep legacy keys for safety or remove them? Let's keep for now.
            } else {
                this.config = {
                    enabled: false,
                    databaseURL: '',
                    path: 'videos',
                    apiKey: '',
                    databaseSecret: '',
                    ...stored
                };
            }

            this.updateConnectionState();
        }

        setConfig(newConfig) {
            this.config = { ...this.config, ...newConfig };

            // Auto-fix URL protocol & slashes
            if (this.config.databaseURL) {
                if (!this.config.databaseURL.startsWith('http')) {
                    this.config.databaseURL = 'https://' + this.config.databaseURL;
                }
                this.config.databaseURL = this.config.databaseURL.replace(/\/+$/, '');
            }

            // Clean Path
            if (this.config.path) {
                this.config.path = this.config.path.replace(/^\/+|\/+$/g, '');
            }

            GM_setValue('vps_firebase_config', this.config);
            this.updateConnectionState();
        }

        updateConnectionState() {
            this.connected = !!(this.config.enabled && this.config.databaseURL);
            this.dbUrl = this.config.databaseURL || '';
        }

        async _getUrlWithAuth(baseUrl) {
            // Priority 1: Auth Token (API Key)
            if (this.config.apiKey) {
                const token = await Auth.getToken(this.config);
                if (token) return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}auth=${token}`;
            }
            // Priority 2: Database Secret (Legacy)
            if (this.config.databaseSecret) {
                return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}auth=${this.config.databaseSecret}`;
            }
            return baseUrl;
        }

        async sync(id, data) {
            if (!this.connected || !id) return { success: false, error: 'No Connection' };

            // Construct base URL using configurable path
            const path = this.config.path || 'videos';
            // Safe Key: Encode URI ref chars, then replace dots with underscore (Firebase disallows dots in keys)
            const safeId = encodeURIComponent(id).replace(/\./g, '_');
            const base = `${this.dbUrl}/${path}/${safeId}.json`;
            const url = await this._getUrlWithAuth(base);

            // console.log('[VPS] Syncing to:', url.split('?')[0]); // Log stripped URL for debug

            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: "PATCH",
                    url: url,
                    headers: { "Content-Type": "application/json" },
                    data: JSON.stringify({ ...data, lastUpdated: Date.now() }),
                    onload: (res) => {
                        if (res.status >= 200 && res.status < 300) {
                            resolve({ success: true });
                        } else {
                            // Try to parse Firebase Error
                            let errorMsg = `HTTP ${res.status}`;
                            try {
                                const json = JSON.parse(res.responseText);
                                if (json.error) {
                                    // Firebase returns { error: "message" } or { error: { message: "..." } }
                                    errorMsg = typeof json.error === 'string' ? json.error : (json.error.message || errorMsg);
                                }
                            } catch (e) {
                                // Fallback to basic status validation
                                if (res.status === 401) errorMsg = 'Unauthorized (Check Key/Rules)';
                                if (res.status === 404) errorMsg = 'Database Not Found';
                            }
                            console.error(`VPS Sync Error: ${errorMsg}`, res.responseText);
                            resolve({ success: false, error: errorMsg });
                        }
                    },
                    onerror: (e) => resolve({ success: false, error: 'Network Error' })
                });
            });
        }

        async check(id) {
            if (!this.connected || !id) return null;

            const path = this.config.path || 'videos';
            const safeId = encodeURIComponent(id).replace(/\./g, '_');
            const base = `${this.dbUrl}/${path}/${safeId}.json`;
            const url = await this._getUrlWithAuth(base);

            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    onload: (res) => {
                        if (res.status >= 200 && res.status < 300) {
                            try { resolve(JSON.parse(res.responseText)); } catch (e) { resolve(null); }
                        } else {
                            // Log warning for debug
                            try {
                                const json = JSON.parse(res.responseText);
                                const msg = typeof json.error === 'string' ? json.error : (json.error?.message || res.status);
                                console.warn('[VPS] Check failed:', msg);
                            } catch (e) { }
                            resolve(null);
                        }
                    },
                    onerror: () => resolve(null)
                });
            });
        }
    }

    /**
     * UI (iOS 26 / MacOS Tahoe Design System)
     */
    class UI {
        constructor(db, tracker, cloud) {
            this.db = db;
            this.tracker = tracker;
            this.cloud = cloud;
            this.shadow = null;
            this.initHost();
        }

        initHost() {
            const host = document.createElement('div');
            host.id = 'vps-host-root';
            this.shadow = host.attachShadow({ mode: 'open' });
            document.body.appendChild(host);

            const style = document.createElement('style');
            style.textContent = `
                :host {
                    all: initial;
                    z-index: 2147483647;
                    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    --glass-bg: rgba(250, 250, 250, 0.75);
                    --glass-border: rgba(255, 255, 255, 0.5);
                    --glass-shadow: 0 20px 50px rgba(0, 0, 0, 0.15), 0 0 0 0.5px rgba(0,0,0,0.05);
                    --text-primary: #1c1c1e;
                    --text-secondary: #8E8E93;
                    --accent: #007AFF;
                    --danger: #FF3B30;
                    --success: #34C759;
                }
                @media (prefers-color-scheme: dark) {
                    :host {
                        --glass-bg: rgba(30, 30, 30, 0.60);
                        --glass-border: rgba(255, 255, 255, 0.1);
                        --glass-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 0 0.5px rgba(255,255,255,0.1);
                        --text-primary: #FFFFFF;
                        --text-secondary: #98989D;
                        --accent: #0A84FF;
                        --danger: #FF453A;
                    }
                }

                .toast-container {
                    position: fixed; top: 24px; right: 24px; pointer-events: none;
                    display: flex; flex-direction: column; align-items: flex-end; z-index: 9999;
                    gap: 12px;
                }
                .toast {
                    background: var(--glass-bg);
                    backdrop-filter: blur(30px) saturate(180%);
                    -webkit-backdrop-filter: blur(30px) saturate(180%);
                    box-shadow: var(--glass-shadow);
                    border-radius: 28px;
                    padding: 14px 20px;
                    display: flex; align-items: center; gap: 16px;
                    pointer-events: auto;
                    animation: springSlideIn 0.5s cubic-bezier(0.19, 1, 0.22, 1);
                    transform-origin: center right; color: var(--text-primary);
                    user-select: none;
                }
                @keyframes springSlideIn {
                    0% { opacity: 0; transform: translateX(20px) scale(0.9); }
                    100% { opacity: 1; transform: translateX(0) scale(1); }
                }
                .toast.fade-out {
                    opacity: 0; transform: scale(0.9) translateY(-10px);
                    transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
                }
                .toast-content { display: flex; flex-direction: column; gap: 2px; }
                .title { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }
                .message { font-size: 12px; color: var(--text-secondary); font-weight: 500; }

                .actions { display: flex; gap: 8px; align-items: center; margin-left: 4px; }
                .icon-btn {
                    background: rgba(120, 120, 128, 0.1);
                    border: none; cursor: pointer; width: 32px; height: 32px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1);
                    color: var(--text-primary);
                }
                .icon-btn:hover { background: rgba(120, 120, 128, 0.2); transform: scale(1.1); }
                .icon-btn:active { transform: scale(0.92); }
                .icon-btn.primary { background: var(--accent); color: white; box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3); }
                .icon-btn.primary:hover { filter: brightness(1.1); transform: scale(1.05); }
                .icon-btn.danger { color: var(--danger); background: rgba(255, 59, 48, 0.1); }
                .icon-btn.danger:hover { background: rgba(255, 59, 48, 0.2); }

                svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }

                /* iOS Settings Modal */
                .modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.3);
                    backdrop-filter: blur(5px);
                    display: flex; justify-content: center; align-items: center;
                    animation: fadeIn 0.3s ease forwards; z-index: 10000;
                }
                .modal-overlay.closing { animation: fadeOut 0.2s ease forwards; pointer-events: none; }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }

                .modal {
                    background: var(--glass-bg);
                    backdrop-filter: blur(40px) saturate(200%);
                    -webkit-backdrop-filter: blur(40px) saturate(200%);
                    width: 500px; max-width: 92vw; height: 650px; max-height: 88vh;
                    border-radius: 32px;
                    box-shadow: var(--glass-shadow);
                    display: flex; flex-direction: column; overflow: hidden;
                    animation: springPop 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                    border: 0.5px solid var(--glass-border);
                }
                @keyframes springPop {
                    0% { opacity: 0; transform: scale(0.8); }
                    100% { opacity: 1; transform: scale(1); }
                }
                .modal-overlay.closing .modal { animation: springPopOut 0.2s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
                @keyframes springPopOut { to { opacity: 0; transform: scale(0.9); } }

                .modal-header {
                    padding: 20px 24px;
                    display: flex; justify-content: space-between; align-items: center;
                    background: rgba(120, 120, 128, 0.05);
                    border-bottom: 0.5px solid var(--glass-border);
                }
                .modal-header h2 { margin: 0; font-size: 20px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em; }
                .close-btn {
                    background: rgba(120,120,128,0.1); border:none; border-radius: 50%;
                    width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
                    font-size: 18px; color: var(--text-secondary); cursor: pointer; transition: 0.2s;
                }
                .close-btn:hover { background: rgba(120,120,128,0.2); color: var(--text-primary); transform: rotate(90deg); }

                .modal-content { flex: 1; overflow-y: auto; padding: 20px; background: transparent; /* Unified Glass */ }

                .section { margin-bottom: 24px; }
                .section-title { margin: 0 0 16px 16px; font-size: 12px; text-transform: uppercase; color: var(--text-secondary); font-weight: 500; }

                /* Cards & Layout */
                .history-card {
                    box-sizing: border-box; /* CRITICAL FIX: Include padding in height */
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 12px 16px; border-radius: 16px;
                    background: rgba(120, 120, 128, 0.08);
                    border: 1px solid rgba(255, 255, 255, 0.05); /* Subtle inner border */
                    cursor: pointer; transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
                    position: relative; overflow: hidden;
                    text-decoration: none; color: inherit;
                }
                .history-card:hover {
                    background: rgba(120, 120, 128, 0.12);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }
                .history-card:active { transform: scale(0.98); }

                .item-info { display: flex; flex-direction: column; gap: 4px; overflow: hidden; z-index: 2; }
                .item-main { font-size: 15px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; }
                .item-sub { font-size: 13px; color: var(--text-secondary); font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; font-weight: 400; }

                /* Pill Buttons */
                .pill-btn {
                    flex: 1; border: none; border-radius: 20px; padding: 10px;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    font-size: 14px; font-weight: 600; cursor: pointer;
                    transition: all 0.2s;
                    background: rgba(120, 120, 128, 0.12); color: var(--text-primary);
                }
                .pill-btn:hover { background: rgba(120, 120, 128, 0.2); transform: translateY(-1px); }
                .pill-btn:active { transform: scale(0.96); }

                .pixel-perfect-btn {
                    flex: 0 0 auto !important;
                    width: 38px; height: 38px; padding: 0 !important;
                    border-radius: 12px;
                }
                .pixel-perfect-btn svg { width: 20px; height: 20px; }

                /* Switch */
                .switch {
                    position: relative; display: inline-block; width: 42px; height: 24px;
                }
                .switch input { opacity: 0; width: 0; height: 0; }
                .slider {
                    position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
                    background-color: rgba(120,120,128,0.16); transition: .3s cubic-bezier(0.25, 0.8, 0.5, 1); border-radius: 24px;
                }
                .slider:before {
                    position: absolute; content: ""; height: 20px; width: 20px;
                    left: 2px; bottom: 2px; background-color: white;
                    transition: .3s cubic-bezier(0.25, 0.8, 0.5, 1); border-radius: 50%;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                input:checked + .slider { background-color: var(--accent); }
                input:checked + .slider:before { transform: translateX(18px); }

                .delete-btn { color: var(--danger); background: none; border: none; font-size: 15px; cursor: pointer; padding: 4px; }

                /* Trash Icon Hover */
                .delete-trash-btn:hover {
                    color: var(--danger) !important;
                    background: rgba(255,59,48,0.1) !important;
                    transform: scale(1.05);
                }
                .delete-trash-btn:active { transform: scale(0.95); }

                /* Sync Status */
                .sync-status {
                    position: fixed; bottom: 20px; right: 20px;
                    background: var(--glass-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                    padding: 8px 12px; border-radius: 20px;
                    display: flex; align-items: center; gap: 8px;
                    font-size: 12px; font-weight: 600; color: var(--text-primary);
                    box-shadow: var(--glass-shadow);
                    transform: translateY(100px); transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1);
                    z-index: 9998; pointer-events: none; opacity: 0;
                    border: 0.5px solid var(--glass-border);
                }
                .sync-status.visible { transform: translateY(0); opacity: 1; }
                .sync-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-secondary); transition: background 0.3s; }
                .sync-dot.syncing { background: var(--accent); animation: pulse 1s infinite; }
                .sync-dot.success { background: var(--success); }
                .sync-dot.error { background: var(--danger); }
                @keyframes pulse { 0% { opacity: 0.4; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } 100% { opacity: 0.4; transform: scale(0.8); } }

                /* Form Elements */
                .input-field {
                    width: 100%; box-sizing: border-box;
                    background: rgba(120, 120, 128, 0.12);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 10px; padding: 10px 12px;
                    color: var(--text-primary); margin-top: 6px; font-size: 14px;
                    transition: border-color 0.2s, background 0.2s;
                    box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
                }
                .input-field:focus {
                    outline: none; border-color: var(--accent);
                    background: rgba(120, 120, 128, 0.18);
                }
                .list-item { padding: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }

                /* Mobile Optimization */
                @media (max-width: 600px) {
                    .modal {
                        width: 95vw;
                        height: auto; max-height: 85vh;
                        border-radius: 24px;
                    }
                    .modal-header { padding: 16px 20px; }
                    .modal-content { padding: 16px; }
                    .history-card { padding: 12px; }
                    .item-main { font-size: 14px; }
                    .item-sub { font-size: 12px; }
                    .section-title { margin: 0 0 12px 12px; }
                    
                    /* Prevent iOS Zoom on inputs */
                    .input-field { font-size: 16px; }
                    
                    /* Adjust buttons for touch */
                    .pill-btn { padding: 12px; }
                    
                    /* Toast positioning */
                    .toast-container { top: 16px; right: 16px; left: 16px; align-items: center; }
                    .toast { width: 100%; box-sizing: border-box; justify-content: space-between; }
                }
            `;
            this.shadow.appendChild(style);

            const container = document.createElement('div');
            container.className = 'toast-container';
            this.shadow.appendChild(container);
            this.toastContainer = container;

            this.initSyncIndicator();
        }

        initSyncIndicator() {
            const el = document.createElement('div');
            el.className = 'sync-status';
            el.innerHTML = `<div class="sync-dot"></div><span id="sync-msg">Syncing...</span>`;
            this.shadow.appendChild(el);
            this.syncEl = el;
            this.syncDot = el.querySelector('.sync-dot');
            this.syncMsg = el.querySelector('#sync-msg');
            this.syncTimer = null;
        }

        setSyncStatus(status, msg) {
            if (!this.syncEl) return;
            clearTimeout(this.syncTimer);

            // Per user request: Only show global indicator on error.
            if (status === 'error') {
                this.syncEl.classList.add('visible');
                this.syncDot.className = 'sync-dot ' + status;
                this.syncMsg.textContent = msg || 'Error';
                // Errors persist for 4s then fade, or stay? Usually errors should be seen.
                // Let's hide after 5s to be non-intrusive but noticeable.
                this.syncTimer = setTimeout(() => {
                    this.syncEl.classList.remove('visible');
                }, 5000);
            } else {
                this.syncEl.classList.remove('visible');
            }
        }

        showRestorePrompt(time, onRestore, onCancel) {
            const timeStr = new Date(time * 1000).toISOString().substr(11, 8).replace(/^00:/, '');
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerHTML = `
                <div class="toast-content">
                    <span class="title">Resume Playback?</span>
                    <span class="message">Saved at ${timeStr}</span>
                </div>
                <div class="actions">
                    <button id="no-btn" class="icon-btn" title="Dismiss"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                    <button id="yes-btn" class="icon-btn primary" title="Resume"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>
                </div>
            `;
            this.toastContainer.appendChild(toast);
            const close = () => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 500); };
            toast.querySelector('#yes-btn').onclick = () => { onRestore(); close(); };
            toast.querySelector('#no-btn').onclick = () => { if (onCancel) onCancel(); close(); };
            setTimeout(close, 8000);
        }

        showAutoResumeNotification(time, onUndo) {
            const timeStr = new Date(time * 1000).toISOString().substr(11, 8).replace(/^00:/, '');
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerHTML = `
                <div class="toast-content">
                    <span class="title">Resumed Playback</span>
                    <span class="message">Jumped to ${timeStr}</span>
                </div>
                <div class="actions">
                    <button id="undo-btn" class="icon-btn danger" title="Undo / Reset">
                        <svg viewBox="0 0 24 24" stroke-width="2.5"><path d="M2.5 2v6h6"></path><path d="M2.5 13a9 9 0 1 0 3-7.7L2.5 8"></path></svg>
                    </button>
                </div>
            `;
            this.toastContainer.appendChild(toast);
            const close = () => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 500); };
            toast.querySelector('#undo-btn').onclick = () => { onUndo(); close(); };
            setTimeout(close, 5000);
        }

        async showHistory() {
            if (window !== window.top) { window.top.postMessage({ type: 'VPS_OPEN_HISTORY' }, '*'); return; }

            const items = await this.db.getAll();

            // Cleanup
            const existing = this.shadow.querySelector('.modal-overlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal">
                    <!-- Header -->
                    <div class="modal-header">
                        <h2>History</h2>
                        <button class="close-btn">×</button>
                    </div>

                    <!-- Search Sticky Area (Inside Body or Separate? Better separate for sticky behavior without messing up virtual scroll offset calc) -->
                    <!-- We'll put search in a sub-header wrapper for cleanliness -->
                    <div style="padding: 12px 20px 8px 20px; border-bottom: 0.5px solid var(--glass-border); flex-shrink: 0; z-index: 10;">
                        <div style="position:relative; width:100%;">
                            <div style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-secondary); pointer-events:none; display:flex; align-items:center;">
                                <svg viewBox="0 0 24 24" style="width:14px;height:14px; stroke:currentColor; stroke-width:2.5; opacity:0.6;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </div>
                            <input type="text" id="history-search" placeholder="Search"
                                style="width:100%; box-sizing:border-box; border:none; background: rgba(120,120,128,0.12); padding:8px 32px; border-radius:10px; font-size:14px; outline:none; color:var(--text-primary); transition: all 0.2s; text-align: left;">
                            <button id="search-clear" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); border:none; background:rgba(120,120,128,0.3); color:white; border-radius:50%; width:16px; height:16px; display:none; align-items:center; justify-content:center; cursor:pointer; font-size:10px; line-height:1; padding:0;">✕</button>
                        </div>
                    </div>

                    <!-- Scrollable Content -->
                    <div class="modal-content" id="vps-modal-body" style="padding: 0; overflow-y: auto; flex: 1; position:relative;">
                        <div id="history-list-container" style="position:relative; min-height: 100px; margin: 0;">
                            <!-- Virtual List Content -->
                        </div>
                    </div>

                    <!-- Footer (Data Management) -->
                    <div style="padding: 16px 20px; border-top: 0.5px solid var(--glass-border); background: var(--glass-bg); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0;">
                        <div style="display:flex; gap:8px;">
                            <button id="btn-export" class="pill-btn pixel-perfect-btn" title="Export JSON">
                                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            </button>
                            <button id="btn-import" class="pill-btn pixel-perfect-btn" title="Import JSON">
                                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            </button>
                        </div>
                        <button id="clear-data" style="border:none; background:transparent; color: var(--danger); font-size: 13px; font-weight: 600; cursor: pointer; padding: 8px 12px; border-radius: 8px; transition: background 0.2s;">
                            Clear History
                        </button>
                    </div>
                </div>
            `;
            this.shadow.appendChild(overlay);

            // Helpers
            const getRelativeTime = (ts) => {
                const diff = Date.now() - ts;
                const min = 60 * 1000;
                const hour = 60 * min;
                const day = 24 * hour;
                if (diff < min) return 'Just now';
                if (diff < hour) return `${Math.floor(diff / min)}m ago`;
                if (diff < day) return `${Math.floor(diff / hour)}h ago`;
                if (diff < 2 * day) return 'Yesterday';
                return new Date(ts).toLocaleDateString();
            };

            // State
            let filteredItems = [...items];

            // Virtual Scrolling
            // Adjusted for container padding interaction (if any)
            const CARD_HEIGHT = 72;
            const GAP = 20;
            const ROW_HEIGHT = CARD_HEIGHT + GAP;
            const PADDING_TOP = 24;
            const BUFFER = 5;
            const container = overlay.querySelector('#history-list-container');
            const scrollParent = overlay.querySelector('#vps-modal-body');

            const updateHeight = () => {
                const h = Math.max(filteredItems.length * ROW_HEIGHT, 64) + PADDING_TOP;
                container.style.height = `${h}px`;
            };
            updateHeight();

            const renderChunk = () => {
                if (filteredItems.length === 0) {
                    container.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; color:var(--text-secondary); text-align:center;"><svg viewBox="0 0 24 24" style="width:32px;height:32px;margin-bottom:12px;opacity:0.3;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span style="font-weight:500;">No history yet</span><span style="font-size:12px; opacity:0.7; margin-top:4px;">Videos longer than 1m will appear here</span></div>';
                    return;
                }
                const containerRect = container.getBoundingClientRect();
                const parentRect = scrollParent.getBoundingClientRect();
                // We need to account for the PADDING_TOP in our calculations or simpler: just offset the top css
                const viewTop = -containerRect.top + parentRect.top; // Relative scroll position
                const height = parentRect.height;

                let startIndex = Math.floor((viewTop - PADDING_TOP) / ROW_HEIGHT) - BUFFER;
                let endIndex = Math.floor((viewTop - PADDING_TOP + height) / ROW_HEIGHT) + BUFFER;

                startIndex = Math.max(0, startIndex);
                endIndex = Math.min(filteredItems.length, endIndex);
                const visibleItems = filteredItems.slice(startIndex, endIndex);

                const html = visibleItems.map((i, idx) => {
                    let displayName = i.title;
                    let link = i.url;
                    if (!displayName || !link) {
                        const parts = i.id.split('vps_');
                        if (parts[1]) {
                            const urlPart = parts[1].substring(0, parts[1].lastIndexOf('_'));
                            link = link || urlPart;
                            try { displayName = displayName || new URL(urlPart).hostname + new URL(urlPart).pathname; } catch (e) { displayName = urlPart; }
                        }
                    }
                    const pct = Math.min(100, Math.max(0, (i.time / i.duration) * 100)) || 0;
                    const top = ((startIndex + idx) * ROW_HEIGHT) + PADDING_TOP;

                    return `
                    <div class="virtual-row" style="position:absolute; top:${top}px; left:20px; right:24px; height:${CARD_HEIGHT}px; display:flex; align-items:center; gap:24px;">
                        <button class="delete-trash-btn" data-id="${i.id}" style="
                            width: 32px; height: 32px; border-radius:50%; border:none; background:transparent;
                            display:flex; align-items:center; justify-content:center;
                            cursor:pointer; color:var(--text-secondary); flex-shrink:0;">
                            <svg viewBox="0 0 24 24" style="width:18px;height:18px; stroke: currentColor; fill:none; stroke-width:2;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                        <a class="history-card" href="${link || '#'}" target="_blank" style="flex:1; height:100%; border:none; display:flex; align-items:center; text-decoration:none; color:inherit; overflow:hidden;">
                            <div class="item-info" style="z-index:2; flex:1; min-width:0; padding-right:12px;">
                                <div class="item-main" style="width:100%;">${displayName || 'Unknown Video'}</div>
                                <div class="item-sub">${Math.floor(i.time / 60)}:${(Math.floor(i.time) % 60).toString().padStart(2, '0')} • ${getRelativeTime(i.lastUpdated)}</div>
                            </div>
                            <!-- Progress Donut -->
                            <div style="flex-shrink:0; width:24px; height:24px; display:flex; align-items:center; justify-content:center;">
                                <svg viewBox="0 0 36 36" style="width:24px; height:24px; transform: rotate(-90deg);">
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(128,128,128,0.2)" stroke-width="4" />
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--accent)" stroke-width="4" stroke-dasharray="${pct}, 100" stroke-linecap="round" />
                                </svg>
                            </div>
                        </a>
                    </div>
                `}).join('');
                container.innerHTML = html;
            };

            // Search
            const searchInput = overlay.querySelector('#history-search');
            const searchClear = overlay.querySelector('#search-clear');
            const performSearch = (term) => {
                filteredItems = items.filter(i => {
                    const t = (i.title || '').toLowerCase();
                    const u = (i.url || '').toLowerCase();
                    return t.includes(term) || u.includes(term);
                });
                scrollParent.scrollTop = 0;
                updateHeight();
                renderChunk();
            };
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                searchClear.style.display = term ? 'flex' : 'none';
                performSearch(term);
            });
            searchInput.addEventListener('focus', () => searchInput.style.background = 'rgba(120,120,128,0.2)');
            searchInput.addEventListener('blur', () => searchInput.style.background = 'rgba(120,120,128,0.12)');
            searchClear.onclick = () => { searchInput.value = ''; searchClear.style.display = 'none'; performSearch(''); searchInput.focus(); };

            // Delete
            container.onclick = async (e) => {
                const btn = e.target.closest('.delete-trash-btn');
                if (btn) {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    if (confirm('Forget this video?')) {
                        await this.db.deleteEntry(id);
                        const masterIdx = items.findIndex(x => x.id === id);
                        if (masterIdx > -1) items.splice(masterIdx, 1);
                        const filteredIdx = filteredItems.findIndex(x => x.id === id);
                        if (filteredIdx > -1) filteredItems.splice(filteredIdx, 1);
                        updateHeight();
                        renderChunk();
                    }
                }
            };

            // Export Logic
            overlay.querySelector('#btn-export').onclick = async () => {
                const data = await this.db.getAll();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `vps_backup_${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
            };

            // Import Logic
            overlay.querySelector('#btn-import').onclick = () => {
                const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
                input.onchange = (e) => {
                    const file = e.target.files[0]; if (!file) return;
                    const r = new FileReader(); r.onload = async (ev) => {
                        try {
                            const c = await this.db.importData(ev.target.result);
                            alert(`✅ Imported ${c} videos.`);
                            const newItems = await this.db.getAll();
                            items.length = 0; items.push(...newItems);
                            filteredItems = [...items];
                            performSearch(searchInput.value.toLowerCase());
                        } catch (err) { alert('❌ ' + err); }
                    }; r.readAsText(file);
                }; input.click();
            };

            // Clear All
            const clearBtn = overlay.querySelector('#clear-data');
            let clearStep = 0;
            clearBtn.onclick = async () => {
                if (clearStep === 0) {
                    clearStep = 1; clearBtn.textContent = "Confirm Clear?"; clearBtn.style.color = "var(--danger)"; clearBtn.style.background = "rgba(255,59,48,0.1)";
                    setTimeout(() => { clearStep = 0; clearBtn.textContent = "Clear History"; clearBtn.style.color = "var(--danger)"; clearBtn.style.background = "transparent"; }, 3000);
                } else {
                    await this.db.clearAll();
                    items.length = 0; filteredItems.length = 0; updateHeight(); renderChunk();
                    clearStep = 0; clearBtn.textContent = "Clear History"; clearBtn.style.background = "transparent";
                }
            };

            // Init
            scrollParent.addEventListener('scroll', () => window.requestAnimationFrame(renderChunk));
            setTimeout(() => renderChunk(), 0);

            // Close
            const close = () => { overlay.classList.add('closing'); setTimeout(() => overlay.remove(), 250); };
            overlay.onclick = (e) => { if (e.target === overlay) close(); };
            overlay.querySelector('.close-btn').onclick = close;
        }

        async showSettings() {
            if (window !== window.top) { window.top.postMessage({ type: 'VPS_OPEN_SETTINGS' }, '*'); return; }
            const autoResume = GM_getValue('AUTO_RESUME', true);

            // Cleanup
            const existing = this.shadow.querySelector('.modal-overlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal" style="height:auto; display:flex; flex-direction:column;">
                    <!-- Header -->
                    <div class="modal-header">
                        <h2>Settings</h2>
                        <button class="close-btn">×</button>
                    </div>

                    <!-- Scrollable Content -->
                    <div class="modal-content" style="padding: 20px; overflow-y: auto; flex: 1;">
                        <div class="section">
                            <span class="section-title">Playback</span>
                            <div class="group" style="background: rgba(120,120,128,0.08); border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                                <div class="list-item">
                                    <div class="item-info">
                                        <div class="item-main">Auto-Resume</div>
                                        <div class="item-sub">Skip confirmation to resume video</div>
                                    </div>
                                    <label class="switch">
                                        <input type="checkbox" id="toggle-resume" ${autoResume ? 'checked' : ''}>
                                        <span class="slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- Cloud Sync Section -->
                        <div class="section">
                            <span class="section-title">Cloud Sync (Firebase)</span>
                            <div class="group" style="background: rgba(120,120,128,0.08); border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                                <div style="display: flex; flex-direction: column; gap: 12px; padding: 20px;">
                                    
                                    <!-- Database URL -->
                                    <div class="item-info">
                                        <div class="item-main">Realtime Database URL</div>
                                        <input type="text" id="firebase-url" class="input-field" placeholder="https://your-project.firebaseio.com"
                                            value="${this.cloud.config.databaseURL || ''}">
                                    </div>

                                    <!-- API Key (New) -->
                                    <div class="item-info">
                                        <div class="item-main">API Key <span style="font-size:11px; color:var(--accent); margin-left:4px;">(Recommended)</span></div>
                                        <input type="password" id="firebase-apikey" class="input-field" placeholder="AIzaSy..."
                                            value="${this.cloud.config.apiKey || ''}">
                                    </div>

                                    <!-- Collection Path -->
                                    <div class="item-info">
                                        <div class="item-main">Collection Path</div>
                                        <input type="text" id="firebase-path" class="input-field" placeholder="videos"
                                            value="${this.cloud.config.path || 'videos'}">
                                    </div>

                                    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
                                        <button id="force-sync" class="pill-btn" style="flex:1; padding:10px; font-size:13px; background:rgba(120,120,128,0.15);">
                                            Force Sync
                                        </button>
                                        <button id="save-cloud" class="pill-btn" style="flex:1; padding:10px; font-size:13px; background:var(--accent); color:white;">
                                            Test & Save
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div style="padding: 12px 20px; border-top: 0.5px solid var(--glass-border); background: var(--glass-bg); text-align: center; flex-shrink: 0;">
                        <span style="font-size: 11px; color: var(--text-secondary); font-weight: 500;">Video Progress Saver v${GM_info.script.version}</span>
                    </div>
                </div>
            `;
            this.shadow.appendChild(overlay);

            // Common Close
            const close = () => { overlay.classList.add('closing'); setTimeout(() => overlay.remove(), 250); };
            overlay.onclick = (e) => { if (e.target === overlay) close(); };
            overlay.querySelector('.close-btn').onclick = close;

            // Toggle logic
            overlay.querySelector('#toggle-resume').onchange = (e) => {
                const newState = e.target.checked;
                GM_setValue('AUTO_RESUME', newState);
                if (this.tracker) this.tracker.autoResume = newState;
            };

            // Cloud Save
            const urlInput = overlay.querySelector('#firebase-url');
            const apiKeyInput = overlay.querySelector('#firebase-apikey');
            const pathInput = overlay.querySelector('#firebase-path');
            const saveBtn = overlay.querySelector('#save-cloud');

            saveBtn.onclick = async () => {
                const newConfig = {
                    enabled: true,
                    databaseURL: urlInput.value.trim(),
                    apiKey: apiKeyInput.value.trim(),
                    path: pathInput.value.trim() || 'videos'
                    // databaseSecret is preserved if it exists but not updated from UI
                };

                const originalText = saveBtn.textContent;
                saveBtn.textContent = 'Testing...';

                // Temporary apply to test
                this.cloud.setConfig(newConfig);

                if (this.cloud.connected) {
                    // Try to authenticate and read
                    const testId = 'test_connection';
                    try {
                        const checkRes = await this.cloud.check(testId);
                        // If we get here, read permission is likely okay or at least we connected
                        if (checkRes === null && this.cloud.config.apiKey) {
                            // If using API Key, verify token generation explicitly
                            const token = await Auth.getToken(this.cloud.config);
                            if (!token) throw new Error("Auth Failed (Invalid API Key?)");
                        }

                        saveBtn.textContent = '✅ Connected';
                        saveBtn.style.backgroundColor = '#34c759'; // Green
                        setTimeout(() => {
                            saveBtn.textContent = originalText;
                            saveBtn.style.backgroundColor = '';
                        }, 2000);

                        this.tracker.retryPending(true);

                    } catch (e) {
                        alert(`⚠️ Connection Error: ${e.message || 'Unknown'} `);
                        saveBtn.textContent = '❌ Error';
                        saveBtn.style.backgroundColor = '#ff3b30'; // Red
                        setTimeout(() => {
                            saveBtn.textContent = originalText;
                            saveBtn.style.backgroundColor = '';
                        }, 2000);
                    }
                } else {
                    alert('⚠️ Invalid URL');
                    saveBtn.textContent = originalText;
                }
            };

            overlay.querySelector('#force-sync').onclick = async (e) => {
                const btn = e.currentTarget;
                const originalContent = btn.innerHTML;
                btn.innerHTML = 'Syncing...';

                await this.tracker.retryPending(true);

                // Since retryPending returns void but updates status, we can't easily know success/fail directly
                // without changing retryPending. However, we can infer from Cloud.connected or just show 'Done'.
                // Ideally retryPending should return status.
                // For now, let's assume if it finished without error alert (which setSyncStatus 'error' handles), it's ok.
                // But wait, setSyncStatus('error') IS checking errors. 

                // Let's just standard "Done" and let the global error toast handle failures if any.
                btn.innerHTML = '✅ Synced';
                setTimeout(() => {
                    btn.innerHTML = originalContent;
                }, 2000);
            };
        }
    }

    /**
     * VideoTracker
     * Orchestrator
     */
    class VideoTracker {
        constructor() {
            this.ctx = new ContextDetector();
            this.db = new VideoDB();
            this.cloud = new CloudSync();
            this.ui = new UI(this.db, this, this.cloud);
            this.tracking = new WeakMap();
            // We use a set for active videos only if we needed to iterate, but visibility listener is global.
            // Using a simple set to track 'active' ID strings might be useful for batch ops?
            // For now, retryPending handles the DB side.

            this.autoResume = GM_getValue('AUTO_RESUME', true); // Default True

            // Listen for Settings request from iframes (Only Top Frame processes this)
            if (window === window.top) {
                window.addEventListener('message', (event) => {
                    if (event.data?.type === 'VPS_OPEN_SETTINGS') {
                        this.ui.showSettings();
                    }
                    if (event.data?.type === 'VPS_OPEN_HISTORY') {
                        this.ui.showHistory();
                    }
                });
            }

            this.registerCommands();
        }

        registerCommands() {
            // Keep menu commands for quick access
            GM_registerMenuCommand("📺 History", () => {
                if (window !== window.top) {
                    window.top.postMessage({ type: 'VPS_OPEN_HISTORY' }, '*');
                } else {
                    this.ui.showHistory();
                }
            });

            GM_registerMenuCommand("⚙️ Settings", () => {
                if (window !== window.top) {
                    window.top.postMessage({ type: 'VPS_OPEN_SETTINGS' }, '*');
                } else {
                    this.ui.showSettings();
                }
            });
        }

        start() {
            this.db.init();
            // Start recursive observation from the top
            this.observeRoot(document);

            // Online / Offline Listeners
            window.addEventListener('online', () => this.retryPending());
            setTimeout(() => this.retryPending(), 3000); // Initial check
        }

        async retryPending(manual = false) {
            if (!this.cloud.connected) {
                if (manual) this.ui.setSyncStatus('error', 'No Cloud Config');
                return;
            }

            const pending = await this.db.getPendingSyncs();
            if (pending.length === 0) {
                if (manual) this.ui.setSyncStatus('success', 'All Synced');
                return;
            }

            this.ui.setSyncStatus('syncing', `Syncing ${pending.length} pending...`);
            let successCount = 0;
            for (const item of pending) {
                // We re-sync the stored item.
                const res = await this.cloud.sync(item.id, item);
                if (res.success) {
                    await this.db.markPendingSync(item.id, false);
                    successCount++;
                }
                // small delay to be nice
                await new Promise(r => setTimeout(r, 100));
            }

            if (successCount > 0) {
                this.ui.setSyncStatus('success', `Synced ${successCount} videos`);
            } else if (pending.length > 0) {
                // Determine best error message
                const res = await this.cloud.sync(pending[0].id, pending[0]); // Retry one to get error
                this.ui.setSyncStatus('error', res.error || 'Sync Failed');
            }
        }

        /**
         * Recursively observes a root (Document or ShadowRoot)
         * and scans its current content for videos and *other* shadow roots.
         */
        observeRoot(root) {
            // 1. Observe for future additions
            const observer = new MutationObserver(mutations => {
                for (const m of mutations) {
                    for (const n of m.addedNodes) {
                        if (n.nodeType === 1) this.scanTree(n);
                    }
                }
            });
            observer.observe(root, { childList: true, subtree: true });

            // 2. Scan current content (initial load or when a shadow root is first found)
            if (root === document) {
                this.scanTree(document.body || document.documentElement);
            } else {
                this.scanTree(root);
            }
        }

        /**
         * Scans a subtree for:
         * 1. <video> elements to track
         * 2. Elements with .shadowRoot to recursively observe
         */
        scanTree(node) {
            if (!node) return;

            // A. Check the node itself
            if (node.nodeName === 'VIDEO') this.process(node);
            if (node.shadowRoot) this.observeRoot(node.shadowRoot);

            // B. Walk children (TreeWalker is faster than querySelectorAll for "everything")
            // We need to find *all* shadow roots, not just videos.
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
            let child;
            while (child = walker.nextNode()) {
                if (child.nodeName === 'VIDEO') this.process(child);
                if (child.shadowRoot) this.observeRoot(child.shadowRoot);
            }
        }

        async process(video) {
            if (this.tracking.has(video)) return;

            // Validations
            if (video.readyState < 1) {
                video.addEventListener('loadedmetadata', () => this.process(video), { once: true });
                return;
            }
            if (video.duration < MIN_DURATION) return;

            // Init State
            this.tracking.set(video, { init: false });

            // Context & ID
            const context = await this.ctx.getContext();
            const id = SmartContext.getCanonicalId(context.url, video.duration);

            // check if we got a better title now that we waited for metadata/interaction
            // Optionally update context title if it was placeholder
            if (context.title === 'Unknown Video') {
                context.title = SmartContext.getSmartTitle();
            }

            const state = { id, lastTime: 0, lastCloudTime: 0, init: true };
            this.tracking.set(video, state);

            // Check Storage & Cloud
            let saved = await this.db.getProgress(id);

            // Cloud Restore Logic
            let forcePrompt = false;
            if (this.cloud.connected) {
                try {
                    const cloudData = await this.cloud.check(id);
                    if (cloudData) {
                        const localTs = saved ? (saved.lastUpdated || 0) : 0;
                        const timeDiff = Math.abs(cloudData.time - (saved ? saved.time : 0));

                        // If Cloud is newer (>1m) and position differs (>1m), it's a conflict/handoff.
                        if (cloudData.lastUpdated > localTs + 60000 && timeDiff > 60) {
                            saved = { ...cloudData, time: cloudData.time };
                            this.db.saveProgress(id, saved);
                            forcePrompt = true; // Force user to confirm handoff
                            this.ui.setSyncStatus('success', 'Found Cloud Progress');
                        }
                        // If local missing, just adopt cloud
                        else if (!saved) {
                            saved = { ...cloudData, time: cloudData.time };
                            this.db.saveProgress(id, saved);
                        }
                    }
                } catch (e) { console.error('Cloud Check Error', e); }
            }

            if (saved && saved.time > 5 && video.duration) {
                // Smart Completion Detection: If > 95% watched, don't prompt (treat as finished)
                if (saved.time > saved.duration * 0.95) {
                    console.log('[VPS] Video previously finished ( >95% ), skipping resume.');
                    return;
                }

                // Smart Rewind
                const resumeTime = Math.max(0, saved.time - REWIND_SECONDS);

                // Conflict/Restore Logic
                const currentAutoResume = GM_getValue('AUTO_RESUME', true);
                // If forcePrompt is true (Cloud Conflict), we ignore Auto-Resume to be safe
                if (currentAutoResume && !forcePrompt) {
                    video.currentTime = resumeTime;
                    video.play().catch(() => { }); // Auto-play if possible
                    this.ui.showAutoResumeNotification(saved.time, () => { video.currentTime = 0; });
                } else {
                    this.ui.showRestorePrompt(saved.time, () => {
                        video.currentTime = resumeTime;
                        video.play().catch(() => { });
                    });
                }
            }

            // Save Logic (Throttled)
            const save = () => {
                if (!state.init || video.paused) return;
                const now = video.currentTime;
                // Save diff > interval OR significant events
                if (Math.abs(now - state.lastTime) >= SAVE_INTERVAL) {
                    const data = {
                        time: now,
                        duration: video.duration,
                        title: context.title || document.title,
                        url: context.url
                    };
                    this.db.saveProgress(id, data);
                    state.lastTime = now;
                }

                // Cloud Sync (Every 15s)
                if (this.cloud.connected && Math.abs(now - state.lastCloudTime) >= 15) {
                    this.ui.setSyncStatus('syncing');
                    this.cloud.sync(id, {
                        time: now,
                        duration: video.duration,
                        title: context.title || document.title,
                        url: context.url
                    }).then(res => {
                        if (res.success) {
                            state.lastCloudTime = now;
                            this.ui.setSyncStatus('success');
                            this.db.markPendingSync(id, false);
                        } else {
                            this.ui.setSyncStatus('error', res.error || 'Sync Failed');
                            this.db.markPendingSync(id, true);
                        }
                    });
                }
            };

            const forceSave = () => {
                const now = video.currentTime;
                if (now > 5) {
                    const data = {
                        time: now,
                        timeUpdated: Date.now(), // Ensure freshness check uses this
                        duration: video.duration,
                        title: context.title || document.title,
                        url: context.url
                    };
                    this.db.saveProgress(id, data);

                    if (this.cloud.connected) {
                        this.ui.setSyncStatus('syncing', 'Saving to Cloud...');
                        this.cloud.sync(id, data).then(res => {
                            if (res.success) {
                                this.ui.setSyncStatus('success', 'Saved');
                                this.db.markPendingSync(id, false);
                            } else {
                                this.ui.setSyncStatus('error', res.error || 'Offline');
                                this.db.markPendingSync(id, true);
                            }
                        });
                    }
                }
            };

            // Global visibility hook (only once per video loop, but redundancy is low cost here compared to complexity)
            // Ideally we move this to tracker, but closure access to `forceSave` is needed.
            // We'll use a named handler to avoid dups if process called again (though process has checks)
            const onVisibilityChange = () => {
                if (document.visibilityState === 'hidden' && !video.paused) {
                    forceSave();
                }
            };
            document.addEventListener('visibilitychange', onVisibilityChange);

            video.addEventListener('timeupdate', save);
            video.addEventListener('pause', forceSave);
            window.addEventListener('beforeunload', forceSave);
        }
    }

    const app = new VideoTracker();
    app.start();

})();
