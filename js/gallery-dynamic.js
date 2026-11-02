import { auth, db, configured } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { h } from "./dom.js";
import { SEED_GALLERY } from "./seed-gallery.js";
import { inGallery, sortItems } from "./product-utils.js";
import { openProductModal } from "./product-modal.js";

const PAGES = {
  "gallery-kitchenware": "kitchenware",
  "gallery-furniture": "furniture",
  "gallery-homedecor": "homedecor",
};
const page = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
const CATEGORY = PAGES[page];

const SEED_IMAGES = new Set(
  SEED_GALLERY.filter((item) => item.category === CATEGORY).map(
    (item) => item.images[0],
  ),
);

function findGrid(group) {
  if (group === "Main Categories") {
    return document.querySelector(".gallery-hero-grid");
  }
  const sub = Array.from(
    document.querySelectorAll(".gallery-subgroup__title"),
  ).find((node) => node.textContent.trim() === group);
  if (sub && sub.parentElement) {
    const grid = sub.parentElement.querySelector(".gallery-grid");
    if (grid) return grid;
  }
  const section = Array.from(
    document.querySelectorAll(".category-section__title"),
  ).find((node) => node.textContent.trim() === group);
  if (section) {
    const inner = section.closest(".gallery-section__inner");
    const grid = inner && inner.querySelector(".gallery-grid");
    if (grid) return grid;
  }
  return document.querySelector(".gallery-grid");
}

function gridCard(product) {
  const image = (product.images || [])[0];
  const media = image
    ? h("img", { src: image, alt: product.name || "", loading: "lazy" })
    : h("div", { class: "pd-card__empty", text: "No photo" });
  const body = [
    h("div", { class: "gallery-card__image" }, media),
    h("span", { class: "gallery-card__name", text: product.name || "" }),
  ];
  if (product.link) {
    return h(
      "a",
      { href: product.link, class: "gallery-card", "data-dynamic": "1" },
      ...body,
    );
  }
  const node = h(
    "div",
    { class: "gallery-card pd-clickable", "data-dynamic": "1" },
    ...body,
  );
  node.addEventListener("click", () => openProductModal(product));
  return node;
}

function heroCard(product) {
  const image = (product.images || [])[0];
  const media = image
    ? h("img", { src: image, alt: product.name || "", loading: "lazy" })
    : h("div", { class: "pd-card__empty", text: "No photo" });
  const node = h(
    "div",
    { class: "gallery-hero-card pd-clickable", "data-dynamic": "1" },
    h("div", { class: "gallery-hero-card__image" }, media),
    h(
      "div",
      { class: "gallery-hero-card__body" },
      h("h3", { text: product.name || "" }),
      product.description ? h("p", { text: product.description }) : null,
    ),
  );
  node.addEventListener("click", () => openProductModal(product));
  return node;
}

function render(all) {
  document
    .querySelectorAll("[data-dynamic]")
    .forEach((node) => node.remove());

  const items = all.filter(
    (item) => item.category === CATEGORY && inGallery(item),
  );
  const imported = items.some((item) => item.fromSeed);

  document
    .querySelectorAll(
      ".gallery-card:not([data-dynamic]), .gallery-hero-card:not([data-dynamic])",
    )
    .forEach((node) => {
      const img = node.querySelector("img");
      const src = img ? img.getAttribute("src") : "";
      node.style.display = imported && SEED_IMAGES.has(src) ? "none" : "";
    });

  items.sort(sortItems).forEach((item) => {
    const grid = findGrid(item.galleryGroup || "");
    if (!grid) return;
    const node = grid.classList.contains("gallery-hero-grid")
      ? heroCard(item)
      : gridCard(item);
    grid.append(node);
  });
}

async function load() {
  try {
    const snap = await getDocs(
      query(collection(db, "products"), where("published", "==", true)),
    );
    render(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
  } catch (error) {
    console.warn("Could not load gallery products:", error);
  }
}

if (configured && CATEGORY) {
  onAuthStateChanged(auth, (user) => {
    if (user) load();
  });
}
