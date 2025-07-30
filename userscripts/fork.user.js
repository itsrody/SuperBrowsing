// ==UserScript==
// @name         Mobile Video Gestures – Material Edition
// @namespace    https://github.com/itsrody
// @version      1.0
// @description  Adds YouTube-like touch gestures & Material UI feedback to any web video (except a few big sites).
// @author       Rody
// @match        *://*/*
// @exclude      *://*.youtube.com/*
// @exclude      *://*.dailymotion.com/*
// @exclude      *://*.vimeo.com/*
// @exclude      *://*.netflix.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  /* ----------  CONFIG  ---------- */
  const CFG = {
    MIN_DURATION: 45,             // sec
    SEEK_STEP: 5,                 // sec
    SWIPE_THRESHOLD: 25,          // px
    SEEK_SENSITIVITY: 0.25,       // sec/px
    HAPTIC: true,                 // boolean
    HAPTIC_MS: 20,                // ms
    LABEL_DURATION: 800,          // ms
    LABEL_CLASS: 'mv-gesture-label'
  };

  /* ----------  MATERIAL CSS  ---------- */
  function injectCSS() {
    if (document.getElementById('mv-gesture-css')) return;
    const css = document.createElement('style');
    css.id = 'mv-gesture-css';
    css.textContent = `
      .${CFG.LABEL_CLASS} {
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,.82);
        color: #fff;
        font-family: "Roboto", "Noto", sans-serif;
        font-weight: 500;
        font-size: 14px;
        border-radius: 8px;
        padding: 12px 16px;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 8px;
        opacity: 0;
        transition: opacity .2s ease;
        pointer-events: none;
        box-shadow: 0 3px 5px -1px rgba(0,0,0,.2),
                    0 6px 10px 0   rgba(0,0,0,.14),
                    0 1px 18px 0   rgba(0,0,0,.12);
      }
      .${CFG.LABEL_CLASS}.show { opacity: 1; }
      .${CFG.LABEL_CLASS} svg { width: 24px; height: 24px; fill: #fff; }
    `;
    document.head.appendChild(css);
  }

  /* ----------  HELPERS  ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const haptic = () => CFG.HAPTIC && navigator.vibrate && navigator.vibrate(CFG.HAPTIC_MS);

  function label(text, iconSvg = '') {
    let div = document.querySelector(`.${CFG.LABEL_CLASS}`);
    if (!div) {
      div = document.createElement('div');
      div.className = CFG.LABEL_CLASS;
      document.body.appendChild(div);
    }
    div.innerHTML = iconSvg + text;
    div.classList.add('show');
    clearTimeout(div.hideTimer);
    div.hideTimer = setTimeout(() => div.classList.remove('show'), CFG.LABEL_DURATION);
  }

  function zone(x, w) {
    const ratio = x / w;
    if (ratio < 0.33) return 'left';
    if (ratio > 0.66) return 'right';
    return 'middle';
  }

  function format(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  /* ----------  STATE  ---------- */
  let v = null, rect = null, tsX = 0, tsY = 0, gesture = null, tapCount = 0, tapTimer = 0;

  /* ----------  GESTURE HANDLERS  ---------- */
  function seek(delta) {
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
    label(`${delta > 0 ? '+' : ''}${delta}s`);
    haptic();
  }

  function speed(rate) {
    v.playbackRate = rate;
    label(`${rate}x`, `<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`);
    haptic();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      label('Exit', `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5zm3-8H5v2h5V5H8z"/></svg>`);
    } else {
      v.requestFullscreen?.() ?? v.parentElement.requestFullscreen?.();
      label('Fullscreen', `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zm-2-6V5h-2v5h5V8z"/></svg>`);
    }
    haptic();
  }

  /* ----------  TOUCH EVENTS  ---------- */
  function onStart(e) {
    v = e.target.closest('video');
    if (!v || v.duration < CFG.MIN_DURATION) return;
    rect = v.getBoundingClientRect();
    tsX = e.touches[0].clientX;
    tsY = e.touches[0].clientY;
    gesture = null;

    /* double-tap timer */
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => (tapCount = 0), 300);
  }

  function onMove(e) {
    if (!v || e.touches.length > 1) return;
    const dx = e.touches[0].clientX - tsX;
    const dy = e.touches[0].clientY - tsY;

    if (!gesture && Math.max(Math.abs(dx), Math.abs(dy)) > CFG.SWIPE_THRESHOLD) {
      gesture = Math.abs(dx) > Math.abs(dy) ? 'seek' : 'vertical';
      e.preventDefault(); // stop native scroll
    }

    if (gesture === 'seek' && document.fullscreenElement) {
      e.preventDefault();
      label(format(v.currentTime + dx * CFG.SEEK_SENSITIVITY));
    }
  }

  function onEnd(e) {
    if (!v) return;
    const dx = e.changedTouches[0].clientX - tsX;
    const dy = e.changedTouches[0].clientY - tsY;

    /* --- normal view swipe-up -> fullscreen --- */
    if (!document.fullscreenElement && !gesture && dy < -CFG.SWIPE_THRESHOLD) {
      toggleFullscreen();
      return;
    }

    /* --- fullscreen gestures --- */
    if (!document.fullscreenElement) return;

    const z = zone(tsX, rect.width);

    /* double-tap seek */
    if (!gesture && tapCount >= 2) {
      if (z === 'left') { seek(-CFG.SEEK_STEP); }
      else if (z === 'right') { seek(CFG.SEEK_STEP); }
      tapCount = 0;
      return;
    }

    /* vertical swipe zone actions */
    if (gesture === 'vertical') {
      if (z === 'middle' && dy > CFG.SWIPE_THRESHOLD) {
        toggleFullscreen();            // swipe-down middle
      } else if (z === 'left') {
        if (dy < -CFG.SWIPE_THRESHOLD) speed(2);
        else if (dy > CFG.SWIPE_THRESHOLD) speed(1);
      }
    }

    /* seek after drag */
    if (gesture === 'seek') {
      v.currentTime += dx * CFG.SEEK_SENSITIVITY;
      haptic();
    }
  }

  /* ----------  INIT  ---------- */
  function init() {
    injectCSS();
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
