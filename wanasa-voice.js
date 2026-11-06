(() => {
"use strict";
let activeAudio=null,activeUrl="",generation=0;
function supported(){return typeof Audio!=="undefined"&&typeof Blob!=="undefined"&&typeof URL!=="undefined"&&typeof URL.createObjectURL==="function"}
function stop(){
 generation++;
 if(activeAudio){activeAudio.pause();activeAudio.removeAttribute("src");activeAudio.load();activeAudio=null}
 if(activeUrl){URL.revokeObjectURL(activeUrl);activeUrl=""}
}
async function client(){
 const context=window.__SUWAD_SOCIAL_CONTEXT?.();
 const db=context?.db;
 if(!db)throw new Error("خدمة الحسابات غير جاهزة. حدّث الصفحة بعد اكتمال تحميلها.");
 const session=await db.auth.getSession();
 if(session.error)throw session.error;
 if(!session.data?.session){
  const signed=await db.auth.signInAnonymously({options:{data:{display_name:(localStorage.getItem("sw_nickname")||"ضيف الوناسة").trim()}}});
  if(signed.error)throw signed.error;
 }
 return db;
}
function decodeBase64(value){const binary=atob(value),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
async function speak(text,kind="tutorial"){
 if(!supported())throw new Error("تشغيل الصوت غير مدعوم بهذا المتصفح.");
 const clean=String(text||"").trim();if(!clean)return false;
 stop();const requestId=++generation;
 const db=await client();
 const result=await db.functions.invoke("wanasa-tts",{body:{text:clean,kind}});
 if(requestId!==generation)return false;
 if(result.error){
  let message=result.error.message||"تعذّر توليد الصوت.";
  const response=result.error.context;
  if(response&&typeof response.clone==="function"){const body=await response.clone().json().catch(()=>null);if(typeof body?.error==="string"&&body.error.trim())message=body.error.trim()}
  throw new Error(message);
 }
 const encoded=result.data?.audioBase64;if(typeof encoded!=="string"||!encoded)throw new Error("خدمة الصوت لم تُرجع ملفاً صالحاً.");
 const blob=new Blob([decodeBase64(encoded)],{type:result.data.mimeType||"audio/wav"});
 const url=URL.createObjectURL(blob),audio=new Audio(url);audio.preload="auto";activeAudio=audio;activeUrl=url;
 const cleanup=()=>{if(activeAudio===audio)activeAudio=null;if(activeUrl===url){URL.revokeObjectURL(url);activeUrl=""}};
 audio.addEventListener("ended",cleanup,{once:true});audio.addEventListener("error",cleanup,{once:true});
 try{await audio.play();return true}catch(error){cleanup();throw new Error("تعذّر تشغيل الملف الصوتي. اضغط زر الاستماع مرة ثانية.")}
}
window.SuwadVoice={isSupported:supported,speak,stop};
document.addEventListener("visibilitychange",()=>{if(document.hidden)stop()});window.addEventListener("pagehide",stop);
})();