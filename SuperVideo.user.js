// ==UserScript==
// @name         SuperVideo
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Mobile video gestures and css filters.
// @author       Murtaza Sailh
// @license      MIT
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @downloadURL  https://update.greasyfork.org/scripts/524654/SuperVideo.user.js
// @updateURL    https://update.greasyfork.org/scripts/524654/SuperVideo.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // --- Configurable defaults ---
    const DEFAULT_SKIP_TIME_THRESHOLD     = 300;
    const DEFAULT_SKIP_DISTANCE_THRESHOLD = 30;
    const DEFAULT_DOUBLE_TAP_DELAY        = 300;
    const DEFAULT_TAP_DURATION_THRESHOLD  = 200;
    const DEFAULT_BRIGHTNESS              = 100;
    const DEFAULT_CONTRAST                = 100;
    const DEFAULT_SATURATION              = 100;
    const OBSERVER_RECONNECT_DELAY        = 10000;

    // Load settings
    let SKIP_TIME_THRESHOLD     = GM_getValue('SKIP_TIME_THRESHOLD', DEFAULT_SKIP_TIME_THRESHOLD);
    let SKIP_DISTANCE_THRESHOLD = GM_getValue('SKIP_DISTANCE_THRESHOLD', DEFAULT_SKIP_DISTANCE_THRESHOLD);
    let DOUBLE_TAP_DELAY        = GM_getValue('DOUBLE_TAP_DELAY', DEFAULT_DOUBLE_TAP_DELAY);
    let TAP_DURATION_THRESHOLD  = GM_getValue('TAP_DURATION_THRESHOLD', DEFAULT_TAP_DURATION_THRESHOLD);
    let BRIGHTNESS              = GM_getValue('BRIGHTNESS', DEFAULT_BRIGHTNESS);
    let CONTRAST                = GM_getValue('CONTRAST', DEFAULT_CONTRAST);
    let SATURATION              = GM_getValue('SATURATION', DEFAULT_SATURATION);

    // Individual menu commands for each setting
    GM_registerMenuCommand('Set Skip Time Threshold', () => {
        const v = prompt('Skip time threshold in ms:', SKIP_TIME_THRESHOLD);
        if (v !== null) { SKIP_TIME_THRESHOLD = parseInt(v, 10); GM_setValue('SKIP_TIME_THRESHOLD', SKIP_TIME_THRESHOLD); alert('Skip time threshold set to ' + SKIP_TIME_THRESHOLD + ' ms'); }
    });

    GM_registerMenuCommand('Set Skip Distance Threshold', () => {
        const v = prompt('Skip distance threshold in px:', SKIP_DISTANCE_THRESHOLD);
        if (v !== null) { SKIP_DISTANCE_THRESHOLD = parseInt(v, 10); GM_setValue('SKIP_DISTANCE_THRESHOLD', SKIP_DISTANCE_THRESHOLD); alert('Skip distance threshold set to ' + SKIP_DISTANCE_THRESHOLD + ' px'); }
    });

    GM_registerMenuCommand('Set Double-Tap Delay', () => {
        const v = prompt('Double-tap maximum delay in ms:', DOUBLE_TAP_DELAY);
        if (v !== null) { DOUBLE_TAP_DELAY = parseInt(v, 10); GM_setValue('DOUBLE_TAP_DELAY', DOUBLE_TAP_DELAY); alert('Double-tap delay set to ' + DOUBLE_TAP_DELAY + ' ms'); }
    });

    GM_registerMenuCommand('Set Tap Duration Threshold', () => {
        const v = prompt('Tap maximum duration in ms:', TAP_DURATION_THRESHOLD);
        if (v !== null) { TAP_DURATION_THRESHOLD = parseInt(v, 10); GM_setValue('TAP_DURATION_THRESHOLD', TAP_DURATION_THRESHOLD); alert('Tap duration threshold set to ' + TAP_DURATION_THRESHOLD + ' ms'); }
    });

    GM_registerMenuCommand('Set Brightness', () => {
        const v = prompt('Brightness percentage:', BRIGHTNESS);
        if (v !== null) { BRIGHTNESS = parseInt(v, 10); GM_setValue('BRIGHTNESS', BRIGHTNESS); applyFiltersToAll(); alert('Brightness set to ' + BRIGHTNESS + '%'); }
    });

    GM_registerMenuCommand('Set Contrast', () => {
        const v = prompt('Contrast percentage:', CONTRAST);
        if (v !== null) { CONTRAST = parseInt(v, 10); GM_setValue('CONTRAST', CONTRAST); applyFiltersToAll(); alert('Contrast set to ' + CONTRAST + '%'); }
    });

    GM_registerMenuCommand('Set Saturation', () => {
        const v = prompt('Saturation percentage:', SATURATION);
        if (v !== null) { SATURATION = parseInt(v, 10); GM_setValue('SATURATION', SATURATION); applyFiltersToAll(); alert('Saturation set to ' + SATURATION + '%'); }
    });

    // Gesture state
    let startX = 0, startY = 0;
    let initialTime = 0, initialVolume = 0;
    let seeking = false, movedEnough = false;
    let timeChange = 0, deltaX = 0, deltaY = 0;
    let gestureStart = 0, lastTap = 0;
    let doubleTapTimer = null, longPressTimer = null, isSpeedingUp = false;
    const playbackRates = new Map();

    // Overlay singleton with system font
    let overlay;
    function getOverlay() {
        if (!overlay) {
            overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'absolute',
                padding: '8px 16px',
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: '#fff',
                fontSize: '16px',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", sans-serif',
                borderRadius: '6px',
                zIndex: 999999,
                display: 'none',
                pointerEvents: 'none',
                textAlign: 'center'
            });
        }
        return overlay;
    }

    function showOverlay(video, html) {
        const ov = getOverlay();
        ov.innerHTML = html;
        const container = document.fullscreenElement || document.body;
        if (ov.parentNode !== container) container.appendChild(ov);
        const rect = video.getBoundingClientRect();
        ov.style.top = (rect.top + rect.height / 2) + 'px';
        ov.style.left = (rect.left + rect.width / 2) + 'px';
        ov.style.transform = 'translate(-50%, -50%)';
        ov.style.display = 'block';
    }

    function hideOverlay() {
        if (overlay) overlay.style.display = 'none';
    }

    // Filters
    function applyFilters(video) {
        video.style.filter = `brightness(${BRIGHTNESS}%) contrast(${CONTRAST}%) saturate(${SATURATION}%)`;
    }

    function applyFiltersToAll() {
        document.querySelectorAll('video').forEach(applyFilters);
    }

    // Formatting functions
    function formatTime(s) {
        const absS = Math.abs(s);
        const h = Math.floor(absS / 3600);
        const m = Math.floor((absS % 3600) / 60);
        const sec = Math.floor(absS % 60);
        const pad = v => (v < 10 ? '0' + v : v);
        return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
    }

    function formatDelta(s) {
        const sign = s < 0 ? '-' : '';
        const absS = Math.abs(s);
        const m = Math.floor(absS / 60);
        const sec = Math.floor(absS % 60);
        const frac = Math.round((absS % 1) * 100);
        return m > 0 ? `${sign}${m}:${sec < 10 ? '0' + sec : sec}` : `${sign}${sec}.${frac < 10 ? '0' + frac : frac}`;
    }

    // Throttle touchmove updates
    let rafPending = false;
    let lastMoveEvent = null;

    function processMove(video) {
        const e = lastMoveEvent;
        rafPending = false;
        if (!e || !seeking || isSpeedingUp) return;

        deltaX = e.touches[0].clientX - startX;
        deltaY = e.touches[0].clientY - startY;

        if (!movedEnough && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
            movedEnough = true;
            clearTimeout(longPressTimer);
            clearTimeout(doubleTapTimer);
            lastTap = 0;
        }

        if (!movedEnough) return;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            timeChange = deltaX * 0.05;
            const t = Math.max(0, Math.min(initialTime + timeChange, video.duration));
            showOverlay(video, `<div>${formatTime(t)}</div><div>(${timeChange >= 0 ? '+' : ''}${formatDelta(timeChange)})</div>`);
        } else {
            const volCh = -deltaY * 0.005;
            const v = Math.max(0, Math.min(initialVolume + volCh, 1));
            video.volume = v;
            const pct = Math.round(v * 100);
            const diff = Math.round((v - initialVolume) * 100);
            showOverlay(video, `<div>Volume: ${pct}%</div><div>(${diff >= 0 ? '+' : ''}${diff}%)</div>`);
        }
    }

    function onTouchStart(e, video) {
        applyFilters(video);
        clearTimeout(doubleTapTimer);
        lastTap = 0;

        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        initialTime = video.currentTime;
        initialVolume = video.volume;
        seeking = true;
        movedEnough = false;
        gestureStart = Date.now();

        longPressTimer = setTimeout(() => {
            if (!movedEnough) {
                playbackRates.set(video, video.playbackRate);
                video.playbackRate = 2.0;
                showOverlay(video, '<div>2× Speed</div>');
                isSpeedingUp = true;
            }
        }, 500);
    }

    function onTouchMove(e, video) {
        lastMoveEvent = e;
        if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(() => processMove(video));
        }
        e.preventDefault();
    }

    function onTouchEnd(video) {
        seeking = false;
        clearTimeout(longPressTimer);
        const now = Date.now();
        const dur = now - gestureStart;

        // Double-tap detection
        if (!movedEnough && !isSpeedingUp && dur < TAP_DURATION_THRESHOLD) {
            if (lastTap > 0) {
                clearTimeout(doubleTapTimer);
                lastTap = 0;
                if (video.videoWidth > video.videoHeight) {
                    const fs = document.fullscreenElement;
                    fs ? document.exitFullscreen() : (video.requestFullscreen || video.webkitRequestFullscreen).call(video);
                    showOverlay(video, '<div>Fullscreen</div>');
                    setTimeout(hideOverlay, 300);
                    return;
                }
            } else {
                lastTap = now;
                doubleTapTimer = setTimeout(() => { lastTap = 0; }, DOUBLE_TAP_DELAY);
                return;
            }
        }

        // Quick skip
        if (!isSpeedingUp && movedEnough && Math.abs(deltaX) > SKIP_DISTANCE_THRESHOLD && dur < SKIP_TIME_THRESHOLD) {
            const skip = deltaX < 0 ? 5 : -5;
            const t2 = Math.max(0, Math.min(initialTime + skip, video.duration));
            video.currentTime = t2;
            showOverlay(video, `<div>${formatTime(t2)}</div><div>(${skip >= 0 ? '+' : ''}${formatDelta(skip)})</div>`);
            setTimeout(hideOverlay, 300);
        }
        // Reset speed or finalize seek
        else if (isSpeedingUp) {
            video.playbackRate = playbackRates.get(video) || 1.0;
            isSpeedingUp = false;
        } else if (movedEnough) {
            const finalT = Math.max(0, Math.min(initialTime + timeChange, video.duration));
            video.currentTime = finalT;
        }

        hideOverlay();
    }

    function addGesture(video) {
        if (video._svInit) return;
        video._svInit = true;
        applyFilters(video);
        video.playbackRate = playbackRates.get(video) || 1.0;
        video.addEventListener('touchstart', e => onTouchStart(e, video), { passive: true });
        video.addEventListener('touchmove', e => onTouchMove(e, video), { passive: false });
        video.addEventListener('touchend', () => onTouchEnd(video), { passive: true });
    }

    function traverse(root) {
        root.querySelectorAll('video').forEach(addGesture);
        root.querySelectorAll('*').forEach(el => el.shadowRoot && traverse(el.shadowRoot));
    }

    function scan() {
        traverse(document);
        observer.disconnect();
        setTimeout(() => observer.observe(document.body, { childList: true, subtree: true }), OBSERVER_RECONNECT_DELAY);
    }

    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', scan);
})();
