// ==UserScript==
// @name          Video Gestures Pro Enhanced
// @namespace     https://github.com/itsrody/SuperBrowsing
// @version       8.0
// @description   Adds a powerful, zoned gesture interface (seek, volume, playback speed, fullscreen, brightness) to most web videos with customizable settings.
// @author        Murtaza Salih, Improved by ChatGPT
// @match         *://*/*
// @exclude       *://*.youtube.com/*
// @exclude       *://*.dailymotion.com/*
// @exclude       *://*.vimeo.com/*
// @exclude       *://*.netflix.com/*
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_registerMenuCommand
// @run-at        document-idle
// ==/UserScript==

;(function() {
    'use strict';

    // --- Default Settings and Storage ---
    const DEFAULTS = {
        seekZone: { x: 0.6, y: 0.8, width: 0.4, height: 0.4 },
        volumeZone: { x: 0.8, y: 0.2, width: 0.2, height: 0.6 },
        speedZone: { x: 0.2, y: 0.2, width: 0.2, height: 0.6 },
        brightnessZone: { x: 0.2, y: 0.8, width: 0.4, height: 0.4 },
        gestureThreshold: 20,
        feedbackDuration: 800
    };
    let settings = GM_getValue('vg-settings', DEFAULTS);

    GM_registerMenuCommand('Video Gestures Settings', openSettings);

    function openSettings() {
        const json = prompt('Customize Video Gestures Settings (in JSON)', JSON.stringify(settings, null, 2));
        try {
            const parsed = JSON.parse(json);
            settings = Object.assign({}, DEFAULTS, parsed);
            GM_setValue('vg-settings', settings);
            alert('Settings saved! Reload page to apply.');
        } catch (e) {
            alert('Invalid JSON. No changes made.');
        }
    }

    // --- Utility ---
    function showIndicator(video, html) {
        clearIndicator(video);
        const el = document.createElement('div');
        el.className = 'vg-indicator';
        el.innerHTML = html;
        Object.assign(el.style, {
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            background: 'rgba(0,0,0,0.6)', padding: '10px',
            'border-radius': '50%', 'z-index': 9999,
            transition: 'opacity 0.3s'
        });
        video.parentElement.style.position = 'relative';
        video.parentElement.appendChild(el);
        setTimeout(() => el.remove(), settings.feedbackDuration);
    }
    function clearIndicator(video) {
        const old = video.parentElement.querySelector('.vg-indicator');
        if (old) old.remove();
    }
    function triggerHapticFeedback() {
        if (navigator.vibrate) navigator.vibrate(10);
    }

    // --- Gesture Handling ---
    function initGestures(video) {
        let startX, startY, currentAction;
        video.style.touchAction = 'none';

        video.addEventListener('pointerdown', e => {
            if (e.pointerType !== 'touch') return;
            startX = e.clientX; startY = e.clientY;
            currentAction = null;
        });

        video.addEventListener('pointermove', e => {
            if (startX == null) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (!currentAction && Math.hypot(dx,dy) > settings.gestureThreshold) {
                currentAction = detectZone(video, startX, startY);
            }
            if (currentAction) performAction(video, currentAction, dx, dy);
        });

        video.addEventListener('pointerup', () => startX = startY = currentAction = null);
    }

    function detectZone(video, x, y) {
        const vw = video.clientWidth, vh = video.clientHeight;
        const relX = (x - video.getBoundingClientRect().left) / vw;
        const relY = (y - video.getBoundingClientRect().top) / vh;
        if (inZone(relX, relY, settings.seekZone)) return 'seek';
        if (inZone(relX, relY, settings.volumeZone)) return 'volume';
        if (inZone(relX, relY, settings.speedZone)) return 'speed';
        if (inZone(relX, relY, settings.brightnessZone)) return 'brightness';
        return null;
    }
    function inZone(x,y,zone) {
        return x>=zone.x && x<=zone.x+zone.width && y>=zone.y && y<=zone.y+zone.height;
    }

    function performAction(video, action, dx, dy) {
        switch(action) {
            case 'seek': video.currentTime += dx/5; showIndicator(video, Math.round(video.currentTime)+'s'); break;
            case 'volume': video.volume = Math.min(1, Math.max(0, video.volume - dy/200)); showIndicator(video, '🔊'+Math.round(video.volume*100)+'%'); break;
            case 'speed': video.playbackRate = Math.min(4, Math.max(0.25, video.playbackRate + dy/200)); showIndicator(video, '⏩'+video.playbackRate.toFixed(2)+'x'); break;
            case 'brightness': video.style.filter = `brightness(${Math.min(2, Math.max(0.5, 1 + dy/200))})`; showIndicator(video, '🌙'); break;
        }
        triggerHapticFeedback();
    }

    // --- Initialization ---
    function scanVideos() {
        document.querySelectorAll('video').forEach(video => {
            if (!video.dataset.vgInit) {
                initGestures(video);
                video.dataset.vgInit = true;
            }
        });
    }
    new MutationObserver(scanVideos).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', scanVideos);
})();
