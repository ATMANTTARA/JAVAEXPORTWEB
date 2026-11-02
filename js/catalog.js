import { auth, db, configured } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { h } from "./dom.js";

const CATEGORIES = {
  kitchenware: "Kitchenware",
  furniture: "Furniture",
  homedecor: "Home Decor",
};
const WHATSAPP_NUMBER = "6285871113657";

const grid = document.getElementById("catalogGrid");
const statusBox = document.getElementById("catalogStatus");
const count = document.getElementById("catalogCount");
const search = document.getElementById("catalogSearch");
const chipBox = document.getElementById("catalogChips");
const modal = document.getElementById("catalogModal");
const modalPanel = document.getElementById("catalogModalPanel");

let products = [];
let activeCat = new URLSearchParams(location.search).get("cat") || "all";
if (!CATEGORIES[activeCat]) activeCat = "all";
let term = "";

function setStatus(node) {
  statusBox.replaceChildren();
  if (node) statusBox.append(node);
  statusBox.hidden = !node;
}

function millis(product) {
  return product.createdAt && product.createdAt.toMillis
    ? product.createdAt.toMillis()
    : 0;
}

function visibleProducts() {
  const needle = term.trim().toLowerCase();
  return products
    .filter((item) => activeCat === "all" || item.category === activeCat)
    .filter(
      (item) =>
        !needle ||
        (item.name || "").toLowerCase().includes(needle) ||
        (item.description || "").toLowerCase().includes(needle),
    )
    .sort(
      (a, b) =>
        Number(!!b.bestSeller) - Number(!!a.bestSeller) ||
        millis(b) - millis(a),
    );
}

function renderChips() {
  chipBox.replaceChildren();
  const entries = [["all", "All"], ...Object.entries(CATEGORIES)];
  entries.forEach(([key, label]) => {
    const chip = h("button", {
      type: "button",
      class: "catalog-chip" + (key === activeCat ? " is-active" : ""),
      text: label,
    });
    chip.addEventListener("click", () => {
      activeCat = key;
      renderChips();
      renderGrid();
    });
    chipBox.append(chip);
  });
}

function card(product) {
  const image = (product.images || [])[0];
  const media = image
    ? h("img", { src: image, alt: product.name || "", loading: "lazy" })
    : h("div", { class: "catalog-card__empty", text: "No photo" });

  const node = h(
    "button",
    { type: "button", class: "catalog-card" },
    product.bestSeller
      ? h("span", { class: "catalog-badge", text: "Best Seller" })
      : null,
    h("div", { class: "catalog-card__image" }, media),
    h(
      "div",
      { class: "catalog-card__body" },
      h("span", {
        class: "catalog-card__cat",
        text: CATEGORIES[product.category] || "",
      }),
      h("span", { class: "catalog-card__name", text: product.name || "" }),
    ),
  );
  node.addEventListener("click", () => openModal(product));
  return node;
}

function renderGrid() {
  const list = visibleProducts();
  grid.replaceChildren(...list.map(card));
  count.textContent = list.length
    ? list.length + (list.length === 1 ? " product" : " products")
    : "";

  if (!products.length) {
    setStatus(
      h("p", {
        text: "Our catalog is being updated. Please check back soon, or contact us for the latest product list.",
      }),
    );
  } else if (!list.length) {
    setStatus(h("p", { text: "No products match your search." }));
  } else {
    setStatus(null);
  }
}

function openModal(product) {
  const images = product.images || [];
  const main = h("img", {
    class: "catalog-modal__main",
    src: images[0] || "",
    alt: product.name || "",
  });
  const thumbs = h("div", { class: "catalog-modal__thumbs" });

  if (images.length > 1) {
    images.forEach((src, index) => {
      const thumb = h(
        "button",
        {
          type: "button",
          class: "catalog-modal__thumb" + (index === 0 ? " is-active" : ""),
        },
        h("img", { src, alt: "" }),
      );
      thumb.addEventListener("click", () => {
        main.src = src;
        thumbs
          .querySelectorAll(".catalog-modal__thumb")
          .forEach((item) => item.classList.remove("is-active"));
        thumb.classList.add("is-active");
      });
      thumbs.append(thumb);
    });
  }

  const specs = (product.specs || []).filter((row) => row.label);
  const specTable = specs.length
    ? h(
        "table",
        { class: "catalog-modal__specs" },
        h(
          "tbody",
          {},
          ...specs.map((row) =>
            h(
              "tr",
              {},
              h("td", { text: row.label }),
              h("td", { text: row.value || "" }),
            ),
          ),
        ),
      )
    : null;

  const message =
    "Hello PT. Java Essence Export, I am interested in " +
    (product.name || "your product") +
    (CATEGORIES[product.category]
      ? " (" + CATEGORIES[product.category] + ")"
      : "") +
    ". Could you share more details?";

  const close = h("button", {
    type: "button",
    class: "catalog-modal__close",
    "aria-label": "Close",
    text: "×",
  });
  close.addEventListener("click", closeModal);

  modalPanel.replaceChildren(
    close,
    h(
      "div",
      { class: "catalog-modal__media" },
      images.length ? main : null,
      images.length > 1 ? thumbs : null,
    ),
    h(
      "div",
      { class: "catalog-modal__info" },
      h("span", {
        class: "catalog-modal__cat",
        text: CATEGORIES[product.category] || "",
      }),
      h("h2", { class: "catalog-modal__title", text: product.name || "" }),
      product.description
        ? h("p", { class: "catalog-modal__desc", text: product.description })
        : null,
      specTable,
      product.moq
        ? h("p", { class: "catalog-modal__moq", text: "MOQ: " + product.moq })
        : null,
      h("a", {
        class: "btn btn--teal catalog-modal__cta",
        href:
          "https://wa.me/" +
          WHATSAPP_NUMBER +
          "?text=" +
          encodeURIComponent(message),
        target: "_blank",
        rel: "noopener",
        text: "Inquire via WhatsApp",
      }),
    ),
  );

  modal.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.classList.remove("is-open");
  document.body.style.overflow = "";
}

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});
search.addEventListener("input", () => {
  term = search.value;
  renderGrid();
});

async function load() {
  setStatus(h("p", { text: "Loading products…" }));
  try {
    const snap = await getDocs(
      query(collection(db, "products"), where("published", "==", true)),
    );
    products = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderChips();
    renderGrid();
  } catch (error) {
    console.error(error);
    const denied = error && error.code === "permission-denied";
    setStatus(
      h("p", {
        text: denied
          ? "You do not have permission to view the catalog. Please sign in again."
          : "The catalog could not be loaded. Please try again later.",
      }),
    );
  }
}

renderChips();

if (!configured) {
  setStatus(
    h("p", {
      text: "The catalog is not connected yet. Please fill in js/firebase-config.js (see SETUP-FIREBASE.md).",
    }),
  );
} else {
  let started = false;
  onAuthStateChanged(auth, (user) => {
    if (user && !started) {
      started = true;
      load();
    }
  });
}
