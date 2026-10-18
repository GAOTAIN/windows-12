'use strict';
(() => {
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)],root=document.documentElement;
const paths={eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',eyeOff:'<path d="m3 3 18 18M10.5 5.1 12 5c6.5 0 10 7 10 7a21 21 0 0 1-4 4M6.2 6.2A24 24 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.1-1.2M10 10a3 3 0 0 0 4 4"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',moon:'<path d="M20 15.5A8.5 8.5 0 018.5 4 8.5 8.5 0 1020 15.5Z"/>',wifi:'<path d="M2 8a16 16 0 0120 0M5 12a11 11 0 0114 0m-11 4a6 6 0 018 0"/><circle cx="12" cy="20" r=".7"/>',volume:'<path d="m3 9 4 0 5-4v14l-5-4H3zm13-1a7 7 0 010 8m3-11a11 11 0 010 14"/>',battery:'<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 10v4M5 10v4m3-4v4m3-4v4m3-4v4"/>',power:'<path d="M12 2v9M6 5a9 9 0 1012 0"/>',minus:'<path d="M4 12h16"/>',maximize:'<rect x="4" y="4" width="16" height="16" rx="1"/>',restore:'<path d="M8 8V4h12v12h-4"/><rect x="4" y="8" width="12" height="12" rx="1"/>',close:'<path d="m5 5 14 14M5 19 19 5"/>',home:'<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3z"/>',back:'<path d="m13 5-7 7 7 7M6 12h15"/>',up:'<path d="m5 11 7-7 7 7M12 4v17"/>',refresh:'<path d="M20 10a8 8 0 10-1 8M20 3v7h-7"/>',plus:'<path d="M12 4v16M4 12h16"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',document:'<path d="M5 3h9l5 5v13H5zm9 0v6h5M8 13h8m-8 4h6"/>',image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="15" cy="8" r="2"/><path d="m3 17 6-7 7 8 3-3 2 3"/>',monitor:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',person:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0116 0v2"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3m-4 5v2"/>',play:'<path d="m8 4 12 8-12 8z"/>',pause:'<path d="M8 4v16M16 4v16"/>',previous:'<path d="M5 5v14m14-14L7 12l12 7z"/>',next:'<path d="M19 5v14M5 5l12 7-12 7z"/>'};
const symbol=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[n]||paths.document}</svg>`;
const art=id=>`<svg class="app-art" viewBox="0 0 48 48" aria-hidden="true"><use href="#i-${id.startsWith('text:')?'text':id}"/></svg>`;
function hydrate(scope=document){$$('[data-symbol]',scope).forEach(el=>el.innerHTML=symbol(el.dataset.symbol));$$('[data-symbol-before]',scope).forEach(el=>{el.insertAdjacentHTML('afterbegin',symbol(el.dataset.symbolBefore));el.removeAttribute('data-symbol-before');});}
const apps=[['files','文件资源管理器'],['edge','Microsoft Edge'],['photos','照片'],['store','应用商店'],['settings','设置'],['notes','便笺'],['terminal','终端'],['calendar','日历'],['calculator','计算器'],['music','音乐'],['clock','时钟'],['recycle','回收站']].map(([id,name])=>({id,name}));
let workspaceUI;
const appById=id=>id.startsWith('text:')?{id,name:window.DesktopFS.get(id.slice(5))?.name||'文本文档'}:apps.find(a=>a.id===id)||apps[0],windows=new Map();let z=10,activeId=null,cascade=0,toastTimer,pressTimer;const memory={};
const store={get(k,f=''){try{return localStorage.getItem(`w12-${k}`)??f;}catch{return memory[k]??f;}},set(k,v){memory[k]=v;try{localStorage.setItem(`w12-${k}`,v);}catch{}}};
const duration=n=>parseFloat(getComputedStyle(root).getPropertyValue(`--duration-${n}`))||0;
function toast(m){clearTimeout(toastTimer);$('#toast').textContent=m;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2800);}
let themeTimer; function setTheme(dark){clearTimeout(themeTimer);document.body.classList.add('theme-changing');root.classList.toggle('dark',dark);store.set('theme',dark?'dark':'light');themeTimer=setTimeout(()=>document.body.classList.remove('theme-changing'),duration('slow'));$('#theme-toggle').innerHTML=symbol(dark?'moon':'sun');$('#theme-toggle').setAttribute('aria-label',dark?'切换到浅色主题':'切换到深色主题');$$('[data-theme-choice]').forEach(b=>{b.classList.toggle('selected',(b.dataset.themeChoice==='dark')===dark);b.setAttribute('aria-pressed',String(b.classList.contains('selected')));});}
const overlays=['start-menu','notification-center','context-menu','quick-panel','power-menu'];
function closeOverlays(except){overlays.filter(id=>id!==except).forEach(id=>{const el=$(`#${id}`);el.classList.remove('open');el.inert=true;});if(except!=='start-menu'&&except!=='power-menu'){document.body.classList.remove('start-is-open');$('#start-button').setAttribute('aria-expanded','false');}if(except!=='notification-center')$('#clock-button').setAttribute('aria-expanded','false');if(except!=='quick-panel')$('#quick-settings').setAttribute('aria-expanded','false');}
function toggleOverlay(id){const panel=$(`#${id}`),opening=!panel.classList.contains('open');if(id==='power-menu'){panel.classList.toggle('open',opening);panel.inert=!opening;if(opening)requestAnimationFrame(()=>$$('button',panel).find(button=>button.getClientRects().length)?.focus());return;}closeOverlays();if(!opening)return;panel.classList.add('open');panel.inert=false;if(id==='start-menu'){document.body.classList.add('start-is-open');$('#start-button').setAttribute('aria-expanded','true');requestAnimationFrame(()=>$('#start-search').focus());}if(id==='notification-center')$('#clock-button').setAttribute('aria-expanded','true');if(id==='quick-panel')$('#quick-settings').setAttribute('aria-expanded','true');if(id!=='start-menu')requestAnimationFrame(()=>$('button,input',panel)?.focus());}
function updateTasks(){$$('.task-app').forEach(b=>{const w=windows.get(b.dataset.app);b.classList.toggle('running',!!w);b.classList.toggle('minimized',!!w?.minimized);b.classList.toggle('foreground',activeId===b.dataset.app&&!w?.minimized);b.setAttribute('aria-label',`${appById(b.dataset.app).name}${w?(w.minimized?'，已最小化':'，正在运行'):''}`);});}
function focusWindow(id){const w=windows.get(id);if(!w||w.minimized)return;windows.forEach(x=>x.el.classList.remove('active'));w.el.classList.add('active');w.el.style.zIndex=++z;activeId=id;updateTasks();}
function nextFocus(){const shown=[...windows.values()].filter(w=>!w.minimized).sort((a,b)=>Number(b.el.style.zIndex)-Number(a.el.style.zIndex));activeId=null;if(shown[0])focusWindow(shown[0].id);else updateTasks();}
function minimize(id){const w=windows.get(id);if(!w||w.minimized)return;w.endResize?.();const task=$(`.task-app[data-app="${id}"]`)||$('#start-button'),t=task.getBoundingClientRect(),r=w.el.getBoundingClientRect();w.el.style.setProperty('--min-x',`${t.x+t.width/2-r.x-r.width/2}px`);w.el.style.setProperty('--min-y',`${t.y-r.y-r.height/2}px`);w.el.classList.add('minimizing');w.minimized=true;w.el.inert=true;w.el.setAttribute('aria-hidden','true');task.classList.add('pulse');w.timer=setTimeout(()=>{w.el.hidden=true;task.classList.remove('pulse');},duration('slow'));nextFocus();}
function restore(id){const w=windows.get(id);if(!w)return;clearTimeout(w.timer);w.el.hidden=false;w.el.inert=false;w.el.removeAttribute('aria-hidden');w.minimized=false;requestAnimationFrame(()=>{w.el.classList.remove('minimizing');focusWindow(id);});}
function closeWindow(id){const w=windows.get(id);if(!w)return;w.endResize?.();clearTimeout(w.timer);w.cleanup?.();w.el.classList.add('closing');w.el.inert=true;windows.delete(id);setTimeout(()=>w.el.remove(),duration('normal'));nextFocus();}
function maximize(id){const w=windows.get(id);if(!w)return;w.endResize?.();w.maximized=!w.maximized;w.el.classList.toggle('maximized',w.maximized);if(!w.maximized)fitWindow(w);const b=$('[data-control=maximize]',w.el);b.innerHTML=symbol(w.maximized?'restore':'maximize');b.setAttribute('aria-label',w.maximized?'还原':'最大化');}
// Keep normal window bounds separate from maximized and minimized presentation.
const resizeDirections = {
  n: '上边缘', ne: '右上角', e: '右边缘', se: '右下角',
  s: '下边缘', sw: '左下角', w: '左边缘', nw: '左上角'
};
let activeResize = null;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
function desktopBounds() {
  const edge = parseFloat(getComputedStyle(root).getPropertyValue('--gap-edge')) || 12;
  const taskTop = $('#taskbar').getBoundingClientRect().top;
  return {left: edge, top: edge, right: Math.max(edge + 1, innerWidth - edge),
    bottom: Math.max(edge + 1, Math.min(innerHeight - edge, taskTop - edge))};
}
function readWindowBounds(win) {
  const value = name => parseFloat(win.el.style.getPropertyValue('--window-' + name));
  return {x: value('x'), y: value('y'), width: value('w'), height: value('h')};
}
function applyWindowBounds(win, bounds) {
  for (const [name, value] of Object.entries({x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height})) {
    win.el.style.setProperty('--window-' + name, value + 'px');
  }
}
function windowLimits(win, area = desktopBounds()) {
  const sizes = {files: [420, 300], settings: [360, 300], calculator: [280, 340], calendar: [320, 320]};
  const [width, height] = sizes[win.id] || [280, 220];
  return {area, minWidth: Math.min(width, area.right - area.left),
    minHeight: Math.min(height, area.bottom - area.top)};
}
function fitWindow(win) {
  const {area, minWidth, minHeight} = windowLimits(win);
  const bounds = readWindowBounds(win);
  bounds.width = clamp(bounds.width, minWidth, area.right - area.left);
  bounds.height = clamp(bounds.height, minHeight, area.bottom - area.top);
  bounds.x = clamp(bounds.x, area.left, area.right - bounds.width);
  bounds.y = clamp(bounds.y, area.top, area.bottom - bounds.height);
  applyWindowBounds(win, bounds);
  return bounds;
}
function resizedBounds(start, direction, dx, dy, limits) {
  const {area, minWidth, minHeight} = limits;
  let left = start.x, top = start.y, right = start.x + start.width, bottom = start.y + start.height;
  if (direction.includes('e')) right = clamp(right + dx, left + minWidth, area.right);
  if (direction.includes('w')) left = clamp(left + dx, area.left, right - minWidth);
  if (direction.includes('s')) bottom = clamp(bottom + dy, top + minHeight, area.bottom);
  if (direction.includes('n')) top = clamp(top + dy, area.top, bottom - minHeight);
  return {x: left, y: top, width: right - left, height: bottom - top};
}
function installWindowResize(win) {
  fitWindow(win);
  for (const [direction, label] of Object.entries(resizeDirections)) {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'resize-handle';
    handle.dataset.resize = direction;
    handle.setAttribute('aria-label', '调整窗口' + label);
    handle.title = '拖拽调整窗口大小；方向键调整，Shift 精细调整';
    win.el.append(handle);
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.isPrimary === false || win.maximized || win.minimized || win.el.classList.contains('appearing')) return;
      event.preventDefault();
      event.stopPropagation();
      activeResize?.();
      closeOverlays();
      focusWindow(win.id);
      win.el.classList.add('resizing');
      const start = fitWindow(win), limits = windowLimits(win);
      const startX = event.clientX, startY = event.clientY;
      handle.setPointerCapture(event.pointerId);
      document.body.classList.add('window-resizing');
      root.style.setProperty('--resize-cursor', getComputedStyle(handle).cursor);
      const move = current => applyWindowBounds(win, resizedBounds(start, direction, current.clientX - startX, current.clientY - startY, limits));
      const end = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        handle.removeEventListener('lostpointercapture', end);
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        win.el.classList.remove('resizing');
        document.body.classList.remove('window-resizing');
        root.style.removeProperty('--resize-cursor');
        if (activeResize === end) activeResize = null;
        if (win.endResize === end) win.endResize = null;
      };
      activeResize = end;
      win.endResize = end;
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
      handle.addEventListener('lostpointercapture', end);
    });
    handle.addEventListener('keydown', event => {
      if (win.maximized || win.minimized || event.altKey || event.ctrlKey || event.metaKey) return;
      const vectors = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
      if (!vectors[event.key]) return;
      event.preventDefault();
      event.stopPropagation();
      focusWindow(win.id);
      const step = event.shiftKey ? 1 : 10, [dx, dy] = vectors[event.key];
      applyWindowBounds(win, resizedBounds(fitWindow(win), direction, dx * step, dy * step, windowLimits(win)));
    });
  }
}
function openApp(id,options={}){closeOverlays();if(windows.has(id)){const existing=windows.get(id);if(existing.minimized)restore(id);else focusWindow(id);if(options.folder&&id==='files')renderFiles(existing,options.folder);return existing;}const app=appById(id),el=document.createElement('section');el.className='window appearing';el.dataset.app=id;el.setAttribute('role','dialog');el.setAttribute('aria-label',app.name);const sizes={files:[900,574],settings:[660,540],notes:[510,440],calculator:[330,480],calendar:[430,520],clock:[480,380],terminal:[650,420],music:[440,480]},[w,h]=sizes[id]||[740,510],width=Math.min(w,innerWidth-36),height=Math.min(h,innerHeight-125),offset=(cascade++%5)*25;const left=Math.max(12,Math.min((innerWidth-width)/2+offset-32,innerWidth-width-24)),top=Math.max(12,Math.min((innerHeight-height-85)/2+offset,innerHeight-height-100));el.style.setProperty('--window-x',`${left}px`);el.style.setProperty('--window-y',`${top}px`);el.style.setProperty('--window-w',`${w}px`);el.style.setProperty('--window-h',`${h}px`);el.innerHTML=`<header class="titlebar"><div class="window-title">${art(id)}<span>${app.name}</span></div><div class="window-controls"><button data-control="minimize" aria-label="最小化">${symbol('minus')}</button><button data-control="maximize" aria-label="最大化">${symbol('maximize')}</button><button data-control="close" class="close-window" aria-label="关闭">${symbol('close')}</button></div></header><div class="window-content"></div>`;$('#windows').append(el);const win={id,el,content:$('.window-content',el),minimized:false,maximized:false};windows.set(id,win);el.addEventListener('pointerdown',()=>focusWindow(id));$('[data-control=minimize]',el).onclick=()=>minimize(id);$('[data-control=maximize]',el).onclick=()=>maximize(id);$('[data-control=close]',el).onclick=()=>closeWindow(id);const title=$('.titlebar',el);title.addEventListener('dblclick',e=>{if(!e.target.closest('button'))maximize(id);});title.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button')||win.maximized)return;const rect=el.getBoundingClientRect(),dx=e.clientX-rect.left,dy=e.clientY-rect.top;title.setPointerCapture(e.pointerId);el.classList.add('dragging');const move=event=>{const area=desktopBounds();el.style.setProperty('--window-x',`${clamp(event.clientX-dx,area.left,area.right-rect.width)}px`);el.style.setProperty('--window-y',`${clamp(event.clientY-dy,area.top,area.bottom-rect.height)}px`);};const end=()=>{el.classList.remove('dragging');title.removeEventListener('pointermove',move);title.removeEventListener('pointerup',end);title.removeEventListener('pointercancel',end);};title.addEventListener('pointermove',move);title.addEventListener('pointerup',end);title.addEventListener('pointercancel',end);});renderApp(win,options);installWindowResize(win);focusWindow(id);el.tabIndex=-1;el.focus({preventScroll:true});requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.remove('appearing')));return win;}
function renderFiles(win,folder='主页',recordHistory=true){return workspaceUI.renderFiles(win,folder,recordHistory);}
function renderSettings(win){win.content.innerHTML=`<div class="app-page"><span class="eyebrow">MAKE IT YOURS</span><h1>设置</h1><p>个性化、账户和系统设置。</p><div class="settings-profile"><span class="avatar">L</span><div><strong>本地用户</strong><small>Windows 12 · 浏览器仿真桌面</small></div></div><div class="settings-row">${symbol('sun')}<div><strong>外观</strong><small>为此刻的你，选择适合的明暗。</small><div class="theme-options"><button class="theme-option" data-theme-choice="light"><span class="theme-preview"></span>浅色</button><button class="theme-option" data-theme-choice="dark"><span class="theme-preview night"></span>深色</button></div></div></div><div class="settings-row">${symbol('moon')}<div><strong>专注模式</strong><small>暂时收起通知，专注于当下。</small></div><button class="switch settings-focus" role="switch" aria-label="专注模式" aria-checked="${$('#focus-toggle').getAttribute('aria-checked')}"></button></div><div class="settings-row">${symbol('monitor')}<div><strong>关于这台设备</strong><small>原生 HTML / CSS / JavaScript · 无外部资源</small></div></div></div>`;$$('[data-theme-choice]',win.content).forEach(b=>b.onclick=()=>setTheme(b.dataset.themeChoice==='dark'));setTheme(root.classList.contains('dark'));$('.settings-focus',win.content).onclick=toggleFocus;}
function renderCalendar(win){let view=new Date(),chosen=new Date();const now=new Date();const draw=()=>{const year=view.getFullYear(),month=view.getMonth(),start=(new Date(year,month,1).getDay()+6)%7,days=new Date(year,month+1,0).getDate();win.content.innerHTML=`<div class="app-page"><span class="eyebrow">A LITTLE TIME FOR YOU</span><h1>把日子，过成喜欢的样子。</h1><div class="calendar-nav"><strong>${year} 年 ${month+1} 月</strong><div><button data-month="-1" aria-label="上个月">‹</button><button data-month="1" aria-label="下个月">›</button></div></div><div class="calendar-grid">${['一','二','三','四','五','六','日'].map(d=>`<span>${d}</span>`).join('')}${'<span></span>'.repeat(start)}${Array.from({length:days},(_,i)=>`<button data-day="${i+1}" class="${now.getFullYear()===year&&now.getMonth()===month&&now.getDate()===i+1?'today':''} ${chosen.getFullYear()===year&&chosen.getMonth()===month&&chosen.getDate()===i+1?'chosen':''}">${i+1}</button>`).join('')}</div><p class="calendar-detail">${chosen.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})} · 暂无日程，留一点时间给自己。</p></div>`;$$('[data-month]',win.content).forEach(b=>b.onclick=()=>{view=new Date(year,month+Number(b.dataset.month),1);draw();});$$('[data-day]',win.content).forEach(b=>b.onclick=()=>{chosen=new Date(year,month,Number(b.dataset.day));draw();});};draw();}
function renderCalculator(win){let value='0',a=null,op=null,replace=true;const keys=['C','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','⌫','0','.','='];win.content.innerHTML=`<output class="calc-display" aria-live="polite">0</output><div class="calculator">${keys.map(k=>`<button data-key="${k}" class="${k==='='?'calc-equals':''}">${k}</button>`).join('')}</div>`;const compute=()=>{const b=Number(value),n=op==='+'?a+b:op==='−'?a-b:op==='×'?a*b:b===0?NaN:a/b;value=Number.isFinite(n)?String(Number(n.toPrecision(12))):'无法除以零';a=null;op=null;replace=true;};const press=key=>{if(/^\d$/.test(key)){if(replace||value==='0'){value=key;replace=false;}else if(value.length<14)value+=key;}else if(key==='.'){if(replace){value='0.';replace=false;}else if(!value.includes('.'))value+='.';}else if(key==='C'){value='0';a=null;op=null;replace=true;}else if(key==='⌫'){value=replace?'0':value.slice(0,-1)||'0';}else if(key==='±'){if(Number.isFinite(Number(value)))value=String(-Number(value));}else if(key==='%'){value=String(Number(value)/100);}else if(key==='='){if(op!==null)compute();}else{if(op&&!replace)compute();a=Number(value);op=key;replace=true;}$('.calc-display',win.content).textContent=value;};$$('[data-key]',win.content).forEach(b=>b.onclick=()=>press(b.dataset.key));win.el.addEventListener('keydown',e=>{const mapped={'Enter':'=','Escape':'C','Backspace':'⌫','*':'×','/':'÷','-':'−'}[e.key]||e.key;if(keys.includes(mapped)){e.preventDefault();press(mapped);}});}
function renderApp(win,options={}){if(win.id.startsWith('text:')){workspaceUI.renderTextFile(win);return;}switch(win.id){
case 'files':renderFiles(win,options.folder);break;
case 'settings':renderSettings(win);break;
case 'notes':{win.content.innerHTML='<textarea class="notes-editor" aria-label="便笺内容" spellcheck="false"></textarea><div class="note-footer" role="status">自动保存于此浏览器</div>';const editor=$('textarea',win.content);editor.value=store.get('note','留一点空间，给新的想法。\n\n今天想做的三件小事：\n\n01  整理桌面，也整理心情\n02  记录一个一闪而过的灵感\n03  给自己留一段专注的时间\n\n—— 每一天，都可以重新开始。');editor.oninput=()=>{store.set('note',editor.value);$('.note-footer',win.content).textContent=`已自动保存 · ${editor.value.length} 字`;};break;}
case 'calculator':renderCalculator(win);break;
case 'calendar':renderCalendar(win);break;
case 'photos':{const items=[['晨雾与山谷','land'],['玻璃与光影',''],['远处的天际','sky']];win.content.innerHTML=`<div class="app-page"><span class="eyebrow">LITTLE MOMENTS, BIG FEELINGS</span><h1>留住，眼前的美好。</h1><p>本地创作集 · 3 张 CSS 抽象画</p><div class="photo-grid">${items.map(([name,cls])=>`<button class="photo-card" data-photo="${cls}" aria-label="查看${name}"><span class="photo-art ${cls}"></span><span>${name}</span></button>`).join('')}</div></div>`;$$('.photo-card',win.content).forEach(b=>b.onclick=()=>{const page=$('.app-page',win.content);page.innerHTML=`<button class="photo-back">← 返回照片集</button><div class="photo-art photo-large ${b.dataset.photo}"></div>`;$('.photo-back',page).onclick=()=>renderApp(win);});break;}
case 'edge':win.content.innerHTML=`<form class="browser-address">${symbol('lock')}<input aria-label="地址或搜索" placeholder="搜索，或输入网址" value="windows12://newtab"><button type="submit">前往 →</button></form><div class="app-page"><div class="browser-welcome">${art('edge')}<span class="eyebrow">A FRESH PERSPECTIVE</span><h1>好奇心，从这里出发。</h1><p>本地浏览器演示 · 选择一个入口，探索你的桌面。</p><div class="browser-links"><button data-go="files">我的文件</button><button data-go="notes">记录想法</button><button data-go="settings">个性化</button></div><p class="browser-result" role="status"></p></div></div>`;$$('[data-go]',win.content).forEach(b=>b.onclick=()=>openApp(b.dataset.go));$('form',win.content).onsubmit=e=>{e.preventDefault();$('.browser-result',win.content).textContent=`已输入「${$('input',win.content).value}」。此为本地演示，没有连接外部网络。`;};break;
case 'store':win.content.innerHTML=`<div class="app-page"><span class="eyebrow">MADE FOR YOUR EVERYDAY</span><h1>发现，下一个好用。</h1><p>桌面内置应用 · 点击即可打开</p><div class="store-grid">${apps.filter(a=>['notes','calculator','photos','music','calendar','clock'].includes(a.id)).map(a=>`<div class="store-card">${art(a.id)}<div><strong>${a.name}</strong><small>已内置 · 离线可用</small></div><button data-launch="${a.id}">打开</button></div>`).join('')}</div></div>`;$$('[data-launch]',win.content).forEach(b=>b.onclick=()=>openApp(b.dataset.launch));break;
case 'terminal':{win.content.innerHTML='<div class="terminal"><pre class="terminal-output">Windows 12 [本地仿真终端]\n输入 help 查看可用命令。\n</pre><form><label for="terminal-input">PS C:\\Users\\Local&gt;</label><input id="terminal-input" aria-label="终端命令" autocomplete="off" spellcheck="false"></form></div>';$('form',win.content).onsubmit=e=>{e.preventDefault();const input=$('input',win.content),raw=input.value.trim(),cmd=raw.toLowerCase(),out=$('.terminal-output',win.content);input.value='';if(!raw)return;if(cmd==='clear'||cmd==='cls'){out.textContent='';return;}let result='';if(cmd==='help')result='help        显示帮助\ndir         列出仿真工作空间\ndate        当前日期与时间\nwhoami      本地用户\ntheme       切换亮暗主题\nopen notes  打开便笺\nopen files  打开文件资源管理器\ncls         清屏';else if(cmd==='dir')result='文档/   图片/   下载/\n从这里开始.txt   灵感与想法.txt';else if(cmd==='date')result=new Date().toLocaleString('zh-CN');else if(cmd==='whoami')result='windows12\\local';else if(cmd==='theme'){setTheme(!root.classList.contains('dark'));result='主题已切换。';}else if(cmd.startsWith('open ')&&apps.some(a=>a.id===cmd.slice(5))){openApp(cmd.slice(5));result='应用已打开。';}else result=`未识别的本地命令：${raw}。输入 help 查看帮助。`;out.textContent+=`\nPS> ${raw}\n${result}\n`;$('form',win.content).scrollIntoView({block:'nearest'});};break;}
case 'clock':{win.content.innerHTML='<div class="app-page centered-page"><span class="eyebrow">RIGHT HERE, RIGHT NOW</span><div class="big-clock"></div><p class="clock-date"></p><small>本地时间 · 好好享受此刻</small></div>';const tick=()=>{$('.big-clock',win.content).textContent=new Date().toLocaleTimeString('zh-CN',{hour12:false});$('.clock-date',win.content).textContent=new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});};tick();const timer=setInterval(tick,1000);win.cleanup=()=>clearInterval(timer);break;}
case 'music':{const tracks=['一段安静的时光','窗边的光','新的清晨'];let index=0,playing=false,audio=null,oscillator=null,gain=null;win.content.innerHTML=`<div class="app-page centered-page"><span class="eyebrow">SOUNDTRACK FOR YOUR SPACE</span><div class="music-cover">${art('music')}</div><h1 class="track-title">${tracks[0]}</h1><p>合成环境音 · 本地生成</p><div class="music-controls"><button data-music="previous" aria-label="上一首">${symbol('previous')}</button><button data-music="play" class="primary-button" aria-label="播放">${symbol('play')}</button><button data-music="next" aria-label="下一首">${symbol('next')}</button></div></div>`;const playButton=$('[data-music=play]',win.content);const stop=()=>{if(oscillator){oscillator.stop();oscillator=null;}if(audio){audio.close().catch(()=>{});audio=null;}playing=false;playButton.innerHTML=symbol('play');playButton.setAttribute('aria-label','播放');};const play=()=>{try{audio=new(window.AudioContext||window.webkitAudioContext)();oscillator=audio.createOscillator();gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=[174,196,220][index];gain.gain.value=Number($('#volume-range').value)/100*.035;oscillator.connect(gain).connect(audio.destination);oscillator.start();playing=true;playButton.innerHTML=symbol('pause');playButton.setAttribute('aria-label','暂停');}catch{toast('当前浏览器不支持音频播放');}};playButton.onclick=()=>playing?stop():play();['previous','next'].forEach(action=>$(`[data-music=${action}]`,win.content).onclick=()=>{const resume=playing;stop();index=(index+(action==='next'?1:2))%3;$('.track-title',win.content).textContent=tracks[index];if(resume)play();});win.volume=value=>{if(gain)gain.gain.value=value/100*.035;};win.cleanup=stop;break;}
case 'recycle':workspaceUI.renderRecycle(win);break;
}}
function toggleFocus(){const on=$('#focus-toggle').getAttribute('aria-checked')!=='true';$('#focus-toggle').setAttribute('aria-checked',String(on));$$('.settings-focus').forEach(b=>b.setAttribute('aria-checked',String(on)));$('#quiet-toggle').classList.toggle('active',on);$('#quiet-toggle').setAttribute('aria-pressed',String(on));$('#quiet-toggle small').textContent=on?'已开启':'已关闭';toast(on?'已开启专注模式':'已关闭专注模式');}
hydrate();setTheme(store.get('theme')==='dark');
const desktopApps=[['pc','此电脑','files'],['files','文件资源管理器','files'],['settings','设置','settings'],['notes','便笺','notes'],['recycle','回收站','recycle']];$('#desktop-icons').innerHTML=desktopApps.map(([icon,name,id])=>`<button class="desktop-icon" data-app="${id}" aria-label="打开${name}">${art(icon)}<span class="app-label">${name}</span></button>`).join('');$$('.desktop-icon').forEach(b=>b.onclick=()=>openApp(b.dataset.app,b.textContent==='此电脑'?{folder:'此电脑'}:{}));
workspaceUI=window.initWorkspaceUI({$,$$,root,apps,art,symbol,openApp,windows,closeWindow,toast,closeOverlays,getActiveId:()=>activeId,updateTasks});
$('#start-apps').innerHTML=apps.map(a=>`<button class="start-app" data-app="${a.id}" aria-label="打开${a.name}">${art(a.id)}<span>${a.name}</span></button>`).join('');$$('.start-app').forEach(b=>b.onclick=()=>openApp(b.dataset.app));
const pinned=['files','edge','photos','settings'];$('#task-apps').innerHTML=pinned.map(id=>`<button class="task-app" data-app="${id}" aria-label="${appById(id).name}" title="${appById(id).name}">${art(id)}</button>`).join('');
function ensureTask(id){if($(`.task-app[data-app="${id}"]`))return;const b=document.createElement('button');b.className='task-app dynamic-task';b.dataset.app=id;b.setAttribute('aria-label',appById(id).name);b.title=appById(id).name;b.innerHTML=art(id);$('#task-apps').append(b);}
const taskObserver=new MutationObserver(()=>{windows.forEach(w=>ensureTask(w.id));$$('.dynamic-task').forEach(b=>{if(!windows.has(b.dataset.app))b.remove();});updateTasks();});taskObserver.observe($('#windows'),{childList:true});
$('#task-apps').onclick=e=>{const b=e.target.closest('.task-app');if(!b)return;const id=b.dataset.app,w=windows.get(id);if(!w)openApp(id);else if(w.minimized)restore(id);else if(activeId===id)minimize(id);else focusWindow(id);};
$('#start-button').onclick=()=>toggleOverlay('start-menu');$('#clock-button').onclick=()=>toggleOverlay('notification-center');$('#quick-settings').onclick=()=>toggleOverlay('quick-panel');$('#theme-toggle').onclick=()=>setTheme(!root.classList.contains('dark'));
$('#task-search').onclick=()=>{clearTimeout(pressTimer);$('#taskbar').classList.add('pressed');pressTimer=setTimeout(()=>$('#taskbar').classList.remove('pressed'),duration('fast'));};
$('#start-search').oninput=e=>{const searching=!!e.target.value.trim();$('#start-menu').classList.toggle('searching',searching);$('#start-apps').inert=searching;};$('#all-apps').onclick=()=>{const input=$('#start-search');input.value='';input.dispatchEvent(new Event('input'));toast('已显示全部 12 个内置应用');};$('#profile-button').onclick=()=>openApp('settings');$('#power-button').onclick=()=>toggleOverlay('power-menu');
const DEMO_PASSWORD = '123456';
let welcomeTimer, signinFocusTimer;
function showWelcome() {
  clearTimeout(welcomeTimer);
  clearTimeout(signinFocusTimer);
  dismissKey = null;
  closeOverlays();
  $('#toast').classList.remove('visible');
  const screen = $('#lock-screen');
  screen.hidden = false;
  screen.inert = false;
  screen.classList.remove('leaving');
  screen.dataset.phase = 'cover';
  screen.setAttribute('aria-label', '锁屏，按任意键进入登录');
  $('.lock-card').inert = true;
  $('.welcome-footer').inert = true;
  document.body.classList.add('is-locked');
  $('#desktop').inert = true;
  $('#taskbar').inert = true;
  updateClock();
  resetLogin();
  requestAnimationFrame(() => screen.focus({preventScroll:true}));
}
function showSignIn() {
  const screen = $('#lock-screen');
  if (screen.hidden || screen.dataset.phase !== 'cover') return;
  screen.dataset.phase = 'signin';
  screen.setAttribute('aria-label', '本地用户登录');
  $('.lock-card').inert = false;
  $('.welcome-footer').inert = false;
  signinFocusTimer = setTimeout(() => {
    if (screen.dataset.phase === 'signin' && !screen.hidden) $('#login-password').focus({preventScroll:true});
  }, duration('normal'));
}
function enterDesktop() {
  const screen = $('#lock-screen');
  if (screen.hidden || screen.dataset.phase !== 'signin' || screen.classList.contains('leaving')) return;
  const password = $('#login-password');
  if (password.value !== DEMO_PASSWORD) {
    $('#login-error').textContent = password.value ? '密码不正确，请重试。' : '请输入密码。';
    password.setAttribute('aria-invalid', 'true');
    $('.password-field').classList.add('invalid');
    password.focus({preventScroll:true});
    if (password.value) password.select();
    return;
  }
  resetLogin();
  screen.classList.add('leaving');
  screen.inert = true;
  document.body.classList.remove('is-locked');
  $('#desktop').inert = false;
  $('#taskbar').inert = false;
  welcomeTimer = setTimeout(() => {
    screen.hidden = true;
    $('#start-button').focus({preventScroll:true});
    screen.classList.remove('leaving');
  }, duration('normal'));
}
function resetLogin() {
  const password = $('#login-password');
  password.value = '';
  password.type = 'password';
  password.removeAttribute('aria-invalid');
  $('.password-field').classList.remove('invalid');
  $('#login-error').textContent = '';
  $('#password-visibility').setAttribute('aria-label', '显示密码');
  $('#password-visibility').setAttribute('aria-pressed', 'false');
  $('#password-visibility').innerHTML = symbol('eye');
}
// The key that dismisses the clock cover is consumed, including its repeats.
let dismissKey = null;
document.addEventListener('keydown', e => {
  if (!document.body.classList.contains('is-locked')) return;
  const code = e.code || e.key;
  if (dismissKey === code) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  if ($('#lock-screen').dataset.phase === 'cover') {
    e.preventDefault();
    e.stopImmediatePropagation();
    dismissKey = code;
    showSignIn();
  }
}, true);
document.addEventListener('keyup', e => {
  if (dismissKey !== (e.code || e.key)) return;
  dismissKey = null;
  e.preventDefault();
  e.stopImmediatePropagation();
}, true);
$('#lock-screen').addEventListener('pointerdown', e => {
  if ($('#lock-screen').dataset.phase !== 'cover' || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  showSignIn();
});
$('#lock-desktop').onclick=showWelcome;
$('#login-form').onsubmit=e=>{e.preventDefault();enterDesktop();};
$('#login-password').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();enterDesktop();}};
$('#login-options').onclick=()=>{
  const button=$('#login-options'), expanded=button.getAttribute('aria-expanded')!=='true';
  button.setAttribute('aria-expanded',String(expanded));
  $('#login-hint').innerHTML=expanded?'密码登录 · 演示密码：<span>123456</span>':'演示密码：<span>123456</span>';
};
$('#login-power').onclick=()=>toggleOverlay('power-menu');
$('#login-accessibility').onclick=()=>{
  const large=$('#lock-screen').classList.toggle('large-text');
  $('#login-accessibility').setAttribute('aria-pressed',String(large));
  toast(large?'已放大登录文字':'已恢复登录文字大小');
};
$('#login-password').oninput=()=>{
  $('#login-password').removeAttribute('aria-invalid');
  $('.password-field').classList.remove('invalid');
  $('#login-error').textContent='';
};
$('#password-visibility').onclick=()=>{
  const password=$('#login-password'), visible=password.type==='password';
  password.type=visible?'text':'password';
  $('#password-visibility').setAttribute('aria-label',visible?'隐藏密码':'显示密码');
  $('#password-visibility').setAttribute('aria-pressed',String(visible));
  $('#password-visibility').innerHTML=symbol(visible?'eyeOff':'eye');
};
$('#restart-desktop').onclick=()=>{[...windows.keys()].forEach(closeWindow);showWelcome();};
$('#clear-notifications').onclick=()=>{$('#notification-list').innerHTML='<div class="empty-folder"><p>通知已全部清除</p><small>享受这份清静。</small></div>';$('#clear-notifications').disabled=true;};$('#focus-toggle').onclick=toggleFocus;$('#quiet-toggle').onclick=toggleFocus;
$('#wifi-toggle').onclick=()=>{const b=$('#wifi-toggle'),on=b.getAttribute('aria-pressed')!=='true';b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));$('small',b).textContent=on?'已连接':'已关闭';toast(on?'仿真 WLAN 已连接':'仿真 WLAN 已关闭');};$('#volume-range').oninput=e=>{e.target.nextElementSibling.textContent=`${e.target.value}%`;windows.get('music')?.volume?.(Number(e.target.value));};$('#brightness-range').oninput=e=>{root.style.setProperty('--desktop-brightness',e.target.value/100);e.target.nextElementSibling.textContent=`${e.target.value}%`;};
// Desktop and file menus are managed by the shared workspace UI.
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.overlay,#taskbar'))closeOverlays();});
document.addEventListener('keydown',e=>{if(document.body.classList.contains('is-locked')){const power=$('#power-menu.open');if(e.key==='Escape'&&power){e.preventDefault();closeOverlays();$('#login-power').focus();}else if(e.key==='Escape'){e.preventDefault();showWelcome();}else if(e.key==='Tab'){const scope=power||$('#lock-screen'),items=$$('input,button:not(:disabled)',scope).filter(el=>el.getClientRects().length&&!el.hidden),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();}return;}if(e.key==='Escape'){const open=$('.overlay.open');if(open){closeOverlays();$('#start-button').focus();}else if(!$('#lock-screen').hidden){$('#lock-screen').hidden=true;$('#start-button').focus();}return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!$('#start-menu').classList.contains('open'))toggleOverlay('start-menu');else $('#start-search').focus();}const panel=$('.overlay.open');if(panel&&e.key==='Tab'){const focusable=$$('button:not(:disabled),input,[tabindex="0"]',panel).filter(el=>!el.closest('[inert]')&&!el.hidden);if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}if(e.key==='F5'&&!e.ctrlKey){e.preventDefault();toast('桌面已刷新');}});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);activeResize?.();closeOverlays();resizeTimer=setTimeout(()=>windows.forEach(w=>{if(!w.maximized)fitWindow(w);}),duration('normal'));});
function updateClock(){const now=new Date();$('#welcome-time').textContent=now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});$('#welcome-date').textContent=now.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});$('#task-time').textContent=now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});$('#task-date').textContent=now.toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'});$('#clock-button').setAttribute('aria-label',`${now.toLocaleString('zh-CN')}，打开通知中心`);}updateClock();setInterval(updateClock,1000);showWelcome();
})();
