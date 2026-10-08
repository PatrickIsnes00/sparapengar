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
 * Simulerar avbetalning av en skuld månad för månad.
 * @param {Object} p
 * @param {number} p.skuld      kr, skuld vid start
 * @param {number} p.ranta      årlig ränta i %, t.ex. 6 för 6%
 * @param {number} p.betalning  kr/månad, total betalning (ränta + amortering)
 * @returns {{rows:Array, manader:number, totalRanta:number, totalBetalt:number, omojligt:boolean}}
 *   omojligt = true om betalningen inte täcker räntan (skulden växer i all evighet)
 */
function simuleraSkuldAvbetalning(p) {
  const skuldStart = Math.max(0, p.skuld || 0);
  const manadsRanta = (p.ranta || 0) / 100 / 12;
  const betalning = Math.max(0, p.betalning || 0);

  if (skuldStart <= 0) {
    return { rows: [{ manad: 0, kvar: 0, ranta: 0 }], manader: 0, totalRanta: 0, totalBetalt: 0, omojligt: false };
  }
  if (betalning <= skuldStart * manadsRanta) {
    return { rows: [{ manad: 0, kvar: skuldStart, ranta: 0 }], manader: null, totalRanta: null, totalBetalt: null, omojligt: true };
  }

  let kvar = skuldStart;
  let totalRanta = 0, totalBetalt = 0, manad = 0;
  const rows = [{ manad: 0, kvar: Math.round(kvar), ranta: 0 }];

  while (kvar > 0 && manad < 1200) {
    manad++;
    const ranta = kvar * manadsRanta;
    let betalDennaManad = betalning;
    if (betalDennaManad > kvar + ranta) betalDennaManad = kvar + ranta;
    kvar = kvar + ranta - betalDennaManad;
    if (kvar < 0) kvar = 0;
    totalRanta += ranta;
    totalBetalt += betalDennaManad;
    rows.push({ manad: manad, kvar: Math.round(kvar), ranta: Math.round(ranta) });
  }

  return { rows: rows, manader: manad, totalRanta: Math.round(totalRanta), totalBetalt: Math.round(totalBetalt), omojligt: false };
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
