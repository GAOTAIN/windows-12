(function(global){
'use strict';
global.initWorkspaceUI=function(runtime){
  const {$,$$,art,symbol,openApp,windows,closeWindow,toast,closeOverlays,getActiveId,updateTasks}=runtime;
  const fs=global.DesktopFS;
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const context=$('#context-menu');
  let selectedDesktop=null,clipboard=null,renameActive=false,cancelFileDrag=null;
  const roots=[['desktop','桌面','monitor'],['documents','文档','document'],['pictures','图片','image'],['downloads','下载','download']];
  const isBatch=global.Windows12Batch.isBatch;
  const typeOf=node=>isBatch(node)?(/\.cmd$/i.test(node.name)?'Windows 命令脚本':'Windows 批处理文件'):names[node.kind];
  const names={folder:'文件夹',text:'文本文档',shortcut:'快捷方式',image:'SVG 图像'};
  const iconOf=node=>node.kind==='folder'?'files':node.kind==='text'?(isBatch(node)?'batch':'text'):node.kind==='image'?'photos':node.target?.type==='app'?node.target.value:'files';
  const nodeArt=node=>`<span class="node-art">${art(iconOf(node))}${node.kind==='shortcut'?'<span class="shortcut-badge" aria-hidden="true">↗</span>':''}</span>`;
  function parentOfRoute(route){return fs.get(route)?.kind==='folder'&&!fs.isTrashed(route)?route:'desktop';}
  function safely(action){try{return action();}catch(error){toast(error.message||'操作失败，请重试。');return null;}}
  function dateLabel(value){return new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});}
  function sizeLabel(node){if(node.kind==='folder')return'—';if(node.kind==='shortcut')return'1 KB';const size=new Blob([node.content||'']).size;return size<1024?size+' B':Math.ceil(size/1024)+' KB';}
  function updateDesktopRows(){
    const host=$('#desktop-icons'),style=getComputedStyle(host),top=parseFloat(style.top)||24;
    const available=$('#taskbar').getBoundingClientRect().top-12-top;
    const gap=parseFloat(style.rowGap)||6,padding=(parseFloat(style.paddingTop)||0)+(parseFloat(style.paddingBottom)||0);
    document.documentElement.style.setProperty('--desktop-rows',Math.max(1,Math.floor((available-padding+gap)/(98+gap))));
    host.style.maxHeight=Math.max(98+padding,available)+'px';host.scrollTop=0;
  }
  function renderDesktop(){
    const host=$('#desktop-icons');$$('.desktop-item',host).forEach(el=>el.remove());
    for(const node of fs.list('desktop')){
      const item=document.createElement('div');item.className='desktop-icon desktop-item';item.dataset.nodeId=node.id;item.tabIndex=0;item.setAttribute('role','button');item.setAttribute('aria-label','打开 '+node.name);item.setAttribute('aria-pressed',String(selectedDesktop===node.id));
      if(clipboard?.mode==='cut'&&clipboard.id===node.id)item.classList.add('is-cut');
      item.innerHTML=nodeArt(node)+`<span class="app-label">${escape(node.name)}</span>`;
      item.onclick=event=>{if(event.target.closest('input'))return;selectDesktop(node.id);};
      item.ondblclick=event=>{if(!event.target.closest('input'))openNode(node.id);};
      item.onkeydown=event=>{if(event.target.closest('input'))return;if(event.key==='Enter'){event.preventDefault();event.stopPropagation();openNode(node.id);}};
      item.oncontextmenu=event=>{selectDesktop(node.id);showContext(event,{parentId:'desktop',id:node.id,scope:'desktop'});};
      bindFileDrag(item,node.id,()=>selectDesktop(node.id));
      host.append(item);
    }
    updateDesktopRows();
  }
  // Pointer capture keeps the file attached to the cursor across desktop/window boundaries.
  // Only an exposed recycle target accepts a drop; every other release leaves files unchanged.
  function bindFileDrag(source,id,select){
    source.classList.add('file-draggable');
    source.addEventListener('dragstart',event=>event.preventDefault());
    source.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.isPrimary===false||renameActive||document.body.classList.contains('is-locked')||event.target.closest('input,textarea,button,select,[contenteditable]'))return;
      const node=fs.get(id);if(!node||fs.isRoot(id)||fs.isTrashed(id))return;
      cancelFileDrag?.();
      const startX=event.clientX,startY=event.clientY,pointerId=event.pointerId;
      let moved=false,finished=false,ghost=null,dropTarget=null;
      function targetAt(x,y){
        const hit=document.elementFromPoint(x,y);
        return hit?.closest('#desktop-icons>.desktop-icon[data-app="recycle"],.window[data-app="recycle"] .window-content')||null;
      }
      function updateTarget(next){
        if(dropTarget===next)return;
        dropTarget?.classList.remove('recycle-drop-target');dropTarget=next;
        dropTarget?.classList.add('recycle-drop-target');
        ghost?.classList.toggle('can-drop',!!dropTarget);
        if(ghost)$('.file-drag-action',ghost).textContent=dropTarget?'移到 回收站':'拖到回收站以删除';
      }
      function move(current){
        if(current.pointerId!==pointerId||finished)return;
        if(!moved&&Math.hypot(current.clientX-startX,current.clientY-startY)<6)return;
        current.preventDefault();
        if(!source.isConnected||document.body.classList.contains('is-locked')){finish(false);return;}
        if(!moved){
          moved=true;select();closeOverlays();source.classList.add('file-drag-source');
          document.body.classList.add('file-dragging');
          ghost=document.createElement('div');ghost.className='glass file-drag-preview';ghost.setAttribute('aria-hidden','true');
          ghost.innerHTML=nodeArt(node)+`<div><strong>${escape(node.name)}</strong><span class="file-drag-action">拖到回收站以删除</span></div>`;
          document.body.append(ghost);source.setPointerCapture(pointerId);
          $('#file-drag-status').textContent='正在拖动“'+node.name+'”，拖到回收站删除，按 Escape 取消。';
        }
        // Clamp the preview independently of hit testing, so edge targets remain usable.
        const x=Math.max(8,Math.min(current.clientX+18,innerWidth-ghost.offsetWidth-8));
        const y=Math.max(8,Math.min(current.clientY+18,innerHeight-ghost.offsetHeight-8));
        ghost.style.left=x+'px';ghost.style.top=y+'px';
        updateTarget(targetAt(current.clientX,current.clientY));
      }
      function suppressClick(event){event.preventDefault();event.stopImmediatePropagation();}
      function finish(accept,current){
        if(finished)return;finished=true;
        const destination=accept&&moved&&current&&targetAt(current.clientX,current.clientY);
        document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);
        document.removeEventListener('pointercancel',cancel,true);document.removeEventListener('keydown',key,true);
        window.removeEventListener('blur',cancel);window.removeEventListener('resize',cancel);
        source.removeEventListener('lostpointercapture',cancel);
        if(source.hasPointerCapture(pointerId))source.releasePointerCapture(pointerId);
        source.classList.remove('file-drag-source');document.body.classList.remove('file-dragging');
        dropTarget?.classList.remove('recycle-drop-target');ghost?.remove();cancelFileDrag=null;
        if(moved){
          // The release must not activate the source icon or open the recycle bin.
          document.addEventListener('click',suppressClick,true);
          setTimeout(()=>document.removeEventListener('click',suppressClick,true),0);
          $('#file-drag-status').textContent=destination?'已放入回收站。':'拖动已取消，项目保留在原位置。';
          if(destination&&!document.body.classList.contains('is-locked')&&!fs.isTrashed(id))removeNode(id);
        }
      }
      function up(current){if(current.pointerId===pointerId)finish(true,current);}
      function cancel(current){if(current?.pointerId!==undefined&&current.pointerId!==pointerId)return;finish(false);}
      function key(current){
        if(current.key==='Escape'){current.preventDefault();current.stopImmediatePropagation();finish(false);}
        else if(moved){current.preventDefault();current.stopImmediatePropagation();}
      }
      cancelFileDrag=()=>finish(false);
      document.addEventListener('pointermove',move,{capture:true,passive:false});document.addEventListener('pointerup',up,true);
      document.addEventListener('pointercancel',cancel,true);document.addEventListener('keydown',key,true);
      source.addEventListener('lostpointercapture',cancel);window.addEventListener('blur',cancel);window.addEventListener('resize',cancel);
    });
  }
  function selectDesktop(id){selectedDesktop=id;$$('.desktop-item').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.nodeId===id)));}
  function focusItem(id,scope){requestAnimationFrame(()=>{const host=scope==='desktop'?$('#desktop-icons'):windows.get('files')?.content;host?.querySelector(`[data-node-id="${id}"]`)?.focus({preventScroll:false});});}
  function refreshViews(){
    const focused=document.activeElement?.closest("[data-node-id]");
    const focusedId=focused?.dataset.nodeId,focusedScope=focused?.closest("#desktop-icons")?"desktop":"files";
    renderDesktop();
    for(const win of [...windows.values()]){
      if(win.id==='files')renderFiles(win,win.folder||'主页',false);
      if(win.id==='recycle')renderRecycle(win);
      if(win.id.startsWith('text:')){
        const node=fs.get(win.id.slice(5));
        if(!node||fs.isTrashed(node.id)){closeWindow(win.id);continue;}
        $('.window-title span',win.el).textContent=node.name;win.el.setAttribute('aria-label',node.name);
        const run=$('.run-batch',win.content);if(run)run.hidden=!isBatch(node);
        const use=$('.window-title use',win.el);if(use)use.setAttribute('href','#i-'+(isBatch(node)?'batch':'text'));
        const task=document.querySelector('.task-app[data-app="'+win.id+'"] use');if(task)task.setAttribute('href','#i-'+(isBatch(node)?'batch':'text'));
        const editor=$('.text-file-editor',win.content);if(editor&&document.activeElement!==editor)editor.value=node.content||'';
      }
    }
    updateTasks();
    if(focusedId){const host=focusedScope==="desktop"?$("#desktop-icons"):windows.get("files")?.content;host?.querySelector(`[data-node-id="${focusedId}"]`)?.focus({preventScroll:true});}
  }
  function createItem(kind,parentId,scope){
    closeOverlays();
    if(kind==='shortcut'){showShortcutDialog(parentId,scope);return;}
    const node=safely(()=>kind==='batch'||kind==='cmd'?fs.create('text',parentId,kind==='cmd'?'新建命令脚本.cmd':'新建批处理文件.bat',{content:'@echo off\necho 欢迎使用 Windows 12！\npause\n'}):fs.create(kind,parentId));if(!node)return;
    if(scope==='desktop')selectedDesktop=node.id;
    const fileWin=windows.get('files');if(scope==='files'&&fileWin){fileWin.selectedFileId=node.id;renderFiles(fileWin,parentId);}
    renderDesktop();beginRename(node.id,scope);
  }
  function beginRename(id,scope){
    const node=fs.get(id);if(!node||fs.isRoot(id)||fs.isTrashed(id))return;
    closeOverlays();
    const host=scope==='desktop'?$('#desktop-icons'):windows.get('files')?.content;
    const item=host?.querySelector(`[data-node-id="${id}"]`);if(!item)return;
    const label=scope==='desktop'?$('.app-label',item):$('.file-name-text',item);if(!label)return;
    const input=document.createElement('input');input.className='rename-input';input.setAttribute('aria-label','重命名项目');input.value=node.name;input.maxLength=120;
    label.replaceWith(input);renameActive=true;let finished=false;
    const finish=cancel=>{
      if(finished)return;finished=true;
      if(!cancel&&input.value!==node.name){try{fs.rename(id,input.value);}catch(error){finished=false;toast(error.message);requestAnimationFrame(()=>input.focus());return;}}
      renameActive=false;refreshViews();focusItem(id,scope);
    };
    input.onkeydown=event=>{event.stopPropagation();if(event.key==='Enter'){event.preventDefault();finish(false);}else if(event.key==='Escape'){event.preventDefault();finish(true);}};
    input.onpointerdown=event=>event.stopPropagation();input.onclick=event=>event.stopPropagation();input.ondblclick=event=>event.stopPropagation();input.onblur=()=>finish(false);
    requestAnimationFrame(()=>{input.focus();const dot=node.kind==='folder'?-1:node.name.lastIndexOf('.');input.setSelectionRange(0,dot>0?dot:node.name.length);});
  }
  function removeNode(id){const node=safely(()=>fs.remove(id));if(node){if(selectedDesktop===id)selectedDesktop=null;toast('已将“'+node.name+'”移到回收站');}}
  function copyNode(id,mode){const node=fs.get(id);if(!node||fs.isRoot(id)||fs.isTrashed(id))return;clipboard={id,mode};refreshViews();toast(mode==='cut'?'已剪切，选择目标文件夹后粘贴':'已复制，选择目标文件夹后粘贴');}
  function paste(parentId,scope){if(!clipboard)return;const node=safely(()=>clipboard.mode==='cut'?fs.move(clipboard.id,parentId):fs.copy(clipboard.id,parentId));if(!node)return;if(clipboard.mode==='cut')clipboard=null;if(scope==='desktop')selectedDesktop=node.id;const win=windows.get('files');if(scope==='files'&&win){win.selectedFileId=node.id;renderFiles(win,parentId);}refreshViews();focusItem(node.id,scope);}
  function downloadText(id){const node=fs.get(id);if(node?.kind!=='text')return;const url=URL.createObjectURL(new Blob([node.content||''],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=node.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function openNode(id,visited=new Set()){
    if(visited.has(id)){toast('快捷方式目标形成循环，无法打开。');return;}visited.add(id);
    const node=fs.get(id);if(!node||fs.isTrashed(id)){toast('找不到快捷方式指向的项目。');return;}
    closeOverlays();
    if(node.kind==='folder'){openApp('files',{folder:id});return;}
    if(node.kind==='text'){if(isBatch(node))openApp('terminal',{batchId:id});else openApp('text:'+id);return;}
    if(node.kind==='image'){openApp('photos');return;}
    if(node.kind==='shortcut'){
      if(node.target?.type==='app'){openApp(node.target.value);return;}
      if(node.target?.type==='node'){openNode(node.target.value,visited);return;}
      if(node.target?.type==='url'){try{const url=new URL(node.target.value);if(!['https:','http:'].includes(url.protocol))throw new Error();openApp('edge',{url:url.href});}catch{toast('快捷方式的网址无效。');}return;}
      toast('快捷方式目标不可用。');
    }
  }
  function positionMenu(x,y){context.classList.add('open');context.inert=false;const width=context.offsetWidth,height=context.offsetHeight;context.style.left=Math.max(12,Math.min(x,innerWidth-width-12))+'px';context.style.top=Math.max(12,Math.min(y,innerHeight-height-12))+'px';}
  function menuButton(label,icon,action,options={}){const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.disabled=!!options.disabled;button.innerHTML=symbol(icon)+`<span>${escape(label)}</span>${options.hint?`<span class="menu-key">${escape(options.hint)}</span>`:''}`;button.onclick=event=>{event.stopPropagation();action();};return button;}
  function separator(){const line=document.createElement('div');line.className='menu-separator';line.setAttribute('role','separator');context.append(line);}
  function creationButtons(parentId,scope,host){for(const[kind,label,icon]of[['folder','文件夹','files'],['shortcut','快捷方式','next'],['text','文本文档','document'],['batch','Windows 批处理文件 (.bat)','document'],['cmd','Windows 命令脚本 (.cmd)','document']]){const button=menuButton(label,icon,()=>createItem(kind,parentId,scope));if(kind==='folder')button.innerHTML=nodeArt({kind:'folder'})+'<span>文件夹</span>';button.dataset.createKind=kind;host.append(button);}}
  function showCreateMenu(anchor,parentId,scope){closeOverlays();context.replaceChildren();creationButtons(parentId,scope,context);const rect=anchor.getBoundingClientRect();positionMenu(rect.left,rect.bottom+4);requestAnimationFrame(()=>$('button',context).focus());}
  function showContext(event,{parentId='desktop',id=null,scope='desktop'}={}){
    event.preventDefault();event.stopPropagation();closeOverlays();context.replaceChildren();const node=id?fs.get(id):null;
    if(node){context.append(menuButton(isBatch(node)?'运行':'打开',node.kind==='folder'?'files':'document',()=>openNode(id)),menuButton('剪切','document',()=>{closeOverlays();copyNode(id,'cut');},{hint:'Ctrl+X'}),menuButton('复制','document',()=>{closeOverlays();copyNode(id,'copy');},{hint:'Ctrl+C'}),menuButton('重命名','document',()=>beginRename(id,scope),{hint:'F2'}),menuButton('删除','close',()=>{closeOverlays();removeNode(id);},{hint:'Del'}));if(isBatch(node))context.append(menuButton('编辑','document',()=>{closeOverlays();openApp('text:'+id);}));if(node.kind==='text')context.append(menuButton('下载文件','download',()=>{closeOverlays();downloadText(id);}));separator();}
    else context.append(menuButton('刷新','refresh',()=>{closeOverlays();refreshViews();toast('已刷新');}));
    context.append(menuButton('粘贴','document',()=>{closeOverlays();paste(parentId,scope);},{disabled:!clipboard,hint:'Ctrl+V'}));
    const newButton=menuButton('新建','plus',()=>openSubmenu(true),{hint:'›'});newButton.className='context-new';newButton.setAttribute('aria-haspopup','menu');newButton.setAttribute('aria-expanded','false');context.append(newButton);
    const submenu=document.createElement('div');submenu.className='glass context-submenu';submenu.setAttribute('role','menu');submenu.setAttribute('aria-label','新建');submenu.hidden=true;submenu.inert=true;creationButtons(parentId,scope,submenu);context.append(submenu);
    function openSubmenu(focus){submenu.hidden=false;submenu.inert=false;newButton.setAttribute('aria-expanded','true');const parent=context.getBoundingClientRect(),width=submenu.offsetWidth,height=submenu.offsetHeight;let x=parent.right+4;if(x+width>innerWidth-12)x=parent.left-width-4;if(x<12)x=Math.max(12,innerWidth-width-12);const y=Math.max(12,Math.min(parent.top+newButton.offsetTop,innerHeight-height-12));submenu.style.left=x-parent.left+'px';submenu.style.top=y-parent.top+'px';if(focus)requestAnimationFrame(()=>$('button',submenu).focus());}
    newButton.onpointerenter=()=>openSubmenu(false);newButton.onkeydown=key=>{if(key.key==='ArrowRight'){key.preventDefault();key.stopPropagation();openSubmenu(true);}};
    if(!node&&scope==='desktop'){separator();context.append(menuButton('显示设置','monitor',()=>openApp('settings')),menuButton('个性化','sun',()=>openApp('settings')));}
    positionMenu(event.clientX,event.clientY);requestAnimationFrame(()=>$('button:not(:disabled)',context)?.focus());
  }
  context.addEventListener('keydown',event=>{
    const sub=event.target.closest('.context-submenu');
    if(event.key==='ArrowLeft'&&sub){event.preventDefault();event.stopPropagation();sub.hidden=true;sub.inert=true;$('.context-new',context).setAttribute('aria-expanded','false');$('.context-new',context).focus();return;}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();const host=sub||context,items=[...host.children].filter(el=>el.tagName==='BUTTON'&&!el.disabled),index=items.indexOf(document.activeElement);items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus();}
    if(event.key==='Escape'&&sub){event.preventDefault();event.stopPropagation();sub.hidden=true;sub.inert=true;$('.context-new',context).setAttribute('aria-expanded','false');$('.context-new',context).focus();}
  });
  function showShortcutDialog(parentId,scope){
    let dialog=$('#shortcut-dialog');if(dialog)dialog.remove();dialog=document.createElement('dialog');dialog.id='shortcut-dialog';dialog.className='glass file-dialog';dialog.setAttribute('aria-labelledby','shortcut-heading');
    dialog.innerHTML=`<form id="shortcut-form" novalidate><h2 id="shortcut-heading">创建快捷方式</h2><p>选择此快捷方式要打开的项目。</p><label>快捷方式类型<select id="shortcut-type"><option value="app">应用</option><option value="node">文件或文件夹</option><option value="url">网址</option></select></label><label class="shortcut-target" data-target-type="app">目标应用<select id="shortcut-app">${runtime.apps.map(app=>`<option value="${app.id}">${escape(app.name)}</option>`).join('')}</select></label><label class="shortcut-target" data-target-type="node" hidden>目标文件或文件夹<select id="shortcut-node">${fs.all().filter(node=>node.kind!=='shortcut').map(node=>`<option value="${node.id}">${escape(fs.path(node.id))}</option>`).join('')}</select></label><label class="shortcut-target" data-target-type="url" hidden>项目位置<input id="shortcut-url" type="url" placeholder="https://example.com" autocomplete="off"></label><label>快捷方式名称<input id="shortcut-name" maxlength="116" autocomplete="off"></label><p class="dialog-error" role="alert"></p><footer><button type="button" class="cancel-shortcut">取消</button><button type="submit" class="primary-button">完成</button></footer></form>`;
    document.body.append(dialog);let customName=false;const name=$('#shortcut-name',dialog);name.value='文件资源管理器';
    name.oninput=()=>{customName=true;};
    function suggest(){if(customName)return;const type=$('#shortcut-type',dialog).value;name.value=type==='app'?runtime.apps.find(app=>app.id===$('#shortcut-app',dialog).value).name:type==='node'?fs.get($('#shortcut-node',dialog).value)?.name||'新建快捷方式':'网站快捷方式';}
    $('#shortcut-type',dialog).onchange=()=>{$$('.shortcut-target',dialog).forEach(label=>label.hidden=label.dataset.targetType!==$('#shortcut-type',dialog).value);suggest();};$('#shortcut-app',dialog).onchange=suggest;$('#shortcut-node',dialog).onchange=suggest;
    $('.cancel-shortcut',dialog).onclick=()=>dialog.close();dialog.addEventListener('keydown',event=>event.stopPropagation());
    $('form',dialog).onsubmit=event=>{event.preventDefault();const type=$('#shortcut-type',dialog).value;let value=type==='app'?$('#shortcut-app',dialog).value:type==='node'?$('#shortcut-node',dialog).value:$('#shortcut-url',dialog).value.trim();if(type==='url'&&!/^[a-z][a-z\d+.-]*:/i.test(value))value='https://'+value;let label=name.value.trim();if(!label){$('.dialog-error',dialog).textContent='请输入快捷方式名称。';name.focus();return;}if(!label.toLowerCase().endsWith('.lnk'))label+='.lnk';try{const node=fs.create('shortcut',parentId,label,{target:{type,value}});if(scope==='desktop')selectedDesktop=node.id;else{const win=windows.get('files');if(win){win.selectedFileId=node.id;renderFiles(win,parentId);}}renderDesktop();dialog.close();focusItem(node.id,scope);}catch(error){$('.dialog-error',dialog).textContent=error.message;}};
    dialog.showModal();requestAnimationFrame(()=>$('#shortcut-app',dialog).focus());
  }
  function renderFiles(win,folder='主页',recordHistory=true){
    const aliases={'桌面':'desktop','文档':'documents','图片':'pictures','下载':'downloads'};folder=aliases[folder]||folder;
    const main=folder==='主页'||folder==='此电脑';if(!main&&(!fs.get(folder)||fs.isTrashed(folder)))folder='desktop';
    win.fileHistory=win.fileHistory||[];if(recordHistory&&win.folder&&win.folder!==folder)win.fileHistory.push(win.folder);win.folder=folder;
    const isHome=folder==='主页'||folder==='此电脑',parentId=parentOfRoute(folder),title=isHome?folder:fs.get(folder).name;
    const items=isHome?fs.all().filter(node=>node.kind!=='folder').sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt)).slice(0,12):fs.list(folder);
    if(win.selectedFileId&&!items.some(node=>node.id===win.selectedFileId))win.selectedFileId=null;
    const selected=fs.get(win.selectedFileId),nav=(id,label,icon)=>`<button class="sidebar-button ${folder===id?'selected':''}" data-route="${id}" aria-label="${escape(label)}">${symbol(icon)}<span>${escape(label)}</span></button>`;
    win.content.innerHTML=`<div class="explorer-toolbar"><button class="icon-button files-back" aria-label="后退" ${win.fileHistory.length?'':'disabled'}>${symbol('back')}</button><button class="icon-button files-up" aria-label="上一级" ${isHome?'disabled':''}>${symbol('up')}</button><button class="icon-button files-refresh" aria-label="刷新文件">${symbol('refresh')}</button><div class="breadcrumb">${symbol(isHome?'home':'files')}<span class="chevron">›</span><span class="breadcrumb-path" title="${escape(isHome?title:fs.path(folder))}">${escape(isHome?title:fs.path(folder))}</span></div><label class="explorer-search">${symbol('search')}<input placeholder="搜索${escape(title)}" aria-label="搜索当前文件夹"></label></div><div class="files-commands"><button class="files-new">${symbol('plus')}新建 <span>⌄</span></button><span class="command-divider"></span><button data-file-command="cut" ${selected?'':'disabled'} title="剪切 Ctrl+X">${symbol('document')}<span>剪切</span></button><button data-file-command="copy" ${selected?'':'disabled'} title="复制 Ctrl+C">${symbol('document')}<span>复制</span></button><button data-file-command="paste" ${clipboard?'':'disabled'} title="粘贴 Ctrl+V">${symbol('document')}<span>粘贴</span></button><button data-file-command="rename" ${selected?'':'disabled'} title="重命名 F2">${symbol('document')}<span>重命名</span></button><button data-file-command="delete" ${selected?'':'disabled'} title="删除 Delete">${symbol('close')}<span>删除</span></button></div><div class="explorer-body"><aside class="explorer-sidebar"><div class="sidebar-label">快速访问</div>${nav('主页','主页','home')}${roots.map(([id,label,icon])=>nav(id,label,icon)).join('')}<div class="sidebar-space"></div>${nav('此电脑','此电脑','monitor')}<div class="storage-meter">浏览器本地存储<br><span>${fs.all().length-4} 个项目 · 自动保留</span></div></aside><div class="explorer-main"><div class="explorer-welcome"><div><h1>${escape(title)}</h1><p>${isHome?'常用文件夹和最近使用的文件':'可在此新建、打开和整理文件。'}</p></div></div>${isHome?`<div class="content-heading"><h2>快速访问</h2><span>已固定</span></div><div class="folder-grid">${roots.map(([id,label])=>`<button class="folder-card" data-route="${id}">${art('files')}<span><strong>${escape(label)}</strong><small>${fs.list(id).length} 个项目</small></span></button>`).join('')}</div>`:''}<div class="content-heading"><h2>${isHome?'最近':'文件'}</h2><span>${items.length} 个项目</span></div><div class="file-results">${items.length?`<table class="file-table"><thead><tr><th>名称</th><th>${isHome?'位置':'类型'}</th><th>修改时间</th><th>大小</th></tr></thead><tbody>${items.map(node=>`<tr data-node-id="${node.id}" tabindex="0" class="${win.selectedFileId===node.id?'selected ':''}${clipboard?.mode==='cut'&&clipboard.id===node.id?'is-cut':''}" aria-label="打开 ${escape(node.name)}"><td><span class="file-name">${nodeArt(node)}<span class="file-name-text">${escape(node.name)}</span></span></td><td>${escape(isHome?fs.get(node.parentId)?.name||'':typeOf(node))}</td><td>${dateLabel(node.modifiedAt)}</td><td>${sizeLabel(node)}</td></tr>`).join('')}</tbody></table><p class="file-no-results" hidden>没有符合条件的项目。</p>`:`<div class="empty-folder">${art('files')}<p>此文件夹为空</p><small>右键空白处或点击“新建”创建项目。</small></div>`}</div></div></div><footer class="explorer-status"><span>${selected?'已选择 '+escape(selected.name):items.length+' 个项目'}</span><span>保存在当前浏览器</span></footer>`;
    $$('[data-route]',win.content).forEach(button=>button.onclick=()=>renderFiles(win,button.dataset.route));
    $('.files-back',win.content).onclick=()=>renderFiles(win,win.fileHistory.pop()||'主页',false);
    $('.files-up',win.content).onclick=()=>renderFiles(win,fs.get(folder)?.parentId||'主页');
    $('.files-refresh',win.content).onclick=()=>{renderFiles(win,win.folder,false);toast('文件已刷新');};
    $('.files-new',win.content).onclick=event=>showCreateMenu(event.currentTarget,parentId,'files');
    function selectFile(id){win.selectedFileId=id;$$('tr[data-node-id]',win.content).forEach(row=>row.classList.toggle('selected',row.dataset.nodeId===id));$$('[data-file-command]',win.content).forEach(button=>{if(button.dataset.fileCommand!=='paste')button.disabled=!id;});$('.explorer-status span',win.content).textContent=fs.get(id)?'已选择 '+fs.get(id).name:items.length+' 个项目';}
    $$('tr[data-node-id]',win.content).forEach(row=>{row.onclick=event=>{if(!event.target.closest('input'))selectFile(row.dataset.nodeId);};row.ondblclick=event=>{if(!event.target.closest('input'))openNode(row.dataset.nodeId);};row.onkeydown=event=>{if(event.key==='Enter'&&!event.target.closest('input')){event.preventDefault();event.stopPropagation();openNode(row.dataset.nodeId);}};row.oncontextmenu=event=>{selectFile(row.dataset.nodeId);showContext(event,{parentId,id:row.dataset.nodeId,scope:'files'});};bindFileDrag(row,row.dataset.nodeId,()=>selectFile(row.dataset.nodeId));});
    $('.explorer-main',win.content).oncontextmenu=event=>{if(!event.target.closest('input'))showContext(event,{parentId,scope:'files'});};
    $$('[data-file-command]',win.content).forEach(button=>button.onclick=()=>{const id=win.selectedFileId;switch(button.dataset.fileCommand){case'cut':copyNode(id,'cut');break;case'copy':copyNode(id,'copy');break;case'paste':paste(parentId,'files');break;case'rename':beginRename(id,'files');break;case'delete':removeNode(id);break;}});
    $('.explorer-search input',win.content).oninput=event=>{const term=event.target.value.toLocaleLowerCase();let count=0;$$('tr[data-node-id]',win.content).forEach(row=>{row.hidden=!fs.get(row.dataset.nodeId).name.toLocaleLowerCase().includes(term);if(!row.hidden)count++;});const empty=$('.file-no-results',win.content);if(empty)empty.hidden=count!==0;$('.explorer-status span',win.content).textContent=count+' 个项目';};
  }
  function renderTextFile(win){
    const node=fs.get(win.id.slice(5));if(!node||node.kind!=='text'||fs.isTrashed(node.id)){win.content.innerHTML='<div class="empty-folder">找不到此文本文档。</div>';return;}
    win.content.innerHTML=`<div class="text-file-toolbar"><button class="save-text">${symbol('document')}保存 <kbd>Ctrl+S</kbd></button><button class="download-text">${symbol('download')}下载文件</button><button class="run-batch" ${isBatch(node)?'':'hidden'}>${symbol('play')}运行</button><span>记事本</span></div><textarea class="text-file-editor" aria-label="文本文档内容" spellcheck="false" placeholder="在这里输入内容…"></textarea><footer class="text-file-status" role="status"></footer>`;
    const editor=$('.text-file-editor',win.content),status=$('.text-file-status',win.content);editor.value=node.content||'';
    const save=()=>{try{fs.writeText(node.id,editor.value);status.textContent='已自动保存 · '+editor.value.length+' 字 · UTF-8';return true;}catch(error){status.textContent='保存失败：'+error.message;return false;}};
    editor.oninput=save;editor.onkeydown=event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();event.stopPropagation();if(save())toast('文本文档已保存');}};
    $('.save-text',win.content).onclick=()=>{if(save())toast('文本文档已保存');};$('.download-text',win.content).onclick=()=>{if(save())downloadText(node.id);};
    $('.run-batch',win.content).onclick=()=>{if(save())openApp('terminal',{batchId:node.id});};
    status.textContent='已保存在当前浏览器 · '+editor.value.length+' 字 · UTF-8';
  }
  function renderRecycle(win){
    const items=fs.trash();win.content.innerHTML=`<div class="app-page"><h1>回收站</h1><p class="recycle-drop-hint">可将文件拖到此窗口或桌面回收站图标。</p><p>${items.length?'可还原已删除的项目。':'回收站是空的。'}</p><div class="recycle-list">${items.map(node=>`<div class="recycle-entry">${nodeArt(node)}<div><strong>${escape(node.name)}</strong><small>原位置：${escape(fs.path(node.originalParentId))}</small></div><button data-restore-node="${node.id}">还原</button></div>`).join('')}</div></div>`;
    $$('[data-restore-node]',win.content).forEach(button=>button.onclick=()=>{const node=safely(()=>fs.restore(button.dataset.restoreNode));if(node)toast('已还原“'+node.name+'”');});
  }
  $('#desktop').addEventListener('contextmenu',event=>{if(event.target.closest('.window,.desktop-item,input,textarea'))return;showContext(event,{parentId:'desktop',scope:'desktop'});});
  $('#desktop').addEventListener('click',event=>{if(!event.target.closest('.desktop-icon,.window'))selectDesktop(null);});
  document.addEventListener('keydown',event=>{
    if(document.body.classList.contains('is-locked')||event.defaultPrevented||event.target.closest('input,textarea,select,[contenteditable]')||document.querySelector('dialog[open]')||renameActive)return;
    const inDesktop=!!event.target.closest('#desktop-icons')||(!event.target.closest('.window')&&!event.target.closest('#taskbar'));
    const win=windows.get('files'),scope=inDesktop?'desktop':getActiveId()==='files'?'files':null;if(!scope)return;
    const id=scope==='desktop'?selectedDesktop:win?.selectedFileId,parentId=scope==='desktop'?'desktop':parentOfRoute(win?.folder),ctrl=event.ctrlKey||event.metaKey;
    let handled=true;
    if(ctrl&&event.shiftKey&&event.key.toLowerCase()==='n')createItem('folder',parentId,scope);
    else if(event.key==='F2'&&id)beginRename(id,scope);
    else if(event.key==='Delete'&&id)removeNode(id);
    else if(ctrl&&event.key.toLowerCase()==='x'&&id)copyNode(id,'cut');
    else if(ctrl&&event.key.toLowerCase()==='c'&&id)copyNode(id,'copy');
    else if(ctrl&&event.key.toLowerCase()==='v')paste(parentId,scope);
    else handled=false;
    if(handled){event.preventDefault();event.stopImmediatePropagation();}
  });
  // Clipboard events also cover browsers that reserve Ctrl+C / Ctrl+X / Ctrl+V.
  for(const action of ['copy','cut','paste'])document.addEventListener(action,event=>{
    const target=document.activeElement;
    if(document.body.classList.contains('is-locked')||target?.closest('input,textarea,select,[contenteditable]')||document.querySelector('dialog[open]'))return;
    if(target?.closest('.window')&&!target.closest('.window[data-app="files"]'))return;
    const win=windows.get('files'),inFiles=!!target?.closest('.window[data-app="files"]');
    const scope=inFiles?'files':'desktop',id=inFiles?win?.selectedFileId:selectedDesktop;
    if(action==='paste'){
      if(!clipboard)return;event.preventDefault();paste(inFiles?parentOfRoute(win?.folder):'desktop',scope);
    }else if(id){
      event.preventDefault();event.clipboardData?.setData('text/plain',fs.get(id)?.name||'');copyNode(id,action==='cut'?'cut':'copy');
    }
  });
  const dragStatus=document.createElement('div');dragStatus.id='file-drag-status';dragStatus.className='visually-hidden';dragStatus.setAttribute('role','status');dragStatus.setAttribute('aria-live','polite');document.body.append(dragStatus);
  $('#desktop-icons>.desktop-icon[data-app="recycle"]').title='回收站 · 可拖入文件、文件夹和快捷方式';
  fs.subscribe(()=>{cancelFileDrag?.();if(clipboard&&fs.isTrashed(clipboard.id))clipboard=null;if(selectedDesktop&&fs.isTrashed(selectedDesktop))selectedDesktop=null;refreshViews();});
  window.addEventListener('resize',updateDesktopRows);
  renderDesktop();
  return {renderFiles,renderTextFile,renderRecycle,refresh:refreshViews};
};
})(window);
