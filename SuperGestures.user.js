// ==UserScript==
// @name         Super Mobile Gestures
// @description  Adds touch gestures to mobile browsers. Plug and play, no setup required. Includes a wide range of universal gestures and specialized interactions for text, images, and video. Customize and discover hidden features!
// @version      0.1
// @author       Murtaza Salih
// @namespace    https://github.com/itsrody
// @match        *://*/*
// @license      MIT
// @grant        window.close
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @run-at       document-start
// @downloadURL  https://github.com/itsrody/Lists/raw/refs/heads/main/SuperVideo.user.js
// @updateURL    https://github.com/itsrody/Lists/raw/refs/heads/main/SuperVideo.user.js
// ==/UserScript==
// v10.0.7 2025-05-25 - Fixed some issues

/* Gesture Data Module */
const gestureData = {};

// Mapping gesture patterns to actions
gestureData.gesture = {
  '↑→↓←': { name: 'Open Settings', code: 'gestureData.openSet();' },
  '◆◆':  { name: 'Toggle Video Fullscreen', code: 'gestureData.videoFullScreen();' },
  '●':   { name: 'Gesture Penetration', code: 'if(/^[TIV]/.test(gestureData.path)){gestureData.path=(gestureData.path.indexOf("I"))?"":"I";} /* ... */' },
  '→←':  { name: 'Go Back', code: '/*ONLY TOP*/function pageBack(){if(gestureData.backTimer){history.go(-1);setTimeout(pageBack,20);} } gestureData.backTimer=setTimeout(()=>{gestureData.backTimer=0;window.close();},200);pageBack();' },
  '←→':  { name: 'Go Forward', code: '/*ONLY TOP*/history.go(1);' },
  '↓↑':  { name: 'Scroll to Top', code: '/*WITH TOP*/let box=gestureData.touchEle.parentNode; while(box.nodeName!="#document"){box.scrollIntoView(true); if(box.scrollTop){box.scrollTo(0,0);} box=box.parentNode;} ' },
  '↑↓':  { name: 'Scroll to Bottom', code: '/*WITH TOP*/let box=gestureData.touchEle.parentNode; while(box.nodeName!="#document"){ if(getComputedStyle(box).overflowY!="hidden"){box.scrollTo(0,box.scrollHeight+999999);} box=box.parentNode;} ' },
  '←↓':  { name: 'Refresh Page', code: '/*ONLY TOP*/document.documentElement.style.cssText="filter:grayscale(100%)";history.go(0);' },
  '←↑':  { name: 'Open New Tab', code: '/*ONLY TOP*/gestureData.GM_openInTab("//limestart.cn",false);' },
  '→↓':  { name: 'Close Page', code: '/*ONLY TOP*/window.close();' },
  '→↑':  { name: 'Restore Tabs', code: '/*ONLY TOP*/gestureData.GM_openInTab("chrome-native://recent-tabs",false);' },
  '↓↑●':{ name: 'Open Link in New Tab', code: '/* ... */' },
  '↑↓●':{ name: 'Hide Element', code: '/* ... */' },
  '↓→': { name: 'Clone Page', code: '/*ONLY TOP*/gestureData.GM_openInTab(location.href,false);' },
  '→←→':{ name: 'Toggle Half-Screen Mode', code: '/* ... */' },
  '→↓↑←':{ name: 'Parse Video', code: '/*ONLY TOP*/gestureData.GM_openInTab(`https://jx.xmflv.com/?url=${location.href}`,false);' },
  '↑→↓':{ name: 'Stop All Timers', code: '/*WITH TOP*/let start=gestureData.maxID|0; let script=document.createElement("script"); gestureData.maxID=setTimeout(Date); script.textContent=`for(let i=${start};i<${gestureData.maxID+1000};++i){clearTimeout(i);clearInterval(i);}`; document.body.appendChild(script); alert("Stopped all timers on current page");' },
  'T→↑':{ name: 'Baidu Translate', code: 'gestureData.GM_openInTab(`//fanyi.baidu.com/#auto/auto/${encodeURIComponent(gestureData.selectWords)}`,false);' },
  'T←↑':{ name: 'Youdao Translate', code: 'gestureData.GM_openInTab(`//dict.youdao.com/w/eng/${encodeURIComponent(gestureData.selectWords)}`,false);' },
  'T◆◆':{ name: 'Double-Tap Search', code: 'gestureData.GM_setClipboard(gestureData.selectWords); /* ... */ gestureData.GM_openInTab(gestureData.selectWords.trim(),false);' },
  'I↓↑●':{ name: 'Open Image', code: 'gestureData.GM_openInTab(gestureData.touchEle.src,false);' },
  'I→↑●':{ name: 'Baidu Image Search', code: 'gestureData.GM_openInTab(`//graph.baidu.com/details?image=${gestureData.touchEle.src}`,false);' },
  'V→': { name: 'Seek Forward 10s', code: 'gestureData.videoPlayer.currentTime+=10; /* ... */' },
  'V←': { name: 'Seek Backward 10s', code: 'gestureData.videoPlayer.currentTime-=10; /* ... */' },
  'V↑': { name: 'Increase Playback Speed', code: 'if(document.fullscreen){let speed=gestureData.videoPlayer.playbackRate; speed+=(speed<1.5?0.25:0.5); gestureData.videoPlayer.playbackRate=speed; /* ... */}' },
  'V↓': { name: 'Decrease Playback Speed', code: 'if(document.fullscreen){let speed=gestureData.videoPlayer.playbackRate; speed-=(speed>1.5?0.5: (speed>0.25?0.25:0)); gestureData.videoPlayer.playbackRate=speed; /* ... */}' },
  'V→●':{ name: 'Fast Forward Play', code: 'gestureData.playSpeed=gestureData.videoPlayer.playbackRate; gestureData.videoPlayer.playbackRate=10; /* ... */' },
  'V→○':{ name: 'Stop Fast Forward', code: 'gestureData.videoPlayer.playbackRate=gestureData.playSpeed; /* ... */' },
  'V←●':{ name: 'Fast Rewind Play', code: 'gestureData.videoTimer=setInterval(()=>{gestureData.videoPlayer.currentTime--;},100); /* ... */' },
  'V←○':{ name: 'Stop Fast Rewind', code: 'clearInterval(gestureData.videoTimer); /* ... */' },
  'V↑▼':{ name: 'Increase Volume', code: 'if(document.fullscreen){gestureData.videoPlayer.muted=false; /* ... */}' },
  'V↑▽':{ name: 'Stop Increasing Volume', code: 'clearInterval(gestureData.videoTimer); /* ... */' },
  'V↓▼':{ name: 'Decrease Volume', code: 'if(document.fullscreen){gestureData.videoPlayer.muted=false; /* ... */}' },
  'V↓▽':{ name: 'Stop Decreasing Volume', code: 'clearInterval(gestureData.videoTimer); /* ... */' },
  'V→▼':{ name: 'Slide Right to Seek', code: '/* ... */' },
  'V→▽':{ name: 'Stop Slide Seek', code: 'clearInterval(gestureData.videoTimer); /* ... */' },
  'V←▼':{ name: 'Slide Left to Seek', code: '/* ... */' },
  'V←▽':{ name: 'Stop Slide Seek', code: 'clearInterval(gestureData.videoTimer); /* ... */' },
  '◆◆◆':{ name: 'Toggle Picture-in-Picture', code: 'if(document.pictureInPictureElement){document.exitPictureInPicture();}else{gestureData.videoPlayer?.requestPictureInPicture();}' }
};

/* Default Settings: disable all gestures except video gestures */
gestureData.settings = {
  'Swipe Sensitivity': [0.2, 0, 0.5, 2],
  'Text Gestures': false,
  'Image Gestures': false,
  'Video Gestures': true,
  'Text Translation': false,
  'Page Acceleration': false,
  'Video Download': false,
  'Prevent Accidental Touch': false
};

// GM methods binding
gestureData.GM_setValue      = GM_setValue;
gestureData.GM_getValue      = GM_getValue;
gestureData.GM_openInTab     = GM_openInTab;
gestureData.GM_setClipboard  = GM_setClipboard;

// Load stored user data
gestureData.gesture  = gestureData.GM_getValue('gesture',  gestureData.gesture);
gestureData.settings = gestureData.GM_getValue('settings', gestureData.settings);

// ... (rest of the original implementation remains unchanged) ...

//脚本常量
const LIMIT=((screen.width>screen.height ? screen.height : screen.width)*gestureData.settings['滑动系数'][0])**2,ATTACH_SHADOW=Element.prototype.attachShadow,CANVAS_2D_DRAWIMAGE=CanvasRenderingContext2D.prototype.drawImage,
	  CHECK_M_OBSERVER=new MutationObserver(()=>{if(!checkTimer){checkTimer=setTimeout(loadCheck,200);}}),
	  IMG_I_OBSERVER=new IntersectionObserver((entries)=>{for(let Ti=0,len=entries.length;Ti<len;++Ti){if(entries[Ti].intersectionRatio){entries[Ti].target.setAttribute('_imgShow_','1');}else{entries[Ti].target.setAttribute('_imgShow_','0');}}},{threshold:[0,0.5,1]}),
	  A_I_OBSERVER=new IntersectionObserver((entries)=>{let link=null,nowTime=Date.now();for(let Ti=0,len=entries.length;Ti<len;++Ti){link=entries[Ti].target;if(entries[Ti].intersectionRatio){link.setAttribute('_linkShow_','1');if(nowTime>link._prefetch_){link._prefetch_=nowTime+300000;document.head.insertAdjacentHTML('beforeend',`<link rel="prefetch" href="${link.href.replace(/^https?:/,'')}"/>`);}}else{link.setAttribute('_linkShow_','0');}}},{rootMargin:'50%',threshold:[0,0.5,1]});

/*手势功能模块*/
//手指功能变量
let startPoint={},timeSpan=0,pressTime=0,raiseTime=0,slideTime=0,slideStamp=0,slideLimit=0,fingersNum=0,gestureTimer=0,clickTimer=0,isAllow=0,isClick=0;
//手势执行
gestureData.runCode=(code)=>{
	try{eval(code);}catch(error){
		if((error+'').indexOf('unsafe-eval')>-1){
			window.eval=(function(){
				this.gestureData=gestureData;this.close=window.close;//将数据传递给外部
				let script=document.createElement('script');
				return (js)=>{
					script.remove();script=document.createElement('script');
					script.textContent=`try{${js}}catch(error){alert(\`“${gestureData.path}” 手势执行脚本错误：\\n${error} ！\`);}`;
					document.body.insertAdjacentElement('beforeend',script);
				}
			})();eval(code);
		}else{alert(`“${gestureData.path}” 手势执行脚本错误：\n${error} ！`);}
	}
}
gestureData.runFrame=(runPath)=>{
	let code=gestureData.gesture[runPath].code;
	if(top===self || /^[TIV]/.test(runPath)){gestureData.runCode(code);}
	else{
		if(code.indexOf('/*ONLY TOP*/')<0){gestureData.runCode(code);}
		if(/\/\*(ONLY|WITH) TOP\*\//.test(code)){
			if(/[●▼]$/.test(runPath)){window._isPushing_=()=>{let _gestureData={};_gestureData.touchEnd=copyTouch(gestureData.touchEnd);top.postMessage({'type':'pushTouch','gestureData':_gestureData},'*');}}
			let _gestureData={};
			_gestureData.touchStart=copyTouch(gestureData.touchStart);
			_gestureData.touchEnd=copyTouch(gestureData.touchEnd);
			top.postMessage({'type':'runPath','runPath':gestureData.path,'gestureData':_gestureData},'*');
		}
	}
}
gestureData.runGesture=(newPath)=>{
	if(gestureData.gesture[gestureData.path]){
		gestureData.runFrame(gestureData.path);
		if(gestureData.gesture[newPath]){gestureData.path=newPath;}
	}else if(gestureData.gesture[gestureData.path.slice(1)] && /^[TIV]/.test(gestureData.path)){
		gestureData.runFrame(gestureData.path.slice(1));
		if(gestureData.gesture[newPath?.slice(1)]){gestureData.path=newPath;}
	} raiseTime=0;
}
//长按执行
function longPress(){
	if(isAllow && !/[●○▽]$/.test(gestureData.path)){
		isAllow=isClick=0;
		startPoint=gestureData.touchEnd;
		let newPath=gestureData.path+'○';gestureData.path+='●';
		gestureData.runGesture(newPath);
	}
}
//持续滑动执行
function slidingRun(){
	slideStamp=0;
	let newPath=gestureData.path+'▽';gestureData.path+='▼';
	gestureData.runGesture(newPath);
	gestureData.path=gestureData.path.replace('▼','');
}
//手指按下
function touchStart(e){
	clearTimeout(gestureTimer);
	if(fingersNum===e.touches?.length){window._isPushing_=null;if(/[○▽]$/.test(gestureData.path)){gestureData.runGesture();}}
	if((fingersNum=e.touches?.length)!==1){return;}
	pressTime=Date.now();timeSpan=pressTime-raiseTime;
	let lineLen=raiseTime && (e.changedTouches[0].screenX-gestureData.touchEnd.screenX)**2+(e.changedTouches[0].screenY-gestureData.touchEnd.screenY)**2;
	if(timeSpan>50 || lineLen>LIMIT){//断触判断
		startPoint=e.changedTouches[0];
		if(timeSpan>200 || lineLen>LIMIT*4){
			gestureData.path='';slideLimit=LIMIT;
			gestureData.touchEle=e.target;
			gestureData.touchEnd=gestureData.touchStart=startPoint;
			gestureData.selectWords=window.getSelection()+'';
			if(gestureData.selectWords && gestureData.settings['文字手势']){gestureData.path='T';}
			else if(document.contains(gestureData.videoPlayer) && gestureData.settings['视频手势']){
				let videoRect=gestureData.findVideoBox()?.getBoundingClientRect() || new DOMRect();
				if(fullsState>0 && gestureData.touchStart.clientY<(videoRect.y+videoRect.height/8)){gestureData.path='!';}
				else if(gestureData.touchStart.clientX>videoRect.x && gestureData.touchStart.clientX<(videoRect.x+videoRect.width) && gestureData.touchStart.clientY>videoRect.y && gestureData.touchStart.clientY<(videoRect.y+videoRect.height)){gestureData.path='V';}
			}
		}else if(isClick){e.preventDefault();}
		slideTime=pressTime;isAllow=isClick=1;
	}else if(isClick){clearTimeout(clickTimer);gestureData.path=gestureData.path.slice(0,-1);}
	gestureTimer=setTimeout(longPress,300+slideTime-pressTime);
}
//手指滑动
function touchMove(e){
	clearTimeout(gestureTimer);
	gestureData.touchEnd=e.changedTouches ? e.changedTouches[0] : e;
	if(window._isPushing_){setTimeout(window._isPushing_);}
	if(/[○▽]$/.test(gestureData.path) || fingersNum>1){return;}
	let xLen=(gestureData.touchEnd.screenX-startPoint.screenX)**2,yLen=(gestureData.touchEnd.screenY-startPoint.screenY)**2,
	direction=(xLen>yLen*1.42) ? ((gestureData.touchEnd.screenX>startPoint.screenX) ? '→' : '←') : ((gestureData.touchEnd.screenY>startPoint.screenY) ? '↓' : '↑'),
	nowTime=Date.now(),pathLen=xLen+yLen,lastIcon=gestureData.path?.slice(-1);
	if(pathLen>LIMIT/100){
		slideTime=nowTime;isClick=0;
		if(lastIcon===direction || pathLen>slideLimit){
			if(lastIcon!==direction && (timeSpan<50 || 'TIV◆'.indexOf(lastIcon)>-1)){gestureData.path+=direction;slideLimit*=(slideLimit<LIMIT/2) || 0.64;slideStamp=nowTime+300;isAllow=1;timeSpan=0;}
			startPoint=gestureData.touchEnd;
			if(slideStamp && nowTime>slideStamp){setTimeout(slidingRun);}
		}else if(pathLen>slideLimit/16){slideStamp=isAllow=0;}
	}
	gestureTimer=setTimeout(longPress,300+slideTime-nowTime);
}
//手指抬起
function touchEnd(e){
	clearTimeout(gestureTimer);
	if(--fingersNum>0){if(!/[○▽]$/.test(gestureData.path)){gestureData.path='!';}return;}
	window._isPushing_=null;gestureData.touchEnd=e.changedTouches[0];raiseTime=Date.now();
	if(top!==self){top.postMessage({'type':'iframeLock'},'*');}
	if(/[○▽]$/.test(gestureData.path)){setTimeout(gestureData.runGesture);return;}
	if(isClick){gestureData.path+='◆';if(!gestureData.path.indexOf('T')){e.preventDefault();window.getSelection().empty();}}
	if(isAllow){gestureTimer=setTimeout(gestureData.runGesture,199);}
}
//延迟点击，避免断触触发点击
function delayClick(e){
	if(e.isTrusted){
		e.preventDefault();e.stopImmediatePropagation();
		if(timeSpan<50){return;}
		let ev=new PointerEvent('click',{bubbles:true,cancelable:true,clientX:e.clientX,clientY:e.clientY,composed:true,detail:1,layerX:e.layerX,layerY:e.layerY,offsetX:e.offsetX,offsetY:e.offsetY,pageX:e.pageX,pageY:e.pageY,pointerId:e.pointerId,pointerType:e.pointerType,screenX:e.screenX,screenY:e.screenY,sourceCapabilities:e.sourceCapabilities,view:e.view,x:e.x,y:e.y});
		clickTimer=setTimeout(()=>{e.target.dispatchEvent(ev);},50);
	}
}

/*视频功能模块*/
//视频功能变量
let oriLock=0,resizeTimer=0,fullsState=0,iframeEles=document.getElementsByTagName('iframe'),iframeLock=null;
//videoPlayer赋值
async function setVideo(player){
	let newPlayer=player.target || player;
	if(document.contains(gestureData.videoPlayer) && newPlayer.muted){return;}
	gestureData.videoPlayer=newPlayer;
	videoOriLock();
	gestureData.videoPlayer.insertAdjacentElement('afterend',gestureData.tipBox);
	if(gestureData.settings['视频下载']){
		await gestureData.findVideoBox()?.insertAdjacentElement('beforeend',gestureData.videoPlayer._downloadTip_);
		if(window._urlObjects_[gestureData.videoPlayer.src]){
			gestureData.videoPlayer._downloadTip_.textContent='正在捕获';
			gestureData.videoPlayer._downloadTip_.buffers=window._urlObjects_[gestureData.videoPlayer.src].sourceBuffers;
			window._urlObjects_[gestureData.videoPlayer.src]._downloadTip_=gestureData.videoPlayer._downloadTip_;
			delete window._urlObjects_[gestureData.videoPlayer.src];
		}else if(gestureData.videoPlayer._downloadTip_.textContent==='未加载'){
			if(!gestureData.videoPlayer.src && gestureData.videoPlayer.children.length){gestureData.videoPlayer.src=gestureData.videoPlayer.firstChild.src;}
			if(gestureData.videoPlayer.src.indexOf('blob:') && gestureData.videoPlayer.src){gestureData.videoPlayer._downloadTip_.textContent='可下载';}
		}
	}
}
//video方向锁定
function videoOriLock(){
	if(!gestureData.videoPlayer.videoWidth){if(!gestureData.videoPlayer.error && document.contains(gestureData.videoPlayer)){setTimeout(videoOriLock,100);}oriLock=0;return;}
	oriLock=+(gestureData.videoPlayer.videoWidth>gestureData.videoPlayer.videoHeight);
	if(fullsState>0 && oriLock){top.postMessage({'type':'GYRO'},'*');}
	else{screen.orientation.unlock();}
}
//画布视频检测
CanvasRenderingContext2D.prototype.drawImage=function(){
	let ele=arguments[0];
	if(ele.nodeName==='VIDEO' && !document.contains(ele)){
		ele.style.display='none';
		this.canvas.insertAdjacentElement('afterend',ele);
	}
	return CANVAS_2D_DRAWIMAGE.call(this,...arguments);
}
//video全屏/退出全屏
gestureData.videoFullScreen=async ()=>{
	if(resizeTimer){return;}
	if(document.fullscreen){await document.exitFullscreen()?.catch(Date);}
	else if(gestureData.videoPlayer){await gestureData.findVideoBox()?.requestFullscreen()?.catch(Date);}
	else if(iframeLock){iframeLock.postMessage({'type':'fullscreen'},'*');}
}
//获取video全屏样式容器
gestureData.findVideoBox=(player=gestureData.videoPlayer)=>{
	if(!document.contains(player)){return null;}
	if(player._videoBox_?.contains(player) && (document.fullscreen || player._checkHeight_===player.clientHeight)){return player._videoBox_;}
	let parentEle=player.parentNode,childStyle=getComputedStyle(player),parentStyle=getComputedStyle(parentEle),childWidth=0,childHeight=0,parentWidth=0,parentHeight=0,cssText='';
	player.setAttribute('_videobox_','');player._checkHeight_=player.clientHeight;player._videoBox_=parentEle;
	if(player.offsetParent===player.parentNode || !player.offsetParent){
		childWidth=Math.round(player.offsetWidth+(+childStyle.marginLeft.slice(0,-2))+(+childStyle.marginRight.slice(0,-2)));
		childHeight=Math.round(player.offsetHeight+(+childStyle.marginTop.slice(0,-2))+(+childStyle.marginBottom.slice(0,-2)));
		parentWidth=Math.round(parentEle.offsetWidth+(+parentStyle.marginLeft.slice(0,-2))+(+parentStyle.marginRight.slice(0,-2)));
		parentHeight=Math.round(parentEle.offsetHeight+(+parentStyle.marginTop.slice(0,-2))+(+parentStyle.marginBottom.slice(0,-2)));
	}else{
		childWidth=Math.round(player.offsetWidth+(+childStyle.left.slice(0,-2) || 0)+(+childStyle.marginLeft.slice(0,-2))+(+childStyle.marginRight.slice(0,-2))+(+childStyle.right.slice(0,-2) || 0));
		childHeight=Math.round(player.offsetHeight+(+childStyle.top.slice(0,-2) || 0)+(+childStyle.marginTop.slice(0,-2))+(+childStyle.marginBottom.slice(0,-2))+(+childStyle.bottom.slice(0,-2) || 0));
		parentWidth=Math.round(parentEle.offsetWidth+(+parentStyle.left.slice(0,-2) || 0)+(+parentStyle.marginLeft.slice(0,-2))+(+parentStyle.marginRight.slice(0,-2))+(+parentStyle.right.slice(0,-2) || 0));
		parentHeight=Math.round(parentEle.offsetHeight+(+parentStyle.top.slice(0,-2) || 0)+(+parentStyle.marginTop.slice(0,-2))+(+parentStyle.marginBottom.slice(0,-2))+(+parentStyle.bottom.slice(0,-2) || 0));
	}
	childWidth=(childWidth>parentWidth) ? childWidth : parentWidth;
	childHeight=(childHeight>parentHeight) ? childHeight : parentHeight;
	while((childWidth>=parentEle.clientWidth || player.clientWidth*1.08>parentEle.clientWidth) && (childWidth<1.15*parentEle.clientWidth || !parentEle.clientWidth) && (childHeight<1.15*parentEle.clientHeight || !parentEle.clientHeight) && parentEle.nodeName!=='BODY'){
		if(childHeight<parentEle.clientHeight && player.clientHeight*1.08<parentEle.clientHeight){
			let isBreak=1;
			for(let childEle of parentEle.children){
				childStyle=getComputedStyle(childEle);
				childHeight=Math.round(childEle.offsetHeight+(+childStyle.top.slice(0,-2) || 0)+(+childStyle.marginTop.slice(0,-2))+(+childStyle.marginBottom.slice(0,-2))+(+childStyle.bottom.slice(0,-2) || 0));
				if(childHeight>=parentEle.clientHeight && player.clientHeight*1.15>parentEle.clientHeight){isBreak=0;break;}
			}
			if(isBreak){break;}
		}
		if(parentEle.clientHeight){
			player._videoBox_=parentEle;parentEle.setAttribute('_videobox_','');
			cssText=parentEle.style.cssText;
			if(/\s*!\s*important/.test(cssText)){
				parentEle._cssText_=cssText;
				parentEle._fullscreenCSS_=cssText.replace(/\s*!\s*important/g,'');
				parentEle.setAttribute('_videobox_','!important');
			}
			parentStyle=getComputedStyle(parentEle);
			if(parentEle.offsetParent===parentEle.parentNode || !parentEle.offsetParent){
				parentWidth=Math.round(parentEle.offsetWidth+(+parentStyle.marginLeft.slice(0,-2))+(+parentStyle.marginRight.slice(0,-2)));
				parentHeight=Math.round(parentEle.offsetHeight+(+parentStyle.marginTop.slice(0,-2))+(+parentStyle.marginBottom.slice(0,-2)));
			}else{
				parentWidth=Math.round(parentEle.offsetWidth+(+parentStyle.left.slice(0,-2) || 0)+(+parentStyle.marginLeft.slice(0,-2))+(+parentStyle.marginRight.slice(0,-2))+(+parentStyle.right.slice(0,-2) || 0));
				parentHeight=Math.round(parentEle.offsetHeight+(+parentStyle.top.slice(0,-2) || 0)+(+parentStyle.marginTop.slice(0,-2))+(+parentStyle.marginBottom.slice(0,-2))+(+parentStyle.bottom.slice(0,-2) || 0));
			}
			childWidth=(childWidth>parentWidth) ? childWidth : parentWidth;
			childHeight=(childHeight>parentHeight) ? childHeight : parentHeight;
		}
		parentEle=parentEle.parentNode;
	}
	player._videoBox_.setAttribute('_videobox_',`${player._videoBox_.getAttribute('_videobox_') || ''} outer`.trim());
	return player._videoBox_;
}
//全屏检测事件
function regRESIZE(){
	let videoCss=gestureData.addStyle(''),allowResize=()=>{resizeTimer=0;},findImportant=null;
	window.addEventListener('resize',()=>{
		if(document.fullscreen && !fullsState){
			resizeTimer=setTimeout(allowResize,400);
			fullsState=document.fullscreenElement;
			if(fullsState.nodeName==='IFRAME'){fullsState=-1;return;}
			let srcFindVideo=fullsState.getElementsByTagName('video'),srcVideo=(fullsState.nodeName==='VIDEO') ? fullsState : srcFindVideo[0];
			if(!fullsState.hasAttribute('_videobox_') && (!srcVideo || srcFindVideo.length>1 || srcVideo._videoBox_.offsetWidth*srcVideo._videoBox_.offsetHeight*1.2<fullsState.offsetWidth*fullsState.offsetHeight)){fullsState=-1;return;}
			if(srcVideo!==gestureData.videoPlayer){gestureData.videoPlayer?.pause();setVideo(srcVideo);}
			findImportant=fullsState.parentNode.querySelectorAll('*[_videobox_*="!important"]');
			fullsState=1;if(oriLock){top.postMessage({'type':'GYRO'},'*');}
			videoCss.textContent='*[_videobox_]{inset:0 !important;margin:0 !important;padding:0 !important;width:100% !important;height:100% !important;max-width:100% !important;max-height:100% !important;}video{position:absolute;transform:none !important;object-fit:contain !important;}';
			findImportant.forEach((ele)=>{ele.style.cssText=ele._fullscreenCSS_;});
		}else if(fullsState && !document.fullscreen){
			resizeTimer=setTimeout(allowResize,400);
			fullsState=0;videoCss.textContent='';
			findImportant.forEach((ele)=>{ele.style.cssText=ele._cssText_;});
		}
	},true);
}

/*视频下载模块*/
if(gestureData.settings['视频下载']){
	//原始方法存储
	const CREATE_OBJ_URL=URL.createObjectURL,ADD_SOURCE_BUFFER=MediaSource.prototype.addSourceBuffer,APPEND_BUFFER=SourceBuffer.prototype.appendBuffer,END_OF_STREAM=MediaSource.prototype.endOfStream;
	//初始化视频下载
	window._initDownload_=(player)=>{
		player._downloadTip_=document.createElement('div');
		player._downloadTip_.style.cssText='position:absolute;right:0;top:20px;background:#3498db;border-radius:20px 0 0 20px;text-align:center;padding:20px;line-height:0px;color:#fff;min-width:60px;font-size:16px;font-family:system-ui;z-index:2147483647;';
		player._downloadTip_.target=player;
		player._downloadTip_.textContent='未加载';
		if(window._urlObjects_[player.src]){
			player._downloadTip_.textContent='正在捕获';
			player._downloadTip_.buffers=window._urlObjects_[player.src].sourceBuffers;
			window._urlObjects_[player.src]._downloadTip_=player._downloadTip_;
			delete window._urlObjects_[player.src];
		}else{
			if(!player.src && player.children.length){player.src=player.firstChild.src;}
			if(player.src.indexOf('blob:') && player.src){player._downloadTip_.textContent='可下载';}
		}
		player._downloadTip_.addEventListener('click',window._downloadVideo_,true);
		player._videoBox_.insertAdjacentElement('beforeend',player._downloadTip_);
	}
	//下载视频
	window._downloadVideo_=function(data){
		if(this.textContent==='未加载'){return;}
		if(data.target){data=this;data.src=this.target.src;}
		let buffers=data.buffers;
		if(top!==self){
			let _buffers=[];
			for(let Ti=0,len=buffers.length;Ti<len;++Ti){
				_buffers.push({'mime':buffers[Ti]._mime_,'bufferList':buffers[Ti]._bufferList_});
			}
			top.postMessage({'type':'download','buffers':_buffers,'src':data.src},'*');
			return;
		}
		let a=document.createElement('a');a.download=document.title;a.style.display='none';document.body.insertAdjacentElement('beforeend',a);
		if(data.src.indexOf('blob:') && data.src){a.href=data.src;a.click();}
		else if(buffers.length){
			for(let Ti=0,len=buffers.length;Ti<len;++Ti){
				a.href=URL.createObjectURL(new Blob(buffers[Ti]._bufferList_,{'type':buffers[Ti]._mime_}));
				a.click();
				URL.revokeObjectURL(a.href);
			}
		}
		a.remove();
	}
	//存储MediaSource
	window._urlObjects_={};
	URL.createObjectURL=(obj)=>{
		let url=CREATE_OBJ_URL(obj);
		if(obj.sourceBuffers){window._urlObjects_[url]=obj;}
		return url;
	}
	//添加捕获
	MediaSource.prototype.addSourceBuffer=function(mime){
		let sourceBuffer=ADD_SOURCE_BUFFER.call(this,mime);
		sourceBuffer._bufferList_=[];
		sourceBuffer._mime_=mime;
		sourceBuffer._mediaSource_=this;
		return sourceBuffer;
	}
	//捕获片段
	SourceBuffer.prototype.appendBuffer=function(buffer){
		this._bufferList_.push(buffer);
		if(this._mime_.indexOf('video')>-1 && this._mediaSource_._downloadTip_){this._mediaSource_._downloadTip_.textContent=`已捕获${this._bufferList_.length}个片段`;}
		APPEND_BUFFER.call(this,buffer);
	}
	//捕获完成
	MediaSource.prototype.endOfStream=function(){
		if(this._downloadTip_){this._downloadTip_.textContent='可下载';}
		END_OF_STREAM.call(this);
	}
}

/*选词翻译模块*/
if(gestureData.settings['选词翻译']){
	//选词翻译变量
	let selectTimer=0,translateBox=null;
	//语言检测
	function detectLanguage(text){
		//中文检测（包含扩展汉字）
		let chineseRegex=/[\u4E00-\u9FFF\u3400-\u4DBF\u{20000}-\u{2EBEF}]/u;
		if(chineseRegex.test(text)) return 'zh-CN';
		// 常见语言字符检测
		let japaneseRegex=/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/,
			koreanRegex=/[\uAC00-\uD7AF]/,
			cyrillicRegex=/[\u0400-\u04FF]/,
			arabicRegex=/[\u0600-\u06FF]/;
		if(japaneseRegex.test(text)) return 'ja';//日语
		if(koreanRegex.test(text)) return 'ko';//韩语
		if(cyrillicRegex.test(text)) return 'ru';//俄语
		if(arabicRegex.test(text)) return 'ar';//阿拉伯语
		//默认英语（适用于拉丁字母）
		return 'en';
	}
	// 翻译函数
	function translateText(text){
		let sourceLang=detectLanguage(text),targetLang=sourceLang==='zh-CN' ? 'en' : 'zh-CN';
		return fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`)
			.then(response=>{
				if(!response.ok){throw new Error('网络请求失败！');}
				return response.json();
			}).then(result=>{
				return result.responseStatus===200 ? result.responseData.translatedText : '糟糕X﹏X，翻译失败了！';
			}).catch(()=>{
				return '糟糕X﹏X，翻译失败了！';
			});
	}
	//处理文本选择
	function handleSelection(){
		clearTimeout(selectTimer);
		if(!translateBox){
			translateBox=document.createElement('div');
			translateBox.style.cssText='position:fixed;transform:translateX(-25%);max-width:80%;padding:15px 25px;background:#1e1e1e;border-radius:8px;font-size:16px;font-family:system-ui;color:#fff;z-index:2147483647;border:2px solid #eee;display:none;align-items:center;';
			document.body.insertAdjacentElement('beforeend',translateBox);
			translateBox.addEventListener('touchstart',function(){gestureData.GM_setClipboard(this.textContent);alert('翻译复制成功！');},true);
		}
		let selection=window.getSelection().toString().trim();
		if(!selection){translateBox.style.display='none';return;}
		selectTimer=setTimeout(async ()=>{
			if(!window.getSelection().toString().trim()){translateBox.style.display='none';return;}
			else if(selection!==window.getSelection().toString().trim()){setTimeout(handleSelection);return;}
			translateBox.textContent=await translateText(selection);
			if(!window.getSelection().toString().trim()){translateBox.style.display='none';return;}
			translateBox.style.left=gestureData.touchEnd.clientX+'px';
			translateBox.style.top=Math.min(gestureData.touchEnd.clientY+screen.width*.05,window.innerHeight-screen.width*.2)+'px';
			if(gestureData.touchEnd.clientX<screen.width*.2){translateBox.style.transform='translateX(-10%)';}
			else if(gestureData.touchEnd.clientX>window.innerWidth-screen.width*.2){translateBox.style.left=gestureData.touchEnd.clientX-screen.width*.2+'px';translateBox.style.transform='none';}
			else{translateBox.style.transform='translateX(-25%)';}
			translateBox.style.display='flex';
		},1000)
	}
	//选词翻译事件注册
	document.addEventListener('selectionchange',handleSelection,true);
}

/*功能补充模块*/
//功能补充变量
let videoEles=[],imgEles=[],linkEles=[],checkTimer=0;

//修改Trusted-Types策略
window.trustedTypes?.createPolicy('default',{createHTML:string=>string,createScript:string=>string,createScriptURL:string=>string});
//设置shadow-root (open)
Element.prototype.attachShadow=function(){
	if(!gestureData.shadowList){gestureData.shadowList=[];}
	let shadowRoot=ATTACH_SHADOW.call(this,...arguments);
	gestureData.shadowList.push(shadowRoot);
	CHECK_M_OBSERVER.observe(shadowRoot,{childList:true,subtree:true});
	return shadowRoot;
}
//页面加载检测
async function loadCheck(){
	linkEles=[...document.querySelectorAll('a:not([_linkShow_])')];
	videoEles=[...document.querySelectorAll('video:not([_videoBox_])')];
	imgEles=[...document.querySelectorAll('img:not([_imgShow_]),[style*="url("]:not([_imgShow_])')];
	//检测shadow-root
	if(gestureData.shadowList){
		for(let Ti=0,len=gestureData.shadowList.length;Ti<len;++Ti){
			linkEles.push(...gestureData.shadowList[Ti].querySelectorAll('a:not([_linkShow_])'));
			videoEles.push(...gestureData.shadowList[Ti].querySelectorAll('video:not([_videoBox_])'));
			imgEles.push(...gestureData.shadowList[Ti].querySelectorAll('img:not([_imgShow_]),[style*="url("]:not([_imgShow_])'));
		}
	}
	//video播放事件绑定
	if(videoEles.length && gestureData.settings['视频手势']){
		if(!gestureData.tipBox){
			//启动全屏检测
			regRESIZE();
			if(top!==self){top.postMessage({'type':'forceFullScreen'},'*');}
			//tip操作提示
			gestureData.tipBox=document.createElement('div');
			gestureData.tipBox.style.cssText='display:inline-flex;flex-wrap:wrap;text-align:center;justify-content:center;align-items:center;visibility:hidden;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);min-width:80px;min-height:30px;padding:10px;color:#1e87f0;font-size:22px;background-color:rgba(0,0,0,0.6);border-radius:999px;font-family:system-ui;z-index:2147483647;';
		}
		for(let Ti=0,len=videoEles.length;Ti<len;++Ti){
			if(!videoEles[Ti]._videoBox_){
				await gestureData.findVideoBox(videoEles[Ti]);
				if(gestureData.settings['视频下载']){await window._initDownload_(videoEles[Ti]);}
				if(!videoEles[Ti].paused){
					setVideo(videoEles[Ti]);
					if(top!==self){top.postMessage({'type':'iframeLock'},'*');}
				}
				videoEles[Ti].addEventListener('playing',setVideo,true);
				videoEles[Ti].addEventListener('volumechange',setVideo,true);
				videoEles[Ti].addEventListener('contextmenu',(e)=>{e.preventDefault();},true);//禁止视频默认菜单
			}
		}
	}
	//图片可视事件绑定
	if(gestureData.settings['图片手势']){
		for(let Ti=0,len=imgEles.length;Ti<len;++Ti){
			imgEles[Ti].setAttribute('_imgShow_','0');
			IMG_I_OBSERVER.observe(imgEles[Ti]);
		}
	}
	//链接预加载绑定
	if(gestureData.settings['网页加速']){
		for(let Ti=0,len=linkEles.length;Ti<len;++Ti){
			linkEles[Ti].setAttribute('_linkShow_','0');
			if(linkEles[Ti].href.indexOf('/')>-1){
				linkEles[Ti]._prefetch_=0;
				A_I_OBSERVER.observe(linkEles[Ti]);
				linkEles[Ti].addEventListener('click',function(){this._prefetch_=0;},true);
			}
		}
	}
	if(!document.documentElement._regEvent_){regEvent();}
	checkTimer=0;
}
//添加样式表
gestureData.addStyle=(css)=>{
	let style=document.createElement('style');
	style.textContent=css;
	if(document.head){
		document.head.insertAdjacentElement('beforeend',style);
		return style;
	}else{setTimeout(()=>{gestureData.addStyle(css)});}
}
//复制坐标对象
function copyTouch(oldObj){
	let newObj={};
	for(let Ti in oldObj){
		if(Ti==='target'){continue;}
		newObj[Ti]=oldObj[Ti];
	}
	return newObj;
}
//手势功能设置UI
gestureData.openSet=()=>{
	let gestureName='',gesturePath='',gestureBox=document.createElement('div'),pathEle=null,_clickTimer=0;
	//页面生成
	gestureData.addStyle('*{overflow:hidden !important;}'+
				'#_gestureBox_{background-color:#fff;width:100%;height:100%;position:fixed;padding:0;margin:0;inset:0;overflow-y:auto !important;z-index:2147483647;}'+
				'#_gestureBox_ *{font-family:system-ui;margin:0;padding:0;text-align:center;font-size:5vmin;line-height:12vmin;user-select:none !important;transform:none;text-indent:0;}'+
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
				'#_gestureBox_ #_settingsBox_ #_saveSettings_{display:block;clear:both;width:30vmin;height:15vmin;font-size:7.5vmin;line-height:15vmin;color:#fff;background-color:#2866bd;border:none;margin:12vmin 0 0 calc(50% - 15vmin);float:left;}');
	gestureBox.id='_gestureBox_';
	document.body.insertAdjacentElement('beforeend',gestureBox);
	gestureBox.innerHTML='<h1 id="_openSettings_">手势轨迹设置</h1><div id="_addGesture_">+</div><div id="_gestureUL_"></div>'+
					'<div id="_revisePath_"><span style="top:0;left:0;text-align:left;">┌</span><span style="top:0;right:0;text-align:right;">┐</span><span style="bottom:0;left:0;text-align:left;">└</span><span style="bottom:0;right:0;text-align:right;">┘</span>'+
					'<p>请滑动手指</p><p id="_path_"></p><div id="_clearPath_" style="left:10%;">清除</div><div id="_cancleRevise_" style="right:10%;">保存</div></div>'+
					'<div id="_editGesture_"><p>手势名称：</p><input type="text" id="_gestureName_" maxlength="12" placeholder="最大输入12个字符">'+
					'<p>手势类型：</p><div class="_label_box_"><label><input type="radio" id="_G_" name="_gestureType_" value=""><div>一般</div></label><label><input type="radio" id="_T_" name="_gestureType_" value="T"><div>文字</div></label><label><input type="radio" id="_I_" name="_gestureType_" value="I"><div>图片</div></label><label><input type="radio" id="_V_" name="_gestureType_" value="V"><div>视频</div></label></div>'+
					'<p>手势执行脚本：</p><textarea id="_gestureCode_" placeholder="可用变量说明↓\n 	gestureData：手势数据常量,如果你需要在不同手势间传递变量,你可以赋值gestureData.变量名=变量值；\n	gestureData.touchEle：手指触摸的源元素；\n	gestureData.selectWords：选中的文字；\n	gestureData.touchStart：触摸开始坐标对象；\n	gestureData.touchEnd：触摸最新坐标对象；\n	gestureData.path：滑动的路径；\n	gestureData.videoPlayer：正在播放的视频元素。'+
					'\n\n可用方法说明↓\n	gestureData.addStyle(CSS样式)：将CSS样式添加到网页上；\n	gestureData.runGesture()：以path为路径执行手势,你可以修改path后执行此方法；\n	gestureData.GM_openInTab(链接)：打开链接；\n	gestureData.GM_setClipboard(文本)：复制文本到剪切板；\n	gestureData.GM_setValue(变量名,变量值)：在油猴中存储数据；\n	gestureData.GM_getValue(变量名,默认值)：从油猴中取出数据,没有则使用默认值。'+
					'\n\n可识别代码注释说明(仅对一般手势生效)↓\n	默认情况：存在iframe时，所有手势只会在触发手势的页面对象执行！\n 	添加/*ONLY TOP*/：手势只在顶级页面对象执行；\n	添加/*WITH TOP*/：手势同时在当前页面对象和顶级页面对象执行。"></textarea>'+
					'<div style="width:100%;height:0.3vmin;"></div><button id="_saveGesture_">保存</button><button id="_closeEdit_">关闭</button></div>'+
					'<div id="_settingsBox_"><h1>功能开关设置</h1><span id="_settingList_"></span><button id="_saveSettings_">保存</button></div>';
	pathEle=document.getElementById('_path_');

	//编辑手势
	function editGesture(){
		gestureName=this.parentNode.getAttribute('name');
		if(['打开设置','视频全屏','手势穿透'].indexOf(gestureName)>-1){alert('该手势脚本无法修改！');return;}
		gesturePath=this.parentNode.getAttribute('path');
		let selectType=(/^[TIV]/.test(gesturePath)) ? `_${gesturePath.slice(0,1)}_` : '_G_';
		document.getElementById(selectType).click();
		document.getElementById('_gestureName_').value=gestureName;
		document.getElementById('_gestureCode_').value=gestureData.gesture[gesturePath].code;
		document.getElementById('_editGesture_').style.display='block';
	}
	//修改路径
	function revisePath(){
		gestureName=this.parentNode.getAttribute('name');
		gesturePath=this.parentNode.getAttribute('path');
		pathEle.textContent='';
		window.removeEventListener('touchmove',touchMove,true);
		window.removeEventListener('pointermove',touchMove,true);
		document.getElementById('_revisePath_').style.display='block';
	}
	//删除手势
	function delGesture(){
		gestureName=this.parentNode.getAttribute('name');
		if(['打开设置','视频全屏','手势穿透'].indexOf(gestureName)>-1){alert('该手势无法删除！');return;}
		if(!confirm(`确定删除"${gestureName}"手势`)){return;}
		gesturePath=this.parentNode.getAttribute('path');
		delete gestureData.gesture[gesturePath];
		gestureData.GM_setValue('gesture',gestureData.gesture);
		init();
	}
	//滑动条
	function silideBar(e){
		e.preventDefault();fingersNum=2;
		let diffX=e.changedTouches[0].clientX-gestureData.touchStart.clientX,
		leftPX=(+this.style.left.slice(0,-2))+diffX,vmin=this.offsetWidth/2,setArr=gestureData.settings[this.id];
		leftPX=(leftPX<-vmin) ? -vmin : ((leftPX>(diffX=this.parentNode.offsetWidth-vmin)) ? diffX : leftPX);
		this.style.left=leftPX+'px';
		this.textContent=((leftPX+vmin)/this.parentNode.offsetWidth*(setArr[2]-setArr[1])+setArr[1]).toFixed(setArr[3]);
		gestureData.touchStart=e.changedTouches[0];
	}
	//长按执行
	function _longPress(){if(isClick || !/^$|[●○▼▽]$/.test(pathEle.textContent)){isClick=0;startPoint=gestureData.touchEnd;pathEle.textContent+='●';}}
	//持续滑动执行
	function _slidingRun(){slideStamp=0;pathEle.textContent+='▼';}
	//点击执行
	function _clickRun(){if(!/[○▼▽]$/.test(pathEle.textContent)){pathEle.textContent+='◆';}}
	//界面初始化
	function init(){
		let gestureUL=document.getElementById('_gestureUL_');
		gestureUL.textContent='';
		for(let Ti in gestureData.gesture){
			let gestureLi=document.createElement('div'),nameEle=document.createElement('p'),pathEle=document.createElement('div'),delEle=document.createElement('div');
			gestureLi.className='_gestureLi_';gestureLi.setAttribute('name',gestureData.gesture[Ti].name);gestureLi.setAttribute('path',Ti);
			nameEle.textContent=gestureData.gesture[Ti].name;nameEle.addEventListener('click',editGesture,true);
			pathEle.className='_gesturePath_';pathEle.textContent=Ti;pathEle.addEventListener('click',revisePath,true);
			delEle.className='_delGesture_';delEle.textContent='删除';delEle.addEventListener('click',delGesture,true);
			gestureLi.insertAdjacentElement('beforeend',nameEle);
			gestureLi.insertAdjacentElement('beforeend',pathEle);
			gestureLi.insertAdjacentElement('beforeend',delEle);
			gestureUL.insertAdjacentElement('beforeend',gestureLi);
		}
	}
	init();

	//.新建手势
	document.getElementById('_addGesture_').addEventListener('click',()=>{
		gestureName=gesturePath='';
		document.getElementById('_G_').click();
		document.getElementById('_gestureName_').value='';
		document.getElementById('_gestureCode_').value='';
		document.getElementById('_editGesture_').style.display='block';
	},true);
	//保存手势
	document.getElementById('_saveGesture_').addEventListener('click',()=>{
		let name=document.getElementById('_gestureName_').value;
		if(!name){alert('请输入手势名称！');return;}
		if(document.querySelector(`#_gestureBox_ ._gestureLi_[name="${name}"]:not([path="${gesturePath}"])`)){alert('存在同名手势！');return;}
		let typeEle=document.getElementsByName('_gestureType_');
		for(let Ti=0,len=typeEle.length;Ti<len;++Ti){
			if(typeEle[Ti].checked){
				let newPath=typeEle[Ti].value+((gestureName && gesturePath.indexOf('[')<0) ? ((/^[TIV]/.test(gesturePath)) ? gesturePath.slice(1) : gesturePath) : (`[${name}]`));
				if(newPath!==gesturePath){
					if(gestureData.gesture[newPath]){
						let pathTXT=typeEle[Ti].value+`[${gestureData.gesture[newPath].name}]`;
						gestureData.gesture[pathTXT]=gestureData.gesture[newPath];
					}
					gestureData.gesture[newPath]=gestureData.gesture[gesturePath] || {};
					delete gestureData.gesture[gesturePath];
				}
				gestureData.gesture[newPath].name=name;
				gestureData.gesture[newPath].code=document.getElementById('_gestureCode_').value;
				break;
			}
		}
		gestureData.GM_setValue('gesture',gestureData.gesture);
		init();
		document.getElementById('_editGesture_').style.display='none';
	},true);
	//关闭编辑
	document.getElementById('_closeEdit_').addEventListener('click',()=>{
		document.getElementById('_editGesture_').style.display='none';
	},true);
	//路径修改事件
	document.getElementById('_revisePath_').addEventListener('touchstart',()=>{
		if(fingersNum>1){return;}
		clearTimeout(gestureTimer);clearTimeout(_clickTimer);
		gestureTimer=setTimeout(_longPress,300+slideTime-pressTime);
	},true);
	document.getElementById('_revisePath_').addEventListener('touchmove',(e)=>{
		e.preventDefault();clearTimeout(gestureTimer);
		gestureData.touchEnd=e.changedTouches[0];
		if(/[○▼▽]$/.test(pathEle.textContent) || fingersNum>1){return;}
		let xLen=(gestureData.touchEnd.screenX-startPoint.screenX)**2,yLen=(gestureData.touchEnd.screenY-startPoint.screenY)**2,
		direction=(xLen>yLen) ? ((gestureData.touchEnd.screenX>startPoint.screenX) ? '→' : '←') : ((gestureData.touchEnd.screenY>startPoint.screenY) ? '↓' : '↑'),
		nowTime=Date.now(),pathLen=xLen+yLen,lastIcon=pathEle.textContent.slice(-1);
		if(pathLen>LIMIT/100){
			slideTime=nowTime;isClick=0;
			if(lastIcon===direction || pathLen>LIMIT){
				if(lastIcon!==direction){pathEle.textContent+=direction;slideStamp=nowTime+300;}
				startPoint=gestureData.touchEnd;
				if(slideStamp && nowTime>slideStamp){_slidingRun();}
			}else if(pathLen>LIMIT/16){slideStamp=0;}
		}
		gestureTimer=setTimeout(_longPress,300+slideTime-nowTime);
	},true);
	document.getElementById('_revisePath_').addEventListener('touchend',(e)=>{
		if(!isClick || fingersNum>0){return;}
		if(gestureData.path.indexOf('◆◆')>-1){gestureData.path='';
			switch(pathEle.textContent.slice(-1)){
				case '●':{pathEle.textContent=pathEle.textContent.slice(0,-1)+'○';break;}
				case '○':{pathEle.textContent=pathEle.textContent.slice(0,-1)+'●';break;}
				case '▼':{pathEle.textContent=pathEle.textContent.slice(0,-1)+'▽';break;}
				case '▽':{pathEle.textContent=pathEle.textContent.slice(0,-1)+'▼';break;}
				default:{pathEle.textContent+='◆';setTimeout(_clickRun,100);break;}
			}
		}else{_clickTimer=setTimeout(_clickRun,200);}
	});
	//清除路径
	document.getElementById('_clearPath_').addEventListener('touchend',(e)=>{
		e.stopPropagation();
		if(!isClick || fingersNum>0){return;}
		if(gestureData.path.indexOf('◆◆')>-1){gestureData.path='';pathEle.textContent='';}
		else{pathEle.textContent=pathEle.textContent.slice(0,-1);}
	});
	//保存修改路径
	document.getElementById('_cancleRevise_').addEventListener('touchend',(e)=>{
		e.preventDefault();e.stopPropagation();
		if(!isClick || fingersNum>0){return;}
		if(pathEle.textContent){
			if(gestureName==='视频全屏' && pathEle.textContent.slice(-1)!=='◆'){alert('视频全屏需要以◆结尾！');return;}
			if(gestureData.gesture[pathEle.textContent]?.name==='手势穿透'){alert('路径与"手势穿透"功能冲突！');return;}
			if(/^[TIV]/.test(gesturePath)){pathEle.textContent=gesturePath.slice(0,1)+pathEle.textContent;}
			if(gestureData.gesture[pathEle.textContent]){
				let pathTXT=((/^[TIV]/.test(gesturePath)) ? gesturePath.slice(0,1) : '')+`[${gestureData.gesture[pathEle.textContent].name}]`;
				gestureData.gesture[pathTXT]=gestureData.gesture[pathEle.textContent];
			}
			gestureData.gesture[pathEle.textContent]=gestureData.gesture[gesturePath];
			delete gestureData.gesture[gesturePath];
			gestureData.GM_setValue('gesture',gestureData.gesture);
			init();
		}
		window.addEventListener('touchmove',touchMove,{capture:true,passive:true});
		window.addEventListener('pointermove',touchMove,{capture:true,passive:true});
		document.getElementById('_revisePath_').style.display='none';
	});
	//打开功能开关设置
	document.getElementById('_openSettings_').addEventListener('click',()=>{
		gestureBox.style.cssText='overflow-y:hidden !important';
		document.getElementById('_settingsBox_').style.display='block';
		let settingList=document.getElementById('_settingList_');
		settingList.textContent='';
		for(let Ti in gestureData.settings){
			settingList.innerHTML+=`<p>${Ti}：</p>`;
			if(typeof(gestureData.settings[Ti])==='boolean'){
				settingList.innerHTML+=`<label class="_switch_"><input type="checkbox" id="${Ti}" ${((gestureData.settings[Ti]) ? 'checked' : '')}><div class="_slider_"></div></label>`;
			}else if(typeof(gestureData.settings[Ti])==='object'){
				settingList.innerHTML+=`<div class="_slideRail_"><div class="_slideButton_" id="${Ti}"></div></div>`;
				let slideButton=document.getElementById(Ti),
				leftPX=slideButton.parentNode.offsetWidth*(gestureData.settings[Ti][0]-gestureData.settings[Ti][1])/(gestureData.settings[Ti][2]-gestureData.settings[Ti][1])-slideButton.offsetWidth/2;
				slideButton.style.left=leftPX+'px';
				slideButton.textContent=gestureData.settings[Ti][0].toFixed(gestureData.settings[Ti][3]);
			}
		}
		let slideList=document.getElementsByClassName('_slideButton_');
		for(let Ti=0,len=slideList.length;Ti<len;++Ti){
			slideList[Ti].addEventListener('touchmove',silideBar,true);
		}
	},true);
	//保存功能开关设置
	document.getElementById('_saveSettings_').addEventListener('click',()=>{
		gestureBox.style.cssText='';
		for(let Ti in gestureData.settings){
			if(typeof(gestureData.settings[Ti])==='boolean'){
				gestureData.settings[Ti]=document.getElementById(Ti).checked;
			}else if(typeof(gestureData.settings[Ti])==='object'){
				gestureData.settings[Ti][0]=+document.getElementById(Ti).textContent;
			}
		}
		gestureData.GM_setValue('settings',gestureData.settings);
		document.getElementById('_settingsBox_').style.display='none';
	},true);
}

/*事件注册模块*/
function regEvent(){
	if(top===self){
		//清除后退定时器
		window.addEventListener('popstate',()=>{clearTimeout(gestureData.backTimer);gestureData.backTimer=0;},true);
		window.addEventListener('beforeunload',()=>{clearTimeout(gestureData.backTimer);gestureData.backTimer=0;},true);
		//接收iframe数据
		window.addEventListener('message',async (e)=>{
			let data=e.data;
			switch(data.type){
				case 'iframeLock':{//iframe锁定
					iframeLock=e.source;
				break;}
				case 'GYRO':{//锁定横屏模式
					await screen.orientation.lock('landscape')?.catch(Date);
				break;}
				case 'forceFullScreen':{//iframe强制可全屏
					for(let Ti=0,len=iframeEles.length;Ti<len;++Ti){
						if(iframeEles[Ti].contentWindow===e.source){
							if(!iframeEles[Ti].allowFullscreen){
								iframeEles[Ti].allowFullscreen=true;
								if(iframeEles[Ti].getAttribute('src') && iframeEles[Ti].src.indexOf('/')>-1){
									iframeEles[Ti].src=iframeEles[Ti].src;
								}
							}
							break;
						}
					}
				break;}
				case 'runPath':{//iframe手势在顶级页面执行
					for(let Ti=0,len=iframeEles.length;Ti<len;++Ti){
						if(iframeEles[Ti].contentWindow===e.source){
							let ifrRect=iframeEles[Ti].getBoundingClientRect();
							gestureData.touchStart=data.gestureData.touchStart;gestureData.touchEnd=data.gestureData.touchEnd;
							gestureData.touchStart.target=gestureData.touchEnd.target=gestureData.touchEle=iframeEles[Ti];
							gestureData.touchStart.pageX=gestureData.touchStart.clientX+=ifrRect.x;
							gestureData.touchStart.pageY=gestureData.touchStart.clientY+=ifrRect.y;
							gestureData.touchEnd.pageX=gestureData.touchEnd.clientX+=ifrRect.x;
							gestureData.touchEnd.pageY=gestureData.touchEnd.clientY+=ifrRect.y;
							break;
						}
					}
					gestureData.path=data.runPath;setTimeout(gestureData.runGesture);
				break;}
				case 'pushTouch':{//iframe手势坐标传递
					let ifrRect=gestureData.touchEle.getBoundingClientRect();
					gestureData.touchEnd=data.gestureData.touchEnd;
					gestureData.touchEnd.target=gestureData.touchEle;
					gestureData.touchEnd.pageX=gestureData.touchEnd.clientX+=ifrRect.x;
					gestureData.touchEnd.pageY=gestureData.touchEnd.clientY+=ifrRect.y;
				break;}
				case 'download':{//iframe视频下载
					window._downloadVideo_(data);
				break;}
			}
		},true);
	}else{
		//接收top数据
		window.addEventListener('message',async (e)=>{
			let data=e.data;
			switch(data.type){
				case 'fullscreen':{//iframe视频全屏
					await gestureData.findVideoBox()?.requestFullscreen()?.catch(Date);
				break;}
			}
		},true);
	}
	//手势事件注册
	window.addEventListener('touchstart',touchStart,{capture:true,passive:false});
	window.addEventListener('pointermove',touchMove,{capture:true,passive:true});
	window.addEventListener('touchmove',touchMove,{capture:true,passive:true});
	window.addEventListener('touchend',touchEnd,{capture:true,passive:false});
	window.addEventListener('touchcancel',touchEnd,{capture:true,passive:false});
	if(gestureData.settings['图片手势']){window.addEventListener('contextmenu',(e)=>{if((gestureData.path.indexOf("I")>-1 || e.target.nodeName==='IMG') && gestureData.touchEle.src!==location.href){e.preventDefault();}},true);}//长按图片时禁止弹出菜单
	if(gestureData.settings['避免断触']){window.addEventListener('click',delayClick,true);}
	//禁止网页检测焦点
	window.addEventListener('visibilitychange',(e)=>{e.stopImmediatePropagation();//禁止页面切换检测
		if(document.hidden){//视频后台播放
			let playState=gestureData.videoPlayer?.paused,playTime=gestureData.videoPlayer?.currentTime+0.2,playSpeed=gestureData.videoPlayer?.playbackRate,playVolume=gestureData.videoPlayer?.volume;
			setTimeout(()=>{if(playState!==gestureData.videoPlayer?.paused){
				gestureData.videoPlayer.load();gestureData.videoPlayer.currentTime=playTime;
				gestureData.videoPlayer.addEventListener('loadstart',()=>{gestureData.videoPlayer.play();gestureData.videoPlayer.playbackRate=playSpeed;gestureData.videoPlayer.volume=playVolume;},true);
			}});
		}else if(gestureData.settings['网页加速']){//更新预加载链接
			let links=[...document.querySelectorAll('a[_linkShow_="1"]')],nowTime=Date.now();
			if(gestureData.shadowList){
				for(let Ti=0,len=gestureData.shadowList.length;Ti<len;++Ti){
					links.push(...gestureData.shadowList[Ti].querySelectorAll('a[_linkShow_="1"]'));
				}
			}
			for(let Ti=0,len=links.length;Ti<len;++Ti){
				if(nowTime>links[Ti]._prefetch_){
					links[Ti]._prefetch_=Date.now()+300000;
					document.head.insertAdjacentHTML('beforeend',`<link rel="prefetch" href="${links[Ti].href.replace(/^https?:/,'')}"/>`);
				}
			}
		}
	},true);
	window.addEventListener('pagehide',(e)=>{e.stopImmediatePropagation();},true);
	window.addEventListener('blur',(e)=>{e.stopImmediatePropagation();});
	//禁止修改复制内容
	window.addEventListener('beforecopy',(e)=>{e.stopImmediatePropagation();},true);
	window.addEventListener('copy',(e)=>{if(gestureData.selectWords){return;}e.stopImmediatePropagation();},true);
	//禁止网页写入剪切板
	document.execCommand=()=>{};
	if(navigator.clipboard){navigator.clipboard.writeText=()=>{};navigator.clipboard.write=()=>{};}
	//解除选中限制
	gestureData.addStyle('html,html *{user-select:auto !important;touch-action:manipulation;overscroll-behavior-x:none !important;}');
	window.addEventListener('selectstart',(e)=>{e.stopImmediatePropagation();},true);
	//预取+预渲染，高版本内核才支持speculationrules推测规则api
	if(gestureData.settings['网页加速'] && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')){
		let specScript=document.createElement('script'),
		specRules={
			'prerender':[{
				'source':'document',
				'where':{'and':[{'selector_matches':'a[_linkShow_="1"]'}]},
				'referrer_policy':'strict-origin-when-cross-origin',
				'eagerness':'immediate'
			}],
			'prefetch':[{
				'source':'document',
				'where':{'and':[{'selector_matches':'a[_linkShow_="1"]'}]},
				'referrer_policy':'strict-origin-when-cross-origin',
				'eagerness':'immediate'
			}],
			'prefetch_with_subresources':[{
				'source':'document',
				'where':{'and':[{'selector_matches':'a[_linkShow_="1"]'}]},
				'referrer_policy':'strict-origin-when-cross-origin',
				'eagerness':'immediate'
			}]
		};
		specScript.type='speculationrules';
		specScript.textContent=JSON.stringify(specRules);
		document.head?.insertAdjacentElement('beforeend',specScript);
	}
	window.addEventListener('beforeunload',(e)=>{e.stopImmediatePropagation();},true);
	window.addEventListener('unload',(e)=>{e.stopImmediatePropagation();},true);
	//事件注册完毕
	document.documentElement._regEvent_=1;
}
//注册事件
(function(){
	regEvent();
	//加载检测
	checkTimer=setTimeout(loadCheck,200);
	CHECK_M_OBSERVER.observe(document,{childList:true,subtree:true});
})();
