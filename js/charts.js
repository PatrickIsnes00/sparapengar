/* ==========================================================================
   Guldgrisen — delat diagram-bibliotek (canvas, inga externa beroenden)
   Mark-specs: 2px linjer, 4px rundade stapeltoppar, hairline-gridlines,
   area-fill ~10% opacitet, legend för 2+ serier, hover-tooltip + crosshair.
   ========================================================================== */

(function (global) {
  "use strict";

  const SPCharts = { _registry: [] };

  function redrawAll() {
    SPCharts._registry.forEach(function (fn) {
      try { fn(); } catch (e) { /* no-op */ }
    });
  }
  SPCharts.redrawAll = redrawAll;

  document.addEventListener("sp-theme-changed", redrawAll);
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", redrawAll);
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || name;
  }
  SPCharts.cssVar = cssVar;

  function hexToRgba(hex, alpha) {
    const h = hex.replace("#", "");
    const bigint = parseInt(h.length === 3
      ? h.split("").map(function (c) { return c + c; }).join("")
      : h, 16);
    const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function niceCeil(value) {
    if (value <= 0) return 10;
    const exp = Math.floor(Math.log10(value));
    const base = Math.pow(10, exp);
    const frac = value / base;
    let niceFrac;
    if (frac <= 1) niceFrac = 1;
    else if (frac <= 2) niceFrac = 2;
    else if (frac <= 5) niceFrac = 5;
    else niceFrac = 10;
    return niceFrac * base;
  }

  function fmtDefault(n) {
    return Math.round(n).toLocaleString("sv-SE");
  }

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(240, rect.width);
    const h = Math.max(180, rect.height || 320);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function buildLegend(container, items) {
    if (!container) return;
    container.innerHTML = "";
    items.forEach(function (it) {
      const span = document.createElement("span");
      span.className = "key";
      const sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.background = it.color;
      span.appendChild(sw);
      span.appendChild(document.createTextNode(it.label));
      container.appendChild(span);
    });
  }
  SPCharts.buildLegend = buildLegend;

  function getTooltipEl(wrap) {
    let el = wrap.querySelector(".chart-tooltip");
    if (!el) {
      el = document.createElement("div");
      el.className = "chart-tooltip";
      el.setAttribute("role", "status");
      wrap.appendChild(el);
    }
    return el;
  }

  function showTooltip(el, wrap, x, y, html) {
    el.innerHTML = html;
    el.style.left = x + "px";
    el.style.top = Math.max(60, y) + "px";
    el.classList.add("visible");
  }
  function hideTooltip(el) { el.classList.remove("visible"); }

  function debounceRaf(fn) {
    let scheduled = false;
    return function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () { scheduled = false; fn(); });
    };
  }

  /* ------------------------------------------------------------------
     Stacked / single area-line chart (tidsserie)
     config: {
       xLabels: string[], series: [{label,color,values:number[]}],
       stacked: bool, legendEl, formatValue(n), formatX(label),
       goalLine: {value,label} (optional), xTickEvery (optional)
     }
  ------------------------------------------------------------------ */
  function renderAreaChart(canvas, config) {
    const wrap = canvas.parentElement;
    wrap.style.position = "relative";
    const tooltipEl = getTooltipEl(wrap);
    const fmt = config.formatValue || fmtDefault;
    const series = config.series;
    const n = config.xLabels.length;

    if (config.legendEl && series.length > 1) {
      buildLegend(config.legendEl, series.map(function (s) { return { label: s.label, color: cssVar(s.color) }; }));
    } else if (config.legendEl) {
      config.legendEl.innerHTML = "";
    }

    let hoverIdx = null;
    let geom = null;

    function draw() {
      const cs = setupCanvas(canvas);
      const ctx = cs.ctx, w = cs.w, h = cs.h;
      ctx.clearRect(0, 0, w, h);

      const textMuted = cssVar("--text-muted");
      const textSecondary = cssVar("--text-secondary");
      const grid = cssVar("--grid");
      const axis = cssVar("--axis");

      const marginL = 64, marginR = 16, marginT = 18, marginB = 30;
      const plotW = w - marginL - marginR;
      const plotH = h - marginT - marginB;

      // totals per point (stacked sum or max of single series)
      const totals = [];
      for (let i = 0; i < n; i++) {
        let sum = 0;
        series.forEach(function (s) { sum += s.values[i] || 0; });
        totals.push(sum);
      }
      let maxVal = Math.max.apply(null, totals.concat(config.goalLine ? [config.goalLine.value] : []));
      maxVal = niceCeil(maxVal * 1.08 || 10);
      const tickCount = 5;

      function yFor(v) { return marginT + plotH - (v / maxVal) * plotH; }
      function xFor(i) { return marginL + (n === 1 ? 0 : (i / (n - 1)) * plotW); }

      // gridlines + y labels
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = textMuted;
      ctx.textBaseline = "middle";
      for (let t = 0; t <= tickCount; t++) {
        const v = (maxVal / tickCount) * t;
        const y = yFor(v);
        ctx.beginPath();
        ctx.moveTo(marginL, Math.round(y) + 0.5);
        ctx.lineTo(w - marginR, Math.round(y) + 0.5);
        ctx.stroke();
        ctx.textAlign = "right";
        ctx.fillText(fmt(v), marginL - 10, y);
      }

      // x labels (thinned)
      const everyN = config.xTickEvery || Math.max(1, Math.ceil(n / 9));
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = textMuted;
      for (let i = 0; i < n; i++) {
        if (i % everyN !== 0 && i !== n - 1) continue;
        ctx.fillText(config.xLabels[i], xFor(i), h - marginB + 8);
      }

      // stacked areas
      let cumulative = new Array(n).fill(0);
      series.forEach(function (s) {
        const color = cssVar(s.color);
        const topPoints = [];
        for (let i = 0; i < n; i++) {
          cumulative[i] += (s.values[i] || 0);
          topPoints.push(cumulative[i]);
        }
        // fill between previous cumulative (base) and new cumulative (top)
        const basePoints = topPoints.map(function (v, i) { return v - (s.values[i] || 0); });

        ctx.beginPath();
        ctx.moveTo(xFor(0), yFor(basePoints[0]));
        for (let i = 0; i < n; i++) ctx.lineTo(xFor(i), yFor(topPoints[i]));
        for (let i = n - 1; i >= 0; i--) ctx.lineTo(xFor(i), yFor(basePoints[i]));
        ctx.closePath();
        ctx.fillStyle = hexToRgba(color, 0.14);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(xFor(0), yFor(topPoints[0]));
        for (let i = 1; i < n; i++) ctx.lineTo(xFor(i), yFor(topPoints[i]));
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
      });

      // goal line
      if (config.goalLine) {
        const gy = yFor(config.goalLine.value);
        ctx.setLineDash([]);
        ctx.strokeStyle = axis;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(marginL, Math.round(gy) + 0.5);
        ctx.lineTo(w - marginR, Math.round(gy) + 0.5);
        ctx.stroke();
        ctx.fillStyle = textSecondary;
        ctx.font = "700 11px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(config.goalLine.label, w - marginR, gy - 4);
      }

      // hover crosshair + end point dots
      const lastIdx = n - 1;
      series.forEach(function (s, si) {
        const color = cssVar(s.color);
        // end dot at last cumulative for this series
        let endCum = 0;
        for (let k = 0; k <= si; k++) endCum += (series[k].values[lastIdx] || 0);
        const ex = xFor(lastIdx), ey = yFor(endCum);
        ctx.beginPath();
        ctx.arc(ex, ey, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = cssVar("--surface-chart");
        ctx.stroke();
      });

      if (hoverIdx !== null) {
        const hx = xFor(hoverIdx);
        ctx.beginPath();
        ctx.moveTo(hx, marginT);
        ctx.lineTo(hx, h - marginB);
        ctx.strokeStyle = axis;
        ctx.lineWidth = 1;
        ctx.stroke();

        let cum = 0;
        series.forEach(function (s) {
          cum += (s.values[hoverIdx] || 0);
          const color = cssVar(s.color);
          const py = yFor(cum);
          ctx.beginPath();
          ctx.arc(hx, py, 5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = cssVar("--surface-chart");
          ctx.stroke();
        });
      }

      geom = { marginL: marginL, marginR: marginR, plotW: plotW, w: w, xFor: xFor };
    }

    const redraw = debounceRaf(draw);
    new ResizeObserver(redraw).observe(wrap);
    draw();
    SPCharts._registry.push(draw);

    canvas.addEventListener("mousemove", function (e) {
      if (!geom) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      let idx = Math.round(((mx - geom.marginL) / geom.plotW) * (n - 1));
      idx = Math.max(0, Math.min(n - 1, idx));
      hoverIdx = idx;
      draw();
      let rows = series.map(function (s) {
        return '<div><strong>' + s.label + ':</strong> ' + fmt(s.values[idx] || 0) + ' kr</div>';
      }).join("");
      let total = 0;
      series.forEach(function (s) { total += (s.values[idx] || 0); });
      const html = '<div style="margin-bottom:4px;font-weight:700;">' + config.xLabels[idx] + '</div>' +
        rows + (series.length > 1 ? '<div style="margin-top:4px;border-top:1px solid rgba(255,255,255,0.25);padding-top:4px;"><strong>Totalt:</strong> ' + fmt(total) + ' kr</div>' : "");
      showTooltip(tooltipEl, wrap, mx, (e.clientY - rect.top) - 10, html);
    });
    canvas.addEventListener("mouseleave", function () {
      hoverIdx = null;
      hideTooltip(tooltipEl);
      draw();
    });
  }
  SPCharts.renderAreaChart = renderAreaChart;

  /* ------------------------------------------------------------------
     Flera fristående linjer (ej staplade) — t.ex. jämföra två scenarier
     config: { xLabels, series: [{label,color,values}], legendEl, formatValue, xTickEvery }
  ------------------------------------------------------------------ */
  function renderLineChart(canvas, config) {
    const wrap = canvas.parentElement;
    wrap.style.position = "relative";
    const tooltipEl = getTooltipEl(wrap);
    const fmt = config.formatValue || fmtDefault;
    const series = config.series;
    const n = config.xLabels.length;

    if (config.legendEl && series.length > 1) {
      buildLegend(config.legendEl, series.map(function (s) { return { label: s.label, color: cssVar(s.color) }; }));
    } else if (config.legendEl) {
      config.legendEl.innerHTML = "";
    }

    let hoverIdx = null;
    let geom = null;

    function draw() {
      const cs = setupCanvas(canvas);
      const ctx = cs.ctx, w = cs.w, h = cs.h;
      ctx.clearRect(0, 0, w, h);

      const textMuted = cssVar("--text-muted");
      const grid = cssVar("--grid");
      const axis = cssVar("--axis");

      const marginL = 64, marginR = 16, marginT = 18, marginB = 30;
      const plotW = w - marginL - marginR;
      const plotH = h - marginT - marginB;

      let maxVal = 0;
      series.forEach(function (s) { s.values.forEach(function (v) { maxVal = Math.max(maxVal, v || 0); }); });
      maxVal = niceCeil(maxVal * 1.08 || 10);
      const tickCount = 5;

      function yFor(v) { return marginT + plotH - (v / maxVal) * plotH; }
      function xFor(i) { return marginL + (n === 1 ? 0 : (i / (n - 1)) * plotW); }

      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = textMuted;
      ctx.textBaseline = "middle";
      for (let t = 0; t <= tickCount; t++) {
        const v = (maxVal / tickCount) * t;
        const y = yFor(v);
        ctx.beginPath();
        ctx.moveTo(marginL, Math.round(y) + 0.5);
        ctx.lineTo(w - marginR, Math.round(y) + 0.5);
        ctx.stroke();
        ctx.textAlign = "right";
        ctx.fillText(fmt(v), marginL - 10, y);
      }

      const everyN = config.xTickEvery || Math.max(1, Math.ceil(n / 9));
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = textMuted;
      for (let i = 0; i < n; i++) {
        if (i % everyN !== 0 && i !== n - 1) continue;
        ctx.fillText(config.xLabels[i], xFor(i), h - marginB + 8);
      }

      series.forEach(function (s) {
        const color = cssVar(s.color);

        ctx.beginPath();
        ctx.moveTo(xFor(0), yFor(0));
        for (let i = 0; i < n; i++) ctx.lineTo(xFor(i), yFor(s.values[i] || 0));
        ctx.lineTo(xFor(n - 1), yFor(0));
        ctx.closePath();
        ctx.fillStyle = hexToRgba(color, 0.08);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(xFor(0), yFor(s.values[0] || 0));
        for (let i = 1; i < n; i++) ctx.lineTo(xFor(i), yFor(s.values[i] || 0));
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();

        const lastIdx = n - 1;
        ctx.beginPath();
        ctx.arc(xFor(lastIdx), yFor(s.values[lastIdx] || 0), 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = cssVar("--surface-chart");
        ctx.stroke();
      });

      if (hoverIdx !== null) {
        const hx = xFor(hoverIdx);
        ctx.beginPath();
        ctx.moveTo(hx, marginT);
        ctx.lineTo(hx, h - marginB);
        ctx.strokeStyle = axis;
        ctx.lineWidth = 1;
        ctx.stroke();

        series.forEach(function (s) {
          const color = cssVar(s.color);
          const py = yFor(s.values[hoverIdx] || 0);
          ctx.beginPath();
          ctx.arc(hx, py, 5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = cssVar("--surface-chart");
          ctx.stroke();
        });
      }

      geom = { marginL: marginL, plotW: plotW };
    }

    const redraw = debounceRaf(draw);
    new ResizeObserver(redraw).observe(wrap);
    draw();
    SPCharts._registry.push(draw);

    canvas.addEventListener("mousemove", function (e) {
      if (!geom) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      let idx = Math.round(((mx - geom.marginL) / geom.plotW) * (n - 1));
      idx = Math.max(0, Math.min(n - 1, idx));
      hoverIdx = idx;
      draw();
      const rows = series.map(function (s) {
        return '<div><strong>' + s.label + ':</strong> ' + fmt(s.values[idx] || 0) + ' kr</div>';
      }).join("");
      showTooltip(tooltipEl, wrap, mx, (e.clientY - rect.top) - 10,
        '<div style="margin-bottom:4px;font-weight:700;">' + config.xLabels[idx] + '</div>' + rows);
    });
    canvas.addEventListener("mouseleave", function () {
      hoverIdx = null;
      hideTooltip(tooltipEl);
      draw();
    });
  }
  SPCharts.renderLineChart = renderLineChart;

  /* ------------------------------------------------------------------
     Horisontell grupperad stapel (t.ex. nuvarande kostnad vs besparing)
     config: { categories: string[], series: [{label,color,values}], legendEl, formatValue }
  ------------------------------------------------------------------ */
  function renderGroupedBarChart(canvas, config) {
    const wrap = canvas.parentElement;
    wrap.style.position = "relative";
    const tooltipEl = getTooltipEl(wrap);
    const fmt = config.formatValue || fmtDefault;
    const categories = config.categories;
    const series = config.series;
    const nCat = categories.length;

    if (config.legendEl) {
      buildLegend(config.legendEl, series.map(function (s) { return { label: s.label, color: cssVar(s.color) }; }));
    }

    let hoverRow = null;
    let geom = null;

    function draw() {
      const rowH = 46;
      canvas.style.height = (nCat * rowH + 30) + "px";
      const cs = setupCanvas(canvas);
      const ctx = cs.ctx, w = cs.w, h = cs.h;
      ctx.clearRect(0, 0, w, h);

      const textMuted = cssVar("--text-muted");
      const textPrimary = cssVar("--text-primary");
      const grid = cssVar("--grid");

      const labelColW = 150;
      const marginR = 16, marginT = 10, marginB = 20;
      const plotW = w - labelColW - marginR;
      let maxVal = 0;
      categories.forEach(function (_, i) {
        series.forEach(function (s) { maxVal = Math.max(maxVal, s.values[i] || 0); });
      });
      maxVal = niceCeil(maxVal * 1.15 || 10);

      function xFor(v) { return labelColW + (v / maxVal) * plotW; }

      // vertical gridlines (4 ticks)
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.font = "11px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = textMuted;
      ctx.textAlign = "center";
      for (let t = 0; t <= 4; t++) {
        const v = (maxVal / 4) * t;
        const x = xFor(v);
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, marginT);
        ctx.lineTo(Math.round(x) + 0.5, h - marginB);
        ctx.stroke();
        ctx.fillText(fmt(v), x, h - marginB + 14);
      }

      const barH = 14;
      const groupGap = 6;
      categories.forEach(function (cat, i) {
        const groupTop = marginT + i * rowH;
        const groupCenter = groupTop + rowH / 2;

        ctx.fillStyle = textPrimary;
        ctx.font = "600 12.5px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(cat, 0, groupCenter, labelColW - 14);

        const totalBarsH = series.length * barH + (series.length - 1) * 3;
        let y = groupCenter - totalBarsH / 2;

        series.forEach(function (s) {
          const v = s.values[i] || 0;
          const color = cssVar(s.color);
          const bw = Math.max(0, (v / maxVal) * plotW);
          const isHover = hoverRow === i;
          ctx.fillStyle = isHover ? hexToRgba(color, 1) : hexToRgba(color, 0.88);
          roundRectRight(ctx, labelColW, y, bw, barH, 4);
          ctx.fill();
          y += barH + 3;
        });

        if (hoverRow === i) {
          ctx.fillStyle = hexToRgba(cssVar("--text-primary"), 0.04);
          ctx.fillRect(0, groupTop, w, rowH);
        }
      });

      geom = { labelColW: labelColW, plotW: plotW, rowH: rowH, marginT: marginT, nCat: nCat };
    }

    function roundRectRight(ctx, x, y, w, h, r) {
      if (w <= 0) { return; }
      r = Math.min(r, w, h / 2);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x, y + h);
      ctx.closePath();
    }

    const redraw = debounceRaf(draw);
    new ResizeObserver(redraw).observe(wrap);
    draw();
    SPCharts._registry.push(draw);

    canvas.addEventListener("mousemove", function (e) {
      if (!geom) return;
      const rect = canvas.getBoundingClientRect();
      const my = e.clientY - rect.top;
      let idx = Math.floor((my - geom.marginT) / geom.rowH);
      idx = Math.max(0, Math.min(geom.nCat - 1, idx));
      if (idx !== hoverRow) { hoverRow = idx; draw(); }
      const rows = series.map(function (s) {
        return '<div><strong>' + s.label + ':</strong> ' + fmt(s.values[idx] || 0) + ' kr</div>';
      }).join("");
      showTooltip(tooltipEl, wrap, e.clientX - rect.left, my - 10,
        '<div style="margin-bottom:4px;font-weight:700;">' + categories[idx] + '</div>' + rows);
    });
    canvas.addEventListener("mouseleave", function () {
      hoverRow = null;
      hideTooltip(tooltipEl);
      draw();
    });
  }
  SPCharts.renderGroupedBarChart = renderGroupedBarChart;

  /* ------------------------------------------------------------------
     Enkel vertikal stapel, en serie, med direkt-etikett ovanför stapeln
     config: { labels, values, color, formatValue }
  ------------------------------------------------------------------ */
  function renderBarChart(canvas, config) {
    const wrap = canvas.parentElement;
    wrap.style.position = "relative";
    const tooltipEl = getTooltipEl(wrap);
    const fmt = config.formatValue || fmtDefault;
    const labels = config.labels, values = config.values;
    const n = labels.length;
    let hoverIdx = null;
    let geom = null;

    function draw() {
      const cs = setupCanvas(canvas);
      const ctx = cs.ctx, w = cs.w, h = cs.h;
      ctx.clearRect(0, 0, w, h);

      const textMuted = cssVar("--text-muted");
      const textPrimary = cssVar("--text-primary");
      const grid = cssVar("--grid");
      const color = cssVar(config.color);

      const marginL = 10, marginR = 10, marginT = 30, marginB = 28;
      const plotW = w - marginL - marginR;
      const plotH = h - marginT - marginB;
      const maxVal = niceCeil(Math.max.apply(null, values) * 1.2 || 10);

      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(marginL, h - marginB + 0.5);
      ctx.lineTo(w - marginR, h - marginB + 0.5);
      ctx.stroke();

      const slot = plotW / n;
      const barW = Math.min(44, slot * 0.5);

      for (let i = 0; i < n; i++) {
        const cx = marginL + slot * (i + 0.5);
        const barH = (values[i] / maxVal) * plotH;
        const y = h - marginB - barH;
        const isHover = hoverIdx === i;
        ctx.fillStyle = isHover ? color : hexToRgba(color, 0.85);
        roundTopRect(ctx, cx - barW / 2, y, barW, barH, 4);
        ctx.fill();

        ctx.fillStyle = textPrimary;
        ctx.font = "700 12px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(fmt(values[i]), cx, y - 6);

        ctx.fillStyle = textMuted;
        ctx.font = "600 12px system-ui, -apple-system, sans-serif";
        ctx.textBaseline = "top";
        ctx.fillText(labels[i], cx, h - marginB + 8);
      }

      geom = { marginL: marginL, slot: slot, n: n };
    }

    function roundTopRect(ctx, x, y, w, h, r) {
      h = Math.max(h, 1);
      r = Math.min(r, w / 2, h);
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
    }

    const redraw = debounceRaf(draw);
    new ResizeObserver(redraw).observe(wrap);
    draw();
    SPCharts._registry.push(draw);

    canvas.addEventListener("mousemove", function (e) {
      if (!geom) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      let idx = Math.floor((mx - geom.marginL) / geom.slot);
      idx = Math.max(0, Math.min(geom.n - 1, idx));
      hoverIdx = idx;
      draw();
      showTooltip(tooltipEl, wrap, mx, e.clientY - rect.top - 10,
        '<div><strong>' + labels[idx] + ':</strong> ' + fmt(values[idx]) + ' kr</div>');
    });
    canvas.addEventListener("mouseleave", function () {
      hoverIdx = null;
      hideTooltip(tooltipEl);
      draw();
    });
  }
  SPCharts.renderBarChart = renderBarChart;

  global.SPCharts = SPCharts;
})(window);
