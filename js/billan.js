/* ==========================================================================
   Guldgrisen — Billånskalkylatorn (med och utan restvärde)
   ========================================================================== */
(function () {
  "use strict";

  const LOPTIDER = [24, 36, 48, 60, 72, 84];
  // Restvärde erbjuds nästan bara på billån upp till 3 år — längre än så räknar vi inte med det
  const MAX_REST_MANADER = 36;
  const MIN_INSATS = 0.2;

  function syncPair(numEl, rangeEl, onChange) {
    function fromNum() { rangeEl.value = numEl.value; onChange(); }
    function fromRange() { numEl.value = rangeEl.value; onChange(); }
    numEl.addEventListener("input", fromNum);
    rangeEl.addEventListener("input", fromRange);
  }

  function formatLoptid(manader) {
    const ar = manader / 12;
    return manader + " mån" + (Number.isInteger(ar) ? " (" + ar + " år)" : "");
  }

  function formatProcent(p) {
    return p.toLocaleString("sv-SE", { maximumFractionDigits: 1 }) + " %";
  }

  document.addEventListener("DOMContentLoaded", function () {
    const els = {
      pris: document.getElementById("bil-pris"), prisR: document.getElementById("bil-pris-r"),
      insats: document.getElementById("bil-insats"), insatsR: document.getElementById("bil-insats-r"),
      ranta: document.getElementById("bil-ranta"), rantaR: document.getElementById("bil-ranta-r"),
      manader: document.getElementById("bil-manader"),
      rest: document.getElementById("bil-rest"), restR: document.getElementById("bil-rest-r"),
      uppl: document.getElementById("bil-uppl"),
      avi: document.getElementById("bil-avi"),
      extra: document.getElementById("bil-extra"), extraR: document.getElementById("bil-extra-r"),
    };
    const manadBtns = document.querySelectorAll("#bil-manader-presets .preset-btn");

    function setText(id, text) { document.getElementById(id).textContent = text; }

    function render() {
      const pris = Math.max(0, parseFloat(els.pris.value) || 0);
      const insats = Math.min(pris, Math.max(0, parseFloat(els.insats.value) || 0));
      const belopp = pris - insats;
      const ranta = Math.max(0, parseFloat(els.ranta.value) || 0);
      const manader = Math.min(120, Math.max(1, Math.round(parseFloat(els.manader.value) || 1)));
      const restProcent = Math.max(0, parseFloat(els.rest.value) || 0);
      const uppl = Math.max(0, parseFloat(els.uppl.value) || 0);
      const avi = Math.max(0, parseFloat(els.avi.value) || 0);
      const extra = Math.max(0, parseFloat(els.extra.value) || 0);
      // Restvärdet anges som andel av bilens pris men kan aldrig vara större än lånet
      const restvardeOnskat = pris * restProcent / 100;
      const restMojligt = manader <= MAX_REST_MANADER;
      const restvarde = restMojligt ? Math.min(belopp, restvardeOnskat) : 0;
      els.rest.disabled = els.restR.disabled = !restMojligt;

      els.insatsR.max = Math.max(pris, 1);
      setText("val-bil-pris", formatKr(pris));
      setText("val-bil-insats", formatKr(insats) + (pris > 0 ? " (" + formatProcent(insats / pris * 100) + ")" : ""));
      setText("val-bil-belopp", formatKr(belopp));
      setText("val-bil-ranta", ranta.toLocaleString("sv-SE") + " %");
      setText("val-bil-manader", formatLoptid(manader));
      setText("val-bil-rest", formatProcent(restProcent));
      setText("val-bil-uppl", formatKr(uppl));
      setText("val-bil-avi", formatKr(avi));
      setText("val-bil-extra", formatKr(extra));
      manadBtns.forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-manader") === String(manader)); });

      setText("bil-insats-hint", "Långivare kräver nästan alltid minst 20 % i kontantinsats, för den här bilen " + formatKr(pris * MIN_INSATS) + ".");
      setText("bil-rest-hint", !restMojligt
        ? "Restvärde erbjuds nästan bara på lån upp till " + MAX_REST_MANADER + " månader. Välj en kortare löptid för att räkna med restvärde."
        : "= " + formatKr(restvarde) + " att betala i slutet. Långivare godkänner ofta 30–50 % beroende på bil och löptid.");

      const varningar = [];
      if (pris > 0 && insats < pris * MIN_INSATS - 0.5) {
        varningar.push("Kontantinsatsen är under 20 %. De flesta långivare kräver minst <strong>" + formatKr(pris * MIN_INSATS) + "</strong> för en bil som kostar " + formatKr(pris) + ".");
      }
      if (restMojligt && restvardeOnskat > belopp && belopp > 0) {
        varningar.push("Restvärdet kan inte vara större än lånet, så vi har räknat med " + formatKr(restvarde) + ".");
      }
      document.getElementById("bil-warning-area").innerHTML = varningar.map(function (v) {
        return '<div class="warning-box">⚠️ ' + v + "</div>";
      }).join("");

      const bas = { belopp: belopp, ranta: ranta, manader: manader, uppl: uppl, avi: avi };
      const utan = beraknaBillan(bas);
      const med = beraknaBillan(Object.assign({}, bas, { restvarde: restvarde }));

      setText("bil-utan-manad", formatKr(utan.manadsbetalning) + "/mån");
      setText("bil-utan-hint", "Bilen är din efter " + formatLoptid(manader) + ".");
      setText("bil-med-label", "Med restvärde " + formatProcent(restProcent));
      setText("bil-med-manad", restMojligt ? formatKr(med.manadsbetalning) + "/mån" : "–");
      setText("bil-med-hint", restMojligt
        ? "+ " + formatKr(med.restvarde) + " att betala efter " + formatLoptid(manader) + "."
        : "Erbjuds sällan för löptider över " + MAX_REST_MANADER + " mån.");

      const sammanfattning = document.getElementById("bil-sammanfattning");
      if (!restMojligt) {
        sammanfattning.textContent = "Restvärde erbjuds nästan aldrig på billån längre än " + MAX_REST_MANADER +
          " månader, så här räknar vi bara på ett vanligt billån. Välj 3 år eller kortare för att jämföra med restvärde.";
      } else if (belopp > 0 && med.restvarde > 0) {
        sammanfattning.textContent = "Med restvärde blir månadskostnaden " + formatKr(utan.manadsbetalning - med.manadsbetalning) +
          " lägre, men du betalar " + formatKr(med.totalRanta - utan.totalRanta) + " mer i ränta och har " +
          formatKr(med.restvarde) + " kvar att betala när löptiden är slut.";
      } else {
        sammanfattning.textContent = belopp > 0 ? "Sätt ett restvärde för att jämföra de två lånen." : "";
      }

      const rader = [
        ["Månadskostnad", formatKr(utan.manadsbetalning), formatKr(med.manadsbetalning)],
        ["Att betala i slutet (restvärde)", formatKr(0), formatKr(med.restvarde)],
        ["Total ränta", formatKr(utan.totalRanta), formatKr(med.totalRanta)],
        ["Avgifter", formatKr(utan.avgifter), formatKr(med.avgifter)],
        ["Kreditkostnad", formatKr(utan.kreditkostnad), formatKr(med.kreditkostnad)],
        ["Effektiv ränta", formatProcent(utan.effektivRanta), formatProcent(med.effektivRanta)],
      ];
      rader.push(["Totalt betalat", formatKr(utan.totalBetalt), formatKr(med.totalBetalt)]);
      document.getElementById("bil-jamfor-tabell").innerHTML = rader.map(function (r, i) {
        return "<tr" + (i === rader.length - 1 ? ' class="total"' : "") + "><td>" + r[0] + "</td><td>" + r[1] + "</td><td>" + (restMojligt ? r[2] : "–") + "</td></tr>";
      }).join("");

      // Extra betalning: jämför samma lån med och utan extra amortering varje månad
      const extraAktiv = extra > 0 && belopp > 0;
      const utanExtra = extraAktiv ? beraknaBillan(Object.assign({}, bas, { extra: extra })) : null;
      const medExtra = extraAktiv && med.restvarde > 0 ? beraknaBillan(Object.assign({}, bas, { restvarde: restvarde, extra: extra })) : null;
      document.getElementById("bil-extra-card").hidden = !extraAktiv;
      if (extraAktiv) {
        setText("bil-extra-rubrik", "Med " + formatKr(extra) + " extra varje månad");
        const tidigare = manader - utanExtra.skuldfriManad;
        const kolumner = [
          '<div class="compare-col improved"><div class="ccl-label">Utan restvärde</div>' +
          '<div class="ccl-value">Klart efter ' + formatLoptid(utanExtra.skuldfriManad) + "</div>" +
          '<div class="hint">' + (tidigare > 0 ? tidigare + " mån tidigare och " : "") +
          formatKr(utan.totalRanta - utanExtra.totalRanta) + " mindre i ränta.</div></div>",
        ];
        if (medExtra) {
          kolumner.push('<div class="compare-col improved"><div class="ccl-label">Med restvärde</div>' +
            (medExtra.skuldfriManad
              ? '<div class="ccl-value">Klart efter ' + formatLoptid(medExtra.skuldfriManad) + "</div>" +
                '<div class="hint">Inget restvärde kvar att betala, och ' + formatKr(med.totalRanta - medExtra.totalRanta) + " mindre i ränta.</div>"
              : '<div class="ccl-value">' + formatKr(medExtra.restvarde) + " kvar i slutet</div>" +
                '<div class="hint">I stället för ' + formatKr(med.restvarde) + ". Du betalar " + formatKr(med.totalRanta - medExtra.totalRanta) + " mindre i ränta.</div>") +
            "</div>");
        }
        document.getElementById("bil-extra-jamfor").innerHTML = kolumner.join("");
      }

      function kvarVarden(res) { return res.rows.map(function (r) { return r.kvar; }); }
      const series = [{ label: "Utan restvärde", color: "--series-1", values: kvarVarden(utan) }];
      if (utanExtra) series.push({ label: "Utan restvärde + extra", color: "--series-1", values: kvarVarden(utanExtra), dashed: true });
      if (med.restvarde > 0) series.push({ label: "Med restvärde", color: "--series-2", values: kvarVarden(med) });
      if (medExtra) series.push({ label: "Med restvärde + extra", color: "--series-2", values: kvarVarden(medExtra), dashed: true });
      SPCharts.renderLineChart(document.getElementById("bil-chart"), {
        xLabels: utan.rows.map(function (r) { return "Mån " + r.manad; }),
        series: series,
        legendEl: document.getElementById("bil-legend"),
        formatValue: formatKrKompakt,
        xTickEvery: manader <= 48 ? 6 : 12,
      });

      const loptider = LOPTIDER.indexOf(manader) === -1 ? LOPTIDER.concat([manader]).sort(function (a, b) { return a - b; }) : LOPTIDER;
      document.getElementById("bil-lopetid-tabell").innerHTML = loptider.map(function (m) {
        const u = beraknaBillan(Object.assign({}, bas, { manader: m }));
        // Restvärdet i tabellen följer reglaget, men bara för löptider där restvärde faktiskt erbjuds
        const r = m <= MAX_REST_MANADER ? beraknaBillan(Object.assign({}, bas, { manader: m, restvarde: Math.min(belopp, restvardeOnskat) })) : null;
        return "<tr" + (m === manader ? ' class="selected"' : "") + "><td>" + formatLoptid(m) + "</td><td>" + formatKr(u.manadsbetalning) +
          "</td><td>" + (r ? formatKr(r.manadsbetalning) : "–") + "</td><td>" + formatKrKompakt(u.kreditkostnad) + " / " + (r ? formatKrKompakt(r.kreditkostnad) : "–") + "</td></tr>";
      }).join("");
    }

    // När priset ändras sätts kontantinsatsen till 20 % av det nya priset. Användaren kan sedan
    // ändra insatsen fritt, tills priset ändras igen.
    syncPair(els.pris, els.prisR, function () {
      const pris = Math.max(0, parseFloat(els.pris.value) || 0);
      els.insatsR.max = Math.max(pris, 1); // annars kapas reglaget vid det gamla priset
      els.insats.value = els.insatsR.value = Math.ceil(pris * MIN_INSATS);
      render();
    });
    [["insats", "insatsR"], ["ranta", "rantaR"], ["rest", "restR"], ["extra", "extraR"]]
      .forEach(function (pair) { syncPair(els[pair[0]], els[pair[1]], render); });
    [els.manader, els.uppl, els.avi].forEach(function (el) { el.addEventListener("input", render); });
    manadBtns.forEach(function (btn) {
      btn.addEventListener("click", function () { els.manader.value = btn.getAttribute("data-manader"); render(); });
    });

    render();
  });
})();
