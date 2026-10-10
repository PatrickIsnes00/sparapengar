/* ==========================================================================
   SparaPengar — Hitta dina besparingar (budgetverktyg)
   ========================================================================== */
(function () {
  "use strict";

  // andel = tumregel för hur stor del av posten som ofta går att dra ner på (används bara när
  // användaren ber om förslag). tips = konkret råd som visas bredvid förslaget.
  const EXPENSE_CONFIG = [
    { key: "boende", label: "Boende / hyra", group: "fixed", current: 8000, saving: 0, andel: 0 },
    { key: "el", label: "El & uppvärmning", group: "fixed", current: 800, saving: 0, andel: 0.1, tips: "Jämför elavtal en gång per år och sänk inomhustemperaturen en grad." },
    { key: "forsakring", label: "Försäkringar", group: "fixed", current: 400, saving: 0, andel: 0.1, tips: "Jämför försäkringar och samla dem hos ett bolag — det ger ofta rabatt." },
    { key: "telefon", label: "Telefon & internet", group: "fixed", current: 500, saving: 0, andel: 0.25, tips: "Jämför operatörer och välj en mindre surfmängd om du sällan använder hela." },
    { key: "abonnemang", label: "Abonnemang (Netflix, Spotify m.m.)", group: "fixed", current: 300, saving: 100, andel: 0.4, tips: "Rotera streamingtjänster — ha en åt gången i stället för alla samtidigt." },
    { key: "lan", label: "Lån & krediter", group: "fixed", current: 0, saving: 0, andel: 0, tips: 'Se om du kan betala av dyra lån snabbare i <a href="skuldkalkylator.html#privatlan">skuldkalkylatorn</a>.' },
    { key: "mat", label: "Mat (livsmedel)", group: "variable", current: 4000, saving: 200, andel: 0.1, tips: "Planera en veckomeny och handla en gång i veckan med inköpslista." },
    { key: "drivmedel", label: "Drivmedel / kollektivtrafik", group: "variable", current: 1200, saving: 0, andel: 0.1, tips: "Samåk, cykla korta sträckor eller se om ett periodkort lönar sig." },
    { key: "utemat", label: "Utemat & fika", group: "variable", current: 1500, saving: 500, andel: 0.4, tips: "Ta med matlåda tre dagar i veckan och kaffe i termos." },
    { key: "nojen", label: "Nöje & prenumerationer", group: "variable", current: 400, saving: 0, andel: 0.25, tips: "Säg upp det du inte har använt den senaste månaden." },
    { key: "klader", label: "Kläder", group: "variable", current: 500, saving: 100, andel: 0.25, tips: "Prova 30 dagars köp-paus och kolla second hand först." },
    { key: "ovrigt", label: "Övrigt", group: "variable", current: 500, saving: 0, andel: 0.2, tips: "Gå igenom senaste kontoutdraget — här gömmer sig ofta impulsköpen." },
  ];

  function rowHtml(item) {
    return (
      '<div class="expense-row" data-key="' + item.key + '">' +
      '<span class="exp-label">' + item.label + "</span>" +
      '<input type="number" min="0" step="50" id="cur-' + item.key + '" value="' + item.current + '" aria-label="Nuvarande kostnad för ' + item.label + '">' +
      '<input type="number" min="0" step="50" id="sav-' + item.key + '" value="' + item.saving + '" aria-label="Möjlig besparing för ' + item.label + '">' +
      "</div>"
    );
  }

  document.addEventListener("DOMContentLoaded", function () {
    const fixedEl = document.getElementById("fixed-expenses");
    const variableEl = document.getElementById("variable-expenses");
    fixedEl.innerHTML = EXPENSE_CONFIG.filter(function (i) { return i.group === "fixed"; }).map(rowHtml).join("");
    variableEl.innerHTML = EXPENSE_CONFIG.filter(function (i) { return i.group === "variable"; }).map(rowHtml).join("");

    const rateSelect = document.getElementById("rate-select");
    const customField = document.getElementById("custom-rate-field");
    const customRate = document.getElementById("custom-rate");
    const valCustomRate = document.getElementById("val-custom-rate");

    function currentRate() {
      if (rateSelect.value === "custom") return parseFloat(customRate.value) || 0;
      return parseFloat(rateSelect.value);
    }

    function render() {
      let totalCurrent = 0, totalSaving = 0;
      const categories = [], currents = [], savings = [];

      EXPENSE_CONFIG.forEach(function (item) {
        const cur = parseFloat(document.getElementById("cur-" + item.key).value) || 0;
        const sav = parseFloat(document.getElementById("sav-" + item.key).value) || 0;
        totalCurrent += cur;
        totalSaving += sav;
        if (cur > 0 || sav > 0) {
          categories.push(item.label);
          currents.push(cur);
          savings.push(sav);
        }
      });

      document.getElementById("total-current").textContent = formatKr(totalCurrent) + "/mån";
      document.getElementById("total-saving").textContent = formatKr(totalSaving) + "/mån";

      SPCharts.renderGroupedBarChart(document.getElementById("expense-chart"), {
        categories: categories,
        series: [
          { label: "Nuvarande kostnad/mån", color: "--series-1", values: currents },
          { label: "Möjlig besparing/mån", color: "--series-3", values: savings },
        ],
        legendEl: document.getElementById("expense-legend"),
        formatValue: formatKrKompakt,
      });

      const rate = currentRate();
      const horizons = [1, 2, 5, 10, 20];
      const maxAr = Math.max.apply(null, horizons);
      const rows = simuleraSparande({ startkapital: 0, manadssparande: totalSaving, ranta: rate, ar: maxAr });
      const byAr = {};
      rows.forEach(function (r) { byAr[r.ar] = r; });
      const values = horizons.map(function (h) { return byAr[h] ? byAr[h].varde : 0; });
      const labels = horizons.map(function (h) { return h + " år"; });

      SPCharts.renderBarChart(document.getElementById("projection-chart"), {
        labels: labels,
        values: values,
        color: "--series-3",
        formatValue: formatKrKompakt,
      });

      const tioAr = byAr[10] ? byAr[10].varde : 0;
      const sentenceEl = document.getElementById("projection-sentence");
      if (totalSaving <= 0) {
        sentenceEl.textContent = "Fyll i en möjlig besparing ovan för att se vad den kan bli värd över tid.";
      } else {
        sentenceEl.innerHTML = "Om du sparar <strong>" + formatKr(totalSaving) + "/månad</strong> till " + rate + "%/år, kan det bli <strong>" + formatKr(tioAr) + "</strong> om 10 år.";
      }
    }

    document.querySelectorAll("#fixed-expenses input, #variable-expenses input").forEach(function (inp) {
      inp.addEventListener("input", render);
    });

    /* ---------- Förslag på besparingar (bara när användaren ber om det) ---------- */
    // Besparingar som användaren själv har skrivit in skrivs aldrig över av förslagen
    const egnaBesparingar = {};
    document.querySelectorAll("#fixed-expenses input[id^='sav-'], #variable-expenses input[id^='sav-']").forEach(function (inp) {
      inp.addEventListener("input", function () {
        const row = inp.closest(".expense-row");
        egnaBesparingar[row.getAttribute("data-key")] = true;
        row.classList.remove("suggested");
      });
    });

    const suggestList = document.getElementById("suggest-list");
    document.getElementById("suggest-btn").addEventListener("click", function () {
      const forslag = [], radTips = [];
      let hoppadeOver = 0;

      EXPENSE_CONFIG.forEach(function (item) {
        const cur = parseFloat(document.getElementById("cur-" + item.key).value) || 0;
        if (cur <= 0 || !item.tips) return;
        if (!item.andel) { radTips.push(item); return; }
        if (egnaBesparingar[item.key]) { hoppadeOver++; return; }
        const belopp = Math.round(cur * item.andel / 50) * 50;
        if (belopp <= 0) return;
        document.getElementById("sav-" + item.key).value = belopp;
        document.querySelector('.expense-row[data-key="' + item.key + '"]').classList.add("suggested");
        forslag.push({ item: item, belopp: belopp });
      });

      forslag.sort(function (a, b) { return b.belopp - a.belopp; });
      let html = forslag.map(function (f, i) {
        return '<li' + (i === 0 ? ' class="top"' : "") + "><strong>" + f.item.label + ": ca " + formatKr(f.belopp) + "/mån</strong>" +
          (i === 0 ? ' <span class="suggest-badge">Börja här</span>' : "") + "<br>" + f.item.tips + "</li>";
      }).join("") + radTips.map(function (item) {
        return "<li><strong>" + item.label + "</strong><br>" + item.tips + "</li>";
      }).join("");

      if (!html) html = "<li>Fyll i vad du lägger på varje post under \"Nuvarande\" först, så kan vi föreslå var du kan spara.</li>";
      suggestList.innerHTML = html;
      suggestList.hidden = false;
      document.getElementById("suggest-note").textContent =
        "Förslagen är tumregler, inte en analys av just din ekonomi — justera siffrorna så de passar dig." +
        (hoppadeOver > 0 ? " Poster där du själv fyllt i en besparing har vi inte ändrat." : "");
      render();
    });

    rateSelect.addEventListener("change", function () {
      customField.style.display = rateSelect.value === "custom" ? "" : "none";
      render();
    });
    customRate.addEventListener("input", function () {
      valCustomRate.textContent = (parseFloat(customRate.value) || 0) + " %";
      render();
    });

    render();
  });
})();
