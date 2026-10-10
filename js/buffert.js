/* ==========================================================================
   Guldgrisen — Buffertkalkylatorn
   ========================================================================== */
(function () {
  "use strict";

  function syncPair(numEl, rangeEl, onChange) {
    function fromNum() { rangeEl.value = numEl.value; onChange(); }
    function fromRange() { numEl.value = rangeEl.value; onChange(); }
    numEl.addEventListener("input", fromNum);
    rangeEl.addEventListener("input", fromRange);
  }

  function monthlyBalances(start, monthlySaving, annualRatePct, horizonMonths) {
    const monthlyRate = Math.pow(1 + (annualRatePct || 0) / 100, 1 / 12) - 1;
    let v = start;
    const out = [v];
    for (let m = 1; m <= horizonMonths; m++) {
      v = v * (1 + monthlyRate) + monthlySaving;
      out.push(v);
    }
    return out;
  }

  document.addEventListener("DOMContentLoaded", function () {
    const els = {
      utgift: document.getElementById("manadsutgift"),
      utgiftR: document.getElementById("manadsutgift-r"),
      manader: document.getElementById("manader"),
      manaderR: document.getElementById("manader-r"),
      nuvarande: document.getElementById("nuvarande"),
      nuvarandeR: document.getElementById("nuvarande-r"),
      sparande: document.getElementById("sparande"),
      sparandeR: document.getElementById("sparande-r"),
      ranta: document.getElementById("ranta"),
      rantaR: document.getElementById("ranta-r"),
    };
    const vals = {
      utgift: document.getElementById("val-manadsutgift"),
      nuvarande: document.getElementById("val-nuvarande"),
      sparande: document.getElementById("val-sparande"),
      ranta: document.getElementById("val-ranta"),
    };
    const canvas = document.getElementById("buffert-chart");
    const fillEl = document.getElementById("buffert-fill");
    const resultEl = document.getElementById("buffert-result");
    const presetBtns = document.querySelectorAll(".preset-btn");

    function render() {
      const utgift = Math.max(0, parseFloat(els.utgift.value) || 0);
      const manader = Math.max(1, parseInt(els.manader.value, 10) || 1);
      const nuvarande = Math.max(0, parseFloat(els.nuvarande.value) || 0);
      const sparande = Math.max(0, parseFloat(els.sparande.value) || 0);
      const ranta = parseFloat(els.ranta.value) || 0;

      vals.utgift.textContent = formatKr(utgift);
      vals.nuvarande.textContent = formatKr(nuvarande);
      vals.sparande.textContent = formatKr(sparande);
      vals.ranta.textContent = ranta.toLocaleString("sv-SE") + " %";

      presetBtns.forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-months") === String(manader)); });

      const mal = utgift * manader;
      const kvar = Math.max(0, mal - nuvarande);
      document.getElementById("stat-mal").textContent = formatKr(mal);
      document.getElementById("stat-kvar").textContent = formatKr(kvar);

      const pct = mal > 0 ? Math.min(100, (nuvarande / mal) * 100) : 0;
      fillEl.style.width = pct + "%";

      const manaderTillMalSvar = manaderTillMal({ mal: mal, startkapital: nuvarande, manadssparande: sparande, ranta: ranta });
      const statTidEl = document.getElementById("stat-tid");
      if (nuvarande >= mal) {
        statTidEl.textContent = "Redan nått! 🎉";
        resultEl.innerHTML = "🎉 Grattis, du har redan sparat ihop din buffert på <strong>" + formatKr(mal) + "</strong>!";
      } else if (manaderTillMalSvar === null) {
        statTidEl.textContent = "–";
        resultEl.textContent = "Lägg in ett månatligt sparande för att se hur lång tid det tar.";
      } else {
        const ar = Math.floor(manaderTillMalSvar / 12);
        const resterandeManader = manaderTillMalSvar % 12;
        statTidEl.textContent = manaderTillMalSvar + " mån";
        let tidText = manaderTillMalSvar + " månader";
        if (ar > 0) tidText += " (ca " + ar + " år" + (resterandeManader > 0 ? " och " + resterandeManader + " mån" : "") + ")";
        resultEl.innerHTML = "Med ditt nuvarande sparande tar det <strong>" + tidText + "</strong> att nå din buffert på " + formatKr(mal) + ".";
      }

      const horizon = manaderTillMalSvar === null ? 24 : Math.max(manaderTillMalSvar + 3, 6);
      const balances = monthlyBalances(nuvarande, sparande, ranta, horizon);
      const xLabels = balances.map(function (_, i) { return "M" + i; });

      SPCharts.renderAreaChart(canvas, {
        xLabels: xLabels,
        series: [{ label: "Sparat", color: "--series-3", values: balances }],
        stacked: true,
        formatValue: formatKrKompakt,
        goalLine: { value: mal, label: "Mål: " + formatKr(mal) },
        xTickEvery: Math.max(1, Math.ceil(horizon / 8)),
      });
    }

    presetBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const months = btn.getAttribute("data-months");
        els.manader.value = months;
        els.manaderR.value = months;
        render();
      });
    });

    [["utgift", "utgiftR"], ["manader", "manaderR"], ["nuvarande", "nuvarandeR"], ["sparande", "sparandeR"], ["ranta", "rantaR"]]
      .forEach(function (pair) { syncPair(els[pair[0]], els[pair[1]], render); });

    render();
  });
})();
