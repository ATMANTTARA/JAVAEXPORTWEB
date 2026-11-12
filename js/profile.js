import { auth, db, configured, isAdminEmail } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { h } from "./dom.js";

const page = location.pathname.split("/").pop() || "index.html";
const SKIP = ["admin.html", "login.html"];
const EXCLUDE = new Set([
  "AC", "CP", "DG", "EA", "EU", "EZ", "IC", "TA", "UN", "XA", "XB", "ZZ", "QO",
]);

function countryList() {
  let names;
  try {
    names = new Intl.DisplayNames(["en"], { type: "region" });
  } catch (error) {
    return [];
  }
  const list = [];
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const a of letters) {
    for (const b of letters) {
      const code = a + b;
      if (EXCLUDE.has(code)) continue;
      let name = "";
      try {
        name = names.of(code);
      } catch (error) {
        continue;
      }
      if (name && name !== code) list.push({ code, name });
    }
  }
  return list.sort((x, y) => x.name.localeCompare(y.name));
}

function guessCountry() {
  try {
    return new Intl.Locale(navigator.language).region || "";
  } catch (error) {
    return "";
  }
}

function injectStyles() {
  if (document.getElementById("jee-profile-css")) return;
  const link = document.createElement("link");
  link.id = "jee-profile-css";
  link.rel = "stylesheet";
  link.href = "css/profile.css";
  document.head.append(link);
}

function showForm(user) {
  injectStyles();
  const select = h("select", { id: "jeeCountry", class: "jee-profile__input" });
  select.append(h("option", { value: "", text: "Select your country" }));
  countryList().forEach((item) =>
    select.append(h("option", { value: item.code, text: item.name })),
  );
  select.value = guessCountry();

  const company = h("input", {
    id: "jeeCompany",
    class: "jee-profile__input",
    type: "text",
    maxlength: "120",
    placeholder: "Company name (optional)",
  });
  const phone = h("input", {
    id: "jeePhone",
    class: "jee-profile__input",
    type: "tel",
    maxlength: "30",
    placeholder: "WhatsApp / phone with country code (optional)",
  });
  const error = h("p", { class: "jee-profile__error", role: "alert" });
  const save = h("button", {
    type: "submit",
    class: "jee-profile__save",
    text: "Save",
  });
  const later = h("button", {
    type: "button",
    class: "jee-profile__later",
    text: "Later",
  });

  const form = h(
    "form",
    { class: "jee-profile__panel", novalidate: "" },
    h("h2", { text: "Tell us about your business" }),
    h("p", {
      class: "jee-profile__text",
      text: "This helps us recommend suitable products and follow up with you. Your details are used only by PT. Java Essence Export.",
    }),
    h("label", { for: "jeeCountry", text: "Country *" }),
    select,
    h("label", { for: "jeeCompany", text: "Company" }),
    company,
    h("label", { for: "jeePhone", text: "WhatsApp / phone" }),
    phone,
    error,
    h("div", { class: "jee-profile__actions" }, later, save),
  );
  const overlay = h("div", { class: "jee-profile", role: "dialog", "aria-modal": "true" }, form);
  document.body.append(overlay);

  later.addEventListener("click", () => {
    try {
      sessionStorage.setItem("jee-profile-later", "1");
    } catch (e) {}
    overlay.remove();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!select.value) {
      error.textContent = "Please select your country.";
      return;
    }
    save.disabled = true;
    try {
      await setDoc(
        doc(db, "buyers", user.uid),
        {
          uid: user.uid,
          name: user.displayName || "",
          email: user.email || "",
          country: select.value,
          company: company.value.trim().slice(0, 120),
          phone: phone.value.trim().slice(0, 30),
          profileAt: serverTimestamp(),
        },
        { merge: true },
      );
      overlay.remove();
    } catch (err) {
      console.error("Profil gagal disimpan:", err);
      error.textContent = "Could not save. Please try again.";
      save.disabled = false;
    }
  });
}

if (configured && auth && !SKIP.includes(page)) {
  onAuthStateChanged(auth, async (user) => {
    if (!user || isAdminEmail(user.email)) return;
    try {
      if (sessionStorage.getItem("jee-profile-later")) return;
    } catch (error) {}
    try {
      const snap = await getDoc(doc(db, "buyers", user.uid));
      if (snap.exists() && snap.data().country) return;
    } catch (error) {
      return;
    }
    if (document.querySelector(".jee-profile")) return;
    showForm(user);
  });
}
