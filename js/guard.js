(function () {
  var PROTECTED_PAGES = [
    "gallery-furniture",
    "gallery-homedecor",
    "gallery-kitchenware",
    "kursi",
    "kursibar",
    "lounge",
    "mejangopi",
    "partition",
    "plate",
    "product-cutting-board",
    "spatula",
    "teakcandleholder",
    "teakdecorativebowl",
    "teakfloatingshelf",
    "teakmirrors",
    "teakphotoframe",
    "teakvase",
    "teakwallclock",
    "teakwallpanel",
    "teakwindowframe",
    "tray",
  ];

  var root = document.documentElement;
  var file =
    location.pathname.split("/").pop().replace(/\.html$/, "") || "index";

  var style = document.createElement("style");
  style.textContent = "html.auth-pending body{visibility:hidden}";
  document.head.appendChild(style);

  var link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "css/auth.css";
  document.head.appendChild(link);

  if (PROTECTED_PAGES.indexOf(file) === -1) return;

  root.setAttribute("data-jee-protected", "1");
  root.classList.add("auth-pending");

  setTimeout(function () {
    if (!root.classList.contains("auth-pending")) return;
    root.classList.remove("auth-pending");
    document.body.innerHTML =
      '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-family:sans-serif;text-align:center;padding:24px">' +
      "<p>The login service could not be reached. Please check your connection.</p>" +
      '<a href="" style="padding:10px 24px;border-radius:999px;background:#007d63;color:#fff;text-decoration:none">Reload</a>' +
      "</div>";
  }, 10000);
})();
