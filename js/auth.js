import { supabase } from "./supabase-client.js";

const loginLink = document.querySelector(".login-link");
const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const authSubmit = document.querySelector("#auth-submit");
const authToggle = document.querySelector("#auth-toggle");
const authToggleText = document.querySelector("#auth-toggle-text");
const emailInput = document.querySelector("#auth-email");
const passwordInput = document.querySelector("#auth-password");
const loginIntro = document.querySelector("#login-intro");
const loginTitleAccent = document.querySelector("#login-title-accent");
const signedInView = document.querySelector("#signed-in-view");
const signedInEmail = document.querySelector("#signed-in-email");
const logoutButton = document.querySelector("#auth-logout");

let isSignUp = false;

function showMessage(message, state = "info") {
  if (!authMessage) return;

  authMessage.textContent = message;
  authMessage.dataset.state = state;
  authMessage.hidden = false;
}

function clearMessage() {
  if (!authMessage) return;

  authMessage.textContent = "";
  delete authMessage.dataset.state;
  authMessage.hidden = true;
}

function renderSession(session) {
  if (loginLink) {
    loginLink.textContent = session ? "Your profile" : "Log in";
    loginLink.href = new URL(session ? "../pages/profile.html" : "../pages/login.html", import.meta.url).href;
    loginLink.removeAttribute("aria-current");
    if (window.location.pathname.endsWith(session ? "/profile.html" : "/login.html")) {
      loginLink.setAttribute("aria-current", "page");
    }
  }

  if (authForm) authForm.hidden = Boolean(session);
  if (authToggleText) authToggleText.hidden = Boolean(session);
  if (signedInView) signedInView.hidden = !session;
  if (signedInEmail) signedInEmail.textContent = session?.user.email ?? "";
  if (loginIntro && session) loginIntro.textContent = "Your account is ready.";
  if (loginIntro && !session) loginIntro.textContent = "Sign in to your account or create one to get started.";
}

function setSignUpMode(signUp) {
  isSignUp = signUp;
  clearMessage();
  if (emailInput) emailInput.value = "";
  if (passwordInput) passwordInput.value = "";

  if (loginTitleAccent) {
    loginTitleAccent.previousSibling.textContent = signUp ? "Create an " : "Welcome ";
    loginTitleAccent.textContent = signUp ? "account." : "back.";
  }
  if (loginIntro) {
    loginIntro.textContent = signUp
      ? "Use your email address and a password to create your account."
      : "Sign in to your account or create one to get started.";
  }
  if (authSubmit) authSubmit.textContent = signUp ? "Create account" : "Log in";
  if (authToggleText) {
    authToggleText.firstChild.textContent = signUp ? "Already have an account? " : "New here? ";
  }
  if (authToggle) authToggle.textContent = signUp ? "Log in" : "Create account";
  if (passwordInput) passwordInput.autocomplete = signUp ? "new-password" : "current-password";
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

authToggle?.addEventListener("click", () => setSignUpMode(!isSignUp));

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  authSubmit.disabled = true;

  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const result = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) throw result.error;

    if (isSignUp && !result.data.session) {
      showMessage("Account created. Check your email to confirm it before signing in.");
    } else if (isSignUp) {
      showMessage("Your account was created and you are signed in.");
    } else {
      showMessage("You are signed in.");
    }
  } catch (error) {
    showMessage(error.message || "Authentication failed. Please try again.", "error");
  } finally {
    authSubmit.disabled = false;
  }
});

logoutButton?.addEventListener("click", async () => {
  logoutButton.disabled = true;
  clearMessage();

  try {
    await signOut();
    showMessage("You are signed out.");
  } catch (error) {
    showMessage(error.message || "Could not sign out. Please try again.", "error");
  } finally {
    logoutButton.disabled = false;
  }
});

supabase.auth.onAuthStateChange((_event, session) => renderSession(session));

const { data, error } = await supabase.auth.getSession();
if (error) {
  renderSession(null);
  showMessage(error.message || "Could not check your sign-in status.", "error");
} else {
  renderSession(data.session);
}
