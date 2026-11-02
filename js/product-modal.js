import { h } from "./dom.js";
import { CATEGORIES } from "./product-utils.js";

const WHATSAPP_NUMBER = "6285871113657";

let modal = null;
let modalPanel = null;

function ensureModal() {
  if (modal) return;
  modalPanel = h("div", { class: "pd-modal__panel" });
  modal = h(
    "div",
    { class: "pd-modal", role: "dialog", "aria-modal": "true" },
    modalPanel,
  );
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeProductModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeProductModal();
  });
  document.body.append(modal);
}

export function closeProductModal() {
  if (!modal) return;
  modal.classList.remove("is-open");
  document.body.style.overflow = "";
}

export function openProductModal(product) {
  ensureModal();
  const images = product.images || [];
  const main = h("img", {
    class: "pd-modal__main",
    src: images[0] || "",
    alt: product.name || "",
  });
  const thumbs = h("div", { class: "pd-modal__thumbs" });

  if (images.length > 1) {
    images.forEach((src, index) => {
      const thumb = h(
        "button",
        {
          type: "button",
          class: "pd-modal__thumb" + (index === 0 ? " is-active" : ""),
        },
        h("img", { src, alt: "" }),
      );
      thumb.addEventListener("click", () => {
        main.src = src;
        thumbs
          .querySelectorAll(".pd-modal__thumb")
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
        { class: "pd-modal__specs" },
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
    class: "pd-modal__close",
    "aria-label": "Close",
    text: "×",
  });
  close.addEventListener("click", closeProductModal);

  modalPanel.replaceChildren(
    close,
    h(
      "div",
      { class: "pd-modal__media" },
      images.length ? main : null,
      images.length > 1 ? thumbs : null,
    ),
    h(
      "div",
      { class: "pd-modal__info" },
      h("span", {
        class: "pd-modal__cat",
        text: CATEGORIES[product.category] || "",
      }),
      h("h2", { class: "pd-modal__title", text: product.name || "" }),
      product.description
        ? h("p", { class: "pd-modal__desc", text: product.description })
        : null,
      specTable,
      product.moq
        ? h("p", { class: "pd-modal__moq", text: "MOQ: " + product.moq })
        : null,
      h("a", {
        class: "btn btn--teal pd-modal__cta",
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
