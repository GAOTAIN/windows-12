(function(global){
'use strict';
const isBatch=node=>node?.kind==='text'&&/\.(bat|cmd)$/i.test(node.name);
const help='支持：echo、@echo off/on、rem、::、cls、title、pause、set、dir、date、time、whoami、start/open 应用、theme、exit /b。\n批处理在网页仿真终端运行；不支持系统程序、管道、重定向、循环或条件语法。';
function createSession(file,context={}){
  const source=String(file.content||'').replace(/^\uFEFF/,'');
  if(source.length>100000)throw new Error('脚本超过 100000 字符，请缩短后运行。');
  const lines=source.split(/\r\n|\n|\r/);if(lines.length>1000)throw new Error('脚本最多支持 1000 行。');
  const vars=Object.create(null);vars.USERNAME='Local';vars.COMPUTERNAME='WINDOWS12';
  let index=0,echo=true,ended=false,code=0;
  function expand(value){return value.replace(/%~nx0/gi,()=>file.name||'').replace(/%([^%]+)%/g,(_,key)=>key.toUpperCase()==='ERRORLEVEL'?String(code):key.toUpperCase()==='DATE'?new Date().toLocaleDateString('zh-CN'):key.toUpperCase()==='TIME'?new Date().toLocaleTimeString('zh-CN'):vars[key.toUpperCase()]||'');}
  function next(){
    if(ended||index>=lines.length){ended=true;return{done:true,code};}
    let raw=lines[index++].trim(),quiet=raw.startsWith('@');if(quiet)raw=raw.slice(1).trim();
    const events=[];if(!raw||/^::/.test(raw)||/^rem(?:\s|$)/i.test(raw))return{events};
    const line=expand(raw).trimStart();if(!line)return{events};
    const match=/^(\S+?)(?:\s+(.*))?$/.exec(line),cmd=match[1].toLowerCase(),arg=match[2]||'';
    if(echo&&!quiet)events.push({type:'print',text:'C:\\Users\\Local> '+line});
    const print=text=>events.push({type:'print',text:String(text)});
    const error=message=>{code=1;print('第 '+index+' 行：'+message);};
    if(cmd==='echo'){
      if(/^off$/i.test(arg))echo=false;else if(/^on$/i.test(arg))echo=true;else print(arg||('ECHO 处于'+(echo?'打开':'关闭')+'状态。'));
    }else if(/^echo[.:]$/i.test(cmd))print(arg);
    else if(cmd==='cls'||cmd==='clear')events.push({type:'clear'});
    else if(cmd==='title')events.push({type:'title',text:arg||'终端'});
    else if(cmd==='pause'){print('请按任意键继续 . . .');events.push({type:'pause'});}
    else if(cmd==='exit'){
      if(!/^(?:\/b\s*)?(?:-?\d+)?$/i.test(arg))error('exit 用法：exit /b [退出代码]');
      else{const number=arg.replace(/^\/b\s*/i,'');if(number)code=Number(number);ended=true;}
    }else if(cmd==='set'){
      let value=arg;if(value.startsWith('"')&&value.endsWith('"'))value=value.slice(1,-1);
      if(!value)print(Object.keys(vars).sort().map(key=>key+'='+vars[key]).join('\n'));
      else{const pair=/^([^=\s]+)=(.*)$/.exec(value);if(!pair)error('set 用法：set 名称=值（支持 %名称% 引用）');else{const key=pair[1].toUpperCase();if(pair[2])vars[key]=pair[2];else delete vars[key];}}
    }else if(cmd==='dir'){
      if(arg&&!/^\/b$/i.test(arg))error('dir 仅支持当前脚本所在文件夹，可加 /b。');
      else print(context.list?.().map(node=>(node.kind==='folder'?'[文件夹] ':'')+node.name).join('\n')||'此文件夹为空。');
    }else if(cmd==='date')print(new Date().toLocaleDateString('zh-CN'));
    else if(cmd==='time')print(new Date().toLocaleTimeString('zh-CN'));
    else if(cmd==='whoami')print('windows12\\local');
    else if(cmd==='help')print(help);
    else if(cmd==='theme')events.push({type:'theme'});
    else if(cmd==='start'||cmd==='open'){
      const target=arg.replace(/^""\s*/,'').replace(/^"([^"\r\n]+)"$/,'$1').toLowerCase();
      const aliases={'notepad':'notes','notepad.exe':'notes','explorer':'files','explorer.exe':'files','calc':'calculator','calc.exe':'calculator','msedge':'edge'};
      const app=aliases[target]||target;
      if(!(context.apps||[]).includes(app))error('无法打开“'+arg+'”。start/open 仅支持内置应用。');
      else events.push({type:'open',app});
    }else error('不支持的命令：'+line+'。输入 help 查看支持范围。');
    return{events};
  }
  return{next};
}
function mountTerminal(win,runtime,options={}){
  const {$,fs,apps,openApp,setTheme}=runtime;
  win.content.innerHTML='<div class="batch-toolbar"><span class="batch-state" role="status">命令提示符</span><button class="batch-resume" hidden>继续运行</button><button class="batch-stop" disabled>停止 <kbd>Ctrl+C</kbd></button></div><div class="terminal"><pre class="terminal-output">Windows 12 [网页仿真终端]\n输入 help 查看可用命令。\n</pre><form><label for="terminal-input">C:\\Users\\Local&gt;</label><input id="terminal-input" aria-label="终端命令" autocomplete="off" spellcheck="false"></form></div>';
  const output=$('.terminal-output',win.content),input=$('input',win.content),status=$('.batch-state',win.content),stop=$('.batch-stop',win.content),resume=$('.batch-resume',win.content),form=$('form',win.content),terminal=$('.terminal',win.content);
  let session=null,timer=null,paused=false,disposed=false,filename='',parentId='desktop';
  function print(text){output.textContent+=(String(text)+'\n');if(output.textContent.length>150000)output.textContent=output.textContent.slice(-100000);terminal.scrollTop=terminal.scrollHeight;}
  function controls(){stop.disabled=!session;resume.hidden=!paused;input.readOnly=!!session&&!paused;input.placeholder=paused?'按任意键继续':session?'正在运行批处理…':'';}
  function finish(message){clearTimeout(timer);session=null;paused=false;status.textContent=message;controls();win.el.querySelector('.window-title span').textContent='终端';}
  function cancel(){if(session){print('^C\n批处理已停止。');finish('已停止 · '+filename);}}
  function step(){
    if(!session||disposed)return;
    let result;try{result=session.next();}catch(error){print('运行失败：'+error.message);finish('运行失败 · '+filename);return;}if(result.done){print('\n批处理已结束，退出代码：'+result.code);finish('已结束 · 退出代码 '+result.code);return;}
    for(const event of result.events){
      if(event.type==='print')print(event.text);
      if(event.type==='clear')output.textContent='';
      if(event.type==='title')win.el.querySelector('.window-title span').textContent=event.text;
      if(event.type==='theme')setTheme();
      if(event.type==='open')openApp(event.app);
      if(event.type==='pause'){paused=true;status.textContent='等待按键 · '+filename;controls();input.focus({preventScroll:true});return;}
    }
    timer=setTimeout(step,4);
  }
  function context(){return{list:()=>fs.list(parentId),apps:apps.map(app=>app.id)};}
  function continueRun(){if(!session||!paused)return;paused=false;input.value='';status.textContent='正在运行 · '+filename;controls();timer=setTimeout(step,0);}
  win.runBatch=id=>{
    const node=fs.get(id);if(!isBatch(node)||fs.isTrashed(id)){print('找不到可运行的 .bat 或 .cmd 文件。');return;}
    let next;try{parentId=node.parentId;next=createSession(node,context());}catch(error){print(error.message);return;}
    cancel();session=next;filename=node.name;paused=false;status.textContent='正在运行 · '+filename;print('\n运行 '+filename+'（网页仿真）');controls();timer=setTimeout(step,0);
  };
  stop.onclick=cancel;resume.onclick=continueRun;
  input.onkeydown=event=>{if(paused&&!['Shift','Control','Alt','Meta','CapsLock','Tab'].includes(event.key)&&!event.ctrlKey&&!event.metaKey){event.preventDefault();event.stopPropagation();continueRun();}};
  const key=event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='c'&&session){event.preventDefault();event.stopPropagation();cancel();}};
  win.el.addEventListener('keydown',key,true);
  form.onsubmit=event=>{
    event.preventDefault();if(session)return;const raw=input.value.trim();input.value='';if(!raw)return;
    filename='命令';parentId='desktop';try{session=createSession({name:'命令',content:'@'+raw},context());}catch(error){print(error.message);return;}print('C:\\Users\\Local> '+raw);controls();step();
  };
  win.cleanup=()=>{disposed=true;clearTimeout(timer);session=null;win.el.removeEventListener('keydown',key,true);};
  if(options.batchId)win.runBatch(options.batchId);
}
const api={isBatch,createSession,mountTerminal};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.Windows12Batch=api;
})(typeof window!=='undefined'?window:globalThis);
