// ==UserScript==
// @name         Video Progress Saver
// @namespace    http://tampermonkey.net/
// @version      2.8.2
// @description  Automatically saves and restores HTML5 video playback progress. Features a rich history panel with search, sort, and bulk actions, plus two-way Firebase sync.
// @author       Gemini & You
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NDAgNjQwIj48IS0tIUZvbnQgQXdlc29tZSBGcmVlIDcuMC4wIGJ5IEBmb250YXdlc29tZSAtIGh0dHBzOi8vZm9udGF3ZXNvbWUuY29tIExpY2Vuc2UgLSBodHRwczovL2ZvbnRhd2Vzb21lLmNvbS9saWNlbnNlL2ZyZWUgQ29weXJpZ2h0IDIwMjUgRm9udGljb25zLCBJbmMuLS0+PHBhdGggZmlsbD0iIzc0QzBGQyIgZD0iTTMyMCAxMjhDNDI2IDEyOCA1MTIgMjE0IDUxMiAzMjBDNTEyIDQyNiA0MjYgNTEyIDMyMCA1MTJDMjU0LjggNTEyIDE5Ny4xIDQ3OS41IDE2Mi4yIDQyOS43QzE1M2MsNDEzLjIgMTMyLjMgNDExLjcgMTE3LjggNDIxLjhDMTAzLjMgNDMxLjkgOTkuOCA0NTEuOSAxMDkuOSA0NjYuNEMxNTYuMSA1MzIuNiAyMzMgNTc2IDMyMCA1NzZDNjEuNCA1NzYgNTc2IDQ2MS40IDU3NiAzMjBDNTc2IDE3OC42IDQ2MS40IDY0IDMyMCA2NEMyMzQuMyA2NCAxNTguNSAxMDYuMSAxMTIgMTcwLjdMMTEyIDE0OEMxMTIgMTI2LjMgOTcuNyAxMTIgODAgMTEyQzYyLjMgMTEyIDQ4IDEyNi4zIDQ4IDE0NEw0OCAyNTZDNCAyNzMuNyA2Mi4zIDI4OCA4MCAyODhMMTA0LjYgMjg4QzEwNS4xIDI4OCAxMDUuNiAyODggMTA2LjEgMjg4TDE5Mi4xIDI4OEMyMDkuOCAyODggMjI0LjEgMjczLjcgMjI0LjEgMjU2QzIyNC4xIDIzOC4zIDIwOS44IDIyNCAxOTIuMSAyMjRMMTUzLjggMjI0QzE4Ni45IDE2Ni42IDI0OSAxMjggMzIwIDEyOHpNMzQ0IDIxNkMzNDQgMjAyLjcgMzMzLjMgMTkyIDMyMCAxOTJDMzA2LjcgMTkyIDI5NiAyMDIuNyAyOTYgMjE2TDI5NiAzMjBDMjk2IDMyNi44IDI5OC41IDMzMi41IDMwMyAzMzdMMzc1IDQwOUMzODQuNCA0MTguNCAzOTkuNiA0MTguNCA0MDguOSA0MDlDNDE4LjIgMzk5LjYgNDE4LjMgMzg0LjQgNDA4LjkgMzc1LjFMMzQzLjkgMzEwLjFMMzQzLjkgMjE2eiIvPjwvc3ZnPg==
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      firebasestorage.googleapis.com
// @connect      *.firebaseio.com
// @connect      *.firebasedatabase.app
// @connect      identitytoolkit.googleapis.com
// @connect      securetoken.googleapis.com
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const CONFIG = {
        SAVE_INTERVAL_SECONDS: 6,
        MIN_VIDEO_DURATION_SECONDS: 60,
        COMPLETION_THRESHOLD_SECONDS: 10,
        STORAGE_KEY: 'vps_video_progress',
        FIREBASE_CONFIG_KEY: 'vps_firebase_config',
    };

    // --- ICONS ---
    const ICONS = {
        RESTORE: `<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.25 2.52.77-1.28-3.52-2.09V8H12z"/></svg>`,
        GEAR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1.2em" height="1.2em" style="vertical-align: middle;"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69-.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22-.07.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>`,
        SYNC: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1.2em" height="1.2em" style="vertical-align: middle;"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`,
        EYE: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1.2em" height="1.2em" style="vertical-align: middle;"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 10c-2.48 0-4.5-2.02-4.5-4.5S9.52 5.5 12 5.5s4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5zm0-7C10.62 7.5 9.5 8.62 9.5 10s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5S13.38 7.5 12 7.5z"/></svg>`,
        EXPORT: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1.2em" height="1.2em"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>`,
        IMPORT: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1.2em" height="1.2em"><path d="M9 10h6v6h4l-7 7-7-7h4v-6zm-4-4h14v2H5V6z"/></svg>`,
        TRASH: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1.2em" height="1.2em"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
        CHECK: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1.2em" height="1.2em" style="vertical-align: middle;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`,
        CLOSE: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1.2em" height="1.2em" style="vertical-align: middle;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`,
        WIFI: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1.2em" height="1.2em" style="vertical-align: middle;"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM4.98 13.5c.73-2.42 2.7-4.5 5.02-4.5s4.29 2.08 5.02 4.5h-10.04z"/></svg>`
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
            position: relative;
            background: rgba(44, 44, 44, 0.75); backdrop-filter: blur(12px) saturate(150%); -webkit-backdrop-filter: blur(12px) saturate(150%);
            color: #f1f1f1; border-radius: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            box-shadow: 0 10px 40px rgba(0,0,0,0.4); border: 1px solid rgba(255, 255, 255, 0.1);
            width: 90%; max-width: 800px; transform: scale(0.95); transition: transform 0.3s ease; overflow: hidden;
            display: flex; flex-direction: column;
        }
        .vps-dialog-overlay.vps-show .vps-dialog { transform: scale(1); }

        /* Force RTL: Force RTL direction on all panel elements. */
        .vps-dialog, .vps-dialog * { direction: rtl !important; }
        .vps-restore-toast, .vps-restore-toast * { direction: rtl !important; }
        .vps-dialog { text-align: right; }

        .vps-dialog-header { padding: 16px 24px; font-size: 1.2em; font-weight: 600; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
        .vps-dialog-body { padding: 24px; line-height: 1.6; max-height: 70vh; overflow-y: auto; flex-grow: 1; }
        .vps-dialog-body p { margin: 0 0 10px; }
        .vps-dialog-body label { display: block; margin-bottom: 5px; font-size: 0.9em; color: #aaa; }
        .vps-dialog-body input[type="text"] {
            width: 100%; padding: 10px; margin-bottom: 5px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2);
            background: #3a3a3a; color: #f1f1f1; font-family: sans-serif; font-size: 14px; box-sizing: border-box;
        }
        .vps-dialog-body hr { border: none; height: 1px; background-color: rgba(255, 255, 255, 0.1); margin: 20px 0; }
        .vps-dialog-footer {
            padding: 16px 24px; display: flex; justify-content: flex-end; gap: 12px; background: rgba(0,0,0,0.2);
        }
        .vps-dialog-button {
            padding: 10px 20px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;
            display: inline-flex; align-items: center; gap: 8px; justify-content: center;
        }
        .vps-dialog-button:disabled { opacity: 0.6; cursor: not-allowed; }
        .vps-dialog-button:active { transform: scale(0.98); }
        .vps-dialog-button.primary { background: #74C0FC; color: #1a1a1a; }
        .vps-dialog-button.danger { background: #E57373; color: #1a1a1a; }
        .vps-dialog-button.secondary { background: #555; color: #fff; }

        .vps-dialog-close-btn {
            position: absolute; top: 12px; left: 16px; background: none; border: none; color: #aaa;
            font-size: 28px; font-weight: bold; cursor: pointer; line-height: 1; padding: 0; z-index: 1;
        }
        .vps-dialog-close-btn:hover { color: #fff; }
        .vps-dialog-header-actions { display: flex; gap: 10px; }
        .vps-header-button {
            background: none; border: none; color: #f1f1f1; font-size: 20px; cursor: pointer;
            padding: 5px; border-radius: 5px; transition: background-color 0.2s;
            display: flex; align-items: center; justify-content: center;
            width: 32px; height: 32px;
        }
        .vps-header-button:hover { background-color: rgba(255, 255, 255, 0.1); }

        /* Config Panel Enhancements */
        .vps-config-field small { font-size: 0.8em; color: #999; display: block; margin-bottom: 15px; }
        #vps-test-connection-result { margin-top: 15px; padding: 10px; border-radius: 8px; display: none; }
        #vps-test-connection-result.success { background: rgba(129, 199, 132, 0.2); color: #a5d6a7; }
        #vps-test-connection-result.error { background: rgba(229, 115, 115, 0.2); color: #ef9a9a; }
        @keyframes vps-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .vps-spinner { display: inline-block; width: 1em; height: 1em; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: vps-spin 1s linear infinite; }

        /* History Panel Enhancements */
        .vps-history-controls {
            display: flex; gap: 15px; padding-bottom: 20px; margin-bottom: 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .vps-history-search, .vps-history-sort {
            padding: 10px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2);
            background: #3a3a3a; color: #f1f1f1; font-size: 14px;
        }
        .vps-history-search { flex-grow: 1; }
        .vps-history-list { display: flex; flex-direction: column; gap: 10px; }
        .vps-history-item {
            background: rgba(255, 255, 255, 0.05); border-radius: 10px; padding: 12px;
            display: flex; align-items: center; gap: 12px;
            transition: background-color 0.2s ease, opacity 0.3s ease, transform 0.3s ease, margin-bottom 0.3s ease, padding 0.3s ease, height 0.3s ease;
        }
        .vps-history-item:hover { background: rgba(255, 255, 255, 0.1); }
        .vps-history-item-checkbox { flex-shrink: 0; width: 18px; height: 18px; accent-color: #74C0FC; margin: 0; }
        .vps-history-item-favicon { flex-shrink: 0; width: 24px; height: 24px; border-radius: 4px; background-color: rgba(0,0,0,0.2); }
        .vps-history-item-details { flex-grow: 1; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
        .vps-history-item-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .vps-history-item-title a { color: #f1f1f1; text-decoration: none; }
        .vps-history-item-title a:hover { text-decoration: underline; }
        .vps-history-item-progress-bar-container { background: rgba(0,0,0,0.3); border-radius: 5px; height: 8px; overflow: hidden; }
        .vps-history-item-progress-bar { background: #74C0FC; height: 100%; width: 0%; border-radius: 5px; transition: width 0.4s ease; }
        .vps-history-item-meta { font-size: 0.8em; color: #aaa; }
        .vps-history-item-delete {
            background: #E57373; color: #f1f1f1; border: none; border-radius: 8px; cursor: pointer; padding: 8px;
            font-size: 18px; line-height: 1; display: flex; align-items: center; justify-content: center;
            transition: background-color 0.2s ease, opacity 0.2s ease, transform 0.2s ease;
            opacity: 0; transform: scale(0.8); flex-shrink: 0;
        }
        .vps-history-item:hover .vps-history-item-delete { opacity: 1; transform: scale(1); }
        .vps-history-item-delete:hover { background: #ef5350; }
        .vps-history-item-completed { color: #81C784; font-weight: bold; }
        .vps-history-empty { text-align: center; padding: 40px 20px; color: #aaa; }
        .vps-history-empty svg { width: 50px; height: 50px; margin-bottom: 15px; opacity: 0.5; }

        .vps-bulk-actions-bar {
            padding: 12px 24px; background: rgba(0,0,0,0.3); display: flex; justify-content: space-between;
            align-items: center; transition: opacity 0.3s; opacity: 0; pointer-events: none; margin-top: -1px;
        }
        .vps-bulk-actions-bar.vps-show { opacity: 1; pointer-events: auto; }
        .vps-bulk-actions-bar span { font-weight: 600; }

        @media (max-width: 768px) {
            .vps-dialog {
                width: 100%;
                max-width: 100%;
                height: 100%;
                max-height: 100%;
                border-radius: 0;
                top: 0;
                left: 0;
                transform: translateY(100%); /* Start off-screen */
                transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
            }

            .vps-dialog-overlay.vps-show .vps-dialog {
                transform: translateY(0);
            }

            .vps-dialog-header {
                padding: 12px 16px;
                font-size: 1.1em;
            }

            .vps-dialog-body {
                padding: 16px;
                max-height: calc(100vh - 120px); /* Adjust based on header/footer height */
            }

            .vps-dialog-footer {
                padding: 12px 16px;
                flex-direction: row; /* Revert to row for side-by-side buttons */
                justify-content: space-around; /* Space out buttons evenly */
                gap: 10px;
                position: absolute;
                bottom: 0;
                width: 100%;
                background: rgba(0,0,0,0.4);
            }

            .vps-dialog-button {
                width: auto; /* Auto width for buttons */
                flex-grow: 1; /* Allow buttons to grow and fill space */
                padding: 12px;
            }

            .vps-history-controls {
                flex-direction: column;
                gap: 10px;
            }

            .vps-history-item {
                display: grid;
                grid-template-columns: auto auto 1fr auto;
                grid-template-rows: auto auto;
                gap: 5px 15px;
                align-items: center;
                position: relative;
            }

            .vps-history-item-checkbox {
                grid-column: 1;
                grid-row: 1 / span 2;
            }

            .vps-history-item-favicon {
                grid-column: 2;
                grid-row: 1 / span 2;
                width: 32px; /* Slightly larger favicon */
                height: 32px;
            }

            .vps-history-item-title {
                grid-column: 3;
                grid-row: 1;
            }
            
            .vps-history-item-progress-bar-container {
                grid-column: 3;
                grid-row: 2;
            }

            .vps-history-item-meta {
                display: none; /* Hide meta on mobile to save space */
            }

            .vps-history-item-delete {
                grid-column: 4;
                grid-row: 1 / span 2;
                position: static; /* Remove absolute positioning */
                opacity: 1;
                transform: scale(1);
            }
            .vps-dialog-button .vps-button-text { display: none; }
        }
    `;

    /**
     * --- META MODULE ---
     */
    const Meta = {
        addViewport() {
            if (document.querySelector('meta[name="viewport"]')) return;
            const viewport = document.createElement('meta');
            viewport.name = 'viewport';
            viewport.content = 'width=device-width, initial-scale=1.0';
            document.head.appendChild(viewport);
        }
    };

    /**
     * --- DIALOG MODULE ---
     */
    const Dialog = {
        currentOpenDialog: null,
        show(options) {
            if (this.currentOpenDialog) {
                this.close(this.currentOpenDialog);
            }
            return new Promise((resolve) => {
                const overlay = document.createElement('div');
                overlay.className = 'vps-dialog-overlay';

                const dialog = document.createElement('div');
                dialog.className = 'vps-dialog';
                dialog.innerHTML = `
                    ${options.showCloseButton ? '<button class="vps-dialog-close-btn" title="Close">&times;</button>' : ''}
                    <div class="vps-dialog-header">${options.title}</div>
                    <div class="vps-dialog-body">${options.body || ''}</div>
                    <div class="vps-dialog-footer"></div>
                `;

                if (options.showCloseButton) {
                    dialog.querySelector('.vps-dialog-close-btn').onclick = () => {
                        resolve({ button: 'close' });
                        this.close(overlay);
                    };
                }

                const footer = dialog.querySelector('.vps-dialog-footer');
                if (options.buttons && options.buttons.length > 0) {
                    (options.buttons || []).forEach(btn => {
                        const button = document.createElement('button');
                        button.className = `vps-dialog-button ${btn.class || 'secondary'}`;
                        button.id = `vps-dialog-btn-${btn.id}`;
                        button.innerHTML = btn.text; // Use innerHTML to support icons
                        button.onclick = () => {
                            const result = { button: btn.id };
                            if (options.form) {
                                result.formData = {};
                                dialog.querySelectorAll('[name]').forEach(input => { result.formData[input.name] = input.value; });
                            }
                            // Don't close on test button
                            if (btn.id !== 'test') {
                                resolve(result);
                                this.close(overlay);
                            }
                        };
                        footer.appendChild(button);
                    });
                } else {
                    footer.style.display = 'none';
                }

                overlay.onclick = (e) => {
                    if (e.target === overlay && options.cancellable) {
                        resolve({ button: 'cancel' });
                        this.close(overlay);
                    }
                };

                overlay.appendChild(dialog);
                document.body.appendChild(overlay);
                this.currentOpenDialog = overlay;

                setTimeout(() => {
                    overlay.classList.add('vps-show');
                    if (options.onOpen) {
                        options.onOpen(dialog);
                    }
                }, 10);
            });
        },

        close(overlay) {
            if (!overlay) return;
            overlay.classList.remove('vps-show');
            setTimeout(() => overlay.remove(), 300);
            if (overlay === this.currentOpenDialog) {
                this.currentOpenDialog = null;
            }
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
     * --- FIREBASE AUTH MODULE ---
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
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ returnSecureToken: true })
                });
                if (!response.ok) {
                    console.error('VPS: Anonymous login failed', await response.text());
                    return null;
                }
                const data = await response.json();
                const tokenData = {
                    apiKey: apiKey,
                    idToken: data.idToken,
                    refreshToken: data.refreshToken,
                    expiresAt: Date.now() + (parseInt(data.expiresIn) * 1000) - 30000 // 30s buffer
                };
                await GM_setValue('vps_firebase_auth_token', tokenData);
                return tokenData.idToken;
            } catch (e) {
                console.error('VPS: Anonymous login network error', e);
                return null;
            }
        },
        async refreshToken(config, refreshToken) {
            const apiKey = this.getApiKey(config);
            const url = `https://securetoken.googleapis.com/v1/token?key=${apiKey}`;
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken })
                });
                if (!response.ok) {
                    console.error('VPS: Token refresh failed', await response.text());
                    return await this.anonymousLogin(config);
                }
                const data = await response.json();
                const tokenData = {
                    apiKey: apiKey,
                    idToken: data.id_token,
                    refreshToken: data.refresh_token,
                    expiresAt: Date.now() + (parseInt(data.expires_in) * 1000) - 30000 // 30s buffer
                };
                await GM_setValue('vps_firebase_auth_token', tokenData);
                return tokenData.idToken;
            } catch (e) {
                console.error('VPS: Token refresh network error', e);
                return await this.anonymousLogin(config); // Fallback to new login
            }
        }
    };

    /**
     * --- FIREBASE SYNC MODULE ---
     */
    const Firebase = {
        config: { enabled: false, databaseURL: '', path: '', projectId: '', apiKey: '', databaseSecret: '' },
        async init() {
            const storedConfig = await GM_getValue(CONFIG.FIREBASE_CONFIG_KEY, {});
            this.config = { ...this.config, ...storedConfig };
        },
        isEnabled() { return this.config.enabled && this.config.databaseURL && this.config.path; },
        _getSafeKey(key) { return encodeURIComponent(key).replace(/\\./g, '%2E'); },

        async _getUrlWithAuth(baseUrl, config) {
            const effectiveConfig = config || this.config;

            // Priority 1: Use Database Secret if provided.
            if (effectiveConfig.databaseSecret) {
                const separator = baseUrl.includes('?') ? '&' : '?';
                return `${baseUrl}${separator}auth=${effectiveConfig.databaseSecret}`;
            }

            // Priority 2: Use API Key token auth.
            if (effectiveConfig.apiKey) {
                const token = await Auth.getToken(effectiveConfig);
                if (token) {
                    const separator = baseUrl.includes('?') ? '&' : '?';
                    return `${baseUrl}${separator}auth=${token}`;
                }
            }

            // Fallback: No auth.
            return baseUrl;
        },

        async get(key) {
            if (!this.isEnabled()) return null;
            const baseUrl = `${this.config.databaseURL}/${this.config.path}/${this._getSafeKey(key)}.json`;
            const url = await this._getUrlWithAuth(baseUrl);
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            return response.ok ? await response.json() : null;
        },
        async set(key, data) {
            if (!this.isEnabled()) return;
            const baseUrl = `${this.config.databaseURL}/${this.config.path}/${this._getSafeKey(key)}.json`;
            const url = await this._getUrlWithAuth(baseUrl);
            await fetch(url, { method: 'PUT', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        },
        async getAll() {
            if (!this.isEnabled()) return null;
            const baseUrl = `${this.config.databaseURL}/${this.config.path}.json`;
            const url = await this._getUrlWithAuth(baseUrl);
            const response = await fetch(url, { method: 'GET', mode: 'cors' });
            return response.ok ? (await response.json() || {}) : null;
        },
        async setAll(data) {
            if (!this.isEnabled()) return;
            const baseUrl = `${this.config.databaseURL}/${this.config.path}.json`;
            const url = await this._getUrlWithAuth(baseUrl);
            await fetch(url, { method: 'PUT', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        },
        async delete(key) {
            if (!this.isEnabled()) return;
            const baseUrl = `${this.config.databaseURL}/${this.config.path}/${this._getSafeKey(key)}.json`;
            const url = await this._getUrlWithAuth(baseUrl);
            await fetch(url, { method: 'DELETE', mode: 'cors' });
        },
        async testConnection(testConfig) {
            if (!testConfig.databaseURL || !testConfig.path) {
                return { success: false, error: 'Database URL and Path are required.' };
            }
            try {
                let debugInfo = '';
                let token = null;

                // Step 1: Try to get a token if API key is present
                if (testConfig.apiKey) {
                    debugInfo = 'Attempting to get authentication token... ';
                    token = await Auth.getToken(testConfig);
                    if (token) {
                        debugInfo += 'OK. ';
                    } else {
                        return { success: false, error: 'Failed to retrieve an authentication token. This is the most common point of failure. Please RE-VERIFY that your API Key is correct and that the "Identity Platform" API is enabled in your Google Cloud project console for this project.' };
                    }
                } else {
                    debugInfo = 'No API Key provided. Attempting unauthenticated access. ';
                }

                debugInfo += 'Connecting to database... ';
                const baseUrl = `${testConfig.databaseURL}/${testConfig.path}.json?shallow=true&timeout=5s`;
                const url = await this._getUrlWithAuth(baseUrl, testConfig);

                const response = await fetch(url, { method: 'GET', mode: 'cors' });

                if (response.ok) {
                    return { success: true, message: 'Connection successful!' }; // Return a success message
                }

                // If it fails, provide the debug info
                const errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    let errorMessage = errorJson.error || 'Unknown error.';

                    if (token) {
                         errorMessage = `Got auth token, but request was denied. Error: "${errorMessage}". This means authentication worked, but your database security rules are still blocking access. Please ensure the rules are applied to the ROOT of your database and are exactly: \`{ "rules": { ".read": "auth != null", ".write": "auth != null" } }\`. Also, re-verify your Database URL is correct.`;
                    } else {
                         errorMessage = `Request was denied without an auth token. Error: "${errorMessage}". Your rules likely require authentication, but no API key was provided or it failed.`;
                    }
                    return { success: false, error: errorMessage };
                } catch (e) {
                    return { success: false, error: `Received an invalid response from the server (HTTP ${response.status}). Please check your Database URL.` };
                }
            } catch (e) {
                return { success: false, error: `A network error occurred: ${e.message}. This could be a typo in the URL, a firewall, or a network connectivity issue.` };
            }
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
        },
        async deleteEntry(videoKey) {
            const allData = await this.getAll();
            delete allData[videoKey];
            await this.saveAll(allData);
            if (Firebase.isEnabled()) await Firebase.delete(videoKey);
        }
    };

    /**
     * --- UI MODULE ---
     */
    const UI = {
        init() {
            Meta.addViewport();
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
            toast.innerHTML = `${ICONS.RESTORE}<span>Restored to ${minutes}:${seconds}</span>`;
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
                if (window.location.hostname.includes('youtube.com')) {
                    if (!video.closest('#movie_player')) {
                        return; // It's a YouTube preview/thumbnail video, ignore it.
                    }
                }
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
                if (video.duration <= CONFIG.MIN_VIDEO_DURATION_SECONDS) return;
                const data = await Storage.getEntry(this.getVideoKey());
                if (data && !data.completed && data.timestamp > 0 && data.timestamp < data.duration - 5) {
                    video.currentTime = data.timestamp;
                    UI.showRestoredMessage(video, data.timestamp);
                }
            }, { once: true });

            video.addEventListener('timeupdate', async () => {
                if (video.paused || video.seeking || video.ended || video.duration <= CONFIG.MIN_VIDEO_DURATION_SECONDS) return;
                if (Math.abs(video.currentTime - lastSavedTime) > CONFIG.SAVE_INTERVAL_SECONDS) {
                    lastSavedTime = video.currentTime;
                    const isCompleted = (video.duration - video.currentTime) < CONFIG.COMPLETION_THRESHOLD_SECONDS;
                    await Storage.updateEntry(this.getVideoKey(), { ...getInfo(), completed: isCompleted });
                }
            });

            video.addEventListener('pause', async () => {
                if (video.duration <= CONFIG.MIN_VIDEO_DURATION_SECONDS || video.currentTime < 1) return;
                const isCompleted = (video.duration - video.currentTime) < CONFIG.COMPLETION_THRESHOLD_SECONDS;
                await Storage.updateEntry(this.getVideoKey(), { ...getInfo(), completed: isCompleted });
            });
        }
    };

    /**
     * --- MENU MODULE ---
     */
    const Menu = {
        init() {
            if (window.self !== window.top) return;
            GM_registerMenuCommand('⚙️ Configure Sync', () => this.configureSync());
            GM_registerMenuCommand('🔄 Sync Now', () => this.syncNow());
            GM_registerMenuCommand('👁️ Watching History', () => this.showHistory());
        },

        async showHistory() {
            if (window.self !== window.top) return;

            let allData = await Storage.getAll();
            let selectedKeys = new Set();
            let currentSort = 'lastUpdate-desc';
            let currentSearch = '';

            const titleHtml = `
                <div style="display: flex; align-items: center; gap: 15px; width: 100%;">
                    <span style="display: flex; align-items: center; gap: 8px;">${ICONS.EYE} Watching History</span>
                    <div class="vps-dialog-header-actions">
                        <button class="vps-header-button" id="vps-export-btn" title="Export All Progress">${ICONS.EXPORT}</button>
                        <button class="vps-header-button" id="vps-import-btn" title="Import All Progress">${ICONS.IMPORT}</button>
                        <button class="vps-header-button" id="vps-clear-btn" title="Clear Local Progress">${ICONS.TRASH}</button>
                    </div>
                </div>
            `;

            const bodyHtml = `
                <div class="vps-history-controls">
                    <input type="search" class="vps-history-search" placeholder="Search by title...">
                    <select class="vps-history-sort">
                        <option value="lastUpdate-desc">Last Updated</option>
                        <option value="title-asc">Title (A-Z)</option>
                        <option value="title-desc">Title (Z-A)</option>
                        <option value="progress-desc">Progress (Most)</option>
                        <option value="progress-asc">Progress (Least)</option>
                    </select>
                </div>
                <div class="vps-history-list"></div>
            `;

            Dialog.show({
                title: titleHtml,
                body: bodyHtml,
                cancellable: true,
                showCloseButton: true,
                onOpen: (dialog) => {
                    const bulkActionBar = document.createElement('div');
                    bulkActionBar.className = 'vps-bulk-actions-bar';
                    dialog.querySelector('.vps-dialog-body').after(bulkActionBar);

                    const listEl = dialog.querySelector('.vps-history-list');
                    const searchInput = dialog.querySelector('.vps-history-search');
                    const sortSelect = dialog.querySelector('.vps-history-sort');

                    const updateBulkActionBar = () => {
                        if (selectedKeys.size > 0) {
                            bulkActionBar.innerHTML = `
                                <span>${selectedKeys.size} item${selectedKeys.size > 1 ? 's' : ''} selected</span>
                                <button class="vps-dialog-button danger" id="vps-bulk-delete-btn">${ICONS.TRASH} Delete Selected</button>
                            `;
                            bulkActionBar.classList.add('vps-show');
                            bulkActionBar.querySelector('#vps-bulk-delete-btn').onclick = handleBulkDelete;
                        } else {
                            bulkActionBar.classList.remove('vps-show');
                        }
                    };

                    const renderList = () => {
                        const filtered = Object.entries(allData).filter(([key, data]) =>
                            data && data.pageTitle && data.pageTitle.toLowerCase().includes(currentSearch.toLowerCase())
                        );

                        const sorters = {
                            'lastUpdate-desc': (a, b) => (b[1]?.lastUpdate || 0) - (a[1]?.lastUpdate || 0),
                            'title-asc': (a, b) => (a[1]?.pageTitle || '').localeCompare(b[1]?.pageTitle || ''),
                            'title-desc': (a, b) => (b[1]?.pageTitle || '').localeCompare(a[1]?.pageTitle || ''),
                            'progress-desc': (a, b) => {
                                const progressB = b[1]?.duration ? (b[1].timestamp / b[1].duration) : 0;
                                const progressA = a[1]?.duration ? (a[1].timestamp / a[1].duration) : 0;
                                return (progressB || 0) - (progressA || 0);
                            },
                            'progress-asc': (a, b) => {
                                const progressA = a[1]?.duration ? (a[1].timestamp / a[1].duration) : 0;
                                const progressB = b[1]?.duration ? (b[1].timestamp / b[1].duration) : 0;
                                return (progressA || 0) - (progressB || 0);
                            },
                        };
                        filtered.sort(sorters[currentSort]);

                        if (filtered.length === 0) {
                            listEl.innerHTML = `<div class="vps-history-empty">${ICONS.EYE}<div>No history found.</div></div>`;
                        } else {
                            listEl.innerHTML = filtered.map(([key, data]) => this.createHistoryItemHtml(key, data, selectedKeys.has(key))).join('');
                        }
                        attachItemListeners();
                        updateBulkActionBar();
                    };

                    const handleItemCheckboxChange = (e) => {
                        const key = e.target.dataset.key;
                        if (e.target.checked) {
                            selectedKeys.add(key);
                        } else {
                            selectedKeys.delete(key);
                        }
                        updateBulkActionBar();
                    };

                    const handleSingleDelete = async (e) => {
                        const itemEl = e.target.closest('.vps-history-item');
                        const videoKey = itemEl.dataset.key;
                        const { button: confirmButton } = await Dialog.show({
                            title: 'Confirm Deletion',
                            body: '<p>Are you sure you want to delete this entry?</p>',
                            buttons: [{id: 'cancel', text: 'Cancel'}, {id: 'ok', text: 'Delete', class: 'danger'}]
                        });
                        if (confirmButton === 'ok') {
                            await Storage.deleteEntry(videoKey);
                            delete allData[videoKey];
                            selectedKeys.delete(videoKey);
                            renderList();
                        }
                    };

                    const handleBulkDelete = async () => {
                        const { button: confirmButton } = await Dialog.show({
                            title: `Delete ${selectedKeys.size} Items?`,
                            body: `<p>Are you sure you want to delete the ${selectedKeys.size} selected entries?</p>`,
                            buttons: [{id: 'cancel', text: 'Cancel'}, {id: 'ok', text: 'Delete', class: 'danger'}]
                        });
                        if (confirmButton === 'ok') {
                            const loader = Dialog.showLoader('Deleting...');
                            for (const key of selectedKeys) {
                                await Storage.deleteEntry(key);
                                delete allData[key];
                            }
                            selectedKeys.clear();
                            loader.close();
                            renderList();
                        }
                    };

                    function attachItemListeners() {
                        listEl.querySelectorAll('.vps-history-item-checkbox').forEach(el => el.onchange = handleItemCheckboxChange);
                        listEl.querySelectorAll('.vps-history-item-delete').forEach(el => el.onclick = handleSingleDelete);
                    }

                    searchInput.oninput = (e) => { currentSearch = e.target.value; renderList(); };
                    sortSelect.onchange = (e) => { currentSort = e.target.value; renderList(); };

                    dialog.querySelector('#vps-export-btn').onclick = () => this.exportData();
                    dialog.querySelector('#vps-import-btn').onclick = async () => {
                        if (await this.importData()) {
                            allData = await Storage.getAll();
                            renderList();
                        }
                    };
                    dialog.querySelector('#vps-clear-btn').onclick = async () => {
                        if (await this.clearData()) {
                            allData = {};
                            selectedKeys.clear();
                            renderList();
                        }
                    };

                    renderList();
                }
            });
        },

        getFaviconUrl(pageUrl) {
            try {
                const url = new URL(pageUrl);
                return `https://www.google.com/s2/favicons?sz=32&domain_url=${url.hostname}`;
            } catch (e) {
                return '';
            }
        },

        createHistoryItemHtml(key, data, isSelected) {
            const { pageTitle, pageUrl, timestamp, duration, lastUpdate, completed } = data;
            const progressPercent = duration > 0 ? (timestamp / duration) * 100 : 0;

            const formatTime = (seconds) => {
                if (isNaN(seconds) || seconds === null) return '00:00';
                const h = Math.floor(seconds / 3600);
                const m = Math.floor((seconds % 3600) / 60);
                const s = Math.floor(seconds % 60);
                return h > 0
                    ? `${h.toString()}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
                    : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            };

            const timeMeta = completed
                ? `<span class="vps-history-item-completed" style="display: flex; align-items: center; gap: 4px;">${ICONS.CHECK} Completed</span>`
                : `${formatTime(timestamp)} / ${formatTime(duration)}`;

            const lastUpdateDate = lastUpdate ? new Date(lastUpdate).toLocaleString() : 'N/A';
            const progressTooltip = `${timeMeta} (${Math.round(completed ? 100 : progressPercent)}%)`;

            return `
                <div class="vps-history-item" data-key="${key}">
                    <input type="checkbox" class="vps-history-item-checkbox" data-key="${key}" ${isSelected ? 'checked' : ''}>
                    <img src="${this.getFaviconUrl(pageUrl)}" class="vps-history-item-favicon" alt="">
                    <div class="vps-history-item-title"><a href="${pageUrl}" target="_blank" title="${pageUrl}">${pageTitle || 'Untitled'}</a></div>
                    <div class="vps-history-item-progress-bar-container" title="${progressTooltip}">
                        <div class="vps-history-item-progress-bar" style="width: ${completed ? 100 : progressPercent}%;"></div>
                    </div>
                    <div class="vps-history-item-meta">
                        <span>${timeMeta}</span> &bull; <span>${lastUpdateDate}</span>
                    </div>
                    <button class="vps-history-item-delete" title="Delete Entry">${ICONS.TRASH}</button>
                </div>
            `;
        },

        async configureSync() {
            const config = await Storage.get(CONFIG.FIREBASE_CONFIG_KEY) || {};
            const formHtml = `
                <div class="vps-config-field">
                    <label for="vps-dbUrl">Database URL (Required)</label>
                    <input type="text" id="vps-dbUrl" name="databaseURL" placeholder="https://my-project-default-rtdb.firebaseio.com" value="${config.databaseURL || ''}">
                    <small>The URL of your Firebase Realtime Database.</small>
                </div>
                <div class="vps-config-field">
                    <label for="vps-path">Collection Path (Required)</label>
                    <input type="text" id="vps-path" name="path" placeholder="e.g., videoProgress" value="${config.path || 'videoProgress'}">
                    <small>A name for the data collection, like a folder name.</small>
                </div>
                <hr>
                <p>For authentication, provide <b>either</b> an API Key (recommended) <b>or</b> a Database Secret.</p>
                <div class="vps-config-field">
                    <label for="vps-apiKey">API Key (Recommended)</label>
                    <input type="text" id="vps-apiKey" name="apiKey" placeholder="AIzaSy..." value="${config.apiKey || ''}">
                    <small>Your Firebase project's Web API Key for token-based authentication.</small>
                </div>
                <div class="vps-config-field">
                    <label for="vps-databaseSecret">Database Secret (Alternative)</label>
                    <input type="text" id="vps-databaseSecret" name="databaseSecret" placeholder="Your legacy database secret" value="${config.databaseSecret || ''}">
                    <small>A less secure, deprecated alternative to the API Key.</small>
                </div>
                <hr>
                <p>The fields below are optional and rarely needed.</p>
                 <div class="vps-config-field">
                    <label for="vps-apiKey">API Key</label>
                    <input type="text" id="vps-apiKey" name="apiKey" placeholder="AIzaSy..." value="${config.apiKey || ''}">
                    <small>Your Firebase project's Web API Key.</small>
                </div>
                <div class="vps-config-field">
                    <label for="vps-projectId">Project ID</label>
                    <input type="text" id="vps-projectId" name="projectId" placeholder="e.g., my-cool-project" value="${config.projectId || ''}">
                    <small>Your Google Cloud project ID.</small>
                </div>
                <div class="vps-config-field">
                    <label for="vps-authDomain">Auth Domain</label>
                    <input type="text" id="vps-authDomain" name="authDomain" placeholder="my-project.firebaseapp.com" value="${config.authDomain || ''}">
                    <small>Your project's authentication domain.</small>
                </div>
                <div class="vps-config-field">
                    <label for="vps-storageBucket">Storage Bucket</label>
                    <input type="text" id="vps-storageBucket" name="storageBucket" placeholder="my-project.appspot.com" value="${config.storageBucket || ''}">
                    <small>Your project's Cloud Storage bucket.</small>
                </div>
                <div id="vps-test-connection-result"></div>
            `;

            const dialogPromise = Dialog.show({
                title: `<span style="display: flex; align-items: center; gap: 8px;">${ICONS.GEAR} Configure Sync</span>`,
                cancellable: true,
                showCloseButton: true,
                form: true,
                body: formHtml,
                buttons: [
                    ...(config.enabled ? [{ id: 'disable', text: `${ICONS.TRASH}<span class="vps-button-text">Disable Sync</span>`, class: 'danger' }] : []),
                    { id: 'test', text: `${ICONS.WIFI}<span class="vps-button-text">Test Connection</span>`, class: 'secondary' },
                    { id: 'cancel', text: `${ICONS.CLOSE}<span class="vps-button-text">Cancel</span>`, class: 'secondary' },
                    { id: 'save', text: `${ICONS.CHECK}<span class="vps-button-text">Save & Reload</span>`, class: 'primary' }
                ],
                onOpen: (dialog) => {
                    const testBtn = dialog.querySelector('#vps-dialog-btn-test');
                    const resultEl = dialog.querySelector('#vps-test-connection-result');

                    testBtn.onclick = async () => {
                        const formData = {};
                        dialog.querySelectorAll('[name]').forEach(input => { formData[input.name] = input.value; });

                        testBtn.disabled = true;
                        testBtn.innerHTML = `<span class="vps-spinner"></span><span class="vps-button-text"> Testing...</span>`;
                        resultEl.style.display = 'none';

                        const result = await Firebase.testConnection(formData);

                        resultEl.textContent = result.success ? 'Connection successful!' : `Error: ${result.error}`;
                        resultEl.className = result.success ? 'success' : 'error';
                        resultEl.style.display = 'block';

                        testBtn.disabled = false;
                        testBtn.innerHTML = `${ICONS.WIFI}<span class="vps-button-text">Test Connection</span>`;
                    };
                }
            });

            const { button, formData } = await dialogPromise;

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
                        databaseSecret: formData.databaseSecret || '',
                        path: formData.path.replace(/^\/|\/$/g, '')
                    };

                    await Storage.set(CONFIG.FIREBASE_CONFIG_KEY, newConfig);
                    await Dialog.show({ title: 'Success', body: '<p>Firebase sync configured. The page will now reload.</p>', buttons: [{id: 'ok', text: 'OK', class: 'primary'}] });
                    location.reload();
                } catch (e) { await Dialog.show({ title: 'Error', body: `<p>Configuration failed: ${e.message}</p>`, buttons: [{id: 'ok', text: 'OK', class: 'primary'}] }); }
            } else if (button === 'disable') {
                config.enabled = false;
                await Storage.set(CONFIG.FIREBASE_CONFIG_KEY, config);
                await Dialog.show({ title: 'Sync Disabled', body: '<p>Firebase sync has been disabled. The page will reload.</p>', buttons: [{id: 'ok', text: 'OK', class: 'primary'}] });
                location.reload();
            }
        },

        async syncNow() {
            if (window.self !== window.top) return;
            if (!Firebase.isEnabled()) return Dialog.show({ title: 'Error', body: '<p>Firebase sync is not configured.</p>', buttons: [{id: 'ok', text: 'OK', class: 'primary'}] });
            const loader = Dialog.showLoader(`<span style="display: flex; align-items: center; gap: 8px;">${ICONS.SYNC} Syncing Now</span>`);
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
                await Dialog.show({ title: 'Sync Complete', body: '<p>Local and remote data have been merged. Page will reload.</p>', buttons: [{id: 'ok', text: 'OK', class: 'primary'}] });
                location.reload();
            } catch (error) {
                loader.close();
                await Dialog.show({ title: 'Sync Failed', body: `<p>${error.message}</p>`, buttons: [{id: 'ok', text: 'OK', class: 'primary'}] });
            }
        },

        async exportData() {
            if (window.self !== window.top) return;
            const data = await Storage.getAll();
            if (Object.keys(data).length === 0) return Dialog.show({ title: 'Export', body: '<p>No data to export.</p>', buttons: [{id: 'ok', text: 'OK', class: 'primary'}] });
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
            return new Promise(resolve => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json,application/json';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return resolve(false);
                    try {
                        const data = JSON.parse(await file.text());
                        if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('Invalid file format.');
                        const { button } = await Dialog.show({ title: `<span style="display: flex; align-items: center; gap: 8px;">${ICONS.IMPORT} Import Progress</span>`, body: '<p>Overwrite all local progress with the selected file?</p>', buttons: [{id: 'cancel', text: 'Cancel'}, {id: 'ok', text: 'Confirm', class: 'primary'}] });
                        if (button === 'ok') {
                            await Storage.saveAll(data);
                            await Dialog.show({ title: 'Import Successful', body: '<p>Data imported. Use "Sync Now" to push to Firebase if needed.</p>', buttons: [{id: 'ok', text: 'OK', class: 'primary'}] });
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    } catch (error) {
                        await Dialog.show({ title: 'Import Failed', body: `<p>${error.message}</p>`, buttons: [{id: 'ok', text: 'OK', class: 'primary'}] });
                        resolve(false);
                    } finally {
                        input.remove();
                    }
                };
                input.click();
            });
        },

        async clearData() {
            if (window.self !== window.top) return;
            const { button } = await Dialog.show({
                title: `<span style="display: flex; align-items: center; gap: 8px;">${ICONS.TRASH} Clear Local Progress</span>`,
                body: '<p>Are you sure you want to delete ALL locally saved progress?</p><p>This does not affect remote data.</p>',
                buttons: [{id: 'cancel', text: 'Cancel'}, {id: 'ok', text: 'Confirm Clear', class: 'danger'}]
            });
            if (button === 'ok') {
                await Storage.saveAll({});
                await Dialog.show({ title: 'Success', body: '<p>All local progress has been cleared.</p>', buttons: [{id: 'ok', text: 'OK', class: 'primary'}] });
                return true;
            }
            return false;
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
