/* ==========================================================================
   Guldgrisen — Ränta på ränta-kalkylatorn
   ========================================================================== */
(function () {
  "use strict";

  function syncPair(numEl, rangeEl, onChange) {
    function fromNum() {
      rangeEl.value = numEl.value;
      onChange(parseFloat(numEl.value) || 0);
    }
    function fromRange() {
      numEl.value = rangeEl.value;
      onChange(parseFloat(rangeEl.value) || 0);
    }
    numEl.addEventListener("input", fromNum);
    rangeEl.addEventListener("input", fromRange);
  }

  document.addEventListener("DOMContentLoaded", function () {
    const els = {
      startkapital: document.getElementById("startkapital"),
      startkapitalR: document.getElementById("startkapital-r"),
      manadssparande: document.getElementById("manadssparande"),
      manadssparandeR: document.getElementById("manadssparande-r"),
      ranta: document.getElementById("ranta"),
      rantaR: document.getElementById("ranta-r"),
      ar: document.getElementById("ar"),
      arR: document.getElementById("ar-r"),
      okningToggle: document.getElementById("okning-toggle"),
      okningField: document.getElementById("okning-field"),
      okning: document.getElementById("okning"),
      okningR: document.getElementById("okning-r"),
    };

    const valLabels = {
      startkapital: document.getElementById("val-startkapital"),
      manadssparande: document.getElementById("val-manadssparande"),
      ranta: document.getElementById("val-ranta"),
      ar: document.getElementById("val-ar"),
      okning: document.getElementById("val-okning"),
    };

    const legendEl = document.getElementById("chart-legend");
    const canvas = document.getElementById("chart");
    const tableBody = document.getElementById("table-body");
    const tableWrap = document.getElementById("table-wrap");
    const toggleTableBtn = document.getElementById("toggle-table");

    function state() {
      return {
        startkapital: parseFloat(els.startkapital.value) || 0,
        manadssparande: parseFloat(els.manadssparande.value) || 0,
        ranta: parseFloat(els.ranta.value) || 0,
        ar: parseInt(els.ar.value, 10) || 1,
        okningPerAr: els.okningToggle.checked ? (parseFloat(els.okning.value) || 0) : 0,
      };
    }

    function render() {
      const p = state();
      valLabels.startkapital.textContent = formatKr(p.startkapital);
      valLabels.manadssparande.textContent = formatKr(p.manadssparande);
      valLabels.ranta.textContent = p.ranta.toLocaleString("sv-SE") + " %";
      valLabels.ar.textContent = p.ar + " år";
      valLabels.okning.textContent = p.okningPerAr.toLocaleString("sv-SE") + " %";

      const rows = simuleraSparande(p);
      const last = rows[rows.length - 1];

      document.getElementById("stat-slutvarde").textContent = formatKr(last.varde);
      document.getElementById("stat-insatt").textContent = formatKr(last.insatt);
      document.getElementById("stat-avkastning").textContent = formatKr(last.ranta);
      const andel = last.varde > 0 ? Math.round((last.ranta / last.varde) * 100) : 0;
      document.getElementById("stat-andel").textContent = andel + "% av slutvärdet";

      const xLabels = rows.map(function (r) { return "År " + r.ar; });
      SPCharts.renderAreaChart(canvas, {
        xLabels: xLabels,
        series: [
          { label: "Insatt kapital", color: "--series-1", values: rows.map(function (r) { return r.insatt; }) },
          { label: "Avkastning", color: "--series-3", values: rows.map(function (r) { return r.ranta; }) },
        ],
        stacked: true,
        legendEl: legendEl,
        formatValue: formatKrKompakt,
      });

      tableBody.innerHTML = rows.filter(function (r) { return r.ar > 0; }).map(function (r) {
        return "<tr><td>" + r.ar + "</td><td>" + formatKr(r.insatt) + "</td><td>" + formatKr(r.ranta) + "</td><td>" + formatKr(r.varde) + "</td></tr>";
      }).join("");
    }

    syncPair(els.startkapital, els.startkapitalR, render);
    syncPair(els.manadssparande, els.manadssparandeR, render);
    syncPair(els.ranta, els.rantaR, render);
    syncPair(els.ar, els.arR, render);
    syncPair(els.okning, els.okningR, render);

    els.okningToggle.addEventListener("change", function () {
      els.okningField.style.display = els.okningToggle.checked ? "" : "none";
      render();
    });

    toggleTableBtn.addEventListener("click", function () {
      const visible = tableWrap.classList.toggle("visible");
      toggleTableBtn.textContent = visible ? "Dölj tabell ↑" : "Visa som tabell ↓";
    });

    render();
  });
})();
