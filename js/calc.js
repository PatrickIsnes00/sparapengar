/* ==========================================================================
   SparaPengar — delad beräkningslogik (ränta-på-ränta m.m.)
   Används av ranta.js, budget.js och barn.js
   ========================================================================== */

/**
 * Simulerar sparande månad för månad med ränta-på-ränta-effekt.
 * @param {Object} p
 * @param {number} p.startkapital   kr, startbelopp
 * @param {number} p.manadssparande kr/månad, insättning
 * @param {number} p.ranta          årlig avkastning i %, t.ex. 7 för 7%
 * @param {number} p.ar             antal år att simulera
 * @param {number} [p.okningPerAr]  % årlig höjning av månadssparandet (0 = ingen höjning)
 * @returns {Array<{manad:number, ar:number, insatt:number, varde:number, ranta:number}>}
 *   En rad per år (vid årsslut), plus startpunkten (år 0).
 */
function simuleraSparande(p) {
  const startkapital = Math.max(0, p.startkapital || 0);
  const ranta = (p.ranta || 0) / 100;
  const manadsRanta = Math.pow(1 + ranta, 1 / 12) - 1;
  const ar = Math.max(0, Math.round(p.ar || 0));
  const okningPerAr = (p.okningPerAr || 0) / 100;

  let varde = startkapital;
  let insatt = startkapital;
  let manadssparande = Math.max(0, p.manadssparande || 0);

  const rows = [{ manad: 0, ar: 0, insatt: insatt, varde: varde, ranta: 0 }];

  for (let y = 1; y <= ar; y++) {
    for (let m = 1; m <= 12; m++) {
      varde = varde * (1 + manadsRanta) + manadssparande;
      insatt += manadssparande;
    }
    rows.push({
      manad: y * 12,
      ar: y,
      insatt: Math.round(insatt),
      varde: Math.round(varde),
      ranta: Math.round(varde - insatt),
    });
    // höj månadssparandet inför nästa år
    manadssparande = manadssparande * (1 + okningPerAr);
  }
  return rows;
}

/**
 * Räknar ut hur många månader det tar att nå ett sparmål,
 * givet start, månadssparande och ränta. Används i barnsektionen.
 * @returns {number|null} antal månader, eller null om målet aldrig nås (0-ränta, 0-sparande)
 */
function manaderTillMal(p) {
  const mal = p.mal || 0;
  const start = p.startkapital || 0;
  if (start >= mal) return 0;
  const ranta = (p.ranta || 0) / 100;
  const manadsRanta = Math.pow(1 + ranta, 1 / 12) - 1;
  const sparande = Math.max(0, p.manadssparande || 0);

  if (sparande <= 0 && manadsRanta <= 0) return null;

  let varde = start;
  for (let m = 1; m <= 1200; m++) { // max 100 år skydd
    varde = varde * (1 + manadsRanta) + sparande;
    if (varde >= mal) return m;
  }
  return null;
}

/**
 * Simulerar avbetalning av flera lån/krediter samtidigt, månad för månad.
 * @param {Object} p
 * @param {Array<{skuld:number, ranta:number, betalning:number}>} p.lan  ränta i % per år, betalning i kr/mån
 * @param {number}  [p.extra]      kr/månad extra som läggs på lånet som prioriteras enligt strategin
 * @param {boolean} [p.rullaOver]  true = när ett lån är betalt flyttas dess månadsbetalning till nästa lån
 * @param {string}  [p.strategi]   "lavin" (högst ränta först) eller "snoboll" (minst skuld först)
 * @returns {{rows:Array<{manad:number, kvar:number}>, manader:number, totalRanta:number, totalBetalt:number,
 *   omojligt:boolean, perLan:Array<{klarManad:number|null, ranta:number}>}}
 *   omojligt = true om skulden inte blir betald inom 100 år
 */
function simuleraFleraLan(p) {
  const lan = (p.lan || []).map(function (l) {
    return { skuld: Math.max(0, l.skuld || 0), manadsRanta: (l.ranta || 0) / 100 / 12, betalning: Math.max(0, l.betalning || 0) };
  });
  const extra = Math.max(0, p.extra || 0);
  const rullaOver = !!p.rullaOver;
  const kvar = lan.map(function (l) { return l.skuld; });
  const perLan = lan.map(function (l) { return { klarManad: l.skuld > 0 ? null : 0, ranta: 0 }; });
  const summa = function () { return kvar.reduce(function (a, b) { return a + b; }, 0); };

  let totalRanta = 0, totalBetalt = 0, manad = 0;
  const rows = [{ manad: 0, kvar: Math.round(summa()) }];

  function betala(i, belopp) {
    const bet = Math.min(belopp, kvar[i]);
    kvar[i] -= bet;
    totalBetalt += bet;
    if (kvar[i] <= 0.005) { kvar[i] = 0; if (perLan[i].klarManad === null) perLan[i].klarManad = manad; }
    return bet;
  }

  while (summa() > 0.005 && manad < 1200) {
    manad++;
    let pott = extra;
    lan.forEach(function (l, i) {
      if (kvar[i] <= 0) { if (rullaOver) pott += l.betalning; return; }
      const ranta = kvar[i] * l.manadsRanta;
      kvar[i] += ranta;
      perLan[i].ranta += ranta;
      totalRanta += ranta;
      const bet = betala(i, l.betalning);
      if (rullaOver) pott += l.betalning - bet;
    });

    // Fördela potten (extra + frigjorda betalningar) enligt strategin
    const ordning = lan.map(function (_, i) { return i; }).filter(function (i) { return kvar[i] > 0; });
    ordning.sort(p.strategi === "snoboll"
      ? function (a, b) { return kvar[a] - kvar[b]; }
      : function (a, b) { return lan[b].manadsRanta - lan[a].manadsRanta || kvar[a] - kvar[b]; });
    for (let k = 0; k < ordning.length && pott > 0.005; k++) pott -= betala(ordning[k], pott);

    rows.push({ manad: manad, kvar: Math.round(summa()) });
  }

  perLan.forEach(function (x) { x.ranta = Math.round(x.ranta); });
  return { rows: rows, manader: manad, totalRanta: Math.round(totalRanta), totalBetalt: Math.round(totalBetalt), omojligt: summa() > 0.005, perLan: perLan };
}

/**
 * Svenskt amorteringskrav utifrån belåningsgrad: över 70 % → 2 %/år, över 50 % → 1 %/år, annars inget krav.
 * @param {number} belaningsgrad andel, t.ex. 0.83
 * @returns {number} andel av ursprungligt lånebelopp per år (0, 0.01 eller 0.02)
 */
function amorteringskravProcent(belaningsgrad) {
  if (belaningsgrad > 0.7) return 0.02;
  if (belaningsgrad > 0.5) return 0.01;
  return 0;
}

/**
 * Simulerar ett lån med fast löptid (t.ex. bolån) månad för månad.
 * @param {Object} p
 * @param {number} p.belopp  kr, lånebelopp vid start
 * @param {number} p.ranta   årlig ränta i %, t.ex. 3.5
 * @param {number} p.ar      löptid i år (t.ex. 30 eller 50). För typ "krav": hur många år som simuleras.
 * @param {string} p.typ     "rak" (fast amortering, sjunkande månadskostnad), "annuitet" (fast månadskostnad)
 *                           eller "krav" (amortera bara det amorteringskravet kräver)
 * @param {number} [p.varde] kr, bostadens värde. Om angivet gäller amorteringskravet som lägsta amortering.
 * @param {number} [p.extra] kr/månad, extra amortering utöver planen
 * @returns {{rows:Array<{manad:number, kvar:number, ranta:number, betalning:number}>, manader:number,
 *   totalRanta:number, totalBetalt:number, forstaBetalning:number, skuldfri:boolean, kvarVidSlut:number, kravStyr:boolean}}
 *   kravStyr = true om amorteringskravet någon månad krävde mer än planen
 */
function simuleraLan(p) {
  const belopp = Math.max(0, p.belopp || 0);
  const manadsRanta = (p.ranta || 0) / 100 / 12;
  const n = Math.max(1, Math.round((p.ar || 0) * 12));
  const extra = Math.max(0, p.extra || 0);
  const varde = Math.max(0, p.varde || 0);

  if (belopp <= 0) {
    return { rows: [{ manad: 0, kvar: 0, ranta: 0, betalning: 0 }], manader: 0, totalRanta: 0, totalBetalt: 0, forstaBetalning: 0, skuldfri: true, kvarVidSlut: 0, kravStyr: false };
  }

  const annuitet = manadsRanta > 0
    ? belopp * manadsRanta / (1 - Math.pow(1 + manadsRanta, -n))
    : belopp / n;
  const rakAmortering = belopp / n;

  let kvar = belopp;
  let totalRanta = 0, totalBetalt = 0, manad = 0, forstaBetalning = 0, kravStyr = false;
  const rows = [{ manad: 0, kvar: Math.round(kvar), ranta: 0, betalning: 0 }];
  // Med bara amorteringskravet kan lånet ligga kvar för evigt (inget krav under 50 %) — simulera då löptiden ut
  const maxManader = p.typ === "krav" ? n : 1200;

  while (kvar > 0.005 && manad < maxManader) {
    manad++;
    const ranta = kvar * manadsRanta;
    const krav = varde > 0 ? amorteringskravProcent(kvar / varde) * belopp / 12 : 0;
    let amortering = p.typ === "krav" ? krav : p.typ === "annuitet" ? annuitet - ranta : rakAmortering;
    if (amortering < krav - 0.005) { amortering = krav; kravStyr = true; }
    amortering = Math.min(kvar, amortering + extra);
    const betalning = ranta + amortering;
    kvar = Math.max(0, kvar - amortering);
    totalRanta += ranta;
    totalBetalt += betalning;
    if (manad === 1) forstaBetalning = betalning;
    rows.push({ manad: manad, kvar: Math.round(kvar), ranta: ranta, betalning: betalning });
  }

  const skuldfri = kvar <= 0.005;
  return {
    rows: rows, manader: manad, totalRanta: Math.round(totalRanta), totalBetalt: Math.round(totalBetalt),
    forstaBetalning: Math.round(forstaBetalning), skuldfri: skuldfri, kvarVidSlut: skuldfri ? 0 : Math.round(kvar), kravStyr: kravStyr,
  };
}

/**
 * Ungefärligt svenskt ränteavdrag för ett års räntekostnad: 30 % upp till 100 000 kr, 21 % på överskjutande del.
 * @param {number} arsRanta kr, räntekostnad under ett år
 * @returns {number} kr
 */
function ranteavdragForAr(arsRanta) {
  return Math.min(arsRanta, 100000) * 0.3 + Math.max(0, arsRanta - 100000) * 0.21;
}

/**
 * Ungefärligt svenskt ränteavdrag över hela lånets livstid (se ranteavdragForAr).
 * @param {Array<{manad:number, ranta:number}>} rows månadsrader från simuleraLan
 * @returns {number} kr, totalt skatteavdrag över lånets livstid
 */
function uppskattaRanteavdrag(rows) {
  const perAr = {};
  rows.forEach(function (r) {
    if (r.manad === 0) return;
    const ar = Math.ceil(r.manad / 12);
    perAr[ar] = (perAr[ar] || 0) + r.ranta;
  });
  let avdrag = 0;
  Object.keys(perAr).forEach(function (ar) {
    avdrag += ranteavdragForAr(perAr[ar]);
  });
  return Math.round(avdrag);
}

/**
 * Förenklad uppskattning av nettolön per månad utifrån bruttolön och kommunalskatt.
 * OBS: Detta är en grov approximation (kalibrerad mot ungefärliga svenska skattenivåer)
 * — inte en exakt skatteberäkning. Avsedd att ge en känsla för storleksordningen.
 * @param {Object} p
 * @param {number} p.bruttoPerManad kr/månad
 * @param {number} p.kommunalskatt  % (t.ex. 32.37)
 * @returns {{brutto:number, netto:number, skatt:number, skattesats:number}}
 */
function uppskattaNettolon(p) {
  const brutto = Math.max(0, p.bruttoPerManad || 0);
  const kommunalskatt = p.kommunalskatt != null ? p.kommunalskatt : 32.37;

  // Ankarpunkter: [bruttolön/mån, ungefärlig effektiv skattesats vid kommunalskatt 32.37%]
  const ankare = [
    [0, 0], [15000, 0.08], [20000, 0.15], [25000, 0.185], [30000, 0.22],
    [35000, 0.25], [40000, 0.28], [45000, 0.30], [50000, 0.32], [55000, 0.345],
    [60000, 0.36], [70000, 0.40], [80000, 0.43], [100000, 0.47], [130000, 0.51],
  ];

  let sats;
  if (brutto <= ankare[0][0]) {
    sats = ankare[0][1];
  } else if (brutto >= ankare[ankare.length - 1][0]) {
    // extrapolera svagt stigande marginal bortom sista ankarpunkten
    const [x0, y0] = ankare[ankare.length - 2];
    const [x1, y1] = ankare[ankare.length - 1];
    const marginal = (y1 - y0) / (x1 - x0);
    sats = y1 + marginal * (brutto - x1) * 0.5;
  } else {
    let i = 0;
    while (ankare[i + 1][0] < brutto) i++;
    const [x0, y0] = ankare[i];
    const [x1, y1] = ankare[i + 1];
    const t = (brutto - x0) / (x1 - x0);
    sats = y0 + t * (y1 - y0);
  }

  // justera för avvikelse från baskommunalskatten 32.37%
  const kommunDelta = (kommunalskatt - 32.37) / 100;
  sats = Math.min(0.62, Math.max(0, sats + kommunDelta));

  const skatt = brutto * sats;
  const netto = brutto - skatt;
  return { brutto: Math.round(brutto), netto: Math.round(netto), skatt: Math.round(skatt), skattesats: Math.round(sats * 1000) / 10 };
}

/** Formaterar kr utan decimaler, med tusentalsavgränsare (sv-SE). */
function formatKr(n) {
  return Math.round(n).toLocaleString("sv-SE") + " kr";
}

/** Formaterar kompakt (t.ex. 1,2 Mkr / 240 tkr) för stora tal i rubriker. */
function formatKrKompakt(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toLocaleString("sv-SE", { maximumFractionDigits: 1 }) + " Mkr";
  if (abs >= 10_000) return Math.round(n / 1000).toLocaleString("sv-SE") + " tkr";
  return formatKr(n);
}
