// ==UserScript==
// @name		Mobile browser touch gestures
// @name:zh-CN	手机浏览器触摸手势
// @description	Your Browser Just Grew Fingers👆! Install👇 → Swipe☝️ → Enjoy😎 , no setup required. ✔️Extensive universal gestures library, ✔️Enhanced interactions for 📝text/🖼️images/🎥videos 💪. Want more😱? Build your own gesture library🎨. Psst... Hidden features await discovery😏! Top Picks: Lemur Browser | Edge | Yandex
// @description:zh-CN	为手机浏览器添加触摸手势，即装即用，无需配置😎。拥有超多通用手势满足你的需求，还设计有对📝文字、🖼️️图片、🎥视频交互的特殊手势💪。还想要更多😱？支持添加属于你的个性化手势，更有隐藏功能等待你的发现😏！推荐使用狐猴浏览器、Edge浏览器和Yandex浏览器。
// @version		10.1.0
// @author		L.Xavier
// @namespace	https://greasyfork.org/zh-CN/users/128493
// @match		*://*/*
// @license		MIT
// @grant		window.close
// @grant		GM_setValue
// @grant		GM_getValue
// @grant		GM_openInTab
// @grant		GM_setClipboard
// @run-at		document-start
// @downloadURL https://update.greasyfork.org/scripts/375806/%E6%89%8B%E6%9C%BA%E6%B5%8F%E8%A7%88%E5%99%A8%E8%A7%A6%E6%91%B8%E6%89%8B%E5%8A%BF.user.js
// @updateURL https://update.greasyfork.org/scripts/375806/%E6%89%8B%E6%9C%BA%E6%B5%8F%E8%A7%88%E5%99%A8%E8%A7%A6%E6%91%B8%E6%89%8B%E5%8A%BF.meta.js
// ==/UserScript==

// v10.1.0		2025-06-23 - 1. Fixed an issue where continuous clicks might trigger n+1 clicks due to misfires, which was inconsistent with expected behavior.
//                         2. Optimized the implementation of the anti-interruption feature.
//                         3. Optimized text selection in iframes, allowing text gestures to be triggered in the top frame.

/* Gesture Data Module */
const gestureData = {};

/**
 * Defines the available gestures, their names, and the JavaScript code to execute.
 * '↑', '↓', '←', '→' represent swipe directions.
 * '●' represents a long press.
 * '○' represents the release after a long press (used for stopping fast forward/rewind).
 * '▼' represents continuous swipe (e.g., for volume/progress adjustment).
 * '▽' represents the release after a continuous swipe.
 * '◆' represents a click.
 * 'T' prefix: Text gesture.
 * 'I' prefix: Image gesture.
 * 'V' prefix: Video gesture.
 * '/*ONLY TOP*/': Gesture code only executes in the top-level frame.
 * '/*WITH TOP*/': Gesture code executes in both the current frame and the top-level frame.
 */
gestureData.gesture = {
    '↑→↓←': { name: 'Open Settings', code: '/*ONLY TOP*/gestureData.openSet();' },
    '◆◆': { name: 'Video Fullscreen', code: 'gestureData.videoFullScreen();' },
    '●': { name: 'Gesture Passthrough', code: 'if(/^[TIV]/.test(gestureData.path)){gestureData.path=(gestureData.path.indexOf("I")) ? "" : "I";}if(gestureData.path!=="I" && gestureData.settings["Image Gestures"]){if(gestureData.touchEle.nodeName!=="IMG"){let imgs=[...document.querySelectorAll("[_imgShow_=\'1\']")];if(gestureData.shadowList){for(let Ti=0,len=gestureData.shadowList.length;Ti<len;++Ti){imgs.push(...gestureData.shadowList[Ti].querySelectorAll("[_imgShow_=\'1\']"));}}for(let Ti=0,len=imgs.length;Ti<len;++Ti){if(imgs[Ti].nodeName!=="IMG" && getComputedStyle(imgs[Ti]).backgroundImage==="none"){continue;}let imgRect=imgs[Ti].getBoundingClientRect();if(gestureData.touchStart.clientX>imgRect.x && gestureData.touchStart.clientX<(imgRect.x+imgRect.width) && gestureData.touchStart.clientY>imgRect.y && gestureData.touchStart.clientY<(imgRect.y+imgRect.height)){gestureData.touchEle=imgs[Ti];break;}}}if(gestureData.path || gestureData.selectWords || !(gestureData.touchEle.compareDocumentPosition(gestureData.videoPlayer) & Node.DOCUMENT_POSITION_FOLLOWING)){if(gestureData.touchEle.nodeName==="IMG"){gestureData.path="I";}else{let bgImg=getComputedStyle(gestureData.touchEle).backgroundImage;if(bgImg!=="none"){gestureData.touchEle.src=bgImg.split(\'"\')[1];gestureData.path="I";}}}}' },
    '→←': { name: 'Go Back', code: '/*ONLY TOP*/function pageBack(){if(gestureData.backTimer){history.go(-1);setTimeout(pageBack,20);}}gestureData.backTimer=setTimeout(()=>{gestureData.backTimer=0;window.close();},200);pageBack();' },
    '←→': { name: 'Go Forward', code: '/*ONLY TOP*/history.go(1);' },
    '↓↑': { name: 'Scroll to Top', code: '/*WITH TOP*/let boxNode=gestureData.touchEle.parentNode;while(boxNode.nodeName!=="#document"){boxNode.scrollIntoView(true);if(boxNode.scrollTop){boxNode.scrollTo(0,0);}boxNode=boxNode.parentNode;}' },
    '↑↓': { name: 'Scroll to Bottom', code: '/*WITH TOP*/let boxNode=gestureData.touchEle.parentNode;while(boxNode.nodeName!=="#document"){if(getComputedStyle(boxNode).overflowY!=="hidden"){boxNode.scrollTo(0,boxNode.scrollHeight+999999);}boxNode=boxNode.parentNode;}' },
    '←↓': { name: 'Refresh Page', code: '/*ONLY TOP*/document.documentElement.style.cssText="filter:grayscale(100%)";history.go(0);' },
    '←↑': { name: 'New Page', code: '/*ONLY TOP*/gestureData.GM_openInTab("//limestart.cn",false);' },
    '→↓': { name: 'Close Page', code: '/*ONLY TOP*/window.close();' },
    '→↑': { name: 'Restore Page', code: '/*ONLY TOP*/gestureData.GM_openInTab("chrome-native://recent-tabs",false);' },
    '↓↑●': { name: 'Open in New Tab', code: 'let linkNode=gestureData.touchEle;while(true){if(linkNode.href){gestureData.GM_openInTab(linkNode.href,false);break;}linkNode=linkNode.parentNode;if(linkNode.nodeName==="BODY"){gestureData.touchEle.click();break;}}' },
    '↑↓●': { name: 'Hide Element', code: 'let boxNode=gestureData.touchEle,area=boxNode.offsetWidth*boxNode.offsetHeight,area_p=boxNode.parentNode.offsetWidth*boxNode.parentNode.offsetHeight,area_s=screen.width*screen.height;while(boxNode.parentNode.nodeName!=="BODY" && area/area_p>0.2 && area_p/area_s<0.9){boxNode=boxNode.parentNode;area_p=boxNode.parentNode.offsetWidth*boxNode.parentNode.offsetHeight;}if(boxNode.nodeName!=="HTML"){boxNode.remove();}' },
    '↓→': { name: 'Duplicate Page', code: '/*ONLY TOP*/gestureData.GM_openInTab(location.href,false);' },
    '→←→': { name: 'Half Screen Mode', code: '/*ONLY TOP*/if(gestureData.halfScreen){setTimeout(()=>{gestureData.halfScreen.remove();halfClose.remove();gestureData.halfScreen=null;document.documentElement.scrollTop=gestureData.scrollTop;},500);gestureData.scrollTop=document.body.scrollTop;let halfClose=gestureData.addStyle("html{transform:translateY(0) !important;}");}else{gestureData.scrollTop=document.documentElement.scrollTop;gestureData.halfScreen=gestureData.addStyle("html,body{height:43vh !important;overflow-y:auto !important;}html{transform:translateY(50vh) !important;transition:0.5s !important;overflow:hidden !important;}");document.body.scrollTop=gestureData.scrollTop;}' },
    '→↓↑←': { name: 'Video Parse', code: '/*ONLY TOP*/gestureData.GM_openInTab(`https://jx.xmflv.com/?url=${location.href}`,false);' },
    '↑→↓': { name: 'Stop Timers', code: '/*WITH TOP*/let start=gestureData.maxID|0,script=document.createElement("script");gestureData.maxID=setTimeout(Date);script.textContent=`for(let Ti=${start};Ti<${gestureData.maxID+1000};++Ti){clearTimeout(Ti);clearInterval(Ti);}`;document.body.insertAdjacentElement("beforeend",script);alert("All existing web page timers have been stopped");' },
    'T→↑': { name: 'Baidu Translate', code: 'gestureData.GM_openInTab(`//fanyi.baidu.com/#auto/auto/${encodeURIComponent(gestureData.selectWords)}`,false);' },
    'T←↑': { name: 'Youdao Translate', code: 'gestureData.GM_openInTab(`//dict.youdao.com/w/eng/${encodeURIComponent(gestureData.selectWords)}`,false);' },
    'T◆◆': { name: 'Double Click Search', code: 'gestureData.GM_setClipboard(gestureData.selectWords);if(!/^((https?:)?\\/\\/)?([\\w\\-]+\\.)+\\w{2,4}(:\\d{1,5})?(\\/\\S*)?$/.test(gestureData.selectWords.trim())){gestureData.selectWords=`//bing.com/search?q=${encodeURIComponent(gestureData.selectWords)}&FORM=CHROMN`;}else if(!/^(https?:)?\\/\\//.test(gestureData.selectWords.trim())){gestureData.selectWords=`//${gestureData.selectWords.trim()}`;}gestureData.GM_openInTab(gestureData.selectWords.trim(),false);' },
    'I↓↑●': { name: 'Open Image', code: 'gestureData.GM_openInTab(gestureData.touchEle.src,false);' },
    'I→↑●': { name: 'Baidu Image Search', code: 'gestureData.GM_openInTab(`//graph.baidu.com/details?isfromtusoupc=1&tn=pc&carousel=0&promotion_name=pc_image_shituindex&extUiData%5bisLogoShow%5d=1&image=${gestureData.touchEle.src}`,false);' },
    'V→': { name: 'Forward 10s', code: 'gestureData.videoPlayer.currentTime+=10;gestureData.tipBox.textContent="+10s ";gestureData.tipBox.style.opacity="1";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(1)";setTimeout(()=>{gestureData.tipBox.style.opacity="0";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(0.9)";},500);' },
    'V←': { name: 'Rewind 10s', code: 'gestureData.videoPlayer.currentTime-=10;gestureData.tipBox.textContent="-10s ";gestureData.tipBox.style.opacity="1";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(1)";setTimeout(()=>{gestureData.tipBox.style.opacity="0";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(0.9)";},500);' },
    'V↑': { name: 'Increase Playback Speed', code: 'if(document.fullscreen){let playSpeed=gestureData.videoPlayer.playbackRate;playSpeed+=(playSpeed<1.5) ? 0.25 : 0.5;gestureData.tipBox.textContent=`×${playSpeed} ∞ `;gestureData.tipBox.style.opacity="1";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(1)";setTimeout(()=>{gestureData.tipBox.style.opacity="0";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(0.9)";},500)}' },
    'V↓': { name: 'Decrease Playback Speed', code: 'if(document.fullscreen){let playSpeed=gestureData.videoPlayer.playbackRate;playSpeed-=(playSpeed>1.5) ? 0.5 : (playSpeed>0.25 && 0.25);gestureData.tipBox.textContent=`×${playSpeed} ∞ `;gestureData.tipBox.style.opacity="1";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(1)";setTimeout(()=>{gestureData.tipBox.style.opacity="0";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(0.9)";},500)}' },
    'V→●': { name: 'Fast Forward Playback', code: 'gestureData.playSpeed=gestureData.videoPlayer.playbackRate;gestureData.videoPlayer.playbackRate=10;gestureData.tipBox.textContent="×10 ";gestureData.tipBox.style.opacity="1";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(1)";' },
    'V→○': { name: 'Stop Fast Forward', code: 'gestureData.videoPlayer.playbackRate=gestureData.playSpeed;gestureData.tipBox.style.opacity="0";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(0.9)";' },
    'V←●': { name: 'Fast Rewind Playback', code: 'gestureData.videoTimer=setInterval(()=>{--gestureData.videoPlayer.currentTime;},100);gestureData.tipBox.textContent="- ×10 ";gestureData.tipBox.style.opacity="1";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(1)";' },
    'V←○': { name: 'Stop Fast Rewind', code: 'clearInterval(gestureData.videoTimer);gestureData.tipBox.style.opacity="0";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(0.9)";' },
    'V↑▼': { name: 'Increase Volume', code: 'if(document.fullscreen){gestureData.videoPlayer.muted=false;gestureData.tipBox.textContent=(gestureData.videoPlayer.volume*100|0)+"%";gestureData.tipBox.style.opacity="1";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(1)";let lastY=gestureData.touchEnd.screenY;gestureData.videoTimer=setInterval(()=>{if(lastY-gestureData.touchEnd.screenY){let tempVolume=gestureData.videoPlayer.volume+(lastY-gestureData.touchEnd.screenY)/100;gestureData.videoPlayer.volume=+(tempVolume>1) || (+(tempVolume>0) && tempVolume);gestureData.tipBox.textContent=(gestureData.videoPlayer.volume*100|0)+"%";lastY=gestureData.touchEnd.screenY;}},50);}' },
    'V↑▽': { name: 'Stop Increasing Volume', code: 'clearInterval(gestureData.videoTimer);gestureData.tipBox.style.opacity="0";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(0.9)";' },
    'V↓▼': { name: 'Decrease Volume', code: 'if(document.fullscreen){gestureData.videoPlayer.muted=false;gestureData.tipBox.textContent=(gestureData.videoPlayer.volume*100|0)+"%";gestureData.tipBox.style.opacity="1";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(1)";let lastY=gestureData.touchEnd.screenY;gestureData.videoTimer=setInterval(()=>{if(lastY-gestureData.touchEnd.screenY){let tempVolume=gestureData.videoPlayer.volume+(lastY-gestureData.touchEnd.screenY)/100;gestureData.videoPlayer.volume=+(tempVolume>1) || (+(tempVolume>0) && tempVolume);gestureData.tipBox.textContent=(gestureData.videoPlayer.volume*100|0)+"%";lastY=gestureData.touchEnd.screenY;}},50);}' },
    'V↓▽': { name: 'Stop Decreasing Volume', code: 'clearInterval(gestureData.videoTimer);gestureData.tipBox.style.opacity="0";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(0.9)";' },
    'V→▼': { name: 'Right Swipe Progress', code: 'if(!gestureData.formatTime){gestureData.formatTime=function(time){let minu=time/60,sec=time%60;hour=minu/60;minu%=60;return `${hour|0}:${(minu<10) ? "0":""}${minu|0}:${(sec<10) ? "0" : ""}${sec|0}`;};gestureData.showTip=function(){gestureData.tipBox.innerHTML=`<div style="background:#e1780f;width:100%;height:3px;margin:0 1vw;"><div style="width:${gestureData.videoPlayer.currentTime/gestureData.videoPlayer.duration*100|0}%;background:#1e87f0;height:3px;"></div></div><div style="font-size:min(5vw,18px);">${gestureData.formatTime(gestureData.videoPlayer.currentTime)}<span style="color:#e1780f;">/${gestureData.formatTime(gestureData.videoPlayer.duration)}</span></div>`;}}gestureData.showTip();gestureData.tipBox.style.opacity="1";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(1)";let lastX=gestureData.touchEnd.screenX;gestureData.videoTimer=setInterval(()=>{let len=gestureData.touchEnd.screenX-lastX;if(len){gestureData.videoPlayer.currentTime+=len*(1+Math.abs(len)*gestureData.videoPlayer.duration/7200).toFixed(2);lastX=gestureData.touchEnd.screenX;}gestureData.showTip();},50);' },
    'V→▽': { name: 'Stop Right Swipe Progress', code: 'clearInterval(gestureData.videoTimer);gestureData.tipBox.style.opacity="0";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(0.9)";' },
    'V←▼': { name: 'Left Swipe Progress', code: 'if(!gestureData.formatTime){gestureData.formatTime=function(time){let minu=time/60,sec=time%60;hour=minu/60;minu%=60;return `${hour|0}:${(minu<10) ? "0":""}${minu|0}:${(sec<10) ? "0" : ""}${sec|0}`;};gestureData.showTip=function(){gestureData.tipBox.innerHTML=`<div style="background:#e1780f;width:100%;height:3px;margin:0 1vw;"><div style="width:${gestureData.videoPlayer.currentTime/gestureData.videoPlayer.duration*100|0}%;background:#1e87f0;height:3px;"></div></div><div style="font-size:min(5vw,18px);">${gestureData.formatTime(gestureData.videoPlayer.currentTime)}<span style="color:#e1780f;">/${gestureData.formatTime(gestureData.videoPlayer.duration)}</span></div>`;}}gestureData.showTip();gestureData.tipBox.style.opacity="1";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(1)";let lastX=gestureData.touchEnd.screenX;gestureData.videoTimer=setInterval(()=>{let len=gestureData.touchEnd.screenX-lastX;if(len){gestureData.videoPlayer.currentTime+=len*(1+Math.abs(len)*gestureData.videoPlayer.duration/7200).toFixed(2);lastX=gestureData.touchEnd.screenX;}gestureData.showTip();},50);' },
    'V←▽': { name: 'Stop Left Swipe Progress', code: 'clearInterval(gestureData.videoTimer);gestureData.tipBox.style.opacity="0";gestureData.tipBox.style.transform="translate(-50%, -50%) scale(0.9)";' },
    '◆◆◆': { name: 'Video Picture-in-Picture', code: 'if(document.pictureInPictureElement){let playState=document.pictureInPictureElement.paused;document.exitPictureInPicture().then(()=>{if(!playState){gestureData.videoPlayer.play();}}).catch(Date);}else{gestureData.videoPlayer?.requestPictureInPicture().then(()=>{gestureData.videoPlayer.play();}).catch(Date);}' }
};

/**
 * Defines script settings with their current value, min, max, and precision (for sliders).
 */
gestureData.settings = {
    'Slide Coefficient': [0.2, 0, 0.5, 2], // [current value, min value, max value, precision]
    'Text Gestures': true,
    'Image Gestures': true,
    'Video Gestures': true,
    'Word Translation': false,
    'Page Acceleration': false,
    'Video Download': false
};

// Grant GM methods to gestureData object for easier access and consistency
gestureData.GM_setValue = GM_setValue;
gestureData.GM_getValue = GM_getValue;
gestureData.GM_openInTab = GM_openInTab;
gestureData.GM_setClipboard = GM_setClipboard;

// Read stored data from GM storage, or use defaults if not found
gestureData.gesture = gestureData.GM_getValue('gesture', gestureData.gesture);
gestureData.settings = gestureData.GM_getValue('settings', gestureData.settings);

// Script Constants
const LIMIT = ((screen.width > screen.height ? screen.height : screen.width) * gestureData.settings['Slide Coefficient'][0]) ** 2,
    ATTACH_SHADOW = Element.prototype.attachShadow,
    CANVAS_2D_DRAWIMAGE = CanvasRenderingContext2D.prototype.drawImage,
    CHECK_M_OBSERVER = new MutationObserver(() => { if (!checkTimer) { checkTimer = setTimeout(loadCheck, 500); } }),
    IMG_I_OBSERVER = new IntersectionObserver((entries) => { for (let Ti = 0, len = entries.length; Ti < len; ++Ti) { if (entries[Ti].intersectionRatio) { entries[Ti].target.setAttribute('_imgShow_', '1'); } else { entries[Ti].target.setAttribute('_imgShow_', '0'); } } }, { threshold: [0, 0.5, 1] }),
    A_I_OBSERVER = new IntersectionObserver((entries) => {
        let link = null, nowTime = Date.now();
        for (let Ti = 0, len = entries.length; Ti < len; ++Ti) {
            link = entries[Ti].target;
            if (entries[Ti].intersectionRatio) {
                link.setAttribute('_linkShow_', '1');
                // Pre-fetch links that are visible and haven't been prefetched recently (5 minutes)
                if (nowTime > link._prefetch_) {
                    link._prefetch_ = nowTime + 300000; // Set next prefetch time
                    document.head.insertAdjacentHTML('beforeend', `<link rel="prefetch" href="${link.href.replace(/^https?:/, '')}"/>`);
                }
            } else {
                link.setAttribute('_linkShow_', '0');
            }
        }
    }, { rootMargin: '50%', threshold: [0, 0.5, 1] });

/* Gesture Function Module */
// Variables for tracking finger gestures
let startPoint = {}, // Stores the starting touch coordinates
    timeSpan = 0,    // Time difference between touchstart and last touchend
    pressTime = 0,   // Timestamp of the current touchstart
    raiseTime = 0,   // Timestamp of the last touchend
    slideTime = 0,   // Timestamp of the last touchmove
    slideStamp = 0,  // Timestamp for continuous slide check
    slideLimit = 0,  // Dynamic limit for slide detection
    fingersNum = 0,  // Number of active touches
    gestureTimer = 0,// Timer for long press and gesture execution
    isAllow = 0,     // Flag to allow gesture execution
    isClick = 0;     // Flag to detect if it's a click event

/**
 * Executes the provided JavaScript code within the script's context.
 * Handles potential 'unsafe-eval' errors by creating a temporary script element.
 * @param {string} code - The JavaScript code to execute.
 */
gestureData.runCode = (code) => {
    try {
        eval(code);
    } catch (error) {
        // If 'unsafe-eval' error occurs, use a workaround by injecting a script element
        if ((error + '').indexOf('unsafe-eval') > -1) {
            window.eval = (function () {
                // Pass necessary data to the external scope for the injected script
                this.gestureData = gestureData;
                this.close = window.close;

                let script = document.createElement('script');
                return (js) => {
                    script.remove(); // Remove previous script to prevent duplicates
                    script = document.createElement('script');
                    script.textContent = `try{${js}}catch(error){alert(\`“${gestureData.path}” Gesture execution script error：\\n${error} ！\`);}`;
                    document.body.insertAdjacentElement('beforeend', script);
                }
            })();
            eval(code); // Retry execution with the workaround
        } else {
            // For other errors, show an alert
            alert(`“${gestureData.path}” Gesture execution script error：\n${error} ！`);
        }
    }
};

/**
 * Determines where to run the gesture code (current frame or top frame).
 * Handles communication between iframes and the top frame.
 * @param {string} runPath - The path string representing the gesture.
 */
gestureData.runFrame = (runPath) => {
    let code = gestureData.gesture[runPath].code;
    // If the current frame is the top frame, or it's a text/image/video gesture (which are frame-specific)
    if (top === self || /^[TIV]/.test(runPath)) {
        gestureData.runCode(code);
    } else { // If in an iframe
        // If the code is not explicitly marked as 'ONLY TOP', execute in the current iframe
        if (code.indexOf('/*ONLY TOP*/') < 0) {
            gestureData.runCode(code);
        }
        // If the code is marked for 'ONLY TOP' or 'WITH TOP', send a message to the top frame
        if (/\/\*(ONLY|WITH) TOP\*\//.test(code)) {
            // For continuous gestures (ending with '●' or '▼'), set up a push mechanism
            if (/[●▼]$/.test(runPath)) {
                window._isPushing_ = () => {
                    let _gestureData = {};
                    _gestureData.touchEnd = copyTouch(gestureData.touchEnd);
                    top.postMessage({ 'type': 'pushTouch', 'gestureData': _gestureData }, '*');
                };
            }
            // Send gesture data to the top frame
            let _gestureData = {};
            _gestureData.touchStart = copyTouch(gestureData.touchStart);
            _gestureData.touchEnd = copyTouch(gestureData.touchEnd);
            top.postMessage({ 'type': 'runPath', 'runPath': gestureData.path, 'gestureData': _gestureData }, '*');
        }
    }
};

/**
 * Executes a gesture based on the current `gestureData.path`.
 * If a `newPath` is provided, it updates `gestureData.path` after execution.
 * Resets `raiseTime` to 0 after execution.
 * @param {string} [newPath] - An optional new path to set after execution.
 */
gestureData.runGesture = (newPath) => {
    if (gestureData.gesture[gestureData.path]) {
        gestureData.runFrame(gestureData.path);
        if (gestureData.gesture[newPath]) { gestureData.path = newPath; }
    } else if (gestureData.gesture[gestureData.path.slice(1)] && /^[TIV]/.test(gestureData.path)) {
        // Handle cases where the path might have a 'T', 'I', or 'V' prefix
        gestureData.runFrame(gestureData.path.slice(1));
        if (gestureData.gesture[newPath?.slice(1)]) { gestureData.path = newPath; }
    }
    raiseTime = 0; // Reset raiseTime after gesture execution
};

/**
 * Executes the long press action if allowed.
 * Sets `isAllow` and `isClick` to 0 to prevent further immediate actions.
 * Updates `gestureData.path` to include '●' (long press indicator).
 */
function longPress() {
    if (isAllow && !/[●○▽]$/.test(gestureData.path)) { // Check if allowed and not already a continuous gesture
        isAllow = isClick = 0;
        startPoint = gestureData.touchEnd; // Update startPoint for subsequent actions
        let newPath = gestureData.path + '○'; // Path for release after long press
        gestureData.path += '●'; // Add long press indicator to current path
        gestureData.runGesture(newPath); // Execute the long press gesture
    }
}

/**
 * Executes the continuous sliding action.
 * Resets `slideStamp` to 0.
 * Updates `gestureData.path` to include '▼' (continuous slide indicator).
 */
function slidingRun() {
    slideStamp = 0; // Reset slide stamp
    let newPath = gestureData.path + '▽'; // Path for release after continuous slide
    gestureData.path += '▼'; // Add continuous slide indicator to current path
    gestureData.runGesture(newPath); // Execute the continuous slide gesture
    gestureData.path = gestureData.path.replace('▼', ''); // Remove the continuous slide indicator
}

/**
 * Handles the touchstart event.
 * Initializes gesture tracking variables and determines initial gesture state.
 * @param {TouchEvent} e - The touch event object.
 */
function touchStart(e) {
    clearTimeout(gestureTimer); // Clear any existing gesture timer

    // If the number of fingers is the same as before, it means a new touch has started without all fingers lifting
    if (fingersNum === e.touches?.length) {
        window._isPushing_ = null; // Clear push flag for iframe communication
        if (/[○▽]$/.test(gestureData.path)) { gestureData.runGesture(); } // Execute release gesture if active
        gestureData.path = ''; // Reset gesture path
    }

    // Only proceed if exactly one finger is touching
    if ((fingersNum = e.touches?.length) !== 1) { return; }

    pressTime = Date.now(); // Record current press time
    timeSpan = pressTime - raiseTime; // Calculate time since last touch end

    // Calculate the squared distance from the last touch end point
    let lineLen = raiseTime && (e.changedTouches[0].screenX - gestureData.touchEnd.screenX) ** 2 + (e.changedTouches[0].screenY - gestureData.touchEnd.screenY) ** 2;

    // Check for "break touch" (discontinuity) or initial touch
    if (timeSpan > 50 || lineLen > LIMIT) {
        startPoint = e.changedTouches[0]; // Set new start point

        // If a significant time or distance has passed, reset gesture path and related flags
        if (timeSpan > 180 || lineLen > LIMIT * 4) {
            gestureData.path = '';
            slideLimit = LIMIT;
            gestureData.touchEle = e.target; // Store the element touched
            gestureData.touchEnd = gestureData.touchStart = startPoint; // Set initial touch coordinates

            // Get selected text for text gestures
            if (!gestureData.iframeSelect || window.getSelection() + '') {
                gestureData.selectWords = window.getSelection() + '';
            } else {
                gestureData.selectWords = gestureData.iframeSelect;
            }

            // Determine initial gesture type (Text, Video)
            if (gestureData.selectWords && gestureData.settings['Text Gestures']) {
                gestureData.path = 'T';
            } else if (document.contains(gestureData.videoPlayer) && gestureData.settings['Video Gestures']) {
                let videoRect = gestureData.findVideoBox()?.getBoundingClientRect() || new DOMRect();
                if (fullsState > 0 && gestureData.touchStart.clientY < (videoRect.y + videoRect.height / 8)) {
                    gestureData.path = '!'; // Special path for top part of fullscreen video
                } else if (gestureData.touchStart.clientX > videoRect.x && gestureData.touchStart.clientX < (videoRect.x + videoRect.width) && gestureData.touchStart.clientY > videoRect.y && gestureData.touchStart.clientY < (videoRect.y + videoRect.height)) {
                    gestureData.path = 'V'; // Video gesture
                }
            }
        } else if (isClick) {
            e.preventDefault(); // Prevent default click behavior if it's a potential double-click
        }
        slideTime = pressTime;
        isAllow = isClick = 1; // Allow gesture and mark as potential click
    } else if (isClick) {
        gestureData.path = gestureData.path.slice(0, -1); // Remove last gesture icon for continuous clicks
    }
    gestureTimer = setTimeout(longPress, 300 + slideTime - pressTime); // Start long press timer
}

/**
 * Handles the touchmove event.
 * Tracks finger movement and updates the gesture path.
 * @param {TouchEvent} e - The touch event object.
 */
function touchMove(e) {
    clearTimeout(gestureTimer); // Clear long press timer
    gestureData.touchEnd = e.changedTouches ? e.changedTouches[0] : e; // Update current touch coordinates

    if (window._isPushing_) { setTimeout(window._isPushing_); } // Push touch data for iframe communication

    // Ignore if a continuous gesture is active or multiple fingers are touching
    if (/[○▽]$/.test(gestureData.path) || fingersNum > 1) { return; }

    // Calculate squared distances for X and Y movement
    let xLen = (gestureData.touchEnd.screenX - startPoint.screenX) ** 2,
        yLen = (gestureData.touchEnd.screenY - startPoint.screenY) ** 2,
        // Determine primary direction (horizontal or vertical)
        direction = (xLen > yLen * 1.42) ? ((gestureData.touchEnd.screenX > startPoint.screenX) ? '→' : '←') : ((gestureData.touchEnd.screenY > startPoint.screenY) ? '↓' : '↑'),
        nowTime = Date.now(),
        pathLen = xLen + yLen, // Total squared distance of movement
        lastIcon = gestureData.path?.slice(-1); // Last icon in the gesture path

    // If significant movement detected
    if (pathLen > LIMIT / 100) {
        slideTime = nowTime; // Update slide time
        isClick = 0; // No longer a click

        // If the direction is the same as the last icon, or movement exceeds slide limit
        if (lastIcon === direction || pathLen > slideLimit) {
            // If direction changes and time is short, or it's a T/I/V/◆ gesture, add new direction
            if (lastIcon !== direction && (timeSpan < 50 || 'TIV◆'.indexOf(lastIcon) > -1)) {
                gestureData.path += direction;
                slideLimit *= (slideLimit < LIMIT / 2) || 0.64; // Adjust slide limit
                slideStamp = nowTime + 300; // Set stamp for continuous slide
                isAllow = 1; // Allow gesture
                timeSpan = 0; // Reset time span
            }
            startPoint = gestureData.touchEnd; // Update start point for next segment
            if (slideStamp && nowTime > slideStamp) { setTimeout(slidingRun); } // Trigger continuous slide if conditions met
        } else if (pathLen > slideLimit / 16) {
            slideStamp = isAllow = 0; // Reset continuous slide flags
        }
    } else if (pathLen > 4) {
        isClick = 0; // Small movement, not a click
    }
    gestureTimer = setTimeout(longPress, 300 + slideTime - nowTime); // Restart long press timer
}

/**
 * Handles the touchend event.
 * Finalizes gesture detection and triggers gesture execution.
 * @param {TouchEvent} e - The touch event object.
 */
function touchEnd(e) {
    clearTimeout(gestureTimer); // Clear any pending timers

    // Decrement finger count. If more fingers are still down, return.
    if (--fingersNum > 0) {
        if (!/[○▽]$/.test(gestureData.path)) { gestureData.path = '!'; } // Set special path if not a continuous gesture
        return;
    }

    window._isPushing_ = null; // Clear push flag for iframe communication
    gestureData.touchEnd = e.changedTouches[0]; // Get final touch coordinates
    raiseTime = Date.now(); // Record touch end time

    // If in an iframe, send a lock message to the top frame
    if (top !== self) { top.postMessage({ 'type': 'iframeLock' }, '*'); }

    // If a continuous gesture is active, execute it and return
    if (/[○▽]$/.test(gestureData.path)) { setTimeout(gestureData.runGesture); return; }

    // If it's a click, add '◆' to the path and prevent default selection behavior for text gestures
    if (isClick) {
        gestureData.path += '◆';
        if (!gestureData.path.indexOf('T')) {
            e.preventDefault();
            window.getSelection().empty(); // Clear text selection
        }
    }

    // If gesture is allowed, set a timer to run the gesture
    if (isAllow) { gestureTimer = setTimeout(gestureData.runGesture, 179); }
}

/* Video Function Module */
// Variables for video functionalities
let oriLock = 0,      // Orientation lock status (0: unlocked, 1: locked to landscape)
    resizeTimer = 0,  // Timer for resize events
    fullsState = 0,   // Fullscreen state (0: not fullscreen, 1: fullscreen, -1: iframe fullscreen)
    iframeEles = document.getElementsByTagName('iframe'), // All iframes on the page
    iframeLock = null; // Reference to the iframe that initiated fullscreen

/**
 * Sets the currently active video player and initializes related functions.
 * @param {HTMLVideoElement|Event} player - The video element or the event object from a video event.
 */
async function setVideo(player) {
    let newPlayer = player.target || player; // Get the video element from event or directly

    // If the current video player is valid and the new player is muted, ignore (prevents changing active player when muted)
    if (document.contains(gestureData.videoPlayer) && newPlayer.muted) { return; }

    gestureData.videoPlayer = newPlayer; // Set the new active video player
    videoOriLock(); // Apply video orientation lock if applicable
    gestureData.videoPlayer.insertAdjacentElement('afterend', gestureData.tipBox); // Move tip box next to video

    // If video download is enabled
    if (gestureData.settings['Video Download']) {
        await gestureData.findVideoBox()?.insertAdjacentElement('beforeend', gestureData.videoPlayer._downloadTip_);
        if (window._urlObjects_[gestureData.videoPlayer.src]) {
            // If URL object exists, it means the video is being captured
            gestureData.videoPlayer._downloadTip_.textContent = 'Capturing';
            gestureData.videoPlayer._downloadTip_.buffers = window._urlObjects_[gestureData.videoPlayer.src].sourceBuffers;
            window._urlObjects_[gestureData.videoPlayer.src]._downloadTip_ = gestureData.videoPlayer._downloadTip_;
            delete window._urlObjects_[gestureData.videoPlayer.src];
        } else if (gestureData.videoPlayer._downloadTip_.textContent === 'Not Loaded') {
            // If not capturing and not loaded, check if downloadable
            if (!gestureData.videoPlayer.src && gestureData.videoPlayer.children.length) { gestureData.videoPlayer.src = gestureData.videoPlayer.firstChild.src; }
            if (gestureData.videoPlayer.src.indexOf('blob:') > -1 && gestureData.videoPlayer.src) { gestureData.videoPlayer._downloadTip_.textContent = 'Downloadable'; }
        }
    }
}

/**
 * Locks the screen orientation to landscape if the video is wider than it is tall
 * and is in fullscreen mode. Unlocks otherwise.
 */
function videoOriLock() {
    // If video dimensions are not available or video is not in document, retry or reset lock
    if (!gestureData.videoPlayer.videoWidth) {
        if (!gestureData.videoPlayer.error && document.contains(gestureData.videoPlayer)) { setTimeout(videoOriLock, 100); }
        oriLock = 0;
        return;
    }
    // Set oriLock based on video aspect ratio (1 if wider, 0 if taller/square)
    oriLock = +(gestureData.videoPlayer.videoWidth > gestureData.videoPlayer.videoHeight);
    // If in fullscreen and video is wider, send message to top frame to lock orientation
    if (fullsState > 0 && oriLock) { top.postMessage({ 'type': 'GYRO' }, '*'); }
    else { screen.orientation.unlock(); } // Otherwise, unlock orientation
}

/**
 * Overrides CanvasRenderingContext2D.prototype.drawImage to handle videos drawn onto canvas.
 * If a video is drawn onto a canvas and is not in the document, it's moved next to the canvas.
 */
CanvasRenderingContext2D.prototype.drawImage = function () {
    let ele = arguments[0];
    if (ele.nodeName === 'VIDEO' && !document.contains(ele)) {
        ele.style.display = 'none'; // Hide the original video element
        this.canvas.insertAdjacentElement('afterend', ele); // Move it after the canvas
    }
    return CANVAS_2D_DRAWIMAGE.call(this, ...arguments); // Call the original drawImage method
};

/**
 * Toggles fullscreen mode for the video player.
 * If already in fullscreen, exits fullscreen. Otherwise, requests fullscreen for the video box.
 */
gestureData.videoFullScreen = async () => {
    if (resizeTimer) { return; } // Prevent multiple fullscreen calls during resize

    if (document.fullscreen) {
        await document.exitFullscreen()?.catch(Date); // Exit fullscreen if active
    } else if (gestureData.videoPlayer) {
        await gestureData.findVideoBox()?.requestFullscreen()?.catch(Date); // Request fullscreen for video box
    } else if (iframeLock) {
        iframeLock.postMessage({ 'type': 'fullscreen' }, '*'); // If in iframe, send fullscreen message to it
    }
};

/**
 * Finds the appropriate HTML element that should be used for fullscreen for a given video player.
 * This function tries to find a parent container that best represents the video's bounding box.
 * @param {HTMLVideoElement} [player=gestureData.videoPlayer] - The video element to find the box for.
 * @returns {HTMLElement|null} The video's container element suitable for fullscreen, or null if not found.
 */
gestureData.findVideoBox = (player = gestureData.videoPlayer) => {
    if (!document.contains(player)) { return null; } // If player is not in document, return null

    // If a cached video box exists and is valid (contains player and fullscreen state matches)
    if (player._videoBox_?.contains(player) && (document.fullscreen || player._checkHeight_ === player.clientHeight)) { return player._videoBox_; }

    let parentEle = player.parentNode,
        childStyle = getComputedStyle(player),
        parentStyle = getComputedStyle(parentEle),
        childWidth = 0, childHeight = 0, parentWidth = 0, parentHeight = 0,
        cssText = '';

    player.setAttribute('_videobox_', ''); // Mark the player itself
    player._checkHeight_ = player.clientHeight; // Store initial client height for checks
    player._videoBox_ = parentEle; // Initialize video box to immediate parent

    // Calculate effective dimensions of player and parent, considering margins/positions
    if (player.offsetParent === player.parentNode || !player.offsetParent) {
        childWidth = Math.round(player.offsetWidth + (+childStyle.marginLeft.slice(0, -2)) + (+childStyle.marginRight.slice(0, -2)));
        childHeight = Math.round(player.offsetHeight + (+childStyle.marginTop.slice(0, -2)) + (+childStyle.marginBottom.slice(0, -2)));
        parentWidth = Math.round(parentEle.offsetWidth + (+parentStyle.marginLeft.slice(0, -2)) + (+parentStyle.marginRight.slice(0, -2)));
        parentHeight = Math.round(parentEle.offsetHeight + (+parentStyle.marginTop.slice(0, -2)) + (+parentStyle.marginBottom.slice(0, -2)));
    } else {
        childWidth = Math.round(player.offsetWidth + (+childStyle.left.slice(0, -2) || 0) + (+childStyle.marginLeft.slice(0, -2)) + (+childStyle.marginRight.slice(0, -2)) + (+childStyle.right.slice(0, -2) || 0));
        childHeight = Math.round(player.offsetHeight + (+childStyle.top.slice(0, -2) || 0) + (+childStyle.marginTop.slice(0, -2)) + (+childStyle.marginBottom.slice(0, -2)) + (+childStyle.bottom.slice(0, -2) || 0));
        parentWidth = Math.round(parentEle.offsetWidth + (+parentStyle.left.slice(0, -2) || 0) + (+parentStyle.marginLeft.slice(0, -2)) + (+parentStyle.marginRight.slice(0, -2)) + (+parentStyle.right.slice(0, -2) || 0));
        parentHeight = Math.round(parentEle.offsetHeight + (+parentStyle.top.slice(0, -2) || 0) + (+parentStyle.marginTop.slice(0, -2)) + (+parentStyle.marginBottom.slice(0, -2)) + (+parentStyle.bottom.slice(0, -2) || 0));
    }

    childWidth = (childWidth > parentWidth) ? childWidth : parentWidth;
    childHeight = (childHeight > parentHeight) ? childHeight : parentHeight;

    // Traverse up the DOM tree to find the best video container
    while ((childWidth >= parentEle.clientWidth || player.clientWidth * 1.08 > parentEle.clientWidth) && (childWidth < 1.15 * parentEle.clientWidth || !parentEle.clientWidth) && (childHeight < 1.15 * parentEle.clientHeight || !parentEle.clientHeight) && parentEle.nodeName !== 'BODY') {
        if (childHeight < parentEle.clientHeight && player.clientHeight * 1.08 < parentEle.clientHeight) {
            let isBreak = 1;
            for (let childEle of parentEle.children) {
                childStyle = getComputedStyle(childEle);
                childHeight = Math.round(childEle.offsetHeight + (+childStyle.top.slice(0, -2) || 0) + (+childStyle.marginTop.slice(0, -2)) + (+childStyle.marginBottom.slice(0, -2)) + (+childStyle.bottom.slice(0, -2) || 0));
                if (childHeight >= parentEle.clientHeight && player.clientHeight * 1.15 > parentEle.clientHeight) { isBreak = 0; break; }
            }
            if (isBreak) { break; }
        }
        if (parentEle.clientHeight) {
            player._videoBox_ = parentEle; // Update video box candidate
            parentEle.setAttribute('_videobox_', ''); // Mark the element

            // Store original CSS if it contains '!important' rules
            cssText = parentEle.style.cssText;
            if (/\s*!\s*important/.test(cssText)) {
                parentEle._cssText_ = cssText;
                parentEle._fullscreenCSS_ = cssText.replace(/\s*!\s*important/g, '');
                parentEle.setAttribute('_videobox_', '!important');
            }

            parentStyle = getComputedStyle(parentEle);
            if (parentEle.offsetParent === parentEle.parentNode || !parentEle.offsetParent) {
                parentWidth = Math.round(parentEle.offsetWidth + (+parentStyle.marginLeft.slice(0, -2)) + (+parentStyle.marginRight.slice(0, -2)));
                parentHeight = Math.round(parentEle.offsetHeight + (+parentStyle.marginTop.slice(0, -2)) + (+parentStyle.marginBottom.slice(0, -2)));
            } else {
                parentWidth = Math.round(parentEle.offsetWidth + (+parentStyle.left.slice(0, -2) || 0) + (+parentStyle.marginLeft.slice(0, -2)) + (+parentStyle.marginRight.slice(0, -2)) + (+parentStyle.right.slice(0, -2) || 0));
                parentHeight = Math.round(parentEle.offsetHeight + (+parentStyle.top.slice(0, -2) || 0) + (+parentStyle.marginTop.slice(0, -2)) + (+parentStyle.marginBottom.slice(0, -2)) + (+parentStyle.bottom.slice(0, -2) || 0));
            }
            childWidth = (childWidth > parentWidth) ? childWidth : parentWidth;
            childHeight = (childHeight > parentHeight) ? childHeight : parentHeight;
        }
        parentEle = parentEle.parentNode; // Move to the next parent
    }
    player._videoBox_.setAttribute('_videobox_', `${player._videoBox_.getAttribute('_videobox_') || ''} outer`.trim());
    return player._videoBox_;
};

/**
 * Registers a resize event listener to handle fullscreen transitions.
 * Applies specific CSS rules for fullscreen video.
 */
function regRESIZE() {
    let videoCss = gestureData.addStyle(''), // Create a dynamic style element
        allowResize = () => { resizeTimer = 0; }, // Function to reset resize timer
        findImportant = null; // To store elements with '!important' styles

    window.addEventListener('resize', () => {
        // When entering fullscreen
        if (document.fullscreen && !fullsState) {
            resizeTimer = setTimeout(allowResize, 400); // Set timer to prevent rapid resizing issues
            fullsState = document.fullscreenElement; // Get the element that is in fullscreen
            if (fullsState.nodeName === 'IFRAME') { fullsState = -1; return; } // If iframe is fullscreen, mark and return

            let srcFindVideo = fullsState.getElementsByTagName('video'),
                srcVideo = (fullsState.nodeName === 'VIDEO') ? fullsState : srcFindVideo[0];

            // If the fullscreen element is not a video box or video is not the primary content
            if (!fullsState.hasAttribute('_videobox_') && (!srcVideo || srcFindVideo.length > 1 || srcVideo._videoBox_.offsetWidth * srcVideo._videoBox_.offsetHeight * 1.2 < fullsState.offsetWidth * fullsState.offsetHeight)) {
                fullsState = -1; // Mark as invalid fullscreen
                return;
            }

            // If a different video is now fullscreen, pause the old one and set the new one
            if (srcVideo !== gestureData.videoPlayer) { gestureData.videoPlayer?.pause(); setVideo(srcVideo); }

            // Find elements that had '!important' styles and store them
            findImportant = fullsState.parentNode.querySelectorAll('*[_videobox_*="!important"]');
            fullsState = 1; // Mark as valid fullscreen
            if (oriLock) { top.postMessage({ 'type': 'GYRO' }, '*'); } // Request orientation lock if video is wide

            // Apply fullscreen CSS rules
            videoCss.textContent = '*[_videobox_]{inset:0 !important;margin:0 !important;padding:0 !important;width:100% !important;height:100% !important;max-width:100% !important;max-height:100% !important;}video{position:absolute;transform:none !important;object-fit:contain !important;}';
            findImportant.forEach((ele) => { ele.style.cssText = ele._fullscreenCSS_; }); // Restore original styles
        } else if (fullsState && !document.fullscreen) {
            // When exiting fullscreen
            resizeTimer = setTimeout(allowResize, 400); // Set timer
            fullsState = 0; // Reset fullscreen state
            videoCss.textContent = ''; // Clear fullscreen CSS
            findImportant.forEach((ele) => { ele.style.cssText = ele._cssText_; }); // Restore original styles
        }
    }, true);
}

/* Video Download Module */
if (gestureData.settings['Video Download']) {
    // Store original methods to override
    const CREATE_OBJ_URL = URL.createObjectURL,
        ADD_SOURCE_BUFFER = MediaSource.prototype.addSourceBuffer,
        APPEND_BUFFER = SourceBuffer.prototype.appendBuffer,
        END_OF_STREAM = MediaSource.prototype.endOfStream;

    /**
     * Initializes the video download functionality for a given player.
     * Creates and attaches a download tip element to the video.
     * @param {HTMLVideoElement} player - The video element to initialize download for.
     */
    window._initDownload_ = (player) => {
        player._downloadTip_ = document.createElement('div');
        player._downloadTip_.style.cssText = 'position:absolute;right:0;top:20px;background:#3498db;border-radius:20px 0 0 20px;text-align:center;padding:20px;line-height:0px;color:#fff;min-width:60px;font-size:16px;font-family:system-ui;z-index:2147483647;';
        player._downloadTip_.target = player;
        player._downloadTip_.textContent = 'Not Loaded'; // Initial state

        // Check if the video URL is already being captured
        if (window._urlObjects_[player.src]) {
            player._downloadTip_.textContent = 'Capturing';
            player._downloadTip_.buffers = window._urlObjects_[player.src].sourceBuffers;
            window._urlObjects_[player.src]._downloadTip_ = player._downloadTip_;
            delete window._urlObjects_[player.src]; // Remove from _urlObjects_ after assignment
        } else {
            // If no src, try to get it from first child (e.g., <source> tags)
            if (!player.src && player.children.length) { player.src = player.firstChild.src; }
            // If it's a blob URL, it's likely downloadable
            if (player.src.indexOf('blob:') > -1 && player.src) { player._downloadTip_.textContent = 'Downloadable'; }
        }
        player._downloadTip_.addEventListener('click', window._downloadVideo_, true); // Add click listener for download
        player._videoBox_.insertAdjacentElement('beforeend', player._downloadTip_); // Append to video container
    };

    /**
     * Initiates the video download process.
     * Handles downloading from blob URLs or captured media segments.
     * @param {Event|Object} data - The event object or a data object containing buffers and src.
     */
    window._downloadVideo_ = function (data) {
        if (this.textContent === 'Not Loaded') { return; } // Do nothing if not loaded

        if (data.target) { data = this; data.src = this.target.src; } // Adjust data if from event

        let buffers = data.buffers;
        // If in an iframe, send download request to the top frame
        if (top !== self) {
            let _buffers = [];
            for (let Ti = 0, len = buffers.length; Ti < len; ++Ti) {
                _buffers.push({ 'mime': buffers[Ti]._mime_, 'bufferList': buffers[Ti]._bufferList_ });
            }
            top.postMessage({ 'type': 'download', 'buffers': _buffers, 'src': data.src }, '*');
            return;
        }

        let a = document.createElement('a');
        a.download = document.title; // Set download filename to page title
        a.style.display = 'none';
        document.body.insertAdjacentElement('beforeend', a);

        // If it's a blob URL, directly download
        if (data.src.indexOf('blob:') > -1 && data.src) {
            a.href = data.src;
            a.click();
        } else if (buffers.length) {
            // If media segments are captured, create blobs and download each
            for (let Ti = 0, len = buffers.length; Ti < len; ++Ti) {
                a.href = URL.createObjectURL(new Blob(buffers[Ti]._bufferList_, { 'type': buffers[Ti]._mime_ }));
                a.click();
                URL.revokeObjectURL(a.href); // Revoke URL to free memory
            }
        }
        a.remove(); // Remove the temporary anchor element
    };

    // Store MediaSource objects by URL to link them to download tips
    window._urlObjects_ = {};

    /**
     * Overrides URL.createObjectURL to capture MediaSource objects.
     * @param {MediaSource|Blob|File} obj - The object to create a URL for.
     * @returns {string} The created object URL.
     */
    URL.createObjectURL = (obj) => {
        let url = CREATE_OBJ_URL(obj);
        if (obj.sourceBuffers) { window._urlObjects_[url] = obj; } // If it's a MediaSource, store it
        return url;
    };

    /**
     * Overrides MediaSource.prototype.addSourceBuffer to add custom properties for tracking.
     * @param {string} mime - The MIME type of the source buffer.
     * @returns {SourceBuffer} The created SourceBuffer.
     */
    MediaSource.prototype.addSourceBuffer = function (mime) {
        let sourceBuffer = ADD_SOURCE_BUFFER.call(this, mime);
        sourceBuffer._bufferList_ = []; // Store appended buffers
        sourceBuffer._mime_ = mime; // Store MIME type
        sourceBuffer._mediaSource_ = this; // Reference to the parent MediaSource
        return sourceBuffer;
    };

    /**
     * Overrides SourceBuffer.prototype.appendBuffer to capture video segments.
     * Updates the download tip with the number of captured segments.
     * @param {ArrayBufferView} buffer - The buffer to append.
     */
    SourceBuffer.prototype.appendBuffer = function (buffer) {
        this._bufferList_.push(buffer); // Add buffer to list
        if (this._mime_.indexOf('video') > -1 && this._mediaSource_._downloadTip_) {
            this._mediaSource_._downloadTip_.textContent = `Captured ${this._bufferList_.length} segments`;
        }
        APPEND_BUFFER.call(this, buffer); // Call original appendBuffer
    };

    /**
     * Overrides MediaSource.prototype.endOfStream to update download tip when stream ends.
     */
    MediaSource.prototype.endOfStream = function () {
        if (this._downloadTip_) { this._downloadTip_.textContent = 'Downloadable'; }
        END_OF_STREAM.call(this); // Call original endOfStream
    };
}

/* Word Translation Module */
if (gestureData.settings['Word Translation']) {
    // Variables for word translation
    let selectTimer = 0,    // Timer for selection change
        translateBox = null; // HTML element for displaying translation

    /**
     * Detects the language of the given text.
     * Currently supports Chinese, Japanese, Korean, Cyrillic, Arabic, and defaults to English.
     * @param {string} text - The text to detect language for.
     * @returns {string} The language code (e.g., 'zh-CN', 'en').
     */
    function detectLanguage(text) {
        // Chinese detection (including extended Chinese characters)
        let chineseRegex = /[\u4E00-\u9FFF\u3400-\u4DBF\u{20000}-\u{2EBEF}]/u;
        if (chineseRegex.test(text)) return 'zh-CN';
        // Common language character detection
        let japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/,
            koreanRegex = /[\uAC00-\uD7AF]/,
            cyrillicRegex = /[\u0400-\u04FF]/,
            arabicRegex = /[\u0600-\u06FF]/;
        if (japaneseRegex.test(text)) return 'ja'; // Japanese
        if (koreanRegex.test(text)) return 'ko'; // Korean
        if (cyrillicRegex.test(text)) return 'ru'; // Russian
        if (arabicRegex.test(text)) return 'ar'; // Arabic
        // Default to English (for Latin alphabet)
        return 'en';
    }

    /**
     * Translates the given text using an external translation API.
     * @param {string} text - The text to translate.
     * @returns {Promise<string>} A promise that resolves with the translated text or an error message.
     */
    function translateText(text) {
        let sourceLang = detectLanguage(text),
            targetLang = sourceLang === 'zh-CN' ? 'en' : 'zh-CN'; // Translate Chinese to English, and others to Chinese
        return fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`)
            .then(response => {
                if (!response.ok) { throw new Error('Network request failed!'); }
                return response.json();
            }).then(result => {
                return result.responseStatus === 200 ? result.responseData.translatedText : 'Oops X﹏X, translation failed!';
            }).catch(() => {
                return 'Oops X﹏X, translation failed!';
            });
    }

    /**
     * Handles text selection changes, triggers translation, and displays the result.
     */
    function handleSelection() {
        clearTimeout(selectTimer); // Clear previous selection timer

        // Create translation box if it doesn't exist
        if (!translateBox) {
            translateBox = document.createElement('div');
            // Updated styling for the translation box
            translateBox.style.cssText = 'position:fixed;transform:translateX(-25%);max-width:80%;padding:15px 25px;background-color:rgba(30, 30, 30, 0.9);border-radius:20px;font-size:16px;font-family:"Roboto", sans-serif;color:#fff;z-index:2147483647;box-shadow: 0 4px 12px rgba(0,0,0,0.3);display:none;align-items:center;';
            document.body.insertAdjacentElement('beforeend', translateBox);
            // Add click listener to copy translation to clipboard
            translateBox.addEventListener('touchstart', function () { gestureData.GM_setClipboard(this.textContent); alert('Translation copied successfully!'); }, true);
        }

        let selection = window.getSelection().toString().trim(); // Get current text selection

        if (!selection) {
            translateBox.style.display = 'none'; // Hide if no selection
            return;
        }

        // Set a timeout to translate after a short delay (to allow full selection)
        selectTimer = setTimeout(async () => {
            if (!window.getSelection().toString().trim()) {
                translateBox.style.display = 'none'; // Hide if selection is gone
                return;
            } else if (selection !== window.getSelection().toString().trim()) {
                setTimeout(handleSelection); // If selection changed, re-evaluate
                return;
            }

            translateBox.textContent = await translateText(selection); // Translate and set text
            if (!window.getSelection().toString().trim()) {
                translateBox.style.display = 'none'; // Hide if selection is gone after translation
                return;
            }

            // Position the translation box near the touch point
            translateBox.style.left = gestureData.touchEnd.clientX + 'px';
            translateBox.style.top = Math.min(gestureData.touchEnd.clientY + screen.width * .05, window.innerHeight - screen.width * .2) + 'px';

            // Adjust horizontal position if near screen edges
            if (gestureData.touchEnd.clientX < screen.width * .2) {
                translateBox.style.transform = 'translateX(-10%)';
            } else if (gestureData.touchEnd.clientX > window.innerWidth - screen.width * .2) {
                translateBox.style.left = gestureData.touchEnd.clientX - screen.width * .2 + 'px';
                translateBox.style.transform = 'none';
            } else {
                translateBox.style.transform = 'translateX(-25%)';
            }
            translateBox.style.display = 'flex'; // Show the translation box
        }, 1000);
    }
    // Register selectionchange event listener
    window.addEventListener('selectionchange', handleSelection, true);
}

/* Supplementary Function Module */
// Variables for supplementary functions
let videoEles = [], // Video elements
    imgEles = [],   // Image elements
    linkEles = [],  // Link elements
    checkTimer = 0; // Timer for load checks

// Modify Trusted-Types policy to allow dynamic content (for older browsers/environments)
window.trustedTypes?.createPolicy('default', { createHTML: string => string, createScript: string => string, createScriptURL: string => string });

// Override Element.prototype.attachShadow to observe shadow DOMs
Element.prototype.attachShadow = function () {
    if (!gestureData.shadowList) { gestureData.shadowList = []; }
    let shadowRoot = ATTACH_SHADOW.call(this, ...arguments);
    gestureData.shadowList.push(shadowRoot); // Add shadow root to list
    CHECK_M_OBSERVER.observe(shadowRoot, { childList: true, subtree: true }); // Observe for mutations
    return shadowRoot;
};

/**
 * Periodically checks for new video, image, and link elements on the page,
 * including those within shadow DOMs, and applies relevant event listeners and observers.
 */
async function loadCheck() {
    // Collect new elements that haven't been processed yet
    linkEles = [...document.querySelectorAll('a:not([_linkShow_])')];
    videoEles = [...document.querySelectorAll('video:not([_videoBox_])')];
    imgEles = [...document.querySelectorAll('img:not([_imgShow_]),[style*="url("]:not([_imgShow_])')];

    // Check elements within shadow DOMs
    if (gestureData.shadowList) {
        for (let Ti = 0, len = gestureData.shadowList.length; Ti < len; ++Ti) {
            linkEles.push(...gestureData.shadowList[Ti].querySelectorAll('a:not([_linkShow_])'));
            videoEles.push(...gestureData.shadowList[Ti].querySelectorAll('video:not([_videoBox_])'));
            imgEles.push(...gestureData.shadowList[Ti].querySelectorAll('img:not([_imgShow_]),[style*="url("]:not([_imgShow_])'));
        }
    }

    // Video playback event binding
    if (videoEles.length && gestureData.settings['Video Gestures']) {
        if (!gestureData.tipBox) {
            regRESIZE(); // Start fullscreen detection
            if (top !== self) { top.postMessage({ 'type': 'forceFullScreen' }, '*'); } // Request fullscreen capability from top frame
            // Create and style the tip box for video controls
            gestureData.tipBox = document.createElement('div');
            // Updated styling for tipBox
            gestureData.tipBox.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.9);padding:10px 16px;background-color:rgba(30, 30, 30, 0.9);color:#fff;font-family:"Roboto", sans-serif;font-size:min(4vw, 20px);border-radius:20px;z-index:2147483647;display:flex;align-items:center;justify-content:center;gap:8px;opacity:0;pointer-events:none;transition:opacity 0.2s ease, transform 0.2s ease;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
        }
        for (let Ti = 0, len = videoEles.length; Ti < len; ++Ti) {
            if (!videoEles[Ti]._videoBox_) {
                await gestureData.findVideoBox(videoEles[Ti]); // Find video container
                if (gestureData.settings['Video Download']) { await window._initDownload_(videoEles[Ti]); } // Initialize download if enabled
                if (!videoEles[Ti].paused) {
                    setVideo(videoEles[Ti]); // Set as active video if playing
                    if (top !== self) { top.postMessage({ 'type': 'iframeLock' }, '*'); } // Lock iframe if playing
                }
                videoEles[Ti].addEventListener('playing', setVideo, true); // Listen for playing event
                videoEles[Ti].addEventListener('volumechange', setVideo, true); // Listen for volume change
                videoEles[Ti].addEventListener('contextmenu', (e) => { e.preventDefault(); }, true); // Prevent default context menu
            }
        }
    }
    // Image visibility event binding
    if (gestureData.settings['Image Gestures']) {
        for (let Ti = 0, len = imgEles.length; Ti < len; ++Ti) {
            imgEles[Ti].setAttribute('_imgShow_', '0'); // Mark as not visible initially
            IMG_I_OBSERVER.observe(imgEles[Ti]); // Observe for intersection
        }
    }
    // Link preloading binding
    if (gestureData.settings['Page Acceleration']) {
        for (let Ti = 0, len = linkEles.length; Ti < len; ++Ti) {
            linkEles[Ti].setAttribute('_linkShow_', '0'); // Mark as not visible initially
            if (linkEles[Ti].href.indexOf('/') > -1) { // Only observe valid links
                linkEles[Ti]._prefetch_ = 0; // Initialize prefetch timestamp
                A_I_OBSERVER.observe(linkEles[Ti]); // Observe for intersection
                linkEles[Ti].addEventListener('click', function () { this._prefetch_ = 0; }, true); // Reset prefetch on click
            }
        }
    }
    if (!document.documentElement._regEvent_) { regEvent(); } // Register main events if not already done
    checkTimer = 0; // Reset check timer
}

/**
 * Adds a CSS style block to the document's head.
 * @param {string} css - The CSS string to add.
 * @returns {HTMLStyleElement} The created style element.
 */
gestureData.addStyle = (css) => {
    let style = document.createElement('style');
    style.textContent = css;
    if (document.head) {
        document.head.insertAdjacentElement('beforeend', style);
        return style;
    } else {
        setTimeout(() => { gestureData.addStyle(css); }); // Retry if head is not ready
    }
};

/**
 * Creates a shallow copy of a Touch object, excluding the 'target' property.
 * This is used for passing touch data between frames.
 * @param {Touch} oldObj - The original Touch object.
 * @returns {Object} A new object with copied properties.
 */
function copyTouch(oldObj) {
    let newObj = {};
    for (let Ti in oldObj) {
        if (Ti === 'target') { continue; } // Skip the 'target' property
        newObj[Ti] = oldObj[Ti];
    }
    return newObj;
}

/**
 * Displays the gesture settings UI.
 * Allows users to add, edit, delete gestures, and configure script settings.
 */
gestureData.openSet = () => {
    let gestureName = '', gesturePath = '',
        gestureBox = document.createElement('div'),
        pathEle = null,
        clickTimer = 0;

    // Inject CSS for the settings UI, including Roboto font import
    gestureData.addStyle('@import url(\'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap\');'+
                '*{overflow:hidden !important;}'+
                '#_gestureBox_{background-color:#fff;width:100%;height:100%;position:fixed;padding:0;margin:0;inset:0;overflow-y:auto !important;z-index:2147483647;}'+
                '#_gestureBox_ *{font-family:"Roboto", sans-serif;margin:0;padding:0;text-align:center;font-size:5vmin;line-height:12vmin;user-select:none !important;transform:none;text-indent:0;}'+
                '#_gestureBox_ ::placeholder{color:#999;font-size:2.5vmin;line-height:6vmin;}'+
                '#_gestureBox_ h1{width:60%;height:12vmin;color:#0074d9;background-color:#dee6ef;margin:3vmin auto;border-radius:12vmin;box-shadow:0.9vmin 0.9vmin 3vmin #dfdfdf;}'+
                '#_gestureBox_ #_addGesture_{width:14vmin;height:14vmin;margin:3vmin auto;line-height:14vmin;background-color:#dee6ef;color:#032e58;font-size:7.5vmin;border-radius:15vmin;box-shadow:0.3vmin 0.3vmin 1.5vmin #dfdfdf;}'+
                '#_gestureBox_ ._gestureLi_{height:18vmin;width:100%;border-bottom:0.3vmin solid #dfdfdf;}'+
                '#_gestureBox_ ._gestureLi_ p{margin:3vmin 0 0 1%;width:38%;height:12vmin;border-left:1.8vmin solid;color:#ffb400;background-color:#fff1cf;float:left;white-space:nowrap;text-overflow:ellipsis;text-shadow:0.3vmin 0.3vmin 3vmin #ffcb56;}'+
                '#_gestureBox_ ._gestureLi_ ._gesturePath_{margin:3vmin 0 0 3%;float:left;width:38%;height:12vmin;background-color:#f3f3f3;color:#000;box-shadow:0.3vmin 0.3vmin 1.5vmin #ccc9c9;border-radius:3vmin;white-space:nowrap;text-overflow:ellipsis;}'+
                '#_gestureBox_ ._gestureLi_ ._delGesture_{margin:3vmin 2% 0 0;width:15vmin;height:12vmin;float:right;color:#f00;text-decoration:line-through;}'+
                '#_gestureBox_ #_revisePath_{background-color:rgba(0,0,0,0.7);width:100%;height:100%;position:fixed;inset:0;display:none;color:#000;}'+
                '#_gestureBox_ #_revisePath_ span{width:15vmin;height:15vmin;font-size:12.5vmin;line-height:15vmin;position:absolute;}'+
                '#_gestureBox_ #_revisePath_ div{color:#3339f9;position:absolute;width:30%;height:12vmin;font-size:10vmin;bottom:15%;}'+
                '#_gestureBox_ #_revisePath_ p{color:#3ba5d8;position:absolute;top:15%;font-size:10vmin;height:12vmin;width:100%;}'+
                '#_gestureBox_ #_revisePath_ #_path_{top:40%;color:#ffee03;height:100%;word-wrap:break-word;font-size:15vmin;line-height:18vmin;}'+
                '#_gestureBox_ #_editGesture_{overflow-y:auto !important;background-color:#fff;width:100%;height:100%;position:fixed;inset:0;display:none;color:#000;}'+
                '#_gestureBox_ #_editGesture_ p{color:#3339f9;font-size:7.5vmin;text-align:left;margin:6vmin 0 0 9vmin;width:100%;height:9vmin;line-height:9vmin;}'+
                '#_gestureBox_ #_editGesture_ #_gestureName_{margin-top:6vmin;width:80%;height:12vmin;color:#000;border:0.3vmin solid #dadada;border-radius:3vmin;text-align:left;padding:0 3vmin;}'+
                '#_gestureBox_ #_editGesture_ ._label_box_>label{display:inline-block;margin-top:6vmin;position:relative;}'+
                '#_gestureBox_ #_editGesture_ ._label_box_>label>input{position:absolute;top:0;left:-6vmin;}'+
                '#_gestureBox_ #_editGesture_ ._label_box_>label>div{width:20vw;border:#ddd solid 0.3vmin;height:12vmin;color:#666;position:relative;}'+
                '#_gestureBox_ #_editGesture_ ._label_box_>label>input:checked + div{border:#d51917 solid 0.3vmin;color:#d51917;}'+
                '#_gestureBox_ #_editGesture_ ._label_box_>label>input + div:after{top:auto;left:auto;bottom:-3vmin;right:0;transition:none;}'+
                '#_gestureBox_ #_editGesture_ ._label_box_>label>input:checked + div:after{content:"";display:block;border:none;width:6vmin;height:6vmin;background-color:#d51917;transform:skewY(-45deg);position:absolute;}'+
                '#_gestureBox_ #_editGesture_ ._label_box_>label>input:checked + div:before{content:"";display:block;width:0.9vmin;height:2.4vmin;border-right:#fff solid 0.6vmin;border-bottom:#fff solid 0.6vmin;transform:rotate(35deg);position:absolute;bottom:0.6vmin;right:1.2vmin;z-index:1;}'+
                '#_gestureBox_ #_editGesture_ #_gestureCode_{overflow-y:auto !important;width:80%;margin-top:6vmin;height:40%;text-align:left;line-height:6vmin;padding:3vmin;border:0.3vmin solid #dadada;border-radius:3vmin;}'+
                '#_gestureBox_ #_editGesture_ button{width:30vmin;height:15vmin;font-size:7.5vmin;line-height:15vmin;display:inline-block;color:#fff;background-color:#2866bd;margin:6vmin 3vmin 0 3vmin;border:none;}'+
                '#_gestureBox_ #_editGesture_ button:active{background-color:#1e4a8a;}'+ // Added active state for buttons
                '#_gestureBox_ #_settingsBox_{overflow-y:auto !important;background-color:#fff;width:100%;height:100%;position:fixed;inset:0;display:none;color:#000;}'+
                '#_gestureBox_ #_settingsBox_ p{color:#3339f9;text-align:left;margin:9vmin 0 0 9vmin;float:left;height:6vmin;line-height:6vmin;clear:both;}'+
                '#_gestureBox_ #_settingsBox_ ._slideRail_{overflow:initial !important;width:55%;background-color:#a8a8a8;float:left;margin:12vmin 0 0 3vmin;height:0.6vmin;position:relative;}'+
                '#_gestureBox_ #_settingsBox_ ._slideRail_ ._slideButton_{line-height:9vmin;color:#fff;background-color:#2196f3;min-width:9vmin;height:9vmin;border-radius:9vmin;font-size:4vmin;position:absolute;top:-4.5vmin;box-shadow:0.3vmin 0.3vmin 1.8vmin #5e8aee;padding:0 1vmin;}'+
                '#_gestureBox_ #_settingsBox_ ._switch_{position:relative;display:inline-block;width:18vmin;height:9vmin;float:left;margin:7.5vmin 42% 0 3vmin;}'+
                '#_gestureBox_ #_settingsBox_ ._switch_ input{display:none;}'+
                '#_gestureBox_ #_settingsBox_ ._slider_{border-radius:9vmin;position:absolute;cursor:pointer;inset:0;background-color:#ccc;transition:0.4s;}'+
                '#_gestureBox_ #_settingsBox_ ._slider_:before{border-radius:50%;position:absolute;content:"";height:7.5vmin;width:7.5vmin;left:0.6vmin;bottom:0.6vmin;background-color:white;transition:0.4s;}'+
                '#_gestureBox_ #_settingsBox_ input:checked + ._slider_{background-color:#2196F3;}'+
                '#_gestureBox_ #_settingsBox_ input:checked + ._slider_:before{transform:translateX(9vmin);}'+
                '#_gestureBox_ #_settingsBox_ #_saveSettings_{display:block;clear:both;width:30vmin;height:15vmin;font-size:7.5vmin;line-height:15vmin;color:#fff;background-color:#2866bd;border:none;margin:12vmin 0 0 calc(50% - 15vmin);float:left;}'+
                '#_gestureBox_ #_saveSettings_:active{background-color:#1e4a8a;}'); // Added active state for save settings button

    gestureBox.id = '_gestureBox_';
    document.body.insertAdjacentElement('beforeend', gestureBox);

    // Populate the settings UI with HTML
    gestureBox.innerHTML = '<h1 id="_openSettings_">Gesture Settings</h1><div id="_addGesture_">+</div><div id="_gestureUL_"></div>' +
        '<div id="_revisePath_"><span style="top:0;left:0;text-align:left;">┌</span><span style="top:0;right:0;text-align:right;">┐</span><span style="bottom:0;left:0;text-align:left;">└</span><span style="bottom:0;right:0;text-align:right;">┘</span>' +
        '<p>Please slide your finger</p><p id="_path_"></p><div id="_clearPath_" style="left:10%;">Clear</div><div id="_cancleRevise_" style="right:10%;">Save</div></div>' +
        '<div id="_editGesture_"><p>Gesture Name:</p><input type="text" id="_gestureName_" maxlength="12" placeholder="Max 12 characters">' +
        '<p>Gesture Type:</p><div class="_label_box_"><label><input type="radio" id="_G_" name="_gestureType_" value=""><div>General</div></label><label><input type="radio" id="_T_" name="_gestureType_" value="T"><div>Text</div></label><label><input type="radio" id="_I_" name="_gestureType_" value="I"><div>Image</div></label><label><input type="radio" id="_V_" name="_gestureType_" value="V"><div>Video</div></label></div>' +
        '<p>Gesture Execution Script:</p><textarea id="_gestureCode_" placeholder="Available Variables:\n 	gestureData: Gesture data constant. Use gestureData.variableName = value to pass variables between gestures.\n	gestureData.touchEle: The element touched by the finger.\n	gestureData.selectWords: Selected text.\n	gestureData.touchStart: Touch start coordinates object.\n	gestureData.touchEnd: Latest touch coordinates object.\n	gestureData.path: The gesture path.\n	gestureData.videoPlayer: The currently playing video element.\n\nAvailable Methods:\n	gestureData.addStyle(CSS_style): Adds CSS style to the webpage.\n	gestureData.runGesture(): Executes the gesture based on the current path. You can modify the path before calling this method.\n	gestureData.GM_openInTab(link): Opens a link in a new tab.\n	gestureData.GM_setClipboard(text): Copies text to the clipboard.\n	gestureData.GM_setValue(variableName, value): Stores data in GM storage.\n	gestureData.GM_getValue(variableName, defaultValue): Retrieves data from GM storage, or uses defaultValue if not found.\n\nRecognized Code Comments (only for General gestures):\n	Default: When iframes exist, all gestures only execute on the page object where the gesture was triggered!\n 	Add /*ONLY TOP*/: Gesture only executes on the top-level page object.\n	Add /*WITH TOP*/: Gesture executes on both the current page object and the top-level page object."></textarea>' +
        '<div style="width:100%;height:0.3vmin;"></div><button id="_saveGesture_">Save</button><button id="_closeEdit_">Close</button></div>' +
        '<div id="_settingsBox_"><h1>Feature Settings</h1><span id="_settingList_"></span><button id="_saveSettings_">Save</button></div>';
    pathEle = document.getElementById('_path_');

    /**
     * Opens the gesture editing interface.
     * Populates the form with the selected gesture's details.
     */
    function editGesture() {
        gestureName = this.parentNode.getAttribute('name');
        if (['Open Settings', 'Video Fullscreen', 'Gesture Passthrough'].indexOf(gestureName) > -1) {
            alert('This gesture script cannot be modified!');
            return;
        }
        gesturePath = this.parentNode.getAttribute('path');
        let selectType = (/^[TIV]/.test(gesturePath)) ? `_${gesturePath.slice(0, 1)}_` : '_G_';
        document.getElementById(selectType).click();
        document.getElementById('_gestureName_').value = gestureName;
        document.getElementById('_gestureCode_').value = gestureData.gesture[gesturePath].code;
        document.getElementById('_editGesture_').style.display = 'block';
    }

    /**
     * Opens the gesture path revision interface.
     * Clears the current path display and prepares for new input.
     */
    function revisePath() {
        gestureName = this.parentNode.getAttribute('name');
        gesturePath = this.parentNode.getAttribute('path');
        pathEle.textContent = '';
        window.removeEventListener('touchmove', touchMove, true); // Temporarily disable main touchmove
        window.removeEventListener('pointermove', touchMove, true); // Temporarily disable main pointermove
        document.getElementById('_revisePath_').style.display = 'block';
    }

    /**
     * Deletes a selected gesture after confirmation.
     * Updates GM storage and re-initializes the UI.
     */
    function delGesture() {
        gestureName = this.parentNode.getAttribute('name');
        if (['Open Settings', 'Video Fullscreen', 'Gesture Passthrough'].indexOf(gestureName) > -1) {
            alert('This gesture cannot be deleted!');
            return;
        }
        // Using a custom modal for confirmation instead of alert/confirm
        const confirmModal = document.createElement('div');
        confirmModal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:2147483647;';
        confirmModal.innerHTML = `
            <div style="background-color:rgba(30, 30, 30, 0.9); padding:20px; border-radius:20px; text-align:center; font-family:"Roboto", sans-serif; font-size:18px; color:#fff; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                <p style="margin-bottom: 20px;">Are you sure you want to delete "${gestureName}" gesture?</p>
                <button id="confirmYes" style="margin:10px; padding:10px 20px; background:#2196F3; color:#fff; border:none; border-radius:5px; cursor:pointer; font-family:"Roboto", sans-serif; font-size:16px;">Yes</button>
                <button id="confirmNo" style="margin:10px; padding:10px 20px; background:#666; color:#fff; border:none; border-radius:5px; cursor:pointer; font-family:"Roboto", sans-serif; font-size:16px;">No</button>
            </div>
        `;
        document.body.appendChild(confirmModal);

        document.getElementById('confirmYes').addEventListener('click', () => {
            confirmModal.remove();
            gesturePath = this.parentNode.getAttribute('path');
            delete gestureData.gesture[gesturePath];
            gestureData.GM_setValue('gesture', gestureData.gesture);
            init();
        });
        document.getElementById('confirmNo').addEventListener('click', () => {
            confirmModal.remove();
        });
    }

    /**
     * Handles slider bar movement for settings.
     * Updates the displayed value based on slider position.
     * @param {TouchEvent} e - The touch event object.
     */
    function silideBar(e) {
        e.preventDefault();
        fingersNum = 2; // Temporarily set fingersNum to 2 to prevent other gesture interference
        let diffX = e.changedTouches[0].clientX - gestureData.touchStart.clientX,
            leftPX = (+this.style.left.slice(0, -2)) + diffX,
            vmin = this.offsetWidth / 2,
            setArr = gestureData.settings[this.id];
        // Constrain slider within bounds
        leftPX = (leftPX < -vmin) ? -vmin : ((leftPX > (diffX = this.parentNode.offsetWidth - vmin)) ? diffX : leftPX);
        this.style.left = leftPX + 'px';
        // Calculate and display value based on position and settings array
        this.textContent = ((leftPX + vmin) / this.parentNode.offsetWidth * (setArr[2] - setArr[1]) + setArr[1]).toFixed(setArr[3]);
        gestureData.touchStart = e.changedTouches[0]; // Update start point for continuous slide
    }

    /**
     * Internal long press handler for the gesture path revision UI.
     * Adds '●' to the path.
     */
    function _longPress() {
        if (isClick || !/^$|[●○▼▽]$/.test(pathEle.textContent)) {
            isClick = 0;
            startPoint = gestureData.touchEnd;
            pathEle.textContent += '●';
        }
    }

    /**
     * Internal continuous sliding handler for the gesture path revision UI.
     * Adds '▼' to the path.
     */
    function _slidingRun() {
        slideStamp = 0;
        pathEle.textContent += '▼';
    }

    /**
     * Internal click handler for the gesture path revision UI.
     * Adds '◆' to the path.
     */
    function _clickRun() {
        if (!/[○▼▽]$/.test(pathEle.textContent)) {
            pathEle.textContent += '◆';
        }
    }

    /**
     * Initializes or re-initializes the list of gestures in the settings UI.
     * Populates the list from `gestureData.gesture`.
     */
    function init() {
        let gestureUL = document.getElementById('_gestureUL_');
        gestureUL.textContent = ''; // Clear existing list
        for (let Ti in gestureData.gesture) {
            let gestureLi = document.createElement('div'),
                nameEle = document.createElement('p'),
                pathEle = document.createElement('div'),
                delEle = document.createElement('div');

            gestureLi.className = '_gestureLi_';
            gestureLi.setAttribute('name', gestureData.gesture[Ti].name);
            gestureLi.setAttribute('path', Ti);

            nameEle.textContent = gestureData.gesture[Ti].name;
            nameEle.addEventListener('click', editGesture, true);

            pathEle.className = '_gesturePath_';
            pathEle.textContent = Ti;
            pathEle.addEventListener('click', revisePath, true);

            delEle.className = '_delGesture_';
            delEle.textContent = 'Delete';
            delEle.addEventListener('click', delGesture, true);

            gestureLi.insertAdjacentElement('beforeend', nameEle);
            gestureLi.insertAdjacentElement('beforeend', pathEle);
            gestureLi.insertAdjacentElement('beforeend', delEle);
            gestureUL.insertAdjacentElement('beforeend', gestureLi);
        }
    }
    init(); // Initial call to populate the gesture list

    // Event listener for adding a new gesture
    document.getElementById('_addGesture_').addEventListener('click', () => {
        gestureName = gesturePath = '';
        document.getElementById('_G_').click(); // Select 'General' type by default
        document.getElementById('_gestureName_').value = '';
        document.getElementById('_gestureCode_').value = '';
        document.getElementById('_editGesture_').style.display = 'block'; // Show edit interface
    }, true);

    // Event listener for saving a gesture
    document.getElementById('_saveGesture_').addEventListener('click', () => {
        let name = document.getElementById('_gestureName_').value;
        if (!name) { alert('Please enter a gesture name!'); return; }
        if (document.querySelector(`#_gestureBox_ ._gestureLi_[name="${name}"]:not([path="${gesturePath}"])`)) {
            alert('A gesture with the same name already exists!');
            return;
        }
        let typeEle = document.getElementsByName('_gestureType_');
        for (let Ti = 0, len = typeEle.length; Ti < len; ++Ti) {
            if (typeEle[Ti].checked) {
                // Construct new path based on type and name
                let newPath = typeEle[Ti].value + ((gestureName && gesturePath.indexOf('[') < 0) ? ((/^[TIV]/.test(gesturePath)) ? gesturePath.slice(1) : gesturePath) : (`[${name}]`));
                if (newPath !== gesturePath) {
                    // Handle existing gesture at new path
                    if (gestureData.gesture[newPath]) {
                        let pathTXT = typeEle[Ti].value + `[${gestureData.gesture[newPath].name}]`;
                        gestureData.gesture[pathTXT] = gestureData.gesture[newPath];
                    }
                    gestureData.gesture[newPath] = gestureData.gesture[gesturePath] || {};
                    delete gestureData.gesture[gesturePath]; // Delete old path if it exists
                }
                gestureData.gesture[newPath].name = name;
                gestureData.gesture[newPath].code = document.getElementById('_gestureCode_').value;
                break;
            }
        }
        gestureData.GM_setValue('gesture', gestureData.gesture); // Save gestures to GM storage
        init(); // Re-initialize UI
        document.getElementById('_editGesture_').style.display = 'none'; // Hide edit interface
    }, true);

    // Event listener for closing the edit interface
    document.getElementById('_closeEdit_').addEventListener('click', () => {
        document.getElementById('_editGesture_').style.display = 'none';
    }, true);

    // Event listeners for gesture path modification in the revision UI
    document.getElementById('_revisePath_').addEventListener('touchstart', () => {
        if (fingersNum > 1) { return; }
        clearTimeout(gestureTimer);
        clearTimeout(clickTimer);
        gestureTimer = setTimeout(_longPress, 300 + slideTime - pressTime);
    }, true);

    document.getElementById('_revisePath_').addEventListener('touchmove', (e) => {
        e.preventDefault();
        clearTimeout(gestureTimer);
        gestureData.touchEnd = e.changedTouches[0];
        if (/[○▼▽]$/.test(pathEle.textContent) || fingersNum > 1) { return; }

        let xLen = (gestureData.touchEnd.screenX - startPoint.screenX) ** 2,
            yLen = (gestureData.touchEnd.screenY - startPoint.screenY) ** 2,
            direction = (xLen > yLen) ? ((gestureData.touchEnd.screenX > startPoint.screenX) ? '→' : '←') : ((gestureData.touchEnd.screenY > startPoint.screenY) ? '↓' : '↑'),
            nowTime = Date.now(),
            pathLen = xLen + yLen,
            lastIcon = pathEle.textContent.slice(-1);

        if (pathLen > LIMIT / 100) {
            slideTime = nowTime;
            isClick = 0;
            if (lastIcon === direction || pathLen > LIMIT) {
                if (lastIcon !== direction) { pathEle.textContent += direction; slideStamp = nowTime + 300; }
                startPoint = gestureData.touchEnd;
                if (slideStamp && nowTime > slideStamp) { _slidingRun(); }
            } else if (pathLen > LIMIT / 16) { slideStamp = 0; }
        }
        gestureTimer = setTimeout(_longPress, 300 + slideTime - nowTime);
    }, true);

    document.getElementById('_revisePath_').addEventListener('touchend', (e) => {
        if (!isClick || fingersNum > 0) { return; }
        if (gestureData.path.indexOf('◆◆') > -1) {
            gestureData.path = '';
            switch (pathEle.textContent.slice(-1)) {
                case '●': { pathEle.textContent = pathEle.textContent.slice(0, -1) + '○'; break; }
                case '○': { pathEle.textContent = pathEle.textContent.slice(0, -1) + '●'; break; }
                case '▼': { pathEle.textContent = pathEle.textContent.slice(0, -1) + '▽'; break; }
                case '▽': { pathEle.textContent = pathEle.textContent.slice(0, -1) + '▼'; break; }
                default: { pathEle.textContent += '◆'; setTimeout(_clickRun, 100); break; }
            }
        } else { clickTimer = setTimeout(_clickRun, 200); }
    });

    // Event listener for clearing the gesture path in the revision UI
    document.getElementById('_clearPath_').addEventListener('touchend', (e) => {
        e.stopPropagation();
        if (!isClick || fingersNum > 0) { return; }
        if (gestureData.path.indexOf('◆◆') > -1) { gestureData.path = ''; pathEle.textContent = ''; }
        else { pathEle.textContent = pathEle.textContent.slice(0, -1); } // Remove last character
    });

    // Event listener for saving the modified gesture path
    document.getElementById('_cancleRevise_').addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isClick || fingersNum > 0) { return; }
        if (pathEle.textContent) {
            if (gestureName === 'Video Fullscreen' && pathEle.textContent.slice(-1) !== '◆') {
                alert('Video Fullscreen gesture must end with ◆!');
                return;
            }
            if (gestureData.gesture[pathEle.textContent]?.name === 'Gesture Passthrough') {
                alert('Path conflicts with "Gesture Passthrough" function!');
                return;
            }
            // Adjust path based on type (T, I, V)
            if (/^[TIV]/.test(gesturePath)) { pathEle.textContent = gesturePath.slice(0, 1) + pathEle.textContent; }
            if (gestureData.gesture[pathEle.textContent]) {
                let pathTXT = ((/^[TIV]/.test(gesturePath)) ? gesturePath.slice(0, 1) : '') + `[${gestureData.gesture[pathEle.textContent].name}]`;
                gestureData.gesture[pathTXT] = gestureData.gesture[pathEle.textContent];
            }
            gestureData.gesture[pathEle.textContent] = gestureData.gesture[gesturePath];
            delete gestureData.gesture[gesturePath]; // Delete old path
            gestureData.GM_setValue('gesture', gestureData.gesture); // Save to GM storage
            init(); // Re-initialize UI
        }
        // Re-enable main touch event listeners
        window.addEventListener('touchmove', touchMove, { capture: true, passive: true });
        window.addEventListener('pointermove', touchMove, { capture: true, passive: true });
        document.getElementById('_revisePath_').style.display = 'none'; // Hide revision UI
    });

    // Event listener for opening feature settings
    document.getElementById('_openSettings_').addEventListener('click', () => {
        gestureBox.style.cssText = 'overflow-y:hidden !important'; // Hide overflow
        document.getElementById('_settingsBox_').style.display = 'block'; // Show settings box
        let settingList = document.getElementById('_settingList_');
        settingList.textContent = ''; // Clear existing settings list

        // Populate settings UI based on gestureData.settings
        for (let Ti in gestureData.settings) {
            settingList.innerHTML += `<p>${Ti}:</p>`;
            if (typeof (gestureData.settings[Ti]) === 'boolean') {
                // For boolean settings, create a toggle switch
                settingList.innerHTML += `<label class="_switch_"><input type="checkbox" id="${Ti}" ${((gestureData.settings[Ti]) ? 'checked' : '')}><div class="_slider_"></div></label>`;
            } else if (typeof (gestureData.settings[Ti]) === 'object') {
                // For object settings (sliders), create a slider rail and button
                settingList.innerHTML += `<div class="_slideRail_"><div class="_slideButton_" id="${Ti}"></div></div>`;
                let slideButton = document.getElementById(Ti),
                    // Calculate initial position of slider button
                    leftPX = slideButton.parentNode.offsetWidth * (gestureData.settings[Ti][0] - gestureData.settings[Ti][1]) / (gestureData.settings[Ti][2] - gestureData.settings[Ti][1]) - slideButton.offsetWidth / 2;
                slideButton.style.left = leftPX + 'px';
                slideButton.textContent = gestureData.settings[Ti][0].toFixed(gestureData.settings[Ti][3]); // Display current value
            }
        }
        // Add touchmove listeners to all slider buttons
        let slideList = document.getElementsByClassName('_slideButton_');
        for (let Ti = 0, len = slideList.length; Ti < len; ++Ti) {
            slideList[Ti].addEventListener('touchmove', silideBar, true);
        }
    }, true);

    // Event listener for saving feature settings
    document.getElementById('_saveSettings_').addEventListener('click', () => {
        gestureBox.style.cssText = ''; // Restore overflow
        for (let Ti in gestureData.settings) {
            if (typeof (gestureData.settings[Ti]) === 'boolean') {
                gestureData.settings[Ti] = document.getElementById(Ti).checked; // Update boolean setting
            } else if (typeof (gestureData.settings[Ti]) === 'object') {
                gestureData.settings[Ti][0] = +document.getElementById(Ti).textContent; // Update slider value
            }
        }
        gestureData.GM_setValue('settings', gestureData.settings); // Save settings to GM storage
        document.getElementById('_settingsBox_').style.display = 'none'; // Hide settings box
    }, true);
};

/* Event Registration Module */
/**
 * Registers all necessary event listeners for gesture detection and inter-frame communication.
 */
function regEvent() {
    // If current frame is the top frame
    if (top === self) {
        // Clear back timer on popstate or beforeunload
        window.addEventListener('popstate', () => { clearTimeout(gestureData.backTimer); gestureData.backTimer = 0; }, true);
        window.addEventListener('beforeunload', () => { clearTimeout(gestureData.backTimer); gestureData.backTimer = 0; }, true);

        // Listen for messages from iframes
        window.addEventListener('message', async (e) => {
            let data = e.data;
            switch (data.type) {
                case 'iframeLock': { // Iframe requesting lock (e.g., video playing)
                    iframeLock = e.source;
                    break;
                }
                case 'GYRO': { // Iframe requesting landscape orientation lock
                    await screen.orientation.lock('landscape')?.catch(Date);
                    break;
                }
                case 'iframeSelect': { // Iframe sending selected text
                    gestureData.iframeSelect = data.selectWords;
                    break;
                }
                case 'forceFullScreen': { // Iframe requesting to be force-enabled for fullscreen
                    for (let Ti = 0, len = iframeEles.length; Ti < len; ++Ti) {
                        if (iframeEles[Ti].contentWindow === e.source) {
                            if (!iframeEles[Ti].allowFullscreen) {
                                iframeEles[Ti].allowFullscreen = true;
                                // Reload iframe if src exists to apply allowFullscreen
                                if (iframeEles[Ti].getAttribute('src') && iframeEles[Ti].src.indexOf('/') > -1) {
                                    iframeEles[Ti].src = iframeEles[Ti].src;
                                }
                            }
                            break;
                        }
                    }
                    break;
                }
                case 'runPath': { // Iframe requesting gesture execution in top frame
                    for (let Ti = 0, len = iframeEles.length; Ti < len; ++Ti) {
                        if (iframeEles[Ti].contentWindow === e.source) {
                            let ifrRect = iframeEles[Ti].getBoundingClientRect();
                            gestureData.touchStart = data.gestureData.touchStart;
                            gestureData.touchEnd = data.gestureData.touchEnd;
                            // Adjust touch coordinates to be relative to the top frame
                            gestureData.touchStart.target = gestureData.touchEnd.target = gestureData.touchEle = iframeEles[Ti];
                            gestureData.touchStart.pageX = gestureData.touchStart.clientX += ifrRect.x;
                            gestureData.touchStart.pageY = gestureData.touchStart.clientY += ifrRect.y;
                            gestureData.touchEnd.pageX = gestureData.touchEnd.clientX += ifrRect.x;
                            gestureData.touchEnd.pageY = gestureData.touchEnd.clientY += ifrRect.y;
                            break;
                        }
                    }
                    gestureData.path = data.runPath;
                    setTimeout(gestureData.runGesture); // Execute gesture
                    break;
                }
                case 'pushTouch': { // Iframe pushing updated touch coordinates
                    let ifrRect = gestureData.touchEle.getBoundingClientRect();
                    gestureData.touchEnd = data.gestureData.touchEnd;
                    gestureData.touchEnd.target = gestureData.touchEle;
                    // Adjust touch coordinates to be relative to the top frame
                    gestureData.touchEnd.pageX = gestureData.touchEnd.clientX += ifrRect.x;
                    gestureData.touchEnd.pageY = gestureData.touchEnd.clientY += ifrRect.y;
                    break;
                }
                case 'download': { // Iframe requesting video download
                    window._downloadVideo_(data);
                    break;
                }
            }
        }, true);
    } else { // If current frame is an iframe
        // Send selected text to top frame
        window.addEventListener('selectionchange', () => { top.postMessage({ 'type': 'iframeSelect', 'selectWords': window.getSelection() + '' }, '*'); }, true);
        // Listen for messages from top frame
        window.addEventListener('message', async (e) => {
            let data = e.data;
            switch (data.type) {
                case 'fullscreen': { // Top frame requesting fullscreen for video
                    await gestureData.findVideoBox()?.requestFullscreen()?.catch(Date);
                    break;
                }
            }
        }, true);
    }

    // Main gesture event listeners
    window.addEventListener('touchstart', touchStart, { capture: true, passive: false });
    window.addEventListener('pointermove', touchMove, { capture: true, passive: true });
    window.addEventListener('touchmove', touchMove, { capture: true, passive: true });
    window.addEventListener('touchend', touchEnd, { capture: true, passive: false });
    window.addEventListener('touchcancel', touchEnd, { capture: true, passive: false });

    // Filter out clicks that occur too quickly after a touchstart (to prevent misfires during slides)
    window.addEventListener('click', (e) => { if (timeSpan < 50) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);

    // Prevent default context menu on images if image gestures are active
    if (gestureData.settings['Image Gestures']) {
        window.addEventListener('contextmenu', (e) => {
            if ((gestureData.path.indexOf("I") > -1 || e.target.nodeName === 'IMG') && gestureData.touchEle.src !== location.href) {
                e.preventDefault();
            }
        }, true);
    }

    // Prevent pages from detecting focus changes (e.g., when switching tabs)
    window.addEventListener('visibilitychange', (e) => {
        e.stopImmediatePropagation();
        if (document.hidden) { // If page is hidden, handle video background playback
            let playState = gestureData.videoPlayer?.paused,
                playTime = gestureData.videoPlayer?.currentTime + 0.2,
                playSpeed = gestureData.videoPlayer?.playbackRate,
                playVolume = gestureData.videoPlayer?.volume;
            setTimeout(() => {
                if (playState !== gestureData.videoPlayer?.paused) {
                    gestureData.videoPlayer.load();
                    gestureData.videoPlayer.currentTime = playTime;
                    gestureData.videoPlayer.addEventListener('loadstart', () => {
                        gestureData.videoPlayer.play();
                        gestureData.videoPlayer.playbackRate = playSpeed;
                        gestureData.videoPlayer.volume = playVolume;
                    }, true);
                }
            });
        } else if (gestureData.settings['Page Acceleration']) { // If page is visible and acceleration is on, update preloaded links
            let links = [...document.querySelectorAll('a[_linkShow_="1"]')],
                nowTime = Date.now();
            if (gestureData.shadowList) {
                for (let Ti = 0, len = gestureData.shadowList.length; Ti < len; ++Ti) {
                    links.push(...gestureData.shadowList[Ti].querySelectorAll('a[_linkShow_="1"]'));
                }
            }
            for (let Ti = 0, len = links.length; Ti < len; ++Ti) {
                if (nowTime > links[Ti]._prefetch_) {
                    links[Ti]._prefetch_ = Date.now() + 300000; // Update prefetch timestamp
                    document.head.insertAdjacentHTML('beforeend', `<link rel="prefetch" href="${links[Ti].href.replace(/^https?:/, '')}"/>`);
                }
            }
        }
    }, true);
    window.addEventListener('pagehide', (e) => { e.stopImmediatePropagation(); }, true);
    window.addEventListener('blur', (e) => { e.stopImmediatePropagation(); });

    // Prevent websites from modifying clipboard content or writing to clipboard
    window.addEventListener('beforecopy', (e) => { e.stopImmediatePropagation(); }, true);
    window.addEventListener('copy', (e) => { if (gestureData.selectWords) { return; } e.stopImmediatePropagation(); }, true);
    document.execCommand = () => { }; // Block document.execCommand
    if (navigator.clipboard) {
        navigator.clipboard.writeText = () => { }; // Block navigator.clipboard.writeText
        navigator.clipboard.write = () => { }; // Block navigator.clipboard.write
    }

    // Remove selection restrictions and enable touch manipulation
    gestureData.addStyle('html,html *{user-select:auto !important;touch-action:manipulation;overscroll-behavior-x:none !important;}');
    window.addEventListener('selectstart', (e) => { e.stopImmediatePropagation(); }, true);

    // Pre-fetch + pre-render using speculationrules API for newer browsers
    if (gestureData.settings['Page Acceleration'] && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
        let specScript = document.createElement('script'),
            specRules = {
                'prerender': [{
                    'source': 'document',
                    'where': { 'and': [{ 'selector_matches': 'a[_linkShow_="1"]' }] },
                    'referrer_policy': 'strict-origin-when-cross-origin',
                    'eagerness': 'immediate'
                }],
                'prefetch': [{
                    'source': 'document',
                    'where': { 'and': [{ 'selector_matches': 'a[_linkShow_="1"]' }] },
                    'referrer_policy': 'strict-origin-when-cross-origin',
                    'eagerness': 'immediate'
                }],
                'prefetch_with_subresources': [{
                    'source': 'document',
                    'where': { 'and': [{ 'selector_matches': 'a[_linkShow_="1"]' }] },
                    'referrer_policy': 'strict-origin-when-cross-origin',
                    'eagerness': 'immediate'
                }]
            };
        specScript.type = 'speculationrules';
        specScript.textContent = JSON.stringify(specRules);
        document.head?.insertAdjacentElement('beforeend', specScript);
    }
    // Prevent page unload events from being stopped
    window.addEventListener('beforeunload', (e) => { e.stopImmediatePropagation(); }, true);
    window.addEventListener('unload', (e) => { e.stopImmediatePropagation(); }, true);

    // Mark events as registered
    document.documentElement._regEvent_ = 1;
}

// Initial registration of events and load check
(function () {
    regEvent();
    // Start initial load check
    checkTimer = setTimeout(loadCheck, 500);
    // Observe document for mutations to trigger loadCheck again
    CHECK_M_OBSERVER.observe(document, { childList: true, subtree: true });
})();
