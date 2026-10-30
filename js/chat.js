import { createChat } from "./chat-engine.js";

const embedded = window.parent !== window && new URLSearchParams(location.search).get("embedded") === "1";
let currentContext = null;
let contextRequest = 0;

if (embedded) {
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== "charity-chat:context") return;
    const context = event.data.context;
    if (!context || typeof context.page !== "string") return;
    currentContext = context;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      window.parent.postMessage({ type: "charity-chat:close" }, location.origin);
    }
  });
  window.parent.postMessage({ type: "charity-chat:request-context" }, location.origin);
}

function requestPageContext() {
  if (!embedded) return null;
  return new Promise((resolve) => {
    const requestId = ++contextRequest;
    const receive = (event) => {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== "charity-chat:context" || event.data.requestId !== requestId) return;
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
      resolve(currentContext);
    };
    const timeout = setTimeout(() => {
      window.removeEventListener("message", receive);
      resolve(currentContext);
    }, 2000);
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "charity-chat:request-context", requestId }, location.origin);
  });
}

const chat = createChat(undefined, requestPageContext);
const form = document.querySelector("#chat-form");
const input = document.querySelector("#chat-input");
const sendButton = document.querySelector("#chat-send");
const startButton = document.querySelector("#chat-start");
const stopButton = document.querySelector("#chat-stop");
const clearButton = document.querySelector("#chat-clear");
const messages = document.querySelector("#chat-messages");
const status = document.querySelector("#chat-status");
const progress = document.querySelector("#chat-progress");
const counter = document.querySelector("#chat-counter");
let ready = false;
let busy = false;

function showStatus(text, error = false) {
  status.textContent = text;
  status.dataset.state = error ? "error" : "info";
  status.hidden = !error && !busy;
}

function updateControls() {
  input.disabled = busy || !ready;
  sendButton.disabled = busy || !ready || !input.value.trim();
  clearButton.disabled = busy || messages.children.length <= 1;
  startButton.disabled = busy;
  counter.textContent = `${input.value.length} / ${input.maxLength}`;
  counter.hidden = input.value.length === 0;
  status.hidden = !busy && status.dataset.state !== "error";
}

function addMessage(role, text) {
  const message = document.createElement("p");
  message.className = `message message-${role}`;
  message.setAttribute("aria-label", role === "user" ? "You" : "Assistant");
  message.textContent = text;
  messages.append(message);
  messages.scrollTop = messages.scrollHeight;
  return message;
}

function welcome() {
  messages.replaceChildren();
  addMessage("assistant", "What matters most to you: health and emergency care, education, nature, or another cause?");
}

startButton.addEventListener("click", async () => {
  if (busy) return;
  busy = true;
  progress.hidden = false;
  progress.removeAttribute("value");
  showStatus("Loading the on-device model. The first download may take several minutes.");
  updateControls();
  try {
    await chat.load((report) => {
      progress.value = Math.max(0, Math.min(1, report.progress));
      showStatus(`Loading assistant: ${Math.round(progress.value * 100)}%`);
    });
    ready = true;
    document.documentElement.classList.add("chat-ready");
    startButton.hidden = true;
    showStatus("Ready. Conversation stays in this tab.");
  } catch (error) {
    showStatus(error.message || "Could not load the assistant. Check your connection and available GPU memory, then try again.", true);
    startButton.textContent = "Retry loading";
  } finally {
    busy = false;
    progress.hidden = true;
    updateControls();
    if (ready) input.focus();
  }
});

input.addEventListener("input", updateControls);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!sendButton.disabled) form.requestSubmit();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || !ready || !input.value.trim()) return;
  const text = input.value.trim();
  busy = true;
  const userMessage = addMessage("user", text);
  const replyMessage = addMessage("assistant", "Thinking...");
  input.value = "";
  messages.setAttribute("aria-busy", "true");
  stopButton.hidden = false;
  stopButton.disabled = false;
  showStatus("Writing a reply...");
  updateControls();
  try {
    const result = await chat.reply(text, (answer) => {
      const nearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
      replyMessage.textContent = answer;
      if (nearBottom) messages.scrollTop = messages.scrollHeight;
    });
    replyMessage.textContent = result.text || "Response stopped.";
    showStatus(result.stopped ? "Response stopped." : "Ready.");
  } catch (error) {
    userMessage.remove();
    replyMessage.remove();
    input.value = text;
    showStatus(`Could not generate a reply. ${error.message || "Please try again."}`, true);
  } finally {
    busy = false;
    messages.setAttribute("aria-busy", "false");
    stopButton.hidden = true;
    updateControls();
    input.focus();
  }
});

stopButton.addEventListener("click", () => {
  chat.stop();
  stopButton.disabled = true;
  showStatus("Stopping response...");
});

clearButton.addEventListener("click", async () => {
  if (busy) return;
  busy = true;
  updateControls();
  try {
    await chat.clear();
    welcome();
    showStatus(ready ? "New conversation. Ready." : "Start the assistant when you are ready.");
  } catch (error) {
    showStatus(error.message || "Could not clear the conversation. Please try again.", true);
  } finally {
    busy = false;
    updateControls();
    if (ready) input.focus();
  }
});

welcome();
updateControls();
if (!globalThis.isSecureContext || !navigator.gpu) {
  startButton.disabled = true;
  showStatus("On-device AI needs WebGPU. Try an up-to-date desktop Chrome or Edge with hardware acceleration enabled, over HTTPS or localhost. You can continue browsing the site.", true);
}