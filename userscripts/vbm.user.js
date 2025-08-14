// ==UserScript==
// @name         Video Bookmark Manager
// @namespace    http://tampermonkey.net/
// @version      5.0.2
// @description  Streamlined video bookmark system with simplified UI and Font Awesome icons
// @author       Murtaza Salih
// @match        *://*/*
// @icon        data:image/svg+xml;base64, PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NDAgNjQwIj48IS0tIUZvbnQgQXdlc29tZSBGcmVlIDcuMC4wIGJ5IEBmb250YXdlc29tZSAtIGh0dHBzOi8vZm9udGF3ZXNvbWUuY29tIExpY2Vuc2UgLSBodHRwczovL2ZvbnRhd2Vzb21lLmNvbS9saWNlbnNlL2ZyZWUgQ29weXJpZ2h0IDIwMjUgRm9udGljb25zLCBJbmMuLS0+PHBhdGggZmlsbD0iIzc0QzBGQyIgZD0iTTMyMCAxMjhDNDI2IDEyOCA1MTIgMjE0IDUxMiAzMjBDNTEyIDQyNiA0MjYgNTEyIDMyMCA1MTJDMjU0LjggNTEyIDE5Ny4xIDQ3OS41IDE2Mi40IDQyOS43QzE1Mi4zIDQxNS4yIDEzMi4zIDQxMS43IDExNy44IDQyMS44QzEwMy4zIDQzMS45IDk5LjggNDUxLjkgMTA5LjkgNDY2LjRDMTU2LjEgNTMyLjYgMjMzIDU3NiAzMjAgNTc2QzQ2MS40IDU3NiA1NzYgNDYxLjQgNTc2IDMyMEM1NzYgMTc4LjYgNDYxLjQgNjQgMzIwIDY0QzIzNC4zIDY0IDE1OC41IDEwNi4xIDExMiAxNzAuN0wxMTIgMTQ0QzExMiAxMjYuMyA5Ny43IDExMiA4MCAxMTJDNjIuMyAxMTIgNDggMTI2LjMgNDggMTQ0TDQ4IDI1NkM0OCAyNzMuNyA2Mi4zIDI4OCA4MCAyODhMMTA0LjYgMjg4QzEwNS4xIDI4OCAxMDUuNiAyODggMTA2LjEgMjg4TDE5Mi4xIDI4OEMyMDkuOCAyODggMjI0LjEgMjczLjcgMjI0LjEgMjU2QzIyNC4xIDIzOC4zIDIwOS44IDIyNCAxOTIuMSAyMjRMMTUzLjggMjI0QzE4Ni45IDE2Ni42IDI0OSAxMjggMzIwIDEyOHpNMzQ0IDIxNkMzNDQgMjAyLjcgMzMzLjMgMTkyIDMyMCAxOTJDMzA2LjcgMTkyIDI5NiAyMDIuNyAyOTYgMjE2TDI5NiAzMjBDMjk2IDMyNi40IDI5OC41IDMzMi41IDMwMyAzMzdMMzc1IDQwOUMzODQuNCA0MTguNCAzOTkuNiA0MTguNCA0MDguOSA0MDlDNDE4LjIgMzk5LjYgNDE4LjMgMzg0LjQgNDA4LjkgMzc1LjFMMzQzLjkgMzEwLjFMMzQzLjkgMjE2eiIvPjwvc3ZnPg==
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
        AUTO_SAVE_INTERVAL: 10000,
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

    // SVG Icons Helper Function
    const createSVGIcon = (path, viewBox = '0 0 512 512') => {
        return `<svg viewBox="${viewBox}" style="width: 1em; height: 1em; fill: currentColor; vertical-align: -0.125em;">${path}</svg>`;
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
            /* Enhanced mobile scrolling */
            scroll-behavior: smooth;
            overscroll-behavior: contain;
        }
        .vbm-bookmark-list::-webkit-scrollbar { width: 10px; }
        .vbm-bookmark-list::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 6px; }
        .vbm-bookmark-list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.25); border-radius: 6px; }
        .vbm-bookmark-list::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.35); }

        .vbm-bookmark-item {
            display: grid;
            grid-template-columns: auto 1fr auto;
            align-items: center;
            gap: 10px;
            padding: 12px;
            margin-bottom: 10px;
            background: rgba(255, 255, 255, 0.06);
            border-radius: 12px;
            transition: background .18s ease, transform .12s ease, border-color .18s ease;
            border: 1px solid transparent;
            position: relative;
            /* Touch-friendly improvements */
            min-height: 44px; /* Apple's recommended minimum touch target */
            -webkit-tap-highlight-color: rgba(255, 255, 255, 0.1);
            touch-action: manipulation; /* Prevent double-tap zoom */
        }
        .vbm-bookmark-item:hover,
        .vbm-bookmark-item:active {
            background: rgba(255, 255, 255, 0.09);
            border-color: var(--vbm-border);
            transform: translateY(-1px);
        }

        /* Enhanced mobile touch states */
        @media (max-width: 600px) {
            .vbm-bookmark-item {
                min-height: 48px; /* Slightly larger on mobile */
                padding: 14px 12px;
                margin-bottom: 12px;
                border-radius: 12px;
            }

            .vbm-bookmark-item:active {
                background: rgba(255, 255, 255, 0.12);
                transform: scale(0.98);
                transition: all 0.1s ease;
            }

            /* Better touch feedback with ripple effect */
            .vbm-bookmark-item::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.05);
                border-radius: inherit;
                opacity: 0;
                transition: opacity 0.15s ease;
                pointer-events: none;
            }

            .vbm-bookmark-item:active::before {
                opacity: 1;
            }
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

        /* Enhanced mobile bookmark actions */
        @media (max-width: 600px) {
            .vbm-bookmark-actions {
                gap: 12px; /* More space between buttons on mobile */
                padding: 2px; /* Additional padding for easier touch */
            }

            /* Add haptic feedback simulation with better visual feedback */
            .vbm-bookmark-actions .vbm-icon-btn:active {
                transform: scale(0.88) !important;
                filter: brightness(1.1);
                box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
            }
        }

        .vbm-icon-btn {
            width: 32px;
            height: 32px;
            padding: 0;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(135, 206, 235, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform .12s ease, background .18s ease, box-shadow .18s ease;
            box-shadow:
                0 4px 12px rgba(0, 0, 0, 0.2),
                0 1px 4px rgba(135, 206, 235, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
            -webkit-tap-highlight-color: transparent;
            /* Touch-friendly improvements */
            touch-action: manipulation;
            min-width: 32px; /* Ensure minimum touch target */
            min-height: 32px;
        }
        .vbm-icon-btn:hover {
            transform: translateY(-1px) scale(1.06);
            background: rgba(135, 206, 235, 0.15);
            border-color: rgba(135, 206, 235, 0.4);
            box-shadow:
                0 6px 16px rgba(0, 0, 0, 0.25),
                0 2px 8px rgba(135, 206, 235, 0.2),
                inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }
        .vbm-icon-btn:active {
            transform: translateY(0) scale(0.98);
            background: rgba(135, 206, 235, 0.25);
        }
        .vbm-icon-btn:focus-visible {
            outline: none;
            box-shadow: 0 0 0 3px rgba(var(--vbm-accent), 0.25), var(--vbm-shadow);
        }
        .vbm-icon-btn i {
            font-size: 14px;
            color: var(--vbm-fore);
        }
        .vbm-icon-btn.inactive {
            opacity: 0.3;
            cursor: not-allowed;
            pointer-events: none;
        }
        .vbm-icon-btn.inactive i {
            color: rgba(var(--vbm-fore), 0.3);
        }

        /* Color tag system styles */
        .vbm-color-picker {
            position: fixed;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(135, 206, 235, 0.3);
            border-radius: 12px;
            padding: 16px;
            backdrop-filter: blur(40px);
            -webkit-backdrop-filter: blur(40px);
            box-shadow:
                0 8px 32px rgba(0, 0, 0, 0.4),
                0 2px 16px rgba(135, 206, 235, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
            z-index: 2147483648;
            opacity: 0;
            transform: translateY(10px) scale(0.95);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
        }

        .vbm-color-picker.active {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: auto;
        }

        .vbm-color-picker-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--vbm-fore);
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .vbm-color-options {
            display: flex;
            gap: 12px;
            flex-direction: column;
        }

        .vbm-color-option {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .vbm-color-option:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(135, 206, 235, 0.3);
            transform: translateY(-1px);
        }

        .vbm-color-dot {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 2px solid rgba(255, 255, 255, 0.2);
            flex-shrink: 0;
        }

        .vbm-color-dot.generic { background: rgba(255, 255, 255, 0.9); }
        .vbm-color-dot.important { background: #87CEEB; }
        .vbm-color-dot.alert { background: #FF4444; }

        .vbm-color-label {
            font-size: 13px;
            color: var(--vbm-fore);
            font-weight: 500;
        }

        /* Bookmark dot colors */
        .vbm-bookmark-dot.generic {
            background: rgba(255, 255, 255, 0.9) !important;
            border-color: rgba(0, 0, 0, 0.3) !important;
        }
        .vbm-bookmark-dot.important {
            background: #87CEEB !important;
            border-color: rgba(0, 0, 0, 0.3) !important;
            box-shadow: 0 0 8px rgba(135, 206, 235, 0.4) !important;
        }
        .vbm-bookmark-dot.alert {
            background: #FF4444 !important;
            border-color: rgba(0, 0, 0, 0.3) !important;
            box-shadow: 0 0 8px rgba(255, 68, 68, 0.4) !important;
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
        .vbm-device-info {
            display: block;
            font-size: 12px;
            opacity: 0.7;
            margin-top: 8px;
            margin-bottom: 16px;
            font-style: italic;
            color: var(--vbm-fore-2);
        }

        .vbm-button-group {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }

        .vbm-color-tag-prompt {
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
        .vbm-color-tag-prompt h3 {
            margin: 0 0 14px 0;
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .vbm-color-tag-prompt p {
            margin: 0 0 20px 0;
            font-size: 14px;
            opacity: 0.85;
            line-height: 1.5;
        }
        .vbm-color-button-group {
            display: flex;
            gap: 10px;
            justify-content: center;
        }
        .vbm-color-btn {
            padding: 12px 20px;
            border: none;
            border-radius: var(--vbm-radius);
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 100px;
            justify-content: center;
        }
        .vbm-color-btn.generic {
            background: linear-gradient(135deg, #6c757d, #5a6268);
            color: white;
        }
        .vbm-color-btn.important {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
        }
        .vbm-color-btn.alert {
            background: linear-gradient(135deg, #dc3545, #b02a37);
            color: white;
        }
        .vbm-color-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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

        /* Enhanced fullscreen timeline styles */
        :is(video:fullscreen, video:-webkit-full-screen) ~ .vbm-container .vbm-mini-timeline.vbm-timeline-above-controls {
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 12px 48px rgba(0, 0, 0, 0.8);
        }

        /* Mini Timeline Styles - Enhanced Glassmorphism */
        .vbm-mini-timeline {
            position: fixed;
            background: rgba(15, 23, 42, 0.15);
            border: 1px solid rgba(135, 206, 235, 0.3);
            border-radius: 16px;
            padding: 20px;
            backdrop-filter: blur(40px);
            -webkit-backdrop-filter: blur(40px);
            box-shadow:
                0 8px 32px rgba(0, 0, 0, 0.3),
                0 2px 16px rgba(135, 206, 235, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
            z-index: 2147483647;
            min-height: 100px;
            max-width: 500px;
            width: 480px;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            opacity: 0;
            transform: translateY(10px) scale(0.95);
        }

        .vbm-mini-timeline.vbm-timeline-above-controls {
            backdrop-filter: blur(45px);
            -webkit-backdrop-filter: blur(45px);
            border: 1px solid rgba(135, 206, 235, 0.4);
            background: rgba(15, 23, 42, 0.2);
            box-shadow:
                0 12px 48px rgba(0, 0, 0, 0.4),
                0 4px 24px rgba(135, 206, 235, 0.15),
                inset 0 1px 0 rgba(255, 255, 255, 0.15);
            animation: vbm-timeline-fade-in 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .vbm-mini-timeline.vbm-timeline-fade-out {
            animation: vbm-timeline-fade-out 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes vbm-timeline-fade-in {
            from {
                opacity: 0;
                transform: translateY(10px) scale(0.95);
            }
            to {
                opacity: 0.98;
                transform: translateY(0) scale(1);
            }
        }

        @keyframes vbm-timeline-fade-out {
            from {
                opacity: 0.98;
                transform: translateY(0) scale(1);
            }
            to {
                opacity: 0;
                transform: translateY(-10px) scale(0.95);
            }
        }

        .vbm-mini-timeline.vbm-timeline-above-controls .vbm-timeline-track {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 6px;
            height: 10px;
        }

        .vbm-mini-timeline.vbm-timeline-above-controls .vbm-timeline-progress {
            background: linear-gradient(90deg, #87ceeb, #4fc3f7);
            border-radius: 6px;
            box-shadow: 0 0 12px rgba(135, 206, 235, 0.5), 0 2px 8px rgba(79, 195, 247, 0.3);
        }

        .vbm-mini-timeline.vbm-timeline-above-controls .vbm-bookmark-dot {
            border: 2px solid rgba(0, 0, 0, 0.8);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.3);
        }

        .vbm-timeline-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vbm-border);
        }

        .vbm-timeline-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 600;
            color: var(--vbm-fore);
        }

        .vbm-timeline-actions {
            display: flex;
            gap: 8px;
        }

        .vbm-timeline-track {
            position: relative;
            height: 8px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            margin: 8px 0;
            cursor: pointer;
        }

        .vbm-timeline-progress {
            height: 100%;
            background: var(--vbm-accent);
            border-radius: 4px;
            transition: width 0.1s ease;
            position: relative;
        }

        .vbm-timeline-bookmarks {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
        }

        .vbm-bookmark-dot {
            position: absolute;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 12px;
            height: 12px;
            background: var(--vbm-fore);
            border: 2px solid var(--vbm-background);
            border-radius: 50%;
            cursor: pointer;
            pointer-events: auto;
            transition: all 0.2s ease;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .vbm-bookmark-dot:hover {
            transform: translate(-50%, -50%) scale(1.3);
            background: var(--vbm-accent);
            z-index: 10;
        }

        .vbm-timeline-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: var(--vbm-fore-muted);
            margin-top: 8px;
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
            .vbm-icon-btn {
                width: 38px; /* Larger for better mobile touch */
                height: 38px;
                min-width: 38px;
                min-height: 38px;
                border-radius: 12px;
            }
            .vbm-icon-btn i { font-size: 14px; }

            /* Enhanced mobile button interactions */
            .vbm-icon-btn:active {
                transform: scale(0.92) !important;
                background: rgba(255, 255, 255, 0.12) !important;
                transition: all 0.1s ease !important;
            }
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
            /* Mobile timeline styles */
            .vbm-mini-timeline {
                left: 4px;
                right: 4px;
                top: 48px;
                padding: 16px;
                border-radius: 12px;
                width: calc(100vw - 8px);
                max-width: calc(100vw - 8px);
            }

            .vbm-timeline-header {
                margin-bottom: 10px;
                padding-bottom: 6px;
            }

            .vbm-timeline-title {
                font-size: 13px;
            }

            .vbm-timeline-track {
                height: 10px;
                margin: 10px 0;
            }

            .vbm-bookmark-dot {
                width: 14px;
                height: 14px;
                border-width: 2px;
            }

            .vbm-bookmark-dot:hover,
            .vbm-bookmark-dot:active {
                transform: translate(-50%, -50%) scale(1.4);
            }

            .vbm-timeline-info {
                font-size: 11px;
                margin-top: 6px;
            }


        }

        @media (max-width: 380px) {
            .vbm-panel { width: calc(100vw - 24px); }
            .vbm-mini-timeline {
                left: 2px !important;
                right: 2px;
                width: calc(100vw - 4px) !important;
                max-width: calc(100vw - 4px) !important;
            }
        }

        /* Timeline positioning adjustments for mobile */
        @media (max-width: 600px) {
            .vbm-mini-timeline.vbm-timeline-above-controls {
                bottom: 80px !important; /* Higher position for mobile controls */
                left: 8px !important;
                width: calc(100vw - 16px) !important;
                max-width: calc(100vw - 16px) !important;
                padding: 8px;
                border-radius: 8px;
            }
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
                max-height: min(65dvh, 65svh, 480px); /* Slightly taller for better usability */
                padding: 14px; /* More padding for touch-friendly interface */
                border-radius: 16px; /* Larger radius for modern mobile feel */
                z-index: 2147483647;
                /* Enhanced mobile panel */
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
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
                /* Enhanced mobile scroll performance */
                will-change: scroll-position;
                scroll-behavior: smooth;
                overscroll-behavior: contain;
                transform: translateZ(0); /* Force GPU acceleration */
                /* Better touch scrolling momentum */
                -webkit-overflow-scrolling: touch;
            }


            /* Pull-to-refresh style visual indicator */
            .vbm-bookmark-list::before {
                content: '';
                position: sticky;
                top: -20px;
                left: 0;
                right: 0;
                height: 20px;
                background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%);
                pointer-events: none;
                z-index: 1;
            }

            /* Enhance scroll indicators on mobile */
            .vbm-bookmark-list::-webkit-scrollbar {
                width: 4px;
            }
            .vbm-bookmark-list::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 2px;
            }
            .vbm-bookmark-list::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.3);
                border-radius: 2px;
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
        clock: createSVGIcon('<path d="M232 120C232 106.7 242.7 96 256 96C269.3 96 280 106.7 280 120V243.2L365.3 300C376.3 307.4 379.3 322.3 371.9 333.3C364.5 344.3 349.6 347.3 338.6 339.9L242.7 275.2C236 271.5 232 264.6 232 257.1L232 120zM256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zM48 256C48 141.1 141.1 48 256 48s208 93.1 208 208s-93.1 208-208 208S48 370.9 48 256z"/>'),
        bookmark: createSVGIcon('<path d="M48 0C21.5 0 0 21.5 0 48v464l192-112 192 112V48c0-26.5-21.5-48-48-48H48z"/>'),
        list: createSVGIcon('<path d="M40 48C26.7 48 16 58.7 16 72v8c0 13.3 10.7 24 24 24H96c13.3 0 24-10.7 24-24V72c0-13.3-10.7-24-24-24H40zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zM16 232v8c0 13.3 10.7 24 24 24H96c13.3 0 24-10.7 24-24v-8c0-13.3-10.7-24-24-24H40c-13.3 0-24 10.7-24 24zM40 368c-13.3 0-24 10.7-24 24v8c0 13.3 10.7 24 24 24H96c13.3 0 24-10.7 24-24v-8c0-13.3-10.7-24-24-24H40z"/>'),
        play: createSVGIcon('<path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.2 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/>'),
        delete: createSVGIcon('<path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/>'),
        export: createSVGIcon('<path d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"/>'),
        import: createSVGIcon('<path d="M288 109.3V352c0 17.7-14.3 32-32 32s-32-14.3-32-32V109.3l-73.4 73.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l128-128c12.5-12.5 32.8-12.5 45.3 0l128 128c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 109.3zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"/>'),
        empty: createSVGIcon('<path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"/>'),
        success: createSVGIcon('<path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"/>'),
        error: createSVGIcon('<path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/>'),
        info: createSVGIcon('<path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/>'),
        refresh: createSVGIcon('<path d="M142.9 142.9c62.2-62.2 162.7-62.5 225.3-1L327 183c-6.9 6.9-8.9 17.2-5.2 26.2s12.5 14.8 22.2 14.8H463.5c0 0 0 0 0 0H472c13.3 0 24-10.7 24-24V72c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2L413.4 96.6c-87.6-86.5-228.7-86.2-315.8 1C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5c7.7-21.8 20.2-42.3 37.8-59.8zM16 312v7.6 .7V440c0 9.7 5.8 18.5 14.8 22.2s19.3 1.7 26.2-5.2L98.6 415.4c87.6 86.5 228.7 86.2 315.8-1C438.8 390 456.4 361.3 467.2 330.6c5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8c-62.2 62.2-162.7 62.5-225.3 1L185 329c6.9-6.9 8.9-17.2 5.2-26.2s-12.5-14.8-22.2-14.8H48.4c0 0 0 0 0 0H40c-13.3 0-24 10.7-24 24z"/>'),
        plus: createSVGIcon('<path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/>'),
        edit: createSVGIcon('<path d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"/>'),
        search: createSVGIcon('<path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/>'),
        fullscreen: createSVGIcon('<path d="M32 32C14.3 32 0 46.3 0 64v96c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V352z"/>'),
        sync: createSVGIcon('<path d="M105.1 202.6c7.7-21.8 20.2-42.3 37.8-59.8c62.5-62.5 163.8-62.5 226.3 0L386.3 160H336c-17.7 0-32 14.3-32 32s14.3 32 32 32H463.5c0 0 0 0 0 0h.4c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32s-32 14.3-32 32v51.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5zM39 289.3c-5 1.5-9.8 4.2-13.7 8.2c-4 4-6.7 8.8-8.1 14c-.3 1.2-.6 2.5-.8 3.8c-.3 1.7-.4 3.4-.4 5.1V448c0 17.7 14.3 32 32 32s32-14.3 32-32V396.9l17.6 17.5 0 0c87.5 87.4 229.3 87.4 316.7 0c24.4-24.4 42.1-53.1 52.9-83.7c5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8c-62.5 62.5-163.8 62.5-226.3 0l-.1-.1L125.6 352H176c17.7 0 32-14.3 32-32s-14.3-32-32-32H48.4c0 0 0 0 0 0H48c-3.8 0-7.1 .7-10.3 1.9L39 289.3z"/>'),
        github: createSVGIcon('<path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.3-1.3 1.3-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z"/>'),
        settings: createSVGIcon('<path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/>')
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
            this.currentBookmarkIndex = null;

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
            this.startBackgroundSync();
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

        startBackgroundSync() {
            // Clear any existing background sync interval
            if (this.backgroundSyncInterval) {
                clearInterval(this.backgroundSyncInterval);
            }

            // Start aggressive background sync every 30 seconds for YouTube-like continuity
            if (this.preferences.syncEnabled) {
                this.backgroundSyncInterval = setInterval(async () => {
                    if (this.preferences.syncEnabled && !this.syncState.isSyncing) {
                        try {
                            const timeSinceLastSync = Date.now() - (this.preferences.lastSyncTime || 0);
                            const hasActivity = this.hasRecentActivity();
                            const isVideoPlaying = this.activeVideo && !this.activeVideo.paused;

                            // Aggressive sync conditions for better continuity:
                            // 1. If video is currently playing and it's been >15s since last sync
                            // 2. If there's been recent activity and >30s since last sync
                            // 3. If it's been >2 minutes since last sync (fallback)
                            const shouldSync =
                                (isVideoPlaying && timeSinceLastSync > 15000) ||
                                (hasActivity && timeSinceLastSync > 30000) ||
                                timeSinceLastSync > 120000;

                            if (shouldSync) {
                                this.log('Performing background sync for continuity...', {
                                    playing: isVideoPlaying,
                                    activity: hasActivity,
                                    timeSince: Math.round(timeSinceLastSync / 1000) + 's'
                                });
                                await this.performSync();
                            }
                        } catch (error) {
                            this.log('Background sync failed:', error);
                        }
                    }
                }, 30000); // 30 seconds for YouTube-like continuity
            }
        }

        async performSync() {
            if (this.syncState.isSyncing) return false;

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
                                lastModified: data.lastModified || Date.now()
                            };
                        }
                    } catch (error) {
                        this.log('Error reading local key:', key, error);
                    }
                }

                const remoteData = await this.syncProvider.getAllData();
                const mergedData = await this.smartMergeData(localData, remoteData);

                await this.syncProvider.saveAllData(mergedData);

                for (const [key, entry] of Object.entries(mergedData)) {
                    if (!localData[key] || this.shouldUpdateLocal(localData[key], entry)) {
                        await GM.setValue(key, entry.data);
                    }
                }

                this.preferences.lastSyncTime = Date.now();
                await this.savePreferences();

                this.showMessage('Smart sync completed successfully!', 'success');
                return true;

            } catch (error) {
                this.log('Sync failed:', error);
                this.syncState.lastError = error.message;
                this.showMessage('Sync failed: ' + error.message, 'error');
                return false;
            } finally {
                this.syncState.isSyncing = false;
            }
        }

        async smartMergeData(localData, remoteData) {
            const mergedData = {};
            const allKeys = new Set([...Object.keys(localData), ...Object.keys(remoteData)]);

            for (const key of allKeys) {
                const local = localData[key];
                const remote = remoteData[key];

                if (!local && remote) {
                    mergedData[key] = remote;
                } else if (local && !remote) {
                    mergedData[key] = local;
                } else if (local && remote) {
                    mergedData[key] = this.mergeSingleVideoData(local, remote, key);
                }
            }

            return mergedData;
        }

        mergeSingleVideoData(local, remote, key) {
            try {
                const localBookmarks = local.data.bookmarks || [];
                const remoteBookmarks = remote.data.bookmarks || [];

                const localAutoSave = localBookmarks.find(b => b.isAutoSave);
                const remoteAutoSave = remoteBookmarks.find(b => b.isAutoSave);

                const localLastActivity = this.getLastActivityTime(local.data);
                const remoteLastActivity = this.getLastActivityTime(remote.data);

                this.log(`Merging ${key}: Local activity: ${new Date(localLastActivity).toLocaleString()}, Remote activity: ${new Date(remoteLastActivity).toLocaleString()}`);

                // Enhanced YouTube-like continuity logic
                let baseData, newerData;

                // Priority 1: Most recent auto-save (playback position)
                if (localAutoSave && remoteAutoSave) {
                    const localAutoSaveTime = localAutoSave.createdAt || 0;
                    const remoteAutoSaveTime = remoteAutoSave.createdAt || 0;

                    if (Math.abs(localAutoSaveTime - remoteAutoSaveTime) > 5000) { // 5s difference threshold
                        if (localAutoSaveTime > remoteAutoSaveTime) {
                            this.log(`Using local auto-save for ${key} (more recent playback: ${new Date(localAutoSaveTime).toLocaleString()})`);
                            baseData = local.data;
                            newerData = remote.data;
                        } else {
                            this.log(`Using remote auto-save for ${key} (more recent playback: ${new Date(remoteAutoSaveTime).toLocaleString()})`);
                            baseData = remote.data;
                            newerData = local.data;
                        }
                    } else {
                        // Close timestamps - prefer device with more recent overall activity
                        baseData = localLastActivity >= remoteLastActivity ? local.data : remote.data;
                        newerData = localLastActivity >= remoteLastActivity ? remote.data : local.data;
                    }
                } else if (localAutoSave && !remoteAutoSave) {
                    // Local has auto-save, remote doesn't - prefer local
                    baseData = local.data;
                    newerData = remote.data;
                } else if (!localAutoSave && remoteAutoSave) {
                    // Remote has auto-save, local doesn't - prefer remote
                    baseData = remote.data;
                    newerData = local.data;
                } else {
                    // No auto-saves - use general activity time
                    baseData = localLastActivity >= remoteLastActivity ? local.data : remote.data;
                    newerData = localLastActivity >= remoteLastActivity ? remote.data : local.data;
                }

                const mergedBookmarks = this.mergeBookmarkArrays(baseData.bookmarks || [], newerData.bookmarks || []);

                const result = {
                    data: {
                        ...baseData,
                        bookmarks: mergedBookmarks,
                        lastModified: Math.max(localLastActivity, remoteLastActivity),
                        syncVersion: (baseData.syncVersion || 0) + 1 // Version tracking for conflict resolution
                    },
                    lastModified: Math.max(localLastActivity, remoteLastActivity)
                };

                return result;

            } catch (error) {
                this.log('Error merging data for key:', key, error);
                return local.lastModified >= remote.lastModified ? local : remote;
            }
        }

        getLastActivityTime(data) {
            if (!data || !data.bookmarks) return data.lastModified || 0;

            const autoSave = data.bookmarks.find(b => b.isAutoSave);
            if (autoSave && autoSave.createdAt) {
                return Math.max(autoSave.createdAt, data.lastModified || 0);
            }

            const latestBookmark = data.bookmarks
                .filter(b => !b.isAutoSave && b.createdAt)
                .sort((a, b) => b.createdAt - a.createdAt)[0];

            if (latestBookmark) {
                return Math.max(latestBookmark.createdAt, data.lastModified || 0);
            }

            return data.lastModified || 0;
        }

        mergeBookmarkArrays(base, newer) {
            const merged = [...base];

            for (const newBookmark of newer) {
                if (newBookmark.isAutoSave) continue;

                const exists = merged.some(b =>
                    Math.abs(b.timestamp - newBookmark.timestamp) < 1 &&
                    b.label === newBookmark.label
                );

                if (!exists) {
                    merged.push(newBookmark);
                }
            }

            merged.sort((a, b) => a.timestamp - b.timestamp);
            return merged;
        }

        shouldUpdateLocal(local, merged) {
            if (!local || !merged) return true;

            const localActivity = this.getLastActivityTime(local.data);
            const mergedActivity = this.getLastActivityTime(merged.data);

            return mergedActivity > localActivity;
        }

        hasRecentActivity() {
            const now = Date.now();
            const recentThreshold = 120000; // 2 minutes (more aggressive for YouTube-like continuity)

            // Check if there has been any video activity recently
            for (const [video, lastSavedTime] of this.lastSavedTimes.entries()) {
                if (now - lastSavedTime < recentThreshold) {
                    return true;
                }
            }

            // Also check for current video playback activity
            if (this.activeVideo && !this.activeVideo.paused && !this.activeVideo.ended) {
                return true;
            }

            // Check for recent user interactions (bookmarks, etc.)
            const lastInteractionTime = this.preferences.lastInteractionTime || 0;
            if (now - lastInteractionTime < recentThreshold) {
                return true;
            }

            return false;
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
            clockBtn.innerHTML = ICONS.clock;
            clockBtn.title = 'Video Bookmarks';

            const fullscreenHint = document.createElement('div');
            fullscreenHint.className = 'vbm-fullscreen-hint';
            fullscreenHint.innerHTML = `${ICONS.fullscreen}<span>Enter fullscreen</span>`;

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

        positionTimelineAboveControls(timeline) {
            if (!this.activeVideo || !timeline) return;

            const video = this.activeVideo;
            const videoRect = video.getBoundingClientRect();
            const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);

            // Smart control detection - common video player control selectors
            const controlSelectors = [
                // YouTube
                '[class*="ytp-chrome-bottom"]',
                '[class*="ytp-progress-bar-container"]',
                '.ytp-chrome-bottom',
                // Generic video controls
                'video + div[class*="control"]',
                'video ~ div[class*="control"]',
                // Popular video players
                '[class*="plyr__controls"]',
                '[class*="vjs-control-bar"]',
                '[class*="jwplayer"] .jw-controlbar',
                '[class*="video-controls"]',
                '[class*="player-controls"]',
                '[class*="controls-bar"]',
                // HTML5 native controls fallback
                'video[controls] + *',
                'video[controls] ~ *'
            ];

            let controlsElement = null;
            let controlsHeight = 60; // default fallback height

            // Try to find video player controls
            for (const selector of controlSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        const elRect = el.getBoundingClientRect();
                        // Check if element is visible and positioned near video bottom
                        if (elRect.height > 10 && elRect.width > 50 &&
                            ((elRect.bottom >= videoRect.bottom - 120 && elRect.bottom <= videoRect.bottom + 30) ||
                             (elRect.top >= videoRect.bottom - 120 && elRect.top <= videoRect.bottom + 10))) {

                            // Additional validation - should contain typical control elements
                            const hasControlIndicators = el.querySelector('[class*="play"], [class*="pause"], [class*="time"], [class*="volume"], [class*="progress"], [class*="seek"]') ||
                                                        el.textContent.match(/\d+:\d+/) || // time indicators
                                                        el.querySelector('button, input[type="range"]'); // typical control elements

                            if (hasControlIndicators || el.style.zIndex > 1000) {
                                controlsElement = el;
                                controlsHeight = Math.max(elRect.height, 40);
                                break;
                            }
                        }
                    }
                    if (controlsElement) break;
                } catch (e) {
                    // Ignore selector errors
                }
            }

            // Fallback: if video has native controls attribute
            if (!controlsElement && video.hasAttribute('controls')) {
                controlsHeight = 30; // native controls height
            }

            // Calculate timeline dimensions and position
            const timelineHeight = 120; // approximate timeline height
            const margin = 8;
            const maxWidth = Math.min(400, videoRect.width - (margin * 2));

            let bottom, left, width;

            if (isFullscreen) {
                // Fullscreen mode - position relative to screen
                bottom = Math.max(controlsHeight + margin, 80); // ensure minimum clearance
                left = Math.max(margin, (window.innerWidth - maxWidth) / 2);
                width = maxWidth;
                timeline.classList.add('vbm-timeline-above-controls');
            } else {
                // Normal mode - position relative to video
                const clearance = controlsHeight + margin * 2;
                bottom = Math.max(window.innerHeight - videoRect.bottom + clearance, margin);

                // Center horizontally within video bounds
                left = videoRect.left + (videoRect.width - maxWidth) / 2;
                width = maxWidth;

                // Ensure timeline stays within video boundaries
                if (left + width > videoRect.right - margin) {
                    left = videoRect.right - width - margin;
                }
                if (left < videoRect.left + margin) {
                    left = videoRect.left + margin;
                    width = Math.min(maxWidth, videoRect.width - (margin * 2));
                }

                // Ensure timeline doesn't go above video top
                const topPosition = window.innerHeight - bottom - 120; // 120 is approx timeline height
                if (topPosition < videoRect.top) {
                    bottom = window.innerHeight - videoRect.top - 120 - margin;
                }

                timeline.classList.add('vbm-timeline-above-controls');
            }

            // Apply positioning
            timeline.style.position = 'fixed';
            timeline.style.bottom = `${Math.max(margin, bottom)}px`;
            timeline.style.left = `${left}px`;
            timeline.style.width = `${width}px`;
            timeline.style.right = 'auto';
            timeline.style.top = 'auto';
            timeline.style.maxWidth = `${width}px`;

            // Set up repositioning on video events
            if (!this._timelineRepositionHandlers) this._timelineRepositionHandlers = new WeakMap();
            if (!this._timelineRepositionHandlers.get(timeline)) {
                let raf = null;
                const reposition = () => {
                    if (raf) cancelAnimationFrame(raf);
                    raf = requestAnimationFrame(() => this.positionTimelineAboveControls(timeline));
                };

                const handlers = {
                    resize: reposition,
                    scroll: reposition,
                    fullscreenchange: reposition,
                    webkitfullscreenchange: reposition
                };

                Object.entries(handlers).forEach(([event, handler]) => {
                    if (event.includes('fullscreen')) {
                        document.addEventListener(event, handler);
                    } else {
                        window.addEventListener(event, handler, true);
                    }
                });

                this._timelineRepositionHandlers.set(timeline, handlers);
            }
        }

        // ==================== MENU & PANELS ====================
        toggleMenu() {
            const container = this.getActiveContainer();
            if (!container) return;
            const clockBtn = container.querySelector('.vbm-clock-btn');
            const panelHost = container.querySelector('.vbm-panel-container');
            const isOpen = !!panelHost?.querySelector('.vbm-mini-timeline');

            if (isOpen) {
                this.closeAll();
            } else {
                this.showPanel('timeline');
                clockBtn?.classList.add('active');
            }
        }

        toggleTimeline() {
            const container = this.getActiveContainer();
            if (!container) return;
            const panelHost = container.querySelector('.vbm-panel-container');
            const timelineExists = !!panelHost?.querySelector('.vbm-mini-timeline');

            if (timelineExists) {
                this.closeAll();
            } else {
                this.showPanel('timeline');
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

            if (type === 'timeline') {
                await this.showMiniTimeline(container);
            }
        }

        async showMiniTimeline(container) {
            this.closeAll();

            const timeline = document.createElement('div');
            timeline.className = 'vbm-mini-timeline';
            timeline.innerHTML = this.getMiniTimelineHTML();

            const panelHost = container.querySelector('.vbm-panel-container');
            panelHost.appendChild(timeline);

            await this.setupMiniTimelineHandlers(timeline);
            this.positionTimelineAboveControls(timeline);

            // Load bookmarks after a short delay to ensure video duration is available
            setTimeout(() => {
                this.updateTimelineBookmarks(timeline);
            }, 100);
        }


        showMessage(text, iconKey = 'info') {
            const container = this.getActiveContainer();
            const message = container?.querySelector('.vbm-message');
            if (!message) return;

            const icon = ICONS[iconKey] || ICONS.info;
            message.innerHTML = `${icon}<span>${text}</span>`;
            message.classList.add('show');

            clearTimeout(this.messageTimeout);
            this.messageTimeout = setTimeout(() => {
                message.classList.remove('show');
            }, 3000);
        }

        showColorTagPrompt() {
            // Close any existing color tag prompt
            const existingPrompt = document.querySelector('.vbm-color-tag-prompt');
            if (existingPrompt) existingPrompt.remove();

            const prompt = document.createElement('div');
            prompt.className = 'vbm-color-tag-prompt';
            prompt.innerHTML = `
                <h3># <span>Choose Color Tag</span></h3>
                <p>Select a color tag for this bookmark:</p>
                <div class="vbm-color-button-group">
                    <button class="vbm-color-btn generic" data-color="generic">Generic</button>
                    <button class="vbm-color-btn important" data-color="important">Important</button>
                    <button class="vbm-color-btn alert" data-color="alert">Alert</button>
                </div>
            `;

            this.getOverlayParent(this.activeVideo).appendChild(prompt);

            // Add event handlers
            prompt.querySelectorAll('.vbm-color-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const color = btn.dataset.color;
                    await this.setBookmarkColorTag(color);
                    prompt.remove();
                });
            });

            // Close on outside click
            setTimeout(() => {
                const handleOutsideClick = (e) => {
                    if (!prompt.contains(e.target)) {
                        prompt.remove();
                        document.removeEventListener('click', handleOutsideClick);
                    }
                };
                document.addEventListener('click', handleOutsideClick);
            }, 100);
        }


        async setBookmarkColorTag(colorTag) {
            if (!this.activeVideo) return;

            // Find the nearest bookmark to current time
            const data = await this.getBookmarks(this.activeVideo);
            const currentTime = this.activeVideo.currentTime;
            const bookmarks = data.bookmarks || [];

            // Find closest bookmark within 30 seconds
            let closestBookmark = null;
            let closestDistance = Infinity;
            let closestIndex = -1;

            bookmarks.forEach((bookmark, index) => {
                const distance = Math.abs(bookmark.timestamp - currentTime);
                if (distance <= 30 && distance < closestDistance) {
                    closestDistance = distance;
                    closestBookmark = bookmark;
                    closestIndex = index;
                }
            });

            if (closestBookmark) {
                // Update existing bookmark
                closestBookmark.colorTag = colorTag;
                await this.saveBookmarks(this.activeVideo, data);

                // Update timeline display
                const timeline = document.querySelector('.vbm-mini-timeline');
                if (timeline) {
                    this.updateTimelineBookmarks(timeline);
                }

                this.showMessage(`Bookmark tagged as ${colorTag}`, 'bookmark');
            } else {
                // Create new bookmark with color tag
                const defaultLabel = `Bookmark at ${this.formatTime(currentTime)}`;
                const createdAt = Date.now();
                const bookmark = {
                    timestamp: currentTime,
                    label: defaultLabel,
                    isAutoSave: false,
                    createdAt,
                    colorTag
                };

                data.bookmarks.push(bookmark);
                data.bookmarks.sort((a, b) => a.timestamp - b.timestamp);
                await this.saveBookmarks(this.activeVideo, data);

                // Update timeline display
                const timeline = document.querySelector('.vbm-mini-timeline');
                if (timeline) {
                    this.updateTimelineBookmarks(timeline);
                }

                this.showMessage(`New ${colorTag} bookmark added`, 'bookmark');
            }
        }

        closeAll() {
            const timelines = document.querySelectorAll('.vbm-mini-timeline');

            if (timelines.length > 0) {
                // Apply fade-out animation
                timelines.forEach(timeline => {
                    timeline.classList.add('vbm-timeline-fade-out');
                });

                // Clean up after animation completes
                setTimeout(() => {
                    // Clean up timeline positioning handlers
                    if (this._timelineRepositionHandlers) {
                        timelines.forEach(timeline => {
                            const handlers = this._timelineRepositionHandlers.get(timeline);
                            if (handlers) {
                                Object.entries(handlers).forEach(([event, handler]) => {
                                    if (event.includes('fullscreen')) {
                                        document.removeEventListener(event, handler);
                                    } else {
                                        window.removeEventListener(event, handler, true);
                                    }
                                });
                                this._timelineRepositionHandlers.delete(timeline);
                            }
                        });
                    }

                    const container = this.getActiveContainer();
                    const panelHost = container?.querySelector('.vbm-panel-container');
                    const clockBtn = container?.querySelector('.vbm-clock-btn');
                    if (panelHost) panelHost.innerHTML = '';
                    if (clockBtn) clockBtn.classList.remove('active');

                    document.querySelectorAll('.vbm-panel-container').forEach(host => host.innerHTML = '');
                    document.querySelectorAll('.vbm-clock-btn.active').forEach(btn => btn.classList.remove('active'));
                }, 300);
            } else {
                // No animation needed, cleanup immediately
                const container = this.getActiveContainer();
                const panelHost = container?.querySelector('.vbm-panel-container');
                const clockBtn = container?.querySelector('.vbm-clock-btn');
                if (panelHost) panelHost.innerHTML = '';
                if (clockBtn) clockBtn.classList.remove('active');

                document.querySelectorAll('.vbm-panel-container').forEach(host => host.innerHTML = '');
                document.querySelectorAll('.vbm-clock-btn.active').forEach(btn => btn.classList.remove('active'));
            }
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
                    ${ICONS.search}
                    <input class="vbm-search-input" type="text" placeholder="Search bookmarks..." data-action="search">
                </div>
            `;

            const actions = `
                <div class="vbm-header-actions">
                    <button class="vbm-icon-btn vbm-add" title="Add Bookmark">${ICONS.plus}</button>
                    <button class="vbm-icon-btn vbm-sync" title="Sync Now">${ICONS.sync}</button>
                    ${bookmarks.length > 0 ? `<button class="vbm-icon-btn vbm-clear-all" title="Clear All">${ICONS.delete}</button>` : ''}
                </div>
            `;

            let html = `
                <div class="vbm-panel-header">
                    <span class="vbm-panel-title">
                        ${ICONS.list}
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

                    const colorClass = bookmark.colorTag || 'generic';
                    html += `
                        <div class="vbm-bookmark-item ${isAutoSave ? 'auto-saved' : ''}"
                             data-index="${originalIndex}"
                             data-id="${bookmark.createdAt}"
                             data-bookmark='${JSON.stringify(bookmark)}'
                             data-search-text="${this.escapeHtml(bookmark.label.toLowerCase())}">
                            <div class="vbm-color-dot ${colorClass}" style="margin-right: 8px; flex-shrink: 0;"></div>
                            <div class="vbm-bookmark-label" data-timestamp="${bookmark.timestamp}" data-label="${bookmark.label}">
                                ${this.escapeHtml(bookmark.label)}
                                <span class="vbm-bookmark-time">${this.formatTime(bookmark.timestamp)}</span>
                            </div>
                            <div class="vbm-bookmark-actions">
                                <button class="vbm-icon-btn play" data-timestamp="${bookmark.timestamp}" title="Play">${ICONS.play}</button>
                                <button class="vbm-icon-btn delete" data-index="${originalIndex}" title="Delete">${ICONS.delete}</button>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            } else {
                html += `
                    <div class="vbm-empty-state">
                        ${ICONS.empty}
                        <p>No bookmarks yet</p>
                    </div>
                `;
            }

            html += `
                <div class="vbm-export-import">
                    <button class="vbm-btn vbm-btn-secondary" data-action="export">${ICONS.export} <span>Export</span></button>
                    <button class="vbm-btn vbm-btn-secondary" data-action="import">${ICONS.import} <span>Import</span></button>
                </div>
            `;

            return html;
        }

        getMiniTimelineHTML() {
            return `
                <div class="vbm-timeline-header">
                    <span class="vbm-timeline-title">
                        ${ICONS.clock}
                        Timeline
                    </span>
                    <div class="vbm-timeline-actions">
                        <button class="vbm-icon-btn vbm-color-tag inactive" title="Color Tag Bookmark" disabled>#</button>
                        <button class="vbm-icon-btn vbm-add-bookmark" title="Add Bookmark">${ICONS.plus}</button>
                        <button class="vbm-icon-btn vbm-sync-now" title="Sync Now">${ICONS.sync}</button>
                        <button class="vbm-icon-btn vbm-delete-bookmark inactive" title="Delete Current Bookmark" disabled>${ICONS.delete}</button>
                    </div>
                </div>
                <div class="vbm-timeline-track">
                    <div class="vbm-timeline-progress" style="width: 0%"></div>
                    <div class="vbm-timeline-bookmarks"></div>
                </div>
                <div class="vbm-timeline-info">
                    <span class="vbm-timeline-current">0:00</span>
                    <span class="vbm-timeline-duration">0:00</span>
                </div>
            `;
        }


        async setupMiniTimelineHandlers(timeline) {
            // Color tag button
            timeline.querySelector('.vbm-color-tag')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showColorTagPrompt();
            });

            // Add bookmark button
            timeline.querySelector('.vbm-add-bookmark')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const t = this.activeVideo.currentTime;
                const defaultLabel = `Bookmark at ${this.formatTime(t)}`;
                await this.addBookmark(defaultLabel);
                this.updateTimelineBookmarks(timeline);
                this.showMessage('Bookmark added', 'bookmark');
            });

            // Delete bookmark button
            timeline.querySelector('.vbm-delete-bookmark')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (this.currentBookmarkIndex !== null) {
                    await this.deleteBookmark(this.currentBookmarkIndex);
                    this.updateTimelineBookmarks(timeline);
                    this.updateDeleteButtonState(timeline);
                    await this.updateColorTagButtonState(timeline);
                    this.showMessage('Bookmark deleted', 'delete');
                    this.currentBookmarkIndex = null;
                }
            });

            // Sync now button
            timeline.querySelector('.vbm-sync-now')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!this.preferences.syncEnabled) {
                    this.showSyncConfigDialog();
                } else {
                    await this.performSync();
                }
            });

            // Timeline track click to seek
            const track = timeline.querySelector('.vbm-timeline-track');
            if (track) {
                track.addEventListener('click', (e) => {
                    const rect = track.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const percentage = x / rect.width;
                    const newTime = percentage * this.activeVideo.duration;
                    this.activeVideo.currentTime = Math.max(0, Math.min(newTime, this.activeVideo.duration));
                });
            }

            this.updateTimelineProgress(timeline);
            this.updateDeleteButtonState(timeline);
            await this.updateColorTagButtonState(timeline);

            // Set up progress updates
            if (!this.timelineUpdateInterval) {
                this.timelineUpdateInterval = setInterval(() => {
                    const activeTimeline = document.querySelector('.vbm-mini-timeline');
                    if (activeTimeline) {
                        this.updateTimelineProgress(activeTimeline);
                    } else {
                        clearInterval(this.timelineUpdateInterval);
                        this.timelineUpdateInterval = null;
                    }
                }, 1000);
            }
        }


        async updateTimelineBookmarks(timeline) {
            const data = await this.getBookmarks(this.activeVideo);
            const bookmarks = data.bookmarks || [];
            const container = timeline.querySelector('.vbm-timeline-bookmarks');

            if (!container || !this.activeVideo.duration) return;

            container.innerHTML = '';

            bookmarks.forEach((bookmark, index) => {
                const percentage = (bookmark.timestamp / this.activeVideo.duration) * 100;
                const dot = document.createElement('div');
                const colorClass = bookmark.colorTag || 'generic';
                dot.className = `vbm-bookmark-dot ${colorClass}`;
                dot.style.left = `${percentage}%`;
                dot.title = `${bookmark.label} (${this.formatTime(bookmark.timestamp)})`;
                dot.dataset.timestamp = bookmark.timestamp;
                dot.dataset.index = index;

                // Click to jump to bookmark
                dot.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    this.activeVideo.currentTime = bookmark.timestamp;
                    this.activeVideo.pause();
                    this.currentBookmarkIndex = index;
                    this.updateDeleteButtonState(timeline);
                    await this.updateColorTagButtonState(timeline);
                    this.showMessage(`Jumped to: ${bookmark.label}`, 'play');
                });


                container.appendChild(dot);
            });
        }

        updateTimelineProgress(timeline) {
            if (!this.activeVideo || !this.activeVideo.duration) return;

            const progress = (this.activeVideo.currentTime / this.activeVideo.duration) * 100;
            const progressBar = timeline.querySelector('.vbm-timeline-progress');
            const currentTime = timeline.querySelector('.vbm-timeline-current');
            const duration = timeline.querySelector('.vbm-timeline-duration');

            if (progressBar) progressBar.style.width = `${progress}%`;
            if (currentTime) currentTime.textContent = this.formatTime(this.activeVideo.currentTime);
            if (duration) duration.textContent = this.formatTime(this.activeVideo.duration);
        }

        updateDeleteButtonState(timeline) {
            const deleteBtn = timeline.querySelector('.vbm-delete-bookmark');
            if (!deleteBtn) return;

            if (this.currentBookmarkIndex !== null) {
                deleteBtn.classList.remove('inactive');
                deleteBtn.disabled = false;
            } else {
                deleteBtn.classList.add('inactive');
                deleteBtn.disabled = true;
            }
        }

        async updateColorTagButtonState(timeline) {
            const colorTagBtn = timeline.querySelector('.vbm-color-tag');
            if (!colorTagBtn) return;

            if (this.currentBookmarkIndex !== null) {
                // Check if the current bookmark is manually created (not auto-save)
                const data = await this.getBookmarks(this.activeVideo);
                const currentBookmark = data.bookmarks[this.currentBookmarkIndex];

                if (currentBookmark && !currentBookmark.isAutoSave) {
                    colorTagBtn.classList.remove('inactive');
                    colorTagBtn.disabled = false;
                } else {
                    colorTagBtn.classList.add('inactive');
                    colorTagBtn.disabled = true;
                }
            } else {
                colorTagBtn.classList.add('inactive');
                colorTagBtn.disabled = true;
            }
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
                // Show timeline if available, otherwise close
                const timeline = document.querySelector('.vbm-mini-timeline');
                if (timeline) {
                    this.updateTimelineBookmarks(timeline);
                } else {
                    this.closeAll();
                }
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
                    // Timeline already updated in deleteBookmark method
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

            // Clear pending edit
            this.pendingEditId = null;
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
                            <span style="font-size: 16px; margin-bottom: 8px; display: block;">${ICONS.search}</span>
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
                const deviceInfo = this.getDeviceInfo(autoSave);
                this.showRestorePrompt(video, autoSave.timestamp, autoSave.createdAt, deviceInfo);
            }
        }

        getDeviceInfo(autoSave) {
            const now = Date.now();
            const timeDiff = now - (autoSave.createdAt || now);
            const minutes = Math.floor(timeDiff / (1000 * 60));
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            let timeAgo = '';
            if (days > 0) {
                timeAgo = `${days} day${days > 1 ? 's' : ''} ago`;
            } else if (hours > 0) {
                timeAgo = `${hours} hour${hours > 1 ? 's' : ''} ago`;
            } else if (minutes > 0) {
                timeAgo = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
            } else {
                timeAgo = 'just now';
            }

            const isRecentActivity = timeDiff < 300000; // 5 minutes
            const deviceHint = isRecentActivity ? 'this device' : 'another device';

            return { timeAgo, deviceHint, isRecent: isRecentActivity };
        }

        showRestorePrompt(video, timestamp, createdAt, deviceInfo) {
            document.querySelectorAll('.vbm-clock-btn.active').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.vbm-mini-timeline').forEach(panel => panel.remove());

            const existingPrompt = document.querySelector('.vbm-restore-prompt');
            if (existingPrompt) existingPrompt.remove();

            const deviceText = deviceInfo ?
                `<small class="vbm-device-info">Watched on ${deviceInfo.deviceHint} ${deviceInfo.timeAgo}</small>` :
                '';

            const prompt = document.createElement('div');
            prompt.className = 'vbm-restore-prompt';
            prompt.innerHTML = `
                <h3>${ICONS.clock} <span>Resume Playback?</span></h3>
                <p>Continue from <strong>${this.formatTime(timestamp)}</strong>?</p>
                ${deviceText}
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
            document.querySelectorAll('.vbm-mini-timeline').forEach(panel => panel.remove());

            const existingPrompt = document.querySelector('.vbm-clear-all-prompt');
            if (existingPrompt) existingPrompt.remove();

            const prompt = document.createElement('div');
            prompt.className = 'vbm-clear-all-prompt';
            prompt.innerHTML = `
                <h3>${ICONS.delete} <span>Clear All Bookmarks?</span></h3>
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
                    this.startBackgroundSync(); // Start background sync
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
            // Track user interaction for better sync timing
            this.preferences.lastInteractionTime = Date.now();
            await this.savePreferences();

            const data = await this.getBookmarks(this.activeVideo);
            const createdAt = Date.now();
            const bookmark = {
                timestamp: this.activeVideo.currentTime,
                label: label,
                isAutoSave: false,
                createdAt,
                colorTag: 'generic'
            };
            data.bookmarks.push(bookmark);
            data.bookmarks.sort((a, b) => a.timestamp - b.timestamp);
            await this.saveBookmarks(this.activeVideo, data);

            // Update timeline if visible
            const timeline = document.querySelector('.vbm-mini-timeline');
            if (timeline) {
                this.updateTimelineBookmarks(timeline);
            }

            return createdAt;
        }

        async deleteBookmark(index) {
            // Track user interaction for better sync timing
            this.preferences.lastInteractionTime = Date.now();
            await this.savePreferences();

            const data = await this.getBookmarks(this.activeVideo);
            if (data.bookmarks[index]) {
                data.bookmarks.splice(index, 1);
                await this.saveBookmarks(this.activeVideo, data);

                // Update timeline if visible
                const timeline = document.querySelector('.vbm-mini-timeline');
                if (timeline) {
                    this.updateTimelineBookmarks(timeline);
                }
            }
        }

        async deleteAllBookmarks() {
            const data = await this.getBookmarks(this.activeVideo);
            data.bookmarks = [];
            await this.saveBookmarks(this.activeVideo, data);
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
                    // Update timeline if visible
                    const timeline = document.querySelector('.vbm-mini-timeline');
                    if (timeline) {
                        this.updateTimelineBookmarks(timeline);
                    }
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
                const isOpen = !!panelHost?.querySelector('.vbm-mini-timeline');
                if (!isOpen) {
                    this.showPanel('timeline');
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

            // Enhanced sync with YouTube-like continuity logic
            let syncCompleted = false;
            if (this.preferences.syncEnabled) {
                this.log('Starting enhanced sync for cross-device continuity...');

                // Try multiple sync attempts with exponential backoff for robustness
                let attempts = 0;
                const maxAttempts = 3;
                while (!syncCompleted && attempts < maxAttempts) {
                    try {
                        syncCompleted = await this.performSync();
                        if (!syncCompleted && attempts < maxAttempts - 1) {
                            const delay = Math.pow(2, attempts) * 1000; // 1s, 2s, 4s
                            this.log(`Sync attempt ${attempts + 1} failed, retrying in ${delay}ms...`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    } catch (error) {
                        this.log(`Sync attempt ${attempts + 1} error:`, error);
                    }
                    attempts++;
                }
                this.log('Enhanced sync completed:', syncCompleted, `(${attempts} attempts)`);
            }

            // Show restore prompt with enhanced logic
            if (!this.preferences.syncEnabled || syncCompleted) {
                // Add slight delay after sync to ensure data consistency
                if (syncCompleted) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                await this.checkAndPromptRestore(video);
            } else {
                this.log('Skipping restore prompt due to sync failure after retries');
                // Still show restore prompt with local data as fallback
                setTimeout(() => this.checkAndPromptRestore(video), 2000);
            }

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
