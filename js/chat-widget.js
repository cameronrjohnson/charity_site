import { getPageContext } from "./chat-context.js";

const launcher = document.querySelector(".chat-fab");
let panel;
let frame;

function sendContext(requestId) {
  frame?.contentWindow.postMessage({ type: "charity-chat:context", requestId, context: getPageContext(document) }, location.origin);
}

function closePanel() {
  panel.close();
  launcher.setAttribute("aria-expanded", "false");
  launcher.focus();
}

function createPanel() {
  panel = document.createElement("dialog");
  panel.id = "chat-popup";
  panel.className = "chat-popup";
  panel.setAttribute("aria-label", "Charity Finder assistant");
  const toolbar = document.createElement("div");
  toolbar.className = "chat-popup-toolbar";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "chat-popup-close";
  closeButton.title = "Close AI chat";
  closeButton.setAttribute("aria-label", "Close AI chat");
  closeButton.textContent = "x";
  closeButton.addEventListener("click", closePanel);
  toolbar.append(closeButton);
  frame = document.createElement("iframe");
  frame.title = "Charity Finder chat";
  frame.src = new URL("../pages/chat.html?embedded=1", import.meta.url).href;
  frame.addEventListener("load", () => sendContext());
  panel.append(toolbar, frame);
  document.body.append(panel);
  import("https://esm.sh/lucide@0.468.0").then(({ createIcons, X }) => {
    closeButton.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';
    createIcons({ icons: { X } });
  }).catch(() => {});
}

if (launcher) {
  launcher.setAttribute("aria-haspopup", "dialog");
  launcher.setAttribute("aria-controls", "chat-popup");
  launcher.setAttribute("aria-expanded", "false");
  launcher.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (panel?.open) {
      closePanel();
      return;
    }
    if (!panel) createPanel();
    panel.show();
    launcher.setAttribute("aria-expanded", "true");
    sendContext();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel?.open) {
      event.preventDefault();
      closePanel();
    }
  });
  window.addEventListener("message", (event) => {
    if (!frame || event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === "charity-chat:request-context") sendContext(event.data.requestId);
    if (event.data?.type === "charity-chat:close" && panel.open) closePanel();
  });
}