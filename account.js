(function(global){
'use strict';
const STORAGE_KEY='w12-login-credential-v1',DEFAULT_PASSWORD='123456',ITERATIONS=120000;
function createPasswordStore(storage,cryptoAPI=global.crypto){
  let changing=false;
  const hex=buffer=>Array.from(new Uint8Array(buffer),byte=>byte.toString(16).padStart(2,'0')).join('');
  const bytes=value=>Uint8Array.from(value.match(/.{2}/g)||[],pair=>parseInt(pair,16));
  function readRaw(){if(!storage)return null;try{return storage.getItem(STORAGE_KEY);}catch{throw new Error('无法读取登录信息，请检查浏览器存储权限。');}}
  function parse(raw){
    if(raw===null)return null;
    let record;try{record=JSON.parse(raw);}catch{throw new Error('保存的登录信息已损坏，请恢复网站数据备份。');}
    if(!record||record.version!==1||record.algorithm!=='PBKDF2-SHA256'||record.iterations!==ITERATIONS||!/^[a-f0-9]{32}$/.test(record.salt)||!/^[a-f0-9]{64}$/.test(record.hash)||typeof record.hint!=='string'||record.hint.length>60)throw new Error('保存的登录信息无法识别，请恢复网站数据备份。');
    return record;
  }
  async function derive(password,salt){
    if(!cryptoAPI?.subtle||!cryptoAPI?.getRandomValues)throw new Error('当前浏览器不支持保存密码，请使用支持 Web Crypto 的现代浏览器。');
    const key=await cryptoAPI.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    return hex(await cryptoAPI.subtle.deriveBits({name:'PBKDF2',salt:bytes(salt),iterations:ITERATIONS,hash:'SHA-256'},key,256));
  }
  async function matches(password,record){return record?(await derive(String(password),record.salt))===record.hash:String(password)===DEFAULT_PASSWORD;}
  async function verify(password){const before=readRaw(),valid=await matches(password,parse(before));if(readRaw()!==before)throw new Error('密码已更新，请重新输入。');return valid;}
  async function changePassword(current,next,confirmation,hint=''){
    if(changing)throw new Error('正在保存密码，请稍候。');changing=true;
    try{
      const before=readRaw(),record=parse(before);
      if(!await matches(current,record))throw new Error('当前密码不正确，请重试。');
      next=String(next);confirmation=String(confirmation);hint=String(hint).trim();
      if(next.length<6||next.length>128||!next.trim())throw new Error('新密码需为 6 至 128 个字符，且不能全部为空格。');
      if(next!==confirmation)throw new Error('两次输入的新密码不一致。');
      if(next===String(current))throw new Error('新密码不能与当前密码相同。');
      if(hint.length>60)throw new Error('密码提示最多为 60 个字符。');
      if(hint.includes(next))throw new Error('请勿在密码提示中填写新密码。');
      if(!storage)throw new Error('无法保存密码，请检查浏览器存储权限。');
      if(!cryptoAPI?.getRandomValues)throw new Error('当前浏览器不支持保存密码。');
      const salt=hex(cryptoAPI.getRandomValues(new Uint8Array(16)));
      const updated={version:1,algorithm:'PBKDF2-SHA256',iterations:ITERATIONS,salt,hash:await derive(next,salt),hint};
      if(readRaw()!==before)throw new Error('密码已在其他窗口更改，请重新打开更改密码。');
      try{storage.setItem(STORAGE_KEY,JSON.stringify(updated));}catch{throw new Error('密码未保存，请检查浏览器存储权限或可用空间。');}
      return {custom:true,hint};
    }finally{changing=false;}
  }
  return {key:STORAGE_KEY,verify,changePassword,info(){const record=parse(readRaw());return {custom:!!record,hint:record?.hint||''};}};
}
function mountSignIn(win,runtime){
  const {$,$$,symbol,account,syncProfile,onBack,onChanged}=runtime;
  let dialog=null,disposed=false;
  win.content.innerHTML=`<div class="app-page signin-settings"><nav class="settings-breadcrumb" aria-label="设置位置"><button class="settings-back">设置</button><span>›</span><span>账户</span><span>›</span><strong>登录选项</strong></nav><h1>登录选项</h1><p>管理此浏览器桌面的登录方式。</p><div class="settings-account-banner"><span class="avatar" data-profile-avatar></span><div><strong data-profile-name></strong><small>本地账户</small></div></div><h2>登录方式</h2><div class="signin-password-card"><button class="signin-password-toggle" aria-expanded="true" aria-controls="password-options">${symbol('lock')}<span><strong>密码</strong><small class="password-account-state"></small></span><span class="password-chevron" aria-hidden="true">⌄</span></button><div id="password-options" class="signin-password-options"><div><p>更改此账户的登录密码。</p><small>锁定或重新登录时使用新密码。</small></div><button class="change-password-button">更改</button></div></div><p class="password-settings-result" role="status"></p><p class="account-local-note">此设置仅作用于当前浏览器的网页桌面。</p></div>`;
  function updateState(){try{$('.password-account-state',win.content).textContent=account.info().custom?'已设置自定义密码':'已设置初始密码';}catch(error){$('.password-account-state',win.content).textContent=error.message;}}
  function destroyDialog(){if(!dialog)return;const current=dialog;dialog=null;$('form',current)?.reset();current.remove();}
  function openDialog(){
    destroyDialog();dialog=document.createElement('dialog');dialog.className='glass file-dialog password-dialog';dialog.dataset.passwordDialog='true';dialog.setAttribute('aria-labelledby','change-password-heading');
    dialog.innerHTML=`<form novalidate><h2 id="change-password-heading">更改密码</h2><p>为此账户设置新的登录密码。</p><label for="current-password">当前密码<input id="current-password" type="password" autocomplete="current-password" maxlength="128" required></label><label for="new-password">新密码<input id="new-password" type="password" autocomplete="new-password" minlength="6" maxlength="128" required aria-describedby="new-password-help"></label><small id="new-password-help">6 至 128 个字符，区分大小写。</small><label for="confirm-password">确认密码<input id="confirm-password" type="password" autocomplete="new-password" maxlength="128" required></label><label for="password-hint-input">密码提示（可选）<input id="password-hint-input" type="text" maxlength="60" autocomplete="off" placeholder="帮助你想起密码，请勿填写密码本身"></label><label class="show-passwords"><input type="checkbox">显示密码</label><p class="dialog-error" role="alert"></p><footer><button class="cancel-password" type="button">取消</button><button class="save-password primary-button" type="submit">更改密码</button></footer></form>`;
    document.body.append(dialog);const currentDialog=dialog,form=$('form',dialog),submit=$('.save-password',dialog),cancel=$('.cancel-password',dialog),error=$('.dialog-error',dialog);let saving=false;
    currentDialog.addEventListener('keydown',event=>event.stopPropagation());
    currentDialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
    currentDialog.addEventListener('close',()=>{if(dialog===currentDialog)destroyDialog();else currentDialog.remove();if(!disposed&&!dialog)$('.change-password-button',win.content)?.focus();});
    cancel.onclick=()=>currentDialog.close();
    $('.show-passwords input',dialog).onchange=event=>{for(const id of ['current-password','new-password','confirm-password'])$('#'+id,currentDialog).type=event.target.checked?'text':'password';};
    form.oninput=()=>{error.textContent='';$$('[aria-invalid]',currentDialog).forEach(input=>input.removeAttribute('aria-invalid'));};
    form.onsubmit=async event=>{
      event.preventDefault();if(saving)return;
      const current=$('#current-password',currentDialog),next=$('#new-password',currentDialog),confirm=$('#confirm-password',currentDialog),hint=$('#password-hint-input',currentDialog);
      if(!current.value){error.textContent='请输入当前密码。';current.setAttribute('aria-invalid','true');current.focus();return;}
      saving=true;submit.disabled=true;cancel.disabled=true;$$('input',currentDialog).forEach(input=>input.disabled=true);submit.textContent='正在保存…';
      try{
        await account.changePassword(current.value,next.value,confirm.value,hint.value);
        if(disposed)return;
        onChanged();updateState();$('.password-settings-result',win.content).textContent='密码已更改。下次登录请使用新密码。';
        currentDialog.close();
      }catch(cause){if(currentDialog.isConnected){error.textContent=cause.message;const field=/当前密码/.test(cause.message)?current:/不一致/.test(cause.message)?confirm:next;field.setAttribute('aria-invalid','true');}}
      finally{saving=false;if(currentDialog.isConnected){submit.disabled=false;cancel.disabled=false;$$('input',currentDialog).forEach(input=>input.disabled=false);submit.textContent='更改密码';const invalid=$('[aria-invalid]',currentDialog);invalid?.focus();}}
    };
    currentDialog.showModal();currentDialog.addEventListener('pointerdown',event=>event.stopPropagation());currentDialog.focus();$('#current-password',currentDialog).focus();
  }
  $('.settings-back',win.content).onclick=()=>{destroyDialog();onBack();};
  $('.signin-password-toggle',win.content).onclick=event=>{const button=event.currentTarget,expanded=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(expanded));$('#password-options',win.content).hidden=!expanded;};
  $('.change-password-button',win.content).onclick=openDialog;
  const changed=event=>{if(event.key===account.key||event.key===null){destroyDialog();if(!disposed){updateState();$('.password-settings-result',win.content).textContent='登录信息已在其他窗口更新。';}}};window.addEventListener('storage',changed);
  const cleanup=()=>{disposed=true;destroyDialog();window.removeEventListener('storage',changed);};
  win.cleanup?.();win.cleanup=cleanup;updateState();syncProfile?.();
}
const api={STORAGE_KEY,DEFAULT_PASSWORD,createPasswordStore,mountSignIn};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
global.Windows12Account=api;
})(globalThis);
