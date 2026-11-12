import { auth, db, configured, isAdminEmail } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { SEED_PRODUCTS } from "./seed-products.js";

const page = location.pathname.split("/").pop() || "index.html";
const BY_LINK = new Map(SEED_PRODUCTS.map((item) => [item.link, item]));

export async function trackEvent(type, info = {}) {
  if (!configured || !auth) return;
  const user = auth.currentUser;
  if (!user || isAdminEmail(user.email)) return;

  const key = "jee-ev-" + type + "-" + (info.productId || info.page || page);
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch (error) {}

  try {
    await addDoc(collection(db, "events"), {
      uid: user.uid,
      email: user.email || "",
      type,
      productId: String(info.productId || ""),
      name: String(info.name || "").slice(0, 150),
      category: String(info.category || ""),
      page: String(info.page || page).slice(0, 80),
      at: serverTimestamp(),
    });
  } catch (error) {
    console.warn("Aktivitas tidak tercatat:", error);
  }
}

if (configured && auth) {
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    const seed = BY_LINK.get(page);
    if (seed) {
      trackEvent("product_view", {
        productId: seed.id,
        name: seed.name,
        category: seed.category,
      });
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    const anchor =
      target && target.closest ? target.closest('a[href*="wa.me"]') : null;
    if (!anchor) return;
    const panel = anchor.closest(".pd-modal__panel");
    if (panel && panel.dataset.pid) {
      trackEvent("whatsapp_click", {
        productId: panel.dataset.pid,
        name: panel.dataset.pname,
        category: panel.dataset.pcat,
      });
      return;
    }
    const seed = BY_LINK.get(page);
    if (seed) {
      trackEvent("whatsapp_click", {
        productId: seed.id,
        name: seed.name,
        category: seed.category,
      });
      return;
    }
    trackEvent("whatsapp_click", { productId: "", name: "", page });
  });
}
