/* ==========================================================================
   SparaPengar — Skuld- & amorteringskalkylatorn
   ========================================================================== */
(function () {
  "use strict";

  function syncPair(numEl, rangeEl, onChange) {
    function fromNum() { rangeEl.value = numEl.value; onChange(); }
    function fromRange() { numEl.value = rangeEl.value; onChange(); }
    numEl.addEventListener("input", fromNum);
    rangeEl.addEventListener("input", fromRange);
  }

  function formatManader(m) {
    if (m === null || m === undefined) return "–";
    const ar = Math.floor(m / 12), rest = m % 12;
    if (ar === 0) return rest + " mån";
    return ar + " år" + (rest > 0 ? " " + rest + " mån" : "");
  }

  function padTo(values, length) {
    const out = values.slice();
    while (out.length < length) out.push(0);
    return out.slice(0, length);
  }

  document.addEventListener("DOMContentLoaded", function () {
    const els = {
      skuld: document.getElementById("skuld"), skuldR: document.getElementById("skuld-r"),
      ranta: document.getElementById("ranta"), rantaR: document.getElementById("ranta-r"),
      betalning: document.getElementById("betalning"), betalningR: document.getElementById("betalning-r"),
      extra: document.getElementById("extra"), extraR: document.getElementById("extra-r"),
    };
    const vals = {
      skuld: document.getElementById("val-skuld"),
      ranta: document.getElementById("val-ranta"),
      betalning: document.getElementById("val-betalning"),
      extra: document.getElementById("val-extra"),
    };
    const canvas = document.getElementById("skuld-chart");
    const legendEl = document.getElementById("skuld-legend");
    const warningArea = document.getElementById("warning-area");
    const compareArea = document.getElementById("compare-area");

    function render() {
      const skuld = Math.max(0, parseFloat(els.skuld.value) || 0);
      const ranta = parseFloat(els.ranta.value) || 0;
      const betalning = Math.max(0, parseFloat(els.betalning.value) || 0);
      const extra = Math.max(0, parseFloat(els.extra.value) || 0);

      vals.skuld.textContent = formatKr(skuld);
      vals.ranta.textContent = ranta.toLocaleString("sv-SE") + " %";
      vals.betalning.textContent = formatKr(betalning);
      vals.extra.textContent = formatKr(extra);

      const base = simuleraSkuldAvbetalning({ skuld: skuld, ranta: ranta, betalning: betalning });

      if (base.omojligt) {
        const minRequired = Math.ceil((skuld * (ranta / 100 / 12)) / 10) * 10;
        document.getElementById("stat-tid").textContent = "–";
        document.getElementById("stat-ranta").textContent = "–";
        document.getElementById("stat-totalt").textContent = "–";
        warningArea.innerHTML = '<div class="warning-box">⚠️ Din betalning täcker inte ens räntan — skulden kommer aldrig minska. Höj den månatliga betalningen till minst <strong>' + formatKr(minRequired) + "</strong> för att den ska börja gå ner.</div>";
        compareArea.innerHTML = "";

        const flatMonths = 12;
        SPCharts.renderLineChart(canvas, {
          xLabels: Array.from({ length: flatMonths + 1 }, function (_, i) { return "M" + i; }),
          series: [{ label: "Kvarvarande skuld", color: "--series-8", values: new Array(flatMonths + 1).fill(skuld) }],
          legendEl: legendEl,
          formatValue: formatKrKompakt,
        });
        return;
      }

      warningArea.innerHTML = "";
      document.getElementById("stat-tid").textContent = formatManader(base.manader);
      document.getElementById("stat-ranta").textContent = formatKr(base.totalRanta);
      document.getElementById("stat-totalt").textContent = formatKr(base.totalBetalt);

      let improved = null;
      if (extra > 0) {
        improved = simuleraSkuldAvbetalning({ skuld: skuld, ranta: ranta, betalning: betalning + extra });
      }

      if (improved && !improved.omojligt) {
        const diffManader = base.manader - improved.manader;
        const diffRanta = base.totalRanta - improved.totalRanta;
        compareArea.innerHTML =
          '<div class="compare-callout">' +
            '<div class="compare-col base"><div class="ccl-label">Nuvarande plan</div><div class="ccl-value">' + formatManader(base.manader) + '</div><div class="hint">' + formatKr(base.totalRanta) + " i ränta</div></div>" +
            '<div class="compare-col improved"><div class="ccl-label">Med ' + formatKr(extra) + "/mån extra</div><div class=\"ccl-value\">" + formatManader(improved.manader) + '</div><div class="hint">' + formatKr(improved.totalRanta) + " i ränta</div></div>" +
          "</div>" +
          '<p style="font-weight:600;color:var(--text-primary);">Betala ' + formatKr(extra) + "/månad mer → skuldfri " + diffManader + " månader tidigare och " + formatKr(diffRanta) + " mindre i ränta.</p>";
      } else {
        compareArea.innerHTML = "";
      }

      const horizon = improved ? Math.max(base.manader, improved.manader) : base.manader;
      const baseValues = padTo(base.rows.map(function (r) { return r.kvar; }), horizon + 1);
      const xLabels = baseValues.map(function (_, i) { return "M" + i; });

      const series = [{ label: "Nuvarande plan", color: "--series-1", values: baseValues }];
      if (improved) {
        series.push({ label: "Med extra betalning", color: "--series-3", values: padTo(improved.rows.map(function (r) { return r.kvar; }), horizon + 1) });
      }

      SPCharts.renderLineChart(canvas, {
        xLabels: xLabels,
        series: series,
        legendEl: legendEl,
        formatValue: formatKrKompakt,
        xTickEvery: Math.max(1, Math.ceil(horizon / 8)),
      });
    }

    [["skuld", "skuldR"], ["ranta", "rantaR"], ["betalning", "betalningR"], ["extra", "extraR"]]
      .forEach(function (pair) { syncPair(els[pair[0]], els[pair[1]], render); });

    render();
  });
})();
