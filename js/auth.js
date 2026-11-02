import { auth, configured, isAdminEmail } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { recordVisit } from "./track.js";
import { h } from "./dom.js";

const root = document.documentElement;
const isProtected = root.hasAttribute("data-jee-protected");
const here =
  (location.pathname.split("/").pop() || "index.html") +
  location.search +
  location.hash;
const loginUrl = "login.html?next=" + encodeURIComponent(here);

let signingOut = false;
let outsideListenerAdded = false;

function release() {
  root.classList.remove("auth-pending");
}

function clearInjected() {
  document.querySelectorAll("[data-jee-auth]").forEach((node) => node.remove());
}

function buildNav(user) {
  clearInjected();

  const nav = document.querySelector(".navbar__nav");
  const right = document.querySelector(".navbar__right");

  if (nav) {
    if (!user) {
      nav.append(
        h("a", {
          href: loginUrl,
          class: "jee-nav-login",
          text: "Login",
          "data-jee-auth": "1",
        }),
      );
    }
  }

  if (!right) return;

  if (!user) {
    right.prepend(
      h("a", {
        href: loginUrl,
        class: "btn btn--teal jee-login-btn",
        text: "Login",
        "data-jee-auth": "1",
      }),
    );
    return;
  }

  const name = user.displayName || user.email || "Account";
  const avatar = user.photoURL
    ? h("img", {
        src: user.photoURL,
        alt: "",
        referrerpolicy: "no-referrer",
        class: "jee-user__img",
      })
    : h("span", { class: "jee-user__initial", text: name.charAt(0).toUpperCase() });

  const button = h(
    "button",
    {
      type: "button",
      class: "jee-user__btn",
      "aria-haspopup": "true",
      "aria-expanded": "false",
      "aria-label": "Account menu",
    },
    avatar,
  );

  const logout = h("button", {
    type: "button",
    class: "jee-user__logout",
    text: "Sign out",
  });

  const menu = h(
    "div",
    { class: "jee-user__menu" },
    h(
      "div",
      { class: "jee-user__info" },
      h("strong", { text: name }),
      h("span", { text: user.email || "" }),
    ),
    h("a", { href: "products.html", text: "Products" }),
    isAdminEmail(user.email)
      ? h("a", { href: "admin.html", text: "Admin Dashboard" })
      : null,
    logout,
  );

  const wrap = h(
    "div",
    { class: "jee-user", "data-jee-auth": "1" },
    button,
    menu,
  );

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = wrap.classList.toggle("is-open");
    button.setAttribute("aria-expanded", open ? "true" : "false");
  });

  logout.addEventListener("click", async () => {
    signingOut = true;
    await signOut(auth);
  });

  if (!outsideListenerAdded) {
    outsideListenerAdded = true;
    document.addEventListener("click", (event) => {
      const open = document.querySelector(".jee-user.is-open");
      if (open && !open.contains(event.target)) {
        open.classList.remove("is-open");
        const toggle = open.querySelector(".jee-user__btn");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  right.prepend(wrap);
}

if (!configured) {
  console.warn(
    "Firebase is not configured yet. Fill in js/firebase-config.js (see SETUP-FIREBASE.md).",
  );
  buildNav(null);
  release();
} else {
  onAuthStateChanged(auth, (user) => {
    buildNav(user);
    if (isProtected && !user) {
      location.replace(signingOut ? "index.html" : loginUrl);
      return;
    }
    release();
    if (user) recordVisit(user);
  });
}
