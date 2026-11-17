(() => {
  "use strict";
  if (window.SuwadTypingEffects) return;

  // Limit animation to explicit Q&A text; broad selectors reran work on live panels.
  const SELECTOR = [".typing-question", ".typing-answer"].join(",");
  const timers = new WeakMap();
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const graphemes = value => {
    try { return Array.from(value.matchAll(/\P{M}\p{M}*|\p{M}+/gu), match => match[0]); }
    catch { return Array.from(value); }
  };

  function typeElement(element, delay = 0) {
    if (!(element instanceof HTMLElement) || element.dataset.suwadTypingDone === "1") return;
    if (element.children.length || !element.textContent?.trim()) return;

    const fullText = element.textContent;
    const chars = graphemes(fullText);
    element.dataset.suwadTypingDone = "1";
    element.setAttribute("aria-label", fullText);

    if (reduceMotion || chars.length < 3 || chars.length > 90) return;
    element.textContent = "";
    element.classList.add("is-typing");

    let index = 0;
    const start = () => {
      const step = () => {
        if (!element.isConnected) {
          element.classList.remove("is-typing");
          return;
        }
        if (index >= chars.length) {
          element.classList.remove("is-typing");
          element.textContent = fullText;
          return;
        }
        element.append(document.createTextNode(chars[index++]));
        const current = chars[index - 1];
        const pause = /[.!؟،؛:…]/u.test(current) ? 85 : 22;
        timers.set(element, window.setTimeout(step, pause));
      };
      step();
    };
    if (delay) window.setTimeout(start, delay);
    else start();
  }

  function scan(root) {
    if (!(root instanceof Element)) return;
    if (root.matches(SELECTOR)) {
      let delay = 0;
      if (root.matches(".typing-answer")) {
        const question = root.previousElementSibling;
        if (question?.matches(".typing-question")) {
          const length = graphemes(question.getAttribute("aria-label") || question.textContent || "").length;
          delay = Math.min(2400, length * 18 + 180);
        }
      }
      typeElement(root, delay);
    }
    root.querySelectorAll?.(SELECTOR).forEach(element => {
      let delay = 0;
      if (element.matches(".typing-answer")) {
        const question = element.previousElementSibling;
        if (question?.matches(".typing-question")) {
          delay = Math.min(2400, graphemes(question.getAttribute("aria-label") || question.textContent || "").length * 18 + 180);
        }
      }
      typeElement(element, delay);
    });
  }

  function start() {
    scan(document.body);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) scan(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.SuwadTypingEffects = { scan };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();