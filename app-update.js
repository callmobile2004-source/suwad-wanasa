(() => {
  "use strict";
  if (!("serviceWorker" in navigator)) return;

  const STYLE = `
    #swUpdateNotice{position:fixed;z-index:20000;inset:auto 12px 12px 12px;display:none;align-items:center;justify-content:space-between;gap:12px;padding:13px 15px;border:1px solid #9a7748;border-radius:16px;background:#17191f;color:#f5efe4;box-shadow:0 12px 40px #0008;font:600 14px/1.6 system-ui,sans-serif}
    #swUpdateNotice[aria-hidden="false"]{display:flex}
    #swUpdateNotice button{border:0;border-radius:10px;padding:9px 13px;background:#b18a50;color:#17191f;font:700 13px system-ui,sans-serif;white-space:nowrap}
    #swUpdateNotice button:disabled{opacity:.6}
    @media(max-width:480px){#swUpdateNotice{align-items:stretch;flex-direction:column}#swUpdateNotice button{width:100%}}
  `;
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  const notice = document.createElement("aside");
  notice.id = "swUpdateNotice";
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  notice.setAttribute("aria-hidden", "true");
  notice.innerHTML = '<span id="swUpdateText">يجري فحص تحديث التطبيق…</span><button id="swUpdateAction" type="button">افحص التحديثات</button>';
  document.body.append(notice);

  const text = notice.querySelector("#swUpdateText");
  const action = notice.querySelector("#swUpdateAction");
  let registration = null;
  let approvedReload = false;
  let reloading = false;

  function show(message, label, visible = true) {
    text.textContent = message;
    action.textContent = label;
    notice.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function offerUpdate() {
    show("توجد نسخة جديدة من سَـوَاد وناسة. حدّث التطبيق حتى تحصل على الإصلاحات.", "تحديث التطبيق");
    action.disabled = false;
  }

  function watchWorker(worker) {
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller && registration?.waiting) offerUpdate();
    });
  }

  async function checkForUpdates() {
    if (!registration) {
      show("تعذّر تجهيز فحص التحديث. تأكد من الاتصال ثم أعد المحاولة.", "إعادة الفحص");
      return;
    }
    action.disabled = true;
    show("جاري فحص وجود نسخة أحدث…", "جارٍ الفحص");
    try {
      await registration.update();
      if (registration.waiting) {
        offerUpdate();
      } else {
        show("التطبيق محدث حالياً؛ ماكو نسخة جديدة.", "افحص مرة ثانية");
      }
    } catch (error) {
      console.warn("[app-update] update check failed", error);
      show("ما قدرنا نفحص التحديث حالياً. جرّب بعد التأكد من الإنترنت.", "إعادة الفحص");
    } finally {
      action.disabled = false;
    }
  }

  action.addEventListener("click", () => {
    if (registration?.waiting) {
      approvedReload = true;
      action.disabled = true;
      show("يتم تثبيت التحديث، راح نعيد فتح التطبيق بعد لحظات…", "جاري التحديث");
      registration.waiting.postMessage({ type: "SW_ACTIVATE_UPDATE" });
      return;
    }
    checkForUpdates();
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!approvedReload || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      registration = await navigator.serviceWorker.register("./sw.js?v=20261106-05", { updateViaCache: "none" });
      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate();
      if (registration.installing) watchWorker(registration.installing);
      registration.addEventListener("updatefound", () => watchWorker(registration.installing));
      // One quiet check on startup; activation still requires the user's tap.
      await registration.update();
      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate();
    } catch (error) {
      console.warn("[app-update] service worker registration failed", error);
      show("تعذّر تفعيل تحديث التطبيق التلقائي على هذا المتصفح.", "إعادة الفحص");
    }
  });
})();