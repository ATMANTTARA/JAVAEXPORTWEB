import { auth, db, configured } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { h } from "./dom.js";
import { SEED_PRODUCTS } from "./seed-products.js";
import { CATEGORIES, inProducts, sortItems } from "./product-utils.js";
import { openProductModal } from "./product-modal.js";

const SEED_LINKS = new Set(SEED_PRODUCTS.map((item) => item.link));
const ARROW =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>';

function shorten(text, max) {
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

function card(product) {
  const image = (product.images || [])[0];
  const media = image
    ? h("img", { src: image, alt: product.name || "", loading: "lazy" })
    : h("div", { class: "pd-card__empty", text: "No photo" });

  const link = h("span", { class: "catalog-card__link", text: "View Details " });
  link.insertAdjacentHTML("beforeend", ARROW);

  const node = h(
    "a",
    {
      href: product.link || "#product-" + product.id,
      class: "catalog-card catalog-card--dynamic",
      "data-dynamic": "1",
    },
    product.bestSeller
      ? h("span", { class: "pd-badge", text: "Best Seller" })
      : null,
    h("div", { class: "catalog-card__image" }, media),
    h(
      "div",
      { class: "catalog-card__body" },
      h("span", { class: "catalog-card__label", text: product.name || "" }),
      product.description
        ? h("p", {
            class: "catalog-card__desc",
            text: shorten(product.description, 110),
          })
        : null,
      link,
    ),
  );
  if (!product.link) {
    node.addEventListener("click", (event) => {
      event.preventDefault();
      openProductModal(product);
    });
  }
  return node;
}

function render(all) {
  document
    .querySelectorAll("[data-dynamic]")
    .forEach((node) => node.remove());

  const products = all.filter(inProducts);
  const imported = products.some((item) => item.link);
  document
    .querySelectorAll(".catalog-card:not([data-dynamic])")
    .forEach((node) => {
      node.style.display =
        imported && SEED_LINKS.has(node.getAttribute("href")) ? "none" : "";
    });

  Object.keys(CATEGORIES).forEach((key) => {
    const grid = document.querySelector("#" + key + " .catalog-grid");
    if (!grid) return;
    products
      .filter((item) => item.category === key)
      .sort(sortItems)
      .forEach((item) => grid.append(card(item)));
  });
}

function showLoginNote() {
  if (document.getElementById("pdLoginNote")) return;
  const tabs = document.querySelector(".category-tabs");
  const note = h(
    "div",
    { class: "pd-note", id: "pdLoginNote" },
    h("p", {
      text: "Sign in with your Google account to see our latest products and full product details.",
    }),
    h("a", {
      class: "btn btn--teal",
      href: "login.html?next=products.html",
      text: "Sign in",
    }),
  );
  if (tabs && tabs.parentNode) {
    tabs.parentNode.insertBefore(note, tabs.nextSibling);
  }
}

function hideLoginNote() {
  const note = document.getElementById("pdLoginNote");
  if (note) note.remove();
}

async function load() {
  try {
    const snap = await getDocs(
      query(collection(db, "products"), where("published", "==", true)),
    );
    render(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
  } catch (error) {
    console.warn("Could not load products:", error);
  }
}

if (configured) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      hideLoginNote();
      load();
    } else {
      render([]);
      showLoginNote();
    }
  });
}
