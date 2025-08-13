// ==UserScript==
// @name         Video Bookmark Manager
// @namespace    http://tampermonkey.net/
// @version      3.0.1
// @description  Streamlined video bookmark system with simplified UI and Font Awesome icons
// @author       Murtaza Salih
// @match        *://*/*
// @icon         data:image/png;base64,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
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.deleteValue
// @grant        GM.listValues
// @grant        GM.addStyle
// @grant        GM.registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(async () => {
    'use strict';

    // Polyfill GM namespace if needed
    try {
        if (typeof GM === 'undefined') {
            window.GM = {};
        }
        if (typeof GM.addStyle !== 'function' && typeof GM_addStyle === 'function') {
            GM.addStyle = (css) => GM_addStyle(css);
        }
        if (typeof GM.registerMenuCommand !== 'function' && typeof GM_registerMenuCommand === 'function') {
            GM.registerMenuCommand = (label, fn) => GM_registerMenuCommand(label, fn);
        }
        if (typeof GM.setValue !== 'function' && typeof GM_setValue === 'function') {
            GM.setValue = (k, v) => Promise.resolve(GM_setValue(k, v));
        }
        if (typeof GM.getValue !== 'function' && typeof GM_getValue === 'function') {
            GM.getValue = (k, d) => Promise.resolve(GM_getValue(k, d));
        }
        if (typeof GM.deleteValue !== 'function' && typeof GM_deleteValue === 'function') {
            GM.deleteValue = (k) => Promise.resolve(GM_deleteValue(k));
        }
        if (typeof GM.listValues !== 'function' && typeof GM_listValues === 'function') {
            GM.listValues = () => Promise.resolve(GM_listValues());
        }
    } catch (_) { /* ignore */ }

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        MIN_DURATION: 180,
        AUTO_SAVE_INTERVAL: 3000,
        SCRIPT_PREFIX: 'vbm_',
        AUTO_SAVE_LABEL: 'Auto-Saved',
        KEY_SCOPE: 'perVideo',
        USE_IDENTICAL_URL_IN_KEY: true,
        PRESERVE_HASH_IN_KEY: true,
        STRIP_QUERY_PARAMS_IN_KEY: true,
        KEEP_QUERY_PARAMS_IN_KEY: ['v','video','vid','id','list','episode','eid','guid','media_id','mediaId'],
        DEBUG: false,
        SCHEMA_VERSION: 3,
        PREFS_KEY: 'vbm_preferences'
    };

    // Load Font Awesome
    const loadFontAwesome = () => {
        return new Promise((resolve, reject) => {
            if (document.querySelector('link[href*="font-awesome"]') ||
                document.querySelector('script[src*="font-awesome"]') ||
                window.FontAwesome) {
                resolve();
                return;
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
            link.crossOrigin = 'anonymous';
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    };

    // ==================== STYLES ====================
    const STYLES = `
        :root {
            color-scheme: light dark;
            --vbm-surface: rgba(18,18,18,0.38);
            --vbm-surface-2: rgba(18,18,18,0.28);
            --vbm-border: rgba(255,255,255,0.14);
            --vbm-border-strong: rgba(255,255,255,0.24);
            --vbm-fore: rgba(255,255,255,0.96);
            --vbm-fore-muted: rgba(255,255,255,0.72);
            --vbm-accent: 88,166,255;
            --vbm-shadow: 0 6px 20px rgba(0,0,0,.35), inset 0 1px 1px rgba(255,255,255,.06);
            --vbm-radius: 14px;
            --vbm-blur: 14px;
            --vbm-saturate: 160%;
        }
        @media (prefers-color-scheme: light) {
            :root {
                --vbm-surface: rgba(255,255,255,0.66);
                --vbm-surface-2: rgba(255,255,255,0.54);
                --vbm-border: rgba(0,0,0,0.09);
                --vbm-border-strong: rgba(0,0,0,0.18);
                --vbm-fore: rgba(20,20,20,0.94);
                --vbm-fore-muted: rgba(20,20,20,0.72);
                --vbm-shadow: 0 6px 20px rgba(0,0,0,.12), inset 0 1px 1px rgba(255,255,255,.28);
            }
        }

        .vbm-container {
            position: absolute;
            top: 16px;
            right: 16px;
            z-index: 2147483647;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
            font-size: 14px;
            line-height: 1.25;
            user-select: none;
            color: var(--vbm-fore);
            text-shadow: 0 1px 1px rgba(0,0,0,.35);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        .vbm-clock-btn {
            width: 42px;
            height: 42px;
            padding: 0;
            border-radius: var(--vbm-radius);
            background: var(--vbm-surface);
            backdrop-filter: blur(var(--vbm-blur)) saturate(var(--vbm-saturate));
            -webkit-backdrop-filter: blur(var(--vbm-blur)) saturate(var(--vbm-saturate));
            border: 1px solid var(--vbm-border);
            box-shadow: var(--vbm-shadow);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: opacity .18s ease, transform .18s ease, box-shadow .18s ease, background .18s ease;
            opacity: 0.55;
            -webkit-tap-highlight-color: transparent;
        }
        .vbm-clock-btn.active { opacity: 1; }
        .vbm-clock-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 12px 34px rgba(0,0,0,.5), inset 0 1px 1px rgba(255,255,255,.08);
            background: rgba(255, 255, 255, 0.08);
        }
        .vbm-clock-btn:active { transform: scale(0.98); }
        .vbm-clock-btn:focus-visible {
            outline: none;
            box-shadow: 0 0 0 3px rgba(var(--vbm-accent),0.35), var(--vbm-shadow);
        }

        .vbm-clock-btn i {
            font-size: 18px;
            color: var(--vbm-fore);
        }

        .vbm-fullscreen-hint {
            position: absolute;
            top: 50%;
            right: 58px;
            transform: translateY(-50%);
            background: linear-gradient(135deg, var(--vbm-surface), var(--vbm-surface-2));
            backdrop-filter: blur(16px) saturate(var(--vbm-saturate));
            -webkit-backdrop-filter: blur(16px) saturate(var(--vbm-saturate));
            border: 1px solid var(--vbm-border);
            border-radius: var(--vbm-radius);
            padding: 12px 16px;
            box-shadow: 0 18px 44px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255,255,255,.06);
            z-index: 2147483647;
            color: var(--vbm-fore);
            text-shadow: 0 1px 1px rgba(0,0,0,.35);
            white-space: nowrap;
            font-size: 13px;
            font-weight: 500;
            opacity: 0;
            scale: 0.95;
            transition: opacity 0.2s ease, scale 0.2s ease;
            pointer-events: none;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .vbm-fullscreen-hint.show {
            opacity: 1;
            scale: 1;
        }
        .vbm-fullscreen-hint i {
            font-size: 16px;
            color: var(--vbm-fore);
        }

        .vbm-panel {
            position: absolute;
            top: 52px;
            right: 0;
            background: linear-gradient(135deg, var(--vbm-surface), var(--vbm-surface-2));
            backdrop-filter: blur(var(--vbm-blur)) saturate(var(--vbm-saturate));
            -webkit-backdrop-filter: blur(var(--vbm-blur)) saturate(var(--vbm-saturate));
            border: 1px solid var(--vbm-border);
            border-radius: var(--vbm-radius);
            box-shadow: var(--vbm-shadow);
            padding: 20px;
            opacity: 0;
            transform: translateY(2px) scale(0.98);
            transition: opacity .18s ease, transform .18s ease;
            pointer-events: none;
            width: 340px;
            max-height: 520px;
            color: var(--vbm-fore);
            text-shadow: 0 1px 1px rgba(0,0,0,.35);
            overflow: hidden;
            line-height: 1.3;
            display: flex;
            flex-direction: column;
        }
        .vbm-panel.active { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

        .vbm-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 18px;
            padding-bottom: 14px;
            border-bottom: 1px solid var(--vbm-border);
            gap: 12px;
        }
        .vbm-panel-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--vbm-fore);
            display: flex;
            align-items: center;
            gap: 8px;
            letter-spacing: .2px;
            white-space: nowrap;
        }
        .vbm-panel-title i {
            font-size: 18px;
            color: var(--vbm-fore);
        }

        .vbm-header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .vbm-search-container {
            margin-bottom: 14px;
            position: relative;
        }
        .vbm-search-input {
            width: 100%;
            padding: 8px 12px 8px 36px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid var(--vbm-border);
            border-radius: 8px;
            color: var(--vbm-fore);
            font-size: 13px;
            outline: none;
            transition: border-color .18s ease, background .18s ease;
            font-family: inherit;
            box-sizing: border-box;
        }
        .vbm-search-input:focus {
            background: rgba(255, 255, 255, 0.08);
            border-color: var(--vbm-border-strong);
        }
        .vbm-search-input::placeholder {
            color: var(--vbm-fore-muted);
            font-size: 13px;
        }
        .vbm-search-container i {
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 14px;
            color: var(--vbm-fore-muted);
            pointer-events: none;
            z-index: 1;
        }

        .vbm-bookmark-list {
            max-height: 340px;
            overflow-y: auto;
            margin-top: 14px;
            padding-right: 6px;
            scrollbar-color: rgba(255,255,255,0.35) rgba(255,255,255,0.08);
            scrollbar-width: thin;
            flex: 1;
        }
        .vbm-bookmark-list::-webkit-scrollbar { width: 10px; }
        .vbm-bookmark-list::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 6px; }
        .vbm-bookmark-list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.25); border-radius: 6px; }
        .vbm-bookmark-list::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.35); }

        .vbm-bookmark-item {
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: center;
            gap: 10px;
            padding: 12px;
            margin-bottom: 10px;
            background: rgba(255, 255, 255, 0.06);
            border-radius: 12px;
            transition: background .18s ease, transform .12s ease, border-color .18s ease;
            border: 1px solid transparent;
        }
        .vbm-bookmark-item:hover {
            background: rgba(255, 255, 255, 0.09);
            border-color: var(--vbm-border);
            transform: translateY(-1px);
        }
        .vbm-bookmark-item.auto-saved {
            background: linear-gradient(135deg, rgba(var(--vbm-accent), 0.12) 0%, rgba(118, 75, 162, 0.12) 100%);
            border: 1px solid rgba(var(--vbm-accent), 0.28);
        }
        .vbm-bookmark-item.vbm-filtered-out {
            display: none;
        }

        .vbm-bookmark-label {
            flex: 1;
            margin-right: 10px;
            font-size: 13px;
            color: var(--vbm-fore);
            cursor: pointer;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-shadow: 0 1px 1px rgba(0,0,0,.35);
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .vbm-bookmark-label .vbm-input {
            flex: 1 1 auto;
            min-width: 0;
        }
        .vbm-bookmark-time {
            color: var(--vbm-fore-muted);
            font-size: 12px;
            margin-left: 6px;
        }

        .vbm-bookmark-actions {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .vbm-icon-btn {
            width: 32px;
            height: 32px;
            padding: 0;
            border-radius: 10px;
            background: var(--vbm-surface);
            border: 1px solid var(--vbm-border);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform .12s ease, background .18s ease, box-shadow .18s ease;
            box-shadow: var(--vbm-shadow);
            -webkit-tap-highlight-color: transparent;
        }
        .vbm-icon-btn:hover {
            transform: translateY(-1px) scale(1.06);
            background: rgba(255, 255, 255, 0.08);
        }
        .vbm-icon-btn:active {
            transform: translateY(0) scale(0.98);
        }
        .vbm-icon-btn:focus-visible {
            outline: none;
            box-shadow: 0 0 0 3px rgba(var(--vbm-accent), 0.25), var(--vbm-shadow);
        }
        .vbm-icon-btn i {
            font-size: 14px;
            color: var(--vbm-fore);
        }

        .vbm-input {
            width: 100%;
            padding: 12px 14px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid var(--vbm-border);
            border-radius: 10px;
            color: var(--vbm-fore);
            font-size: 14px;
            outline: none;
            transition: box-shadow .18s ease, border-color .18s ease, background .18s ease;
            margin-bottom: 16px;
            font-family: inherit;
            text-shadow: 0 1px 1px rgba(0,0,0,.35);
            caret-color: var(--vbm-fore);
        }
        .vbm-input-inline {
            margin: 0;
            padding: 8px 10px;
            font-size: 13px;
        }
        .vbm-input:focus {
            background: rgba(255, 255, 255, 0.08);
            border-color: var(--vbm-border-strong);
            box-shadow: 0 0 0 3px rgba(var(--vbm-accent), 0.22);
        }
        .vbm-input::placeholder {
            color: var(--vbm-fore-muted);
        }

        .vbm-btn {
            padding: 10px 18px;
            border-radius: 10px;
            border: 1px solid var(--vbm-border);
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: transform .12s ease, box-shadow .18s ease, background .18s ease;
            outline: none;
            font-family: inherit;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap;
            background: var(--vbm-surface);
            color: var(--vbm-fore);
            backdrop-filter: blur(var(--vbm-blur)) saturate(var(--vbm-saturate));
            -webkit-backdrop-filter: blur(var(--vbm-blur)) saturate(var(--vbm-saturate));
            box-shadow: var(--vbm-shadow);
            text-shadow: 0 1px 1px rgba(0,0,0,.35);
        }
        .vbm-btn i {
            font-size: 16px;
            color: var(--vbm-fore);
        }
        .vbm-btn:hover {
            transform: translateY(-1px);
            background: rgba(255, 255, 255, 0.08);
        }
        .vbm-btn:active {
            transform: translateY(0);
        }

        .vbm-message {
            position: absolute;
            top: 50%;
            right: 58px;
            background: linear-gradient(135deg, var(--vbm-surface), var(--vbm-surface-2));
            backdrop-filter: blur(var(--vbm-blur)) saturate(var(--vbm-saturate));
            -webkit-backdrop-filter: blur(var(--vbm-blur)) saturate(var(--vbm-saturate));
            border: 1px solid var(--vbm-border);
            border-radius: 10px;
            padding: 10px 12px;
            color: var(--vbm-fore);
            font-size: 13px;
            font-weight: 500;
            box-shadow: var(--vbm-shadow);
            opacity: 0;
            transform: translate(0, -50%) scale(0.94);
            transition: opacity .18s ease, transform .18s ease;
            pointer-events: none;
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            text-shadow: 0 1px 1px rgba(0,0,0,.35);
        }
        .vbm-message.show {
            opacity: 1;
            transform: translate(0, -50%) scale(1);
        }
        .vbm-message i {
            font-size: 16px;
            color: var(--vbm-fore);
        }

        .vbm-empty-state {
            text-align: center;
            padding: 32px 20px;
            color: var(--vbm-fore-muted);
            font-size: 14px;
        }
        .vbm-empty-state i {
            font-size: 24px;
            color: var(--vbm-fore);
            margin-bottom: 12px;
            display: block;
        }

        .vbm-export-import {
            display: flex;
            gap: 10px;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid var(--vbm-border);
            align-items: center;
        }

        .vbm-restore-prompt {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, var(--vbm-surface), var(--vbm-surface-2));
            backdrop-filter: blur(16px) saturate(var(--vbm-saturate));
            -webkit-backdrop-filter: blur(16px) saturate(var(--vbm-saturate));
            border: 1px solid var(--vbm-border);
            border-radius: var(--vbm-radius);
            padding: 24px;
            box-shadow: 0 18px 44px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255,255,255,.06);
            z-index: 2147483648;
            max-width: 460px;
            color: var(--vbm-fore);
            animation: slideDown 0.18s ease;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
            text-shadow: 0 1px 1px rgba(0,0,0,.35);
        }
        .vbm-restore-prompt i {
            font-size: 20px;
            color: var(--vbm-fore);
        }
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translate(-50%, calc(-50% - 16px));
            }
            to {
                opacity: 1;
                transform: translate(-50%, -50%);
            }
        }
        .vbm-restore-prompt h3 {
            margin: 0 0 14px 0;
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .vbm-restore-prompt p {
            margin: 0 0 20px 0;
            font-size: 14px;
            opacity: 0.85;
            line-height: 1.5;
        }

        .vbm-button-group {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }

        .vbm-clear-all-prompt {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, var(--vbm-surface), var(--vbm-surface-2));
            backdrop-filter: blur(var(--vbm-blur)) saturate(var(--vbm-saturate));
            -webkit-backdrop-filter: blur(var(--vbm-blur)) saturate(var(--vbm-saturate));
            border: 1px solid var(--vbm-border);
            border-radius: var(--vbm-radius);
            box-shadow: 0 18px 44px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255,255,255,.06);
            z-index: 2147483647;
            min-width: 320px;
            max-width: min(92vw, 460px);
            padding: 24px;
            color: var(--vbm-fore);
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
            text-shadow: 0 1px 1px rgba(0,0,0,.35);
            opacity: 0;
            scale: 0.95;
            transition: opacity 0.2s ease, scale 0.2s ease;
        }
        .vbm-clear-all-prompt.show {
            opacity: 1;
            scale: 1;
        }
        .vbm-clear-all-prompt i {
            font-size: 20px;
            color: var(--vbm-fore);
        }
        .vbm-clear-all-prompt h3 {
            margin: 0 0 14px 0;
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
            color: rgba(255,107,107,0.9);
        }
        .vbm-clear-all-prompt p {
            margin: 0 0 20px 0;
            font-size: 14px;
            opacity: 0.85;
            line-height: 1.5;
        }

        .vbm-github-config-prompt {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, var(--vbm-surface), var(--vbm-surface-2));
            backdrop-filter: blur(var(--vbm-blur)) saturate(var(--vbm-saturate));
            -webkit-backdrop-filter: blur(var(--vbm-blur)) saturate(var(--vbm-saturate));
            border: 1px solid var(--vbm-border);
            border-radius: var(--vbm-radius);
            box-shadow: 0 18px 44px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255,255,255,.06);
            z-index: 2147483648;
            width: min(90vw, 400px);
            max-width: 400px;
            padding: 20px;
            color: var(--vbm-fore);
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
            text-shadow: 0 1px 1px rgba(0,0,0,.35);
            opacity: 0;
            scale: 0.95;
            transition: opacity 0.2s ease, scale 0.2s ease;
        }
        .vbm-github-config-prompt::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: -1;
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        .vbm-github-config-prompt.show::before {
            opacity: 1;
        }
        .vbm-github-config-prompt.show {
            opacity: 1;
            scale: 1;
        }
        .vbm-github-config-prompt i {
            font-size: 20px;
            color: var(--vbm-fore);
        }
        .vbm-github-config-prompt h3 {
            margin: 0 0 14px 0;
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--vbm-fore);
        }
        .vbm-github-config-prompt p {
            margin: 0 0 18px 0;
            font-size: 14px;
            opacity: 0.85;
            line-height: 1.5;
        }
        .vbm-form-group {
            margin-bottom: 18px;
        }
        .vbm-form-label {
            display: block;
            margin-bottom: 8px;
            font-size: 13px;
            font-weight: 500;
            color: var(--vbm-fore);
            opacity: 0.9;
        }
        .vbm-help-text {
            font-size: 11px;
            color: var(--vbm-fore-muted);
            margin-top: 5px;
            line-height: 1.4;
            opacity: 0.8;
        }
        .vbm-help-link {
            color: rgba(var(--vbm-accent), 0.8);
            text-decoration: none;
            font-weight: 500;
        }
        .vbm-help-link:hover {
            color: rgba(var(--vbm-accent), 1);
            text-decoration: underline;
        }

        /* Fullscreen adjustments */
        video:fullscreen ~ .vbm-container,
        video:-webkit-full-screen ~ .vbm-container {
            position: fixed !important;
        }

        /* Responsive styles */
        .vbm-panel {
            width: min(92vw, 340px);
            max-height: min(70vh, 520px);
        }

        @media (max-width: 600px) {
            .vbm-container { font-size: 13px; }
            .vbm-clock-btn { width: 38px; height: 38px; }
            .vbm-clock-btn i { font-size: 16px; }
            .vbm-panel {
                padding: 16px;
                width: min(94vw, 340px);
                max-height: min(65vh, 500px);
            }
            .vbm-panel-title { font-size: 15px; }
            .vbm-icon-btn { width: 30px; height: 30px; }
            .vbm-icon-btn i { font-size: 12px; }
            .vbm-btn {
                padding: 9px 14px;
                gap: 6px;
                font-size: 13px;
            }
            .vbm-btn i { font-size: 14px; }
            .vbm-bookmark-item { padding: 10px; }
            .vbm-bookmark-list { max-height: none; }

            .vbm-fullscreen-hint {
                font-size: 12px;
                padding: 10px 14px;
                right: 50px;
                gap: 6px;
            }
            .vbm-fullscreen-hint i {
                font-size: 14px;
            }
        }

        @media (max-width: 380px) {
            .vbm-panel { width: calc(100vw - 24px); }
        }

        /* Bottom-sheet layout on small screens */
        @media (max-width: 600px) {
            .vbm-container .vbm-panel {
                position: fixed;
                left: max(8px, env(safe-area-inset-left, 8px));
                right: max(8px, env(safe-area-inset-right, 8px));
                bottom: calc(10px + env(safe-area-inset-bottom, 0px));
                top: auto;
                transform: none;
                width: auto;
                max-width: none;
                max-height: min(60dvh, 60svh, 420px);
                padding: 12px;
                border-radius: 12px;
                z-index: 2147483647;
            }
            .vbm-container .vbm-panel.active { transform: none; }
            .vbm-panel-header { margin-bottom: 10px; padding-bottom: 8px; }
            .vbm-bookmark-list {
                flex: 1 1 auto;
                min-height: 0;
                max-height: none;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
                padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
            }
        }

        /* Strong fullscreen overrides */
        :is(video:fullscreen, video:-webkit-full-screen) ~ .vbm-container .vbm-panel {
            position: absolute !important;
            top: 52px !important;
            left: auto !important;
            right: 0 !important;
            bottom: auto !important;
            transform: translateY(2px) scale(0.98) !important;
            width: min(92vw, 340px) !important;
            max-height: min(70vh, 520px) !important;
        }
        :is(video:fullscreen, video:-webkit-full-screen) ~ .vbm-container .vbm-panel.active {
            transform: translateY(0) scale(1) !important;
        }

        /* Clock button consistency in fullscreen */
        :is(video:fullscreen, video:-webkit-full-screen) ~ .vbm-container .vbm-clock-btn {
            width: 42px !important;
            height: 42px !important;
        }
        :is(video:fullscreen, video:-webkit-full-screen) ~ .vbm-container .vbm-clock-btn i {
            font-size: 18px !important;
        }
    `;

    // ==================== ICON MAPPINGS ====================
    const ICONS = {
        clock: 'fas fa-clock',
        bookmark: 'fas fa-bookmark',
        list: 'fas fa-list',
        play: 'fas fa-play',
        delete: 'fas fa-trash',
        export: 'fas fa-download',
        import: 'fas fa-upload',
        empty: 'fas fa-check-circle',
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle',
        refresh: 'fas fa-sync-alt',
        plus: 'fas fa-plus',
        edit: 'fas fa-edit',
        search: 'fas fa-search',
        fullscreen: 'fas fa-expand',
        sync: 'fas fa-sync',
        github: 'fab fa-github',
        settings: 'fas fa-cog'
    };

    // ==================== SYNC PROVIDER ====================
    class GitHubSync {
        constructor(config = {}) {
            this.token = config.token || '';
            this.repo = config.username && config.repository ? `${config.username}/${config.repository}` : '';
            this.branch = 'main';
            this.filePath = 'video-bookmarks.json';
            this.apiBase = 'https://api.github.com';
            this.isInitialized = false;
        }

        async initialize() {
            try {
                if (!this.token || !this.repo) {
                    throw new Error('GitHub credentials not configured');
                }

                const response = await fetch(`${this.apiBase}/repos/${this.repo}`, {
                    headers: { 'Authorization': `token ${this.token}` }
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error('Invalid GitHub token');
                    } else if (response.status === 404) {
                        throw new Error(`Repository "${this.repo}" not found`);
                    } else {
                        throw new Error(`GitHub API error: ${response.statusText}`);
                    }
                }

                this.isInitialized = true;
            } catch (error) {
                throw error;
            }
        }

        async getAllData() {
            try {
                const response = await fetch(
                    `${this.apiBase}/repos/${this.repo}/contents/${this.filePath}`,
                    {
                        headers: {
                            'Authorization': `token ${this.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );

                if (response.status === 404) {
                    return {};
                }

                if (!response.ok) {
                    throw new Error(`Failed to get file: ${response.statusText}`);
                }

                const fileData = await response.json();
                const content = atob(fileData.content);
                return JSON.parse(content);
            } catch (error) {
                return {};
            }
        }

        async saveAllData(data) {
            try {
                const content = btoa(JSON.stringify(data, null, 2));

                let sha = null;
                try {
                    const existing = await fetch(
                        `${this.apiBase}/repos/${this.repo}/contents/${this.filePath}`,
                        {
                            headers: {
                                'Authorization': `token ${this.token}`,
                                'Accept': 'application/vnd.github.v3+json'
                            }
                        }
                    );
                    if (existing.ok) {
                        const fileData = await existing.json();
                        sha = fileData.sha;
                    }
                } catch (e) {
                    // File doesn't exist yet
                }

                const response = await fetch(
                    `${this.apiBase}/repos/${this.repo}/contents/${this.filePath}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${this.token}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/vnd.github.v3+json'
                        },
                        body: JSON.stringify({
                            message: `Update video bookmarks - ${new Date().toISOString()}`,
                            content: content,
                            branch: this.branch,
                            ...(sha && { sha })
                        })
                    }
                );

                if (!response.ok) {
                    const errorData = await response.text();
                    throw new Error(`GitHub API error: ${response.statusText} - ${errorData}`);
                }
            } catch (error) {
                throw new Error('Failed to save to GitHub: ' + error.message);
            }
        }
    }

    // ==================== MAIN CLASS ====================
    class VideoBookmarkManager {
        constructor() {
            this.processedVideos = new WeakMap();
            this.activeVideo = null;
            this.container = null;
            this.autoSaveInterval = null;
            this.lastSavedTimes = new WeakMap();
            this.pendingEditId = null;
            this.uiByVideo = new WeakMap();
            this.videoByContainer = new WeakMap();
            this.hoveredVideo = null;
            this._hotkeyBound = false;
            this.hintTimeout = null;
            this.messageTimeout = null;

            this.preferences = {
                syncEnabled: false,
                lastSyncTime: 0,
                github: {
                    username: '',
                    repository: '',
                    token: ''
                }
            };

            this.syncState = {
                isInitialized: false,
                isSyncing: false,
                lastError: null
            };

            this.init();
        }

        getActiveContainer() {
            return this.uiByVideo.get(this.activeVideo) || this.container || null;
        }

        async init() {
            // Load Font Awesome
            try {
                await loadFontAwesome();
            } catch (error) {
                console.warn('Failed to load Font Awesome:', error);
            }

            // Inject styles
            try {
                if (typeof GM !== 'undefined' && typeof GM.addStyle === 'function') {
                    GM.addStyle(STYLES);
                } else {
                    this.injectStyle(STYLES);
                }
            } catch (_) {
                this.injectStyle(STYLES);
            }

            await this.loadPreferences();
            await this.initializeSync();
            this.setupMenuCommands();
            this.observeVideos();
            this.scanExistingVideos();

            if (!this._hotkeyBound) {
                this._hotkeyBound = true;
                document.addEventListener('keydown', (e) => this.handleKeydown(e));
            }
        }

        injectStyle(css) {
            try {
                const style = document.createElement('style');
                style.type = 'text/css';
                style.textContent = css;
                (document.head || document.documentElement).appendChild(style);
            } catch (_) { /* ignore */ }
        }

        // ==================== PREFERENCES ====================
        async loadPreferences() {
            try {
                const stored = await GM.getValue(CONFIG.PREFS_KEY, null);
                if (stored && typeof stored === 'object') {
                    this.preferences = { ...this.preferences, ...stored };
                }
            } catch (e) {
                this.log('Failed to load preferences:', e);
            }
        }

        async savePreferences() {
            try {
                await GM.setValue(CONFIG.PREFS_KEY, this.preferences);
            } catch (e) {
                this.log('Failed to save preferences:', e);
            }
        }

        // ==================== SYNC ====================
        async initializeSync() {
            if (this.syncState.isInitialized) return;

            try {
                await this.loadPreferences();

                if (this.preferences.syncEnabled) {
                    await this.setupSyncProvider();
                }

                this.syncState.isInitialized = true;
            } catch (error) {
                this.log('Sync initialization failed:', error);
                this.syncState.lastError = error.message;
            }
        }

        async setupSyncProvider() {
            this.syncProvider = new GitHubSync(this.preferences.github);
            await this.syncProvider.initialize();
        }

        async performSync() {
            if (this.syncState.isSyncing) return;

            try {
                this.syncState.isSyncing = true;
                this.showMessage('Syncing bookmarks...', 'sync');

                const allKeys = await GM.listValues();
                const bookmarkKeys = allKeys.filter(key => key.startsWith(CONFIG.SCRIPT_PREFIX));

                const localData = {};
                for (const key of bookmarkKeys) {
                    try {
                        const data = await GM.getValue(key);
                        if (data) {
                            localData[key] = {
                                data: data,
                                lastModified: Date.now()
                            };
                        }
                    } catch (error) {
                        this.log('Error reading local key:', key, error);
                    }
                }

                const remoteData = await this.syncProvider.getAllData();
                const mergedData = { ...remoteData, ...localData };

                await this.syncProvider.saveAllData(mergedData);

                for (const [key, entry] of Object.entries(remoteData)) {
                    if (!localData[key] || entry.lastModified > localData[key].lastModified) {
                        await GM.setValue(key, entry.data);
                    }
                }

                this.preferences.lastSyncTime = Date.now();
                await this.savePreferences();

                this.showMessage('Sync completed successfully!', 'success');

            } catch (error) {
                this.log('Sync failed:', error);
                this.syncState.lastError = error.message;
                this.showMessage('Sync failed: ' + error.message, 'error');
            } finally {
                this.syncState.isSyncing = false;
            }
        }

        // ==================== DATA METHODS ====================
        migrateBookmarkData(data) {
            if (!data || typeof data !== 'object') {
                return {
                    url: window.location.href,
                    title: document.title,
                    bookmarks: [],
                    schemaVersion: CONFIG.SCHEMA_VERSION
                };
            }

            if (!Array.isArray(data.bookmarks)) {
                data.bookmarks = [];
            }

            data.bookmarks = data.bookmarks.map(bookmark => {
                const migrated = { ...bookmark };

                if (typeof migrated.timestamp !== 'number') migrated.timestamp = 0;
                if (typeof migrated.label !== 'string') migrated.label = this.formatTime(migrated.timestamp);
                if (typeof migrated.createdAt !== 'number') migrated.createdAt = Date.now();

                return migrated;
            });

            data.bookmarks.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            data.schemaVersion = CONFIG.SCHEMA_VERSION;

            return data;
        }

        mkKey(keySeed) {
            const digest = this.hashString(String(keySeed));
            return `${CONFIG.SCRIPT_PREFIX}${digest}`;
        }

        createUrlOnlyKey(pageUrl) {
            const urlPart = CONFIG.USE_IDENTICAL_URL_IN_KEY
                ? String(pageUrl)
                : this.normalizeUrl(pageUrl, {
                    preserveHash: CONFIG.PRESERVE_HASH_IN_KEY,
                    stripAllQuery: CONFIG.STRIP_QUERY_PARAMS_IN_KEY,
                    keepParams: CONFIG.KEEP_QUERY_PARAMS_IN_KEY
                  });
            const keySeed = `url:${urlPart}`;
            return this.mkKey(keySeed);
        }

        createStorageKey(video) {
            const pageUrl = CONFIG.USE_IDENTICAL_URL_IN_KEY
                ? String(window.location.href)
                : this.normalizeUrl(window.location.href, {
                    preserveHash: CONFIG.PRESERVE_HASH_IN_KEY,
                    stripAllQuery: CONFIG.STRIP_QUERY_PARAMS_IN_KEY,
                    keepParams: CONFIG.KEEP_QUERY_PARAMS_IN_KEY
                  });

            if (CONFIG.KEY_SCOPE === 'perUrl') {
                return this.createUrlOnlyKey(pageUrl);
            }

            const duration = Math.round(video?.duration || 0);
            const vw = Math.round(video?.videoWidth || 0);
            const vh = Math.round(video?.videoHeight || 0);

            const rawSrc = (video?.currentSrc || video?.src || '').trim();
            const videoSrc = rawSrc.split('?')[0].split('#')[0];

            if (videoSrc && !videoSrc.startsWith('blob:')) {
                const normSrc = this.normalizeUrl(videoSrc, {
                    stripAllQuery: CONFIG.STRIP_QUERY_PARAMS_IN_KEY,
                    keepParams: CONFIG.KEEP_QUERY_PARAMS_IN_KEY
                });
                const keySeed = `${pageUrl}|src:${normSrc}|d=${duration}|s=${vw}x${vh}`;
                return this.mkKey(keySeed);
            }

            const extras = [];
            const nearbyId = this.findNearbyVideoId(video);
            if (nearbyId) extras.push(nearbyId);
            const domPath = this.getDomPath(video);
            if (domPath) extras.push(`path:${domPath}`);

            const allVideos = Array.from(document.querySelectorAll('video'));
            const videoIndex = Math.max(0, allVideos.indexOf(video));
            extras.push(`i:${videoIndex}`);

            const keySeed = `${pageUrl}|${extras.join('|')}|d=${duration}|s=${vw}x${vh}`;
            return this.mkKey(keySeed);
        }

        async getBookmarks(video) {
            const key = this.createStorageKey(video);
            const data = await GM.getValue(key, null);
            return this.migrateBookmarkData(data);
        }

        async saveBookmarks(video, data) {
            const key = this.createStorageKey(video);
            const migratedData = this.migrateBookmarkData(data);
            migratedData.lastModified = Date.now();
            await GM.setValue(key, migratedData);
        }

        // ==================== AUTO-SAVE ====================
        async saveAutoBookmark(video) {
            const ct = video.currentTime;
            if (ct < 5 || ct > video.duration - 10) return;

            const last = this.lastSavedTimes.get(video) || 0;
            if (Math.abs(ct - last) < 1) return;

            const data = await this.getBookmarks(video);
            const autoSaveIndex = data.bookmarks.findIndex(b => b.isAutoSave);

            const autoBookmark = {
                timestamp: ct,
                label: CONFIG.AUTO_SAVE_LABEL,
                isAutoSave: true,
                createdAt: Date.now()
            };

            if (autoSaveIndex !== -1) {
                data.bookmarks[autoSaveIndex] = autoBookmark;
            } else {
                data.bookmarks.push(autoBookmark);
            }

            await this.saveBookmarks(video, data);
            this.lastSavedTimes.set(video, ct);
            this.log('Auto-saved at', ct);
        }

        startAutoSave(video) {
            if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);

            this.autoSaveInterval = setInterval(() => {
                if (!video.paused && video.currentTime > 0) {
                    this.saveAutoBookmark(video);
                }
            }, CONFIG.AUTO_SAVE_INTERVAL);
        }

        stopAutoSave() {
            if (this.autoSaveInterval) {
                clearInterval(this.autoSaveInterval);
                this.autoSaveInterval = null;
            }
        }

        // ==================== UI CREATION ====================
        createUI(video) {
            if (this.uiByVideo.has(video)) return;

            const container = document.createElement('div');
            container.className = 'vbm-container';

            const clockBtn = document.createElement('button');
            clockBtn.className = 'vbm-clock-btn';
            clockBtn.innerHTML = `<i class="${ICONS.clock}"></i>`;
            clockBtn.title = 'Video Bookmarks';

            const fullscreenHint = document.createElement('div');
            fullscreenHint.className = 'vbm-fullscreen-hint';
            fullscreenHint.innerHTML = `<i class="${ICONS.fullscreen}"></i><span>Enter fullscreen</span>`;

            const panelContainer = document.createElement('div');
            panelContainer.className = 'vbm-panel-container';

            const messageContainer = document.createElement('div');
            messageContainer.className = 'vbm-message';

            container.appendChild(clockBtn);
            container.appendChild(fullscreenHint);
            container.appendChild(panelContainer);
            container.appendChild(messageContainer);

            this.uiByVideo.set(video, container);
            this.videoByContainer.set(container, video);
            this.container = container;

            clockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.activeVideo = video;

                const isMobile = window.innerWidth <= 600;
                const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);

                if (isMobile && !isFullscreen) {
                    this.showFullscreenHint(container);
                } else {
                    this.toggleMenu();
                }
            });

            this.positionUI(video);
            video.addEventListener('click', () => this.closeAll());
        }

        getOverlayParent(video) {
            try {
                const fe = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
                if (fe && (fe === video || fe.contains?.(video))) return fe;
            } catch (_) { /* ignore */ }
            return document.body;
        }

        positionUI(video) {
            const container = this.uiByVideo.get(video);
            if (!video || !container) return;

            const desiredParent = this.getOverlayParent(video);
            if (container.parentElement !== desiredParent) {
                try { desiredParent.appendChild(container); } catch (_) {}
            }

            const MARGIN = 16;
            const reposition = () => {
                try {
                    const p = this.getOverlayParent(video);
                    if (container.parentElement !== p) {
                        try { p.appendChild(container); } catch (_) {}
                    }

                    const clockBtn = container.querySelector('.vbm-clock-btn');
                    const btnRect = clockBtn ? clockBtn.getBoundingClientRect() : { width: 42, height: 42 };
                    const BTN_SIZE = Math.max(btnRect.width, btnRect.height);

                    const rect = video.getBoundingClientRect();
                    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
                    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
                    let top = rect.top + MARGIN;
                    let left = rect.right - MARGIN - BTN_SIZE;

                    top = Math.max(0, Math.min(top, vh - BTN_SIZE - MARGIN));
                    left = Math.max(0, Math.min(left, vw - BTN_SIZE - MARGIN));

                    container.style.position = 'fixed';
                    container.style.top = `${top}px`;
                    container.style.left = `${left}px`;
                    container.style.right = 'auto';
                    container.style.bottom = 'auto';
                    container.style.zIndex = '2147483647';
                } catch (_) { /* ignore */ }
            };

            reposition();

            if (!this._repositionHandlers) this._repositionHandlers = new WeakMap();
            if (!this._repositionHandlers.get(video)) {
                let raf = null;
                const onMove = () => {
                    if (raf) cancelAnimationFrame(raf);
                    raf = requestAnimationFrame(reposition);
                };
                window.addEventListener('scroll', onMove, true);
                window.addEventListener('resize', onMove);
                this._repositionHandlers.set(video, onMove);
            }
        }

        // ==================== MENU & PANELS ====================
        toggleMenu() {
            const container = this.getActiveContainer();
            if (!container) return;
            const clockBtn = container.querySelector('.vbm-clock-btn');
            const panelHost = container.querySelector('.vbm-panel-container');
            const isOpen = !!panelHost?.querySelector('.vbm-panel');

            if (isOpen) {
                this.closeAll();
            } else {
                this.showPanel('list');
                clockBtn?.classList.add('active');
            }
        }

        showFullscreenHint(container) {
            const hint = container.querySelector('.vbm-fullscreen-hint');
            if (!hint) return;

            if (this.hintTimeout) {
                clearTimeout(this.hintTimeout);
            }

            hint.classList.add('show');

            this.hintTimeout = setTimeout(() => {
                hint.classList.remove('show');
            }, 3000);
        }

        async showPanel(type) {
            const container = this.getActiveContainer();
            if (!container) return;

            const mappedVideo = this.videoByContainer.get(container);
            if (mappedVideo) this.activeVideo = mappedVideo;

            const panelHost = container.querySelector('.vbm-panel-container');
            const panelClass = 'vbm-panel--list';
            let panel = panelHost.querySelector(`.vbm-panel.${panelClass}`);

            if (!panel) {
                panel = document.createElement('div');
                panel.className = `vbm-panel active ${panelClass}`;
                panelHost.appendChild(panel);
            } else {
                panel.classList.add('active');
            }

            panel.innerHTML = await this.getBookmarkListPanel();
            this.setupBookmarkListHandlers(panel);
        }

        showMessage(text, iconKey = 'info') {
            const container = this.getActiveContainer();
            const message = container?.querySelector('.vbm-message');
            if (!message) return;

            const iconClass = ICONS[iconKey] || ICONS.info;
            message.innerHTML = `<i class="${iconClass}"></i><span>${text}</span>`;
            message.classList.add('show');

            clearTimeout(this.messageTimeout);
            this.messageTimeout = setTimeout(() => {
                message.classList.remove('show');
            }, 3000);
        }

        closeAll() {
            const container = this.getActiveContainer();
            const panelHost = container?.querySelector('.vbm-panel-container');
            const clockBtn = container?.querySelector('.vbm-clock-btn');
            if (panelHost) panelHost.innerHTML = '';
            if (clockBtn) clockBtn.classList.remove('active');

            document.querySelectorAll('.vbm-panel-container').forEach(host => host.innerHTML = '');
            document.querySelectorAll('.vbm-clock-btn.active').forEach(btn => btn.classList.remove('active'));
        }

        // ==================== PANELS ====================
        async getBookmarkListPanel() {
            const data = await this.getBookmarks(this.activeVideo);
            const allBookmarks = data.bookmarks || [];

            const bookmarksWithIndices = allBookmarks.map((bookmark, originalIndex) => ({
                ...bookmark,
                originalIndex
            }));

            const autoSavedBookmarks = bookmarksWithIndices.filter(bookmark => bookmark.isAutoSave);
            const regularBookmarks = bookmarksWithIndices.filter(bookmark => !bookmark.isAutoSave);
            const bookmarks = [...autoSavedBookmarks, ...regularBookmarks];

            const searchSection = `
                <div class="vbm-search-container">
                    <i class="${ICONS.search}"></i>
                    <input class="vbm-search-input" type="text" placeholder="Search bookmarks..." data-action="search">
                </div>
            `;

            const actions = `
                <div class="vbm-header-actions">
                    <button class="vbm-icon-btn vbm-add" title="Add Bookmark"><i class="${ICONS.plus}"></i></button>
                    <button class="vbm-icon-btn vbm-sync" title="Sync Now"><i class="${ICONS.sync}"></i></button>
                    ${bookmarks.length > 0 ? `<button class="vbm-icon-btn vbm-clear-all" title="Clear All"><i class="${ICONS.delete}"></i></button>` : ''}
                </div>
            `;

            let html = `
                <div class="vbm-panel-header">
                    <span class="vbm-panel-title">
                        <i class="${ICONS.list}"></i>
                        Bookmarks
                    </span>
                    ${actions}
                </div>
                ${searchSection}
            `;

            if (bookmarks.length > 0) {
                html += '<div class="vbm-bookmark-list">';
                bookmarks.forEach((bookmark, index) => {
                    const isAutoSave = bookmark.isAutoSave;
                    const originalIndex = bookmark.originalIndex;

                    html += `
                        <div class="vbm-bookmark-item ${isAutoSave ? 'auto-saved' : ''}"
                             data-index="${originalIndex}"
                             data-id="${bookmark.createdAt}"
                             data-bookmark='${JSON.stringify(bookmark)}'
                             data-search-text="${this.escapeHtml(bookmark.label.toLowerCase())}">
                            <div class="vbm-bookmark-label" data-timestamp="${bookmark.timestamp}" data-label="${bookmark.label}">
                                ${this.escapeHtml(bookmark.label)}
                                <span class="vbm-bookmark-time">${this.formatTime(bookmark.timestamp)}</span>
                            </div>
                            <div class="vbm-bookmark-actions">
                                ${!isAutoSave ? `<button class="vbm-icon-btn rename" data-index="${originalIndex}" title="Rename"><i class="${ICONS.edit}"></i></button>` : ''}
                                <button class="vbm-icon-btn play" data-timestamp="${bookmark.timestamp}" title="Play"><i class="${ICONS.play}"></i></button>
                                <button class="vbm-icon-btn delete" data-index="${originalIndex}" title="Delete"><i class="${ICONS.delete}"></i></button>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            } else {
                html += `
                    <div class="vbm-empty-state">
                        <i class="${ICONS.empty}"></i>
                        <p>No bookmarks yet</p>
                    </div>
                `;
            }

            html += `
                <div class="vbm-export-import">
                    <button class="vbm-btn vbm-btn-secondary" data-action="export"><i class="${ICONS.export}"></i> <span>Export</span></button>
                    <button class="vbm-btn vbm-btn-secondary" data-action="import"><i class="${ICONS.import}"></i> <span>Import</span></button>
                </div>
            `;

            return html;
        }

        setupBookmarkListHandlers(panel) {
            // Search functionality
            const searchInput = panel.querySelector('[data-action="search"]');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase().trim();
                    const items = panel.querySelectorAll('.vbm-bookmark-item');
                    let visibleCount = 0;

                    items.forEach(item => {
                        const searchText = item.dataset.searchText || '';

                        if (!query || searchText.includes(query)) {
                            item.classList.remove('vbm-filtered-out');
                            visibleCount++;
                        } else {
                            item.classList.add('vbm-filtered-out');
                        }
                    });

                    this.handleSearchResults(panel, query, visibleCount);
                });
            }

            // Add bookmark button
            panel.querySelector('.vbm-add')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const t = this.activeVideo.currentTime;
                const defaultLabel = `Bookmark at ${this.formatTime(t)}`;
                const id = await this.addBookmark(defaultLabel);
                this.pendingEditId = id;
                this.showPanel('list');
                this.showMessage('Bookmark added', 'bookmark');
            });

            // Sync button - direct sync action
            panel.querySelector('.vbm-sync')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!this.preferences.syncEnabled) {
                    this.showSyncConfigDialog();
                } else {
                    await this.performSync();
                }
            });

            // Rename buttons
            panel.querySelectorAll('.rename').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const item = btn.closest('.vbm-bookmark-item');
                    const index = parseInt(item?.dataset.index || btn.dataset.index);
                    if (!isNaN(index) && item) this.startInlineEdit(item, index);
                });
            });

            // Play buttons
            panel.querySelectorAll('.play').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const timestamp = parseFloat(btn.dataset.timestamp);
                    this.activeVideo.currentTime = timestamp;
                    this.activeVideo.play();
                    this.showMessage('Jumping to bookmark', 'play');
                });
            });

            // Delete buttons
            panel.querySelectorAll('.delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const index = parseInt(btn.dataset.index);
                    await this.deleteBookmark(index);
                    this.showPanel('list');
                    this.showMessage('Bookmark deleted', 'delete');
                });
            });

            // Label clicks
            panel.querySelectorAll('.vbm-bookmark-label').forEach(label => {
                label.addEventListener('click', (e) => {
                    if (label.querySelector('input')) return;
                    e.stopPropagation();
                    const timestamp = parseFloat(label.dataset.timestamp);
                    this.activeVideo.currentTime = timestamp;
                    this.activeVideo.play();
                    this.showMessage('Jumping to bookmark', 'play');
                });
            });

            // Clear all button
            const deleteAllBtn = panel.querySelector('.vbm-clear-all');
            if (deleteAllBtn) {
                deleteAllBtn.addEventListener('click', async () => {
                    this.closeAll();
                    this.showClearAllPrompt();
                });
            }

            // Export/Import
            panel.querySelector('[data-action="export"]')?.addEventListener('click', () => {
                this.exportBookmarks('json');
            });
            panel.querySelector('[data-action="import"]')?.addEventListener('click', () => {
                this.importBookmarks();
            });

            // Focus pending edit
            if (this.pendingEditId) {
                const item = panel.querySelector(`.vbm-bookmark-item[data-id="${this.pendingEditId}"]`);
                if (item) {
                    const index = parseInt(item.dataset.index);
                    this.startInlineEdit(item, index);
                }
                this.pendingEditId = null;
            }
        }

        handleSearchResults(panel, query, visibleCount) {
            const existingSearchEmpty = panel.querySelector('.vbm-search-empty-state');
            if (existingSearchEmpty) {
                existingSearchEmpty.remove();
            }

            if (query && visibleCount === 0) {
                const bookmarksList = panel.querySelector('.vbm-bookmark-list');
                if (bookmarksList) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'vbm-search-empty-state';
                    emptyDiv.innerHTML = `
                        <div style="text-align: center; padding: 24px 16px; color: var(--vbm-fore-muted);">
                            <i class="${ICONS.search}" style="font-size: 16px; margin-bottom: 8px; display: block;"></i>
                            <p style="margin: 0; font-size: 13px;">No bookmarks match "${this.escapeHtml(query)}"</p>
                        </div>
                    `;
                    bookmarksList.appendChild(emptyDiv);
                }
            }
        }

        // ==================== PROMPTS ====================
        async checkAndPromptRestore(video) {
            const data = await this.getBookmarks(video);
            const autoSave = data.bookmarks.find(b => b.isAutoSave);

            if (autoSave && autoSave.timestamp > 5 && autoSave.timestamp < video.duration - 10) {
                this.showRestorePrompt(video, autoSave.timestamp);
            }
        }

        showRestorePrompt(video, timestamp) {
            document.querySelectorAll('.vbm-clock-btn.active').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.vbm-panel').forEach(panel => panel.remove());

            const existingPrompt = document.querySelector('.vbm-restore-prompt');
            if (existingPrompt) existingPrompt.remove();

            const prompt = document.createElement('div');
            prompt.className = 'vbm-restore-prompt';
            prompt.innerHTML = `
                <h3><i class="${ICONS.clock}"></i> <span>Resume Playback?</span></h3>
                <p>Continue from <strong>${this.formatTime(timestamp)}</strong>?</p>
                <div class="vbm-button-group">
                    <button class="vbm-btn vbm-btn-secondary" data-action="skip">Start Fresh</button>
                    <button class="vbm-btn vbm-btn-primary" data-action="restore">Resume</button>
                </div>
            `;

            this.getOverlayParent(video).appendChild(prompt);

            prompt.querySelector('[data-action="restore"]').addEventListener('click', async () => {
                video.currentTime = timestamp;
                prompt.remove();
                this.showMessage('Restored to saved position', 'success');
                if (video.paused) video.play();
            });

            prompt.querySelector('[data-action="skip"]').addEventListener('click', async () => {
                const data = await this.getBookmarks(video);
                const autoSaveIndex = data.bookmarks.findIndex(b => b.isAutoSave);
                if (autoSaveIndex !== -1) {
                    data.bookmarks.splice(autoSaveIndex, 1);
                    await this.saveBookmarks(video, data);
                }
                prompt.remove();
                this.showMessage('Starting fresh', 'refresh');
            });

            setTimeout(() => {
                if (prompt.parentElement) prompt.remove();
            }, 10000);
        }

        showClearAllPrompt() {
            document.querySelectorAll('.vbm-clock-btn.active').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.vbm-panel').forEach(panel => panel.remove());

            const existingPrompt = document.querySelector('.vbm-clear-all-prompt');
            if (existingPrompt) existingPrompt.remove();

            const prompt = document.createElement('div');
            prompt.className = 'vbm-clear-all-prompt';
            prompt.innerHTML = `
                <h3><i class="${ICONS.delete}"></i> <span>Clear All Bookmarks?</span></h3>
                <p>This will permanently delete <strong>all bookmarks</strong> for this video. This action cannot be undone.</p>
                <div class="vbm-button-group">
                    <button class="vbm-btn vbm-btn-secondary" data-action="cancel">Cancel</button>
                    <button class="vbm-btn vbm-btn-primary" data-action="confirm">Delete All</button>
                </div>
            `;

            (this.getActiveContainer() || document.body).appendChild(prompt);

            requestAnimationFrame(() => {
                prompt.classList.add('show');
            });

            prompt.querySelector('[data-action="confirm"]').addEventListener('click', async () => {
                await this.deleteAllBookmarks();
                prompt.remove();
                this.showMessage('All bookmarks cleared', 'delete');
            });

            prompt.querySelector('[data-action="cancel"]').addEventListener('click', () => {
                prompt.remove();
            });

            setTimeout(() => {
                if (prompt.parentElement) prompt.remove();
            }, 15000);

            const closeOnOutsideClick = (e) => {
                if (!prompt.contains(e.target)) {
                    prompt.remove();
                    document.removeEventListener('click', closeOnOutsideClick);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', closeOnOutsideClick);
            }, 100);
        }

        showSyncConfigDialog() {
            const username = prompt('Enter your GitHub username:', this.preferences.github.username || '');
            if (!username) return;

            const repository = prompt('Enter repository name:', this.preferences.github.repository || 'video-bookmarks');
            if (!repository) return;

            const token = prompt('Enter your GitHub Personal Access Token:\n(Create at github.com/settings/tokens with "repo" scope)', this.preferences.github.token || '');
            if (!token) return;

            // Save configuration and enable sync
            this.preferences.github = { username, repository, token };
            this.preferences.syncEnabled = true;
            this.savePreferences().then(async () => {
                try {
                    await this.setupSyncProvider();
                    await this.performSync();
                    this.showMessage('GitHub sync configured and synced!', 'success');
                } catch (error) {
                    this.preferences.syncEnabled = false;
                    await this.savePreferences();
                    this.showMessage('Sync setup failed: ' + error.message, 'error');
                }
            });
        }

        // ==================== BOOKMARK OPERATIONS ====================
        async addBookmark(label) {
            const data = await this.getBookmarks(this.activeVideo);
            const createdAt = Date.now();
            const bookmark = {
                timestamp: this.activeVideo.currentTime,
                label: label,
                isAutoSave: false,
                createdAt
            };
            data.bookmarks.push(bookmark);
            data.bookmarks.sort((a, b) => a.timestamp - b.timestamp);
            await this.saveBookmarks(this.activeVideo, data);
            return createdAt;
        }

        async deleteBookmark(index) {
            const data = await this.getBookmarks(this.activeVideo);
            if (data.bookmarks[index]) {
                data.bookmarks.splice(index, 1);
                await this.saveBookmarks(this.activeVideo, data);
            }
        }

        async deleteAllBookmarks() {
            const data = await this.getBookmarks(this.activeVideo);
            data.bookmarks = [];
            await this.saveBookmarks(this.activeVideo, data);
        }

        async renameBookmark(index, newLabel) {
            const data = await this.getBookmarks(this.activeVideo);
            if (data.bookmarks[index]) {
                data.bookmarks[index].label = newLabel;
                await this.saveBookmarks(this.activeVideo, data);
            }
        }

        startInlineEdit(item, index) {
            const labelDiv = item.querySelector('.vbm-bookmark-label');
            if (!labelDiv) return;

            const original = (labelDiv.dataset.label || '').trim();
            const timestamp = parseFloat(labelDiv.dataset.timestamp || '0');

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'vbm-input vbm-input-inline';
            input.value = original;

            labelDiv.innerHTML = '';
            labelDiv.appendChild(input);
            const timeSpan = document.createElement('span');
            timeSpan.className = 'vbm-bookmark-time';
            timeSpan.textContent = this.formatTime(timestamp);
            labelDiv.appendChild(timeSpan);

            setTimeout(() => { input.focus(); input.select(); }, 0);

            const commit = async () => {
                input.removeEventListener('blur', onBlur);
                input.removeEventListener('keydown', onKey);
                const val = input.value.trim();
                if (val && val !== original) {
                    await this.renameBookmark(index, val);
                    this.showPanel('list');
                    this.showMessage('Bookmark renamed', 'success');
                } else {
                    this.showPanel('list');
                }
            };

            const onBlur = () => commit();
            const onKey = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                else if (e.key === 'Escape') { e.preventDefault(); this.showPanel('list'); }
            };

            input.addEventListener('blur', onBlur);
            input.addEventListener('keydown', onKey);
        }

        // ==================== IMPORT/EXPORT ====================
        async exportBookmarks(format = 'json') {
            const allKeys = await GM.listValues();
            const bookmarkKeys = allKeys.filter(k => k.startsWith(CONFIG.SCRIPT_PREFIX));
            if (bookmarkKeys.length === 0) {
                this.showMessage('No bookmarks to export', 'error');
                return;
            }

            const exportData = {};
            for (const key of bookmarkKeys) {
                exportData[key] = await GM.getValue(key);
            }

            const dateStr = new Date().toISOString().split('T')[0];
            const content = JSON.stringify(exportData, null, 2);
            const filename = `video-bookmarks-${dateStr}.json`;

            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showMessage('Bookmarks exported', 'export');
        }

        importBookmarks() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    let count = 0;
                    for (const key in data) {
                        if (!key.startsWith(CONFIG.SCRIPT_PREFIX)) continue;
                        const incoming = data[key];
                        const existingData = await GM.getValue(key, null);
                        if (existingData) {
                            const merged = existingData;
                            if (incoming && typeof incoming === 'object') {
                                if (incoming.url) merged.url = incoming.url;
                                if (incoming.title) merged.title = incoming.title;
                            }
                            (incoming.bookmarks || []).forEach(newBookmark => {
                                const exists = merged.bookmarks?.some(b => Math.abs(b.timestamp - newBookmark.timestamp) < 1 && b.label === newBookmark.label);
                                if (!exists) merged.bookmarks.push(newBookmark);
                            });
                            merged.bookmarks.sort((a, b) => a.timestamp - b.timestamp);
                            await GM.setValue(key, merged);
                            if (CONFIG.KEY_SCOPE === 'perUrl') {
                                const urlKey = this.createUrlOnlyKey(merged.url || window.location.href);
                                await GM.setValue(urlKey, merged);
                            }
                        } else {
                            await GM.setValue(key, incoming);
                            if (CONFIG.KEY_SCOPE === 'perUrl') {
                                const urlKey = this.createUrlOnlyKey(incoming?.url || window.location.href);
                                await GM.setValue(urlKey, incoming);
                            }
                        }
                        count++;
                    }
                    this.showMessage(`Imported ${count} item(s)`, 'import');
                    this.showPanel('list');
                } catch (_) {
                    this.showMessage('Invalid file format', 'error');
                }
            });
            input.click();
        }

        // ==================== UTILITY METHODS ====================
        getDomPath(el) {
            try {
                if (!el) return '';
                const parts = [];
                let node = el;
                let depth = 0;
                const maxDepth = 12;
                while (node && depth < maxDepth) {
                    if (node.nodeType !== 1) {
                        const host = node.host;
                        node = host || null;
                        continue;
                    }
                    const tag = (node.tagName || '').toLowerCase();
                    if (!tag) break;
                    if (node.id) {
                        parts.unshift(`${tag}#${node.id}`);
                        break;
                    }
                    let idx = 1;
                    let sib = node.previousElementSibling;
                    while (sib) {
                        if (sib.tagName === node.tagName) idx++;
                        sib = sib.previousElementSibling;
                    }
                    parts.unshift(`${tag}:nth-of-type(${idx})`);
                    const parent = node.parentElement || (node.getRootNode && node.getRootNode().host) || null;
                    node = parent;
                    depth++;
                }
                return parts.join('>');
            } catch (_) {
                return '';
            }
        }

        normalizeUrl(input, options = {}) {
            const { preserveHash = false, stripAllQuery = false, keepParams = [] } = options;
            try {
                const url = new URL(input, window.location.href);
                if (!preserveHash) url.hash = '';

                if (stripAllQuery) {
                    if (Array.isArray(keepParams) && keepParams.length > 0) {
                        const kept = new URLSearchParams();
                        keepParams.forEach(k => {
                            const vals = url.searchParams.getAll(k);
                            vals.forEach(v => kept.append(k, v));
                        });
                        url.search = kept.toString() ? `?${kept.toString()}` : '';
                    } else {
                        url.search = '';
                    }
                } else {
                    const drop = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','igshid','si','spm','ref','ref_src','mkt_tok','fb_action_ids','fb_action_types','mc_cid','mc_eid'];
                    drop.forEach(p => url.searchParams.delete(p));
                    if ([...url.searchParams].length === 0) url.search = '';
                }

                url.hostname = url.hostname.toLowerCase();
                if (url.pathname !== '/' && url.pathname.endsWith('/')) {
                    url.pathname = url.pathname.slice(0, -1);
                }
                return url.toString();
            } catch (e) {
                if (preserveHash) {
                    return String(input).split('?')[0];
                }
                return String(input).split('#')[0].split('?')[0];
            }
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

        hashString(str) {
            let h1 = 0x811c9dc5;
            let h2 = 0x811c9dc5;
            for (let i = 0; i < str.length; i++) {
                h1 ^= str.charCodeAt(i);
                h1 += (h1 << 1) + (h1 << 4) + (h1 << 7) + (h1 << 8) + (h1 << 24);
            }
            for (let i = str.length - 1; i >= 0; i--) {
                h2 ^= str.charCodeAt(i);
                h2 += (h2 << 1) + (h2 << 4) + (h2 << 7) + (h2 << 8) + (h2 << 24);
            }
            const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
            const part3 = (h1 ^ h2) >>> 0;
            const part4 = ((h1 << 5) ^ (h2 >>> 7)) >>> 0;
            return (hex(h1) + hex(h2) + hex(part3) + hex(part4)).slice(0, 32);
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        log(...args) {
            if (CONFIG.DEBUG) {
                try { console.log('[VBM]', ...args); } catch (_) {}
            }
        }

        handleKeydown(e) {
            try {
                if (!e) return;
                if (e.defaultPrevented) return;
                if (e.ctrlKey || e.metaKey || e.altKey) return;
                const t = e.target;
                const tag = (t && t.tagName ? t.tagName : '').toLowerCase();
                if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
                const key = (e.key || e.code || '').toLowerCase();
                const k = key.length === 1 ? key : key.replace('key', '');
                if (k !== 'b') return;
                const video = this.hoveredVideo;
                if (!video) return;

                if (!this.uiByVideo.get(video)) {
                    this.createUI(video);
                }
                this.activeVideo = video;
                const container = this.uiByVideo.get(video);
                const panelHost = container?.querySelector('.vbm-panel-container');
                const isOpen = !!panelHost?.querySelector('.vbm-panel');
                if (!isOpen) {
                    this.showPanel('list');
                    container.querySelector('.vbm-clock-btn')?.classList.add('active');
                }
                e.preventDefault();
                e.stopPropagation();
            } catch (_) { /* ignore */ }
        }

        // ==================== VIDEO HANDLING ====================
        async initVideo(video) {
            if (this.processedVideos.has(video) || (video.duration && video.duration < CONFIG.MIN_DURATION)) return;
            this.processedVideos.set(video, true);
            this.activeVideo = video;

            this.createUI(video);
            await this.checkAndPromptRestore(video);

            let playStarted = false;
            let lastUpdateTime = 0;
            video.addEventListener('play', () => {
                if (!playStarted) {
                    playStarted = true;
                    this.startAutoSave(video);
                }
            });
            video.addEventListener('pause', () => {
                this.saveAutoBookmark(video);
            });
            video.addEventListener('timeupdate', () => {
                const currentTime = Math.floor(video.currentTime);
                if (currentTime - lastUpdateTime >= 3) {
                    lastUpdateTime = currentTime;
                    if (!video.paused) this.saveAutoBookmark(video);
                }
            });
            video.addEventListener('ended', () => {
                this.stopAutoSave();
            });

            const onEnter = () => { this.hoveredVideo = video; };
            const onLeave = () => { if (this.hoveredVideo === video) this.hoveredVideo = null; };
            video.addEventListener('pointerenter', onEnter);
            video.addEventListener('pointerleave', onLeave);
            video.addEventListener('mouseenter', onEnter);
            video.addEventListener('mouseleave', onLeave);

            const fullscreenHandler = () => {
                setTimeout(() => this.positionUI(video), 100);
                document.querySelectorAll('.vbm-fullscreen-hint.show').forEach(hint => {
                    hint.classList.remove('show');
                });
            };
            document.addEventListener('fullscreenchange', fullscreenHandler);
            document.addEventListener('webkitfullscreenchange', fullscreenHandler);
        }

        handleVideoElement(video) {
            if (video.readyState >= 1) {
                this.initVideo(video);
            } else {
                video.addEventListener('loadedmetadata', () => this.initVideo(video), { once: true });
            }
        }

        findVideosDeep(root = document) {
            const found = new Set();
            const scanNode = (node) => {
                try {
                    if (!node) return;
                    if (node.querySelectorAll) {
                        node.querySelectorAll('video').forEach(v => found.add(v));
                        node.querySelectorAll('*').forEach(el => {
                            const sr = el.shadowRoot;
                            if (sr) scanNode(sr);
                        });
                    }
                    if (node.host && node.querySelectorAll) {
                        node.querySelectorAll('video').forEach(v => found.add(v));
                    }
                } catch (_) { /* ignore */ }
            };
            scanNode(root.body || root.documentElement || root);
            return Array.from(found);
        }

        observeVideos() {
            const processNode = (node) => {
                if (!node) return;
                try {
                    if (node.nodeType === 1) {
                        if (node.tagName === 'VIDEO') {
                            this.handleVideoElement(node);
                        }
                        if (node.querySelectorAll) {
                            node.querySelectorAll('video').forEach(v => this.handleVideoElement(v));
                            node.querySelectorAll('*').forEach(el => {
                                if (el.shadowRoot) {
                                    observeRoot(el.shadowRoot);
                                    this.findVideosDeep(el.shadowRoot).forEach(v => this.handleVideoElement(v));
                                }
                            });
                        }
                    }
                } catch (_) { /* ignore */ }
            };

            const observeRoot = (root) => {
                try {
                    const obs = new MutationObserver((mutations) => {
                        for (const m of mutations) {
                            m.addedNodes.forEach(n => processNode(n));
                        }
                    });
                    obs.observe(root, { childList: true, subtree: true });
                } catch (_) { /* ignore */ }
            };

            observeRoot(document);
            if (!this.rescanInterval) {
                this.rescanInterval = setInterval(() => this.scanExistingVideos(), 5000);
            }
        }

        scanExistingVideos() {
            try {
                this.findVideosDeep(document).forEach(v => this.handleVideoElement(v));
            } catch (_) { /* ignore */ }
        }

        findNearbyVideoId(video) {
            try {
                if (!video) return '';
                if (video.id) return `vid#${video.id}`;

                const dataAttrs = [
                    'data-video-id','data-id','data-key','data-guid','data-asset-id','data-stream-id','data-vod-id','data-episode-id','data-media-id'
                ];
                for (const a of dataAttrs) {
                    const val = video.getAttribute(a);
                    if (val) return `${a}:${val}`;
                }

                const poster = video.getAttribute('poster');
                if (poster) return `poster:${this.normalizeUrl(poster, { stripAllQuery: CONFIG.STRIP_QUERY_PARAMS_IN_KEY, keepParams: CONFIG.KEEP_QUERY_PARAMS_IN_KEY })}`;

                const source = video.querySelector('source[src]');
                if (source) return `source:${this.normalizeUrl(source.getAttribute('src'), { stripAllQuery: CONFIG.STRIP_QUERY_PARAMS_IN_KEY, keepParams: CONFIG.KEEP_QUERY_PARAMS_IN_KEY })}`;

                let parent = video.parentElement;
                for (let i = 0; i < 5 && parent; i++) {
                    if (parent.id) return `pid:${parent.id}`;
                    for (const a of dataAttrs) {
                        const val = parent.getAttribute?.(a);
                        if (val) return `${a}:${val}`;
                    }
                    parent = parent.parentElement;
                }

                const classes = Array.from(video.classList || []).slice(0, 3).join('.');
                const idx = Array.from(document.querySelectorAll('video')).indexOf(video);
                if (classes) return `cls:${classes}|i:${idx}`;
                return `i:${idx}`;
            } catch (_) {
                return '';
            }
        }

        // ==================== MENU COMMANDS ====================
        setupMenuCommands() {
            const register = (label, fn) => {
                try {
                    if (typeof GM !== 'undefined' && typeof GM.registerMenuCommand === 'function') {
                        GM.registerMenuCommand(label, fn);
                    } else if (typeof GM_registerMenuCommand === 'function') {
                        GM_registerMenuCommand(label, fn);
                    } else if (typeof window !== 'undefined' && typeof window.GM_registerMenuCommand === 'function') {
                        window.GM_registerMenuCommand(label, fn);
                    }
                } catch (_) { /* ignore */ }
            };

            register('⬇️ Export Bookmarks', () => this.exportBookmarks('json'));
            register('⬆️ Import Bookmarks', () => this.importBookmarks());
            register('⚙️ Configure GitHub Sync', () => this.showSyncConfigDialog());

            register('🗑️ Clear All Bookmarks', async () => {
                if (!confirm('Delete ALL video bookmarks? This cannot be undone.')) return;
                const allKeys = await GM.listValues();
                const bookmarkKeys = allKeys.filter(k => k.startsWith(CONFIG.SCRIPT_PREFIX));
                for (const key of bookmarkKeys) {
                    await GM.deleteValue(key);
                }
                alert(`Deleted ${bookmarkKeys.length} video(s) with bookmarks.`);
            });
        }
    }

    // ==================== INITIALIZATION ====================
    new VideoBookmarkManager();

})();
