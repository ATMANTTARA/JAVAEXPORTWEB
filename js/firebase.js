import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAILS } from "./firebase-config.js";

export const configured = !String(firebaseConfig.apiKey || "").startsWith(
  "ISI_",
);

export const app = configured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export const isAdminEmail = (email) =>
  !!email &&
  ADMIN_EMAILS.map((item) => item.toLowerCase()).includes(email.toLowerCase());
