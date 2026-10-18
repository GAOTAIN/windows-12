(function(global){
'use strict';
const HOME='windows12://newtab';
function resolveAddress(value){
  const raw=String(value??'').trim();
  if(!raw||[HOME,'about:blank'].includes(raw.toLowerCase()))return {url:HOME,kind:'home'};
  if(/[\u0000-\u001f\u007f]/.test(raw))throw new Error('网址中不能包含控制字符。');
  const hostWithPort=/^(?:localhost|(?:[\p{L}\d-]+\.)+[\p{L}\d-]+|\[[\da-f:]+\]):\d+(?:[/?#]|$)/iu.test(raw);
  const scheme=/^[a-z][a-z\d+.-]*:/i.test(raw)&&!hostWithPort;
  const looksLikeHost=!/\s/.test(raw)&&(/^(?:localhost|\[[\da-f:]+\])(?::\d+)?(?:[/?#]|$)/i.test(raw)||raw.split(/[/?#]/)[0].includes('.'));
  let candidate;
  if(scheme)candidate=raw;
  else if(raw.startsWith('//'))candidate='https:'+raw;
  else if(looksLikeHost||hostWithPort)candidate='https://'+raw;
  else return {url:'https://www.bing.com/search?q='+encodeURIComponent(raw),kind:'search'};
  let url;try{url=new URL(candidate);}catch{throw new Error('网址格式无效，请检查域名和端口。');}
  if(!['http:','https:'].includes(url.protocol))throw new Error('仅支持 HTTP 和 HTTPS 网址。');
  if(!url.hostname)throw new Error('请输入有效的网址。');
  if(url.username||url.password)throw new Error('请使用不含用户名和密码的网址。');
  return {url:url.href,kind:'url'};
}
function createHistory(){
  let entries=[HOME],index=0;
  return {
    current:()=>entries[index],canBack:()=>index>0,canForward:()=>index<entries.length-1,
    visit(url){if(entries[index]!==url){entries=entries.slice(0,index+1);entries.push(url);index++;}return entries[index];},
    back(){index=Math.max(0,index-1);return entries[index];},
    forward(){index=Math.min(entries.length-1,index+1);return entries[index];}
  };
}
function mount(win,runtime,options={}){
  const {$,$$,art,symbol,openApp,focusWindow}=runtime;
  let tabs=[],active=null,nextId=0,disposed=false;
  win.content.classList.add('edge-content');
  win.content.innerHTML=`<div class="browser-tab-strip"><div class="browser-tabs" role="tablist" aria-label="浏览器标签页"></div><button class="browser-new-tab" aria-label="新建标签页" title="新建标签页">${symbol('plus')}</button></div><form class="edge-address" novalidate><div class="browser-navigation"><button type="button" class="browser-back" aria-label="浏览器后退" title="后退">${symbol('back')}</button><button type="button" class="browser-forward" aria-label="浏览器前进" title="前进">${symbol('back')}</button><button type="button" class="browser-reload" aria-label="刷新网页" title="刷新">${symbol('refresh')}</button><button type="button" class="browser-home" aria-label="浏览器主页" title="主页">${symbol('home')}</button></div><label class="edge-address-field">${symbol('monitor')}<input class="edge-url" aria-label="地址或搜索" placeholder="搜索，或输入网址" autocomplete="off" spellcheck="false"></label><button type="submit" class="browser-go" aria-label="访问网址" title="前往">→</button><a class="browser-external" target="_blank" rel="noopener noreferrer" aria-label="在新标签页打开当前网址" title="在新标签页打开当前网址" hidden>↗</a></form><p class="browser-error" role="alert" hidden></p><div class="browser-pages"></div><footer class="browser-status"><span role="status"></span><span class="browser-status-tag">Microsoft Edge</span></footer>`;
  const tabList=$('.browser-tabs',win.content),pages=$('.browser-pages',win.content),address=$('.edge-url',win.content),error=$('.browser-error',win.content),status=$('.browser-status [role="status"]',win.content),external=$('.browser-external',win.content);
  function activeTab(){return tabs.find(tab=>tab.id===active);}
  function labelFor(url){return url===HOME?'新标签页':new URL(url).hostname;}
  function showError(message){error.textContent=message;error.hidden=false;address.setAttribute('aria-invalid','true');address.focus();}
  function clearError(){error.hidden=true;error.textContent='';address.removeAttribute('aria-invalid');}
  function renderTabs(){
    tabList.replaceChildren();
    for(const tab of tabs){
      const wrapper=document.createElement('div');wrapper.className='browser-tab'+(tab.id===active?' selected':'');
      const button=document.createElement('button');button.type='button';button.className='browser-tab-select';button.setAttribute('role','tab');button.id='edge-tab-'+tab.id;button.setAttribute('aria-controls',tab.page.id);button.setAttribute('aria-selected',String(tab.id===active));button.tabIndex=tab.id===active?0:-1;button.dataset.browserTab=tab.id;
      button.innerHTML=art('edge')+'<span></span>'; $('span',button).textContent=tab.label;button.title=tab.history.current();button.onclick=()=>activate(tab.id);
      const close=document.createElement('button');close.type='button';close.className='browser-close-tab';close.setAttribute('aria-label','关闭标签页 '+tab.label);close.innerHTML=symbol('close');close.onclick=()=>closeTab(tab.id);
      wrapper.append(button,close);tabList.append(wrapper);
    }
  }
  function updateToolbar(syncAddress=true){
    const tab=activeTab();if(!tab)return;
    if(syncAddress)address.value=tab.history.current();$('.browser-back',win.content).disabled=!tab.history.canBack();$('.browser-forward',win.content).disabled=!tab.history.canForward();
    const home=tab.history.current()===HOME;external.hidden=home;if(home)external.removeAttribute('href');else external.href=tab.history.current();
    status.textContent=tab.status;win.content.classList.toggle('browser-loading',tab.loading);
  }
  function activate(id){
    active=id;clearError();tabs.forEach(tab=>{tab.page.hidden=tab.id!==id;});renderTabs();updateToolbar();
  }
  function clearPage(tab){clearTimeout(tab.timeout);tab.timeout=null;tab.token++;if(tab.frame){tab.frame.onload=null;tab.frame.onerror=null;tab.frame.remove();tab.frame=null;}tab.page.replaceChildren();}
  function homePage(tab){
    tab.page.innerHTML=`<div class="edge-home"><div class="edge-home-brand">${art('edge')}<span>Microsoft Edge</span></div><h1>探索，从这里开始。</h1><p>输入网址，或搜索你感兴趣的内容。</p><form class="edge-home-search"><label>${symbol('search')}<input aria-label="搜索网页或输入网址" placeholder="搜索网页或输入网址" autocomplete="off"></label><button type="submit" aria-label="开始搜索">→</button></form><div class="edge-quick-links"><button data-site="https://www.bing.com"><span class="site-letter">b</span><span>必应</span></button><button data-site="https://www.wikipedia.org"><span class="site-letter">W</span><span>维基百科</span></button><button data-site="https://example.com"><span class="site-letter">E</span><span>示例网站</span></button></div><div class="edge-local-links"><button data-local="files">我的文件</button><button data-local="notes">记录想法</button><button data-local="settings">个性化</button></div><p class="edge-home-note">允许嵌入的网站可在窗口内浏览；其他网站可在新标签页打开。</p></div>`;
    $('form',tab.page).onsubmit=event=>{event.preventDefault();navigate($('input',tab.page).value);};
    $$('[data-site]',tab.page).forEach(button=>button.onclick=()=>navigate(button.dataset.site));
    $$('[data-local]',tab.page).forEach(button=>button.onclick=()=>openApp(button.dataset.local));
  }
  function loadPage(tab){
    clearPage(tab);const url=tab.history.current();tab.label=labelFor(url);tab.loading=false;
    if(url===HOME){tab.status='新标签页 · 支持网址和关键词搜索';homePage(tab);}
    else{
      tab.loading=true;tab.status='正在请求 '+new URL(url).hostname+'…';
      const hint=document.createElement('div');hint.className='browser-frame-hint';
      const text=document.createElement('p');text.textContent='网页空白或拒绝连接？该网站可能不允许嵌入。';
      const link=document.createElement('a');link.textContent='在新标签页打开 ↗';link.href=url;link.target='_blank';link.rel='noopener noreferrer';
      hint.append(text,link);
      const holder=document.createElement('div');holder.className='browser-frame-holder';
      const frame=document.createElement('iframe');frame.className='browser-frame';frame.title='外部网页：'+new URL(url).hostname;frame.referrerPolicy='no-referrer';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads');
      const token=tab.token;
      // A cross-origin frame's load event also fires for blocked pages. Never claim success here.
      frame.onload=()=>{if(disposed||tab.token!==token)return;clearTimeout(tab.timeout);tab.loading=false;tab.status='打开的地址：'+new URL(url).hostname+' · 页面不可见时请在新标签页打开';if(tab.id===active)updateToolbar(false);};
      frame.onerror=()=>{if(disposed||tab.token!==token)return;clearTimeout(tab.timeout);tab.loading=false;tab.status='网页未能显示，请检查网络或在新标签页打开。';if(tab.id===active)updateToolbar(false);};
      frame.src=url;tab.frame=frame;holder.append(frame);tab.page.append(hint,holder);
      tab.timeout=setTimeout(()=>{if(disposed||tab.token!==token)return;tab.loading=false;tab.status='连接较慢，或网站限制了嵌入；可在新标签页打开。';if(tab.id===active)updateToolbar(false);},10000);
    }
    renderTabs();if(tab.id===active)updateToolbar();
  }
  function navigate(raw){
    let result;try{result=resolveAddress(raw);}catch(cause){showError(cause.message);return false;}
    clearError();const tab=activeTab();tab.history.visit(result.url);loadPage(tab);return true;
  }
  function newTab(raw=HOME){
    let result;try{result=resolveAddress(raw);}catch(cause){showError(cause.message);return null;}
    const tab={id:String(++nextId),history:createHistory(),label:'新标签页',status:'',token:0,frame:null,loading:false};
    tab.history.visit(result.url);tab.page=document.createElement('section');tab.page.className='browser-page';tab.page.id='edge-page-'+tab.id;tab.page.setAttribute('role','tabpanel');tab.page.setAttribute('aria-labelledby','edge-tab-'+tab.id);pages.append(tab.page);tabs.push(tab);active=tab.id;
    loadPage(tab);activate(tab.id);return tab;
  }
  function closeTab(id){
    const index=tabs.findIndex(tab=>tab.id===id);if(index<0)return;const tab=tabs[index];clearPage(tab);tab.page.remove();tabs.splice(index,1);
    if(!tabs.length){newTab();return;}
    if(active===id)activate(tabs[Math.min(index,tabs.length-1)].id);else renderTabs();
  }
  $('.edge-address',win.content).onsubmit=event=>{event.preventDefault();navigate(address.value);};
  $('.browser-new-tab',win.content).onclick=()=>{newTab();address.focus();address.select();};
  $('.browser-back',win.content).onclick=()=>{const tab=activeTab();tab.history.back();clearError();loadPage(tab);};
  $('.browser-forward',win.content).onclick=()=>{const tab=activeTab();tab.history.forward();clearError();loadPage(tab);};
  $('.browser-home',win.content).onclick=()=>navigate(HOME);
  $('.browser-reload',win.content).onclick=()=>{clearError();loadPage(activeTab());};
  address.onfocus=()=>address.select();address.oninput=clearError;
  tabList.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||!event.target.matches('[role="tab"]'))return;event.preventDefault();const index=tabs.findIndex(tab=>tab.id===active);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;activate(tabs[next].id);$('[role="tab"][aria-selected="true"]',tabList).focus();};
  win.el.addEventListener('keydown',event=>{if(event.key==='F5'){event.preventDefault();event.stopPropagation();clearError();loadPage(activeTab());}else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='l'){event.preventDefault();event.stopPropagation();address.focus();address.select();}else if(event.altKey&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopPropagation();$('.browser-'+(event.key==='ArrowLeft'?'back':'forward'),win.content).click();}});
  const focusFrame=()=>{if(tabs.some(tab=>tab.frame===document.activeElement))focusWindow(win.id);};window.addEventListener('blur',focusFrame);
  win.navigateBrowser=raw=>newTab(raw);
  win.cleanup=()=>{disposed=true;tabs.forEach(clearPage);window.removeEventListener('blur',focusFrame);delete win.navigateBrowser;};
  newTab(options.url||HOME);
}
const api={HOME,resolveAddress,createHistory,mount};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
global.Windows12Browser=api;
})(globalThis);
