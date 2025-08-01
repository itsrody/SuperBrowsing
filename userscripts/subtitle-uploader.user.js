// ==UserScript==
// @name         Subtitle Uploader (UI-Matched) - Fixed
// @namespace    https://github.com/itsrody/SuperBrowsing
// @version      6.3
// @description  Upload, style, and sync local subtitles for any video.
// @author       Murtaza Salih (with Gemini improvements + Claude fixes)
// @match        *://*/*
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.addStyle
// @run-at       document-end
// ==/UserScript==

(async () => {
'use strict';

const defaultSettings = {
    fontSize: 24,
    fontColor: '#ffffff',
    fontFamily: 'sans-serif',
    textOutline: true,
    bgColor: '#000000',
    bgToggle: true,
    bgOpacity: 0.6,
    offsetY: 85,
    delay: 0,
};

let settings = await GM.getValue('subtitleSettings', defaultSettings);
const videoDataMap = new Map();
let globalIndicator = null;
let indicatorTimeout = null;
let isFullscreen = false;
let mouseOverVideo = null;
let fadeTimeout = null;

// --- UI Elements ---

function createSubtitleControls(video) {
    if (videoDataMap.has(video)) return;

    const controls = document.createElement('div');
    controls.className = 'subtitle-controls-container';

    const btnUpload = document.createElement('button');
    btnUpload.title = 'Upload Subtitle';
    btnUpload.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"/></svg>`;

    const btnSettings = document.createElement('button');
    btnSettings.title = 'Subtitle Settings';
    btnSettings.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>`;

    btnUpload.onclick = (e) => {
        e.stopPropagation();
        handleUploadClick(video);
    };
    btnSettings.onclick = (e) => {
        e.stopPropagation();
        const panel = document.getElementById('vgs-settings-panel');
        if (panel) {
            panel.associatedVideo = video;
            video.pause();
            panel.style.display = 'flex';
        }
    };

    controls.appendChild(btnUpload);
    controls.appendChild(btnSettings);
    
    // Append to appropriate container based on fullscreen state
    const container = document.fullscreenElement || document.body;
    container.appendChild(controls);

    videoDataMap.set(video, { controls });
    updateButtonPosition(video, controls);
}

function updateButtonPosition(video, controls) {
    const rect = video.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100 || rect.top > window.innerHeight || rect.bottom < 0 || rect.left > window.innerWidth || rect.right < 0) {
        controls.style.display = 'none';
        return;
    }
    controls.style.display = 'flex';
    
    controls.style.top = `${rect.top + 10}px`;
    controls.style.left = `${rect.left + 10}px`;
    
    // Update visibility based on mouse position
    updateControlsVisibility(video, controls);
}

function updateAllPositions() {
    for (const [video, data] of videoDataMap.entries()) {
        if (!document.body.contains(video) && !document.fullscreenElement?.contains(video)) {
            data.controls.remove();
            if (data.display) data.display.remove();
            videoDataMap.delete(video);
        } else {
            updateButtonPosition(video, data.controls);
            if (data.display) {
                updateSubtitlePosition(video, data.display);
            }
        }
    }
}

function updateControlsVisibility(video, controls) {
    const rect = video.getBoundingClientRect();
    const isVideoHovered = mouseOverVideo === video;
    
    if (isVideoHovered) {
        controls.classList.add('visible');
        controls.classList.remove('hidden');
    } else {
        controls.classList.add('hidden');
        controls.classList.remove('visible');
    }
}

function handleMouseEnterVideo(video) {
    mouseOverVideo = video;
    if (fadeTimeout) {
        clearTimeout(fadeTimeout);
        fadeTimeout = null;
    }
    
    const data = videoDataMap.get(video);
    if (data && data.controls) {
        updateControlsVisibility(video, data.controls);
    }
}

function handleMouseLeaveVideo(video) {
    if (mouseOverVideo === video) {
        mouseOverVideo = null;
    }
    
    // Add a small delay before hiding to prevent flickering
    if (fadeTimeout) clearTimeout(fadeTimeout);
    fadeTimeout = setTimeout(() => {
        const data = videoDataMap.get(video);
        if (data && data.controls && mouseOverVideo !== video) {
            updateControlsVisibility(video, data.controls);
        }
    }, 200);
}

function closeSettingsPanel() {
    const panel = document.getElementById('vgs-settings-panel');
    if (panel && panel.style.display !== 'none') {
        if (panel.associatedVideo && panel.associatedVideo.paused) {
            panel.associatedVideo.play();
        }
        panel.associatedVideo = null;
        panel.style.display = 'none';
    }
}

function createSettingsPanel() {
    if (document.getElementById('vgs-settings-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'vgs-settings-panel';
    panel.innerHTML = `
        <div class="vgs-panel-content">
            <div class="vgs-panel-header">
                <h3>Subtitle Settings</h3>
                <span class="vgs-panel-close">&times;</span>
            </div>
            <div class="vgs-setting-grid">
                <div class="vgs-setting-row full-width">
                    <select id="vgs-font-family">
                        <option value="sans-serif">Sans-Serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option>
                    </select>
                </div>
                <div class="vgs-icon"><svg viewBox="0 0 24 24"><path d="M9.93 13.5h4.14L12 7.98zM20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM12 17.5l-2.07-5.5H7.58l5.5-5.5h2.85l-5.5 5.5h2.07l-1.4 3.5z"/></svg></div>
                <div class="vgs-input-group"><input type="range" id="vgs-font-size" min="12" max="48" step="1" value="${settings.fontSize}"><span id="vgs-font-size-value">${settings.fontSize}px</span></div>
                
                <div class="vgs-icon"><svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg></div>
                <div class="vgs-input-group"><input type="color" id="vgs-font-color" value="${settings.fontColor}"><label class="vgs-checkbox-label" title="Text Outline"><input type="checkbox" id="vgs-text-outline" ${settings.textOutline ? 'checked' : ''}> T</label></div>
                
                <div class="vgs-icon"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM5 19V5h14v14H5z"/></svg></div>
                <div class="vgs-input-group"><input type="color" id="vgs-bg-color" value="${settings.bgColor}"><input type="checkbox" id="vgs-bg-toggle" ${settings.bgToggle ? 'checked' : ''} title="Background"></div>
                
                <div class="vgs-icon"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6v12z"/></svg></div>
                <div class="vgs-input-group"><input type="range" id="vgs-bg-opacity" min="0" max="1" step="0.1" value="${settings.bgOpacity}"><span id="vgs-bg-opacity-value">${Math.round(settings.bgOpacity * 100)}%</span></div>
                
                <div class="vgs-icon"><svg viewBox="0 0 24 24"><path d="M4 18h16v-2H4v2zm0-5h16v-2H4v2zm0-5h16V6H4v2z"/></svg></div>
                <div class="vgs-input-group"><input type="range" id="vgs-offsetY" min="70" max="100" step="1" value="${settings.offsetY}"><span id="vgs-offsetY-value">${settings.offsetY}%</span></div>
                
                <div class="vgs-setting-row full-width sync-controls">
                    <button id="vgs-delay-minus">-</button>
                    <div class="delay-group"><input type="number" id="vgs-delay" step="50" value="${settings.delay}"><span>ms</span></div>
                    <button id="vgs-delay-plus">+</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);
    
    panel.querySelector('#vgs-font-family').value = settings.fontFamily;

    panel.querySelector('.vgs-panel-close').onclick = closeSettingsPanel;
    
    const updateAndApply = () => {
        updateSettings();
        applySettings();
        updatePanelUI();
    };

    panel.querySelectorAll('input, select').forEach(input => input.addEventListener('input', updateAndApply));
    
    panel.querySelector('#vgs-delay-minus').onclick = () => {
        const input = panel.querySelector('#vgs-delay');
        input.value = parseInt(input.value, 10) - 250;
        updateAndApply();
    };
    panel.querySelector('#vgs-delay-plus').onclick = () => {
        const input = panel.querySelector('#vgs-delay');
        input.value = parseInt(input.value, 10) + 250;
        updateAndApply();
    };
    
    panel.addEventListener('keydown', e => {
        if (e.key === '[') panel.querySelector('#vgs-delay-minus').click();
        if (e.key === ']') panel.querySelector('#vgs-delay-plus').click();
    });
}

function updatePanelUI() {
    document.getElementById('vgs-font-size-value').textContent = `${settings.fontSize}px`;
    document.getElementById('vgs-bg-opacity-value').textContent = `${Math.round(settings.bgOpacity * 100)}%`;
    document.getElementById('vgs-offsetY-value').textContent = `${settings.offsetY}%`;
}

// --- Core Logic ---

function showIndicator(html) {
    if (!globalIndicator) return;
    globalIndicator.innerHTML = html;
    globalIndicator.classList.add('visible');
    if (indicatorTimeout) clearTimeout(indicatorTimeout);
    indicatorTimeout = setTimeout(() => {
        globalIndicator.classList.remove('visible');
    }, 2000);
}

function processSubtitleFile(video, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        let text = reader.result;
        if (file.name.endsWith('.srt')) text = srtToVtt(text);
        attachSubtitle(video, text);
        const successIcon = `<svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM10 17l-3.5-3.5 1.41-1.41L10 14.17l6.09-6.09L17.5 9.5 10 17z"/></svg>`;
        showIndicator(`${successIcon} Subtitle Loaded`);
    };
    reader.readAsText(file);
}

function handleUploadClick(video) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vtt,.srt';
    input.onchange = () => {
        const file = input.files[0];
        processSubtitleFile(video, file);
    };
    input.click();
}

function srtToVtt(srtText) {
    return 'WEBVTT\n\n' + srtText
        .replace(/\r+/g, '')
        .replace(/(\d+)\n(\d{2}:\d{2}:\d{2}),(\d{3}) --> (\d{2}:\d{2}:\d{2}),(\d{3})/g, '$2.$3 --> $4.$5')
        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3}) --> (\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2 --> $3.$4');
}

function parseVtt(vttText) {
    const lines = vttText.split('\n');
    const cues = [];
    let i = 0;
    while (i < lines.length) {
        if (lines[i].includes('-->')) {
            const timeParts = lines[i].split(' --> ');
            const start = timeToSeconds(timeParts[0]);
            const end = timeToSeconds(timeParts[1].split(' ')[0]);
            let text = '';
            i++;
            while (i < lines.length && lines[i].trim() !== '') {
                text += lines[i] + '<br>';
                i++;
            }
            if (start !== undefined && end !== undefined) {
                cues.push({ start, end, text: text.trim() });
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
            seconds += parseFloat(parts[0]) * 3600;
            seconds += parseFloat(parts[1]) * 60;
            seconds += parseFloat(parts[2]);
        } else {
            seconds += parseFloat(parts[0]) * 60;
            seconds += parseFloat(parts[1]);
        }
        return isNaN(seconds) ? undefined : seconds;
    } catch (e) {
        return undefined;
    }
}

function attachSubtitle(video, vttText) {
    Array.from(video.textTracks).forEach(track => track.mode = 'disabled');
    video.querySelectorAll('track').forEach(t => t.remove());

    const data = videoDataMap.get(video);
    if (!data) return;

    if (!data.display) {
        data.display = document.createElement('div');
        data.display.className = 'custom-subtitle-display';
        
        // Append to appropriate container based on fullscreen state
        const container = document.fullscreenElement || document.body;
        container.appendChild(data.display);
        
        video.addEventListener('timeupdate', () => renderCustomSubtitle(video));
    }

    data.cues = parseVtt(vttText);
    applySettings();
}

function renderCustomSubtitle(video) {
    const data = videoDataMap.get(video);
    if (!data || !data.cues || !data.display) return;

    const adjustedTime = video.currentTime + (settings.delay / 1000);
    const activeCue = data.cues.find(cue => adjustedTime >= cue.start && adjustedTime <= cue.end);

    data.display.innerHTML = activeCue ? activeCue.text : '';
    data.display.style.visibility = activeCue ? 'visible' : 'hidden';
    
    // Update position every time we render (important for fullscreen transitions)
    if (activeCue) {
        updateSubtitlePosition(video, data.display);
    }
}

function updateSubtitlePosition(video, display) {
    const rect = video.getBoundingClientRect();
    
    // Calculate position based on video dimensions and settings
    const subtitleTop = rect.top + (rect.height * (settings.offsetY / 100)) - display.offsetHeight;
    const subtitleLeft = rect.left + (rect.width / 2);
    
    display.style.top = `${subtitleTop}px`;
    display.style.left = `${subtitleLeft}px`;
    
    // Ensure subtitles stay within viewport bounds
    const displayRect = display.getBoundingClientRect();
    const maxWidth = Math.min(rect.width * 0.9, window.innerWidth * 0.9);
    display.style.maxWidth = `${maxWidth}px`;
    
    // Adjust horizontal position if subtitle goes off-screen
    if (displayRect.right > window.innerWidth - 10) {
        display.style.left = `${window.innerWidth - displayRect.width - 10}px`;
    } else if (displayRect.left < 10) {
        display.style.left = '10px';
    }
}

function applySettings() {
    const { fontColor, fontSize, fontFamily, textOutline, bgToggle, bgColor, bgOpacity } = settings;
    const bg = bgToggle ? hexToRgba(bgColor, bgOpacity) : 'transparent';
    const shadow = textOutline ? '1px 1px 2px black, -1px -1px 2px black, 1px -1px 2px black, -1px 1px 2px black' : '1px 1px 2px black';
    
    document.querySelectorAll('.custom-subtitle-display').forEach(display => {
        Object.assign(display.style, {
            color: fontColor,
            fontSize: `${fontSize}px`,
            fontFamily: fontFamily,
            backgroundColor: bg,
            textShadow: shadow,
        });
    });
    
    // Force position update after applying settings
    requestAnimationFrame(() => {
        updateAllPositions();
    });
}

async function updateSettings() {
    settings.fontSize = parseInt(document.getElementById('vgs-font-size').value, 10);
    settings.fontColor = document.getElementById('vgs-font-color').value;
    settings.fontFamily = document.getElementById('vgs-font-family').value;
    settings.textOutline = document.getElementById('vgs-text-outline').checked;
    settings.bgColor = document.getElementById('vgs-bg-color').value;
    settings.bgToggle = document.getElementById('vgs-bg-toggle').checked;
    settings.bgOpacity = parseFloat(document.getElementById('vgs-bg-opacity').value);
    settings.offsetY = parseInt(document.getElementById('vgs-offsetY').value, 10);
    settings.delay = parseInt(document.getElementById('vgs-delay').value, 10);
    await GM.setValue('subtitleSettings', settings);
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --- Initialization ---

function initializeStyles() {
    GM.addStyle(`
        .subtitle-controls-container {
            position: fixed; z-index: 2147483640; display: flex; gap: 8px;
            opacity: 0; transform: translateY(-10px);
            transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
        }
        .subtitle-controls-container.visible {
            opacity: 1; transform: translateY(0);
            pointer-events: auto;
        }
        .subtitle-controls-container.hidden {
            opacity: 0; transform: translateY(-10px);
            pointer-events: none;
        }
        .subtitle-controls-container button {
            background-color: rgba(30, 30, 30, 0.9); border: none; border-radius: 12px;
            width: 40px; height: 40px; cursor: pointer; padding: 8px;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3); box-sizing: border-box;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        }
        .subtitle-controls-container button:hover {
            background-color: rgba(50, 50, 50, 0.95);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .subtitle-controls-container button svg { 
            width: 100%; height: 100%; fill: #fff; 
            transition: fill 0.2s ease;
        }
        .subtitle-controls-container button:hover svg {
            fill: #ffffff;
        }

        #vgs-settings-panel {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(40, 44, 52, 0.85);
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            color: #eee; padding: 20px; border-radius: 12px;
            width: 280px; z-index: 2147483647; display: none;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
            align-items: center; justify-content: center;
            font-family: sans-serif;
        }
        .vgs-panel-header { display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 20px; }
        .vgs-panel-header h3 { margin: 0; border: none; padding: 0; font-size: 18px; }
        .vgs-panel-close { font-size: 28px; font-weight: bold; cursor: pointer; color: #aaa; }
        .vgs-setting-grid { display: grid; grid-template-columns: auto 1fr; gap: 15px 10px; width: 100%;}
        .vgs-setting-row { display: contents; }
        .vgs-icon { width: 24px; height: 24px; fill: #eee; display: flex; align-items: center; justify-content: center; }
        .vgs-setting-row.full-width { grid-column: 1 / -1; }
        .vgs-input-group { display: flex; align-items: center; gap: 10px; }
        .vgs-input-group input[type="range"] { flex-grow: 1; }
        .vgs-input-group input[type="color"] { border: none; background: none; padding: 0; width: 24px; height: 24px; cursor: pointer; }
        .vgs-input-group input[type="number"] { width: 60px; text-align: right; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #eee; border-radius: 4px; padding: 2px 4px;}
        .vgs-input-group span { min-width: 40px; text-align: right; font-size: 14px; }
        .vgs-checkbox-label { font-weight: bold; border: 1px solid #aaa; border-radius: 4px; padding: 2px 4px; }
        select#vgs-font-family { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #eee; border-radius: 4px; padding: 4px; width: 100%; }
        .sync-controls { display: flex; justify-content: space-between; align-items: center; }
        .sync-controls button { background: rgba(255,255,255,0.1); border: none; color: #eee; border-radius: 4px; width: 40px; }
        .delay-group { flex-grow: 1; justify-content: center; }

        .custom-subtitle-display {
            position: fixed; transform: translateX(-50%);
            width: max-content; max-width: 90%; text-align: center; pointer-events: none;
            padding: 5px 10px; border-radius: 4px; line-height: 1.4;
            z-index: 2147483641; visibility: hidden;
            word-wrap: break-word; white-space: pre-wrap;
        }
        
        #vgs-global-indicator {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%) scale(0.9);
            padding: 10px 16px; background-color: rgba(30, 30, 30, 0.9);
            color: #fff; font-family: 'Roboto', sans-serif; font-size: 16px;
            border-radius: 20px; z-index: 2147483647;
            display: flex; align-items: center; gap: 8px;
            opacity: 0; pointer-events: none;
            transition: opacity 0.2s ease, transform 0.2s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        #vgs-global-indicator.visible {
            opacity: 1; transform: translate(-50%, -50%) scale(1);
        }
        #vgs-global-indicator svg {
            width: 1.2em;
            height: 1.2em;
            fill: #fff;
        }
    `);
}

function handleFullscreenChange() {
    const wasFullscreen = isFullscreen;
    isFullscreen = !!document.fullscreenElement;
    
    // Only process if fullscreen state actually changed
    if (wasFullscreen === isFullscreen) return;
    
    const container = document.fullscreenElement || document.body;

    // Move all UI elements to the appropriate container
    videoDataMap.forEach((data, video) => {
        // Move controls
        container.appendChild(data.controls);
        
        // Move subtitle display
        if (data.display) {
            container.appendChild(data.display);
        }
    });
    
    // Move settings panel and global indicator
    const panel = document.getElementById('vgs-settings-panel');
    if (panel) container.appendChild(panel);
    if (globalIndicator) container.appendChild(globalIndicator);
    
    // Update positions with proper timing
    requestAnimationFrame(() => {
        updateAllPositions();
        // Double-check positions after a short delay to handle browser quirks
        setTimeout(() => {
            updateAllPositions();
        }, 50);
    });
}

const handleVideoElement = (video) => {
    if (video.duration < 60) return;
    if (videoDataMap.has(video)) return;
    createSubtitleControls(video);
    
    // Add mouse event listeners for fade in/out effect
    video.addEventListener('mouseenter', () => handleMouseEnterVideo(video));
    video.addEventListener('mouseleave', () => handleMouseLeaveVideo(video));
    
    video.addEventListener('dragover', e => e.preventDefault());
    video.addEventListener('drop', e => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.srt') || file.name.endsWith('.vtt'))) {
            processSubtitleFile(video, file);
        }
    });

    video.addEventListener('click', (e) => {
        const panel = document.getElementById('vgs-settings-panel');
        if (panel && panel.style.display !== 'none') {
            e.preventDefault();
            e.stopPropagation();
            closeSettingsPanel();
        }
    }, true);
};

const init = () => {
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
                    const videos = node.matches('video') ? [node] : node.querySelectorAll('video');
                    videos.forEach(video => {
                        if (video.readyState >= 1) {
                            handleVideoElement(video);
                        } else {
                            video.addEventListener('loadedmetadata', () => handleVideoElement(video), { once: true });
                        }
                    });
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll('video').forEach(video => {
       if (video.readyState >= 1) {
            handleVideoElement(video);
        } else {
            video.addEventListener('loadedmetadata', () => handleVideoElement(video), { once: true });
        }
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
    document.addEventListener('fullscreenchange', handleFullscreenChange);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    init();
}

})();
