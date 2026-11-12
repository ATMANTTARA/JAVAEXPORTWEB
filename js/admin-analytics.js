import { h } from "./dom.js";
import { isAdminEmail } from "./firebase.js";

const DAY = 86400000;
const CATEGORY_LABELS = {
  kitchenware: "Kitchenware",
  furniture: "Furniture",
  homedecor: "Home Decor",
};

function millis(value) {
  return value && value.toMillis ? value.toMillis() : 0;
}

function dayStart(time) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function count(list, keyFn, labelFn) {
  const map = new Map();
  list.forEach((item) => {
    const key = keyFn(item);
    if (!key) return;
    const entry = map.get(key) || { key, label: labelFn(item), total: 0 };
    entry.total += 1;
    map.set(key, entry);
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function kpi(value, label) {
  return h(
    "div",
    { class: "an-kpi" },
    h("strong", { text: String(value) }),
    h("span", { text: label }),
  );
}

function barsVertical(points) {
  const max = Math.max(1, ...points.map((item) => item.value));
  const step = Math.ceil(points.length / 8);
  return h(
    "div",
    { class: "an-vbars", role: "img", "aria-label": "Grafik batang jumlah login" },
    ...points.map((item, index) =>
      h(
        "div",
        { class: "an-vbar", title: item.label + ": " + item.value },
        h("span", { class: "an-vbar__value", text: item.value || "" }),
        h("div", {
          class: "an-vbar__fill",
          style: "height:" + Math.round((item.value / max) * 100) + "%",
        }),
        h("span", {
          class: "an-vbar__label",
          text: index % step === 0 ? item.label : "",
        }),
      ),
    ),
  );
}

function barsHorizontal(rows, emptyText) {
  if (!rows.length) return h("p", { class: "an-empty", text: emptyText });
  const max = Math.max(1, ...rows.map((item) => item.total));
  return h(
    "div",
    { class: "an-hbars" },
    ...rows.map((item) =>
      h(
        "div",
        { class: "an-hbar" },
        h("span", { class: "an-hbar__label", text: item.label }),
        h(
          "div",
          { class: "an-hbar__track" },
          h("div", {
            class: "an-hbar__fill",
            style: "width:" + Math.round((item.total / max) * 100) + "%",
          }),
        ),
        h("span", { class: "an-hbar__value", text: String(item.total) }),
      ),
    ),
  );
}

function card(title, ...kids) {
  return h(
    "section",
    { class: "an-card" },
    h("h3", { text: title }),
    ...kids,
  );
}


const STATUSES = [
  "Belum dihubungi",
  "Sudah dihubungi",
  "Menunggu balasan",
  "Negosiasi",
  "Selesai",
];
const PRIORITY_LABEL = { hot: "Panas", warm: "Hangat", cold: "Dingin" };

let regionNames = null;
function countryName(code) {
  if (!code) return "Belum diisi";
  try {
    if (!regionNames) {
      regionNames = new Intl.DisplayNames(["id"], { type: "region" });
    }
    return regionNames.of(code) || code;
  } catch (error) {
    return code;
  }
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function topOf(map, limit) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export function followUpRows(data) {
  const now = Date.now();
  const cutoff = now - data.days * DAY;
  const allEvents = (data.events || []).filter((item) => !isAdminEmail(item.email));
  const buyers = (data.buyers || []).filter((item) => !isAdminEmail(item.email));
  const byUid = new Map();

  buyers.forEach((item) => {
    byUid.set(item.id || item.uid, {
      uid: item.id || item.uid,
      name: item.name || "",
      email: item.email || "",
      company: item.company || "",
      phone: item.phone || "",
      country: item.country || "",
      followUp: item.followUp || STATUSES[0],
      lastLogin: millis(item.lastLogin),
      lastActive: millis(item.lastLogin),
      views: 0,
      clicks: 0,
      products: new Map(),
      categories: new Map(),
    });
  });

  allEvents.forEach((item) => {
    const row = byUid.get(item.uid);
    if (!row) return;
    const time = millis(item.at);
    if (time > row.lastActive) row.lastActive = time;
    if (time < cutoff) return;
    if (item.type === "product_view") {
      row.views += 1;
      const key = item.name || item.productId;
      if (key) row.products.set(key, (row.products.get(key) || 0) + 1);
      if (item.category) {
        row.categories.set(item.category, (row.categories.get(item.category) || 0) + 1);
      }
    } else if (item.type === "whatsapp_click") {
      row.clicks += 1;
    }
  });

  return Array.from(byUid.values())
    .map((row) => {
      const topProducts = topOf(row.products, 3).map((entry) => entry[0]);
      let priority = "cold";
      if (row.clicks > 0 || row.products.size >= 3) priority = "hot";
      else if (row.views > 0) priority = "warm";
      return { ...row, topProducts, priority };
    })
    .sort((a, b) => {
      const rank = { hot: 0, warm: 1, cold: 2 };
      if (rank[a.priority] !== rank[b.priority]) {
        return rank[a.priority] - rank[b.priority];
      }
      return b.lastActive - a.lastActive;
    });
}

function countryRows(data) {
  const cutoff = Date.now() - data.days * DAY;
  const buyers = (data.buyers || []).filter((item) => !isAdminEmail(item.email));
  const countryOf = new Map(buyers.map((item) => [item.id || item.uid, item.country || ""]));
  const map = new Map();

  function entry(code) {
    if (!map.has(code)) {
      map.set(code, {
        code,
        label: countryName(code),
        buyers: 0,
        views: 0,
        clicks: 0,
        categories: new Map(),
        products: new Map(),
      });
    }
    return map.get(code);
  }

  buyers.forEach((item) => {
    entry(item.country || "").buyers += 1;
  });

  (data.events || []).forEach((item) => {
    if (isAdminEmail(item.email) || millis(item.at) < cutoff) return;
    if (!countryOf.has(item.uid)) return;
    const row = entry(countryOf.get(item.uid));
    if (item.type === "product_view") {
      row.views += 1;
      if (item.category) {
        row.categories.set(item.category, (row.categories.get(item.category) || 0) + 1);
      }
      const key = item.name || item.productId;
      if (key) row.products.set(key, (row.products.get(key) || 0) + 1);
    } else if (item.type === "whatsapp_click") {
      row.clicks += 1;
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => b.views - a.views || b.buyers - a.buyers,
  );
}

function marketCard(data) {
  const rows = countryRows(data);
  const active = rows.filter((row) => row.views > 0 || row.buyers > 0);
  if (!active.length) {
    return card("Pasar per negara", h("p", { class: "an-empty", text: "Belum ada data buyer." }));
  }
  const withViews = rows.filter((row) => row.views > 0).slice(0, 10);
  const note = rows.some((row) => !row.code && row.buyers)
    ? h("p", {
        class: "an-empty",
        text: "Sebagian buyer belum mengisi negara. Formulir profil muncul saat mereka membuka website setelah login.",
      })
    : null;

  const table = h(
    "div",
    { class: "admin-table-wrap an-wrap" },
    h(
      "table",
      { class: "admin-table" },
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          h("th", { text: "Negara" }),
          h("th", { text: "Buyer" }),
          h("th", { text: "Dilihat" }),
          h("th", { text: "Klik WA" }),
          h("th", { text: "Kategori favorit" }),
          h("th", { text: "Produk favorit" }),
        ),
      ),
      h(
        "tbody",
        {},
        ...active.map((row) => {
          const cat = topOf(row.categories, 1)[0];
          const prod = topOf(row.products, 1)[0];
          return h(
            "tr",
            {},
            h("td", {}, h("span", { class: "admin-name", text: row.label })),
            h("td", { text: String(row.buyers) }),
            h("td", { text: String(row.views) }),
            h("td", { text: String(row.clicks) }),
            h("td", { text: cat ? CATEGORY_LABELS[cat[0]] || cat[0] : "-" }),
            h("td", { text: prod ? prod[0] + " (" + prod[1] + ")" : "-" }),
          );
        }),
      ),
    ),
  );

  return h(
    "section",
    { class: "an-card" },
    h("h3", { text: "Pasar per negara: produk yang diminati" }),
    withViews.length
      ? barsHorizontal(
          withViews.map((row) => ({ key: row.code, label: row.label, total: row.views })),
          "",
        )
      : h("p", { class: "an-empty", text: "Belum ada produk yang dilihat." }),
    note,
    table,
  );
}

function contactLinks(row) {
  const product = row.topProducts[0] || "our products";
  const text =
    "Hello " +
    (row.name || "") +
    ", this is PT. Java Essence Export. Thank you for your interest in " +
    product +
    ". May we help you with more details or a quotation?";
  const links = [];
  const number = digits(row.phone);
  if (number) {
    links.push(
      h("a", {
        class: "admin-btn admin-btn--ghost admin-btn--small",
        href: "https://wa.me/" + number + "?text=" + encodeURIComponent(text),
        target: "_blank",
        rel: "noopener",
        text: "WhatsApp",
      }),
    );
  }
  if (row.email) {
    links.push(
      h("a", {
        class: "admin-btn admin-btn--ghost admin-btn--small",
        href:
          "mailto:" +
          row.email +
          "?subject=" +
          encodeURIComponent("PT. Java Essence Export - " + product) +
          "&body=" +
          encodeURIComponent(text),
        text: "Email",
      }),
    );
  }
  return h("div", { class: "admin-actions" }, ...links);
}

function followUpCard(data) {
  const all = followUpRows(data);
  const countries = Array.from(new Set(all.map((row) => row.country)));
  const countrySel = h(
    "select",
    { class: "admin-select" },
    h("option", { value: "all", text: "Semua negara" }),
    ...countries.map((code) => h("option", { value: code, text: countryName(code) })),
  );
  const prioritySel = h(
    "select",
    { class: "admin-select" },
    h("option", { value: "all", text: "Semua prioritas" }),
    h("option", { value: "hot", text: "Panas" }),
    h("option", { value: "warm", text: "Hangat" }),
    h("option", { value: "cold", text: "Dingin" }),
  );
  const body = h("tbody", {});
  const empty = h("p", { class: "an-empty", text: "Tidak ada buyer yang cocok." });

  function draw() {
    const list = all.filter(
      (row) =>
        (countrySel.value === "all" || row.country === countrySel.value) &&
        (prioritySel.value === "all" || row.priority === prioritySel.value),
    );
    empty.hidden = list.length > 0;
    body.replaceChildren(
      ...list.map((row) => {
        const status = h(
          "select",
          { class: "admin-select an-status" },
          ...STATUSES.map((name) => h("option", { value: name, text: name })),
        );
        status.value = row.followUp;
        status.addEventListener("change", () => {
          if (data.onFollowUp) data.onFollowUp(row.uid, status.value);
        });
        return h(
          "tr",
          {},
          h(
            "td",
            {},
            h("div", { class: "admin-name", text: row.name || "-" }),
            h("div", { class: "admin-sub", text: row.company || row.email }),
          ),
          h("td", { text: countryName(row.country) }),
          h(
            "td",
            {},
            h("span", { class: "an-pill an-pill--" + row.priority, text: PRIORITY_LABEL[row.priority] }),
          ),
          h("td", { text: row.views + " dilihat, " + row.clicks + " klik WA" }),
          h("td", { text: row.topProducts.join(", ") || "-" }),
          h("td", { text: row.lastActive ? new Date(row.lastActive).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-" }),
          h("td", {}, status),
          h("td", {}, contactLinks(row)),
        );
      }),
    );
  }

  countrySel.addEventListener("change", draw);
  prioritySel.addEventListener("change", draw);
  draw();

  return h(
    "section",
    { class: "an-card" },
    h("h3", { text: "Daftar follow-up buyer" }),
    h(
      "p",
      { class: "an-legend" },
      "Panas: klik WhatsApp atau melihat 3 produk berbeda atau lebih. Hangat: melihat 1 sampai 2 produk. Dingin: login tanpa melihat produk pada periode ini.",
    ),
    h("div", { class: "admin-toolbar" }, countrySel, prioritySel),
    h(
      "div",
      { class: "admin-table-wrap an-wrap" },
      h(
        "table",
        { class: "admin-table" },
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            h("th", { text: "Buyer" }),
            h("th", { text: "Negara" }),
            h("th", { text: "Prioritas" }),
            h("th", { text: "Aktivitas" }),
            h("th", { text: "Produk yang dilihat" }),
            h("th", { text: "Terakhir aktif" }),
            h("th", { text: "Status" }),
            h("th", { text: "" }),
          ),
        ),
        body,
      ),
      empty,
    ),
  );
}

function loginSeries(logins, days, now) {
  const weekly = days > 30;
  const size = weekly ? 7 : 1;
  const bins = Math.ceil(days / size);
  const end = dayStart(now) + DAY;
  const points = [];
  for (let i = bins - 1; i >= 0; i -= 1) {
    const to = end - i * size * DAY;
    const from = to - size * DAY;
    const date = new Date(from);
    points.push({
      from,
      to,
      value: 0,
      label: date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
    });
  }
  logins.forEach((item) => {
    const time = millis(item.at);
    const hit = points.find((point) => time >= point.from && time < point.to);
    if (hit) hit.value += 1;
  });
  return points;
}

export function renderAnalytics(target, data) {
  const now = Date.now();
  const days = data.days;
  const cutoff = now - days * DAY;

  const events = (data.events || []).filter(
    (item) => millis(item.at) >= cutoff && !isAdminEmail(item.email),
  );
  const logins = (data.logins || []).filter(
    (item) => millis(item.at) >= cutoff && !isAdminEmail(item.email),
  );
  const buyers = (data.buyers || []).filter((item) => !isAdminEmail(item.email));
  const newBuyers = buyers.filter((item) => millis(item.firstLogin) >= cutoff);

  const views = events.filter((item) => item.type === "product_view");
  const clicks = events.filter((item) => item.type === "whatsapp_click");
  const active = new Set([
    ...logins.map((item) => item.uid),
    ...events.map((item) => item.uid),
  ]);

  const topViews = count(
    views,
    (item) => item.productId || item.name,
    (item) => item.name || item.productId,
  ).slice(0, 10);
  const topClicks = count(
    clicks.filter((item) => item.productId || item.name),
    (item) => item.productId || item.name,
    (item) => item.name || item.productId,
  ).slice(0, 10);
  const byCategory = count(
    views,
    (item) => item.category,
    (item) => CATEGORY_LABELS[item.category] || item.category,
  );
  const topBuyers = buyers
    .slice()
    .sort((a, b) => (b.loginCount || 0) - (a.loginCount || 0))
    .slice(0, 8);

  const nodes = [];

  if (data.eventsError) {
    nodes.push(
      h("p", {
        class: "an-note",
        text:
          "Data aktivitas produk belum bisa dibaca. Publish aturan Firestore terbaru (koleksi events) di Firebase, lalu klik Muat Ulang Data.",
      }),
    );
  }

  nodes.push(
    h(
      "div",
      { class: "an-kpis" },
      kpi(logins.length, "Login"),
      kpi(active.size, "Buyer aktif"),
      kpi(newBuyers.length, "Buyer baru"),
      kpi(views.length, "Produk dilihat"),
      kpi(clicks.length, "Klik WhatsApp"),
    ),
  );

  const insights = [];
  if (topViews.length) {
    insights.push(
      "Produk paling sering dilihat: " +
        topViews[0].label +
        " (" +
        topViews[0].total +
        " kali).",
    );
  }
  if (byCategory.length) {
    insights.push("Kategori terpopuler: " + byCategory[0].label + ".");
  }
  if (views.length && clicks.length) {
    insights.push(
      "Rasio klik WhatsApp terhadap produk dilihat: " +
        Math.round((clicks.length / views.length) * 100) +
        "%.",
    );
  }
  if (!views.length) {
    insights.push(
      "Belum ada data produk dilihat. Data mulai terkumpul setelah buyer login dan membuka produk.",
    );
  }
  nodes.push(h("p", { class: "an-insight", text: insights.join(" ") }));

  nodes.push(
    card(
      days > 30 ? "Login per minggu" : "Login per hari",
      barsVertical(loginSeries(logins, days, now)),
    ),
  );

  nodes.push(marketCard(data));
  nodes.push(followUpCard(data));

  nodes.push(
    h(
      "div",
      { class: "an-grid" },
      card(
        "Produk paling sering dilihat",
        barsHorizontal(topViews, "Belum ada data."),
      ),
      card(
        "Produk dengan klik WhatsApp terbanyak",
        barsHorizontal(topClicks, "Belum ada data."),
      ),
      card(
        "Produk dilihat per kategori",
        barsHorizontal(byCategory, "Belum ada data."),
      ),
      card(
        "Buyer paling aktif (jumlah login)",
        topBuyers.length
          ? h(
              "table",
              { class: "admin-table an-table" },
              h(
                "tbody",
                {},
                ...topBuyers.map((item) =>
                  h(
                    "tr",
                    {},
                    h("td", {}, h("div", { class: "admin-name", text: item.name || "-" }), h("div", { class: "admin-sub", text: item.email || "" })),
                    h("td", { text: String(item.loginCount || 0) + "x" }),
                  ),
                ),
              ),
            )
          : h("p", { class: "an-empty", text: "Belum ada buyer." }),
      ),
    ),
  );

  target.replaceChildren(...nodes);
}

export function exportEvents(events) {
  const rows = [["Waktu", "Email", "Jenis", "Produk", "Kategori", "Halaman"]];
  events.forEach((item) => {
    const time = millis(item.at);
    rows.push([
      time ? new Date(time).toISOString() : "",
      item.email || "",
      item.type === "whatsapp_click" ? "Klik WhatsApp" : "Produk dilihat",
      item.name || "",
      item.category || "",
      item.page || "",
    ]);
  });
  const csv = rows
    .map((row) =>
      row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(","),
    )
    .join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }),
  );
  link.download = "aktivitas-buyer.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function exportFollowUp(rows) {
  const head = ["Nama", "Email", "Perusahaan", "Negara", "Telepon", "Prioritas", "Dilihat", "Klik WhatsApp", "Produk yang dilihat", "Terakhir aktif", "Status"];
  const body = rows.map((row) => [
    row.name,
    row.email,
    row.company,
    countryName(row.country),
    row.phone,
    PRIORITY_LABEL[row.priority],
    row.views,
    row.clicks,
    row.topProducts.join("; "),
    row.lastActive ? new Date(row.lastActive).toISOString() : "",
    row.followUp,
  ]);
  const csv = [head, ...body]
    .map((line) =>
      line.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(","),
    )
    .join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
  );
  link.download = "followup-buyer.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
