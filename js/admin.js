import { auth, db, configured, isAdminEmail } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { h } from "./dom.js";
import { recordVisit } from "./track.js";
import { SEED_PRODUCTS } from "./seed-products.js";
import { SEED_GALLERY } from "./seed-gallery.js";
import { inProducts, inGallery } from "./product-utils.js";

const CATEGORIES = {
  kitchenware: "Kitchenware",
  furniture: "Furniture",
  homedecor: "Home Decor",
};
const GALLERY_GROUPS = {};
SEED_GALLERY.forEach((item) => {
  const list = GALLERY_GROUPS[item.category] || (GALLERY_GROUPS[item.category] = []);
  if (!list.includes(item.galleryGroup)) list.push(item.galleryGroup);
});
const CATEGORY_ORDER = ["kitchenware", "furniture", "homedecor"];
const MAX_IMAGES = 3;
const MAX_IMAGE_EDGE = 900;
const MAX_TOTAL_CHARS = 900000;

const $ = (selector) => document.querySelector(selector);

const state = {
  user: null,
  products: [],
  buyers: [],
  logins: [],
  editingId: null,
  images: [],
  busy: false,
};

function toast(text, isError = false) {
  const node = $("#adminToast");
  node.textContent = text;
  node.classList.toggle("is-error", isError);
  node.classList.add("is-visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("is-visible"), 3200);
}

function showGate(text, actions = []) {
  $("#adminApp").hidden = true;
  $("#adminGate").hidden = false;
  $("#adminGateText").textContent = text;
  $("#adminGateActions").replaceChildren(...actions);
}

function millis(value) {
  return value && value.toMillis ? value.toMillis() : 0;
}

function formatDate(value) {
  if (!value || !value.toDate) return "-";
  return value.toDate().toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function specsToText(specs) {
  return (specs || [])
    .map((row) => (row.value ? row.label + ": " + row.value : row.label))
    .join("\n");
}

function textToSpecs(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf(":");
      return index === -1
        ? { label: line, value: "" }
        : {
            label: line.slice(0, index).trim(),
            value: line.slice(index + 1).trim(),
          };
    });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Foto tidak bisa dibaca."));
    };
    img.src = url;
  });
}

function totalChars(images) {
  return images.reduce((sum, item) => sum + item.length, 0);
}

function renderStats() {
  $("#statProducts").textContent = state.products.length;
  $("#statPublished").textContent = state.products.filter(
    (item) => item.published,
  ).length;
  $("#statBuyers").textContent = state.buyers.filter(
    (item) => !isAdminEmail(item.email),
  ).length;
}

function renderProducts() {
  const term = $("#productSearch").value.trim().toLowerCase();
  const cat = $("#productFilter").value;
  const place = $("#placementFilter").value;
  const list = state.products
    .filter((item) => cat === "all" || item.category === cat)
    .filter(
      (item) =>
        place === "all" ||
        (place === "products" ? inProducts(item) : inGallery(item)),
    )
    .filter((item) => !term || (item.name || "").toLowerCase().includes(term))
    .sort((a, b) => {
      const orderA = typeof a.order === "number";
      const orderB = typeof b.order === "number";
      if (orderA !== orderB) return orderA ? 1 : -1;
      if (!orderA) return millis(b.createdAt) - millis(a.createdAt);
      return (
        Number(inGallery(a) && !inProducts(a)) - Number(inGallery(b) && !inProducts(b)) ||
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        a.order - b.order
      );
    });

  const empty = $("#productEmpty");
  empty.hidden = list.length > 0;
  if (!list.length) {
    empty.textContent = state.products.length
      ? "Tidak ada produk yang cocok."
      : 'Belum ada produk. Klik "+ Tambah Produk" untuk mulai.';
  }

  $("#productRows").replaceChildren(
    ...list.map((item) => {
      const first = (item.images || [])[0];
      const toggle = h("input", { type: "checkbox" });
      toggle.checked = !!item.published;
      toggle.addEventListener("change", () => togglePublished(item, toggle));

      const edit = h("button", {
        type: "button",
        class: "admin-btn admin-btn--ghost admin-btn--small",
        text: "Ubah",
      });
      edit.addEventListener("click", () => openForm(item));

      const remove = h("button", {
        type: "button",
        class: "admin-btn admin-btn--danger admin-btn--small",
        text: "Hapus",
      });
      remove.addEventListener("click", () => removeProduct(item));

      return h(
        "tr",
        {},
        h(
          "td",
          {},
          first
            ? h("img", { class: "admin-thumb", src: first, alt: "" })
            : h("div", { class: "admin-thumb admin-thumb--empty", text: "No photo" }),
        ),
        h(
          "td",
          {},
          h("div", { class: "admin-name", text: item.name || "" }),
          h("div", {
            class: "admin-sub",
            text: (CATEGORIES[item.category] || "") + (item.link ? " · " + item.link : ""),
          }),
          inProducts(item) ? h("span", { class: "admin-tag", text: "Best Seller" }) : null,
          inGallery(item)
            ? h("span", {
                class: "admin-tag",
                text: "Gallery" + (item.galleryGroup ? " · " + item.galleryGroup : ""),
              })
            : null,
        ),
        h("td", { text: item.moq || "-" }),
        h("td", {}, h("label", { class: "admin-switch" }, toggle, h("span"))),
        h("td", {}, h("div", { class: "admin-actions" }, edit, remove)),
      );
    }),
  );
}

function renderBuyers() {
  const term = $("#buyerSearch").value.trim().toLowerCase();
  const list = state.buyers.filter(
    (item) =>
      !term ||
      (item.name || "").toLowerCase().includes(term) ||
      (item.email || "").toLowerCase().includes(term),
  );

  const empty = $("#buyerEmpty");
  empty.hidden = list.length > 0;
  if (!list.length) {
    empty.textContent = state.buyers.length
      ? "Tidak ada data yang cocok."
      : "Belum ada calon buyer yang login.";
  }

  $("#buyerRows").replaceChildren(
    ...list.map((item) =>
      h(
        "tr",
        {},
        h(
          "td",
          {},
          h("div", { class: "admin-name", text: item.name || "-" }),
          isAdminEmail(item.email) ? h("span", { class: "admin-tag", text: "Admin" }) : null,
        ),
        h("td", { text: item.email || "-" }),
        h("td", { text: formatDate(item.firstLogin) }),
        h("td", { text: formatDate(item.lastLogin) }),
        h("td", { text: String(item.loginCount || 1) }),
      ),
    ),
  );
}

async function loadProducts() {
  const snap = await getDocs(collection(db, "products"));
  state.products = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  renderProducts();
  renderStats();
}

async function loadBuyers() {
  const snap = await getDocs(
    query(collection(db, "buyers"), orderBy("lastLogin", "desc")),
  );
  state.buyers = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  renderBuyers();
  renderStats();
}

function renderLogins() {
  const term = $("#loginSearch").value.trim().toLowerCase();
  const list = state.logins.filter(
    (item) =>
      !term ||
      (item.name || "").toLowerCase().includes(term) ||
      (item.email || "").toLowerCase().includes(term),
  );

  const empty = $("#loginEmpty");
  empty.hidden = list.length > 0;
  if (!list.length) {
    empty.textContent = state.logins.length
      ? "Tidak ada data yang cocok."
      : "Belum ada riwayat login. Riwayat tercatat setiap kali seseorang login ke website.";
  }

  $("#loginRows").replaceChildren(
    ...list.map((item) =>
      h(
        "tr",
        {},
        h("td", { text: formatDate(item.at) }),
        h(
          "td",
          {},
          h("div", { class: "admin-name", text: item.name || "-" }),
          isAdminEmail(item.email) ? h("span", { class: "admin-tag", text: "Admin" }) : null,
        ),
        h("td", { text: item.email || "-" }),
      ),
    ),
  );
}

async function loadLogins() {
  const snap = await getDocs(
    query(collection(db, "logins"), orderBy("at", "desc"), limit(300)),
  );
  state.logins = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  renderLogins();
}

async function importSeed() {
  const byId = new Map(state.products.map((item) => [item.id, item]));
  const idByLink = new Map(SEED_PRODUCTS.map((item) => [item.link, item.id]));
  const merged = new Map();
  SEED_GALLERY.forEach((item) => {
    if (item.link && idByLink.has(item.link)) {
      merged.set(idByLink.get(item.link), item);
    }
  });
  const mergedGalleryIds = new Set(
    Array.from(merged.values()).map((item) => item.id),
  );

  const todo = [
    ...SEED_PRODUCTS.map((item) => {
      const twin = merged.get(item.id);
      return {
        ...item,
        showInProducts: true,
        showInGallery: Boolean(twin),
        galleryGroup: twin ? twin.galleryGroup : "",
      };
    }),
    ...SEED_GALLERY.filter((item) => !mergedGalleryIds.has(item.id)).map(
      (item) => ({
        ...item,
        showInProducts: false,
        showInGallery: true,
      }),
    ),
  ].filter((item) => !byId.has(item.id));

  const toMerge = [];
  merged.forEach((twin, productId) => {
    const current = byId.get(productId);
    if (current && !current.showInGallery) toMerge.push({ productId, twin });
  });
  const duplicates = Array.from(mergedGalleryIds).filter((id) => byId.has(id));

  if (!todo.length && !toMerge.length && !duplicates.length) {
    toast("Semua produk bawaan website sudah ada di dashboard.");
    return;
  }
  if (
    !confirm(
      "Impor " +
        todo.length +
        " produk bawaan dan rapikan " +
        (toMerge.length + duplicates.length) +
        " produk kembar (Best Seller dan Gallery digabung jadi satu)?",
    )
  ) {
    return;
  }
  const button = $("#importSeed");
  button.disabled = true;
  try {
    for (const item of todo) {
      const { id, ...rest } = item;
      await setDoc(doc(db, "products", id), {
        ...rest,
        moq: "",
        specs: [],
        published: true,
        fromSeed: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: state.user.email,
      });
    }
    for (const { productId, twin } of toMerge) {
      await updateDoc(doc(db, "products", productId), {
        showInGallery: true,
        galleryGroup: twin.galleryGroup,
        updatedAt: serverTimestamp(),
        updatedBy: state.user.email,
      });
    }
    for (const id of duplicates) {
      await deleteDoc(doc(db, "products", id));
    }
    await loadProducts();
    toast("Impor dan perapian selesai.");
  } catch (error) {
    console.error(error);
    toast("Impor gagal. Periksa aturan Firestore.", true);
  } finally {
    button.disabled = false;
  }
}

async function loadAll() {
  try {
    await Promise.all([loadProducts(), loadBuyers(), loadLogins()]);
  } catch (error) {
    console.error(error);
    toast(
      error && error.code === "permission-denied"
        ? "Akses ditolak. Periksa aturan Firestore dan daftar email admin."
        : "Data gagal dimuat.",
      true,
    );
  }
}

async function togglePublished(item, input) {
  try {
    await updateDoc(doc(db, "products", item.id), {
      published: input.checked,
      updatedAt: serverTimestamp(),
    });
    item.published = input.checked;
    renderStats();
    toast(input.checked ? "Produk ditayangkan." : "Produk disembunyikan.");
  } catch (error) {
    console.error(error);
    input.checked = !input.checked;
    toast("Gagal mengubah status.", true);
  }
}

async function removeProduct(item) {
  if (!confirm('Hapus produk "' + item.name + '"? Tindakan ini tidak bisa dibatalkan.')) {
    return;
  }
  try {
    await deleteDoc(doc(db, "products", item.id));
    state.products = state.products.filter((row) => row.id !== item.id);
    renderProducts();
    renderStats();
    toast("Produk dihapus.");
  } catch (error) {
    console.error(error);
    toast("Gagal menghapus produk.", true);
  }
}

function renderPreviews() {
  $("#imagePreviews").replaceChildren(
    ...state.images.map((src, index) => {
      const remove = h("button", {
        type: "button",
        "aria-label": "Hapus foto",
        text: "×",
      });
      remove.addEventListener("click", () => {
        state.images.splice(index, 1);
        renderPreviews();
      });
      return h(
        "div",
        { class: "admin-preview" },
        h("img", { src, alt: "" }),
        remove,
      );
    }),
  );
}

function fillGroups(selected) {
  const groups = GALLERY_GROUPS[$("#fCategory").value] || [];
  const select = $("#fGroup");
  select.replaceChildren(
    ...groups.map((name) => h("option", { value: name, text: name })),
  );
  if (selected && groups.includes(selected)) select.value = selected;
  $("#groupField").hidden = !$("#fInGallery").checked;
}

function openForm(item) {
  state.editingId = item ? item.id : null;
  state.images = item ? [...(item.images || [])] : [];
  $("#formTitle").textContent = item ? "Ubah Produk" : "Tambah Produk";
  $("#fName").value = item ? item.name || "" : "";
  $("#fCategory").value = item ? item.category || "kitchenware" : "kitchenware";
  $("#fMoq").value = item ? item.moq || "" : "";
  $("#fDescription").value = item ? item.description || "" : "";
  $("#fSpecs").value = item ? specsToText(item.specs) : "";
  $("#fPublished").checked = item ? !!item.published : true;
  $("#fInProducts").checked = item ? inProducts(item) : true;
  $("#fInGallery").checked = item ? inGallery(item) : false;
  fillGroups(item ? item.galleryGroup : "");
  $("#fImages").value = "";
  $("#formError").textContent = "";
  renderPreviews();
  $("#productModal").classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function closeForm() {
  $("#productModal").classList.remove("is-open");
  document.body.style.overflow = "";
}

async function handleImages(event) {
  const files = Array.from(event.target.files || []);
  const error = $("#formError");
  error.textContent = "";
  const room = MAX_IMAGES - state.images.length;
  if (files.length > room) {
    error.textContent = "Maksimal " + MAX_IMAGES + " foto per produk.";
  }
  for (const file of files.slice(0, Math.max(room, 0))) {
    if (!file.type.startsWith("image/")) {
      error.textContent = "Hanya file gambar yang diperbolehkan.";
      continue;
    }
    try {
      const data = await fileToDataUrl(file);
      if (totalChars([...state.images, data]) > MAX_TOTAL_CHARS) {
        error.textContent = "Total ukuran foto terlalu besar. Gunakan foto yang lebih sedikit.";
        break;
      }
      state.images.push(data);
    } catch (problem) {
      error.textContent = problem.message;
    }
  }
  event.target.value = "";
  renderPreviews();
}

async function saveProduct(event) {
  event.preventDefault();
  if (state.busy) return;

  const name = $("#fName").value.trim();
  const error = $("#formError");
  error.textContent = "";

  if (!name) {
    error.textContent = "Nama produk wajib diisi.";
    return;
  }
  if (!$("#fInProducts").checked && !$("#fInGallery").checked) {
    error.textContent = "Pilih minimal satu tempat tampil: Best Seller atau Gallery.";
    return;
  }

  const data = {
    name,
    category: $("#fCategory").value,
    moq: $("#fMoq").value.trim(),
    description: $("#fDescription").value.trim(),
    specs: textToSpecs($("#fSpecs").value),
    images: state.images,
    published: $("#fPublished").checked,
    showInProducts: $("#fInProducts").checked,
    showInGallery: $("#fInGallery").checked,
    galleryGroup: $("#fInGallery").checked ? $("#fGroup").value : "",
    updatedAt: serverTimestamp(),
    updatedBy: state.user.email,
  };

  state.busy = true;
  const button = $("#saveForm");
  button.disabled = true;
  button.textContent = "Menyimpan…";

  try {
    if (state.editingId) {
      await updateDoc(doc(db, "products", state.editingId), data);
    } else {
      await addDoc(collection(db, "products"), {
        ...data,
        createdAt: serverTimestamp(),
      });
    }
    closeForm();
    await loadProducts();
    toast(state.editingId ? "Produk diperbarui." : "Produk ditambahkan.");
  } catch (problem) {
    console.error(problem);
    error.textContent =
      problem && problem.code === "permission-denied"
        ? "Akses ditolak. Pastikan email admin sudah terdaftar di aturan Firestore."
        : "Gagal menyimpan produk. Coba lagi.";
  } finally {
    state.busy = false;
    button.disabled = false;
    button.textContent = "Simpan";
  }
}

function exportBuyers() {
  const rows = [["Nama", "Email", "Pertama masuk", "Terakhir masuk", "Jumlah login"]];
  state.buyers.forEach((item) =>
    rows.push([
      item.name || "",
      item.email || "",
      formatDate(item.firstLogin),
      formatDate(item.lastLogin),
      item.loginCount || 1,
    ]),
  );
  const csv = rows
    .map((row) =>
      row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(","),
    )
    .join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const link = h("a", {
    href: URL.createObjectURL(blob),
    download: "calon-buyer.csv",
  });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function switchTab(tab) {
  document.querySelectorAll(".admin-tab").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.tab === tab);
  });
  $("#tabProducts").hidden = tab !== "products";
  $("#tabBuyers").hidden = tab !== "buyers";
  $("#tabLogins").hidden = tab !== "logins";
}

function bindUi() {
  document.querySelectorAll(".admin-tab").forEach((item) => {
    item.addEventListener("click", () => switchTab(item.dataset.tab));
  });
  $("#addProduct").addEventListener("click", () => openForm(null));
  $("#cancelForm").addEventListener("click", closeForm);
  $("#productForm").addEventListener("submit", saveProduct);
  $("#fImages").addEventListener("change", handleImages);
  $("#productSearch").addEventListener("input", renderProducts);
  $("#productFilter").addEventListener("change", renderProducts);
  $("#placementFilter").addEventListener("change", renderProducts);
  $("#fCategory").addEventListener("change", () => fillGroups(""));
  $("#fInGallery").addEventListener("change", () => fillGroups($("#fGroup").value));
  $("#buyerSearch").addEventListener("input", renderBuyers);
  $("#loginSearch").addEventListener("input", renderLogins);
  $("#importSeed").addEventListener("click", importSeed);
  $("#adminRefresh").addEventListener("click", async () => {
    await loadAll();
    toast("Data diperbarui.");
  });
  $("#exportBuyers").addEventListener("click", exportBuyers);
  $("#adminLogout").addEventListener("click", async () => {
    await signOut(auth);
    location.href = "index.html";
  });
  $("#productModal").addEventListener("click", (event) => {
    if (event.target === $("#productModal")) closeForm();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeForm();
  });
}

let bound = false;

if (!configured) {
  showGate(
    "Firebase belum dikonfigurasi. Isi js/firebase-config.js, lalu muat ulang halaman (lihat SETUP-FIREBASE.md).",
  );
} else {
  onAuthStateChanged(auth, (user) => {
    state.user = user;

    if (!user) {
      location.replace("login.html?next=admin.html");
      return;
    }

    if (!isAdminEmail(user.email)) {
      const out = h("button", {
        type: "button",
        class: "admin-btn",
        text: "Keluar",
      });
      out.addEventListener("click", () => signOut(auth));
      showGate(
        "Akun " + user.email + " tidak memiliki akses admin.",
        [h("a", { href: "index.html", class: "admin-btn admin-btn--ghost", text: "Ke website" }), out],
      );
      return;
    }

    $("#adminGate").hidden = true;
    $("#adminApp").hidden = false;
    $("#adminEmail").textContent = user.email;
    if (!bound) {
      bound = true;
      bindUi();
    }
    Promise.race([
      recordVisit(user),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]).then(loadAll);
  });
}
