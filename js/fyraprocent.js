/* ==========================================================================
   Guldgrisen — 4 %-regeln (uttag från sparande)
   ========================================================================== */
(function () {
  "use strict";

  function syncPair(numEl, rangeEl, onChange) {
    function fromNum() { rangeEl.value = numEl.value; onChange(); }
    function fromRange() { numEl.value = rangeEl.value; onChange(); }
    numEl.addEventListener("input", fromNum);
    rangeEl.addEventListener("input", fromRange);
  }

  function formatProcent(p) {
    return p.toLocaleString("sv-SE", { maximumFractionDigits: 1 }) + " %";
  }

  document.addEventListener("DOMContentLoaded", function () {
    const ids = ["kapital", "avkastning", "uttag", "inflation", "ar", "onskat"];
    const els = {};
    ids.forEach(function (id) {
      els[id] = document.getElementById("fp-" + id);
      els[id + "R"] = document.getElementById("fp-" + id + "-r");
    });
    const tableWrap = document.getElementById("fp-table-wrap");
    const toggleTableBtn = document.getElementById("fp-toggle-table");

    function setText(id, text) { document.getElementById(id).textContent = text; }
    function num(el, min) { return Math.max(min || 0, parseFloat(el.value) || 0); }

    function render() {
      const kapital = num(els.kapital);
      const avkastning = num(els.avkastning);
      const uttag = num(els.uttag);
      const inflation = num(els.inflation);
      const ar = Math.min(60, Math.max(1, Math.round(num(els.ar, 1))));
      const onskat = num(els.onskat);

      setText("val-fp-kapital", formatKr(kapital));
      setText("val-fp-avkastning", formatProcent(avkastning));
      setText("val-fp-uttag", formatProcent(uttag));
      setText("val-fp-inflation", formatProcent(inflation));
      setText("val-fp-ar", ar + " år");
      setText("val-fp-onskat", formatKr(onskat));

      const rows = simuleraUttag({ kapital: kapital, avkastning: avkastning, uttag: uttag, inflation: inflation, ar: ar });
      const forsta = rows[0];
      const slut = rows[rows.length - 1];
      const netto = avkastning - uttag;

      setText("fp-stat-uttag", formatKr(forsta.uttagAr / 12) + "/mån");
      setText("fp-stat-uttag-ar", formatKr(forsta.uttagAr) + " per år");
      setText("fp-stat-tillvaxt-label", netto < 0 ? "Innehavet minskar med" : "Innehavet växer med");
      setText("fp-stat-tillvaxt", formatKr(Math.abs(forsta.tillvaxtAr) / 12) + "/mån");
      setText("fp-stat-tillvaxt-ar", formatKr(Math.abs(forsta.tillvaxtAr)) + " första året");
      setText("fp-stat-slut-label", "Innehav efter " + ar + " år");
      setText("fp-stat-slut", formatKrKompakt(slut.varde));
      setText("fp-stat-slut-real", formatKrKompakt(slut.real) + " i dagens pengar");

      // Uttaget följer innehavet, så om innehavet växer växer också uttaget
      const sistaUttag = rows[rows.length - 2].uttagAr / 12;
      const sistaUttagReal = sistaUttag / Math.pow(1 + inflation / 100, ar - 1);
      const sammanfattning = document.getElementById("fp-sammanfattning");
      if (kapital <= 0) {
        sammanfattning.textContent = "Ange hur stort ditt innehav är för att se vad du kan ta ut.";
      } else if (uttag <= 0) {
        sammanfattning.textContent = "Du tar inte ut något, så hela avkastningen stannar kvar och växer vidare.";
      } else {
        sammanfattning.textContent = "Med " + formatProcent(avkastning) + " avkastning och " + formatProcent(uttag) + " uttag " +
          (netto > 0 ? "växer innehavet med " + formatProcent(netto) + " per år samtidigt som du tar ut pengar. "
            : netto < 0 ? "tar du ut mer än innehavet växer, så det krymper med " + formatProcent(-netto) + " per år. "
            : "är innehavet lika stort hela tiden. ") +
          "År " + ar + " blir uttaget " + formatKr(sistaUttag) + "/mån, vilket motsvarar " + formatKr(sistaUttagReal) + "/mån i dagens pengar.";
      }

      const varningar = [];
      if (kapital > 0 && uttag > 0 && netto < inflation) {
        varningar.push(netto < 0
          ? "Uttaget är större än avkastningen. Innehavet krymper varje år och efter " + ar + " år är det " + formatKrKompakt(slut.varde) + " kvar."
          : "Innehavet växer långsammare än inflationen (" + formatProcent(inflation) + "), så både innehavet och uttaget tappar köpkraft över tid.");
      }
      if (avkastning > 10) {
        varningar.push("Över 10 % avkastning per år i snitt är mycket optimistiskt över lång tid. Prova gärna med en lägre siffra.");
      }
      document.getElementById("fp-warning-area").innerHTML = varningar.map(function (v) {
        return '<div class="warning-box">⚠️ ' + v + "</div>";
      }).join("");

      SPCharts.renderLineChart(document.getElementById("fp-chart"), {
        xLabels: rows.map(function (r) { return "År " + r.ar; }),
        series: [
          { label: "Innehav", color: "--series-1", values: rows.map(function (r) { return r.varde; }) },
          { label: "Innehav i dagens pengar", color: "--series-1", values: rows.map(function (r) { return r.real; }), dashed: true },
          { label: "Totalt uttaget", color: "--series-2", values: rows.map(function (r) { return r.totaltUttag; }) },
        ],
        legendEl: document.getElementById("fp-legend"),
        formatValue: formatKrKompakt,
        xTickEvery: ar <= 20 ? 2 : 5,
      });

      document.getElementById("fp-table-body").innerHTML = rows.slice(0, -1).map(function (r) {
        const real = r.uttagAr / Math.pow(1 + inflation / 100, r.ar);
        return "<tr><td>" + (r.ar + 1) + "</td><td>" + formatKr(r.varde) + "</td><td>" + formatKr(r.uttagAr / 12) +
          "</td><td>" + formatKr(r.tillvaxtAr / 12) + "</td><td>" + formatKr(real / 12) + "</td></tr>";
      }).join("");

      // Omvänt: hur stort innehav krävs för önskat uttag?
      const behov = uttag > 0 ? onskat * 12 / (uttag / 100) : 0;
      const kvar = behov - kapital;
      setText("fp-behov", uttag > 0
        ? "För att ta ut " + formatKr(onskat) + "/mån med " + formatProcent(uttag) + " uttag behöver du " + formatKr(behov) + "."
        : "Ange ett uttag över 0 % för att räkna ut hur mycket du behöver.");
      setText("fp-behov-hint", uttag <= 0 ? "" : kvar > 0
        ? "Det är " + formatKr(kvar) + " mer än du har i dag. Kapitalet du behöver är " +
          (100 / uttag).toLocaleString("sv-SE", { maximumFractionDigits: 1 }) + " gånger det du vill ta ut per år."
        : "Du har redan tillräckligt, med " + formatKr(-kvar) + " till godo.");
    }

    ids.forEach(function (id) { syncPair(els[id], els[id + "R"], render); });

    toggleTableBtn.addEventListener("click", function () {
      const visible = tableWrap.classList.toggle("visible");
      toggleTableBtn.textContent = visible ? "Dölj tabell ↑" : "Visa som tabell ↓";
    });

    render();
  });
})();
