/* ==========================================================================
   Guldgrisen — Hushållsbudget: inkomster minus utgifter = överskott,
   och vad överskottet kan bli värt om det investeras.
   ========================================================================== */
(function () {
  "use strict";

  const INCOME_DEFAULT = [
    { label: "Nettoinkomst 1", value: 28000 },
    { label: "Nettoinkomst 2", value: 22000 },
  ];
  const EXPENSE_FIXED_DEFAULT = [
    { label: "Boende / hyra", value: 9000 },
    { label: "El & uppvärmning", value: 900 },
    { label: "Försäkringar", value: 400 },
    { label: "Telefon & internet", value: 500 },
    { label: "Abonnemang", value: 300 },
    { label: "Lån & krediter", value: 0 },
  ];
  const EXPENSE_VARIABLE_DEFAULT = [
    { label: "Mat (livsmedel)", value: 6000 },
    { label: "Drivmedel / kollektivtrafik", value: 1500 },
    { label: "Barnomsorg / barnkostnader", value: 0 },
    { label: "Nöje & fritid", value: 600 },
    { label: "Kläder", value: 500 },
    { label: "Övrigt", value: 500 },
  ];

  let rowIdCounter = 0;

  function addRow(containerEl, label, value) {
    const div = document.createElement("div");
    div.className = "budget-row";
    div.dataset.rowId = "row-" + (rowIdCounter++);
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "row-label-input";
    labelInput.value = label;
    const valueInput = document.createElement("input");
    valueInput.type = "number";
    valueInput.className = "row-value-input";
    valueInput.value = value;
    valueInput.min = "0";
    valueInput.step = "50";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "row-remove-btn";
    removeBtn.setAttribute("aria-label", "Ta bort rad");
    removeBtn.textContent = "✕";
    div.appendChild(labelInput);
    div.appendChild(valueInput);
    div.appendChild(removeBtn);
    containerEl.appendChild(div);
    return div;
  }

  function sumContainer(containerEl) {
    let total = 0;
    containerEl.querySelectorAll(".row-value-input").forEach(function (inp) {
      total += parseFloat(inp.value) || 0;
    });
    return total;
  }

  document.addEventListener("DOMContentLoaded", function () {
    const incomeRowsEl = document.getElementById("income-rows");
    const expenseFixedEl = document.getElementById("expense-rows-fixed");
    const expenseVariableEl = document.getElementById("expense-rows-variable");

    INCOME_DEFAULT.forEach(function (r) { addRow(incomeRowsEl, r.label, r.value); });
    EXPENSE_FIXED_DEFAULT.forEach(function (r) { addRow(expenseFixedEl, r.label, r.value); });
    EXPENSE_VARIABLE_DEFAULT.forEach(function (r) { addRow(expenseVariableEl, r.label, r.value); });

    document.getElementById("add-income-btn").addEventListener("click", function () {
      addRow(incomeRowsEl, "Ny inkomst", 0);
      render();
    });
    document.querySelectorAll(".add-row-btn[data-group]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const group = btn.getAttribute("data-group");
        const target = group === "fixed" ? expenseFixedEl : expenseVariableEl;
        addRow(target, group === "fixed" ? "Ny fast kostnad" : "Ny utgift", 0);
        render();
      });
    });

    document.addEventListener("input", function (e) {
      if (e.target.classList.contains("row-value-input")) render();
    });
    document.addEventListener("click", function (e) {
      if (e.target.classList.contains("row-remove-btn")) {
        const row = e.target.closest(".budget-row");
        if (row) { row.remove(); render(); }
      }
    });

    const statInkomst = document.getElementById("stat-inkomst");
    const statUtgift = document.getElementById("stat-utgift");
    const statOverskott = document.getElementById("stat-overskott");
    const meterUtgift = document.getElementById("meter-utgift");
    const meterOverskott = document.getElementById("meter-overskott");
    const deficitWarningEl = document.getElementById("deficit-warning");
    const projectionCanvas = document.getElementById("projection-chart");
    const projectionLegendEl = document.getElementById("projection-legend");
    const projectionStatsEl = document.getElementById("projection-stats");
    const projectionEmptyEl = document.getElementById("projection-empty-msg");

    const rateSelect = document.getElementById("rate-select");
    const customField = document.getElementById("custom-rate-field");
    const customRate = document.getElementById("custom-rate");
    const valCustomRate = document.getElementById("val-custom-rate");
    const horisontEl = document.getElementById("horisont");
    const horisontR = document.getElementById("horisont-r");
    const valHorisont = document.getElementById("val-horisont");

    function currentRate() {
      if (rateSelect.value === "custom") return parseFloat(customRate.value) || 0;
      return parseFloat(rateSelect.value);
    }

    function syncPair(numEl, rangeEl, onChange) {
      function fromNum() { rangeEl.value = numEl.value; onChange(); }
      function fromRange() { numEl.value = rangeEl.value; onChange(); }
      numEl.addEventListener("input", fromNum);
      rangeEl.addEventListener("input", fromRange);
    }

    function render() {
      const totalInkomst = sumContainer(incomeRowsEl);
      const totalUtgift = sumContainer(expenseFixedEl) + sumContainer(expenseVariableEl);
      const overskott = totalInkomst - totalUtgift;

      statInkomst.textContent = formatKr(totalInkomst);
      statUtgift.textContent = formatKr(totalUtgift);
      statOverskott.textContent = formatKr(overskott);
      statOverskott.classList.toggle("negative", overskott < 0);

      if (totalInkomst > 0) {
        const utgiftPct = Math.min(100, (totalUtgift / totalInkomst) * 100);
        const overskottPct = Math.max(0, 100 - utgiftPct);
        meterUtgift.style.width = utgiftPct + "%";
        meterOverskott.style.width = overskottPct + "%";
      } else {
        meterUtgift.style.width = "0%";
        meterOverskott.style.width = "0%";
      }

      deficitWarningEl.innerHTML = overskott < 0
        ? '<div class="warning-box">⚠️ Era utgifter är <strong>' + formatKr(Math.abs(overskott)) + '</strong> högre än inkomsterna varje månad. Kolla om något går att dra ner på i <a href="budget.html">besparingsverktyget</a>.</div>'
        : "";

      const rate = currentRate();
      const ar = Math.max(1, parseInt(horisontEl.value, 10) || 1);
      valHorisont.textContent = ar + " år";

      if (overskott <= 0) {
        projectionStatsEl.style.display = "none";
        projectionEmptyEl.style.display = "";
        return;
      }
      projectionStatsEl.style.display = "";
      projectionEmptyEl.style.display = "none";

      const rows = simuleraSparande({ startkapital: 0, manadssparande: overskott, ranta: rate, ar: ar });
      const last = rows[rows.length - 1];

      document.getElementById("proj-slutvarde").textContent = formatKr(last.varde);
      document.getElementById("proj-insatt").textContent = formatKr(last.insatt);
      document.getElementById("proj-avkastning").textContent = formatKr(last.ranta);

      const xLabels = rows.map(function (r) { return "År " + r.ar; });
      SPCharts.renderAreaChart(projectionCanvas, {
        xLabels: xLabels,
        series: [
          { label: "Investerat överskott", color: "--series-1", values: rows.map(function (r) { return r.insatt; }) },
          { label: "Avkastning", color: "--series-3", values: rows.map(function (r) { return r.ranta; }) },
        ],
        stacked: true,
        legendEl: projectionLegendEl,
        formatValue: formatKrKompakt,
      });
    }

    rateSelect.addEventListener("change", function () {
      customField.style.display = rateSelect.value === "custom" ? "" : "none";
      render();
    });
    customRate.addEventListener("input", function () {
      valCustomRate.textContent = (parseFloat(customRate.value) || 0) + " %";
      render();
    });
    syncPair(horisontEl, horisontR, render);

    render();
  });
})();
