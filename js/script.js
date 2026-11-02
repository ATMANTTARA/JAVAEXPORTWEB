// ===========================================================
// Toggle dark / light theme
// The theme is stored in localStorage (key: "jee-theme") so it stays
// consistent when navigating between pages or reloading. The initial
// value is already applied earlier via an inline <script> in the
// <head> of each page (to avoid a color "flash") — here we just need
// to attach the click handler for the button.
// ===========================================================
const themeToggle = document.getElementById("themeToggle");
const THEME_KEY = "jee-theme";

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const current =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  });
}

// ===========================================================
// Contact Us form — send the form data to WhatsApp
// The business WhatsApp number is taken from the phone number in the topbar.
// When the form is submitted, it opens WhatsApp (the app on mobile /
// web.whatsapp.com on desktop) with a message automatically filled in
// from the form fields, so the user just has to tap send.
// ===========================================================
const contactForm = document.getElementById("contactForm");
const WHATSAPP_NUMBER = "6285871113657"; // +62 858-7111-3657, no spaces/plus sign

if (contactForm) {
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = document.getElementById("contactName").value.trim();
    const email = document.getElementById("contactEmail").value.trim();
    const phone = document.getElementById("contactPhone").value.trim();
    const message = document.getElementById("contactMessage").value.trim();

    const lines = [
      "Hello PT. Java Essence Export, I would like to ask about your products.",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
    ];
    if (phone) lines.push(`Phone: ${phone}`);
    lines.push("", `Message: ${message}`);

    const waText = encodeURIComponent(lines.join("\n"));
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

    window.open(waUrl, "_blank");
  });
}

// Smooth hero video loop — restart slightly BEFORE the true end,
// avoiding the native `loop` attribute's end-of-stream flash/glitch in Chrome.
const heroVideo = document.getElementById("heroVideo");

if (heroVideo) {
  const LOOP_BUFFER = 0.25; // seconds to cut before the real end

  heroVideo.addEventListener("timeupdate", () => {
    if (
      heroVideo.duration &&
      heroVideo.currentTime > heroVideo.duration - LOOP_BUFFER
    ) {
      heroVideo.currentTime = 0.01;
    }
  });

  // Safety net: if the browser still fires 'ended' for any reason, restart it.
  heroVideo.addEventListener("ended", () => {
    heroVideo.currentTime = 0.01;
    heroVideo.play().catch(() => {});
  });
}

// Header: transparent at top, solid once scrolled
const siteHeader = document.getElementById("siteHeader");

if (siteHeader) {
  const toggleHeaderState = () => {
    if (window.scrollY > 40) {
      siteHeader.classList.add("is-scrolled");
    } else {
      siteHeader.classList.remove("is-scrolled");
    }
  };

  toggleHeaderState(); // run once on load (in case page is reloaded mid-scroll)
  window.addEventListener("scroll", toggleHeaderState, { passive: true });
}

// Toggle mobile navigation menu
const navToggle = document.getElementById("navToggle");
const navMenu = document.querySelector(".navbar__nav");

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    navMenu.classList.toggle("is-open");
  });

  // Close menu when a plain link is clicked
  navMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => navMenu.classList.remove("is-open"));
  });
}

// Toggle "Products" dropdown (click-based, works for mobile & desktop)
const dropdown = document.querySelector(".navbar__dropdown");
const dropdownToggle = document.querySelector(".navbar__dropdown-toggle");

if (dropdown && dropdownToggle) {
  dropdownToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle("is-open");
    dropdownToggle.setAttribute("aria-expanded", isOpen);
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove("is-open");
      dropdownToggle.setAttribute("aria-expanded", "false");
    }
  });
}

// ===========================================================
// Reveal animation on scroll — elements fade + slide up as they
// come into view. Runs automatically on every page that uses this
// script.js, no need to add classes manually in the HTML.
// ===========================================================
const revealTargets = document.querySelectorAll(
  [
    ".section-title",
    ".product-overview__text",
    ".size-table",
    ".info-block",
    ".info-block-duo",
    ".product-gallery__item",
    ".product-card",
    ".why-choose__box",
    ".partnership__step",
    ".partnership__banner",
    ".contact-bar__inner",
    ".contact-info",
    ".contact-form",
  ].join(", "),
);

if (revealTargets.length) {
  revealTargets.forEach((el) => el.classList.add("reveal"));

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );

    revealTargets.forEach((el) => revealObserver.observe(el));
  } else {
    // Older browsers without IntersectionObserver: just show it directly
    revealTargets.forEach((el) => el.classList.add("is-visible"));
  }
}

// ===========================================================
// Sticky category tabs on products.html — highlights the tab that
// matches the section (Kitchenware/Furniture/Home Decor) currently
// visible on screen while scrolling, and immediately sets the
// active tab when the page is opened via an anchor link (e.g. from
// a category card on index.html: products.html#furniture).
// ===========================================================
const categoryTabs = document.querySelectorAll(".category-tabs__link");
const categorySections = document.querySelectorAll(".category-section[id]");

if (categoryTabs.length && categorySections.length) {
  const setActiveTab = (id) => {
    categoryTabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.getAttribute("href") === `#${id}`);
    });
  };

  // Mark the active tab directly from the URL hash (or the first
  // section if there's no hash), so the highlight doesn't have to
  // wait for the observer to fire.
  const initialId = window.location.hash
    ? window.location.hash.slice(1)
    : categorySections[0].id;
  setActiveTab(initialId);

  if ("IntersectionObserver" in window) {
    // Offset roughly equal to the site-header + sticky tab bar height, so a
    // section is considered "active" once its top has just passed below
    // the tab bar.
    const isDesktop = window.innerWidth >= 768;
    const stickyOffset = isDesktop ? 96 + 60 : 64 + 52;

    const categoryObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveTab(entry.target.id);
          }
        });
      },
      { rootMargin: `-${stickyOffset}px 0px -70% 0px`, threshold: 0 },
    );

    categorySections.forEach((section) => categoryObserver.observe(section));
  }
}

const CONTACT_LINKS = {
  whatsapp: "https://wa.me/6285871113657",
  phone: "tel:+6285871113657",
  email: "mailto:info-export@javaessenceexport.com",
  linkedin: "https://id.linkedin.com/in/pt-java-essence-export-272635362",
  instagram: "https://www.instagram.com/javaessencexport",
  facebook: "https://www.facebook.com/profile.php?id=61575627136634",
  tiktok: "https://www.tiktok.com/@java.essence.expo",
  telegram: "https://t.me/+6285871113657",
};

function wireContactLinks() {
  document.querySelectorAll("a[href='#']").forEach((anchor) => {
    const label = (
      anchor.getAttribute("aria-label") ||
      anchor.textContent.trim().split(/\s+/)[0] ||
      ""
    ).toLowerCase();
    const url = CONTACT_LINKS[label];
    if (!url) return;
    anchor.setAttribute("href", url);
    if (/^https?:/.test(url)) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener");
    }
  });

  document.querySelectorAll(".topbar__phone").forEach((node) => {
    if (node.tagName === "A") return;
    const link = document.createElement("a");
    link.className = node.className;
    link.href = CONTACT_LINKS.phone;
    link.textContent = node.textContent;
    link.style.color = "inherit";
    link.style.textDecoration = "none";
    node.replaceWith(link);
  });
}

function addInstagramRow() {
  document.querySelectorAll(".site-footer__contact").forEach((box) => {
    if (box.querySelector("[data-ig-row]")) return;
    const row = document.createElement("a");
    row.className = "site-footer__contact-row";
    row.setAttribute("data-ig-row", "1");
    row.href = CONTACT_LINKS.instagram;
    row.target = "_blank";
    row.rel = "noopener";
    row.innerHTML =
      "<span>Instagram</span>" +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
      '<path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.25-3.1a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3z"/></svg>' +
      "<span>@javaessencexport</span>";
    box.append(row);
  });
}

addInstagramRow();
wireContactLinks();
