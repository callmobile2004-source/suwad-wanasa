(() => {
"use strict";

const cfg = window.SUWAD_BACKEND || {};
const CHARACTERS = [
  { id: "comedian", name: "ونّوس", role: "المرح", icon: "🎭", voice: "ash", text: "تعليقات خفيفة وألعاب ونكت لطيفة" },
  { id: "detective", name: "المحقّق", role: "الفضولي", icon: "🕵️", voice: "echo", text: "ألغاز وأسئلة وتحليل ذكي" },
  { id: "strategist", name: "الحكيم", role: "الهادئ", icon: "🧠", voice: "marin", text: "شرح القواعد والاستراتيجيات" },
  { id: "challenger", name: "التحدّي", role: "الحماسي", icon: "⚡", voice: "coral", text: "تحديات وتشجيع وروح تنافس" }
];

let db = null;
let overlay = null;
let activeCharacter = null;
let peer = null;
let dataChannel = null;
let microphone = null;
let sessionTimer = null;
let connectionTimer = null;
let disconnectTimer = null;
let assistantMessage = null;
let voiceActive = false;
let busy = false;
let requestId = 0;
let voiceVolume = (() => { const stored = localStorage.getItem("sw_ai_voice_volume"); const value = stored === null ? 72 : Number(stored); return Number.isFinite(value) ? Math.min(1, Math.max(0, value / 100)) : 0.72; })();

const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function toast(message) {
  const element = $("#toast");
  if (!element) return;
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 3200);
}

function getDb() {
  if (db) return db;
  if (!window.supabase || !cfg.url || !cfg.anonKey) {
    throw new Error("إعداد الاتصال غير جاهز. أعد تحميل الصفحة وتأكد من إعداد Supabase.");
  }
  db = window.supabase.createClient(cfg.url, cfg.anonKey);
  return db;
}

async function ensureUserSession() {
  const client = getDb();
  const existing = await client.auth.getSession();
  if (existing.error) throw existing.error;
  if (existing.data.session?.access_token) return existing.data.session;

  const randomName = "ai_" + Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    byte => byte.toString(16).padStart(2, "0")
  ).join("");
  const signed = await client.auth.signInAnonymously({
    options: {
      data: {
        display_name: localStorage.getItem("sw_nickname") || "ضيف الوناسة",
        username: randomName
      }
    }
  });
  if (signed.error) throw signed.error;
  if (!signed.data.session?.access_token) {
    throw new Error("لم يكتمل تسجيل الدخول المجهول.");
  }
  return signed.data.session;
}

function createOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.className = "ai-companions-overlay";
  overlay.id = "aiCompanionsOverlay";
  overlay.hidden = true;
  overlay.innerHTML =
    '<section class="ai-companions-panel" role="dialog" aria-modal="true" aria-labelledby="aiCompanionsTitle">' +
      '<header class="ai-companions-head">' +
        '<div><span class="ai-eyebrow">رفاق الوناسة الذكيون</span><h2 id="aiCompanionsTitle">شخصيات <em>AI</em></h2>' +
        '<p>اختار شخصية تحچي وياك بصوت اصطناعي مباشر.</p></div>' +
        '<button type="button" class="ai-close" id="aiClose" aria-label="إغلاق">×</button>' +
      '</header>' +
      '<div class="ai-disclosure">هذه شخصيات خيالية مولّدة بالذكاء الاصطناعي، وأصواتها اصطناعية وليست أصوات أشخاص حقيقيين.</div>' +
      '<div id="aiCharacterStage"></div>' +
      '<p class="ai-cost-note">الاتصال يحتاج إنترنت وقد يستهلك رصيداً مدفوعاً من مزوّد الذكاء الاصطناعي. لا يبدأ المايكروفون إلا بعد موافقتك.</p>' +
    '</section>';
  document.body.appendChild(overlay);
  $("#aiClose", overlay).onclick = closePanel;
  overlay.addEventListener("click", event => {
    if (event.target === overlay) closePanel();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !overlay.hidden) closePanel();
  });
  renderCharacterPicker();
  return overlay;
}

function renderCharacterPicker() {
  const host = $("#aiCharacterStage", overlay);
  if (!host) return;
  host.innerHTML =
    '<div class="ai-character-grid">' +
      CHARACTERS.map(character =>
        '<button type="button" class="ai-character-card" data-ai-character="' + character.id + '">' +
          '<span class="ai-character-icon">' + character.icon + '</span>' +
          '<span class="ai-character-name">' + esc(character.name) + '</span>' +
          '<span class="ai-character-role">' + esc(character.role) + '</span>' +
          '<span class="ai-character-description">' + esc(character.text) + '</span>' +
          '<span class="ai-character-voice">♫ صوت ' + esc(character.voice) + '</span>' +
        '</button>'
      ).join("") +
    '</div>';
  host.querySelectorAll("[data-ai-character]").forEach(button => {
    button.onclick = () => {
      const selected = CHARACTERS.find(character => character.id === button.dataset.aiCharacter);
      if (selected) openCharacter(selected);
    };
  });
}

function openCharacter(character) {
  if (voiceActive || peer || busy) endSession("غيّرت الشخصية.");
  activeCharacter = character;
  const host = $("#aiCharacterStage", overlay);
  if (!host) return;
  host.innerHTML =
    '<div class="ai-conversation-head">' +
      '<button type="button" class="ai-back" id="aiBack">رجوع للشخصيات</button>' +
      '<div class="ai-active-character"><span>' + character.icon + '</span><div><b>' + esc(character.name) +
      '</b><small>' + esc(character.text) + ' · صوت ' + esc(character.voice) + '</small></div></div>' +
    '</div>' +
    '<div class="ai-status" id="aiStatus" role="status" aria-live="polite">جاهز. وافق على استخدام المايكروفون ثم ابدأ المحادثة.</div>' +
    '<div class="ai-messages" id="aiMessages" aria-live="polite"><div class="ai-welcome-message">' +
      '<span>' + character.icon + '</span><p>هلا بيك! آني ' + esc(character.name) +
      '، شخصية ذكاء اصطناعي من سَـوَاد وناسة. نكدر نحچي ونتحدى بعض.</p></div></div>' +
    '<audio id="aiRemoteAudio" class="ai-remote-audio" autoplay playsinline controls></audio>' +
    '<label class="ai-volume-control" for="aiVoiceVolume"><span>مستوى صوت الشخصية</span><input id="aiVoiceVolume" type="range" min="0" max="100" step="1" value="72"><output id="aiVoiceVolumeValue">72٪</output></label>' +
    '<label class="ai-consent"><input type="checkbox" id="aiConsent"><span>أوافق على تشغيل المايكروفون وإرسال صوتي إلى مزوّد الذكاء الاصطناعي لمعالجة المحادثة الصوتية.</span></label>' +
    '<div class="ai-controls"><button type="button" class="ai-start" id="aiStart" disabled>ابدأ المحادثة الصوتية</button>' +
    '<button type="button" class="ai-stop" id="aiStop" disabled>إنهاء</button></div>' +
    '<form class="ai-text-form" id="aiTextForm"><input id="aiTextInput" type="text" maxlength="500" placeholder="اكتب رسالة بعد الاتصال…" autocomplete="off" disabled>' +
    '<button type="submit" id="aiSend" disabled>إرسال</button></form>' +
    '<p class="ai-session-note">مدة الجلسة الواحدة محدودة بـ 10 دقائق. لا يحفظ الموقع نص المحادثة أو التسجيل الصوتي في حسابك. قد تتم معالجة الصوت لدى مزوّد الخدمة وفق سياساته.</p>';

  $("#aiBack", host).onclick = () => { endSession("رجعت إلى قائمة الشخصيات."); activeCharacter = null; renderCharacterPicker(); };
  const voiceVolumeInput = $("#aiVoiceVolume", host);
  const voiceVolumeValue = $("#aiVoiceVolumeValue", host);
  const remoteAudioControl = $("#aiRemoteAudio", host);
  if (voiceVolumeInput) {
    voiceVolumeInput.value = String(Math.round(voiceVolume * 100));
    if (voiceVolumeValue) voiceVolumeValue.textContent = Math.round(voiceVolume * 100) + "٪";
    if (remoteAudioControl) remoteAudioControl.volume = voiceVolume;
    voiceVolumeInput.addEventListener("input", () => {
      const raw = Number(voiceVolumeInput.value);
      voiceVolume = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw / 100)) : 0.72;
      localStorage.setItem("sw_ai_voice_volume", String(Math.round(voiceVolume * 100)));
      if (remoteAudioControl) remoteAudioControl.volume = voiceVolume;
      if (voiceVolumeValue) voiceVolumeValue.textContent = Math.round(voiceVolume * 100) + "٪";
    });
  }
  $("#aiConsent", host).onchange = event => {
    $("#aiStart", host).disabled = !event.target.checked || busy || voiceActive;
  };
  $("#aiStart", host).onclick = startSession;
  $("#aiStop", host).onclick = () => endSession("أنهيت المحادثة.");
  $("#aiTextForm", host).onsubmit = sendTextMessage;
}

function showPanel() {
  createOverlay().hidden = false;
  document.body.classList.add("ai-companions-open");
  renderCharacterPicker();
}

function closePanel() {
  if (!overlay) return;
  endSession("تم إغلاق نافذة الشخصيات.");
  overlay.hidden = true;
  document.body.classList.remove("ai-companions-open");
}

function setStatus(message) {
  const status = $("#aiStatus", overlay);
  if (status) status.textContent = message;
}

function appendMessage(role, message) {
  const list = $("#aiMessages", overlay);
  if (!list) return null;
  const row = document.createElement("div");
  row.className = "ai-message ai-message-" + role;
  const label = document.createElement("small");
  label.textContent = role === "user" ? "أنت" :
    role === "assistant" ? (activeCharacter?.name || "الشخصية") : "النظام";
  const text = document.createElement("p");
  text.textContent = message;
  row.append(label, text);
  list.appendChild(row);
  list.scrollTop = list.scrollHeight;
  return text;
}

function appendAssistantDelta(delta) {
  if (!assistantMessage) assistantMessage = appendMessage("assistant", "");
  if (assistantMessage) {
    assistantMessage.textContent += delta;
    const list = $("#aiMessages", overlay);
    if (list) list.scrollTop = list.scrollHeight;
  }
}

function onRealtimeEvent(raw) {
  let event;
  try { event = JSON.parse(raw); } catch { return; }

  if (event.type === "session.created" || event.type === "session.updated") {
    setStatus("الشخصية متصلة وتسمعك. تگدر تحچي أو تكتب رسالة.");
  } else if (event.type === "conversation.item.input_audio_transcription.completed") {
    if (event.transcript) appendMessage("user", event.transcript);
  } else if (event.type === "conversation.item.input_audio_transcription.failed") {
    setStatus("الصوت ما زال متصلاً، لكن تعذّر إنشاء النص المكتوب لكلامك.");
  } else if (
    event.type === "response.output_audio_transcript.delta" ||
    event.type === "response.output_text.delta"
  ) {
    if (typeof event.delta === "string") appendAssistantDelta(event.delta);
  } else if (
    event.type === "response.output_audio_transcript.done" ||
    event.type === "response.output_text.done" ||
    event.type === "response.done"
  ) {
    assistantMessage = null;
  } else if (event.type === "error") {
    endSession("تعذّر إكمال المحادثة الصوتية. أُغلق المايكروفون؛ تگدر تحاول من جديد.");
  }
}

function sendRealtimeText(text) {
  if (!dataChannel || dataChannel.readyState !== "open") {
    toast("اتصل بالشخصية أولاً حتى ترسل رسالة.");
    return false;
  }
  dataChannel.send(JSON.stringify({
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text }]
    }
  }));
  dataChannel.send(JSON.stringify({ type: "response.create" }));
  return true;
}

function sendTextMessage(event) {
  event.preventDefault();
  const input = $("#aiTextInput", overlay);
  const value = input?.value.trim();
  if (!value) return;
  if (sendRealtimeText(value)) {
    appendMessage("user", value);
    input.value = "";
  }
}

function waitForIceGathering(connection) {
  return new Promise((resolve, reject) => {
    if (connection.iceGatheringState === "complete") return resolve();
    const cleanup = () => connection.removeEventListener("icegatheringstatechange", onChange);
    const onChange = () => {
      if (connection.iceGatheringState === "complete") {
        clearTimeout(timeout);
        cleanup();
        resolve();
      }
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("تأخر تجهيز اتصال الصوت. افحص الشبكة وحاول مرة ثانية."));
    }, 10000);
    connection.addEventListener("icegatheringstatechange", onChange);
    if (connection.iceGatheringState === "complete") onChange();
  });
}

async function startSession() {
  if (busy || voiceActive || !activeCharacter) return;
  if (!$("#aiConsent", overlay)?.checked) {
    toast("وافق أولاً على استخدام المايكروفون ومعالجة الصوت.");
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
    setStatus("المتصفح لا يدعم المحادثة الصوتية المباشرة. استخدم متصفحاً حديثاً عبر HTTPS.");
    return;
  }

  busy = true;
  const attempt = ++requestId;
  let localMicrophone = null;
  let localPeer = null;
  let localChannel = null;
  const isCurrent = () => attempt === requestId && !!overlay && !overlay.hidden;
  const releaseLocal = () => {
    if (localChannel) {
      localChannel.onmessage = null;
      localChannel.onopen = null;
      localChannel.onclose = null;
      localChannel.onerror = null;
      try { localChannel.close(); } catch { /* already closed */ }
    }
    if (localPeer) {
      localPeer.ontrack = null;
      localPeer.onconnectionstatechange = null;
      try { localPeer.close(); } catch { /* already closed */ }
    }
    if (localMicrophone) {
      localMicrophone.getTracks().forEach(track => track.stop());
    }
    if (dataChannel === localChannel) dataChannel = null;
    if (peer === localPeer) peer = null;
    if (microphone === localMicrophone) microphone = null;
  };

  const start = $("#aiStart", overlay);
  const stop = $("#aiStop", overlay);
  const textInput = $("#aiTextInput", overlay);
  const send = $("#aiSend", overlay);
  if (start) { start.disabled = true; start.textContent = "جاري الاتصال…"; }
  setStatus("جاري طلب إذن المايكروفون…");

  try {
    await ensureUserSession();
    if (!isCurrent()) return;

    // Ask for microphone permission before minting a short-lived provider token.
    localMicrophone = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    if (!isCurrent()) {
      releaseLocal();
      return;
    }
    microphone = localMicrophone;

    setStatus("تم تفعيل المايكروفون بموافقتك. جاري إنشاء اتصال صوتي آمن…");
    const minted = await getDb().functions.invoke("ai-companions", {
      body: { character_id: activeCharacter.id }
    });
    if (!isCurrent()) {
      releaseLocal();
      return;
    }
    if (minted.error) {
      const message = String(minted.error.message || "");
      throw new Error(/429|limit|quota/i.test(message)
        ? "وصلت إلى حد الجلسات المؤقت. انتظر قليلاً ثم حاول."
        : "خدمة الشخصيات غير مهيأة أو تعذّر إنشاء جلسة. راجع إعداد الخادم.");
    }
    const secret = minted.data?.client_secret;
    if (typeof secret !== "string" || !secret) {
      throw new Error("الخادم لم يرجع رمز جلسة مؤقتاً صالحاً.");
    }

    localPeer = new RTCPeerConnection();
    peer = localPeer;
    const remoteAudio = $("#aiRemoteAudio", overlay);
    localPeer.ontrack = event => {
      if (!isCurrent() || localPeer !== peer || !remoteAudio) return;
      remoteAudio.srcObject = event.streams?.[0] || new MediaStream([event.track]);
      remoteAudio.volume = voiceVolume;
      remoteAudio.play().catch(() =>
        setStatus("اضغط زر تشغيل الصوت في مشغّل الشخصية للسماع.")
      );
    };
    localPeer.onconnectionstatechange = () => {
      if (!isCurrent() || localPeer !== peer) return;
      if (localPeer.connectionState === "failed") {
        endSession("فشل الاتصال الصوتي. أُغلق المايكروفون؛ افحص الإنترنت وحاول من جديد.");
      } else if (localPeer.connectionState === "disconnected") {
        setStatus("الاتصال انقطع مؤقتاً؛ نحاول استعادته…");
        clearTimeout(disconnectTimer);
        disconnectTimer = setTimeout(() => {
          if (isCurrent() && localPeer.connectionState === "disconnected") {
            endSession("بقى الاتصال مقطوعاً. أُغلق المايكروفون لحماية خصوصيتك؛ حاول الاتصال من جديد.");
          }
        }, 15000);
      } else if (localPeer.connectionState === "connected") {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
        setStatus("الاتصال الصوتي مستقر. تگدر تحچي ويا الشخصية.");
      } else if (localPeer.connectionState === "closed") {
        endSession("انتهى اتصال الصوت. أُغلق المايكروفون؛ تگدر تبدأ جلسة جديدة.");
      }
    };

    localMicrophone.getAudioTracks().forEach(track => localPeer.addTrack(track, localMicrophone));
    localChannel = localPeer.createDataChannel("oai-events");
    dataChannel = localChannel;
    localChannel.onmessage = event => {
      if (isCurrent() && localChannel === dataChannel) onRealtimeEvent(event.data);
    };
    localChannel.onclose = () => {
      if (isCurrent() && localChannel === dataChannel && voiceActive) {
        endSession("انقطع اتصال الشخصية. أُغلق المايكروفون؛ تگدر تعيد المحاولة.");
      }
    };
    localChannel.onerror = () => {
      if (isCurrent() && localChannel === dataChannel) {
        endSession("حدث خلل في قناة المحادثة. أُغلق المايكروفون؛ حاول من جديد.");
      }
    };
    connectionTimer = setTimeout(() => {
      if (isCurrent() && !voiceActive) {
        endSession("تعذّر فتح قناة الصوت خلال المهلة المحددة. افحص الشبكة وحاول مرة ثانية.");
      }
    }, 25000);
    localChannel.onopen = () => {
      if (!isCurrent() || localChannel !== dataChannel) return;
      clearTimeout(connectionTimer);
      connectionTimer = null;
      voiceActive = true;
      setStatus("اتصلت الشخصية. تفضل احچي، أو اكتب رسالتك.");
      if (stop) stop.disabled = false;
      if (textInput) textInput.disabled = false;
      if (send) send.disabled = false;
      appendMessage("system", "المحادثة بدأت. تذكّر أن الصوت مولّد بالذكاء الاصطناعي.");
      sendRealtimeText("ابدأ بتحية قصيرة باللهجة العراقية المفهومة، واذكر اسم شخصيتك مرة واحدة، ثم اسألني شنو نلعب أو نحچي.");
      sessionTimer = setTimeout(
        () => endSession("وصلت الجلسة إلى حدّها الأقصى وهو 10 دقائق."),
        10 * 60 * 1000
      );
    };

    const offer = await localPeer.createOffer();
    if (!isCurrent()) {
      releaseLocal();
      return;
    }
    await localPeer.setLocalDescription(offer);
    if (!isCurrent()) {
      releaseLocal();
      return;
    }
    await waitForIceGathering(localPeer);
    if (!isCurrent()) {
      releaseLocal();
      return;
    }
    const sdp = localPeer.localDescription?.sdp;
    if (typeof sdp !== "string" || !sdp.trim()) {
      throw new Error("تعذّر إعداد قناة الصوت.");
    }

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + secret,
        "Content-Type": "application/sdp"
      },
      body: sdp
    });
    if (!isCurrent()) {
      releaseLocal();
      return;
    }
    if (!response.ok) {
      throw new Error("مزوّد الصوت رفض الاتصال. تحقق من إعداد Realtime والفوترة.");
    }
    const answer = await response.text();
    if (!isCurrent()) {
      releaseLocal();
      return;
    }
    await localPeer.setRemoteDescription({ type: "answer", sdp: answer });
    if (isCurrent()) setStatus("جاري فتح قناة الصوت…");
  } catch (error) {
    releaseLocal();
    cleanupSession();
    if (isCurrent()) {
      const message = String(error?.message || "تعذّر بدء الاتصال. حاول مرة ثانية.");
      setStatus(message);
      appendMessage("system", message);
    }
  } finally {
    if (attempt === requestId) {
      busy = false;
      const currentStart = $("#aiStart", overlay);
      if (currentStart && overlay && !overlay.hidden) {
        currentStart.disabled = !$("#aiConsent", overlay)?.checked || voiceActive;
        currentStart.textContent = voiceActive ? "المحادثة نشطة" : "ابدأ المحادثة الصوتية";
      }
    }
  }
}

function cleanupSession() {
  clearTimeout(sessionTimer);
  sessionTimer = null;
  clearTimeout(connectionTimer);
  connectionTimer = null;
  clearTimeout(disconnectTimer);
  disconnectTimer = null;
  voiceActive = false;
  if (dataChannel) {
    dataChannel.onmessage = null;
    dataChannel.onopen = null;
    dataChannel.onclose = null;
    dataChannel.onerror = null;
    try { dataChannel.close(); } catch { /* already closed */ }
    dataChannel = null;
  }
  if (peer) {
    peer.ontrack = null;
    peer.onconnectionstatechange = null;
    try { peer.close(); } catch { /* already closed */ }
    peer = null;
  }
  if (microphone) {
    microphone.getTracks().forEach(track => track.stop());
    microphone = null;
  }
  const audio = $("#aiRemoteAudio", overlay);
  if (audio) {
    audio.pause();
    audio.srcObject = null;
  }
  const stop = $("#aiStop", overlay);
  const start = $("#aiStart", overlay);
  const input = $("#aiTextInput", overlay);
  const send = $("#aiSend", overlay);
  if (stop) stop.disabled = true;
  if (start) {
    start.disabled = !$("#aiConsent", overlay)?.checked || busy;
    start.textContent = "ابدأ المحادثة الصوتية";
  }
  if (input) input.disabled = true;
  if (send) send.disabled = true;
  assistantMessage = null;
}

function endSession(reason) {
  requestId += 1;
  busy = false;
  cleanupSession();
  if (reason) setStatus(reason);
}

function init() {
  const launcher = $("#aiCompanionsLauncher");
  if (launcher) launcher.addEventListener("click", showPanel);
  window.openSuwadAiCompanions = showPanel;
  window.addEventListener("pagehide", () => endSession(""));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
})();
