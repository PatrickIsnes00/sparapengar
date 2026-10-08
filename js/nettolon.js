/* ==========================================================================
   SparaPengar — Nettolön-kalkylatorn (förenklad uppskattning)
   ========================================================================== */
(function () {
  "use strict";

  function syncPair(numEl, rangeEl, onChange) {
    function fromNum() { rangeEl.value = numEl.value; onChange(); }
    function fromRange() { numEl.value = rangeEl.value; onChange(); }
    numEl.addEventListener("input", fromNum);
    rangeEl.addEventListener("input", fromRange);
  }

  document.addEventListener("DOMContentLoaded", function () {
    const brutto = document.getElementById("brutto");
    const bruttoR = document.getElementById("brutto-r");
    const kommunalskatt = document.getElementById("kommunalskatt");
    const kommunalskattR = document.getElementById("kommunalskatt-r");
    const valBrutto = document.getElementById("val-brutto");
    const valKommunalskatt = document.getElementById("val-kommunalskatt");
    const meterNetto = document.getElementById("meter-netto");
    const meterSkatt = document.getElementById("meter-skatt");
    const perArText = document.getElementById("per-ar-text");

    function render() {
      const bruttoVarde = Math.max(0, parseFloat(brutto.value) || 0);
      const skattesats = parseFloat(kommunalskatt.value) || 32.37;

      valBrutto.textContent = formatKr(bruttoVarde);
      valKommunalskatt.textContent = skattesats.toLocaleString("sv-SE", { minimumFractionDigits: 2 }) + " %";

      const r = uppskattaNettolon({ bruttoPerManad: bruttoVarde, kommunalskatt: skattesats });

      document.getElementById("stat-netto").textContent = formatKr(r.netto);
      document.getElementById("stat-skatt").textContent = formatKr(r.skatt);
      document.getElementById("stat-sats").textContent = r.skattesats + " %";

      const nettoPct = r.brutto > 0 ? (r.netto / r.brutto) * 100 : 0;
      const skattPct = 100 - nettoPct;
      meterNetto.style.width = nettoPct + "%";
      meterSkatt.style.width = skattPct + "%";
      meterNetto.textContent = nettoPct >= 15 ? Math.round(nettoPct) + "%" : "";
      meterSkatt.textContent = skattPct >= 15 ? Math.round(skattPct) + "%" : "";

      perArText.innerHTML = "Per år: <strong>" + formatKr(r.brutto * 12) + "</strong> brutto → <strong>" + formatKr(r.netto * 12) + "</strong> netto.";
    }

    syncPair(brutto, bruttoR, render);
    syncPair(kommunalskatt, kommunalskattR, render);

    render();
  });
})();
