// ==UserScript==
// @name                DOI/PMID to Sci-Hub Helper Simplified
// @name:zh-CN          DOI/PMID跳转Sci-Hub助手简化版
// @namespace           https://greasyfork.org/users/enhanced
// @version             5.0.1
// @description         Simplified version: Click to open in Sci-Hub/PubMed, double-click to copy. Mobile-friendly with elegant feedback.
// @description:zh-CN   简化版：单击打开Sci-Hub/PubMed，双击复制。支持移动设备，优雅反馈。
// @author              Enhanced Version
// @license             MIT
// @match               *://*/*
// @require             https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @grant               GM_getValue
// @grant               GM_setValue
// @grant               GM_registerMenuCommand
// @grant               GM.xmlHttpRequest
// @grant               GM_addStyle
// @grant               GM_notification
// @grant               GM_setClipboard
// @connect             sci-hub.se
// @connect             sci-hub.st
// @connect             sci-hub.ru
// @connect             sci-hub.si
// @connect             sci-hub.tw
// @connect             sci-hub.ren
// @connect             sci-hub.mksa.top
// @connect             sci-hub.wf
// @connect             sci-hub.41610.org
// @connect             doi.org
// @connect             dx.doi.org
// @connect             pubmed.ncbi.nlm.nih.gov
// @connect             arxiv.org
// @connect             *
// @downloadURL         https://update.greasyfork.org/scripts/enhanced/DOI%20to%20Sci-Hub%20Enhanced.user.js
// @updateURL           https://update.greasyfork.org/scripts/enhanced/DOI%20to%20Sci-Hub%20Enhanced.meta.js
// ==/UserScript==

(() => {
    'use strict';

    // ============================================================================
    // CONSTANTS & CONFIGURATION
    // ============================================================================

    const ICONS = {
        copy: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>`,
        success: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>`
    };

    const DEFAULT_SCIHUB_URL = "https://sci-hub.se";
    const SCIHUB_MIRRORS_API = "https://sci-hub.41610.org/";

    const ID_TYPES = {
        doi: {
            name: 'DOI',
            regex: /\b(10\.\d{4,}(?:\.\d+)*\/[^\s<>"{}|\\^`\[\]]*[^\s<>"{}|\\^`\[\].,;!?])/gi,
            validateId: (id) => /^10\.\d{4,}/.test(id) && id.length > 7,
            normalizeId: (id) => id.trim(),
            color: '#2196F3',
            checkAvailability: true,
            primaryUrl: (id) => `https://sci-hub.se/${id}`,
            alternativeUrl: (id) => `https://doi.org/${id}`
        },
        pmid: {
            name: 'PMID',
            regex: /\b(?:PMID:?\s*)(\d{1,8})\b/gi,
            extractId: (match) => {
                const pmidMatch = match.match(/(\d{1,8})/);
                return pmidMatch ? pmidMatch[1] : null;
            },
            validateId: (id) => /^\d{1,8}$/.test(id) && parseInt(id) > 0,
            normalizeId: (id) => id.trim(),
            color: '#4CAF50',
            checkAvailability: false,
            primaryUrl: (id) => `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
            alternativeUrl: (id) => `https://sci-hub.se/${id}`
        },
        arxiv: {
            name: 'arXiv',
            regex: /\b(?:arXiv:?)(\d{4}\.\d{4,5}(?:v\d+)?)\b/gi,
            extractId: (match) => {
                const arxivMatch = match.match(/(\d{4}\.\d{4,5}(?:v\d+)?)/);
                return arxivMatch ? arxivMatch[1] : null;
            },
            validateId: (id) => /^\d{4}\.\d{4,5}(?:v\d+)?$/.test(id),
            normalizeId: (id) => id.trim(),
            color: '#FF9800',
            checkAvailability: true,
            primaryUrl: (id) => `https://sci-hub.se/${id}`,
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
                debugMode: false,
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
        }

        .scihub-id-wrapper {
            position: relative;
            display: inline-block;
            cursor: pointer;
            transition: all 0.2s ease;
            border-radius: 4px;
            padding: 2px 4px;
            margin: 0 1px;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            vertical-align: baseline;
            line-height: 1.2;
        }

        .scihub-id-wrapper.scihub-active {
            background: rgba(33, 150, 243, 0.15);
            border: 1px solid rgba(33, 150, 243, 0.3);
        }

        .scihub-id-wrapper.scihub-active:hover {
            background: rgba(33, 150, 243, 0.25);
            border-color: rgba(33, 150, 243, 0.5);
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
        }

        .scihub-id-wrapper.scihub-pmid.scihub-active {
            background: rgba(76, 175, 80, 0.15);
            border-color: rgba(76, 175, 80, 0.3);
        }

        .scihub-id-wrapper.scihub-pmid.scihub-active:hover {
            background: rgba(76, 175, 80, 0.25);
            border-color: rgba(76, 175, 80, 0.5);
            box-shadow: 0 2px 8px rgba(76, 175, 80, 0.2);
        }

        .scihub-id-wrapper.scihub-arxiv.scihub-active {
            background: rgba(255, 152, 0, 0.15);
            border-color: rgba(255, 152, 0, 0.3);
        }

        .scihub-id-wrapper.scihub-arxiv.scihub-active:hover {
            background: rgba(255, 152, 0, 0.25);
            border-color: rgba(255, 152, 0, 0.5);
            box-shadow: 0 2px 8px rgba(255, 152, 0, 0.2);
        }

        .scihub-id-wrapper.scihub-checking {
            opacity: 0.6;
            background: #f0f0f0;
            border: 1px solid #ddd;
        }

        /* Copy feedback icon */
        .scihub-copy-feedback {
            position: absolute;
            top: 50%;
            right: -12px;
            transform: translateY(-50%) scale(0.5);
            background: var(--scihub-success);
            color: white;
            border-radius: 50%;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            z-index: 1000;
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            pointer-events: none;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .scihub-copy-feedback.show {
            opacity: 1;
            transform: translateY(-50%) scale(1);
        }

        .scihub-copy-feedback.hide {
            opacity: 0;
            transform: translateY(-50%) scale(0.5) translateX(5px);
        }

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

        /* Mobile touch improvements */
        @media (hover: none) and (pointer: coarse) {
            .scihub-id-wrapper.scihub-active {
                padding: 4px 6px;
                border-width: 2px;
                min-height: 24px;
                touch-action: manipulation;
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                -khtml-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
                line-height: 1.4;
            }
            
            .scihub-id-wrapper.scihub-active:active {
                transform: scale(0.95);
                opacity: 0.8;
            }
            
            .scihub-copy-feedback {
                width: 20px;
                height: 20px;
                font-size: 12px;
                right: -14px;
            }
        }

        /* Touch feedback for all devices */
        .scihub-id-wrapper.scihub-active {
            -webkit-tap-highlight-color: rgba(33, 150, 243, 0.3);
            tap-highlight-color: rgba(33, 150, 243, 0.3);
        }

        /* Custom context menu */
        .scihub-context-menu {
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            min-width: 150px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
        }

        .scihub-context-option {
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
        }

        .scihub-context-option:last-child {
            border-bottom: none;
        }

        .scihub-context-option:hover {
            background: #f5f5f5;
        }

        /* Mobile long press visual feedback */
        @media (hover: none) and (pointer: coarse) {
            .scihub-id-wrapper.scihub-active {
                position: relative;
            }

            .scihub-id-wrapper.scihub-active::after {
                content: '';
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                border-radius: 6px;
                background: linear-gradient(45deg, transparent, rgba(76, 175, 80, 0.3), transparent);
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
                z-index: -1;
            }

            .scihub-id-wrapper.scihub-active.long-press-active::after {
                opacity: 1;
            }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
            .scihub-id-wrapper, .scihub-copy-feedback {
                transition: none;
            }
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
            .scihub-id-wrapper.scihub-active {
                border-width: 2px;
                background: rgba(33, 150, 243, 0.3);
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

        static isValidElement(element) {
            return element && 
                   element.nodeType === Node.ELEMENT_NODE && 
                   element.parentNode && 
                   document.contains(element);
        }

        static safeQuerySelector(selector, parent = document) {
            try {
                return parent.querySelector(selector);
            } catch (error) {
                console.warn('[Sci-Hub Helper] Invalid selector:', selector, error);
                return null;
            }
        }

        static safeQuerySelectorAll(selector, parent = document) {
            try {
                return Array.from(parent.querySelectorAll(selector));
            } catch (error) {
                console.warn('[Sci-Hub Helper] Invalid selector:', selector, error);
                return [];
            }
        }

        static copyToClipboard(text) {
            // Try GM_setClipboard first (most reliable for userscripts)
            if (typeof GM_setClipboard !== 'undefined') {
                try {
                    GM_setClipboard(text);
                    return Promise.resolve();
                } catch (error) {
                    console.warn('[Sci-Hub Helper] GM_setClipboard failed:', error);
                }
            }
            
            // Try modern clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text);
            } else {
                // Improved fallback for older browsers and mobile devices
                return new Promise((resolve, reject) => {
                    try {
                        const textArea = document.createElement('textarea');
                        textArea.value = text;
                        textArea.style.position = 'fixed';
                        textArea.style.top = '-9999px';
                        textArea.style.left = '-9999px';
                        textArea.style.opacity = '0';
                        textArea.style.pointerEvents = 'none';
                        textArea.setAttribute('readonly', '');
                        textArea.setAttribute('aria-hidden', 'true');
                        
                        document.body.appendChild(textArea);
                        
                        // For mobile devices, ensure the element is visible and focusable
                        if (/Mobi|Android/i.test(navigator.userAgent)) {
                            textArea.style.position = 'absolute';
                            textArea.style.top = '0';
                            textArea.style.left = '0';
                            textArea.style.width = '1px';
                            textArea.style.height = '1px';
                            textArea.style.opacity = '0';
                            textArea.contentEditable = true;
                            textArea.readOnly = false;
                        }
                        
                        textArea.focus();
                        textArea.select();
                        textArea.setSelectionRange(0, text.length);
                        
                        const successful = document.execCommand('copy');
                        document.body.removeChild(textArea);
                        
                        if (successful) {
                            resolve();
                        } else {
                            reject(new Error('Copy command failed'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
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

        static debugLog(message, data = null) {
            if (state.settings.debugMode) {
                console.log(`[Sci-Hub Helper Debug] ${message}`, data);
            }
        }

        static measurePerformance(operation, func) {
            const start = performance.now();
            const result = func();
            const end = performance.now();
            this.debugLog(`${operation} took ${end - start} milliseconds`);
            return result;
        }

        static async measurePerformanceAsync(operation, asyncFunc) {
            const start = performance.now();
            const result = await asyncFunc();
            const end = performance.now();
            this.debugLog(`${operation} took ${end - start} milliseconds`);
            return result;
        }

        static validateIdType(idType) {
            const validTypes = Object.keys(ID_TYPES);
            if (!validTypes.includes(idType)) {
                throw new Error(`Invalid ID type: ${idType}. Valid types: ${validTypes.join(', ')}`);
            }
            return true;
        }

        static createSVGIcon(iconData) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(iconData, 'image/svg+xml');
                const errorNode = doc.querySelector('parsererror');
                
                if (errorNode) {
                    console.warn('[Sci-Hub Helper] Invalid SVG data:', iconData);
                    return null;
                }
                
                return document.importNode(doc.documentElement, true);
            } catch (error) {
                console.warn('[Sci-Hub Helper] Error creating SVG icon:', error);
                return null;
            }
        }
    }

    // ============================================================================
    // SIMPLIFIED SETTINGS MANAGEMENT  
    // ============================================================================

    class ConfigManager {
        static init() {
            this.loadSettings();
        }

        static loadSettings() {
            Object.keys(state.settings).forEach(key => {
                const value = GM_getValue(key, state.settings[key]);
                state.settings[key] = value;
            });
        }

        static setSetting(key, value) {
            state.settings[key] = value;
            GM_setValue(key, value);
        }

        static getSetting(key) {
            return GM_getValue(key, state.settings[key]);
        }
    }

    // ============================================================================
    // SCI-HUB INTEGRATION
    // ============================================================================

    class SciHubManager {
        static pendingRequests = new Map();
        static abortControllers = new Map();

        static async getSciHubBaseURL() {
            if (state.sciHubBaseURL) {
                return state.sciHubBaseURL;
            }

            const userDefinedURL = ConfigManager.getSetting('UserDefinedBaseURL')?.trim();
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
            return this.checkAvailabilityWithRetry(id, type, 2);
        }

        static async checkAvailabilityWithRetry(id, type, maxRetries = 2) {
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

            // Check if request is already pending (deduplication)
            if (this.pendingRequests.has(cacheKey)) {
                return await this.pendingRequests.get(cacheKey);
            }

            // Create request promise
            const requestPromise = this.performAvailabilityCheck(id, type, maxRetries);
            this.pendingRequests.set(cacheKey, requestPromise);

            try {
                const result = await requestPromise;
                return result;
            } finally {
                this.pendingRequests.delete(cacheKey);
            }
        }

        static async performAvailabilityCheck(id, type, maxRetries) {
            const baseURL = await this.getSciHubBaseURL();
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    const result = await this.singleAvailabilityCheck(baseURL, id, type);
                    state.setCacheItem(`${type}:${id}`, result);
                    return result;
                } catch (error) {
                    Utils.debugLog(`Availability check attempt ${attempt + 1} failed for ${id}:`, error);
                    
                    if (attempt === maxRetries - 1) {
                        // Last attempt failed, cache as false and return false
                        state.setCacheItem(`${type}:${id}`, false);
                        return false;
                    }
                    
                    // Wait before retry with exponential backoff
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
            
            return false;
        }

        static singleAvailabilityCheck(baseURL, id, type) {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Request timeout'));
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
                            Utils.debugLog('Error processing availability response:', error);
                        }

                        resolve(isAvailable);
                    },
                    onerror: () => {
                        clearTimeout(timeout);
                        reject(new Error('Network error'));
                    },
                    ontimeout: () => {
                        clearTimeout(timeout);
                        reject(new Error('Request timeout'));
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
    // SIMPLIFIED UI INTERACTION
    // ============================================================================

    class UIManager {
        constructor() {
            this.abortController = new AbortController();
            this.stats = {
                found: { doi: 0, pmid: 0, arxiv: 0 },
                available: { doi: 0, pmid: 0, arxiv: 0 }
            };
            this.touchTimers = new Map(); // For mobile touch detection
        }

        init() {
            this.addStyles();
            this.setupEventListeners();
            
            if (state.settings.showStats) {
                this.createStatsDisplay();
            }
        }

        addStyles() {
            GM_addStyle(CSS_STYLES);
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

            while (statsDiv.firstChild) {
                statsDiv.removeChild(statsDiv.firstChild);
            }

            const createStatDiv = (text) => {
                const div = document.createElement('div');
                div.textContent = text;
                return div;
            };

            const title = document.createElement('div');
            const strong = document.createElement('strong');
            strong.textContent = 'Sci-Hub Helper Stats';
            title.appendChild(strong);

            statsDiv.appendChild(title);
            statsDiv.appendChild(createStatDiv(`Found: ${total} papers`));
            statsDiv.appendChild(createStatDiv(`Available: ${available} papers`));
            statsDiv.appendChild(createStatDiv(`DOI: ${this.stats.available.doi}/${this.stats.found.doi}`));
            statsDiv.appendChild(createStatDiv(`PMID: ${this.stats.available.pmid}/${this.stats.found.pmid}`));
            statsDiv.appendChild(createStatDiv(`arXiv: ${this.stats.available.arxiv}/${this.stats.found.arxiv}`));
        }

        setupEventListeners() {
            const signal = this.abortController.signal;
            
            // Click/touch events for detected IDs
            document.body.addEventListener('click', this.handleClick.bind(this), { signal });
            document.body.addEventListener('touchstart', this.handleTouchStart.bind(this), { 
                signal, 
                passive: false 
            });
            document.body.addEventListener('touchend', this.handleTouchEnd.bind(this), { 
                signal, 
                passive: false 
            });
            document.body.addEventListener('touchmove', this.handleTouchMove.bind(this), { 
                signal, 
                passive: false 
            });
            
            // Context menu event for long press detection
            document.body.addEventListener('contextmenu', this.handleContextMenu.bind(this), { signal });
        }

        handleClick(event) {
            const wrapper = event.target.closest('.scihub-id-wrapper.scihub-active[data-id-value]');
            if (!wrapper) return;

            event.preventDefault();
            event.stopPropagation();

            const id = wrapper.dataset.idValue;
            const type = wrapper.dataset.idType;

            // Single click always opens link (no double-click detection)
            this.openLink(id, type);
        }

        handleTouchStart(event) {
            const wrapper = event.target.closest('.scihub-id-wrapper.scihub-active[data-id-value]');
            if (!wrapper) return;

            const elementId = this.getElementId(wrapper);
            const touchInfo = {
                startTime: Date.now(),
                wrapper: wrapper,
                startX: event.touches[0].clientX,
                startY: event.touches[0].clientY,
                moved: false,
                longPressTimer: null,
                longPressFired: false
            };
            
            // Set up shorter long press timer (300ms) to trigger before native context menu
            touchInfo.longPressTimer = setTimeout(() => {
                if (!touchInfo.moved && !touchInfo.longPressFired) {
                    // This is a long press - copy ID
                    touchInfo.longPressFired = true;
                    const id = wrapper.dataset.idValue;
                    const type = wrapper.dataset.idType;
                    
                    // Prevent native context menu
                    event.preventDefault();
                    
                    // Haptic feedback for mobile devices
                    this.provideMobileHapticFeedback();
                    
                    // Visual feedback for long press
                    wrapper.style.transform = 'scale(0.95)';
                    wrapper.style.background = 'rgba(76, 175, 80, 0.4)';
                    
                    setTimeout(() => {
                        wrapper.style.transform = '';
                        wrapper.style.background = '';
                    }, 200);
                    
                    this.copyId(id, type, wrapper);
                    
                    // Clear the touch info to prevent normal tap handling
                    this.touchTimers.delete(elementId);
                }
            }, 300); // 300ms - faster than native context menu
            
            this.touchTimers.set(elementId, touchInfo);
        }

        handleTouchMove(event) {
            const wrapper = event.target.closest('.scihub-id-wrapper.scihub-active[data-id-value]');
            if (!wrapper) return;

            const elementId = this.getElementId(wrapper);
            const touchInfo = this.touchTimers.get(elementId);
            
            if (touchInfo && event.touches.length > 0) {
                const moveX = Math.abs(event.touches[0].clientX - touchInfo.startX);
                const moveY = Math.abs(event.touches[0].clientY - touchInfo.startY);
                
                // If user moved more than 10px, consider it not a tap/long press
                if (moveX > 10 || moveY > 10) {
                    touchInfo.moved = true;
                    if (touchInfo.longPressTimer) {
                        clearTimeout(touchInfo.longPressTimer);
                        touchInfo.longPressTimer = null;
                    }
                }
            }
        }

        handleTouchEnd(event) {
            const wrapper = event.target.closest('.scihub-id-wrapper.scihub-active[data-id-value]');
            if (!wrapper) return;

            const elementId = this.getElementId(wrapper);
            const touchInfo = this.touchTimers.get(elementId);

            if (!touchInfo) return;

            // Clear long press timer
            if (touchInfo.longPressTimer) {
                clearTimeout(touchInfo.longPressTimer);
                touchInfo.longPressTimer = null;
            }

            const touchDuration = Date.now() - touchInfo.startTime;
            this.touchTimers.delete(elementId);

            // Only handle as tap if it wasn't moved, wasn't a long press, and duration was short
            if (!touchInfo.moved && !touchInfo.longPressFired && touchDuration < 300) {
                event.preventDefault();
                event.stopPropagation();
                
                const id = wrapper.dataset.idValue;
                const type = wrapper.dataset.idType;

                // Single tap - open link (no double tap detection)
                this.openLink(id, type);
            }
        }

        handleContextMenu(event) {
            const wrapper = event.target.closest('.scihub-id-wrapper.scihub-active[data-id-value]');
            if (wrapper) {
                // Smart context menu handling for mobile
                if (this.isMobileDevice()) {
                    // On mobile, prevent native context menu and provide our own functionality
                    event.preventDefault();
                    event.stopPropagation();
                    
                    // Check if this is after a long press (context menu triggered by long press)
                    const elementId = this.getElementId(wrapper);
                    const touchInfo = this.touchTimers.get(elementId);
                    
                    if (!touchInfo || !touchInfo.longPressFired) {
                        // Context menu triggered without our long press handling - copy the ID
                        const id = wrapper.dataset.idValue;
                        const type = wrapper.dataset.idType;
                        
                        // Visual feedback
                        wrapper.style.transform = 'scale(0.95)';
                        wrapper.style.background = 'rgba(76, 175, 80, 0.4)';
                        setTimeout(() => {
                            wrapper.style.transform = '';
                            wrapper.style.background = '';
                        }, 200);
                        
                        this.copyId(id, type, wrapper);
                        this.provideMobileHapticFeedback();
                    }
                    
                    return false;
                } else {
                    // On desktop, show custom context menu with options
                    event.preventDefault();
                    this.showCustomContextMenu(event, wrapper);
                    return false;
                }
            }
        }

        isMobileDevice() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
        }

        provideMobileHapticFeedback() {
            // Provide haptic feedback on mobile devices
            if ('vibrate' in navigator) {
                navigator.vibrate(50); // Short vibration
            }
        }

        showCustomContextMenu(event, wrapper) {
            // Remove any existing context menu
            const existingMenu = document.getElementById('scihub-context-menu');
            if (existingMenu) {
                existingMenu.remove();
            }

            const id = wrapper.dataset.idValue;
            const type = wrapper.dataset.idType;
            const typeConfig = ID_TYPES[type];

            // Create context menu
            const menu = document.createElement('div');
            menu.id = 'scihub-context-menu';
            menu.className = 'scihub-context-menu';
            
            const openOption = document.createElement('div');
            openOption.className = 'scihub-context-option';
            openOption.textContent = `Open ${typeConfig.name} in ${type === 'pmid' ? 'PubMed' : 'Sci-Hub'}`;
            openOption.onclick = () => {
                this.openLink(id, type);
                menu.remove();
            };

            const copyOption = document.createElement('div');
            copyOption.className = 'scihub-context-option';
            copyOption.textContent = `Copy ${typeConfig.name}: ${id}`;
            copyOption.onclick = () => {
                this.copyId(id, type, wrapper);
                menu.remove();
            };

            menu.appendChild(openOption);
            menu.appendChild(copyOption);

            // Position menu
            menu.style.position = 'absolute';
            menu.style.left = event.pageX + 'px';
            menu.style.top = event.pageY + 'px';
            menu.style.zIndex = '10000';

            document.body.appendChild(menu);

            // Remove menu when clicking elsewhere
            const removeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', removeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', removeMenu), 10);
        }

        getElementId(element) {
            return element.dataset.idValue + '|' + element.dataset.idType;
        }

        async openLink(id, type) {
            try {
                const typeConfig = ID_TYPES[type];
                if (!typeConfig) return;

                const url = await SciHubManager.constructPrimaryURL(id, type);
                window.open(url, '_blank', 'noopener,noreferrer');

                if (state.settings.showNotifications) {
                    Utils.showNotification(`Opening ${typeConfig.name} in ${type === 'pmid' ? 'PubMed' : 'Sci-Hub'}`, 'success');
                }
            } catch (error) {
                console.error('[Sci-Hub Helper] Error opening link:', error);
                Utils.showNotification('Failed to open link', 'error');
            }
        }

        async copyId(id, type, wrapper) {
            try {
                Utils.validateIdType(type);
                
                await Utils.copyToClipboard(id);
                
                // Show elegant clipboard feedback
                this.showClipboardFeedback(wrapper, type);
                
                if (state.settings.showNotifications) {
                    Utils.showNotification(`${ID_TYPES[type].name} copied: ${id}`, 'success');
                }
            } catch (error) {
                Utils.debugLog('Copy operation failed:', error);
                Utils.showNotification('Failed to copy to clipboard', 'error');
            }
        }

        showClipboardFeedback(wrapper, type) {
            // Remove any existing feedback
            const existingFeedback = wrapper.querySelector('.scihub-copy-feedback');
            if (existingFeedback) {
                existingFeedback.remove();
            }

            // Create feedback element
            const feedback = document.createElement('div');
            feedback.className = 'scihub-copy-feedback';
            feedback.innerHTML = ICONS.copy;
            
            // Position relative to wrapper
            wrapper.style.position = 'relative';
            wrapper.appendChild(feedback);

            // Show animation
            setTimeout(() => feedback.classList.add('show'), 10);

            // Success animation after 500ms
            setTimeout(() => {
                feedback.innerHTML = ICONS.success;
                feedback.style.background = 'var(--scihub-success)';
            }, 500);

            // Hide and remove after 2 seconds
            setTimeout(() => {
                feedback.classList.add('hide');
                setTimeout(() => {
                    if (feedback.parentNode) {
                        feedback.parentNode.removeChild(feedback);
                    }
                }, 300);
            }, 2000);
        }

        incrementStats(type, category) {
            if (this.stats[category] && this.stats[category][type] !== undefined) {
                this.stats[category][type]++;
                if (state.settings.showStats) {
                    this.updateStatsDisplay();
                }
            }
        }

        cleanup() {
            try {
                this.abortController.abort();
                
                // Clear touch timers and their long press timers
                this.touchTimers.forEach(touchInfo => {
                    if (touchInfo.longPressTimer) {
                        clearTimeout(touchInfo.longPressTimer);
                    }
                });
                this.touchTimers.clear();
                
                // Remove any existing context menu
                const existingMenu = document.getElementById('scihub-context-menu');
                if (existingMenu && existingMenu.parentNode) {
                    existingMenu.parentNode.removeChild(existingMenu);
                }
                
                const statsDiv = document.getElementById('scihub-stats-display');
                if (statsDiv && statsDiv.parentNode) {
                    statsDiv.parentNode.removeChild(statsDiv);
                }
                
                Utils.debugLog('UIManager cleanup completed');
            } catch (error) {
                console.warn('[Sci-Hub Helper] Error during UIManager cleanup:', error);
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
            this.intersectionObserver = null;
            this.pendingElements = new Set();
        }

        async processPage() {
            if (this.isProcessing) return;
            this.isProcessing = true;

            try {
                await Utils.measurePerformanceAsync('Text nodes processing', async () => {
                    await this.findAndProcessTextNodes();
                });
                
                await Utils.measurePerformanceAsync('Existing links processing', async () => {
                    await this.processExistingLinks();
                });
                
                this.setupIntersectionObserver();
            } catch (error) {
                console.error('[Sci-Hub Helper] Error processing page:', error);
            } finally {
                this.isProcessing = false;
            }
        }

        setupIntersectionObserver() {
            if (this.intersectionObserver) {
                this.intersectionObserver.disconnect();
            }

            this.intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && this.pendingElements.has(entry.target)) {
                        this.processPendingElement(entry.target);
                        this.pendingElements.delete(entry.target);
                        this.intersectionObserver.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px',
                threshold: 0.1
            });
        }

        processPendingElement(element) {
            // Process elements that have come into view
            const idValue = element.dataset.idValue;
            const idType = element.dataset.idType;
            
            if (idValue && idType) {
                this.checkAndUpdateAvailability(element, idValue, idType);
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

            // For performance, defer availability checking for elements not in viewport
            if (!this.isElementInViewport(wrapper)) {
                this.pendingElements.add(wrapper);
                this.intersectionObserver.observe(wrapper);
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
                Utils.debugLog(`Error checking availability for ${id}:`, error);
                wrapper.classList.remove('scihub-checking');
                // On error, assume available to not break functionality
                wrapper.classList.add('scihub-active');
            }
        }

        isElementInViewport(element) {
            const rect = element.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        }

        async processExistingLinks() {
            const selectors = [
                'a[href*="doi.org/"]',
                'a[href*="dx.doi.org/"]',
                'a[href*="pubmed.ncbi.nlm.nih.gov/"]',
                'a[href*="arxiv.org/"]'
            ];

            const links = Utils.safeQuerySelectorAll(selectors.join(', '));

            for (const link of links) {
                if (state.processedElements.has(link) || !Utils.isValidElement(link)) continue;
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

        cleanup() {
            try {
                if (this.intersectionObserver) {
                    this.intersectionObserver.disconnect();
                    this.intersectionObserver = null;
                }
                
                this.pendingElements.clear();
                this.processQueue = [];
                this.isProcessing = false;
                
                Utils.debugLog('ContentProcessor cleanup completed');
            } catch (error) {
                console.warn('[Sci-Hub Helper] Error during ContentProcessor cleanup:', error);
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
            GM_registerMenuCommand('🌐 Change Sci-Hub Domain', () => {
                this.changeSciHubDomain();
            }, 's');

            GM_registerMenuCommand('🗑️ Clear Cache', () => {
                state.clearCache();
                Utils.showNotification('Cache cleared successfully');
            }, 'c');

            GM_registerMenuCommand('🔄 Reprocess Page', () => {
                // Clear processed elements to force reprocessing
                state.processedElements = new WeakSet();
                this.contentProcessor.processPage();
                Utils.showNotification('Page reprocessed');
            }, 'r');

            GM_registerMenuCommand('📊 Toggle Stats', () => {
                state.settings.showStats = !state.settings.showStats;
                ConfigManager.setSetting('showStats', state.settings.showStats);
                
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

            GM_registerMenuCommand('🐛 Toggle Debug', () => {
                state.settings.debugMode = !state.settings.debugMode;
                ConfigManager.setSetting('debugMode', state.settings.debugMode);
                Utils.showNotification(`Debug mode ${state.settings.debugMode ? 'enabled' : 'disabled'}`);
            }, 'd');
        }

        changeSciHubDomain() {
            const currentUrl = ConfigManager.getSetting('UserDefinedBaseURL') || state.sciHubBaseURL || DEFAULT_SCIHUB_URL;
            
            const commonMirrors = [
                'https://sci-hub.se',
                'https://sci-hub.st',
                'https://sci-hub.ru',
                'https://sci-hub.si',
                'https://sci-hub.tw',
                'https://sci-hub.ren',
                'https://sci-hub.mksa.top',
                'https://sci-hub.wf'
            ];
            
            let message = `Current Sci-Hub domain: ${currentUrl}\n\n`;
            message += 'Common Sci-Hub mirrors:\n';
            commonMirrors.forEach((mirror, index) => {
                message += `${index + 1}. ${mirror}\n`;
            });
            message += '\nEnter a new Sci-Hub URL (or leave empty to auto-detect):';
            
            const newUrl = prompt(message, currentUrl);
            
            if (newUrl === null) return; // User cancelled
            
            if (newUrl.trim() === '') {
                // Clear custom URL to use auto-detection
                ConfigManager.setSetting('UserDefinedBaseURL', '');
                state.sciHubBaseURL = null;
                Utils.showNotification('Sci-Hub domain reset to auto-detection');
                
                // Clear cache since we're changing domains
                state.clearCache();
                
                // Reprocess page with new domain
                state.processedElements = new WeakSet();
                this.contentProcessor.processPage();
            } else {
                // Validate and set new URL
                const sanitizedUrl = Utils.sanitizeUrl(newUrl.trim());
                if (sanitizedUrl) {
                    const finalUrl = sanitizedUrl.endsWith('/') ? sanitizedUrl : sanitizedUrl + '/';
                    ConfigManager.setSetting('UserDefinedBaseURL', finalUrl);
                    state.sciHubBaseURL = finalUrl;
                    Utils.showNotification(`Sci-Hub domain changed to: ${finalUrl}`);
                    
                    // Clear cache since we're changing domains
                    state.clearCache();
                    
                    // Reprocess page with new domain
                    state.processedElements = new WeakSet();
                    this.contentProcessor.processPage();
                } else {
                    Utils.showNotification('Invalid URL format. Please enter a valid HTTPS URL.', 'error');
                }
            }
        }

        destroy() {
            try {
                // Disconnect mutation observer
                if (this.mutationObserver) {
                    this.mutationObserver.disconnect();
                    this.mutationObserver = null;
                }
                
                // Cleanup UI manager
                if (this.uiManager) {
                    this.uiManager.cleanup();
                }
                
                // Cleanup content processor
                if (this.contentProcessor) {
                    this.contentProcessor.cleanup();
                }
                
                // Clear processed elements
                state.processedElements = new WeakSet();
                
                // Clear any pending requests
                if (SciHubManager.pendingRequests) {
                    SciHubManager.pendingRequests.clear();
                }
                
                // Abort any ongoing requests
                if (SciHubManager.abortControllers) {
                    SciHubManager.abortControllers.forEach(controller => controller.abort());
                    SciHubManager.abortControllers.clear();
                }
                
                Utils.debugLog('Application destroyed successfully');
                
            } catch (error) {
                console.warn('[Sci-Hub Helper] Error during cleanup:', error);
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
})()
