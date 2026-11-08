(function(){
"use strict";
const SURFACES=".online-game-board,.gai-dialog main,.domino-game-panel,.chess-game-panel,.tavla-game-panel";
const GROUPED="[data-motion-group]";
const enteredRoots=new WeakSet(),snapshots=new WeakMap();
const reduced=()=>window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function rectOf(node){const r=node.getBoundingClientRect();return{left:r.left,top:r.top,width:r.width,height:r.height,cx:r.left+r.width/2,cy:r.top+r.height/2}}
function prepare(root){
 if(!root||!root.querySelectorAll)return;
 const grouped=new Map();
 root.querySelectorAll(GROUPED).forEach(node=>{const key=node.getAttribute("data-motion-group");if(!key)return;const r=rectOf(node);if(!r.width||!r.height)return;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(r)});
 snapshots.set(root,grouped);
}
function flip(node,from,to){
 const dx=from.left-to.left,dy=from.top-to.top;
 if(Math.abs(dx)<2&&Math.abs(dy)<2)return;
 node.style.transition="none";node.style.translate=dx.toFixed(1)+"px "+dy.toFixed(1)+"px";void node.offsetWidth;
 requestAnimationFrame(()=>{node.style.transition="translate 480ms cubic-bezier(.2,.72,.22,1)";node.style.translate="0px 0px"});
 window.setTimeout(()=>{node.style.transition="";node.style.translate=""},520);
}
function refresh(root){
 if(!root||!root.querySelectorAll)return;
 const previous=snapshots.get(root)||new Map(),used=new Map();
 if(!enteredRoots.has(root)){root.querySelectorAll(SURFACES).forEach(node=>node.classList.add("game-motion-enter"));enteredRoots.add(root)}
 root.querySelectorAll(GROUPED).forEach(node=>{
  const key=node.getAttribute("data-motion-group");if(!key)return;
  const before=previous.get(key)||[],claimed=used.get(key)||new Set(),now=rectOf(node);let best=-1,bestDistance=Infinity;
  for(let i=0;i<before.length;i++){if(claimed.has(i))continue;const dx=before[i].cx-now.cx,dy=before[i].cy-now.cy,d=dx*dx+dy*dy;if(d<bestDistance){bestDistance=d;best=i}}
  if(best>=0){claimed.add(best);used.set(key,claimed);if(!reduced())flip(node,before[best],now)}
  else if(!reduced())node.classList.add("game-motion-piece");
 });
}
window.SuwadGameMotion={prepare,refresh};
})();