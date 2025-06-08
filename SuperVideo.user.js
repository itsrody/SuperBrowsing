// ==UserScript==
// @name         Super Video
// @namespace    https://greasyfork.org/
// @version      2.0
// @description  Adds universal touch gestures for video elements: skip, speed, volume, progress, PiP
// @author       Murtaza Salih
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  // Gesture definitions: only video gestures (paths starting with 'V' and picture-in-picture)
  const gestureData = {
    gesture: {
      'V→': { name: 'Forward 10s', code: 'gestureData.videoPlayer.currentTime += 10; showTip("+10s");' },
      'V←': { name: 'Back 10s', code: 'gestureData.videoPlayer.currentTime -= 10; showTip("-10s");' },
      'V↑': { name: 'Increase Speed', code: 'if(document.fullscreen){ let s = gestureData.videoPlayer.playbackRate; s += s<1.5?0.25:0.5; gestureData.videoPlayer.playbackRate = s; showTip(`×${s}`); }' },
      'V↓': { name: 'Decrease Speed', code: 'if(document.fullscreen){ let s = gestureData.videoPlayer.playbackRate; s -= s>1.5?0.5: (s>0.25?0.25:0); gestureData.videoPlayer.playbackRate = s; showTip(`×${s}`); }' },
      'V→●': { name: 'Fast Play', code: 'gestureData.playSpeed = gestureData.videoPlayer.playbackRate; gestureData.videoPlayer.playbackRate = 10; showTip("×10");' },
      'V→○': { name: 'Stop Fast Play', code: 'gestureData.videoPlayer.playbackRate = gestureData.playSpeed; hideTip();' },
      'V←●': { name: 'Fast Rewind', code: 'gestureData.videoTimer = setInterval(()=>{ gestureData.videoPlayer.currentTime--; },100); showTip("-×10");' },
      'V←○': { name: 'Stop Rewind', code: 'clearInterval(gestureData.videoTimer); hideTip();' },
      'V↑▼': { name: 'Increase Volume', code: 'adjustVolume("up");' },
      'V↑▽': { name: 'End Increase Volume', code: 'stopAdjustVolume();' },
      'V↓▼': { name: 'Decrease Volume', code: 'adjustVolume("down");' },
      'V↓▽': { name: 'End Decrease Volume', code: 'stopAdjustVolume();' },
      'V→▼': { name: 'Progress Right', code: 'scrubProgress("right");' },
      'V→▽': { name: 'End Progress Right', code: 'stopScrub();' },
      'V←▼': { name: 'Progress Left', code: 'scrubProgress("left");' },
      'V←▽': { name: 'End Progress Left', code: 'stopScrub();' },
      '◆◆◆': { name: 'Picture-in-Picture', code: 'togglePiP();' }
    },

    settings: {
      'videoGestures': true
    }
  };

  // Internal state
  let startPoint = {}, path = '', fingers = 0;

  // Gesture execution utilities
  gestureData.run = code => { try { eval(code); } catch(e){ console.error('Gesture error', e); } };
  gestureData.runGesture = p => {
    const g = gestureData.gesture[p];
    if(!g) return;
    gestureData.run(g.code);
    path = '';
  };

  // Tip display
  const tipBox = document.createElement('div');
  tipBox.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);padding:10px;border-radius:8px;background:rgba(0,0,0,0.6);color:#fff;font-size:18px;visibility:hidden;z-index:9999;';
  document.body.appendChild(tipBox);
  function showTip(text) { tipBox.textContent = text; tipBox.style.visibility = 'visible'; setTimeout(()=>tipBox.style.visibility='hidden',500); }
  function hideTip() { tipBox.style.visibility = 'hidden'; }

  // Video detection
  function initVideo(v) {
    gestureData.videoPlayer = v;
    v.addEventListener('ctxmenu', e=>e.preventDefault());
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    document.querySelectorAll('video').forEach(initVideo);
    new MutationObserver(m=>{
      document.querySelectorAll('video:not([data-gest])').forEach(v=>{ v.dataset.gest=1; initVideo(v); });
    }).observe(document.body,{childList:true,subtree:true});
  });

  // Touch handling
  function onTouchStart(e) {
    if(!gestureData.settings.videoGestures) return;
    if(e.touches.length !== 1) return;
    fingers = 1;
    startPoint = e.touches[0];
    path = 'V';
  }
  function onTouchMove(e) {
    if(fingers!==1) return;
    const p = e.touches[0], dx = p.clientX - startPoint.clientX, dy = p.clientY - startPoint.clientY;
    const dir = Math.abs(dx)>Math.abs(dy)? (dx>0?'→':'←') : (dy>0?'↓':'↑');
    if(path.slice(-1)!==dir) path += dir;
    startPoint = p;
  }
  function onTouchEnd(e) {
    fingers = 0;
    if(path in gestureData.gesture) gestureData.runGesture(path);
  }

  window.addEventListener('touchstart', onTouchStart, {passive:true});
  window.addEventListener('touchmove', onTouchMove, {passive:true});
  window.addEventListener('touchend', onTouchEnd, {passive:true});

  // Volume adjust helpers
  let volTimer;
  function adjustVolume(dir) {
    if(!document.fullscreen) return;
    const v = gestureData.videoPlayer;
    v.muted = false;
    volTimer = setInterval(()=>{
      v.volume = Math.max(0, Math.min(1, v.volume + (dir==='up'?0.02:-0.02)));
      showTip((v.volume*100|0)+'%');
    },50);
  }
  function stopAdjustVolume() { clearInterval(volTimer); hideTip(); }

  // Scrub helpers
  let scrubTimer;
  function scrubProgress(dir) {
    const v = gestureData.videoPlayer;
    scrubTimer = setInterval(()=>{
      v.currentTime += (dir==='right'?1:-1);
      showTip(formatTime(v.currentTime));
    },100);
  }
  function stopScrub() { clearInterval(scrubTimer); hideTip(); }
  function formatTime(t){ const m = Math.floor(t/60), s = Math.floor(t%60); return `${m}:${s<10?'0':''}${s}`; }

  // Picture-in-Picture
  function togglePiP() {
    const v = gestureData.videoPlayer;
    if(document.pictureInPictureElement) document.exitPictureInPicture();
    else v.requestPictureInPicture();
  }

})();
