/* ==========================================================================
   SparaPengar — delad header/footer-injektion, navigation, tema, dropdown
   Varje sida behöver bara: <div id="site-header"></div> direkt efter <body>
   (med detta script-tag direkt efter), och <div id="site-footer"></div>
   längre ner där footern ska ligga.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------- Tema (ljust/mörkt), läses av innan header målas ---------------- */
  var root = document.documentElement;
  var saved = localStorage.getItem("sp-theme");
  if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);

  function currentIsDark() {
    var attr = root.getAttribute("data-theme");
    if (attr === "dark") return true;
    if (attr === "light") return false;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  /* ---------------- Header-mall ---------------- */
  var HEADER_HTML =
    '<header class="site-header"><div class="wrap">' +
    '<a href="index.html" class="brand"><span class="logo-mark">💰</span> SparaPengar</a>' +
    '<nav class="main-nav">' +
      '<a href="index.html" data-nav="index.html">Hem</a>' +
      '<div class="nav-dropdown">' +
        '<button type="button" class="nav-dropdown-toggle" aria-haspopup="true" aria-expanded="false">Ekonomiska verktyg <span class="caret">▾</span></button>' +
        '<div class="nav-dropdown-menu">' +
          '<a href="ranta-pa-ranta.html" data-nav="ranta-pa-ranta.html">📈 Ränta på ränta</a>' +
          '<a href="hushallsbudget.html" data-nav="hushallsbudget.html">📋 Hushållsbudget</a>' +
          '<a href="budget.html" data-nav="budget.html">🧾 Spara på utgifter</a>' +
          '<a href="buffertkalkylator.html" data-nav="buffertkalkylator.html">🛡️ Buffertkalkylator</a>' +
          '<a href="skuldkalkylator.html" data-nav="skuldkalkylator.html">💳 Skuld &amp; amortering</a>' +
          '<a href="nettolon-kalkylator.html" data-nav="nettolon-kalkylator.html">🧮 Nettolön</a>' +
        "</div>" +
      "</div>" +
      '<a href="barn.html" data-nav="barn.html">Barn &amp; Pengar</a>' +
      '<a href="guider.html" data-nav="guider.html">Guider</a>' +
      '<a href="partners.html" data-nav="partners.html">Partners <span class="soon-badge">Snart</span></a>' +
    "</nav>" +
    '<div class="header-actions">' +
      '<button class="theme-toggle" aria-label="Byt tema">' + (currentIsDark() ? "☀️" : "🌙") + "</button>" +
      '<button class="nav-toggle" aria-label="Öppna meny" aria-expanded="false"><span></span><span></span><span></span></button>' +
    "</div>" +
    "</div></header>";

  /* ---------------- Footer-mall ---------------- */
  var FOOTER_HTML =
    '<footer class="site-footer"><div class="wrap">' +
    '<div class="footer-grid">' +
      '<div><div class="brand" style="margin-bottom:10px;"><span class="logo-mark">💰</span> SparaPengar</div>' +
      "<p>SparaPengar hjälper dig ta kontroll över din ekonomi – räkna på sparande, hitta onödiga utgifter och lär barnen värdet av pengar.</p></div>" +
      "<div><h4>Ekonomiska verktyg</h4><ul>" +
        '<li><a href="ranta-pa-ranta.html">Ränta på ränta</a></li>' +
        '<li><a href="hushallsbudget.html">Hushållsbudget</a></li>' +
        '<li><a href="budget.html">Spara på utgifter</a></li>' +
        '<li><a href="buffertkalkylator.html">Buffertkalkylator</a></li>' +
        '<li><a href="skuldkalkylator.html">Skuld &amp; amortering</a></li>' +
        '<li><a href="nettolon-kalkylator.html">Nettolön</a></li>' +
      "</ul></div>" +
      "<div><h4>Mer</h4><ul>" +
        '<li><a href="barn.html">Barn &amp; Pengar</a></li>' +
        '<li><a href="guider.html">Guider</a></li>' +
        '<li><a href="partners.html">Partners</a></li>' +
      "</ul></div>" +
      "<div><h4>Om</h4><ul>" +
        '<li><a href="om-oss.html">Om oss</a></li>' +
        '<li><a href="integritetspolicy.html">Integritetspolicy</a></li>' +
        '<li><a href="kontakt.html">Kontakt</a></li>' +
      "</ul></div>" +
    "</div>" +
    '<div class="footer-bottom">' +
      "<span>© 2026 SparaPengar. Allt innehåll är generell information, inte individuell finansiell rådgivning.</span>" +
      "<span>Byggd med 💙 för ett tryggare sparande.</span>" +
    "</div>" +
    "</div></footer>";

  /* ---------------- Injicera header direkt (innan resten av body ritas) ---------------- */
  var headerPlaceholder = document.getElementById("site-header");
  if (headerPlaceholder) headerPlaceholder.outerHTML = HEADER_HTML;

  function updateThemeToggleIcon(btn) {
    if (!btn) return;
    btn.textContent = currentIsDark() ? "☀️" : "🌙";
    btn.setAttribute("aria-label", currentIsDark() ? "Byt till ljust tema" : "Byt till mörkt tema");
  }

  function markActiveLinks() {
    var path = (location.pathname.split("/").pop() || "index.html");
    var dropdownToggle = document.querySelector(".nav-dropdown-toggle");
    var anyChildActive = false;
    document.querySelectorAll(".main-nav a[data-nav]").forEach(function (a) {
      var isActive = a.getAttribute("data-nav") === path;
      a.classList.toggle("active", isActive);
      if (isActive && a.closest(".nav-dropdown-menu")) anyChildActive = true;
    });
    if (dropdownToggle) dropdownToggle.classList.toggle("active", anyChildActive);
  }

  function wireDropdown() {
    var dropdown = document.querySelector(".nav-dropdown");
    var toggle = document.querySelector(".nav-dropdown-toggle");
    if (!dropdown || !toggle) return;
    function close() {
      dropdown.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = dropdown.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", function (e) {
      if (!dropdown.contains(e.target)) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  function wireMobileMenu() {
    var navToggle = document.querySelector(".nav-toggle");
    var mainNav = document.querySelector(".main-nav");
    if (!navToggle || !mainNav) return;
    navToggle.addEventListener("click", function () {
      var open = mainNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
    });
  }

  function wireThemeToggle() {
    var btn = document.querySelector(".theme-toggle");
    updateThemeToggleIcon(btn);
    if (!btn) return;
    btn.addEventListener("click", function () {
      var next = currentIsDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("sp-theme", next);
      updateThemeToggleIcon(btn);
      document.dispatchEvent(new CustomEvent("sp-theme-changed"));
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var footerPlaceholder = document.getElementById("site-footer");
    if (footerPlaceholder) footerPlaceholder.outerHTML = FOOTER_HTML;

    wireThemeToggle();
    wireMobileMenu();
    wireDropdown();
    markActiveLinks();
  });
})();
