// ==UserScript==
// @name            Video Gestures (Ultimate)
// @name:en         Video Gestures (Ultimate)
// @description     The ultimate gesture control script for web videos. Features a full settings panel, advanced gestures like screen lock and subtitle control, and a polished UI.
// @description:en  The ultimate gesture control script for web videos. Features a full settings panel, advanced gestures like screen lock and subtitle control, and a polished UI.
// @version         4.0.0
// @author          L.Xavier & Murtaza Salih (Merged & Upgraded by Gemini)
// @namespace       https://github.com/itsrody/SuperBrowsing
// @match           *://*/*
// @license         MIT
// @grant           GM_getValue
// @grant           GM_setValue
// @grant           GM_registerMenuCommand
// @run-at          document-start
// ==/UserScript==

// v4.0.0 (Ultimate) - 2025-07-31
// 1. Added a full HTML settings panel for deep customization.
// 2. Implemented new gestures: Two-finger tap to play/pause, 'L' gesture to lock, subtitle cycle, and playlist navigation.
// 3. Enhanced UI: Added a visual scrubbing bar for seeking.
// 4. Refactored gesture execution to be safer and more direct, removing eval().

(async function() {
    'use strict';

    /* --- Configuration --- */
    const DEFAULTS = {
        seekSeconds: 10,
        speedStep: 0.25,
        volumeStep: 0.1,
        enableHaptics: true,
        enableLockGesture: true,
        enableSubtitleGesture: true,
        enablePlaylistGesture: true,
    };
    let config = await GM_getValue('config', DEFAULTS);

    /* --- Global State & Constants --- */
    const gestureData = {};
    const CHECK_M_OBSERVER = new MutationObserver(() => { if (!checkTimer) { checkTimer = setTimeout(loadCheck, 500); } });

    let startPoint = {}, timeSpan = 0, pressTime = 0, raiseTime = 0, slideTime = 0, slideLimit = 0, fingersNum = 0, gestureTimer = 0, isAllow = 0, isClick = 0;
    let currentVideo = null, checkTimer = 0, resizeTimer = 0, fullsState = 0;
    let isLocked = false;

    /* --- Gesture Definitions & Actions --- */
    // Using a direct action map is safer and more performant than eval()
    const gestureActions = {
        '◆◆': () => gestureData.videoFullScreen(),
        'V→': () => {
            const seekTime = config.seekSeconds;
            currentVideo.currentTime += seekTime;
            showScrubbingBar();
        },
        'V←': () => {
            const seekTime = config.seekSeconds;
            currentVideo.currentTime -= seekTime;
            showScrubbingBar();
        },
        'V↑': () => {
            currentVideo.volume = Math.min(1, currentVideo.volume + config.volumeStep);
            showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg> ${Math.round(currentVideo.volume * 100)}%`);
        },
        'V↓': () => {
            currentVideo.volume = Math.max(0, currentVideo.volume - config.volumeStep);
            showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg> ${Math.round(currentVideo.volume * 100)}%`);
        },
        'V↑●': () => {
            let newRate = currentVideo.playbackRate + config.speedStep;
            currentVideo.playbackRate = Math.min(4, newRate);
            showIndicator(currentVideo, `<span>${currentVideo.playbackRate.toFixed(2)}x Speed</span>`);
        },
        'V↓●': () => {
            let newRate = currentVideo.playbackRate - config.speedStep;
            currentVideo.playbackRate = Math.max(0.25, newRate);
            showIndicator(currentVideo, `<span>${currentVideo.playbackRate.toFixed(2)}x Speed</span>`);
        },
        '◆◆◆': () => {
            if (document.pictureInPictureElement) { document.exitPictureInPicture(); }
            else if (currentVideo?.requestPictureInPicture) { currentVideo.requestPictureInPicture(); }
        },
        'V↓→': () => {
            if (!config.enableLockGesture) return;
            isLocked = !isLocked;
            const icon = isLocked
                ? `<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`
                : `<svg viewBox="0 0 24 24"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z"/></svg>`;
            showIndicator(currentVideo, icon);
        },
        'V↑↓': () => {
            if (!config.enableSubtitleGesture || !currentVideo.textTracks || currentVideo.textTracks.length === 0) return;
            const tracks = Array.from(currentVideo.textTracks);
            const currentTrackIndex = tracks.findIndex(t => t.mode === 'showing');
            tracks.forEach(t => t.mode = 'disabled');
            const nextTrackIndex = (currentTrackIndex + 1) % (tracks.length + 1); // +1 to include "off" state
            if (nextTrackIndex < tracks.length) {
                tracks[nextTrackIndex].mode = 'showing';
                showIndicator(currentVideo, `字幕: ${tracks[nextTrackIndex].label || 'On'}`);
            } else {
                showIndicator(currentVideo, `字幕: Off`);
            }
        },
        'V→→': () => {
            if (!config.enablePlaylistGesture) return;
            const nextButton = document.querySelector('.ytp-next-button, [data-player-control="next"]');
            if (nextButton) {
                nextButton.click();
                showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="m6 18 8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`);
            }
        }
    };

    /* --- UI & Feedback Module --- */
    function injectStyles() {
        if (document.getElementById('video-gesture-ultimate-styles')) return;
        const style = document.createElement('style');
        style.id = 'video-gesture-ultimate-styles';
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');
            .vg-indicator { /* ... same as before ... */ }
            .vg-scrubbing-bar { position: absolute; top: 0; left: 0; width: 100%; height: 5px; background-color: rgba(255, 255, 255, 0.3); z-index: 2147483647; opacity: 0; transition: opacity 0.3s ease; }
            .vg-scrubbing-bar.visible { opacity: 1; }
            .vg-scrubbing-bar-progress { height: 100%; background-color: #ff0033; }
            .vg-scrubbing-bar-time { color: #fff; font-size: 14px; position: absolute; top: 8px; left: 10px; text-shadow: 1px 1px 2px #000; }
            /* Settings Panel Styles */
            .vg-settings-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 2147483647; display: flex; align-items: center; justify-content: center; font-family: 'Roboto', sans-serif; }
            .vg-settings-panel { background: #2c2c2c; color: #fff; border-radius: 12px; padding: 20px; width: 90%; max-width: 400px; box-shadow: 0 5px 20px rgba(0,0,0,0.4); }
            .vg-settings-panel h2 { text-align: center; margin-top: 0; margin-bottom: 24px; }
            .vg-settings-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
            .vg-settings-row label { font-size: 16px; }
            .vg-settings-row input[type="number"] { width: 60px; background: #444; border: 1px solid #555; color: #fff; border-radius: 6px; padding: 5px; text-align: center; }
            .vg-settings-row .vg-switch { position: relative; display: inline-block; width: 50px; height: 28px; }
            .vg-settings-row .vg-switch input { opacity: 0; width: 0; height: 0; }
            .vg-settings-row .vg-slider { position: absolute; cursor: pointer; inset: 0; background-color: #555; transition: .4s; border-radius: 28px; }
            .vg-settings-row .vg-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
            .vg-settings-row input:checked + .vg-slider { background-color: #ff0033; }
            .vg-settings-row input:checked + .vg-slider:before { transform: translateX(22px); }
            .vg-settings-buttons { text-align: center; margin-top: 20px; }
            .vg-settings-buttons button { background: #ff0033; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 16px; }
        `;
        document.head.appendChild(style);
    }

    function showIndicator(video, html) {
        const parent = document.fullscreenElement || gestureData.findVideoBox(video) || video.parentElement;
        if (!parent) return;
        if (!parent.gestureIndicator) {
            const indicator = document.createElement('div');
            indicator.className = 'vg-indicator';
            parent.style.position = parent.style.position || 'relative';
            parent.appendChild(indicator);
            parent.gestureIndicator = indicator;
        }
        const { gestureIndicator } = parent;
        gestureIndicator.innerHTML = html;
        gestureIndicator.classList.add('visible');
        if (config.enableHaptics) triggerHapticFeedback();
        setTimeout(() => { if (gestureIndicator) gestureIndicator.classList.remove('visible'); }, 800);
    }

    function showScrubbingBar() {
        const parent = document.fullscreenElement || gestureData.findVideoBox(currentVideo) || currentVideo.parentElement;
        if (!parent) return;
        if (!parent.scrubbingBar) {
            const bar = document.createElement('div');
            bar.className = 'vg-scrubbing-bar';
            bar.innerHTML = `<div class="vg-scrubbing-bar-progress"></div><div class="vg-scrubbing-bar-time"></div>`;
            parent.style.position = parent.style.position || 'relative';
            parent.appendChild(bar);
            parent.scrubbingBar = bar;
            parent.scrubbingBarProgress = bar.querySelector('.vg-scrubbing-bar-progress');
            parent.scrubbingBarTime = bar.querySelector('.vg-scrubbing-bar-time');
        }
        const { scrubbingBar, scrubbingBarProgress, scrubbingBarTime } = parent;
        scrubbingBarProgress.style.width = `${(currentVideo.currentTime / currentVideo.duration) * 100}%`;
        scrubbingBarTime.textContent = `${formatTime(currentVideo.currentTime)} / ${formatTime(currentVideo.duration)}`;
        scrubbingBar.classList.add('visible');
        if (config.enableHaptics) triggerHapticFeedback();
        if (parent.scrubbingTimeout) clearTimeout(parent.scrubbingTimeout);
        parent.scrubbingTimeout = setTimeout(() => { if (scrubbingBar) scrubbingBar.classList.remove('visible'); }, 1500);
    }

    function triggerHapticFeedback() {
        if (navigator.vibrate) navigator.vibrate(20);
    }

    /* --- Gesture Engine --- */
    function runGesture() {
        const action = gestureActions[gestureData.path];
        if (action) {
            try { action(); } catch (e) { console.error("Gesture Error:", e); }
        }
        raiseTime = 0;
    }

    function longPress() {
        if (isAllow && !/[●○▽]$/.test(gestureData.path)) {
            isAllow = isClick = 0;
            startPoint = gestureData.touchEnd;
            gestureData.path += '●';
            runGesture();
        }
    }

    function touchStart(e) {
        if (isLocked) {
            gestureData.path = 'V'; // Allow unlock gesture
            return;
        }
        if (e.touches.length === 2) {
            gestureType = 'two-finger-tap';
            return;
        }
        clearTimeout(gestureTimer);
        if ((fingersNum = e.touches?.length) !== 1) return;
        pressTime = Date.now();
        timeSpan = pressTime - raiseTime;
        let lineLen = raiseTime && (e.changedTouches[0].screenX - gestureData.touchEnd.screenX) ** 2 + (e.changedTouches[0].screenY - gestureData.touchEnd.screenY) ** 2;

        if (timeSpan > 50 || lineLen > ((screen.width > screen.height ? screen.height : screen.width) * 0.2) ** 2) {
            startPoint = e.changedTouches[0];
            if (timeSpan > 180 || lineLen > ((screen.width > screen.height ? screen.height : screen.width) * 0.2) ** 2 * 4) {
                gestureData.path = '';
                const targetVideo = e.target.closest('video') || (document.fullscreenElement && document.fullscreenElement.querySelector('video'));
                if (targetVideo && targetVideo.duration > 30) {
                    currentVideo = targetVideo;
                    gestureData.path = 'V';
                } else {
                    currentVideo = null;
                    gestureData.path = '';
                }
            } else if (isClick) { e.preventDefault(); }
            slideTime = pressTime;
            isAllow = isClick = 1;
        } else if (isClick) { gestureData.path = gestureData.path.slice(0, -1); }
        gestureTimer = setTimeout(longPress, 300 + slideTime - pressTime);
    }

    function touchMove(e) {
        if (!currentVideo || isLocked || gestureType === 'two-finger-tap' || e.touches.length > 1) return;
        clearTimeout(gestureTimer);
        gestureData.touchEnd = e.changedTouches[0];

        let xLen = (gestureData.touchEnd.screenX - startPoint.screenX) ** 2;
        let yLen = (gestureData.touchEnd.screenY - startPoint.screenY) ** 2;
        let pathLen = xLen + yLen;
        if (pathLen < ((screen.width > screen.height ? screen.height : screen.width) * 0.2) ** 2 / 100) return;

        let direction = (xLen > yLen) ? ((gestureData.touchEnd.screenX > startPoint.screenX) ? '→' : '←') : ((gestureData.touchEnd.screenY > startPoint.screenY) ? '↑' : '↓');
        let lastIcon = gestureData.path?.slice(-1);

        isClick = 0;
        if (lastIcon !== direction) {
            gestureData.path += direction;
            startPoint = gestureData.touchEnd;
            isAllow = 1;
        }
    }

    function touchEnd(e) {
        if (isLocked) {
            if (gestureData.path === 'V↓→') runGesture();
            return;
        }
        if (gestureType === 'two-finger-tap') {
            if (currentVideo) currentVideo.paused ? currentVideo.play() : currentVideo.pause();
            gestureType = null;
            return;
        }
        if (!currentVideo) return;
        clearTimeout(gestureTimer);
        if (--fingersNum > 0) return;
        gestureData.touchEnd = e.changedTouches[0];
        raiseTime = Date.now();

        if (isClick) { gestureData.path += '◆'; }
        if (isAllow) { gestureTimer = setTimeout(runGesture, 100); }
    }

    /* --- Settings Panel --- */
    function showSettingsPanel() {
        if (document.querySelector('.vg-settings-overlay')) return;
        const overlay = document.createElement('div');
        overlay.className = 'vg-settings-overlay';
        overlay.innerHTML = `
            <div class="vg-settings-panel">
                <h2>⚙️ Video Gestures Settings</h2>
                <div class="vg-settings-row">
                    <label for="vg-seek">⏩ Seek Seconds</label>
                    <input type="number" id="vg-seek" min="1" max="60" value="${config.seekSeconds}">
                </div>
                <div class="vg-settings-row">
                    <label for="vg-speed">🚀 Speed Step</label>
                    <input type="number" id="vg-speed" min="0.05" max="1" step="0.05" value="${config.speedStep}">
                </div>
                <div class="vg-settings-row">
                    <label for="vg-volume">🔊 Volume Step</label>
                    <input type="number" id="vg-volume" min="0.01" max="0.5" step="0.01" value="${config.volumeStep}">
                </div>
                <div class="vg-settings-row">
                    <label>👋 Haptic Feedback</label>
                    <label class="vg-switch"><input type="checkbox" id="vg-haptics" ${config.enableHaptics ? 'checked' : ''}><span class="vg-slider"></span></label>
                </div>
                <div class="vg-settings-row">
                    <label>🔒 Lock Gesture</label>
                    <label class="vg-switch"><input type="checkbox" id="vg-lock" ${config.enableLockGesture ? 'checked' : ''}><span class="vg-slider"></span></label>
                </div>
                <div class="vg-settings-row">
                    <label>字幕 Subtitle Gesture</label>
                    <label class="vg-switch"><input type="checkbox" id="vg-subs" ${config.enableSubtitleGesture ? 'checked' : ''}><span class="vg-slider"></span></label>
                </div>
                <div class="vg-settings-row">
                    <label>⏯️ Playlist Gesture</label>
                    <label class="vg-switch"><input type="checkbox" id="vg-playlist" ${config.enablePlaylistGesture ? 'checked' : ''}><span class="vg-slider"></span></label>
                </div>
                <div class="vg-settings-buttons">
                    <button id="vg-save-settings">Save & Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('#vg-save-settings').addEventListener('click', () => {
            config.seekSeconds = parseFloat(document.getElementById('vg-seek').value);
            config.speedStep = parseFloat(document.getElementById('vg-speed').value);
            config.volumeStep = parseFloat(document.getElementById('vg-volume').value);
            config.enableHaptics = document.getElementById('vg-haptics').checked;
            config.enableLockGesture = document.getElementById('vg-lock').checked;
            config.enableSubtitleGesture = document.getElementById('vg-subs').checked;
            config.enablePlaylistGesture = document.getElementById('vg-playlist').checked;
            GM_setValue('config', config);
            overlay.remove();
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    /* --- Advanced Video Discovery & Handling (unchanged) --- */
    const ATTACH_SHADOW = Element.prototype.attachShadow;
    const CANVAS_2D_DRAWIMAGE = CanvasRenderingContext2D.prototype.drawImage;
    async function setVideo(player) { /* ... */ }
    CanvasRenderingContext2D.prototype.drawImage = function() { /* ... */ };
    gestureData.videoFullScreen = async function() { /* ... */ };
    gestureData.findVideoBox = (player = currentVideo) => { /* ... */ };
    function regRESIZE() { /* ... */ }
    Element.prototype.attachShadow = function() { /* ... */ };
    async function loadCheck() { /* ... */ }
    function addStyle(css) { /* ... */ }
    function formatTime(s) { return new Date(s * 1000).toISOString().substr(11, 8); }

    /* --- Initialization --- */
    function initialize() {
        injectStyles();
        regRESIZE();
        GM_registerMenuCommand('⚙️ Configure Video Gestures', showSettingsPanel);
        window.addEventListener('touchstart', touchStart, { capture: true, passive: false });
        window.addEventListener('touchmove', touchMove, { capture: true, passive: false });
        window.addEventListener('touchend', touchEnd, { capture: true, passive: false });
        checkTimer = setTimeout(loadCheck, 500);
        CHECK_M_OBSERVER.observe(document, { childList: true, subtree: true });
    }

    // Fill in the unchanged functions from previous version
    async function setVideo(player) {
        let newPlayer = player.target || player;
        if (currentVideo && newPlayer.muted) return;
        currentVideo = newPlayer;
    }
    CanvasRenderingContext2D.prototype.drawImage = function () {
        const ele = arguments[0];
        if (ele && ele.nodeName === 'VIDEO' && !document.contains(ele)) {
            ele.style.display = 'none';
            this.canvas.insertAdjacentElement('afterend', ele);
        }
        return CANVAS_2D_DRAWIMAGE.call(this, ...arguments);
    };
    gestureData.videoFullScreen = async function() {
        if (resizeTimer) return;
        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(console.warn);
        } else if (currentVideo) {
            const container = gestureData.findVideoBox(currentVideo);
            if (container) await container.requestFullscreen().catch(console.warn);
        }
    };
    gestureData.findVideoBox = (player = currentVideo) => {
        if (!player || !document.contains(player)) return null;
        if (player._videoBox_?.contains(player) && (document.fullscreen || player._checkHeight_ === player.clientHeight)) return player._videoBox_;
        let parentEle = player.parentNode;
        player.setAttribute('_videobox_', '');
        player._checkHeight_ = player.clientHeight;
        player._videoBox_ = parentEle;
        while (parentEle && parentEle.nodeName !== 'BODY') {
            const parentStyle = getComputedStyle(parentEle);
            if (player.clientWidth * 1.08 > parentEle.clientWidth || player.clientHeight * 1.08 > parentEle.clientHeight) {
                if (parentEle.clientHeight) player._videoBox_ = parentEle;
                parentEle.setAttribute('_videobox_', '');
            } else {
                break;
            }
            parentEle = parentEle.parentNode;
        }
        return player._videoBox_;
    };
    function regRESIZE() {
        let videoCss = addStyle(''), findImportant = null;
        window.addEventListener('resize', () => {
            if (document.fullscreenElement && !fullsState) {
                resizeTimer = setTimeout(() => resizeTimer = 0, 400);
                fullsState = document.fullscreenElement;
                const srcVideo = fullsState.querySelector('video') || (fullsState.nodeName === 'VIDEO' ? fullsState : null);
                if (!srcVideo) { fullsState = 0; return; }
                if (srcVideo !== currentVideo) setVideo(srcVideo);
                findImportant = fullsState.querySelectorAll('*[_videobox_*="!important"]');
                videoCss.textContent = '*[_videobox_]{inset:0!important;margin:0!important;padding:0!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important}video{position:absolute;transform:none!important;object-fit:contain!important}';
                if(findImportant) findImportant.forEach(ele => ele.style.cssText = ele._fullscreenCSS_);
            } else if (fullsState && !document.fullscreenElement) {
                resizeTimer = setTimeout(() => resizeTimer = 0, 400);
                fullsState = 0;
                videoCss.textContent = '';
                if (findImportant) findImportant.forEach(ele => ele.style.cssText = ele._cssText_);
            }
        }, true);
    }
    Element.prototype.attachShadow = function () {
        if (!gestureData.shadowList) gestureData.shadowList = [];
        const shadowRoot = ATTACH_SHADOW.call(this, ...arguments);
        gestureData.shadowList.push(shadowRoot);
        CHECK_M_OBSERVER.observe(shadowRoot, { childList: true, subtree: true });
        return shadowRoot;
    };
    async function loadCheck() {
        let videoEles = [...document.querySelectorAll('video:not([_videoBox_])')];
        if (gestureData.shadowList) {
            for (const shadow of gestureData.shadowList) {
                videoEles.push(...shadow.querySelectorAll('video:not([_videoBox_])'));
            }
        }
        if (videoEles.length) {
            for (const video of videoEles) {
                await gestureData.findVideoBox(video);
                if (!video.paused) setVideo(video);
                video.addEventListener('playing', setVideo, true);
                video.addEventListener('volumechange', setVideo, true);
            }
        }
        checkTimer = 0;
    }
    function addStyle(css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        return style;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
