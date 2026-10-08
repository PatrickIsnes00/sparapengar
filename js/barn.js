/* ==========================================================================
   SparaPengar — Barn & Pengar: åldersväxling, sparmål, tjäna pengar, quiz
   ========================================================================== */
(function () {
  "use strict";

  function syncPair(numEl, rangeEl, onChange) {
    function fromNum() { rangeEl.value = numEl.value; onChange(); }
    function fromRange() { numEl.value = rangeEl.value; onChange(); }
    numEl.addEventListener("input", fromNum);
    rangeEl.addEventListener("input", fromRange);
  }

  /* ---------------- Åldersväxlare ---------------- */
  function initAgeToggle(onChange) {
    const buttons = document.querySelectorAll(".age-toggle-btn");

    function currentAge() {
      return document.documentElement.getAttribute("data-barn-age") === "tonaring" ? "tonaring" : "yngre";
    }
    function applyActive() {
      const age = currentAge();
      buttons.forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-age-mode") === age); });
    }
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const mode = btn.getAttribute("data-age-mode");
        if (mode === currentAge()) return;
        document.documentElement.setAttribute("data-barn-age", mode);
        try { localStorage.setItem("sp-barn-age", mode); } catch (e) { /* no-op */ }
        applyActive();
        if (onChange) onChange(mode);
      });
    });
    applyActive();
    return { currentAge: currentAge };
  }

  /* ---------------- Sparmål-verktyget ---------------- */
  function initGoalTool() {
    const nameEl = document.getElementById("goal-name");
    const costEl = document.getElementById("goal-cost");
    const costR = document.getElementById("goal-cost-r");
    const savedEl = document.getElementById("goal-saved");
    const savedR = document.getElementById("goal-saved-r");
    const weeklyEl = document.getElementById("goal-weekly");
    const weeklyR = document.getElementById("goal-weekly-r");

    const valCost = document.getElementById("val-goal-cost");
    const valSaved = document.getElementById("val-goal-saved");
    const valWeekly = document.getElementById("val-goal-weekly");

    const fillEl = document.getElementById("goal-fill");
    const resultEl = document.getElementById("goal-result");
    const titleEl = document.getElementById("goal-chart-title");
    const canvas = document.getElementById("goal-chart");

    function render() {
      const cost = Math.max(1, parseFloat(costEl.value) || 1);
      const saved = Math.max(0, parseFloat(savedEl.value) || 0);
      const weekly = Math.max(0, parseFloat(weeklyEl.value) || 0);
      const name = nameEl.value.trim() || "din dröm";

      valCost.textContent = formatKr(cost);
      valSaved.textContent = formatKr(saved);
      valWeekly.textContent = formatKr(weekly);

      titleEl.textContent = "Så sparar du till: " + name;

      const pct = Math.min(100, (saved / cost) * 100);
      fillEl.style.width = pct + "%";

      let weeks;
      if (saved >= cost) {
        weeks = 0;
        resultEl.innerHTML = "🎉 Grattis! Du har redan sparat ihop till <strong>" + name + "</strong>!";
      } else if (weekly <= 0) {
        weeks = null;
        resultEl.innerHTML = "Ange hur mycket du kan spara i veckan för att se hur lång tid det tar.";
      } else {
        weeks = Math.ceil((cost - saved) / weekly);
        const months = Math.round((weeks / 4.345) * 10) / 10;
        resultEl.innerHTML = "Du behöver spara i <strong>" + weeks + " veckor</strong> (ca " + months + " månader) till för att nå <strong>" + name + "</strong>!";
      }

      const horizonWeeks = weeks === null ? 10 : Math.max(weeks, 1) + 2;
      const xLabels = [];
      const values = [];
      for (let w = 0; w <= horizonWeeks; w++) {
        xLabels.push("V." + w);
        values.push(Math.min(saved + weekly * w, saved + weekly * horizonWeeks));
      }

      SPCharts.renderAreaChart(canvas, {
        xLabels: xLabels,
        series: [{ label: "Sparat", color: "--series-4", values: values }],
        stacked: true,
        formatValue: formatKrKompakt,
        goalLine: { value: cost, label: "Mål: " + formatKr(cost) },
        xTickEvery: Math.max(1, Math.ceil(horizonWeeks / 8)),
      });
    }

    syncPair(costEl, costR, render);
    syncPair(savedEl, savedR, render);
    syncPair(weeklyEl, weeklyR, render);
    nameEl.addEventListener("input", render);

    render();
  }

  /* ---------------- Tjäna pengar: sysslo-checklista (yngre) ---------------- */
  const CHORES = [
    { label: "Bädda sängen", value: 5 },
    { label: "Diska efter middagen", value: 10 },
    { label: "Dammsuga ett rum", value: 15 },
    { label: "Ta ut och sortera soporna", value: 10 },
    { label: "Rensa ogräs i trädgården", value: 25 },
    { label: "Tvätta bilen", value: 40 },
    { label: "Passa syskon en kväll", value: 60 },
  ];

  function initChores() {
    const listEl = document.getElementById("chore-list");
    const totalEl = document.getElementById("chore-total-value");
    const addBtn = document.getElementById("chore-add-btn");
    if (!listEl) return;

    listEl.innerHTML = CHORES.map(function (c, i) {
      return '<div class="chore-item">' +
        '<input type="checkbox" id="chore-' + i + '">' +
        '<label for="chore-' + i + '" class="chore-label">' + c.label + "</label>" +
        '<span class="chore-value-wrap">' +
          '<input type="number" class="chore-value-input" id="chore-value-' + i + '" value="' + c.value + '" min="0" step="5" aria-label="Förslag på belopp för ' + c.label + '">' +
          " kr" +
        "</span>" +
        "</div>";
    }).join("");

    function recompute() {
      let total = 0;
      listEl.querySelectorAll(".chore-item").forEach(function (item) {
        const checkbox = item.querySelector('input[type="checkbox"]');
        const valueInput = item.querySelector(".chore-value-input");
        const checked = checkbox.checked;
        item.classList.toggle("checked", checked);
        if (checked) total += parseFloat(valueInput.value) || 0;
      });
      totalEl.textContent = formatKr(total);
      return total;
    }

    listEl.addEventListener("change", recompute);
    listEl.addEventListener("input", function (e) {
      if (e.target.classList.contains("chore-value-input")) recompute();
    });

    addBtn.addEventListener("click", function () {
      const total = recompute();
      if (total <= 0) return;
      const savedEl = document.getElementById("goal-saved");
      const newVal = (parseFloat(savedEl.value) || 0) + total;
      savedEl.value = newVal;
      savedEl.dispatchEvent(new Event("input"));

      listEl.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });
      recompute();

      const field = savedEl.closest(".field");
      if (field) field.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    recompute();
  }

  /* ---------------- Pengaquizet ---------------- */
  const QUIZ_YNGRE = [
    {
      q: "Vad händer med pengarna på ditt sparkonto om du låter dem ligga länge?",
      options: ["De blir färre", "De växer med ränta", "Inget händer alls"],
      correct: 1,
      explain: "Pengar på ett sparkonto eller i fonder kan växa med ränta eller avkastning ju längre de får ligga.",
    },
    {
      q: "Om du sparar 50 kr i veckan, hur mycket har du sparat efter 10 veckor (utan ränta)?",
      options: ["100 kr", "500 kr", "1 000 kr"],
      correct: 1,
      explain: "50 kr × 10 veckor = 500 kr.",
    },
    {
      q: "Vad är en bra idé om du får pengar som present?",
      options: ["Spendera allt direkt", "Spara en del och spendera en del", "Ge bort alla pengarna"],
      correct: 1,
      explain: "Att spara en del och unna sig en del är ofta den klokaste balansen.",
    },
    {
      q: "Vad betyder \"ränta på ränta\"?",
      options: ["Banken tar dina pengar", "Din sparade ränta börjar också växa", "Du måste betala extra avgift"],
      correct: 1,
      explain: "Ränta på ränta betyder att även avkastningen du redan fått börjar växa – det gör att sparandet accelererar över tid.",
    },
    {
      q: "Vilket är smartast om du vill köpa något dyrt, som en ny cykel?",
      options: ["Låna pengar och betala senare", "Spara lite varje vecka tills du har nog", "Vänta tills någon ger dig den"],
      correct: 1,
      explain: "Att spara lite i taget tills du når målet gör att du äger cykeln helt utan att behöva betala tillbaka något.",
    },
  ];

  const QUIZ_TONARING = [
    {
      q: "Du sparar 10 000 kr till 7% ränta per år. Ungefär hur mycket har du efter 10 år, tack vare ränta på ränta?",
      options: ["10 700 kr", "Ca 20 000 kr", "50 000 kr"],
      correct: 1,
      explain: "10 000 kr växer till ca 19 700 kr efter 10 år vid 7% årlig avkastning — nästan en fördubbling.",
    },
    {
      q: "Vad är ett UF-företag?",
      options: ["Ett företag staten äger", "Ett övningsföretag du kan starta under gymnasiet", "En typ av bank"],
      correct: 1,
      explain: "Ung Företagsamhet (UF) låter dig driva ett eget övningsföretag under ett läsår, som en del av gymnasieutbildningen.",
    },
    {
      q: "Vad är ett ISK (investeringssparkonto)?",
      options: ["Ett vanligt sparkonto med extra hög ränta", "Ett konto för aktier/fonder med en förenklad beskattning", "Ett konto bara för pensionssparande"],
      correct: 1,
      explain: "ISK är ett populärt sätt att äga fonder och aktier i Sverige, med schablonskatt istället för att betala skatt på varje enskild affär.",
    },
    {
      q: "Vad är inflation?",
      options: ["Att priserna generellt stiger över tid, så pengar köper mindre", "Att räntan på lån sänks", "Att aktiekurser alltid går upp"],
      correct: 0,
      explain: "Inflation gör att samma summa pengar köper mindre i framtiden — ett skäl till att pengar som bara ligger stilla långsamt tappar köpkraft.",
    },
    {
      q: "Du får ditt första extrajobb. Vad händer automatiskt med en del av lönen?",
      options: ["Den sätts automatiskt in på ett sparkonto", "Skatt dras innan du får lönen utbetald", "Inget, du får hela beloppet kontant"],
      correct: 1,
      explain: "Arbetsgivaren drar skatt direkt från din bruttolön — det du får utbetalt är din nettolön.",
    },
  ];

  function getBadge(score, total) {
    const ratio = total > 0 ? score / total : 0;
    if (ratio >= 0.8) return { emoji: "🏆", title: "Sparmästare" };
    if (ratio >= 0.4) return { emoji: "💪", title: "Sparkämpe" };
    return { emoji: "🌱", title: "Sparnybörjare" };
  }

  function bestScoreKey(age) { return "sp-barn-best-" + age; }

  function readBest(age) {
    try {
      const raw = localStorage.getItem(bestScoreKey(age));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeBestIfBetter(age, score, total) {
    try {
      const prev = readBest(age);
      if (!prev || score > prev.score) {
        localStorage.setItem(bestScoreKey(age), JSON.stringify({ score: score, total: total }));
      }
    } catch (e) { /* no-op */ }
  }

  function initQuiz(ageToggle) {
    const progressEl = document.getElementById("quiz-progress");
    const qEl = document.getElementById("quiz-question");
    const optsEl = document.getElementById("quiz-options");
    const feedbackEl = document.getElementById("quiz-feedback");
    const bestEl = document.getElementById("quiz-best");

    let idx = 0, score = 0, answered = false, quizSet = [];

    function updateBestDisplay() {
      const age = ageToggle.currentAge();
      const best = readBest(age);
      if (!best) { bestEl.textContent = ""; return; }
      const badge = getBadge(best.score, best.total);
      bestEl.textContent = "Ditt bästa resultat: " + badge.emoji + " " + badge.title + " (" + best.score + "/" + best.total + ")";
    }

    function showQuestion() {
      answered = false;
      feedbackEl.textContent = "";

      if (idx >= quizSet.length) {
        const total = quizSet.length;
        const badge = getBadge(score, total);
        writeBestIfBetter(ageToggle.currentAge(), score, total);
        updateBestDisplay();

        progressEl.textContent = "Klart!";
        qEl.innerHTML = "";
        feedbackEl.textContent = "";
        optsEl.innerHTML =
          '<div class="diploma-name-field">' +
            '<label for="diploma-name" style="font-weight:600;font-size:0.85rem;">Ditt namn (frivilligt, visas på diplomet)</label>' +
            '<input type="text" id="diploma-name" placeholder="Ditt namn">' +
          "</div>" +
          '<div class="diploma-card" id="diploma-print-area">' +
            '<div class="badge-emoji">' + badge.emoji + "</div>" +
            '<h3 id="diploma-greeting">Grattis!</h3>' +
            '<div style="font-weight:800;font-size:1.1rem;margin-top:2px;">' + badge.title + "</div>" +
            '<div class="diploma-score">Du fick ' + score + " av " + total + " rätt i SparaPengars pengaquiz.</div>" +
          "</div>" +
          '<div class="diploma-actions">' +
            '<button type="button" class="btn btn-secondary" id="quiz-print-btn">🖨️ Skriv ut ditt diplom</button>' +
            '<button type="button" class="btn btn-primary" id="quiz-restart-btn">Försök igen 🔁</button>' +
          "</div>";

        document.getElementById("diploma-name").addEventListener("input", function (e) {
          const name = e.target.value.trim();
          document.getElementById("diploma-greeting").textContent = name ? "Grattis, " + name + "!" : "Grattis!";
        });
        document.getElementById("quiz-print-btn").addEventListener("click", function () { window.print(); });
        document.getElementById("quiz-restart-btn").addEventListener("click", function () {
          idx = 0; score = 0; showQuestion();
        });
        return;
      }

      const item = quizSet[idx];
      progressEl.textContent = "Fråga " + (idx + 1) + " av " + quizSet.length + " · Poäng: " + score;
      qEl.textContent = item.q;
      optsEl.innerHTML = item.options.map(function (opt, i) {
        return '<button class="quiz-option" data-i="' + i + '">' + opt + "</button>";
      }).join("");

      optsEl.querySelectorAll(".quiz-option").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (answered) return;
          answered = true;
          const chosen = parseInt(btn.getAttribute("data-i"), 10);
          const correct = item.correct;
          optsEl.querySelectorAll(".quiz-option").forEach(function (b, i) {
            if (i === correct) b.classList.add("correct");
            else if (i === chosen) b.classList.add("wrong");
          });
          if (chosen === correct) {
            score++;
            feedbackEl.innerHTML = "✅ Rätt! " + item.explain;
          } else {
            feedbackEl.innerHTML = "❌ Inte riktigt. " + item.explain;
          }
          setTimeout(function () { idx++; showQuestion(); }, 1800);
        });
      });
    }

    function start() {
      quizSet = ageToggle.currentAge() === "tonaring" ? QUIZ_TONARING : QUIZ_YNGRE;
      idx = 0; score = 0;
      updateBestDisplay();
      showQuestion();
    }

    start();
    return { restart: start };
  }

  document.addEventListener("DOMContentLoaded", function () {
    initGoalTool();
    initChores();
    const ageToggle = initAgeToggle(function () {
      quizHandle.restart();
    });
    const quizHandle = initQuiz(ageToggle);
  });
})();
