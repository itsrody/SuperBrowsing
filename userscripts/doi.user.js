// ==UserScript==
// @name                DOI/PMID to Sci-Hub Helper Enhanced
// @name:zh-CN          DOI/PMID跳转Sci-Hub助手增强版
// @namespace           https://greasyfork.org/users/enhanced
// @version             3.0.0
// @description         Enhanced version: Finds DOIs and PMIDs, adding hover buttons to open in Sci-Hub with improved reliability and features.
// @description:zh-CN   增强版：查找页面上的DOI和PMID，添加悬停按钮以在Sci-Hub中打开，具有改进的可靠性和功能。
// @author              Enhanced Version
// @license             MIT
// @match               *://*/*
// @require             https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @require             https://cdn.jsdelivr.net/gh/sizzlemctwizzle/GM_config@2207c5c1322ebb56e401f03c2e581719f909762a/gm_config.js
// @grant               GM_getValue
// @grant               GM_setValue
// @grant               GM_registerMenuCommand
// @grant               GM.xmlHttpRequest
// @grant               GM_addStyle
// @grant               GM_notification
// @downloadURL         https://update.greasyfork.org/scripts/enhanced/DOI%20to%20Sci-Hub%20Enhanced.user.js
// @updateURL           https://update.greasyfork.org/scripts/enhanced/DOI%20to%20Sci-Hub%20Enhanced.meta.js
// ==/UserScript==

(() => {
    'use strict';

    // ============================================================================
    // CONSTANTS & CONFIGURATION
    // ============================================================================

    const ICONS = {
        scihub: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: text-bottom; margin-right: 5px;">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            <path d="M12 12.5c-1.63 0-3.06.79-3.98 2H12v-2zm0-1H8.02c.92-1.21 2.35-2 3.98-2s3.06.79 3.98 2H12v-1z"/>
            <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
        </svg>`,
        copy: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>`,
        external: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
        </svg>`
    };

    const DEFAULT_SCIHUB_URL = "https://sci-hub.se";
    const SCIHUB_MIRRORS_API = "https://sci-hub.41610.org/";

    const ID_TYPES = {
        doi: {
            name: 'DOI',
            // Improved DOI regex - more precise and handles edge cases
            regex: /\b(10\.\d{4,}(?:\.\d+)*\/[^\s<>"{}|\\^`\[\]]*[^\s<>"{}|\\^`\[\].,;!?])/gi,
            buttonText: 'Open in Sci-Hub',
            icon: ICONS.scihub,
            validateId: (id) => /^10\.\d{4,}/.test(id) && id.length > 7,
            normalizeId: (id) => id.trim(),
            color: '#2196F3',
            checkAvailability: true, // Only DOI checks Sci-Hub availability
            primaryUrl: (id) => `https://sci-hub.se/${id}`, // Will be replaced with actual Sci-Hub URL
            alternativeUrl: (id) => `https://doi.org/${id}`
        },
        pmid: {
            name: 'PMID',
            // Fixed PMID regex - more flexible matching
            regex: /\b(?:PMID:?\s*)(\d{1,8})\b/gi,
            buttonText: 'Open in PubMed',
            icon: ICONS.external,
            extractId: (match) => {
                const pmidMatch = match.match(/(\d{1,8})/);
                return pmidMatch ? pmidMatch[1] : null;
            },
            validateId: (id) => /^\d{1,8}$/.test(id) && parseInt(id) > 0,
            normalizeId: (id) => id.trim(),
            color: '#4CAF50',
            checkAvailability: false, // PMID always shows button
            primaryUrl: (id) => `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
            alternativeUrl: (id) => `https://sci-hub.se/${id}` // Will be replaced with actual Sci-Hub URL
        },
        // New: Support for arXiv IDs
        arxiv: {
            name: 'arXiv',
            regex: /\b(?:arXiv:?)(\d{4}\.\d{4,5}(?:v\d+)?)\b/gi,
            buttonText: 'Open in Sci-Hub',
            icon: ICONS.scihub,
            extractId: (match) => {
                const arxivMatch = match.match(/(\d{4}\.\d{4,5}(?:v\d+)?)/);
                return arxivMatch ? arxivMatch[1] : null;
            },
            validateId: (id) => /^\d{4}\.\d{4,5}(?:v\d+)?$/.test(id),
            normalizeId: (id) => id.trim(),
            color: '#FF9800',
            checkAvailability: true, // arXiv checks Sci-Hub availability
            primaryUrl: (id) => `https://sci-hub.se/${id}`, // Will be replaced with actual Sci-Hub URL
            alternativeUrl: (id) => `https://arxiv.org/abs/${id}`
        }
    };

    // ============================================================================
    // STATE MANAGEMENT
    // ============================================================================

    class SciHubState {
        constructor() {
            this.sciHubBaseURL = null;
            this.processedElements = new WeakSet();
            this.availabilityCache = new Map();
            this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
            this.isInitialized = false;
            this.settings = {
                showNotifications: true,
                enableCache: true,
                checkAvailability: true,
                showStats: false,
                theme: 'auto' // auto, light, dark
            };
        }

        setCacheItem(key, value) {
            if (!this.settings.enableCache) return;
            this.availabilityCache.set(key, {
                value,
                timestamp: Date.now()
            });
        }

        getCacheItem(key) {
            if (!this.settings.enableCache) return null;
            const item = this.availabilityCache.get(key);
            if (!item) return null;
            
            if (Date.now() - item.timestamp > this.cacheExpiry) {
                this.availabilityCache.delete(key);
                return null;
            }
            return item.value;
        }

        clearCache() {
            this.availabilityCache.clear();
        }
    }

    const state = new SciHubState();

    // ============================================================================
    // STYLING
    // ============================================================================

    const CSS_STYLES = `
        :root {
            --scihub-primary: #2196F3;
            --scihub-success: #4CAF50;
            --scihub-warning: #FF9800;
            --scihub-light-bg: #f8f9fa;
            --scihub-light-border: #e9ecef;
            --scihub-light-text: #333;
            --scihub-dark-bg: #2d3748;
            --scihub-dark-border: #4a5568;
            --scihub-dark-text: #f7fafc;
        }

        .scihub-id-wrapper {
            position: relative;
            text-decoration: none !important;
            color: inherit !important;
            display: inline;
            transition: all 0.2s ease;
        }

        .scihub-id-wrapper.scihub-active {
            background: linear-gradient(90deg, transparent 0%, rgba(33, 150, 243, 0.1) 50%, transparent 100%);
            background-size: 200% 100%;
            background-position: -100% 0;
            padding: 2px 4px;
            border-radius: 4px;
            cursor: pointer;
            border-bottom: 2px dotted rgba(33, 150, 243, 0.5);
        }

        .scihub-id-wrapper.scihub-active:hover {
            background-position: 0 0;
            border-bottom-style: solid;
        }

        .scihub-id-wrapper.scihub-checking {
            animation: scihub-pulse 1.5s infinite;
            opacity: 0.7;
        }

        .scihub-id-wrapper.scihub-pmid.scihub-active {
            border-bottom-color: rgba(76, 175, 80, 0.5);
            background: linear-gradient(90deg, transparent 0%, rgba(76, 175, 80, 0.1) 50%, transparent 100%);
        }

        .scihub-id-wrapper.scihub-arxiv.scihub-active {
            border-bottom-color: rgba(255, 152, 0, 0.5);
            background: linear-gradient(90deg, transparent 0%, rgba(255, 152, 0, 0.1) 50%, transparent 100%);
        }

        @keyframes scihub-pulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
        }

        #scihub-floating-container {
            position: absolute;
            z-index: 2147483647;
            opacity: 0;
            visibility: hidden;
            transform: translateY(10px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
        }

        #scihub-floating-container.scihub-visible {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
            pointer-events: auto;
        }

        .scihub-floating-btn {
            display: inline-flex;
            align-items: center;
            padding: 8px 12px;
            margin: 2px;
            border-radius: 8px;
            text-decoration: none !important;
            font-size: 13px;
            font-weight: 500;
            line-height: 1.2;
            border: 1px solid;
            transition: all 0.2s ease;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
        }

        .scihub-floating-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .scihub-floating-btn:active {
            transform: translateY(0);
        }

        /* Light theme */
        .scihub-btn-light {
            background: rgba(255, 255, 255, 0.95);
            color: var(--scihub-light-text);
            border-color: var(--scihub-light-border);
        }

        .scihub-btn-light:hover {
            background: rgba(255, 255, 255, 1);
            color: var(--scihub-primary);
        }

        /* Dark theme */
        .scihub-btn-dark {
            background: rgba(45, 55, 72, 0.95);
            color: var(--scihub-dark-text);
            border-color: var(--scihub-dark-border);
        }

        .scihub-btn-dark:hover {
            background: rgba(45, 55, 72, 1);
            color: var(--scihub-primary);
        }

        /* Button variants */
        .scihub-btn-primary { border-left: 3px solid var(--scihub-primary); }
        .scihub-btn-success { border-left: 3px solid var(--scihub-success); }
        .scihub-btn-warning { border-left: 3px solid var(--scihub-warning); }

        /* Stats display */
        .scihub-stats {
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(255, 255, 255, 0.9);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 2147483646;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
            .scihub-floating-btn {
                padding: 6px 10px;
                font-size: 12px;
            }
        }
    `;

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    class Utils {
        static debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        static throttle(func, limit) {
            let inThrottle;
            return function() {
                const args = arguments;
                const context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }

        static getTextNodes(element) {
            const textNodes = [];
            const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        // Skip script, style, and already processed elements
                        const parent = node.parentElement;
                        if (!parent) return NodeFilter.FILTER_REJECT;
                        
                        const tagName = parent.tagName?.toLowerCase();
                        if (['script', 'style', 'noscript', 'textarea'].includes(tagName)) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        
                        if (parent.closest('a, button, .scihub-id-wrapper')) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        
                        return node.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                    }
                },
                false
            );

            let node;
            while (node = walker.nextNode()) {
                textNodes.push(node);
            }
            return textNodes;
        }

        static getBackgroundColor(element) {
            if (!element || element === document.body) {
                return 'rgb(255, 255, 255)';
            }
            
            const style = window.getComputedStyle(element);
            const bgColor = style.backgroundColor;
            
            if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
                return this.getBackgroundColor(element.parentElement);
            }
            return bgColor;
        }

        static isColorDark(colorString) {
            if (!colorString) return false;
            
            const rgb = colorString.match(/\d+/g);
            if (!rgb || rgb.length < 3) return false;
            
            const brightness = (
                parseInt(rgb[0]) * 299 + 
                parseInt(rgb[1]) * 587 + 
                parseInt(rgb[2]) * 114
            ) / 1000;
            
            return brightness < 128;
        }

        static getTheme(element) {
            if (state.settings.theme !== 'auto') {
                return state.settings.theme;
            }
            
            const bgColor = this.getBackgroundColor(element);
            return this.isColorDark(bgColor) ? 'dark' : 'light';
        }

        static sanitizeUrl(url) {
            try {
                const parsed = new URL(url);
                return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? url : null;
            } catch {
                return null;
            }
        }

        static copyToClipboard(text) {
            if (navigator.clipboard) {
                return navigator.clipboard.writeText(text);
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return Promise.resolve();
            }
        }

        static showNotification(message, type = 'info') {
            if (!state.settings.showNotifications) return;
            
            if (typeof GM_notification !== 'undefined') {
                GM_notification({
                    text: message,
                    title: 'Sci-Hub Helper',
                    timeout: 3000
                });
            } else {
                console.log(`[Sci-Hub Helper] ${message}`);
            }
        }
    }

    // ============================================================================
    // CONFIGURATION MANAGEMENT
    // ============================================================================

    class ConfigManager {
        static init() {
            const fields = {
                'UserDefinedBaseURL': {
                    'label': 'Custom Sci-Hub URL',
                    'type': 'text',
                    'default': '',
                    'title': 'Enter your preferred Sci-Hub domain (e.g., https://sci-hub.ee)'
                },
                'showNotifications': {
                    'label': 'Show notifications',
                    'type': 'checkbox',
                    'default': true,
                    'title': 'Show notifications for successful operations'
                },
                'enableCache': {
                    'label': 'Enable availability cache',
                    'type': 'checkbox',
                    'default': true,
                    'title': 'Cache availability checks to improve performance'
                },
                'checkAvailability': {
                    'label': 'Check paper availability',
                    'type': 'checkbox',
                    'default': true,
                    'title': 'Check if papers are available on Sci-Hub before showing buttons'
                },
                'showStats': {
                    'label': 'Show statistics',
                    'type': 'checkbox',
                    'default': false,
                    'title': 'Display statistics about found papers'
                },
                'theme': {
                    'label': 'Theme',
                    'type': 'select',
                    'options': ['auto', 'light', 'dark'],
                    'default': 'auto',
                    'title': 'Choose the button theme'
                }
            };

            GM_config.init({
                'id': 'SciHub_Enhanced_Config',
                'title': 'Sci-Hub Helper Enhanced Settings',
                'fields': fields,
                'events': {
                    'save': () => {
                        this.loadSettings();
                        location.reload();
                    }
                }
            });

            this.loadSettings();
        }

        static loadSettings() {
            state.settings.showNotifications = GM_config.get('showNotifications');
            state.settings.enableCache = GM_config.get('enableCache');
            state.settings.checkAvailability = GM_config.get('checkAvailability');
            state.settings.showStats = GM_config.get('showStats');
            state.settings.theme = GM_config.get('theme');

            if (!state.settings.enableCache) {
                state.clearCache();
            }
        }

        static openSettings() {
            GM_config.open();
        }
    }

    // ============================================================================
    // SCI-HUB INTEGRATION
    // ============================================================================

    class SciHubManager {
        static async getSciHubBaseURL() {
            if (state.sciHubBaseURL) {
                return state.sciHubBaseURL;
            }

            const userDefinedURL = GM_config.get('UserDefinedBaseURL')?.trim();
            if (userDefinedURL) {
                const sanitized = Utils.sanitizeUrl(userDefinedURL);
                if (sanitized) {
                    state.sciHubBaseURL = sanitized.endsWith('/') ? sanitized : sanitized + '/';
                    return state.sciHubBaseURL;
                }
            }

            try {
                const workingURL = await this.findWorkingSciHubMirror();
                state.sciHubBaseURL = workingURL;
                return workingURL;
            } catch (error) {
                console.warn('[Sci-Hub Helper] Could not find working mirror, using default:', error);
                state.sciHubBaseURL = DEFAULT_SCIHUB_URL + '/';
                return state.sciHubBaseURL;
            }
        }

        static findWorkingSciHubMirror() {
            return new Promise((resolve, reject) => {
                GM.xmlHttpRequest({
                    method: 'GET',
                    url: SCIHUB_MIRRORS_API,
                    timeout: 10000,
                    onload: (response) => {
                        try {
                            const $response = $(response.responseText);
                            const foundURL = $response.find('li > a[href^="https://sci-hub"]').first().attr('href');
                            
                            if (foundURL) {
                                const sanitized = Utils.sanitizeUrl(foundURL);
                                if (sanitized) {
                                    resolve(sanitized.endsWith('/') ? sanitized : sanitized + '/');
                                    return;
                                }
                            }
                            resolve(DEFAULT_SCIHUB_URL + '/');
                        } catch (error) {
                            reject(error);
                        }
                    },
                    onerror: () => reject(new Error('Network error')),
                    ontimeout: () => reject(new Error('Timeout'))
                });
            });
        }

        static async checkAvailability(id, type) {
            const typeConfig = ID_TYPES[type];
            
            // Skip availability check for types that don't require it
            if (!typeConfig || !typeConfig.checkAvailability) {
                return true; // Always show button for PMID and other non-checking types
            }

            if (!state.settings.checkAvailability) {
                return true; // Assume available if checking is disabled
            }

            const cacheKey = `${type}:${id}`;
            const cached = state.getCacheItem(cacheKey);
            if (cached !== null) {
                return cached;
            }

            const baseURL = await this.getSciHubBaseURL();
            
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    resolve(false);
                }, 8000);

                GM.xmlHttpRequest({
                    method: 'GET',
                    url: `${baseURL}${id}`,
                    timeout: 8000,
                    onload: (response) => {
                        clearTimeout(timeout);
                        let isAvailable = false;

                        try {
                            // Check if redirected to PDF
                            if (response.finalUrl && response.finalUrl.endsWith('.pdf')) {
                                isAvailable = true;
                            } else if (response.responseText) {
                                const html = response.responseText.toLowerCase();
                                // Check for various indicators of successful paper retrieval
                                isAvailable = html.includes('<div id="article">') ||
                                            html.includes('<embed type="application/pdf"') ||
                                            html.includes('<iframe id="pdf"') ||
                                            html.includes('pdf.js') ||
                                            html.includes('pdfobject');
                            }
                        } catch (error) {
                            console.warn('[Sci-Hub Helper] Error checking availability:', error);
                        }

                        state.setCacheItem(cacheKey, isAvailable);
                        resolve(isAvailable);
                    },
                    onerror: () => {
                        clearTimeout(timeout);
                        state.setCacheItem(cacheKey, false);
                        resolve(false);
                    },
                    ontimeout: () => {
                        clearTimeout(timeout);
                        resolve(false);
                    }
                });
            });
        }

        static async constructPrimaryURL(id, type) {
            const typeConfig = ID_TYPES[type];
            if (!typeConfig) return null;

            // For types that use Sci-Hub, get the dynamic base URL
            if (typeConfig.checkAvailability) {
                const baseURL = await this.getSciHubBaseURL();
                return typeConfig.primaryUrl(id).replace('https://sci-hub.se/', baseURL);
            }
            
            // For other types (like PMID), use the static URL
            return typeConfig.primaryUrl(id);
        }

        static async constructAlternativeURL(id, type) {
            const typeConfig = ID_TYPES[type];
            if (!typeConfig) return null;

            // For Sci-Hub alternative URLs, get the dynamic base URL
            if (typeConfig.alternativeUrl(id).includes('sci-hub.se')) {
                const baseURL = await this.getSciHubBaseURL();
                return typeConfig.alternativeUrl(id).replace('https://sci-hub.se/', baseURL);
            }
            
            // For other types, use the static URL
            return typeConfig.alternativeUrl(id);
        }

        // Keep backward compatibility
        static async constructSciHubURL(id, type) {
            return this.constructPrimaryURL(id, type);
        }
    }

    // ============================================================================
    // UI COMPONENTS
    // ============================================================================

    class UIManager {
        constructor() {
            this.floatingContainer = null;
            this.currentWrapper = null;
            this.hideTimeout = null;
            this.stats = {
                found: { doi: 0, pmid: 0, arxiv: 0 },
                available: { doi: 0, pmid: 0, arxiv: 0 }
            };
        }

        init() {
            this.addStyles();
            this.createFloatingContainer();
            this.setupEventListeners();
            
            if (state.settings.showStats) {
                this.createStatsDisplay();
            }
        }

        addStyles() {
            GM_addStyle(CSS_STYLES);
        }

        createFloatingContainer() {
            this.floatingContainer = document.createElement('div');
            this.floatingContainer.id = 'scihub-floating-container';
            document.body.appendChild(this.floatingContainer);
        }

        createStatsDisplay() {
            const statsDiv = document.createElement('div');
            statsDiv.className = 'scihub-stats';
            statsDiv.id = 'scihub-stats-display';
            document.body.appendChild(statsDiv);
            this.updateStatsDisplay();
        }

        updateStatsDisplay() {
            const statsDiv = document.getElementById('scihub-stats-display');
            if (!statsDiv) return;

            const total = Object.values(this.stats.found).reduce((a, b) => a + b, 0);
            const available = Object.values(this.stats.available).reduce((a, b) => a + b, 0);

            statsDiv.innerHTML = `
                <div><strong>Sci-Hub Helper Stats</strong></div>
                <div>Found: ${total} papers</div>
                <div>Available: ${available} papers</div>
                <div>DOI: ${this.stats.available.doi}/${this.stats.found.doi}</div>
                <div>PMID: ${this.stats.available.pmid}/${this.stats.found.pmid}</div>
                <div>arXiv: ${this.stats.available.arxiv}/${this.stats.found.arxiv}</div>
            `;
        }

        setupEventListeners() {
            // Hover events
            document.body.addEventListener('mouseover', this.handleMouseOver.bind(this));
            document.body.addEventListener('mouseout', this.handleMouseOut.bind(this));

            // Container events
            this.floatingContainer.addEventListener('mouseover', () => {
                clearTimeout(this.hideTimeout);
            });

            this.floatingContainer.addEventListener('mouseout', () => {
                this.scheduleHide();
            });
        }

        handleMouseOver(event) {
            const wrapper = event.target.closest('.scihub-id-wrapper.scihub-active[data-id-value]');
            if (wrapper && wrapper !== this.currentWrapper) {
                clearTimeout(this.hideTimeout);
                this.showFloatingButtons(wrapper);
            }
        }

        handleMouseOut(event) {
            const wrapper = event.target.closest('.scihub-id-wrapper.scihub-active');
            if (wrapper) {
                this.scheduleHide();
            }
        }

        scheduleHide() {
            this.hideTimeout = setTimeout(() => {
                this.hideFloatingButtons();
            }, 300);
        }

        async showFloatingButtons(wrapper) {
            this.currentWrapper = wrapper;
            const idValue = wrapper.dataset.idValue;
            const idType = wrapper.dataset.idType;
            const typeConfig = ID_TYPES[idType];

            if (!typeConfig) return;

            // Clear existing buttons
            this.floatingContainer.innerHTML = '';

            // Create main button (PubMed for PMID, Sci-Hub for others)
            const mainButton = this.createButton({
                text: typeConfig.buttonText,
                icon: typeConfig.icon,
                href: await SciHubManager.constructPrimaryURL(idValue, idType),
                variant: idType,
                primary: true
            });

            // Create copy button
            const copyButton = this.createButton({
                text: 'Copy ID',
                icon: ICONS.copy,
                onClick: () => this.copyId(idValue, idType),
                variant: idType
            });

            this.floatingContainer.appendChild(mainButton);
            this.floatingContainer.appendChild(copyButton);

            // Create secondary button based on type
            if (idType === 'pmid') {
                // For PMID: Add Sci-Hub button as secondary option
                const scihubButton = this.createButton({
                    text: 'Try Sci-Hub',
                    icon: ICONS.scihub,
                    href: await SciHubManager.constructAlternativeURL(idValue, idType),
                    variant: idType
                });
                this.floatingContainer.appendChild(scihubButton);
            } else if (idType === 'doi') {
                // For DOI: Add original DOI link button
                const originalButton = this.createButton({
                    text: 'Original',
                    icon: ICONS.external,
                    href: await SciHubManager.constructAlternativeURL(idValue, idType),
                    variant: idType
                });
                this.floatingContainer.appendChild(originalButton);
            } else if (idType === 'arxiv') {
                // For arXiv: Add original arXiv link button
                const originalButton = this.createButton({
                    text: 'arXiv.org',
                    icon: ICONS.external,
                    href: await SciHubManager.constructAlternativeURL(idValue, idType),
                    variant: idType
                });
                this.floatingContainer.appendChild(originalButton);
            }

            // Position the container
            this.positionFloatingContainer(wrapper);

            // Show the container
            this.floatingContainer.classList.add('scihub-visible');
        }

        createButton({ text, icon, href, onClick, variant, primary = false }) {
            const button = document.createElement(href ? 'a' : 'button');
            
            if (href) {
                button.href = href;
                button.target = '_blank';
                button.rel = 'noopener noreferrer';
            }
            
            if (onClick) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    onClick();
                });
            }

            const theme = Utils.getTheme(this.currentWrapper);
            button.className = `scihub-floating-btn scihub-btn-${theme} scihub-btn-${variant}`;
            
            button.innerHTML = `${icon}${text}`;
            
            return button;
        }

        positionFloatingContainer(wrapper) {
            const rect = wrapper.getBoundingClientRect();
            const containerRect = this.floatingContainer.getBoundingClientRect();
            
            let top = window.scrollY + rect.bottom + 8;
            let left = window.scrollX + rect.left;

            // Adjust if container would go off-screen
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            if (left + containerRect.width > viewportWidth - 10) {
                left = viewportWidth - containerRect.width - 10;
            }

            if (left < 10) {
                left = 10;
            }

            if (top + containerRect.height > window.scrollY + viewportHeight - 10) {
                top = window.scrollY + rect.top - containerRect.height - 8;
            }

            this.floatingContainer.style.top = `${top}px`;
            this.floatingContainer.style.left = `${left}px`;
        }

        hideFloatingButtons() {
            this.floatingContainer.classList.remove('scihub-visible');
            this.currentWrapper = null;
        }

        async copyId(id, type) {
            try {
                await Utils.copyToClipboard(id);
                Utils.showNotification(`${ID_TYPES[type].name} copied: ${id}`, 'success');
            } catch (error) {
                console.error('[Sci-Hub Helper] Copy failed:', error);
                Utils.showNotification('Failed to copy to clipboard', 'error');
            }
        }

        incrementStats(type, category) {
            if (this.stats[category] && this.stats[category][type] !== undefined) {
                this.stats[category][type]++;
                if (state.settings.showStats) {
                    this.updateStatsDisplay();
                }
            }
        }
    }

    // ============================================================================
    // CONTENT PROCESSOR
    // ============================================================================

    class ContentProcessor {
        constructor(uiManager) {
            this.uiManager = uiManager;
            this.processQueue = [];
            this.isProcessing = false;
        }

        async processPage() {
            if (this.isProcessing) return;
            this.isProcessing = true;

            try {
                await this.findAndProcessTextNodes();
                await this.processExistingLinks();
            } catch (error) {
                console.error('[Sci-Hub Helper] Error processing page:', error);
            } finally {
                this.isProcessing = false;
            }
        }

        async findAndProcessTextNodes() {
            const textNodes = Utils.getTextNodes(document.body);
            const processingPromises = [];

            for (const node of textNodes) {
                if (state.processedElements.has(node)) continue;

                for (const [typeName, typeConfig] of Object.entries(ID_TYPES)) {
                    const promise = this.processTextNodeForType(node, typeName, typeConfig);
                    processingPromises.push(promise);
                }
            }

            await Promise.all(processingPromises);
        }

        async processTextNodeForType(node, typeName, typeConfig) {
            const text = node.nodeValue;
            const matches = [...text.matchAll(typeConfig.regex)];

            if (matches.length === 0) return;

            state.processedElements.add(node);
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;

            for (const match of matches) {
                const fullMatch = match[0];
                const extractedId = typeConfig.extractId ? typeConfig.extractId(fullMatch) : fullMatch;
                
                if (!extractedId) continue;

                const normalizedId = typeConfig.normalizeId ? typeConfig.normalizeId(extractedId) : extractedId;
                
                if (!typeConfig.validateId(normalizedId)) continue;

                this.uiManager.incrementStats(typeName, 'found');

                const matchIndex = match.index;
                
                // Add text before match
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, matchIndex)));

                // Create wrapper element
                const wrapper = this.createIdWrapper(fullMatch, normalizedId, typeName, typeConfig);
                fragment.appendChild(wrapper);

                // Check availability asynchronously
                this.checkAndUpdateAvailability(wrapper, normalizedId, typeName);

                lastIndex = matchIndex + fullMatch.length;
            }

            // Add remaining text
            fragment.appendChild(document.createTextNode(text.substring(lastIndex)));

            // Replace the original text node
            if (fragment.childNodes.length > 1) {
                node.parentNode.replaceChild(fragment, node);
            }
        }

        createIdWrapper(displayText, id, typeName, typeConfig) {
            const wrapper = document.createElement('span');
            wrapper.textContent = displayText;
            wrapper.className = `scihub-id-wrapper scihub-checking scihub-${typeName}`;
            wrapper.dataset.idValue = id;
            wrapper.dataset.idType = typeName;
            wrapper.title = `${typeConfig.name}: ${id}`;
            
            return wrapper;
        }

        async checkAndUpdateAvailability(wrapper, id, typeName) {
            const typeConfig = ID_TYPES[typeName];
            
            // For types that don't check availability (like PMID), always activate
            if (!typeConfig.checkAvailability) {
                wrapper.classList.remove('scihub-checking');
                wrapper.classList.add('scihub-active');
                this.uiManager.incrementStats(typeName, 'available');
                return;
            }

            // For types that do check availability (like DOI, arXiv)
            try {
                const isAvailable = await SciHubManager.checkAvailability(id, typeName);
                
                wrapper.classList.remove('scihub-checking');
                
                if (isAvailable) {
                    wrapper.classList.add('scihub-active');
                    this.uiManager.incrementStats(typeName, 'available');
                } else {
                    // For unavailable papers, we can either hide them or mark them differently
                    wrapper.classList.add('scihub-unavailable');
                    wrapper.title += ' (Not available on Sci-Hub)';
                }
            } catch (error) {
                console.warn(`[Sci-Hub Helper] Error checking availability for ${id}:`, error);
                wrapper.classList.remove('scihub-checking');
                // On error, assume available to not break functionality
                wrapper.classList.add('scihub-active');
            }
        }

        async processExistingLinks() {
            const selectors = [
                'a[href*="doi.org/"]',
                'a[href*="dx.doi.org/"]',
                'a[href*="pubmed.ncbi.nlm.nih.gov/"]',
                'a[href*="arxiv.org/"]'
            ];

            const links = document.querySelectorAll(selectors.join(', '));

            for (const link of links) {
                if (state.processedElements.has(link)) continue;
                await this.processExistingLink(link);
            }
        }

        async processExistingLink(link) {
            state.processedElements.add(link);
            
            const href = link.getAttribute('href');
            if (!href) return;

            // Try to extract ID from different types of links
            for (const [typeName, typeConfig] of Object.entries(ID_TYPES)) {
                const id = this.extractIdFromLink(href, typeName, typeConfig);
                if (id && typeConfig.validateId(id)) {
                    this.uiManager.incrementStats(typeName, 'found');
                    
                    link.classList.add('scihub-id-wrapper', 'scihub-checking', `scihub-${typeName}`);
                    link.dataset.idValue = id;
                    link.dataset.idType = typeName;
                    link.title += ` | ${typeConfig.name}: ${id}`;

                    // Check availability
                    await this.checkAndUpdateAvailability(link, id, typeName);
                    break;
                }
            }
        }

        extractIdFromLink(href, typeName, typeConfig) {
            switch (typeName) {
                case 'doi':
                    const doiMatch = href.match(/(?:doi\.org\/|dx\.doi\.org\/)(10\.\d{4,}[^\s]*)/i);
                    return doiMatch ? doiMatch[1] : null;
                
                case 'pmid':
                    const pmidMatch = href.match(/pubmed.*\/(\d{1,8})\/?/i);
                    return pmidMatch ? pmidMatch[1] : null;
                
                case 'arxiv':
                    const arxivMatch = href.match(/arxiv\.org\/(?:abs\/)?(\d{4}\.\d{4,5}(?:v\d+)?)/i);
                    return arxivMatch ? arxivMatch[1] : null;
                
                default:
                    return null;
            }
        }
    }

    // ============================================================================
    // MAIN APPLICATION
    // ============================================================================

    class SciHubHelper {
        constructor() {
            this.uiManager = new UIManager();
            this.contentProcessor = new ContentProcessor(this.uiManager);
            this.mutationObserver = null;
            
            // Debounced processing function
            this.debouncedProcess = Utils.debounce(() => {
                this.contentProcessor.processPage();
            }, 500);
        }

        async init() {
            if (state.isInitialized) return;

            try {
                // Initialize configuration
                ConfigManager.init();

                // Initialize UI
                this.uiManager.init();

                // Get Sci-Hub base URL
                await SciHubManager.getSciHubBaseURL();

                // Process initial page content
                await this.contentProcessor.processPage();

                // Setup DOM observation
                this.setupDOMObserver();

                // Register menu commands
                this.registerMenuCommands();

                state.isInitialized = true;
                Utils.showNotification('Sci-Hub Helper Enhanced initialized successfully');

                console.log('[Sci-Hub Helper] Enhanced version initialized successfully');
            } catch (error) {
                console.error('[Sci-Hub Helper] Initialization error:', error);
                Utils.showNotification('Failed to initialize Sci-Hub Helper', 'error');
            }
        }

        setupDOMObserver() {
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
            }

            this.mutationObserver = new MutationObserver(Utils.throttle((mutations) => {
                let shouldProcess = false;

                for (const mutation of mutations) {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        // Check if any added nodes contain text or are significant elements
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim()) {
                                shouldProcess = true;
                                break;
                            } else if (node.nodeType === Node.ELEMENT_NODE) {
                                // Check if element contains text or links that might contain IDs
                                if (node.textContent?.trim() || node.querySelector('a[href]')) {
                                    shouldProcess = true;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (shouldProcess) break;
                }

                if (shouldProcess) {
                    this.debouncedProcess();
                }
            }, 250));

            this.mutationObserver.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        registerMenuCommands() {
            GM_registerMenuCommand('Settings', () => {
                ConfigManager.openSettings();
            }, 's');

            GM_registerMenuCommand('Clear Cache', () => {
                state.clearCache();
                Utils.showNotification('Cache cleared successfully');
            }, 'c');

            GM_registerMenuCommand('Reprocess Page', () => {
                // Clear processed elements to force reprocessing
                state.processedElements = new WeakSet();
                this.contentProcessor.processPage();
                Utils.showNotification('Page reprocessed');
            }, 'r');

            GM_registerMenuCommand('Toggle Stats', () => {
                state.settings.showStats = !state.settings.showStats;
                const statsDiv = document.getElementById('scihub-stats-display');
                
                if (state.settings.showStats) {
                    if (!statsDiv) {
                        this.uiManager.createStatsDisplay();
                    } else {
                        statsDiv.style.display = 'block';
                    }
                } else if (statsDiv) {
                    statsDiv.style.display = 'none';
                }
                
                Utils.showNotification(`Statistics ${state.settings.showStats ? 'enabled' : 'disabled'}`);
            }, 't');
        }

        destroy() {
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
            }
            
            // Clean up UI elements
            const container = document.getElementById('scihub-floating-container');
            if (container) {
                container.remove();
            }

            const stats = document.getElementById('scihub-stats-display');
            if (stats) {
                stats.remove();
            }

            state.isInitialized = false;
        }
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    // Wait for DOM to be ready
    function waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    // Initialize the application
    async function main() {
        try {
            await waitForDOM();
            
            // Small delay to ensure page is fully rendered
            setTimeout(async () => {
                const app = new SciHubHelper();
                await app.init();
                
                // Store reference for debugging
                window.sciHubHelper = app;
            }, 100);
            
        } catch (error) {
            console.error('[Sci-Hub Helper] Failed to start:', error);
        }
    }

    // Start the application
    main();

})();
