/* ==========================================================================
   SparaPengar — Skuld- & amorteringskalkylatorn (bolån + privatlån/krediter)
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

  /* ---------------- Privatlån & krediter (flera lån) ---------------- */
  const STANDARDLAN = [
    { namn: "Privatlån", skuld: 80000, ranta: 7.9, betalning: 1800 },
    { namn: "Kreditkort", skuld: 25000, ranta: 19.9, betalning: 800 },
  ];
  const STRATEGI_HINT = {
    lavin: "Extra pengar går till lånet med högst ränta. När ett lån är betalt flyttas dess månadsbetalning till nästa — du betalar lika mycket varje månad men blir skuldfri snabbare. Ger lägst total ränta.",
    snoboll: "Extra pengar går till lånet med minst skuld. När ett lån är betalt flyttas dess månadsbetalning till nästa. Kostar ofta lite mer i ränta, men du får snabba delsegrar som gör det lättare att hålla i.",
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  function initPrivatlan() {
    const listaEl = document.getElementById("lan-lista");
    const laggTillBtn = document.getElementById("lan-lagg-till");
    const extraEl = document.getElementById("extra"), extraR = document.getElementById("extra-r");
    const valExtra = document.getElementById("val-extra");
    const strategiBtns = document.querySelectorAll("#strategi .preset-btn");
    const strategiHint = document.getElementById("strategi-hint");
    const canvas = document.getElementById("skuld-chart");
    const legendEl = document.getElementById("skuld-legend");
    const warningArea = document.getElementById("warning-area");
    const compareArea = document.getElementById("compare-area");
    const tabell = document.getElementById("lan-tabell");

    let nastaId = 1;
    const lanLista = STANDARDLAN.map(function (l) { return Object.assign({ id: nastaId++ }, l); });
    let strategi = "lavin";

    function ritaLista() {
      listaEl.innerHTML = lanLista.map(function (l) {
        return '<div class="lan-kort" data-id="' + l.id + '">' +
          '<div class="lan-kort-head">' +
            '<input type="text" data-falt="namn" value="' + escapeHtml(l.namn) + '" aria-label="Namn på lånet" placeholder="T.ex. billån">' +
            '<button type="button" class="lan-ta-bort" aria-label="Ta bort lån"' + (lanLista.length <= 1 ? " disabled" : "") + ">×</button>" +
          "</div>" +
          '<div class="lan-falt">' +
            '<label>Skuld (kr)<input type="number" data-falt="skuld" min="0" step="1000" value="' + l.skuld + '"></label>' +
            '<label>Ränta (%)<input type="number" data-falt="ranta" min="0" max="60" step="0.1" value="' + l.ranta + '"></label>' +
            '<label>Betalning/mån<input type="number" data-falt="betalning" min="0" step="100" value="' + l.betalning + '"></label>' +
          "</div>" +
        "</div>";
      }).join("");
    }

    function render() {
      const extra = Math.max(0, parseFloat(extraEl.value) || 0);
      valExtra.textContent = formatKr(extra);
      strategiBtns.forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-strategi") === strategi); });
      strategiHint.textContent = STRATEGI_HINT[strategi];

      const lan = lanLista.map(function (l) {
        return { namn: l.namn.trim() || "Lån", skuld: Math.max(0, l.skuld || 0), ranta: Math.max(0, l.ranta || 0), betalning: Math.max(0, l.betalning || 0) };
      });
      const totalSkuld = lan.reduce(function (a, l) { return a + l.skuld; }, 0);
      const totalBetalning = lan.reduce(function (a, l) { return a + (l.skuld > 0 ? l.betalning : 0); }, 0);
      const snittRanta = totalSkuld > 0 ? lan.reduce(function (a, l) { return a + l.skuld * l.ranta; }, 0) / totalSkuld : 0;

      document.getElementById("stat-skuld").textContent = formatKr(totalSkuld);
      document.getElementById("stat-skuld-hint").textContent = lan.length + " lån" + " · snittränta " + (Math.round(snittRanta * 10) / 10).toLocaleString("sv-SE") + " %";
      document.getElementById("stat-manad").textContent = formatKr(totalBetalning);

      // Lån där betalningen inte ens täcker räntan växer för evigt
      const forLaga = [];
      lan.forEach(function (l, i) {
        const ok = l.skuld <= 0 || l.betalning > l.skuld * l.ranta / 100 / 12;
        const kort = listaEl.querySelector('[data-id="' + lanLista[i].id + '"]');
        if (kort) kort.classList.toggle("varning", !ok);
        if (!ok) forLaga.push(l);
      });

      if (forLaga.length) {
        warningArea.innerHTML = '<div class="warning-box">⚠️ Betalningen täcker inte ens räntan på ' +
          forLaga.map(function (l) {
            return "<strong>" + escapeHtml(l.namn) + "</strong> (minst " + formatKr(Math.ceil(l.skuld * l.ranta / 100 / 12 / 10) * 10 + 10) + "/mån)";
          }).join(", ") +
          " — skulden kommer aldrig minska. Höj betalningen för att den ska börja gå ner.</div>";
        document.getElementById("stat-tid").textContent = "–";
        document.getElementById("stat-ranta-hint").textContent = "";
        compareArea.innerHTML = "";
        tabell.innerHTML = "";
        SPCharts.renderLineChart(canvas, {
          xLabels: Array.from({ length: 13 }, function (_, i) { return "M" + i; }),
          series: [{ label: "Kvarvarande skuld", color: "--series-8", values: new Array(13).fill(totalSkuld) }],
          legendEl: legendEl,
          formatValue: formatKrKompakt,
        });
        return;
      }
      warningArea.innerHTML = "";

      // Nuvarande plan: varje lån betalas för sig, utan extra och utan att frigjorda betalningar flyttas
      const base = simuleraFleraLan({ lan: lan });
      document.getElementById("stat-tid").textContent = formatManader(base.manader);
      document.getElementById("stat-ranta-hint").textContent = formatKr(base.totalRanta) + " i ränta totalt";

      tabell.innerHTML = lan.map(function (l, i) {
        return "<tr><td>" + escapeHtml(l.namn) + "</td><td>" + formatKr(l.skuld) + "</td><td>" + l.ranta.toLocaleString("sv-SE") + " %</td><td>" +
          formatKr(l.betalning) + "</td><td>" + formatManader(base.perLan[i].klarManad) + "</td><td>" + formatKr(base.perLan[i].ranta) + "</td></tr>";
      }).join("") +
        '<tr class="total"><td>Totalt</td><td>' + formatKr(totalSkuld) + "</td><td>" + (Math.round(snittRanta * 10) / 10).toLocaleString("sv-SE") + " %</td><td>" +
        formatKr(totalBetalning) + "</td><td>" + formatManader(base.manader) + "</td><td>" + formatKr(base.totalRanta) + "</td></tr>";

      // Smart plan: extra + frigjorda betalningar läggs på lånen i strategins ordning
      let improved = null;
      if (extra > 0 || lan.length > 1) {
        improved = simuleraFleraLan({ lan: lan, extra: extra, rullaOver: true, strategi: strategi });
        if (improved.omojligt || improved.manader >= base.manader && improved.totalRanta >= base.totalRanta) improved = null;
      }

      if (improved) {
        const diffManader = base.manader - improved.manader;
        const diffRanta = base.totalRanta - improved.totalRanta;
        const planNamn = (extra > 0 ? "Med " + formatKr(extra) + "/mån extra" : "Med frigjorda betalningar") + (lan.length > 1 ? ", " + (strategi === "lavin" ? "högst ränta först" : "minst skuld först") : "");
        compareArea.innerHTML =
          '<div class="compare-callout">' +
            '<div class="compare-col base"><div class="ccl-label">Nuvarande plan</div><div class="ccl-value">' + formatManader(base.manader) + '</div><div class="hint">' + formatKr(base.totalRanta) + " i ränta</div></div>" +
            '<div class="compare-col improved"><div class="ccl-label">' + planNamn + '</div><div class="ccl-value">' + formatManader(improved.manader) + '</div><div class="hint">' + formatKr(improved.totalRanta) + " i ränta</div></div>" +
          "</div>" +
          '<p style="font-weight:600;color:var(--text-primary);">→ Skuldfri ' + formatManader(diffManader) + " tidigare och " + formatKr(diffRanta) + " mindre i ränta.</p>";
      } else {
        compareArea.innerHTML = "";
      }

      const horizon = base.manader;
      const baseValues = padTo(base.rows.map(function (r) { return r.kvar; }), horizon + 1);
      const series = [{ label: "Nuvarande plan", color: "--series-1", values: baseValues }];
      if (improved) {
        series.push({ label: "Smartare plan", color: "--series-3", values: padTo(improved.rows.map(function (r) { return r.kvar; }), horizon + 1) });
      }

      SPCharts.renderLineChart(canvas, {
        xLabels: baseValues.map(function (_, i) { return "M" + i; }),
        series: series,
        legendEl: legendEl,
        formatValue: formatKrKompakt,
        xTickEvery: Math.max(1, Math.ceil(horizon / 8)),
      });
    }

    listaEl.addEventListener("input", function (e) {
      const falt = e.target.getAttribute("data-falt");
      const kort = e.target.closest(".lan-kort");
      if (!falt || !kort) return;
      const lan = lanLista.find(function (l) { return String(l.id) === kort.getAttribute("data-id"); });
      lan[falt] = falt === "namn" ? e.target.value : parseFloat(e.target.value) || 0;
      render();
    });

    listaEl.addEventListener("click", function (e) {
      const btn = e.target.closest(".lan-ta-bort");
      if (!btn || lanLista.length <= 1) return;
      const id = btn.closest(".lan-kort").getAttribute("data-id");
      lanLista.splice(lanLista.findIndex(function (l) { return String(l.id) === id; }), 1);
      ritaLista();
      render();
    });

    laggTillBtn.addEventListener("click", function () {
      lanLista.push({ id: nastaId++, namn: "Lån " + (lanLista.length + 1), skuld: 20000, ranta: 9, betalning: 600 });
      ritaLista();
      render();
      const inputs = listaEl.querySelectorAll('.lan-kort:last-child input[data-falt="namn"]');
      if (inputs.length) { inputs[0].focus(); inputs[0].select(); }
    });

    strategiBtns.forEach(function (btn) {
      btn.addEventListener("click", function () { strategi = btn.getAttribute("data-strategi"); render(); });
    });
    syncPair(extraEl, extraR, render);

    ritaLista();
    return render;
  }

  /* ---------------- Bolån ---------------- */
  const LOPTIDER = [25, 30, 40, 50];
  const BOLANETAK = 0.9;
  const TYP_HINT = {
    krav: "Du amorterar bara det lagen kräver: 2 % av lånet per år när belåningsgraden är över 70 %, 1 % när den är över 50 % och inget krav under 50 %. Så amorterar många i Sverige.",
    rak: "Samma amortering varje månad — månadskostnaden är högst i början och sjunker i takt med att lånet och räntan minskar. Amorteringskravet gäller som lägsta nivå.",
    annuitet: "Samma månadskostnad hela löptiden — i början går det mesta till ränta och lite till amortering. Vanligt i Norge och Danmark. Amorteringskravet gäller som lägsta nivå.",
  };

  function formatProcent(andel) {
    return (Math.round(andel * 1000) / 10).toLocaleString("sv-SE") + " %";
  }

  /** Första månaden då belåningsgraden når gränsen (eller null om den aldrig gör det). */
  function manadUnder(rows, varde, grans) {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].kvar <= varde * grans) return rows[i].manad;
    }
    return null;
  }

  function initBolan() {
    const els = {
      varde: document.getElementById("bolan-varde"), vardeR: document.getElementById("bolan-varde-r"),
      insats: document.getElementById("bolan-insats"), insatsR: document.getElementById("bolan-insats-r"),
      ranta: document.getElementById("bolan-ranta"), rantaR: document.getElementById("bolan-ranta-r"),
      ar: document.getElementById("bolan-ar"),
      extra: document.getElementById("bolan-extra"), extraR: document.getElementById("bolan-extra-r"),
    };
    const vals = {
      varde: document.getElementById("val-bolan-varde"),
      insats: document.getElementById("val-bolan-insats"),
      belopp: document.getElementById("val-bolan-belopp"),
      ranta: document.getElementById("val-bolan-ranta"),
      ar: document.getElementById("val-bolan-ar"),
      extra: document.getElementById("val-bolan-extra"),
    };
    const arBtns = document.querySelectorAll("#bolan-ar-presets .preset-btn");
    const typBtns = document.querySelectorAll("#bolan-typ .preset-btn");
    const typHint = document.getElementById("bolan-typ-hint");
    const canvas = document.getElementById("bolan-chart");
    const legendEl = document.getElementById("bolan-legend");
    const warningArea = document.getElementById("bolan-warning-area");
    const kravBox = document.getElementById("bolan-krav-box");
    const compareArea = document.getElementById("bolan-compare-area");
    const tabellCard = document.getElementById("bolan-lopetid-card");
    const tabell = document.getElementById("bolan-lopetid-tabell");
    let typ = "krav";

    function slutText(s) {
      return s.skuldfri ? formatManader(s.manader) : formatKrKompakt(s.kvarVidSlut) + " kvar";
    }

    function render() {
      const varde = Math.max(0, parseFloat(els.varde.value) || 0);
      const insats = Math.min(varde, Math.max(0, parseFloat(els.insats.value) || 0));
      const belopp = varde - insats;
      const belaningsgrad = varde > 0 ? belopp / varde : 0;
      const ranta = Math.max(0, parseFloat(els.ranta.value) || 0);
      const ar = Math.min(100, Math.max(1, Math.round(parseFloat(els.ar.value) || 1)));
      const extra = Math.max(0, parseFloat(els.extra.value) || 0);

      els.insatsR.max = Math.max(varde, 1);
      vals.varde.textContent = formatKr(varde);
      vals.insats.textContent = formatKr(insats) + (varde > 0 ? " (" + formatProcent(insats / varde) + ")" : "");
      vals.belopp.textContent = formatKr(belopp);
      document.getElementById("bolan-belaning-hint").textContent = "Belåningsgrad " + formatProcent(belaningsgrad) + " av bostadens värde.";
      vals.ranta.textContent = ranta.toLocaleString("sv-SE") + " %";
      vals.ar.textContent = ar + " år";
      vals.extra.textContent = formatKr(extra);
      arBtns.forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-ar") === String(ar)); });
      typBtns.forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-typ") === typ); });
      typHint.textContent = TYP_HINT[typ];
      document.getElementById("bolan-ar-label").textContent = typ === "krav" ? "Räkna på" : "Återbetalningstid";
      document.getElementById("bolan-ar-hint").textContent = typ === "krav"
        ? "Hur många år framåt vi räknar. Med bara amorteringskravet blir lånet sällan helt betalt."
        : "50 år är vanligt i Sverige, 30 år i t.ex. Norge och Danmark. Du kan också skriva in en egen löptid.";

      warningArea.innerHTML = belaningsgrad > BOLANETAK
        ? '<div class="warning-box">⚠️ Bolånetaket är 90 % — du behöver minst <strong>' + formatKr(varde * (1 - BOLANETAK)) + "</strong> i kontantinsats för en bostad värd " + formatKr(varde) + ". Resten måste i så fall lånas på annat sätt, t.ex. med ett dyrare privatlån.</div>"
        : "";

      const lanParams = { belopp: belopp, ranta: ranta, ar: ar, typ: typ, varde: varde };
      const base = simuleraLan(lanParams);
      const avdrag = uppskattaRanteavdrag(base.rows);

      // Amorteringskrav-rutan
      const kravNu = amorteringskravProcent(belaningsgrad);
      if (belopp > 0 && varde > 0) {
        let html = '<div class="krav-head">Belåningsgrad <strong>' + formatProcent(belaningsgrad) + "</strong> → amorteringskrav <strong>" +
          (kravNu > 0 ? kravNu * 100 + " % per år (" + formatKr(kravNu * belopp / 12) + "/mån)" : "inget") + "</strong></div>";
        const steg = [];
        const m70 = belaningsgrad > 0.7 ? manadUnder(base.rows, varde, 0.7) : null;
        const m50 = belaningsgrad > 0.5 ? manadUnder(base.rows, varde, 0.5) : null;
        if (m70 !== null) steg.push("under 70 % om " + formatManader(m70) + " → kravet sänks till 1 %");
        if (m50 !== null) steg.push("under 50 % om " + formatManader(m50) + " → inget krav");
        if (steg.length) html += '<div class="hint">Med den här planen: ' + steg.join(", ") + ".</div>";
        if (typ !== "krav") {
          html += '<div class="hint">' + (base.kravStyr
            ? "Din plan amorterar periodvis mindre än kravet — där har vi räknat med kravet istället."
            : "Din plan amorterar mer än kravet hela vägen. ✓") + "</div>";
        }
        kravBox.innerHTML = html;
      } else {
        kravBox.innerHTML = "";
      }

      document.getElementById("bolan-stat-manad-label").textContent = typ === "annuitet" && !base.kravStyr ? "Månadskostnad" : "Första månadskostnaden";
      document.getElementById("bolan-stat-manad").textContent = formatKr(base.forstaBetalning);
      document.getElementById("bolan-stat-ranta-label").textContent = base.skuldfri ? "Total ränta" : "Ränta på " + ar + " år";
      document.getElementById("bolan-stat-ranta").textContent = formatKr(base.totalRanta);
      document.getElementById("bolan-stat-avdrag").textContent = avdrag > 0 ? "ca " + formatKr(base.totalRanta - avdrag) + " efter ränteavdrag" : "";
      document.getElementById("bolan-stat-tid-label").textContent = base.skuldfri ? "Skuldfri om" : "Kvar att betala efter " + ar + " år";
      document.getElementById("bolan-stat-tid").textContent = base.skuldfri ? formatManader(base.manader) : formatKr(base.kvarVidSlut);

      let improved = null;
      if (extra > 0 && belopp > 0) {
        improved = simuleraLan(Object.assign({}, lanParams, { extra: extra }));
        let summary;
        if (base.skuldfri && improved.skuldfri) {
          summary = "skuldfri " + formatManader(base.manader - improved.manader) + " tidigare och " + formatKr(base.totalRanta - improved.totalRanta) + " mindre i ränta.";
        } else if (improved.skuldfri) {
          summary = "skuldfri om " + formatManader(improved.manader) + " istället för " + formatKr(base.kvarVidSlut) + " kvar efter " + ar + " år.";
        } else {
          summary = formatKr(base.kvarVidSlut - improved.kvarVidSlut) + " mindre kvar efter " + ar + " år och " + formatKr(base.totalRanta - improved.totalRanta) + " mindre i ränta.";
        }
        compareArea.innerHTML =
          '<div class="compare-callout">' +
            '<div class="compare-col base"><div class="ccl-label">Utan extra</div><div class="ccl-value">' + slutText(base) + '</div><div class="hint">' + formatKr(base.totalRanta) + " i ränta</div></div>" +
            '<div class="compare-col improved"><div class="ccl-label">Med ' + formatKr(extra) + "/mån extra</div><div class=\"ccl-value\">" + slutText(improved) + '</div><div class="hint">' + formatKr(improved.totalRanta) + " i ränta</div></div>" +
          "</div>" +
          '<p style="font-weight:600;color:var(--text-primary);">Amortera ' + formatKr(extra) + "/månad extra → " + summary + "</p>";
      } else {
        compareArea.innerHTML = "";
      }

      // Årsvisa punkter — upp till 600 månader blir för tätt i grafen
      const horizonAr = Math.max(1, Math.ceil(base.manader / 12));
      function arsvarden(rows) {
        const out = [];
        for (let y = 0; y <= horizonAr; y++) {
          out.push(y * 12 < rows.length ? rows[y * 12].kvar : rows[rows.length - 1].kvar);
        }
        return out;
      }
      const baseLabel = typ === "krav" ? "Amorteringskravet" : "Plan på " + ar + " år";
      const series = [{ label: baseLabel, color: "--series-1", values: arsvarden(base.rows) }];
      if (improved) series.push({ label: "Med extra amortering", color: "--series-3", values: arsvarden(improved.rows) });

      SPCharts.renderLineChart(canvas, {
        xLabels: Array.from({ length: horizonAr + 1 }, function (_, i) { return "År " + i; }),
        series: series,
        legendEl: legendEl,
        formatValue: formatKrKompakt,
        xTickEvery: Math.max(1, Math.ceil(horizonAr / 10)),
      });

      // Löptidsjämförelsen är meningslös när bara kravet styr amorteringen
      tabellCard.hidden = typ === "krav";
      if (typ !== "krav") {
        const loptider = LOPTIDER.indexOf(ar) === -1 ? LOPTIDER.concat([ar]).sort(function (a, b) { return a - b; }) : LOPTIDER;
        tabell.innerHTML = loptider.map(function (l) {
          const s = simuleraLan(Object.assign({}, lanParams, { ar: l }));
          return '<tr' + (l === ar ? ' class="selected"' : "") + "><td>" + l + " år</td><td>" + formatKr(s.forstaBetalning) + "</td><td>" + formatKr(s.totalRanta) + "</td><td>" + formatKr(s.totalBetalt) + "</td></tr>";
        }).join("");
      }
    }

    [["varde", "vardeR"], ["insats", "insatsR"], ["ranta", "rantaR"], ["extra", "extraR"]]
      .forEach(function (pair) { syncPair(els[pair[0]], els[pair[1]], render); });
    els.ar.addEventListener("input", render);
    arBtns.forEach(function (btn) {
      btn.addEventListener("click", function () { els.ar.value = btn.getAttribute("data-ar"); render(); });
    });
    typBtns.forEach(function (btn) {
      btn.addEventListener("click", function () { typ = btn.getAttribute("data-typ"); render(); });
    });

    return render;
  }

  /* ---------------- Flikar: bolån / privatlån ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    const renderers = { bolan: initBolan(), privatlan: initPrivatlan() };
    const tabs = document.querySelectorAll(".mode-toggle-btn");
    const panels = document.querySelectorAll("[data-loan-panel]");

    function setMode(mode) {
      if (!renderers[mode]) mode = "bolan";
      tabs.forEach(function (b) {
        const active = b.getAttribute("data-loan-mode") === mode;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", active ? "true" : "false");
      });
      panels.forEach(function (p) { p.hidden = p.getAttribute("data-loan-panel") !== mode; });
      // Grafen måste ritas när panelen är synlig, annars blir canvasen fel storlek
      renderers[mode]();
    }

    tabs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const mode = btn.getAttribute("data-loan-mode");
        try { history.replaceState(null, "", "#" + mode); } catch (e) { /* no-op */ }
        setMode(mode);
      });
    });

    setMode(location.hash.replace("#", ""));
  });
})();
