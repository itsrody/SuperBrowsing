// ==UserScript==
// @name        Video Gestures Pro – ScriptCat Edition
// @namespace   https://github.com/itsrody/SuperBrowsing
// @version     8.0-sc
// @description Android-style gestures + modern extras for every HTML5 video.
// @author      Murtaza Salih, SC-port: you
// @match       *://*/*
// @exclude     *://*.youtube.com/*
// @exclude     *://*.dailymotion.com/*
// @exclude     *://*.vimeo.com/*
// @exclude     *://*.netflix.com/*
//
// ---------- ScriptCat modern grants ----------
// @storage     {config: {type: "object", default: {
//   "MIN_VIDEO_DURATION_SECONDS":90,
//   "DOUBLE_TAP_SEEK_SECONDS":5,            // center
//   "DOUBLE_TAP_EDGE_SEEK_SECONDS":10,      // edges
//   "SWIPE_THRESHOLD":20,
//   "SEEK_SENSITIVITY":0.3,
//   "ENABLE_HAPTIC_FEEDBACK":true,
//   "HAPTIC_FEEDBACK_DURATION_MS":20,
//   "FORCE_LANDSCAPE":true,
//   "LEFT_HANDED":false,
//   "SHOW_SPEED_DIAL":true,
//   "FINE_SCRUB_AFTER_SWIPE":true,
//   "BRIGHTNESS_SLIDER":true,
//   "ENABLE_LOOP_MAKER":false,
//   "ENABLE_SCREENSHOT":false,
//   "ENABLE_CAST":false,
//   "ENABLE_STATS":false
// }}}
// @menu        {id:"openCfg", title:"⚙️ Configure", onClick: openConfig}
// @css         vg-styles
// @resource    icons   https://cdn.jsdelivr.net/gh/itsrody/gesture-icons@main/icons.svg
// @run-mode    eager
// @grant       GM_storage
// @grant       GM_menu
// @grant       GM_resource
// ==/UserScript==

(async () => {
  'use strict';

  /* ---------- 0. Config ---------- */
  const cfg = await GM_storage.get('config');

  /* ---------- 1. Inject CSS ---------- */
  const css = `
  :root {
    --vg-bg: rgba(30,30,30,.9);
    --vg-fg: #fff;
    --vg-radius: 20px;
    --vg-z: 2147483647;
  }
  .vg-indicator, .vg-ruler, .vg-speed-dial, .vg-brightness-slider {
    position: fixed;
    z-index: var(--vg-z);
    pointer-events: none;
    font-family: Roboto, sans-serif;
    color: var(--vg-fg);
  }
  .vg-indicator {
    top: 50%; left: 50%;
    transform: translate(-50%,-50%);
    background: var(--vg-bg);
    padding: 10px 16px; border-radius: var(--vg-radius);
    display: flex; align-items: center; gap: 8px;
    opacity: 0; transition: opacity .2s;
  }
  .vg-indicator.visible { opacity: 1; }
  .vg-ruler {
    bottom: 20%; left: 50%;
    transform: translateX(-50%);
    background: var(--vg-bg);
    padding: 4px 10px; border-radius: 4px;
    font-size: 12px;
  }
  .vg-speed-dial {
    bottom: 25%; left: 50%;
    transform: translateX(-50%);
    display: flex; gap: 8px;
  }
  .vg-speed-dial button {
    background: var(--vg-bg);
    border: none; color: var(--vg-fg);
    padding: 8px 12px; border-radius: var(--vg-radius);
    pointer-events: auto;
  }
  .vg-brightness-slider {
    top: 20%; left: 8px;
    width: 8px; height: 120px;
    background: var(--vg-bg);
    border-radius: 4px;
    --value: 50%;
  }
  .vg-brightness-slider::before {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: var(--value);
    background: #0af; border-radius: 4px;
  }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- 2. Utils ---------- */
  const tick = () => cfg.ENABLE_HAPTIC_FEEDBACK && navigator.vibrate?.(cfg.HAPTIC_FEEDBACK_DURATION_MS);
  const fmt = t => { const s = Math.floor(t%60), m = Math.floor(t/60)%60, h = Math.floor(t/3600); return h?`${h}:${m.pad2}:${s.pad2}`:`${m.pad2}:${s.pad2}`; };
  Number.prototype.pad2 = function () { return this.toString().padStart(2, '0'); };

  /* ---------- 3. Settings panel ---------- */
  async function openConfig() {
    await GM_storage.edit('config');
    location.reload();
  }

  /* ---------- 4. Core state ---------- */
  let video = null, rect = null, startX = 0, startY = 0, type = null, tapCount = 0, tapTimer = null;
  let scrubbing = false, dialShown = false, loopA = null;

  /* ---------- 5. DOM helpers ---------- */
  const el = (tag, cls, parent = document.body) => { const d = document.createElement(tag); d.className = cls; parent.appendChild(d); return d; };
  const show = (cls, html, dur = 800) => {
    const box = el('div', cls);
    box.innerHTML = html;
    requestAnimationFrame(() => box.classList.add('visible'));
    setTimeout(() => box.remove(), dur);
  };

  /* ---------- 6. Event glue ---------- */
  document.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('touchmove',  onMove,  { passive: false });
  document.addEventListener('touchend',   onEnd,   { passive: false });

  /* ---------- 7. Handlers ---------- */
  function onStart(e) {
    video = e.target.closest('video');
    if (!video || video.duration < cfg.MIN_VIDEO_DURATION_SECONDS) return;
    rect = video.getBoundingClientRect();
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    type = 'tap';
    // triple tap
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => tapCount = 0, 400);
  }

  function onMove(e) {
    if (!video) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!type.startsWith('swipe') && (Math.abs(dx) > cfg.SWIPE_THRESHOLD || Math.abs(dy) > cfg.SWIPE_THRESHOLD)) {
      const vertical = Math.abs(dy) > Math.abs(dx);
      type = vertical ? 'swipe-y' : 'swipe-x';
    }
    if (type === 'swipe-x') {
      e.preventDefault();
      if (cfg.FINE_SCRUB_AFTER_SWIPE) {
        scrubbing = true;
        show('vg-ruler', fmt(video.currentTime + dx * cfg.SEEK_SENSITIVITY), 100);
      }
    }
    if (type === 'swipe-y') {
      e.preventDefault();
      const zone = cfg.LEFT_HANDED ? (startX - rect.left) / rect.width : 1 - (startX - rect.left) / rect.width;
      if (zone < .33) handleBrightness(dy);
      else if (zone > .66) handleVolume(dy);
    }
  }

  function onEnd(e) {
    if (!video) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    if (type === 'tap') {
      if (tapCount === 3) { handleChapter(); return; }
      const zone = (startX - rect.left) / rect.width;
      const skip = zone < .15 || zone > .85 ? cfg.DOUBLE_TAP_EDGE_SEEK_SECONDS : cfg.DOUBLE_TAP_SEEK_SECONDS;
      if (tapCount === 2) {
        const fwd = zone > .5;
        video.currentTime += fwd ? skip : -skip;
        show('vg-indicator', `${fwd ? '+' : '-'}${skip}s`);
        tick();
      }
    }
    if (scrubbing) {
      video.currentTime += dx * cfg.SEEK_SENSITIVITY;
      scrubbing = false;
      tick();
    }
  }

  /* ---------- 8. Feature implementations ---------- */
  function handleBrightness(dy) {
    if (!cfg.BRIGHTNESS_SLIDER) return;
    // Web-API not available on Firefox Android, fallback toast
    show('vg-indicator', `☀️ ${Math.round(50-dy)}%`);
    tick();
  }
  function handleVolume(dy) {
    const v = Math.max(0, Math.min(1, video.volume - dy / 300));
    video.volume = v;
    show('vg-indicator', `🔊 ${Math.round(v*100)}%`);
    tick();
  }
  function handleChapter() {
    // stub – parse cues or yt chapters
    show('vg-indicator', '⏭️ Next chapter (stub)');
  }

  /* ---------- 9. Optional toggles (OFF by default) ---------- */
  function enableOptionalFeatures() {
    // loop maker, screenshot, cast, stats – add listeners here
  }

  /* ---------- 10. Init ---------- */
  enableOptionalFeatures();
})();
