import { supabase } from "./supabase-client.js";
import { getProfile, updateUsername } from "./community-data.js";

const form = document.querySelector("#profile-form");
const usernameInput = document.querySelector("#profile-username");
const saveButton = document.querySelector("#profile-save");
const reloadButton = document.querySelector("#profile-reload");
const settings = document.querySelector("#profile-settings");
const signIn = document.querySelector("#profile-sign-in");
const status = document.querySelector("#profile-status");
let userId;
let revision = 0;
let busy = false;
let ready = false;

function message(text, error = false) {
  status.textContent = text;
  status.dataset.state = error ? "error" : "info";
}

function errorText(error) {
  return typeof error?.message === "string" ? error.message : "The request failed. Please try again.";
}

function updateControls() {
  usernameInput.disabled = busy || !ready || !userId;
  saveButton.disabled = busy || !ready || !userId;
  reloadButton.disabled = busy || !userId;
}

async function loadProfile(expectedRevision) {
  if (expectedRevision !== revision || !userId) return;
  busy = true;
  ready = false;
  updateControls();
  message("Loading your profile...");
  try {
    const profile = await getProfile(userId);
    if (expectedRevision !== revision) return;
    usernameInput.value = profile.username;
    ready = true;
    message("");
  } catch (error) {
    if (expectedRevision === revision) message(`Could not load your profile: ${errorText(error)}`, true);
  } finally {
    if (expectedRevision === revision) {
      busy = false;
      updateControls();
    }
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || !ready || !userId) return;
  const expectedRevision = revision;
  busy = true;
  updateControls();
  message("Saving your username...");
  try {
    const profile = await updateUsername(userId, usernameInput.value);
    if (expectedRevision !== revision) return;
    usernameInput.value = profile.username;
    message("Username saved. Your comments will show it the next time they are loaded.");
  } catch (error) {
    if (expectedRevision === revision) message(errorText(error), true);
  } finally {
    if (expectedRevision === revision) {
      busy = false;
      updateControls();
    }
  }
});

reloadButton.addEventListener("click", () => loadProfile(revision));

function sessionChanged(session) {
  const nextUserId = session?.user.id ?? null;
  if (nextUserId === userId) return;
  userId = nextUserId;
  revision += 1;
  busy = false;
  ready = false;
  usernameInput.value = "";
  settings.hidden = !userId;
  signIn.hidden = Boolean(userId);
  message("");
  updateControls();
  const expectedRevision = revision;
  setTimeout(() => loadProfile(expectedRevision), 0);
}

supabase.auth.onAuthStateChange((_event, session) => sessionChanged(session));
try {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  sessionChanged(data.session);
} catch (error) {
  message(`Could not check your sign-in status: ${errorText(error)}`, true);
  updateControls();
}
