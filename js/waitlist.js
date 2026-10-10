/* ==========================================================================
   Guldgrisen — Intresselista för "Mitt konto"
   Lägg <div data-waitlist="kompakt" data-kalla="skuld"></div> där formuläret ska synas.
   data-waitlist: "kompakt" (bara e-post) eller "full" (e-post + intressen + pris).
   data-kalla: varifrån anmälan kom — så vi ser vilka verktyg som driver intresset.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------- Konfiguration ----------------
     Formuläret skickas som vanlig form-data (POST) med Accept: application/json.
     Fungerar direkt med t.ex. Formspree ("https://formspree.io/f/xxxxxxx") eller Getform.
     Lämna tomt så länge listan inte är kopplad — då visas ett meddelande istället. */
  var WAITLIST_ENDPOINT = "";

  var LAGRAD_NYCKEL = "sp-waitlist";

  var INTRESSEN = [
    ["sparmal", "🎯 Sparmål med framsteg"],
    ["skuldplan", "💳 Min skuldfri-plan"],
    ["paminnelser", "🔔 Månadsavstämning & påminnelser"],
    ["samla-lan", "🧩 Samla lån till lägre ränta"],
  ];
  var PRISER = [["0", "Bara om det är gratis"], ["29", "29 kr/mån"], ["49", "49 kr/mån"], ["99", "99 kr/mån"]];

  function harAnmalt() {
    try { return localStorage.getItem(LAGRAD_NYCKEL) === "1"; } catch (e) { return false; }
  }
  function sparaAnmald() {
    try { localStorage.setItem(LAGRAD_NYCKEL, "1"); } catch (e) { /* no-op */ }
  }

  var KLAR_HTML = '<div class="waitlist-klar">✅ <strong>Du står på listan!</strong> Vi hör av oss när Mitt konto öppnar. Du får först tillgång och ett lanseringserbjudande.</div>';

  function formHtml(full, id) {
    var html = '<form class="waitlist-form" novalidate>' +
      '<div class="waitlist-rad">' +
        '<input type="email" name="email" required autocomplete="email" placeholder="din@epost.se" aria-label="E-postadress" id="' + id + '-email">' +
        '<button type="submit" class="btn btn-primary">Ställ mig i kön →</button>' +
      "</div>" +
      // Honungsfälla mot spambottar — osynlig för människor
      '<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" class="waitlist-honung" aria-hidden="true">';
    if (full) {
      html += '<fieldset class="waitlist-grupp"><legend>Vad vill du helst kunna göra? <span>(valfritt)</span></legend>' +
        INTRESSEN.map(function (i) {
          return '<label class="waitlist-val"><input type="checkbox" name="intressen" value="' + i[0] + '"> ' + i[1] + "</label>";
        }).join("") + "</fieldset>" +
        '<fieldset class="waitlist-grupp"><legend>Vad skulle du kunna tänka dig att betala? <span>(valfritt)</span></legend>' +
        PRISER.map(function (p) {
          return '<label class="waitlist-val"><input type="radio" name="pris" value="' + p[0] + '"> ' + p[1] + "</label>";
        }).join("") + "</fieldset>";
    }
    html += '<div class="waitlist-status" role="status" aria-live="polite"></div>' +
      '<p class="waitlist-villkor">Vi använder bara din e-post för att meddela när Mitt konto lanseras. Avregistrera dig när du vill. Läs mer i vår <a href="integritetspolicy.html">integritetspolicy</a>.</p>' +
      "</form>";
    return html;
  }

  function init(el, index) {
    var full = el.getAttribute("data-waitlist") === "full";
    var kalla = el.getAttribute("data-kalla") || "okand";
    if (harAnmalt()) { el.innerHTML = KLAR_HTML; return; }
    el.innerHTML = formHtml(full, "waitlist-" + index);

    var form = el.querySelector("form");
    var status = el.querySelector(".waitlist-status");
    var knapp = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = form.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        status.textContent = "Skriv in en giltig e-postadress.";
        status.className = "waitlist-status fel";
        form.email.focus();
        return;
      }
      if (!WAITLIST_ENDPOINT) {
        status.textContent = "Intresselistan är inte kopplad ännu. Försök igen snart.";
        status.className = "waitlist-status fel";
        return;
      }

      var data = new FormData(form);
      var intressen = data.getAll("intressen");
      data.delete("intressen");
      if (intressen.length) data.append("intressen", intressen.join(", "));
      data.append("kalla", kalla);
      data.append("sida", location.pathname.split("/").pop() || "index.html");

      knapp.disabled = true;
      status.textContent = "Skickar…";
      status.className = "waitlist-status";

      fetch(WAITLIST_ENDPOINT, { method: "POST", body: data, headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          sparaAnmald();
          el.innerHTML = KLAR_HTML;
        })
        .catch(function () {
          knapp.disabled = false;
          status.textContent = "Något gick fel. Kontrollera din uppkoppling och försök igen.";
          status.className = "waitlist-status fel";
        });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.forEach.call(document.querySelectorAll("[data-waitlist]"), init);
  });
})();
