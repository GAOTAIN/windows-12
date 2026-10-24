(function(global){
'use strict';
const STORAGE_KEY='w12-profile-v1';
const presets=[['default','默认'],['blue','晴空蓝'],['violet','鸢尾紫'],['green','薄荷绿'],['orange','日落橙']];
const defaultProfile=()=>({name:'本地用户',avatar:{type:'preset',value:'default'}});
function validate(value){
  if(!value||typeof value.name!=='string')throw new Error('请输入用户名。');
  const name=value.name.trim();
  if(!name||Array.from(name).length>32||/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(name))throw new Error('用户名需为 1 至 32 个字符，不能包含控制字符。');
  const avatar=value.avatar;
  if(!avatar||!(avatar.type==='preset'&&presets.some(([id])=>id===avatar.value)||avatar.type==='image'&&typeof avatar.value==='string'&&avatar.value.length<=240000&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar.value)))throw new Error('头像无效，请重新选择图片或预设头像。');
  return{name,avatar:{type:avatar.type,value:avatar.value}};
}
function createProfileStore(storage){
  const listeners=new Set();
  function raw(){if(!storage)throw new Error('无法访问浏览器存储。');try{return storage.getItem(STORAGE_KEY);}catch{throw new Error('无法读取个人资料，请检查浏览器存储权限。');}}
  function snapshot(){const revision=raw();if(revision===null)return{profile:defaultProfile(),revision};let record;try{record=JSON.parse(revision);if(record.version!==1)throw new Error();return{profile:validate(record),revision};}catch{throw new Error('个人资料数据无法识别，请恢复网站数据备份。');}}
  function save(value,revision){const profile=validate(value);if(revision!==undefined&&raw()!==revision)throw new Error('个人资料已在其他窗口更新，请取消后重新打开。');try{storage.setItem(STORAGE_KEY,JSON.stringify({version:1,...profile}));}catch{throw new Error('个人资料未保存，请检查浏览器存储权限或可用空间。');}listeners.forEach(listener=>listener());return profile;}
  return{key:STORAGE_KEY,snapshot,save,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);}};
}
function paintAvatar(host,avatar,symbol){
  if(!host)return;host.replaceChildren();host.classList.add('user-avatar');host.dataset.avatar=avatar.type==='preset'?avatar.value:'image';
  if(avatar.type==='image'){const img=document.createElement('img');img.src=avatar.value;img.alt='';img.onerror=()=>{img.remove();host.dataset.avatar='default';host.innerHTML=symbol('person');};host.append(img);}
  else host.innerHTML=symbol('person');
}
async function photoFromFile(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('请选择 JPG、PNG 或 WebP 图片。');
  if(file.size>5*1024*1024)throw new Error('图片不能超过 5 MB。');
  const url=URL.createObjectURL(file),image=new Image();
  try{
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('无法读取这张图片，请选择其他图片。'));image.src=url;});
    if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40000000)throw new Error('图片尺寸过大或无效，请使用 4000 万像素以内的图片。');
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('当前浏览器无法处理头像图片。');
    const side=Math.min(image.naturalWidth,image.naturalHeight);ctx.fillStyle='#e8eef7';ctx.fillRect(0,0,256,256);ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,256,256);
    return{type:'image',value:canvas.toDataURL('image/jpeg',0.88)};
  }finally{URL.revokeObjectURL(url);}
}
function mountProfile(win,runtime){
  const {$,$$,symbol,profileStore,onBack,syncProfile}=runtime;
  win.cleanup?.();delete win.cleanup;
  let base;try{base=profileStore.snapshot();}catch(error){win.content.innerHTML='<div class="app-page"><h1>你的信息</h1><p role="alert"></p><button class="settings-back">返回设置</button></div>';$('[role=alert]',win.content).textContent=error.message;$('.settings-back',win.content).onclick=onBack;return;}
  let draft=base.profile,disposed=false,busy=false,request=0;
  win.content.innerHTML=`<div class="app-page profile-settings"><nav class="settings-breadcrumb" aria-label="设置位置"><button class="settings-back">设置</button><span>›</span><span>账户</span><span>›</span><strong>你的信息</strong></nav><h1>你的信息</h1><p>让你的账户更有个人风格。</p><form class="profile-form" novalidate><div class="profile-preview"><span class="avatar profile-large-avatar" aria-hidden="true"></span><div><strong class="profile-preview-name"></strong><small>本地账户</small></div></div><section class="profile-card"><label for="profile-name">用户名</label><input id="profile-name" type="text" autocomplete="off" spellcheck="false" aria-describedby="profile-name-help"><small id="profile-name-help">1 至 32 个字符，将显示在登录界面和开始菜单。</small></section><section class="profile-card"><h2>调整你的照片</h2><div class="profile-photo-row"><div><strong>选择文件</strong><small>JPG、PNG 或 WebP，最大 5 MB。居中裁切为圆形头像。</small></div><label class="profile-file-button">浏览文件<input class="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择头像图片"></label></div><p class="profile-preset-label">或选择预设头像</p><div class="profile-presets" role="group" aria-label="预设头像">${presets.map(([id,label])=>`<button type="button" class="profile-preset" data-preset="${id}" aria-label="${label}头像" aria-pressed="false"><span class="avatar" aria-hidden="true"></span></button>`).join('')}</div><button class="profile-reset-avatar" type="button">恢复默认头像</button></section><p class="profile-result" role="status"></p><footer class="profile-actions"><button class="profile-cancel" type="button">取消</button><button class="profile-save primary-button" type="submit">保存</button></footer></form><p class="account-local-note">仅更改当前浏览器网页桌面的个人资料，不更改 Windows 系统账户。</p></div>`;
  const form=$('form',win.content),name=$('#profile-name',win.content),result=$('.profile-result',win.content),save=$('.profile-save',win.content),photo=$('.profile-photo-input',win.content);
  name.value=draft.name;
  function preview(){
    $('.profile-preview-name',win.content).textContent=name.value.trim()||'本地用户';paintAvatar($('.profile-large-avatar',win.content),draft.avatar,symbol);
    $$('.profile-preset',win.content).forEach(button=>{button.setAttribute('aria-pressed',String(draft.avatar.type==='preset'&&draft.avatar.value===button.dataset.preset));paintAvatar($('.avatar',button),{type:'preset',value:button.dataset.preset},symbol);});
  }
  function setBusy(value){busy=value;save.disabled=value;photo.disabled=value;$$('.profile-preset,.profile-reset-avatar',win.content).forEach(button=>button.disabled=value);}
  function choose(avatar){draft={...draft,avatar};result.textContent='';preview();}
  name.oninput=()=>{result.textContent='';name.removeAttribute('aria-invalid');$('.profile-preview-name',win.content).textContent=name.value.trim()||'本地用户';};
  $$('.profile-preset',win.content).forEach(button=>button.onclick=()=>choose({type:'preset',value:button.dataset.preset}));
  $('.profile-reset-avatar',win.content).onclick=()=>choose({type:'preset',value:'default'});
  photo.onchange=async()=>{
    const file=photo.files?.[0];if(!file)return;const attempt=++request;setBusy(true);result.textContent='正在处理图片…';
    try{const avatar=await photoFromFile(file);if(!disposed&&attempt===request){choose(avatar);result.textContent='头像已预览，点击“保存”应用。';}}
    catch(error){if(!disposed&&attempt===request)result.textContent=error.message;}
    finally{if(!disposed&&attempt===request){photo.value='';setBusy(false);}}
  };
  form.onsubmit=event=>{
    event.preventDefault();if(busy)return;
    try{const saved=profileStore.save({...draft,name:name.value},base.revision);base=profileStore.snapshot();draft=saved;name.value=saved.name;syncProfile();preview();result.textContent='个人资料已保存。';}
    catch(error){result.textContent=error.message;if(/用户名/.test(error.message)){name.setAttribute('aria-invalid','true');name.focus();}}
  };
  $('.profile-cancel',win.content).onclick=onBack;$('.settings-back',win.content).onclick=onBack;
  const changed=event=>{if(event.key===profileStore.key||event.key===null)result.textContent='个人资料已在其他窗口更新，请取消后重新打开。';};window.addEventListener('storage',changed);
  win.cleanup=()=>{disposed=true;request++;window.removeEventListener('storage',changed);};preview();
}
const api={STORAGE_KEY,presets,defaultProfile,validate,createProfileStore,paintAvatar,photoFromFile,mountProfile};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.Windows12Profile=api;
})(typeof window!=='undefined'?window:globalThis);
