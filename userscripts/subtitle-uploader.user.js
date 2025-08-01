// ==UserScript==
// @name         Subtitle Uploader (Stable)
// @namespace    https://github.com/itsrody/SuperBrowsing
// @version      1.0
// @description  Upload, style, and sync local subtitles for any video.
// @author       Murtaza Salih (Rebuilt by Gemini)
// @match        *://*/*
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.addStyle
// @run-at       document-end
// ==/UserScript==

(async () => {
'use strict';

// --- Default Settings & Global State ---
const defaultSettings = {
    fontSize: 24,
    fontColor: '#ffffff',
    fontFamily: 'sans-serif',
    textOutline: true,
    bgColor: '#000000',
    bgToggle: true,
    bgOpacity: 0.6,
    offsetY: 95,
    delay: 0,
    encoding: 'UTF-8',
};

let settings = await GM.getValue('subtitleSettings', defaultSettings);
const videoDataMap = new Map();
let globalIndicator = null;
let settingsPanel = null;
let activeVideo = null;

// --- Core Logic: Subtitle Processing & Rendering ---

function processSubtitleFile(video, file, encoding = settings.encoding) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            let text = reader.result;
            if (file.name.endsWith('.srt')) text = srtToVtt(text);
            const cues = parseVtt(text);
            if (cues.length === 0) throw new Error("No valid cues found.");

            const data = videoDataMap.get(video);
            if(data) {
                data.lastFile = file;
            }

            addSubtitleTrack(video, file.name, cues);
            const successIcon = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
            showIndicator(`${successIcon} "${file.name}" Loaded`);
        } catch (error) {
            console.error("Subtitle Error:", error);
            const errorIcon = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
            showIndicator(`${errorIcon} Invalid Subtitle File`, 3000);
        }
    };
    reader.readAsText(file, encoding);
}

function addSubtitleTrack(video, label, cues) {
    const data = videoDataMap.get(video);
    if (!data) return;

    Array.from(video.textTracks).forEach(track => track.mode = 'disabled');

    if (!data.display) {
        data.display = getOrCreateSubtitleDisplay(data.container);
        video.addEventListener('timeupdate', () => renderCustomSubtitle(video));
    }

    const existingTrackIndex = (data.tracks || []).findIndex(t => t.label === label);
    if (existingTrackIndex > -1) {
        data.tracks[existingTrackIndex] = { label, cues };
        data.currentTrackIndex = existingTrackIndex;
    } else {
        if (!data.tracks) data.tracks = [];
        data.tracks.push({ label, cues });
        data.currentTrackIndex = data.tracks.length - 1;
    }

    updateTrackSelector(video);
    applySettings();
}

function renderCustomSubtitle(video) {
    const data = videoDataMap.get(video);
    if (!data || !data.display) return;

    const track = data.tracks ? data.tracks[data.currentTrackIndex] : null;
    const adjustedTime = video.currentTime + (settings.delay / 1000);
    const activeCue = track ? track.cues.find(cue => adjustedTime >= cue.start && adjustedTime <= cue.end) : null;

    if (activeCue) {
        if (activeCue !== data.lastCue) {
            data.display.innerHTML = activeCue.text;
            data.lastCue = activeCue;
        }
        data.display.classList.add('visible');
        updateSubtitlePosition(video, data.display);
    } else {
        data.display.classList.remove('visible');
        data.lastCue = null;
    }
}

// --- UI Creation & Management ---

function getOrCreateSubtitleDisplay(container) {
    const ytCaptionWindow = container.querySelector('.ytp-caption-window-container');
    if (ytCaptionWindow) {
        let vgsDisplay = ytCaptionWindow.querySelector('.custom-subtitle-display');
        if (!vgsDisplay) {
            vgsDisplay = document.createElement('div');
            vgsDisplay.className = 'custom-subtitle-display vgs-youtube-subs';
            ytCaptionWindow.appendChild(vgsDisplay);
        }
        return vgsDisplay;
    }

    let vgsDisplay = container.querySelector('.custom-subtitle-display');
    if (!vgsDisplay) {
        vgsDisplay = document.createElement('div');
        vgsDisplay.className = 'custom-subtitle-display vgs-generic-subs';
        container.appendChild(vgsDisplay);
    }
    return vgsDisplay;
}

function createSubtitleControls(video, container) {
    if (videoDataMap.has(video) || !container) return;

    const controls = document.createElement('div');
    controls.className = 'subtitle-controls-container';
    container.addEventListener('mouseenter', () => container.classList.add('vgs-container-hover'));
    container.addEventListener('mouseleave', () => container.classList.remove('vgs-container-hover'));

    const btnUpload = createButton('Upload Subtitle', `<svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>`, (e) => {
        e.stopPropagation();
        handleUploadClick(video);
    });

    const btnSettings = createButton('Subtitle Settings', `<svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>`, (e) => {
        e.stopPropagation();
        openSettingsPanel(video);
    });
    
    const trackSelector = document.createElement('select');
    trackSelector.className = 'vgs-track-selector';
    trackSelector.title = "Select Subtitle Track";
    trackSelector.style.display = 'none';
    trackSelector.onchange = (e) => {
        const data = videoDataMap.get(video);
        if (data) {
            data.currentTrackIndex = parseInt(e.target.value, 10);
            renderCustomSubtitle(video);
        }
    };

    controls.append(btnUpload, btnSettings, trackSelector);
    container.appendChild(controls);

    videoDataMap.set(video, { controls, container, trackSelector, lastFile: null });
}

function updateTrackSelector(video) {
    const data = videoDataMap.get(video);
    if (!data || !data.trackSelector) return;

    const selector = data.trackSelector;
    selector.innerHTML = '';
    const offOption = new Option('Subtitles Off', -1);
    selector.add(offOption);

    if (data.tracks && data.tracks.length > 0) {
        data.tracks.forEach((track, index) => {
            selector.add(new Option(track.label, index));
        });
        selector.value = data.currentTrackIndex;
        selector.style.display = 'inline-block';
    } else {
        selector.style.display = 'none';
    }
}

function createSettingsPanel() {
    if (document.getElementById('vgs-settings-panel')) return;
    settingsPanel = document.createElement('div');
    settingsPanel.id = 'vgs-settings-panel';
    settingsPanel.innerHTML = `
        <div class="vgs-panel-content">
            <div class="vgs-panel-header">
                <h3>Subtitle Settings</h3>
                <span class="vgs-panel-close">&times;</span>
            </div>
            <div class="vgs-setting-grid">
                <div class="vgs-setting-row full-width">
                    <select id="vgs-font-family" title="Font Family">
                        <option value="sans-serif">Sans-Serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option>
                    </select>
                </div>
                <label for="vgs-font-size" class="vgs-label">Font Size</label>
                <div class="vgs-input-group"><input type="range" id="vgs-font-size" min="12" max="48" step="1"><span id="vgs-font-size-value"></span></div>
                <label class="vgs-label">Color & Style</label>
                <div class="vgs-input-group"><input type="color" id="vgs-font-color" title="Font Color"><label class="vgs-checkbox-label" title="Text Outline"><input type="checkbox" id="vgs-text-outline"> T</label></div>
                <label class="vgs-label">Background</label>
                <div class="vgs-input-group"><input type="color" id="vgs-bg-color" title="Background Color"><input type="checkbox" id="vgs-bg-toggle" title="Toggle Background"></div>
                <label for="vgs-bg-opacity" class="vgs-label">BG Opacity</label>
                <div class="vgs-input-group"><input type="range" id="vgs-bg-opacity" min="0" max="1" step="0.1"><span id="vgs-bg-opacity-value"></span></div>
                <label for="vgs-offsetY" class="vgs-label">V-Offset</label>
                <div class="vgs-input-group"><input type="range" id="vgs-offsetY" min="50" max="100" step="1"><span id="vgs-offsetY-value"></span></div>
                <div class="vgs-setting-row full-width">
                    <div class="vgs-center-container">
                        <label for="vgs-delay" class="vgs-label">Delay</label>
                        <div class="delay-group">
                            <button id="vgs-delay-minus" title="Decrease Delay (250ms)">-</button>
                            <input type="number" id="vgs-delay" step="50">
                            <button id="vgs-delay-plus" title="Increase Delay (250ms)">+</button>
                        </div>
                        <span>ms</span>
                    </div>
                </div>
                <label for="vgs-encoding" class="vgs-label">Encoding</label>
                <div class="encoding-group">
                     <select id="vgs-encoding">
                        <option value="UTF-8">UTF-8</option>
                        <option value="windows-1252">Western (windows-1252)</option>
                        <option value="windows-1251">Cyrillic (windows-1251)</option>
                        <option value="ISO-8859-1">Latin 1 (ISO-8859-1)</option>
                     </select>
                     <button id="vgs-reload-file" title="Reload last file with selected encoding">Reload</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(settingsPanel);
    
    settingsPanel.querySelector('.vgs-panel-close').onclick = closeSettingsPanel;
    
    settingsPanel.addEventListener('click', (e) => {
        if (e.target === settingsPanel) {
            closeSettingsPanel();
        }
    });

    const updateAndApply = () => {
        updateSettingsFromPanel();
        applySettings();
        updatePanelUI();
    };

    settingsPanel.querySelectorAll('input, select').forEach(input => input.addEventListener('input', updateAndApply));
    
    settingsPanel.querySelector('#vgs-delay-minus').onclick = () => {
        const input = settingsPanel.querySelector('#vgs-delay');
        input.value = (parseInt(input.value, 10) || 0) - 250;
        updateAndApply();
    };
    settingsPanel.querySelector('#vgs-delay-plus').onclick = () => {
        const input = settingsPanel.querySelector('#vgs-delay');
        input.value = (parseInt(input.value, 10) || 0) + 250;
        updateAndApply();
    };

    settingsPanel.querySelector('#vgs-reload-file').onclick = () => {
        if (activeVideo) {
            const data = videoDataMap.get(activeVideo);
            if (data && data.lastFile) {
                processSubtitleFile(activeVideo, data.lastFile, settings.encoding);
            } else {
                showIndicator("No file to reload.", 2000);
            }
        }
    };
    
    settingsPanel.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeSettingsPanel();
        if (e.key === '[') settingsPanel.querySelector('#vgs-delay-minus').click();
        if (e.key === ']') settingsPanel.querySelector('#vgs-delay-plus').click();
        if (e.altKey && e.key === '[') {
            const input = settingsPanel.querySelector('#vgs-font-size');
            input.value = parseInt(input.value, 10) - 1;
            updateAndApply();
        }
        if (e.altKey && e.key === ']') {
            const input = settingsPanel.querySelector('#vgs-font-size');
            input.value = parseInt(input.value, 10) + 1;
            updateAndApply();
        }
    });
}

function openSettingsPanel(video) {
    if (!settingsPanel) return;
    activeVideo = video;
    settingsPanel.wasPaused = video.paused;
    video.pause();
    
    document.getElementById('vgs-font-family').value = settings.fontFamily;
    document.getElementById('vgs-font-size').value = settings.fontSize;
    document.getElementById('vgs-font-color').value = settings.fontColor;
    document.getElementById('vgs-text-outline').checked = settings.textOutline;
    document.getElementById('vgs-bg-color').value = settings.bgColor;
    document.getElementById('vgs-bg-toggle').checked = settings.bgToggle;
    document.getElementById('vgs-bg-opacity').value = settings.bgOpacity;
    document.getElementById('vgs-offsetY').value = settings.offsetY;
    document.getElementById('vgs-delay').value = settings.delay;
    document.getElementById('vgs-encoding').value = settings.encoding;

    updatePanelUI();
    settingsPanel.style.display = 'flex';
}

function closeSettingsPanel() {
    if (settingsPanel && settingsPanel.style.display !== 'none') {
        if (activeVideo && !settingsPanel.wasPaused) {
            activeVideo.play().catch(e => console.error("Play failed:", e));
        }
        activeVideo = null;
        settingsPanel.style.display = 'none';
    }
}

function updatePanelUI() {
    if (!settingsPanel) return;
    document.getElementById('vgs-font-size-value').textContent = `${settings.fontSize}px`;
    document.getElementById('vgs-bg-opacity-value').textContent = `${Math.round(settings.bgOpacity * 100)}%`;
    document.getElementById('vgs-offsetY-value').textContent = `${settings.offsetY}%`;
}

// --- Event Handlers & Position Updaters ---

function handleUploadClick(video) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vtt,.srt';
    input.multiple = true;
    input.onchange = () => Array.from(input.files).forEach(file => processSubtitleFile(video, file));
    input.click();
}

function initializeForVideo(video) {
    if (!video || video.dataset.vgsHandled || video.duration < 30 || video.videoWidth < 200) return;
    
    waitForElement(video, findVideoContainer, (container) => {
        if (!container || video.dataset.vgsHandled) return;
        video.dataset.vgsHandled = 'true';
        
        createSubtitleControls(video, container);
        
        const dropIconSVG = `<svg viewBox="0 0 24 24" style="width:1.5em; height:1.5em; stroke:currentColor; stroke-width:2; fill:none; stroke-linecap:round; stroke-linejoin:round;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        container.addEventListener('dragover', e => {
            e.preventDefault();
            e.stopPropagation();
            showIndicator(`${dropIconSVG} Drop Subtitle File(s)`);
        });
        container.addEventListener('dragleave', e => {
            e.preventDefault();
            e.stopPropagation();
            hideIndicator();
        });
        container.addEventListener('drop', e => {
            e.preventDefault();
            e.stopPropagation();
            hideIndicator();
            if (e.dataTransfer.files.length > 0) {
                Array.from(e.dataTransfer.files).forEach(file => {
                    if (file.name.endsWith('.srt') || file.name.endsWith('.vtt')) {
                        processSubtitleFile(video, file);
                    }
                });
            }
        });
    });
}

function updateSubtitlePosition(video, display) {
    if (display.classList.contains('vgs-youtube-subs')) {
        const bottomPercent = 100 - settings.offsetY;
        display.style.bottom = `${bottomPercent}%`;
        return;
    }
    
    const data = videoDataMap.get(video);
    if (!data) return;
    const containerRect = data.container.getBoundingClientRect();
    
    const subtitleTop = (containerRect.height * (settings.offsetY / 100)) - display.offsetHeight;
    const subtitleLeft = containerRect.width / 2;
    
    display.style.top = `${subtitleTop}px`;
    display.style.left = `${subtitleLeft}px`;
    
    const maxWidth = Math.min(containerRect.width * 0.9, window.innerWidth * 0.9);
    display.style.maxWidth = `${maxWidth}px`;
}

function updateAllPositions() {
    for (const [video, data] of videoDataMap.entries()) {
        if (!document.body.contains(video)) {
            data.controls.remove();
            if (data.display) data.display.remove();
            videoDataMap.delete(video);
        } else {
            if (data.display) {
                updateSubtitlePosition(video, data.display);
            }
        }
    }
}

// --- Settings & Styles ---

function applySettings() {
    const { fontColor, fontSize, fontFamily, textOutline, bgToggle, bgColor, bgOpacity } = settings;
    const bg = bgToggle ? hexToRgba(bgColor, bgOpacity) : 'transparent';
    const shadow = textOutline ? '1px 1px 2px black, -1px -1px 2px black, 1px -1px 2px black, -1px 1px 2px black' : '1px 1px 2px rgba(0,0,0,0.7)';
    
    document.querySelectorAll('.custom-subtitle-display').forEach(display => {
        Object.assign(display.style, {
            color: fontColor,
            fontSize: `${fontSize}px`,
            fontFamily: fontFamily,
            backgroundColor: bg,
            textShadow: shadow,
        });
    });
    
    requestAnimationFrame(updateAllPositions);
}

async function updateSettingsFromPanel() {
    settings.fontSize = parseInt(document.getElementById('vgs-font-size').value, 10);
    settings.fontColor = document.getElementById('vgs-font-color').value;
    settings.fontFamily = document.getElementById('vgs-font-family').value;
    settings.textOutline = document.getElementById('vgs-text-outline').checked;
    settings.bgColor = document.getElementById('vgs-bg-color').value;
    settings.bgToggle = document.getElementById('vgs-bg-toggle').checked;
    settings.bgOpacity = parseFloat(document.getElementById('vgs-bg-opacity').value);
    settings.offsetY = parseInt(document.getElementById('vgs-offsetY').value, 10);
    settings.delay = parseInt(document.getElementById('vgs-delay').value, 10) || 0;
    settings.encoding = document.getElementById('vgs-encoding').value;
    await GM.setValue('subtitleSettings', settings);
}

function initializeStyles() {
    GM.addStyle(`
        .vgs-container { position: relative !important; overflow: hidden !important; }
        .subtitle-controls-container {
            position: absolute; top: 10px; left: 10px; z-index: 2147483640;
            display: flex; gap: 8px; align-items: center;
            opacity: 0; transform: translateY(-10px);
            transition: opacity 0.3s ease, transform 0.3s ease;
            pointer-events: none;
        }
        .vgs-container-hover .subtitle-controls-container { opacity: 1; transform: translateY(0); pointer-events: auto; }
        .subtitle-controls-container button, .vgs-track-selector {
            background-color: rgba(30, 30, 30, 0.9); border: none; border-radius: 12px;
            height: 40px; cursor: pointer; padding: 8px;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3); box-sizing: border-box;
            transition: all 0.2s ease;
            backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
            color: #fff;
        }
        .subtitle-controls-container button { width: 40px; }
        .subtitle-controls-container button:hover { background-color: rgba(50, 50, 50, 0.95); transform: translateY(-2px); }
        .subtitle-controls-container button svg { width: 100%; height: 100%; fill: #fff; }
        .vgs-track-selector { padding: 0 10px; font-size: 14px; }
        .vgs-track-selector:hover { background-color: rgba(50, 50, 50, 0.95); }
        .vgs-track-selector option { background: #333; border: none; }

        .custom-subtitle-display {
            width: max-content; max-width: 90%; text-align: center; pointer-events: none;
            padding: 5px 10px; border-radius: 4px; line-height: 1.4;
            word-wrap: break-word; white-space: pre-wrap;
            opacity: 0; visibility: hidden;
            transition: opacity 0.3s ease, visibility 0s linear 0.3s;
        }
        .custom-subtitle-display.visible { opacity: 1; visibility: visible; transition: opacity 0.3s ease; }
        .vgs-generic-subs { position: absolute; transform: translateX(-50%); z-index: 2147483641; }
        .vgs-youtube-subs {
            position: absolute; left: 50%; transform: translateX(-50%);
            width: fit-content;
        }

        #vgs-settings-panel {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 2147483647;
            display: none; align-items: center; justify-content: center; font-family: sans-serif;
        }
        .vgs-panel-content {
            background: rgba(30, 30, 30, 0.9); backdrop-filter: blur(8px);
            color: #eee; padding: 20px; border-radius: 12px;
            width: calc(100% - 40px); max-width: 450px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4); border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .vgs-panel-header { display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 20px; }
        .vgs-panel-header h3 { margin: 0; font-size: 18px; text-align: center; flex-grow: 1; }
        .vgs-panel-close { font-size: 28px; font-weight: bold; cursor: pointer; color: #aaa; line-height: 1; padding: 0 5px; }
        .vgs-setting-grid { display: grid; grid-template-columns: auto 1fr; gap: 15px 10px; width: 100%; align-items: center;}
        .vgs-setting-row.full-width { grid-column: 1 / -1; }
        .vgs-center-container { display: flex; justify-content: center; align-items: center; gap: 10px; }
        .vgs-label { font-size: 14px; color: #ccc; justify-self: start; }
        .vgs-input-group { display: flex; align-items: center; gap: 10px; }
        .vgs-input-group input[type="range"] { flex-grow: 1; accent-color: #89cff0; }
        .vgs-input-group input[type="color"] { border: none; background: none; padding: 0; width: 24px; height: 24px; cursor: pointer; }
        .vgs-input-group input[type="number"] { width: 60px; text-align: right; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #eee; border-radius: 4px; padding: 2px 4px;}
        .vgs-input-group span { min-width: 40px; text-align: right; font-size: 14px; color: #ccc; }
        .vgs-checkbox-label { font-weight: bold; border: 1px solid #aaa; border-radius: 4px; padding: 2px 4px; cursor: pointer; }
        select#vgs-font-family { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #eee; border-radius: 4px; padding: 4px; width: 100%; }
        .delay-group { display: flex; align-items: center; }
        .delay-group button { background: rgba(255,255,255,0.1); border: none; color: #eee; border-radius: 8px; width: 30px; height: 30px; font-size: 18px; cursor: pointer; }
        .delay-group input { width: 50px; text-align: center; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #eee; border-radius: 4px; margin: 0 5px; -moz-appearance: textfield; }
        .delay-group input::-webkit-outer-spin-button, .delay-group input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        
        .encoding-group { display: flex; gap: 10px; align-items: center; }
        .encoding-group select { flex-grow: 1; min-width: 0; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #eee; border-radius: 4px; padding: 4px; }
        .encoding-group button { flex-shrink: 0; background: rgba(255,255,255,0.1); border: none; color: #eee; border-radius: 4px; padding: 4px 8px; cursor: pointer; }
        
        #vgs-global-indicator {
            position: fixed; top: 30px; left: 50%; transform: translate(-50%, -10px);
            padding: 10px 16px; background-color: rgba(30, 30, 30, 0.9);
            color: #fff; font-family: 'Roboto', sans-serif; font-size: 16px;
            border-radius: 12px; z-index: 2147483647;
            display: flex; flex-direction: column; align-items: center; gap: 8px;
            opacity: 0; pointer-events: none;
            transition: opacity 0.3s ease, transform 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        #vgs-global-indicator.visible { opacity: 1; transform: translate(-50%, 0); }
        #vgs-global-indicator svg { width: 1.2em; height: 1.2em; fill: #fff; }
    `);
}

// --- Utility & Helper Functions ---

function waitForElement(video, findFn, callback) {
    let attempts = 0;
    const maxAttempts = 20; // Try for 5 seconds (20 * 250ms)
    const interval = setInterval(() => {
        const element = findFn(video);
        if (element) {
            clearInterval(interval);
            callback(element);
        } else {
            attempts++;
            if (attempts > maxAttempts) {
                clearInterval(interval);
                console.warn("VGS: Could not find a suitable video container for UI injection after 5 seconds.");
            }
        }
    }, 250);
}

function findVideoContainer(video) {
    let container = video.closest('#movie_player');
    if (container) {
        container.classList.add('vgs-container');
        return container;
    }
    container = video.closest('[class*="video-player"], [class*="player-container"], [class*="videoContainer"]');
     if (container) {
        container.classList.add('vgs-container');
        return container;
    }
    let parent = video.parentElement;
    while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        if (style.position === 'relative' || style.position === 'absolute' || style.position === 'fixed') {
            if (parent.clientHeight < window.innerHeight * 1.5 && parent.clientWidth < window.innerWidth * 1.5) {
                parent.classList.add('vgs-container');
                return parent;
            }
        }
        parent = parent.parentElement;
    }
    video.parentElement.classList.add('vgs-container');
    return video.parentElement;
}

function findVideosRecursively(node) {
    let videos = [];
    if (node.tagName === 'VIDEO') videos.push(node);
    videos.push(...Array.from(node.querySelectorAll('video')));
    if (node.shadowRoot) videos.push(...findVideosRecursively(node.shadowRoot));
    node.querySelectorAll('*').forEach(el => {
        if (el.shadowRoot) videos.push(...findVideosRecursively(el.shadowRoot));
    });
    return [...new Set(videos)];
}

function srtToVtt(srtText) {
    return 'WEBVTT\n\n' + srtText.replace(/\r+/g, '').replace(/(\d+)\n(\d{2}:\d{2}:\d{2}),(\d{3}) --> (\d{2}:\d{2}:\d{2}),(\d{3})/g, '$2.$3 --> $4.$5');
}

function parseVtt(vttText) {
    const lines = vttText.split('\n');
    const cues = [];
    let i = 0;
    while (i < lines.length) {
        if (lines[i].includes('-->')) {
            const timeParts = lines[i].split(' --> ');
            const start = timeToSeconds(timeParts[0].trim());
            const end = timeToSeconds(timeParts[1].split(' ')[0].trim());
            let text = '';
            i++;
            while (i < lines.length && lines[i].trim() !== '') {
                text += lines[i] + '<br>';
                i++;
            }
            if (start !== undefined && end !== undefined) {
                cues.push({ start, end, text: text.trim().replace(/<br>$/, '') });
            }
        }
        i++;
    }
    return cues;
}

function timeToSeconds(timeStr) {
    try {
        const parts = timeStr.split(':');
        let seconds = 0;
        if (parts.length === 3) {
            seconds = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
        } else {
            seconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
        }
        return isNaN(seconds) ? undefined : seconds;
    } catch (e) { return undefined; }
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createButton(title, svg, onClick) {
    const btn = document.createElement('button');
    btn.title = title;
    btn.innerHTML = svg;
    btn.onclick = onClick;
    return btn;
}

let indicatorTimeout = null;
function showIndicator(html, duration = 2000) {
    if (!globalIndicator) return;
    globalIndicator.innerHTML = html;
    globalIndicator.classList.add('visible');
    if (indicatorTimeout) clearTimeout(indicatorTimeout);
    indicatorTimeout = setTimeout(hideIndicator, duration);
}
function hideIndicator() {
    if (globalIndicator) globalIndicator.classList.remove('visible');
}

// --- Initialization ---

function init() {
    if (window.innerWidth <= 768) {
        console.log("Subtitle Uploader: Mobile view detected, script disabled.");
        return;
    }

    initializeStyles();
    createSettingsPanel();
    
    globalIndicator = document.createElement('div');
    globalIndicator.id = 'vgs-global-indicator';
    document.body.appendChild(globalIndicator);

    applySettings();

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                    findVideosRecursively(node).forEach(video => {
                        if (video.readyState >= 1) initializeForVideo(video);
                        else video.addEventListener('loadedmetadata', () => initializeForVideo(video), { once: true });
                    });
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    findVideosRecursively(document.body).forEach(video => {
       if (video.readyState >= 1) initializeForVideo(video);
       else video.addEventListener('loadedmetadata', () => initializeForVideo(video), { once: true });
    });

    let scrollTimeout;
    const throttledUpdate = () => {
        if (!scrollTimeout) {
            scrollTimeout = setTimeout(() => {
                updateAllPositions();
                scrollTimeout = null;
            }, 100);
        }
    };
    
    window.addEventListener('scroll', throttledUpdate, true);
    window.addEventListener('resize', throttledUpdate, true);
    document.addEventListener('fullscreenchange', updateAllPositions);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    init();
}

})();
