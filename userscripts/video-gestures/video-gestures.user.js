// ==UserScript==
// @name          Video Gestures Pro (Refactored Long-Press)
// @namespace     https://github.com/itsrody/SuperBrowsing
// @version       10.3.0
// @description   Adds a powerful, zoned gesture interface that works only in fullscreen mode. Refactored for stability and maintainability.
// @author        Murtaza Salih (refactor by GitHub Copilot)
// @match         *://*/*
// @exclude       *://*.netflix.com/*
// @exclude       *://netflix.com/*
// @exclude       *://*.youtube.com/*
// @exclude       *://youtube.com/*
// @exclude       *://*.instagram.com/*
// @exclude       *://instagram.com/*
// @exclude       *://*.facebook.com/*
// @exclude       *://facebook.com/*
// @exclude       *://*.reddit.com/*
// @exclude       *://reddit.com/*
// @exclude       *://*.tiktok.com/*
// @exclude       *://tiktok.com/*
// @exclude       *://*.dailymotion.com/*
// @exclude       *://dailymotion.com/*
// @exclude       *://*.hulu.com/*
// @exclude       *://hulu.com/*
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_registerMenuCommand
// @run-at        document-start
// ==/UserScript==

(async () => {
  'use strict';

  // ---------- Constants & Utilities ----------
  const STYLE_ID = 'video-gesture-pro-styles';
  const INDICATOR_ID = 'vg-global-indicator';
  const BRIGHTNESS_ID = 'vg-brightness-overlay';
  // New: site-level toast that always stays on page body (never moves into fullscreen containers)
  const SITE_TOAST_ID = 'vg-site-toast';

  /** Detect mobile devices (mobile UA or coarse pointer). */
  const isMobileDevice = () => {
    try {
      const ua = navigator.userAgent || '';
      const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
      const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
      return !!(mobileUA || coarse);
    } catch { return false; }
  };

  /**
   * Ensure a deep merge for config, preserving persisted values and filling defaults.
   */
  const deepMerge = (base, patch) => {
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const k of Object.keys(patch)) {
      const v = patch[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = deepMerge(base[k] || {}, v);
      } else if (base[k] === undefined) {
        out[k] = v;
      } else {
        // keep existing persisted values by default
        out[k] = base[k];
      }
    }
    return out;
  };

  const SVG = {
    speed: '<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',
    seekFwd: '<svg viewBox="0 0 24 24"><path d="M18 6h-2v12h2zM4 6v12l8.5-6L4 6z"/></svg>',
    seekBack: '<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6l-8.5 6z"/></svg>',
    seekLeft: '<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm-2-6l6.5 4.5V7.5L9 12z"/></svg>',
    seekRight: '<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',
    vol: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
    bright: '<svg viewBox="0 0 24 24"><path d="M20 8.69V4h-4.69L12 0 8.69 4H4v4.69L0 12l4 3.31V20h4.69L12 24l3.31-4H20v-4.69L24 12l-4-3.31M12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>',
    fsEnter: '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
    fsExit: '<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',
    // New icons for play/pause feedback
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
    // New: checkmark in filled circle (negative check using evenodd so it cuts out of the fill)
    ready: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20z M10.9 16.3L6.6 12l1.4-1.4l2.9 2.9l6.1-6.1l1.4 1.4l-7.5 7.5z"/></svg>'
  };

  // ---------- Config Manager ----------
  const DEFAULTS = {
    MIN_VIDEO_DURATION_SECONDS: 60,
    DOUBLE_TAP_SEEK_SECONDS: 5,
    SWIPE_THRESHOLD: 20,
    SEEK_SENSITIVITY: 0.3,
    BRIGHTNESS_SENSITIVITY: 200,
    VOLUME_SENSITIVITY: 250,
    ENABLE_HAPTIC_FEEDBACK: true,
    HAPTIC_FEEDBACK_DURATION_MS: 20,
    FORCE_LANDSCAPE: true,
    DOUBLE_TAP_TIMEOUT_MS: 350,
    LONG_PRESS_DURATION_MS: 400,
    LONG_PRESS_SPEED: 2.0,
    // New: seeking UX tuning
    SEEK_VELOCITY_PX_PER_S_AT_MAX: 1800,   // px/s needed to reach max boost
    SEEK_VELOCITY_MAX_MULTIPLIER: 2.0,     // cap boost at 2x
    SEEK_MAX_SECONDS: 120,                  // clamp max seconds per gesture
    SHOW_SEEK_DELTA: true,
    // New: micro tick haptics
    SEEK_TICK_SECONDS: 5,
    // New: stronger threshold for fullscreen swipe
    FULLSCREEN_THRESHOLD_MULT: 1.4,
    // New: long-press movement tolerance (px)
    LONG_PRESS_SLOP_PX: 8,
    // New: persist brightness per-site
    PERSIST_BRIGHTNESS_PER_SITE: true
  };

  class ConfigManager {
    constructor() { this._config = { ...DEFAULTS }; }
    async load() {
      const saved = await GM_getValue('config', {});
      this._config = deepMerge(saved || {}, DEFAULTS);
      // Persist any new defaults merged in
      await GM_setValue('config', this._config);
      return this._config;
    }
    get raw() { return this._config; }
    async set(key, value) { this._config[key] = value; await GM_setValue('config', this._config); }
    registerMenus() {
      GM_registerMenuCommand('⏱️ Set Double-Tap Seek Time', () => {
        const cur = this._config.DOUBLE_TAP_SEEK_SECONDS;
        const v = prompt(`Enter seconds to seek on double-tap (1-60):\nCurrent: ${cur}s`, String(cur));
        if (v === null) return;
        const n = parseInt(v, 10);
        if (!Number.isNaN(n) && n >= 1 && n <= 60) {
          this.set('DOUBLE_TAP_SEEK_SECONDS', n);
          alert(`Double-tap seek time set to ${n} seconds.`);
        } else {
          alert(`Invalid input "${v}". Please enter a number between 1-60 seconds.`);
        }
      });
      GM_registerMenuCommand('⚡ Set Long-Press Speed', () => {
        const cur = this._config.LONG_PRESS_SPEED;
        const v = prompt(`Enter playback speed for long-press (0.25-16):\nCurrent: ${cur}x`, String(cur));
        if (v === null) return;
        const n = parseFloat(v);
        if (!Number.isNaN(n) && n >= 0.25 && n <= 16) {
          this.set('LONG_PRESS_SPEED', n);
          alert(`Long-press speed set to ${n}x.`);
        } else {
          alert(`Invalid input "${v}". Please enter a number between 0.25 and 16.`);
        }
      });
      // New: Config reset/export/import
      GM_registerMenuCommand('🔄 Reset Config to Defaults', () => {
        this._config = { ...DEFAULTS };
        GM_setValue('config', this._config);
        alert('Config reset to defaults.');
      });
      GM_registerMenuCommand('⬆️ Export Config (JSON)', () => {
        const json = JSON.stringify(this._config, null, 2);
        prompt('Copy config JSON:', json);
      });
      GM_registerMenuCommand('⬇️ Import Config (JSON)', () => {
        const txt = prompt('Paste config JSON to merge:');
        if (!txt) return;
        try {
          const obj = JSON.parse(txt);
          const merged = { ...this._config };
          Object.keys(DEFAULTS).forEach(k => {
            if (Object.prototype.hasOwnProperty.call(obj, k)) merged[k] = obj[k];
          });
          this._config = merged;
          GM_setValue('config', this._config);
          alert('Config imported.');
        } catch { alert('Invalid JSON.'); }
      });
    }
  }

  // ---------- Error Handling ----------
  class ErrorHandler {
    static handle(error, context = '') {
      console.warn(`[VideoGestures] Error in ${context}:`, error);
      App.instance?.resetGestureState();
    }
    static wrap(fn, context) {
      return function(...args) {
        try { return fn.apply(this, args); } catch (e) { ErrorHandler.handle(e, context); }
      };
    }
  }

  // ---------- Haptics ----------
  class Haptics {
    constructor(cfg) { this.cfg = cfg; }
    vibrate() {
      if (this.cfg.ENABLE_HAPTIC_FEEDBACK && navigator.vibrate) {
        navigator.vibrate(this.cfg.HAPTIC_FEEDBACK_DURATION_MS);
      }
    }
  }

  // ---------- UI Manager ----------
  class UIManager {
    constructor() {
      this.indicator = null;
      this.brightnessOverlay = null;
      this.siteToast = null; // new
      this._hideTimer = null;
      this._siteTimer = null; // new
      this._raf = null;
      this._ensureStyles();
      this._ensureElements();
    }
    _ensureStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');
        /* Share the glass style across both indicator and site toast */
        #${INDICATOR_ID}, #${SITE_TOAST_ID} {
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.94);
          padding: 12px 16px;
          background: rgba(18,18,18,0.35);
          border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(12px) saturate(140%);
          -webkit-backdrop-filter: blur(12px) saturate(140%);
          color: rgba(255,255,255,0.95);
          font-family: 'Roboto', sans-serif; font-size: 15px; font-weight: 500;
          border-radius: 16px;
          z-index: 2147483647; display: inline-flex; align-items: center; gap: 10px;
          opacity: 0; pointer-events: none; transition: opacity .18s ease, transform .18s ease;
          box-shadow: 0 8px 30px rgba(0,0,0,.45), inset 0 1px 1px rgba(255,255,255,.06);
          text-shadow: 0 1px 1px rgba(0,0,0,.4);
          user-select: none;
        }
        #${INDICATOR_ID}.visible, #${SITE_TOAST_ID}.visible { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        #${INDICATOR_ID} svg, #${SITE_TOAST_ID} svg { width: 24px; height: 24px; fill: rgba(255,255,255,0.95); filter: drop-shadow(0 1px 1px rgba(0,0,0,.35)); }
        #${INDICATOR_ID} span, #${SITE_TOAST_ID} span { font-size: 15px; line-height: 1; }

        #${BRIGHTNESS_ID} {
          position: fixed; inset: 0; background-color: #000; opacity: 0; pointer-events: none;
          z-index: 2147483646; transition: opacity .12s linear;
        }
        @media (prefers-reduced-motion: reduce) {
          #${INDICATOR_ID}, #${SITE_TOAST_ID} { transition: none !important; }
          #${BRIGHTNESS_ID} { transition: none !important; }
        }
      `;
      document.head.appendChild(style);
    }
    _ensureElements() {
      if (!document.getElementById(INDICATOR_ID)) {
        const el = document.createElement('div');
        el.id = INDICATOR_ID;
        document.body.appendChild(el);
        this.indicator = el;
      } else {
        this.indicator = document.getElementById(INDICATOR_ID);
      }
      if (!document.getElementById(BRIGHTNESS_ID)) {
        const el = document.createElement('div');
        el.id = BRIGHTNESS_ID;
        document.body.appendChild(el);
        this.brightnessOverlay = el;
      } else {
        this.brightnessOverlay = document.getElementById(BRIGHTNESS_ID);
      }
      // new: site toast element (always on body)
      if (!document.getElementById(SITE_TOAST_ID)) {
        const el = document.createElement('div');
        el.id = SITE_TOAST_ID;
        document.body.appendChild(el);
        this.siteToast = el;
      } else {
        this.siteToast = document.getElementById(SITE_TOAST_ID);
      }
    }
    attachToFullscreen() {
      const fs = document.fullscreenElement;
      if (fs && this.indicator?.parentElement !== fs) fs.appendChild(this.indicator);
      if (fs && this.brightnessOverlay?.parentElement !== fs) fs.appendChild(this.brightnessOverlay);
      if (!fs) {
        if (this.indicator?.parentElement !== document.body) document.body.appendChild(this.indicator);
        if (this.brightnessOverlay?.parentElement !== document.body) document.body.appendChild(this.brightnessOverlay);
      }
      // Note: siteToast always stays on body; do not move it.
    }
    show(html, sticky = false) {
      if (!this.indicator) return;
      const run = () => {
        if (!this.indicator) return;
        this.indicator.innerHTML = html;
        this.indicator.classList.add('visible');
        if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
        if (!sticky) {
          this._hideTimer = setTimeout(() => this.hide(), 800);
        }
      };
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(run);
    }
    hide() { if (this.indicator) this.indicator.classList.remove('visible'); }
    // new: site-level message that stays on body and never re-parents into fullscreen element
    showSiteMessage(html, durationMs = 1600) {
      if (!this.siteToast) return;
      try {
        if (this._siteTimer) { clearTimeout(this._siteTimer); this._siteTimer = null; }
        if (this.siteToast.parentElement !== document.body) document.body.appendChild(this.siteToast);
        this.siteToast.innerHTML = html;
        this.siteToast.classList.add('visible');
        this._siteTimer = setTimeout(() => {
          this.siteToast?.classList.remove('visible');
        }, Math.max(600, durationMs));
      } catch { /* noop */ }
    }
    setBrightness01(v) {
      const clamped = Math.max(0.1, Math.min(1, v));
      if (this.brightnessOverlay) this.brightnessOverlay.style.opacity = String(1 - clamped);
    }
    destroy() {
      try {
        if (this._hideTimer) clearTimeout(this._hideTimer);
        if (this._siteTimer) clearTimeout(this._siteTimer);
        if (this._raf) cancelAnimationFrame(this._raf);
        document.getElementById(STYLE_ID)?.remove();
        document.getElementById(INDICATOR_ID)?.remove();
        document.getElementById(BRIGHTNESS_ID)?.remove();
        document.getElementById(SITE_TOAST_ID)?.remove();
      } catch { /* noop */ }
      this.indicator = null; this.brightnessOverlay = null; this.siteToast = null; this._hideTimer = null; this._siteTimer = null; this._raf = null;
    }
  }

  // ---------- Video Finder ----------
  class VideoFinder {
    static find(targetEl, x, y) {
      let video = null;
      try {
        if (document.fullscreenElement) {
          video = document.fullscreenElement.querySelector('video');
        }
        if (!video && targetEl && typeof targetEl.closest === 'function') {
          video = targetEl.closest('video');
        }
        // Nearest from touch point fallback
        if (!video && Number.isFinite(x) && Number.isFinite(y) && document.elementFromPoint) {
          const el = document.elementFromPoint(x, y);
          if (el && el.closest) video = el.closest('video');
        }
        if (!video) {
          let largest = null, maxArea = 0;
          document.querySelectorAll('video').forEach(v => {
            try {
              if (!v || v.paused || v.readyState < 1) return;
              const r = v.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) {
                const area = r.width * r.height;
                if (area > maxArea) { maxArea = area; largest = v; }
              }
            } catch { /* skip */ }
          });
          video = largest;
        }
        if (!video) return null;
        let container = null;
        try {
          const sel = '.html5-video-player, .player, .video-js, [data-vjs-player], .jwplayer';
          container = video.closest(sel);
        } catch { /* noop */ }
        return { video, container: container || video.parentElement || document.body };
      } catch (e) {
        ErrorHandler.handle(e, 'video-discovery');
        return null;
      }
    }
  }

  // ---------- Gesture Controller ----------
  class GestureController {
    constructor(app) {
      this.app = app;
      this.active = null;
      this.lastTap = { time: 0, count: 0 };
      this.longPressTimer = null;
    }

    onTouchStart = (e) => {
      try {
        const t = e.touches[0];
        const res = VideoFinder.find(e.target, t?.clientX, t?.clientY);
        if (!res || !res.video || res.video.duration < this.app.cfg.MIN_VIDEO_DURATION_SECONDS || e.touches.length > 1) {
          this.active = null; return;
        }
        e.stopPropagation();
        this.active = {
          video: res.video,
          container: res.container,
          startX: t.clientX,
          startY: t.clientY,
          isSwipe: false,
          action: 'none',
          finalized: false,
          originalPlaybackRate: res.video.playbackRate,
          initialBrightness: 1 - parseFloat(this.app.ui.brightnessOverlay?.style.opacity || '0'),
          initialVolume: res.video.volume,
          initialTime: res.video.currentTime, // baseline time for continuous seek
          // velocity tracking
          prevX: t.clientX,
          prevT: performance.now(),
          maxSpeed: 0, // px/s
          // new helpers
          lastX: t.clientX,
          lastY: t.clientY,
          lastTickIndex: Math.floor((res.video.currentTime || 0) / Math.max(1, this.app.cfg.SEEK_TICK_SECONDS || 5)),
          liveWarned: false,
          seekK: (() => {
            const d = res.video.duration;
            if (!Number.isFinite(d)) return 1;
            if (d <= 600) return 0.6 + 0.4 * (d / 600); // 0.6..1.0 for <=10min
            if (d >= 3600) return 1.3; // slight boost for long videos
            return 1.0;
          })()
        };
        // double-tap timing
        const now = Date.now();
        if (now - this.lastTap.time < this.app.cfg.DOUBLE_TAP_TIMEOUT_MS) this.lastTap.count++; else this.lastTap.count = 1;
        this.lastTap.time = now;
        // long-press setup (only when fullscreen like reference behavior)
        if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
        if (document.fullscreenElement) {
          this.longPressTimer = setTimeout(() => {
            try { this.handleLongPress(); } catch (err) { ErrorHandler.handle(err, 'long-press'); }
          }, this.app.cfg.LONG_PRESS_DURATION_MS);
        }
      } catch (err) { ErrorHandler.handle(err, 'touchstart'); }
    };

    onTouchMove = (e) => {
      try {
        if (!this.active || e.touches.length > 1) return;
        e.stopPropagation();
        const t = e.touches[0];
        const dx = t.clientX - this.active.startX;
        const dy = t.clientY - this.active.startY;
        this.active.lastX = t.clientX; this.active.lastY = t.clientY;
        if (!this.active.isSwipe && Math.hypot(dx, dy) > this.app.cfg.SWIPE_THRESHOLD) {
          if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
          this.lastTap.count = 0; // cancel double-tap once swiping starts
          if (this.active.action === 'long-press-speed') {
            this.active.video.playbackRate = this.active.originalPlaybackRate;
            this.app.ui.hide();
          }
          this.active.isSwipe = true;
          if (document.fullscreenElement) {
            const rect = this.active.video.getBoundingClientRect();
            const zoneX = (this.active.startX - rect.left) / rect.width;
            const isVertical = Math.abs(dy) > Math.abs(dx);
            if (isVertical) {
              if (zoneX < 0.33) this.active.action = 'brightness';
              else if (zoneX > 0.66) this.active.action = 'volume';
              else this.active.action = 'fullscreen';
            } else {
              // seeking only if not live stream
              if (!Number.isFinite(this.active.video.duration)) {
                if (!this.active.liveWarned) { this.app.ui.show(`${SVG.play} Live`); this.active.liveWarned = true; }
                this.active.action = 'none';
              } else {
                this.active.action = 'seeking';
              }
            }
          }
        }
        if (this.active.isSwipe) {
          // update instantaneous speed (px/s) for velocity-aware seeking
          const nowMs = performance.now();
          const dt = Math.max(1, nowMs - (this.active.prevT || nowMs));
          const instSpeed = Math.abs(t.clientX - (this.active.prevX ?? t.clientX)) * 1000 / dt;
          this.active.maxSpeed = Math.max(this.active.maxSpeed || 0, instSpeed);
          this.active.prevX = t.clientX; this.active.prevT = nowMs;

          e.preventDefault();
          switch (this.active.action) {
            case 'seeking': this.handleHorizontal(dx); break;
            case 'volume': this.handleVertical(dy, 'volume'); break;
            case 'brightness': this.handleVertical(dy, 'brightness'); break;
            case 'fullscreen': /* handled on end with threshold */ break;
          }
        }
      } catch (err) { ErrorHandler.handle(err, 'touchmove'); }
    };

    onTouchEnd = (e) => {
      try {
        if (!this.active || this.active.finalized) return;
        if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
        e.stopPropagation();
        this.active.finalized = true;
        if (this.active.action === 'long-press-speed') {
          this.active.video.playbackRate = this.active.originalPlaybackRate;
          this.app.ui.hide();
        } else if (this.active.isSwipe) {
          if (this.active.action === 'seeking') {
            const t = e.changedTouches[0];
            const dx = t.clientX - this.active.startX;
            const seek = this.computeSeekSeconds(dx);
            const v = this.active.video;
            const target = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + seek));
            v.currentTime = target; // commit seek on release (velocity-aware)
            this.app.haptics.vibrate();
          } else if (this.active.action === 'volume') {
            this.app.haptics.vibrate();
          } else if (this.active.action === 'brightness') {
            this.app.haptics.vibrate();
            if (this.app.cfg.PERSIST_BRIGHTNESS_PER_SITE) {
              const val = (typeof this.active.currentBrightness === 'number') ? this.active.currentBrightness : this.active.initialBrightness;
              GM_setValue('brightness:' + location.host, val);
            }
          } else if (this.active.action === 'fullscreen') {
            const t = e.changedTouches[0];
            const dy = t.clientY - this.active.startY;
            const th = this.app.cfg.SWIPE_THRESHOLD * (this.app.cfg.FULLSCREEN_THRESHOLD_MULT || 1);
            if (Math.abs(dy) > th) this.app.toggleFullscreen(this.active);
          }
        } else {
          // Tap / Double-tap
          if (this.lastTap.count >= 2) {
            e.preventDefault();
            if (document.fullscreenElement) {
              this.handleDoubleTapSeek(this.active.video, this.active.startX);
            } else {
              this.app.toggleFullscreen(this.active);
            }
            this.lastTap = { time: 0, count: 0 };
          }
        }
        this.active = null;
      } catch (err) { ErrorHandler.handle(err, 'touchend'); this.active = null; }
    };

    onContextMenu = (e) => {
      if (this.active) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
    };

    handleLongPress() {
      if (!this.active || this.active.isSwipe) return;
      // safety slop: if finger moved too much, cancel long-press
      const moved = Math.hypot((this.active.lastX ?? this.active.startX) - this.active.startX, (this.active.lastY ?? this.active.startY) - this.active.startY);
      if (moved > (this.app.cfg.LONG_PRESS_SLOP_PX || 8)) return;
      this.active.action = 'long-press-speed';
      this.active.video.playbackRate = this.app.cfg.LONG_PRESS_SPEED;
      this.app.ui.show(`${SVG.speed} <span>${this.app.cfg.LONG_PRESS_SPEED.toFixed(2)}x Speed</span>`, true);
      this.app.haptics.vibrate();
    }

    handleHorizontal(dx) {
      if (!this.active) return;
      const { video } = this.active;
      if (!Number.isFinite(video?.duration)) {
        if (!this.active.liveWarned) { this.app.ui.show(`${SVG.play} Live`); this.active.liveWarned = true; }
        return;
      }
      let seek = this.computeSeekSeconds(dx);
      // rubber-banding near edges: reduce seek when close to edges
      const dur = video.duration;
      const initial = (this.active.initialTime ?? video.currentTime) || 0;
      const band = 12; // seconds of easing window near edges
      if (seek < 0 && initial <= band) {
        const t = Math.min(1, Math.max(0, initial) / band); // 0..1
        const f = t * t * t; // ease-out cubic
        seek *= f;
      } else if (seek > 0 && (dur - initial) <= band) {
        const t = Math.min(1, Math.max(0, dur - initial) / band);
        const f = t * t * t;
        seek *= f;
      }
      const target = Math.max(0, Math.min(dur || Infinity, initial + seek));
      // Apply seeking immediately during gesture for instant feedback
      try { video.currentTime = target; } catch { /* noop */ }
      const icon = seek >= 0 ? SVG.seekRight : SVG.seekLeft;
      // Simplified visual (no +/- seconds), just target time
      this.app.ui.show(`${icon} ${formatTime(target)}`);
      // micro haptic ticks every N seconds
      const step = Math.max(1, this.app.cfg.SEEK_TICK_SECONDS || 5);
      const idx = Math.floor(target / step);
      if (idx !== this.active.lastTickIndex) {
        this.active.lastTickIndex = idx;
        this.app.haptics.vibrate();
      }
    }

    // new: compute velocity-aware seek seconds with clamping
    computeSeekSeconds(dx) {
      const base = dx * this.app.cfg.SEEK_SENSITIVITY * (this.active?.seekK || 1);
      const maxBoost = Math.max(1, this.app.cfg.SEEK_VELOCITY_MAX_MULTIPLIER);
      const denom = Math.max(1, this.app.cfg.SEEK_VELOCITY_PX_PER_S_AT_MAX);
      const speed = Math.max(0, this.active?.maxSpeed || 0); // px/s
      const boost = 1 + Math.min(speed / denom, maxBoost - 1);
      let sec = base * boost;
      const cap = Math.max(1, this.app.cfg.SEEK_MAX_SECONDS);
      if (sec > cap) sec = cap; else if (sec < -cap) sec = -cap;
      return sec;
    }

    handleVertical(dy, type) {
      if (!this.active) return;
      if (type === 'volume') {
        const change = -dy / this.app.cfg.VOLUME_SENSITIVITY;
        let nv = this.active.initialVolume + change; nv = Math.max(0, Math.min(1, nv));
        this.active.video.volume = nv;
        const muted = this.active.video.muted || nv <= 0.001;
        this.app.ui.show(muted ? `${SVG.vol} Muted` : `${SVG.vol} ${Math.round(nv * 100)}%`);
      } else if (type === 'brightness') {
        const change = -dy / this.app.cfg.BRIGHTNESS_SENSITIVITY;
        let nb = this.active.initialBrightness + change; nb = Math.max(0.1, Math.min(1, nb));
        this.active.currentBrightness = nb;
        this.app.ui.setBrightness01(nb);
        this.app.ui.show(`${SVG.bright} ${Math.round(nb * 100)}%`);
      }
    }

    handleDoubleTapSeek(video, touchStartX) {
      const rect = video.getBoundingClientRect();
      const zone = (touchStartX - rect.left) / rect.width;
      if (zone < 0.4) {
        video.currentTime -= this.app.cfg.DOUBLE_TAP_SEEK_SECONDS;
        this.app.ui.show(`${SVG.seekBack} -${this.app.cfg.DOUBLE_TAP_SEEK_SECONDS}s`);
      } else if (zone > 0.6) {
        video.currentTime += this.app.cfg.DOUBLE_TAP_SEEK_SECONDS;
        this.app.ui.show(`+${this.app.cfg.DOUBLE_TAP_SEEK_SECONDS}s ${SVG.seekFwd}`);
      } else {
        if (video.paused) {
          const p = video.play?.();
          this.app.ui.show(`${SVG.play} Play`);
          // Ignore play promise rejections (autoplay policies)
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } else {
          video.pause?.();
          this.app.ui.show(`${SVG.pause} Pause`);
        }
      }
      this.app.haptics.vibrate();
    }
  }

  // ---------- App Wiring ----------
  class App {
    static instance = null;
    constructor(cfg) {
      this.cfg = cfg;
      this.ui = new UIManager();
      this.haptics = new Haptics(cfg);
      this.gestures = new GestureController(this);
      this._bound = false;
      this._readyObs = null; // new: mutation observer for ready toast
      this._shownReadyToast = false; // guard per page
      this._skipReadyToast = false; // persisted per host
    }
    bind() {
      if (this._bound) return; this._bound = true;
      document.addEventListener('touchstart', this.gestures.onTouchStart, { passive: false, capture: true });
      document.addEventListener('touchmove', this.gestures.onTouchMove, { passive: false, capture: true });
      document.addEventListener('touchend', this.gestures.onTouchEnd, { passive: false, capture: true });
      document.addEventListener('contextmenu', this.gestures.onContextMenu, { capture: true });
      document.addEventListener('fullscreenchange', this.onFullscreenChange, { passive: true });
      window.addEventListener('beforeunload', this.cleanup);
      window.addEventListener('pagehide', this.cleanup);
    }
    unbind() {
      if (!this._bound) return; this._bound = false;
      document.removeEventListener('touchstart', this.gestures.onTouchStart, true);
      document.removeEventListener('touchmove', this.gestures.onTouchMove, true);
      document.removeEventListener('touchend', this.gestures.onTouchEnd, true);
      document.removeEventListener('contextmenu', this.gestures.onContextMenu, true);
      document.removeEventListener('fullscreenchange', this.onFullscreenChange, true);
      window.removeEventListener('beforeunload', this.cleanup);
      window.removeEventListener('pagehide', this.cleanup);
    }
    onFullscreenChange = () => {
      this.ui.attachToFullscreen();
      if (!document.fullscreenElement) {
        try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
      }
    };
    // new: show a site-level toast once when an eligible video is detected
    initReadyToastWatcher() {
      if (this._shownReadyToast || this._skipReadyToast) return;
      const maybeShow = (v) => {
        if (this._shownReadyToast || this._skipReadyToast || !v) return;
        const dur = Number.isFinite(v.duration) ? v.duration : NaN;
        if (Number.isFinite(dur) && dur >= this.cfg.MIN_VIDEO_DURATION_SECONDS) {
          this._shownReadyToast = true;
          this._skipReadyToast = true;
          this.ui.showSiteMessage(`${SVG.ready} <span>Gestures Ready</span>`, 1200);
          GM_setValue('ready:' + location.host, true);
          // Once shown, disconnect observer to reduce overhead
          try { this._readyObs?.disconnect(); } catch { /* noop */ }
        }
      };
      const attach = (v) => {
        if (!v) return;
        const dur = Number.isFinite(v.duration) ? v.duration : NaN;
        if (Number.isFinite(dur) && dur >= this.cfg.MIN_VIDEO_DURATION_SECONDS) {
          maybeShow(v);
        } else {
          v.addEventListener('loadedmetadata', () => maybeShow(v), { once: true });
        }
      };
      document.querySelectorAll('video').forEach(attach);
      const obs = new MutationObserver((muts) => {
        if (this._shownReadyToast || this._skipReadyToast) return;
        for (const m of muts) {
          m.addedNodes?.forEach(node => {
            try {
              if (node.nodeName === 'VIDEO') attach(node);
              else if (node.querySelectorAll) node.querySelectorAll('video').forEach(attach);
            } catch { /* noop */ }
          });
        }
      });
      try {
        obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
      } catch { /* noop */ }
      this._readyObs = obs;
    }
    async prepareReadyToastGate() {
      try { this._skipReadyToast = !!(await GM_getValue('ready:' + location.host, false)); } catch { /* noop */ }
    }
    async restoreSiteBrightness() {
      if (!this.cfg.PERSIST_BRIGHTNESS_PER_SITE) return;
      try {
        const val = await GM_getValue('brightness:' + location.host, null);
        if (typeof val === 'number') this.ui.setBrightness01(val);
      } catch { /* noop */ }
    }
    resetGestureState() {
      if (this.gestures.longPressTimer) { clearTimeout(this.gestures.longPressTimer); this.gestures.longPressTimer = null; }
      this.gestures.active = null;
      this.gestures.lastTap = { time: 0, count: 0 };
    }
    toggleFullscreen(ctx /* {video, container} */) {
      const isFs = !!document.fullscreenElement;
      const icon = isFs ? SVG.fsExit : SVG.fsEnter;
      this.ui.show(icon);
      this.haptics.vibrate();
      if (isFs) {
        document.exitFullscreen?.();
      } else {
        const { container, video } = ctx || {};
        const req = (container || document.documentElement)?.requestFullscreen?.();
        if (this.cfg.FORCE_LANDSCAPE && video && video.videoWidth > video.videoHeight) {
          Promise.resolve(req).then(() => {
            try { screen.orientation?.lock?.('landscape').catch(()=>{}); } catch { /* noop */ }
          }).catch(()=>{});
        }
      }
    }
    cleanup = () => {
      try {
        this.resetGestureState();
        this.unbind();
        try { this._readyObs?.disconnect(); } catch { /* noop */ }
        this.ui.destroy();
      } catch (e) { console.warn('[VideoGestures] Cleanup warning:', e); }
    };
  }

  // ---------- Helpers ----------
  function formatTime(totalSeconds) {
    if (!Number.isFinite(totalSeconds)) return '00:00';
    const sec = Math.max(0, Math.floor(totalSeconds));
    const s = String(sec % 60).padStart(2, '0');
    const m = String(Math.floor(sec / 60) % 60).padStart(2, '0');
    const h = Math.floor(sec / 3600);
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  }

  // ---------- Bootstrap ----------
  const configMgr = new ConfigManager();
  const cfg = await configMgr.load();
  configMgr.registerMenus();

  const start = () => {
    if (!isMobileDevice()) return; // run only on mobile
    if (App.instance) return; // idempotent
    App.instance = new App(cfg);
    App.instance.ui.attachToFullscreen();
    App.instance.bind();
    // prep host-gated toast and site brightness (async, fire-and-forget)
    App.instance.prepareReadyToastGate();
    App.instance.restoreSiteBrightness();
    // After binding, watch for videos to show site-level ready message
    App.instance.initReadyToastWatcher();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
