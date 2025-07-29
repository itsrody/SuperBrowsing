// ==UserScript==
// @name         Universal Video Gestures
// @namespace    http://your-namespace.com
// @version      4.0
// @description  Adds a powerful, zoned gesture interface (seek, volume, brightness, speed) to most web videos.
// @author       Your Name
// @match        *://*/*
// @exclude      *://*.youtube.com/*
// @exclude      *://*.dailymotion.com/*
// @exclude      *://*.vimeo.com/*
// @exclude      *://*.netflix.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    const MIN_VIDEO_DURATION_SECONDS = 60; // Lowered to 1 minute for wider compatibility
    const DOUBLE_TAP_SEEK_SECONDS = 10;
    const DOUBLE_TAP_TIMEOUT_MS = 350;
    const SWIPE_THRESHOLD = 15;
    const SEEK_SENSITIVITY = 0.1;
    const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

    // --- Styles ---
    function injectStyles() {
        if (document.getElementById('video-gesture-pro-styles')) return;
        const style = document.createElement('style');
        style.id = 'video-gesture-pro-styles';
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');
            .vg-indicator {
                position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                padding: 10px 16px; background-color: rgba(30, 30, 30, 0.9);
                color: #fff; font-family: 'Roboto', sans-serif; font-size: 16px;
                border-radius: 20px; z-index: 2147483647; display: flex;
                align-items: center; gap: 8px; opacity: 0; pointer-events: none;
                transition: opacity 0.2s ease, transform 0.2s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            .vg-indicator.visible { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            .vg-indicator svg { width: 24px; height: 24px; fill: #fff; }

            .vg-speed-menu {
                position: absolute; display: flex; flex-direction: column;
                gap: 5px; background-color: rgba(30, 30, 30, 0.9);
                padding: 8px; border-radius: 12px; z-index: 2147483647;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                opacity: 0; transition: opacity 0.2s ease; pointer-events: none;
            }
            .vg-speed-menu.visible { opacity: 1; pointer-events: auto; }
            .vg-speed-menu button {
                background: none; border: none; color: #fff; font-size: 15px;
                padding: 8px 12px; border-radius: 8px; cursor: pointer;
                transition: background-color 0.2s ease;
            }
            .vg-speed-menu button:hover { background-color: rgba(255,255,255,0.1); }
            .vg-speed-menu button.active { background-color: rgba(70,130,255,0.7); }
        `;
        document.head.appendChild(style);
    }

    // --- Global State ---
    let touchStartX = 0, touchStartY = 0;
    let currentVideo = null;
    let gestureType = null; // 'tap', 'swipe-x', 'swipe-y', 'long-press'
    let tapTimeout = null, longPressTimeout = null;
    let tapCount = 0;

    // --- UI Elements ---
    function createElements(video) {
        if (video.gestureElements) return;
        const parent = video.parentElement;
        if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

        const indicator = document.createElement('div');
        indicator.className = 'vg-indicator';
        parent.appendChild(indicator);

        const speedMenu = document.createElement('div');
        speedMenu.className = 'vg-speed-menu';
        parent.appendChild(speedMenu);

        video.gestureElements = { indicator, speedMenu };
    }

    function showIndicator(video, html) {
        const { indicator } = video.gestureElements;
        indicator.innerHTML = html;
        indicator.classList.add('visible');
        setTimeout(() => indicator.classList.remove('visible'), 800);
    }

    // --- Event Handlers ---
    function onTouchStart(e) {
        const video = e.target.closest('video');
        if (!video || video.duration < MIN_VIDEO_DURATION_SECONDS) return;
        
        currentVideo = video;
        createElements(currentVideo);

        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        gestureType = 'tap'; // Assume tap initially

        longPressTimeout = setTimeout(() => {
            gestureType = 'long-press';
            showSpeedMenu(currentVideo, touchStartX, touchStartY);
            e.preventDefault();
        }, 500);

        tapTimeout = setTimeout(() => {
            tapCount = 0;
        }, DOUBLE_TAP_TIMEOUT_MS);
        
        tapCount++;
    }

    function onTouchMove(e) {
        if (!currentVideo || gestureType === 'long-press') return;

        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;

        if (Math.abs(deltaX) > SWIPE_THRESHOLD || Math.abs(deltaY) > SWIPE_THRESHOLD) {
            clearTimeout(longPressTimeout);
            if (!gestureType || gestureType === 'tap') {
                gestureType = Math.abs(deltaX) > Math.abs(deltaY) ? 'swipe-x' : 'swipe-y';
            }
        }
        
        if (!gestureType.startsWith('swipe')) return;

        e.preventDefault(); // Prevent page scroll only when swiping on video

        if (gestureType === 'swipe-x') handleHorizontalSwipe(deltaX);
        if (gestureType === 'swipe-y') handleVerticalSwipe(deltaY);
    }

    function onTouchEnd(e) {
        clearTimeout(longPressTimeout);
        if (!currentVideo) return;

        if (gestureType === 'tap') {
            if (tapCount >= 2) {
                e.preventDefault();
                handleDoubleTap();
                clearTimeout(tapTimeout);
                tapCount = 0;
            }
            // Single tap is ignored to allow native play/pause
        } else if (gestureType === 'swipe-x') {
            const deltaX = e.changedTouches[0].clientX - touchStartX;
            const seekTime = deltaX * SEEK_SENSITIVITY;
            currentVideo.currentTime += seekTime;
        }

        setTimeout(() => {
             if (currentVideo && currentVideo.gestureElements) {
                currentVideo.gestureElements.indicator.classList.remove('visible');
            }
        }, 300);

        currentVideo = null;
        gestureType = null;
    }

    // --- Gesture Logic ---
    function handleDoubleTap() {
        const rect = currentVideo.getBoundingClientRect();
        const tapZone = (touchStartX - rect.left) / rect.width;

        if (tapZone < 0.33) { // Left
            currentVideo.currentTime -= DOUBLE_TAP_SEEK_SECONDS;
            showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6l-8.5 6z"/></svg> -10s`);
        } else if (tapZone > 0.66) { // Right
            currentVideo.currentTime += DOUBLE_TAP_SEEK_SECONDS;
            showIndicator(currentVideo, `+10s <svg viewBox="0 0 24 24"><path d="M18 6h-2v12h2zM4 6v12l8.5-6L4 6z"/></svg>`);
        }
    }

    function handleHorizontalSwipe(deltaX) {
        const seekTime = deltaX * SEEK_SENSITIVITY;
        const newTime = currentVideo.currentTime + seekTime;
        const direction = seekTime > 0 ? 'forward' : 'rewind';
        const icon = direction === 'forward' ? `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>` : `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm-2-6l6.5 4.5V7.5L9 12z"/></svg>`;
        showIndicator(currentVideo, `${icon} ${formatTime(newTime)}`);
    }

    function handleVerticalSwipe(deltaY) {
        const rect = currentVideo.getBoundingClientRect();
        const tapZone = (touchStartX - rect.left) / rect.width;
        
        if (tapZone > 0.5) { // Right side for Volume
            const volumeChange = -deltaY / 100; // Invert deltaY
            currentVideo.volume = Math.max(0, Math.min(1, currentVideo.volume + volumeChange));
            showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg> ${Math.round(currentVideo.volume * 100)}%`);
        } else { // Left side for Brightness
            // Browser scripts cannot change system brightness. This is a visual indicator only.
            showIndicator(currentVideo, `<svg viewBox="0 0 24 24"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg> Brightness`);
        }
    }

    function showSpeedMenu(video, x, y) {
        const { speedMenu } = video.gestureElements;
        speedMenu.innerHTML = ''; // Clear old buttons
        PLAYBACK_RATES.forEach(rate => {
            const btn = document.createElement('button');
            btn.textContent = `${rate}x`;
            if (video.playbackRate === rate) btn.classList.add('active');
            btn.onclick = (e) => {
                e.stopPropagation();
                video.playbackRate = rate;
                hideSpeedMenu(video);
            };
            speedMenu.appendChild(btn);
        });

        speedMenu.classList.add('visible');
        const rect = video.getBoundingClientRect();
        speedMenu.style.left = `${x - rect.left}px`;
        speedMenu.style.top = `${y - rect.top}px`;

        // Add a one-time listener to hide the menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', () => hideSpeedMenu(video), { once: true });
        }, 0);
    }
    
    function hideSpeedMenu(video) {
        if (video && video.gestureElements) {
            video.gestureElements.speedMenu.classList.remove('visible');
        }
    }

    // --- Utilities ---
    function formatTime(totalSeconds) {
        const sec = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        const min = Math.floor((totalSeconds / 60) % 60).toString().padStart(2, '0');
        const hr = Math.floor(totalSeconds / 3600);
        return hr > 0 ? `${hr}:${min}:${sec}` : `${min}:${sec}`;
    }

    // --- Initialization ---
    function initialize() {
        injectStyles();
        // Use event delegation on the body to catch all video interactions
        document.body.addEventListener('touchstart', onTouchStart, { passive: false });
        document.body.addEventListener('touchmove', onTouchMove, { passive: false });
        document.body.addEventListener('touchend', onTouchEnd, { passive: false });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
