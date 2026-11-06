(()=>{"use strict";
const toggle=document.getElementById("menuToggle"),drawer=document.getElementById("siteDrawer"),scrim=document.getElementById("drawerScrim"),closeButton=document.getElementById("drawerClose");
if(!toggle||!drawer||!scrim||!closeButton)return;
let previousFocus=null;
function open(){previousFocus=document.activeElement;drawer.inert=false;drawer.setAttribute("aria-hidden","false");scrim.hidden=false;requestAnimationFrame(()=>drawer.classList.add("is-open"));toggle.setAttribute("aria-expanded","true");toggle.setAttribute("aria-label","إغلاق قائمة الألعاب والمجتمع");document.body.classList.add("drawer-open");closeButton.focus({preventScroll:true})}
function close(){drawer.classList.remove("is-open");drawer.setAttribute("aria-hidden","true");drawer.inert=true;scrim.hidden=true;toggle.setAttribute("aria-expanded","false");toggle.setAttribute("aria-label","فتح قائمة الألعاب والمجتمع");document.body.classList.remove("drawer-open");if(previousFocus&&typeof previousFocus.focus==="function")previousFocus.focus({preventScroll:true})}
toggle.addEventListener("click",()=>toggle.getAttribute("aria-expanded")==="true"?close():open());
closeButton.addEventListener("click",close);scrim.addEventListener("click",close);
drawer.querySelectorAll("a").forEach(link=>link.addEventListener("click",close));
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&toggle.getAttribute("aria-expanded")==="true")close()});
})();