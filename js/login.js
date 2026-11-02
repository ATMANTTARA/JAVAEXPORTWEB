import { auth, provider, configured } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { recordVisit } from "./track.js";

const params = new URLSearchParams(location.search);
const rawNext = params.get("next") || "products.html";
const next = /^[a-z0-9_-]+\.html([?#]\S*)?$/i.test(rawNext)
  ? rawNext
  : "products.html";

const button = document.getElementById("googleSignIn");
const message = document.getElementById("loginMessage");

function show(text, info = false) {
  message.textContent = text;
  message.classList.toggle("is-info", info);
}

function describe(error) {
  switch (error && error.code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled. Please try again.";
    case "auth/unauthorized-domain":
      return "This website address is not authorized for sign-in yet. Please contact the administrator.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

if (!configured) {
  button.disabled = true;
  show("Login is not configured yet. Please contact the administrator.");
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    await Promise.race([
      recordVisit(user),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
    location.replace(next);
  });

  getRedirectResult(auth).catch((error) => show(describe(error)));

  button.addEventListener("click", async () => {
    button.disabled = true;
    show("Opening Google sign-in…", true);
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      if (
        error.code === "auth/popup-blocked" ||
        error.code === "auth/operation-not-supported-in-this-environment"
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }
      show(describe(error));
      button.disabled = false;
    }
  });
}
