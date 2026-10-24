/* Small platform fallbacks; no network requests or relaxed file permissions. */
(function(global){
'use strict';
if(!Array.prototype.at)Object.defineProperty(Array.prototype,'at',{configurable:true,writable:true,value:function(index){index=Math.trunc(Number(index)||0);return this[index<0?this.length+index:index];}});
if(!Element.prototype.replaceChildren)Element.prototype.replaceChildren=function(){while(this.firstChild)this.removeChild(this.firstChild);for(var i=0;i<arguments.length;i++)this.append(arguments[i]);};
if(!('inert' in HTMLElement.prototype)){
  Object.defineProperty(HTMLElement.prototype,'inert',{get:function(){return this.hasAttribute('inert');},set:function(value){this.toggleAttribute('inert',!!value);}});
  document.addEventListener('focusin',function(event){if(event.target.closest('[inert]'))event.target.blur();},true);
}
// CSS gap support alone does not prove flex gap support on older WebViews.
var gapProbe=document.createElement('div');gapProbe.style.cssText='position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px';
for(var part=0;part<2;part++){var child=document.createElement('div');child.style.height='1px';gapProbe.appendChild(child);}document.body.appendChild(gapProbe);
if(gapProbe.scrollHeight!==3)document.documentElement.classList.add('no-flex-gap');gapProbe.remove();
function viewport(){var height=global.visualViewport?Math.min(global.innerHeight,global.visualViewport.height):global.innerHeight;document.documentElement.style.setProperty('--app-height',Math.round(height)+'px');}
viewport();global.addEventListener('resize',viewport);
if(global.visualViewport)global.visualViewport.addEventListener('resize',function(){viewport();global.dispatchEvent(new Event('resize'));});
global.setTimeout(function(){if(!global.Windows12Ready){var error=document.getElementById('boot-error');if(error)error.hidden=false;}},8000);
})(window);
