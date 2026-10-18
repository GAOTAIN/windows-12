(function (global) {
  'use strict';
  function createDesktopFileSystem(storage) {
    const key = 'w12-filesystem-v1';
    const roots = new Set(['desktop', 'documents', 'pictures', 'downloads']);
    const apps = new Set(['files','edge','photos','store','settings','notes','terminal','calendar','calculator','music','clock','recycle']);
    const clone = value => JSON.parse(JSON.stringify(value));
    const listeners = new Set();
    let sequence = 0;
    const now = () => new Date().toISOString();
    const id = () => 'item-' + (global.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + (++sequence).toString(36));
    function seed() {
      const time = now();
      return {version: 1, nodes: [
        ...[['desktop','桌面'],['documents','文档'],['pictures','图片'],['downloads','下载']].map(([id,name]) => ({id,name,kind:'folder',parentId:null,createdAt:time,modifiedAt:time})),
        {id:'welcome-text',parentId:'documents',kind:'text',name:'从这里开始.txt',content:'欢迎使用 Windows 12 网页桌面。\n\n右键桌面 → 新建，可以创建文件夹、文本文档和快捷方式。\n双击文本文档即可编辑，内容会自动保存在当前浏览器中。\n文件夹内也可以新建项目，或通过剪切、复制和粘贴整理文件。\n',createdAt:time,modifiedAt:time},
        {id:'ideas-text',parentId:'documents',kind:'text',name:'灵感与想法.txt',content:'记录新的想法。\n',createdAt:time,modifiedAt:time},
        {id:'land-image',parentId:'pictures',kind:'image',name:'晨雾与山谷.svg',content:'land',createdAt:time,modifiedAt:time},
        {id:'glass-image',parentId:'pictures',kind:'image',name:'玻璃与光影.svg',content:'',createdAt:time,modifiedAt:time}
      ]};
    }
    function validState(value) {
      if (!value || value.version !== 1 || !Array.isArray(value.nodes)) return false;
      const ids = new Set();
      for (const node of value.nodes) {
        if (!node || typeof node.id !== 'string' || ids.has(node.id) || typeof node.name !== 'string' || !['folder','text','shortcut','image'].includes(node.kind)) return false;
        ids.add(node.id);
      }
      if (![...roots].every(root => value.nodes.some(n => n.id === root && n.kind === 'folder' && n.parentId === null))) return false;
      for (const node of value.nodes) {
        const seen = new Set([node.id]);
        let parent = node.parentId;
        while (parent !== null) {
          const ancestor = value.nodes.find(n => n.id === parent);
          if (!ancestor || ancestor.kind !== 'folder' || seen.has(parent)) return false;
          seen.add(parent);
          parent = ancestor.parentId;
        }
      }
      return true;
    }
    let state;
    try {const saved = JSON.parse(storage?.getItem(key) || 'null'); state = validState(saved) ? saved : seed();}
    catch {state = seed();}
    const find = value => state.nodes.find(node => node.id === value);
    function requireNode(value) {const node = find(value); if (!node) throw new Error('找不到该项目。'); return node;}
    function trashed(value) {
      let node = find(value); const seen = new Set();
      while (node) {if (node.deletedAt || seen.has(node.id)) return true; seen.add(node.id); node = find(node.parentId);}
      return false;
    }
    function parentFolder(value) {
      const folder = requireNode(value);
      if (folder.kind !== 'folder' || trashed(value)) throw new Error('目标文件夹不可用。');
      return folder;
    }
    function validName(value) {
      const name = String(value).trim();
      if (!name || name.length > 120 || /[<>:"/\\|?*\u0000-\u001f]/.test(name) || /[. ]$/.test(name) || /^\.{1,2}$/.test(name)) throw new Error('名称不能包含 \\ / : * ? " < > |，且不能以句点结尾。');
      if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) throw new Error('此名称由系统保留，请使用其他名称。');
      return name;
    }
    function exists(parentId, name, except) {
      return state.nodes.some(node => node.parentId === parentId && node.id !== except && !node.deletedAt && node.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    }
    function unique(parentId, desired) {
      const name = validName(desired); if (!exists(parentId,name)) return name;
      const dot = name.lastIndexOf('.'), stem = dot > 0 ? name.slice(0,dot) : name, extension = dot > 0 ? name.slice(dot) : '';
      let counter = 2, next;
      do {next = stem + ' (' + counter++ + ')' + extension;} while (exists(parentId,next));
      return next;
    }
    function change(type, operation) {
      const previous = clone(state);
      let result;
      try {
        result = operation();
        if (!storage) throw new Error('storage unavailable');
        storage.setItem(key, JSON.stringify(state));
      } catch (error) {
        state = previous;
        if (error.message === 'storage unavailable' || error.name === 'QuotaExceededError' || error.name === 'SecurityError') throw new Error('无法保存到浏览器存储，请检查存储权限或可用空间。');
        throw error;
      }
      for (const listener of listeners) listener({type, id:result?.id});
      return clone(result);
    }
    function targetOf(value) {
      if (!value || !['app','node','url'].includes(value.type)) throw new Error('请选择有效的快捷方式目标。');
      if (value.type === 'app' && !apps.has(value.value)) throw new Error('该应用不可用。');
      if (value.type === 'node' && (!find(value.value) || trashed(value.value))) throw new Error('目标文件或文件夹不可用。');
      if (value.type === 'url') {
        let url; try {url = new URL(value.value);} catch {throw new Error('请输入完整的网址，例如 https://example.com。');}
        if (!['http:','https:'].includes(url.protocol)) throw new Error('快捷方式网址仅支持 http 或 https。');
        return {type:'url',value:url.href};
      }
      return {type:value.type,value:String(value.value)};
    }
    function create(kind,parentId,name,options={}) {
      parentFolder(parentId);
      if (!['folder','text','shortcut'].includes(kind)) throw new Error('不支持此文件类型。');
      const defaults={folder:'新建文件夹',text:'新建文本文档.txt',shortcut:'新建快捷方式.lnk'};
      const chosen=unique(parentId,name || defaults[kind]);
      const target=kind==='shortcut' ? targetOf(options.target) : undefined;
      return change('create',()=>{const time=now(),node={id:id(),kind,parentId,name:chosen,createdAt:time,modifiedAt:time}; if(kind==='text')node.content=String(options.content || '');if(target)node.target=target;state.nodes.push(node);return node;});
    }
    function rename(value,name) {
      const node=requireNode(value);if(roots.has(value)||trashed(value))throw new Error('此项目不能重命名。');
      const chosen=validName(name);if(exists(node.parentId,chosen,value))throw new Error('此位置已有同名项目。');
      return change('rename',()=>{node.name=chosen;node.modifiedAt=now();return node;});
    }
    function writeText(value,content) {
      const node=requireNode(value);if(node.kind!=='text'||trashed(value))throw new Error('此文本文档不可编辑。');
      return change('write',()=>{node.content=String(content);node.modifiedAt=now();return node;});
    }
    function move(value,parentId) {
      const node=requireNode(value);parentFolder(parentId);if(roots.has(value)||trashed(value))throw new Error('此项目不能移动。');
      let folder=find(parentId);while(folder){if(folder.id===value)throw new Error('不能将文件夹移入自身或其子文件夹。');folder=find(folder.parentId);}
      if(exists(parentId,node.name,value))throw new Error('目标位置已有同名项目。');
      return change('move',()=>{node.parentId=parentId;node.modifiedAt=now();return node;});
    }
    function copy(value,parentId) {
      const source=requireNode(value);parentFolder(parentId);if(roots.has(value)||trashed(value))throw new Error('此项目不能复制。');
      let parent=find(parentId);while(parent){if(parent.id===value)throw new Error('不能将文件夹复制到自身或其子文件夹。');parent=find(parent.parentId);}
      return change('copy',()=>{
        const original=clone(state.nodes);
        function duplicate(node,destination,top) {
          const next={...clone(node),id:id(),parentId:destination,name:top?unique(destination,node.name):node.name,createdAt:now(),modifiedAt:now()};
          delete next.deletedAt;delete next.originalParentId;state.nodes.push(next);
          for(const child of original.filter(n=>n.parentId===node.id&&!n.deletedAt))duplicate(child,next.id,false);
          return next;
        }
        return duplicate(source,parentId,true);
      });
    }
    function remove(value) {
      const node=requireNode(value);if(roots.has(value)||trashed(value))throw new Error('此项目不能删除。');
      return change('remove',()=>{node.deletedAt=now();node.originalParentId=node.parentId;return node;});
    }
    function restore(value) {
      const node=requireNode(value);if(!node.deletedAt)throw new Error('此项目不在回收站中。');
      const parent=find(node.originalParentId),destination=parent&&parent.kind==='folder'&&!trashed(parent.id)?parent.id:'desktop';
      return change('restore',()=>{node.parentId=destination;node.name=unique(destination,node.name);delete node.deletedAt;delete node.originalParentId;node.modifiedAt=now();return node;});
    }
    function path(value) {
      const names=[];let node=find(value);while(node){names.unshift(node.name);node=find(node.parentId);}return names.join('\\');
    }
    return {
      get:value=>{const node=find(value);return node?clone(node):null;},
      list:parentId=>{parentFolder(parentId);return clone(state.nodes.filter(node=>node.parentId===parentId&&!node.deletedAt).sort((a,b)=>(a.kind==='folder'?0:1)-(b.kind==='folder'?0:1)||a.name.localeCompare(b.name,'zh-CN')));},
      all:()=>clone(state.nodes.filter(node=>!trashed(node.id))),
      trash:()=>clone(state.nodes.filter(node=>node.deletedAt)),
      isTrashed:trashed,isRoot:value=>roots.has(value),path,create,rename,writeText,move,copy,remove,restore,
      subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);}
    };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=createDesktopFileSystem;
  global.createDesktopFileSystem=createDesktopFileSystem;
  if(typeof window!=='undefined') {
    let storage;try{storage=window.localStorage;}catch{storage=null;}
    window.DesktopFS=createDesktopFileSystem(storage);
  }
})(globalThis);
