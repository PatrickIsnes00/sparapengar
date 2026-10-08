/* ==========================================================================
   SparaPengar — Hitta dina besparingar (budgetverktyg)
   ========================================================================== */
(function () {
  "use strict";

  const EXPENSE_CONFIG = [
    { key: "boende", label: "Boende / hyra", group: "fixed", current: 8000, saving: 0 },
    { key: "el", label: "El & uppvärmning", group: "fixed", current: 800, saving: 0 },
    { key: "forsakring", label: "Försäkringar", group: "fixed", current: 400, saving: 0 },
    { key: "telefon", label: "Telefon & internet", group: "fixed", current: 500, saving: 0 },
    { key: "abonnemang", label: "Abonnemang (Netflix, Spotify m.m.)", group: "fixed", current: 300, saving: 100 },
    { key: "lan", label: "Lån & krediter", group: "fixed", current: 0, saving: 0 },
    { key: "mat", label: "Mat (livsmedel)", group: "variable", current: 4000, saving: 200 },
    { key: "drivmedel", label: "Drivmedel / kollektivtrafik", group: "variable", current: 1200, saving: 0 },
    { key: "utemat", label: "Utemat & fika", group: "variable", current: 1500, saving: 500 },
    { key: "nojen", label: "Nöje & prenumerationer", group: "variable", current: 400, saving: 0 },
    { key: "klader", label: "Kläder", group: "variable", current: 500, saving: 100 },
    { key: "ovrigt", label: "Övrigt", group: "variable", current: 500, saving: 0 },
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
