// ==UserScript==
// @name         SuperVideo
// @namespace    http://tampermonkey.net/
// @version      1.2
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

  // Load Hammer.js
  function loadScript(src, onload) {
    const s = document.createElement('script');
    s.src = src;
    s.onload = onload;
    document.head.appendChild(s);
  }

  // After Hammer and HLS have loaded, initialize
  loadScript('https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js', () => {
    loadScript('https://cdn.jsdelivr.net/npm/hls.js@latest', initGestures);
  });

  function initGestures() {
    document.querySelectorAll('video').forEach(video => {
      // Prevent native context menu
      video.addEventListener('contextmenu', e => e.preventDefault());

      // If HLS
      const src = video.currentSrc || video.src;
      if (src && src.endsWith('.m3u8') && window.Hls) {
        const hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
      }

      // Create overlay
      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        pointerEvents: 'none', fontFamily: 'system-ui',
        color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)',
        opacity: 0, transition: 'opacity 0.3s'
      });
      overlay.textContent = '';
      video.parentElement.style.position = 'relative';
      video.parentElement.appendChild(overlay);

      // Helper to show overlay text
      function showLabel(text) {
        overlay.textContent = text;
        overlay.style.opacity = 1;
        clearTimeout(overlay._hideTimeout);
        overlay._hideTimeout = setTimeout(() => {
          overlay.style.opacity = 0;
        }, 600);
      }

      // Disable default controls so our overlay can cover
      video.controls = false;

      // Setup Hammer
      const hm = new Hammer.Manager(video);
      hm.add(new Hammer.Swipe({ direction: Hammer.DIRECTION_ALL, threshold: 10 }));
      hm.add(new Hammer.Press({ time: 500 }));
      hm.add(new Hammer.Pan({ direction: Hammer.DIRECTION_HORIZONTAL | Hammer.DIRECTION_VERTICAL, threshold: 0 }));

      let panStartTime;
      hm.on('swipeleft swiperight swipeup swipedown press pressup panstart panmove doubletap', ev => {
        const { type, deltaX, deltaY } = ev;
        const w = video.clientWidth;
        switch(type) {
          case 'swipeleft':
            video.currentTime = Math.max(0, video.currentTime - 5);
            showLabel('⏮ –5 s');
            break;
          case 'swiperight':
            video.currentTime = Math.min(video.duration, video.currentTime + 5);
            showLabel('⏭ +5 s');
            break;
          case 'press':
            video.playbackRate = 2;
            showLabel('▶ 2×');
            break;
          case 'pressup':
            video.playbackRate = 1;
            showLabel('▶ 1×');
            break;
          case 'swipeup':
            video.volume = Math.min(1, video.volume + 0.1);
            showLabel(`🔊 ${Math.round(video.volume*100)}%`);
            break;
          case 'swipedown':
            video.volume = Math.max(0, video.volume - 0.1);
            showLabel(`🔉 ${Math.round(video.volume*100)}%`);
            break;
          case 'panstart':
            panStartTime = video.currentTime;
            break;
          case 'panmove':
            if (panStartTime != null) {
              const pct = deltaX / w;
              video.currentTime = Math.min(video.duration, Math.max(0, panStartTime + pct * video.duration));
              showLabel(`▶ ${Math.floor(video.currentTime)} / ${Math.floor(video.duration)} s`);
            }
            break;
          case 'doubletap':
            if (video.videoWidth > video.videoHeight) {
              if (!document.fullscreenElement) {
                video.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen();
              }
            }
            break;
        }
      });
    });
  }
})();
