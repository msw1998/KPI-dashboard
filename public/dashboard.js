// ════════════════════════════════════════════════════════════════
//  Sales Cockpit – Frontend Dashboard Logic
// ════════════════════════════════════════════════════════════════

// ─── Colors ──────────────────────────────────────────────────────
const C = {
  navyDark:  '#0D2137',
  navy:      '#1B3A5C',
  blue:      '#2B7CE9',
  skyBlue:   '#5BB8F5',
  green:     '#22C55E',
  orange:    '#F59E0B',
  gray:      '#9CA3AF',
  gridLine:  'rgba(0,0,0,0.06)',
};

// ─── Chart defaults ───────────────────────────────────────────────
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
Chart.defaults.font.size   = 11;
Chart.defaults.color       = '#5a7ba4';

// ─── Global state ─────────────────────────────────────────────────
let appData        = null;
let activeTab      = 'teamview';
let activeAgent    = 'Lukas Eisele';
let chartRegistry  = {};   // id → Chart instance

// ─── Boot ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', loadData);

async function loadData() {
  showLoading();
  try {
    const res = await fetch('/api/data');
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    appData = await res.json();
    updateDateBadge(appData.lastUpdated);
    renderActiveView();
    showView();
  } catch (e) {
    showError(e.message);
  }
}

// ─── UI state helpers ─────────────────────────────────────────────
function showLoading() {
  document.getElementById('loadingState').classList.remove('hidden');
  document.getElementById('errorState').classList.add('hidden');
  document.getElementById('viewTeamview').classList.add('hidden');
  document.getElementById('viewMitarbeiter').classList.add('hidden');
}
function showView() {
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('errorState').classList.add('hidden');
  renderActiveView();
}
function showError(msg) {
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('errorState').classList.remove('hidden');
  document.getElementById('errorMsg').textContent = `Fehler beim Laden der Daten: ${msg}`;
}

function updateDateBadge(isoStr) {
  if (!isoStr) { document.getElementById('dateBadge').textContent = 'Aktualisiert: –'; return; }
  const d = new Date(isoStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  document.getElementById('dateBadge').textContent = `Aktualisiert: ${dd}.${mm}.${yy}`;
}

// ─── Tab switching ────────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  document.getElementById('tabTeamview').classList.toggle('active', tab === 'teamview');
  document.getElementById('tabMitarbeiter').classList.toggle('active', tab === 'mitarbeiter');
  document.getElementById('pageTitle').textContent =
    tab === 'teamview' ? 'Sales Cockpit – Teamview' : 'Sales Cockpit – Mitarbeiter';
  if (appData) renderActiveView();
}

function renderActiveView() {
  if (activeTab === 'teamview') {
    document.getElementById('viewTeamview').classList.remove('hidden');
    document.getElementById('viewMitarbeiter').classList.add('hidden');
    renderTeamview();
  } else {
    document.getElementById('viewTeamview').classList.add('hidden');
    document.getElementById('viewMitarbeiter').classList.remove('hidden');
    renderMitarbeiter(activeAgent);
  }
}

// ─── Agent selection ──────────────────────────────────────────────
function selectAgent(name) {
  activeAgent = name;
  const map = {
    'Lukas Eisele':   'agentBtn-Lukas',
    'Sam Holdenried': 'agentBtn-Sam',
    'Tobias Hagl':    'agentBtn-Tobias',
  };
  Object.entries(map).forEach(([n, id]) => {
    document.getElementById(id).classList.toggle('active', n === name);
  });
  renderMitarbeiter(name);
}

// ════════════════════════════════════════════════════════════════
//  KPI Calculations
// ════════════════════════════════════════════════════════════════

function calcKPIs(wsToOffer, offerToDeal) {
  const wsRows = wsToOffer.filter(r => r.websessions > 0);
  const odRows = offerToDeal.filter(r => r.offers > 0);

  // Period label: first to last month with WS data
  const period = wsRows.length
    ? `${wsRows[0].month} – ${wsRows[wsRows.length - 1].month}`
    : '–';

  // Total websessions
  const totalWS = wsRows.reduce((s, r) => s + r.websessions, 0);

  // Angebote gestellt = sum of all offers from Angebot→Auftrag section
  const totalOffers = odRows.reduce((s, r) => s + r.offers, 0);

  // Deals gewonnen = use best available (90d → 60d → 30d)
  const totalDeals = odRows.reduce((s, r) => {
    const d = r.deals_90d ?? r.deals_60d ?? r.deals_30d ?? 0;
    return s + d;
  }, 0);

  // Ø CR Websession→Angebot (90-Tage-View): total best offers / total WS
  const totalBestOffers = wsRows.reduce((s, r) => {
    const o = r.offers_90d ?? r.offers_60d ?? r.offers_30d ?? 0;
    return s + o;
  }, 0);
  const crWS = totalWS > 0 ? (totalBestOffers / totalWS) * 100 : null;

  // Ø CR Angebot→Auftrag (90-Tage-View): total best deals / total offers
  const totalBestDeals = odRows.reduce((s, r) => {
    const d = r.deals_90d ?? r.deals_60d ?? r.deals_30d ?? 0;
    return s + d;
  }, 0);
  const totalOdOffers = odRows.reduce((s, r) => s + r.offers, 0);
  const crOffer = totalOdOffers > 0 ? (totalBestDeals / totalOdOffers) * 100 : null;

  return { period, totalWS, totalOffers, totalDeals, crWS, crOffer };
}

function fmtPct(v)  { return v != null ? `${v.toFixed(1)}%` : '–'; }
function fmtNum(v)  { return v != null ? Math.round(v).toString() : '–'; }
function fmtDay(v)  { return v != null ? `${v.toFixed(1)} d` : '–'; }

// ─── HubSpot helpers ──────────────────────────────────────────────────────────
const GERMAN_MONTHS = { Jan:1, Feb:2, 'Mär':3, Apr:4, Mai:5, Jun:6, Jul:7, Aug:8, Sep:9, Okt:10, Nov:11, Dez:12 };
function labelToYYYYMM(label) {
  const [mon, yy] = label.trim().split(' ');
  return `${2000 + parseInt(yy)}-${String(GERMAN_MONTHS[mon] || 1).padStart(2, '0')}`;
}
function fmtHubDate(val) {
  if (!val) return '–';
  // ISO date string "YYYY-MM-DD" (HubSpot date properties)
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    const [y, m, day] = val.slice(0, 10).split('-');
    return `${day}.${m}.${y}`;
  }
  // Unix ms timestamp (fallback)
  const d = new Date(Number(val));
  if (isNaN(d.getTime())) return '–';
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}
function fmtEuro(v) {
  if (v == null || v === '') return '–';
  return parseFloat(v).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

// ════════════════════════════════════════════════════════════════
//  Chart helpers
// ════════════════════════════════════════════════════════════════

function destroyChart(id) {
  if (chartRegistry[id]) {
    chartRegistry[id].destroy();
    delete chartRegistry[id];
  }
}

function createChart(id, config) {
  destroyChart(id);
  const canvas = document.getElementById(id);
  if (!canvas) return;
  chartRegistry[id] = new Chart(canvas.getContext('2d'), config);
}

const gridOpts = {
  color: C.gridLine,
  drawBorder: false,
};
const noTicks = { display: false };
const pctTicks = {
  callback: v => `${(v * 100).toFixed(0)}%`,
};
const pctTooltip = {
  callbacks: {
    label: ctx => ` ${(ctx.parsed.y * 100).toFixed(1)}%`,
  },
};

// ─── Bar chart: Websessions & Angebote ───────────────────────────
function chartBarWS(id, wsData, onClickWS) {
  const labels = wsData.map(r => r.month);
  createChart(id, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Websessions',
          data: wsData.map(r => r.websessions),
          backgroundColor: C.navy,
          borderRadius: 3,
        },
        {
          label: 'Angebote (90d)',
          data: wsData.map(r => r.offers_90d ?? r.offers_60d ?? r.offers_30d),
          backgroundColor: C.skyBlue,
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 14 } } },
      scales: {
        x: { grid: gridOpts },
        y: { grid: gridOpts, beginAtZero: true },
      },
      ...(onClickWS ? {
        onClick: (_evt, elements) => {
          if (!elements.length || elements[0].datasetIndex !== 0) return;
          onClickWS(wsData[elements[0].index].month);
        },
        onHover: (_evt, elements, chart) => {
          const isWS = elements.length && elements[0].datasetIndex === 0;
          chart.canvas.style.cursor = isWS ? 'pointer' : 'default';
        },
      } : {}),
    },
  });
}

// ─── Line chart: CR nach Zeitfenster (WS→Angebot) ────────────────
function chartLineWS(id, wsData) {
  const labels = wsData.map(r => r.month);
  const dot = { pointRadius: 5, pointHoverRadius: 7, tension: 0.35 };
  createChart(id, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '30 Tage', data: wsData.map(r => r.cr_30d),
          borderColor: C.gray, backgroundColor: 'transparent',
          borderWidth: 2, ...dot,
        },
        {
          label: '60 Tage', data: wsData.map(r => r.cr_60d),
          borderColor: C.skyBlue, backgroundColor: 'transparent',
          borderWidth: 2.5, ...dot,
        },
        {
          label: '90 Tage', data: wsData.map(r => r.cr_90d),
          borderColor: C.navy, backgroundColor: 'transparent',
          borderWidth: 2.5, ...dot,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 14 } },
        tooltip: pctTooltip,
      },
      scales: {
        x: { grid: gridOpts },
        y: { grid: gridOpts, beginAtZero: true, ticks: pctTicks, max: 0.6 },
      },
    },
  });
}

// ─── Horizontal bar: Time to Offer ───────────────────────────────
function chartHBarTTO(id, wsData) {
  const labels = wsData.map(r => r.month);
  createChart(id, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '30 Tage', data: wsData.map(r => r.tto_30d),
          backgroundColor: C.gray, borderRadius: 3,
        },
        {
          label: '60 Tage', data: wsData.map(r => r.tto_60d),
          backgroundColor: C.skyBlue, borderRadius: 3,
        },
        {
          label: '90 Tage', data: wsData.map(r => r.tto_90d),
          backgroundColor: C.navy, borderRadius: 3,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 14 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x?.toFixed(1) ?? '–'} d` } },
      },
      scales: {
        x: { grid: gridOpts, beginAtZero: true, ticks: { callback: v => `${v} d` } },
        y: { grid: gridOpts },
      },
    },
  });
}

// ─── Bar chart: Angebote & Deals ─────────────────────────────────
function chartBarDeals(id, odData) {
  const labels = odData.map(r => r.month);
  createChart(id, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Angebote',
          data: odData.map(r => r.offers),
          backgroundColor: C.navy, borderRadius: 3,
        },
        {
          label: 'Deals (90d)',
          data: odData.map(r => r.deals_90d ?? r.deals_60d ?? r.deals_30d),
          backgroundColor: C.green, borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 14 } } },
      scales: {
        x: { grid: gridOpts },
        y: { grid: gridOpts, beginAtZero: true },
      },
    },
  });
}

// ─── Line chart: CR Angebot→Auftrag ──────────────────────────────
function chartLineDeals(id, odData) {
  const labels = odData.map(r => r.month);
  const dot = { pointRadius: 5, pointHoverRadius: 7, tension: 0.35 };
  createChart(id, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '30 Tage', data: odData.map(r => r.cr_deal_30d),
          borderColor: C.gray, backgroundColor: 'transparent',
          borderWidth: 2, ...dot,
        },
        {
          label: '60 Tage', data: odData.map(r => r.cr_deal_60d),
          borderColor: C.skyBlue, backgroundColor: 'transparent',
          borderWidth: 2.5, ...dot,
        },
        {
          label: '90 Tage', data: odData.map(r => r.cr_deal_90d),
          borderColor: C.green, backgroundColor: 'transparent',
          borderWidth: 2.5, ...dot,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 14 } },
        tooltip: pctTooltip,
      },
      scales: {
        x: { grid: gridOpts },
        y: { grid: gridOpts, beginAtZero: true, ticks: pctTicks, max: 0.45 },
      },
    },
  });
}

// ─── Horizontal bar: Lifecycle Time ──────────────────────────────
function chartHBarLC(id, odData) {
  // Filter to rows with lifecycle data
  const rows = odData.filter(r => r.lifecycle_60d != null || r.lifecycle_90d != null);
  const labels = rows.map(r => r.month);
  createChart(id, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '60 Tage', data: rows.map(r => r.lifecycle_60d),
          backgroundColor: C.skyBlue, borderRadius: 3,
        },
        {
          label: '90 Tage', data: rows.map(r => r.lifecycle_90d),
          backgroundColor: C.green, borderRadius: 3,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 14 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x?.toFixed(1) ?? '–'} d` } },
      },
      scales: {
        x: { grid: gridOpts, beginAtZero: true, ticks: { callback: v => `${v} d` } },
        y: { grid: gridOpts },
      },
    },
  });
}

// ─── Stacked bar: WS distribution ────────────────────────────────
function chartStackedWS(id, wsDist, highlightAgent) {
  const labels = wsDist.map(r => r.month);
  const agentColor = { 'Lukas Eisele': C.navy, 'Sam Holdenried': C.skyBlue, 'Tobias Hagl': C.green };
  const key = { 'Lukas Eisele': 'lukas', 'Sam Holdenried': 'sam', 'Tobias Hagl': 'tobias' };
  const agents = ['Lukas Eisele', 'Sam Holdenried', 'Tobias Hagl'];

  createChart(id, {
    type: 'bar',
    data: {
      labels,
      datasets: agents.map(a => ({
        label: a.split(' ')[0],
        data: wsDist.map(r => r[key[a]]),
        backgroundColor: a === highlightAgent ? agentColor[a] : agentColor[a] + '55',
        borderRadius: 2,
      })),
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 14 } } },
      scales: {
        x: { stacked: true, grid: gridOpts },
        y: { stacked: true, grid: gridOpts, beginAtZero: true },
      },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const el = elements[0];
        openDealsModal(agents[el.datasetIndex], wsDist[el.index].month);
      },
      onHover: (_evt, elements, chart) => {
        chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
      },
    },
  });
}

// ─── Line chart: WS share % ──────────────────────────────────────
function chartShareLine(id, wsDist) {
  const labels = wsDist.map(r => r.month);
  const dot = { pointRadius: 5, pointHoverRadius: 7, tension: 0.35 };
  createChart(id, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Lukas',  data: wsDist.map(r => r.lukasP),
          borderColor: C.navy, backgroundColor: 'transparent', borderWidth: 2.5, ...dot,
        },
        {
          label: 'Sam',    data: wsDist.map(r => r.samP),
          borderColor: C.skyBlue, backgroundColor: 'transparent', borderWidth: 2.5, ...dot,
        },
        {
          label: 'Tobias', data: wsDist.map(r => r.tobiasP),
          borderColor: C.green, backgroundColor: 'transparent', borderWidth: 2.5, ...dot,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 14 } },
        tooltip: { callbacks: { label: ctx => ` ${((ctx.parsed.y ?? 0) * 100).toFixed(1)}%` } },
      },
      scales: {
        x: { grid: gridOpts },
        y: {
          grid: gridOpts, beginAtZero: true,
          ticks: { callback: v => `${(v * 100).toFixed(0)}%` },
          max: 0.75,
        },
      },
    },
  });
}

// ════════════════════════════════════════════════════════════════
//  Insights generator
// ════════════════════════════════════════════════════════════════

function generateInsights(wsToOffer, offerToDeal, agentName) {
  const insights = [];
  const wsRows = wsToOffer.filter(r => r.websessions > 0);
  const odRows = offerToDeal.filter(r => r.offers > 0);

  // 1. Highest WS month and its 90d CR
  if (wsRows.length) {
    const peak = wsRows.reduce((a, b) => b.websessions > a.websessions ? b : a);
    const cr90 = peak.cr_90d != null ? `${(peak.cr_90d * 100).toFixed(1)}% CR (90d)` : 'noch keine 90d CR';
    insights.push(
      `${agentName ? agentName.split(' ')[0] : 'Das Team'} hatte im ${peak.month} das höchste Volumen ` +
      `mit ${peak.websessions} Websessions, aber nur ${cr90} – Qualität vor Quantität prüfen.`
    );
  }

  // 2. 90d vs 60d CR improvement in WS→Angebot
  const withBoth = wsRows.filter(r => r.cr_90d != null && r.cr_60d != null);
  if (withBoth.length) {
    const avgImprovement = withBoth.reduce((s, r) => s + (r.cr_90d - r.cr_60d), 0) / withBoth.length;
    if (Math.abs(avgImprovement) < 0.02) {
      insights.push(
        'Der 90-Tage-View zeigt kaum Verbesserung gegenüber 60 Tagen bei Websession→Angebot – Entscheidungen fallen früh oder gar nicht.'
      );
    } else if (avgImprovement > 0) {
      insights.push(
        `Durchschnittlich ${(avgImprovement * 100).toFixed(1)}% mehr Angebote kommen zwischen Tag 60 und 90 dazu – ` +
        `der längere Zeitraum lohnt sich.`
      );
    }
  }

  // 3. Outlier lifecycle time in Angebot→Auftrag
  if (odRows.length) {
    const withLC = odRows.filter(r => r.lifecycle_90d != null && r.lifecycle_90d > 0);
    if (withLC.length) {
      const maxLC = withLC.reduce((a, b) => b.lifecycle_90d > a.lifecycle_90d ? b : a);
      if (maxLC.lifecycle_90d > 150) {
        insights.push(
          `${maxLC.month} zeigt eine außergewöhnlich lange Lifecycle Time (${maxLC.lifecycle_90d.toFixed(0)} Tage) – ` +
          `hier lag vermutlich ein Ausreißer-Deal vor.`
        );
      }
    }
  }

  // 4. Average Time to Offer
  const ttoRows = wsRows.filter(r => r.tto_90d != null && r.tto_90d > 0);
  if (ttoRows.length) {
    const avgTTO = ttoRows.reduce((s, r) => s + r.tto_90d, 0) / ttoRows.length;
    insights.push(
      `Die durchschnittliche Time to Offer liegt bei ~${avgTTO.toFixed(0)} Tagen – ` +
      `Potenzial für Beschleunigung in der Angebotsphase.`
    );
  }

  // 5. Best / worst month for Angebot→Auftrag CR
  const odWithCR = odRows.filter(r => r.cr_deal_90d != null && r.cr_deal_90d > 0);
  if (odWithCR.length >= 2) {
    const best  = odWithCR.reduce((a, b) => b.cr_deal_90d > a.cr_deal_90d ? b : a);
    const worst = odWithCR.reduce((a, b) => b.cr_deal_90d < a.cr_deal_90d ? b : a);
    insights.push(
      `Beste Abschlussrate: ${best.month} mit ${(best.cr_deal_90d * 100).toFixed(1)}% (90d). ` +
      `Schwächster Monat: ${worst.month} mit ${(worst.cr_deal_90d * 100).toFixed(1)}%.`
    );
  }

  return insights;
}

// ════════════════════════════════════════════════════════════════
//  TEAMVIEW render
// ════════════════════════════════════════════════════════════════

function renderTeamview() {
  const { wsToOffer, offerToDeal } = appData.teamview;
  const kpi = calcKPIs(wsToOffer, offerToDeal);

  // KPI cards
  document.getElementById('tv-totalWS').textContent    = fmtNum(kpi.totalWS);
  document.getElementById('tv-wsPeriod').textContent   = kpi.period;
  document.getElementById('tv-totalOffers').textContent = fmtNum(kpi.totalOffers);
  document.getElementById('tv-offersPeriod').textContent = kpi.period;
  document.getElementById('tv-totalDeals').textContent = fmtNum(kpi.totalDeals);
  document.getElementById('tv-crWS').textContent       = fmtPct(kpi.crWS);
  document.getElementById('tv-crOffer').textContent    = fmtPct(kpi.crOffer);

  // Charts
  chartBarWS    ('tv-barWS',    wsToOffer);
  chartLineWS   ('tv-lineWS',   wsToOffer);
  chartHBarTTO  ('tv-hbarTTO',  wsToOffer);
  chartBarDeals ('tv-barDeals', offerToDeal);
  chartLineDeals('tv-lineDeals',offerToDeal);
  chartHBarLC   ('tv-hbarLC',   offerToDeal);

  // Insights
  const insightItems = generateInsights(wsToOffer, offerToDeal, null);
  renderInsights('tv-insights', insightItems);
}

// ════════════════════════════════════════════════════════════════
//  MITARBEITER render
// ════════════════════════════════════════════════════════════════

function renderMitarbeiter(agentName) {
  const agentData = appData.individuals[agentName];
  if (!agentData) return;

  const { wsToOffer, offerToDeal } = agentData;
  const kpi = calcKPIs(wsToOffer, offerToDeal);

  // KPI cards
  document.getElementById('ma-totalWS').textContent    = fmtNum(kpi.totalWS);
  document.getElementById('ma-wsPeriod').textContent   = kpi.period;
  document.getElementById('ma-totalOffers').textContent = fmtNum(kpi.totalOffers);
  document.getElementById('ma-offersPeriod').textContent = kpi.period;
  document.getElementById('ma-totalDeals').textContent = fmtNum(kpi.totalDeals);
  document.getElementById('ma-crWS').textContent       = fmtPct(kpi.crWS);
  document.getElementById('ma-crOffer').textContent    = fmtPct(kpi.crOffer);

  // WS distribution charts
  chartStackedWS('ma-stackedBar', appData.wsDist, agentName);
  chartShareLine ('ma-shareLine',  appData.wsDist);

  // WS → Angebot charts
  chartBarWS    ('ma-barWS',    wsToOffer, month => openDealsModal(agentName, month));
  chartLineWS   ('ma-lineWS',   wsToOffer);
  chartHBarTTO  ('ma-hbarTTO',  wsToOffer);

  // Angebot → Auftrag charts
  chartBarDeals ('ma-barDeals', offerToDeal);
  chartLineDeals('ma-lineDeals',offerToDeal);
  chartHBarLC   ('ma-hbarLC',   offerToDeal);

  // Insights
  const insightItems = generateInsights(wsToOffer, offerToDeal, agentName);
  renderInsights('ma-insights', insightItems);
}

// ─── Insights DOM ─────────────────────────────────────────────────
function renderInsights(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<li>Nicht genug Daten für Insights verfügbar.</li>';
    return;
  }
  el.innerHTML = items.map(txt => `<li>${txt}</li>`).join('');
}

// ════════════════════════════════════════════════════════════════
//  HubSpot Deal Modal
// ════════════════════════════════════════════════════════════════

function closeModal() {
  document.getElementById('dealModal').classList.add('hidden');
}
function handleModalOverlayClick(e) {
  if (e.target.id === 'dealModal') closeModal();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

async function openDealsModal(agentName, monthLabel) {
  const modal = document.getElementById('dealModal');
  const body  = document.getElementById('modalBody');
  document.getElementById('modalTitle').textContent    = `${agentName} – Websession Deals`;
  document.getElementById('modalSubtitle').textContent = monthLabel;
  body.innerHTML = '<div class="modal-loading"><div class="spinner"></div><p>Lade Deals…</p></div>';
  modal.classList.remove('hidden');
  try {
    const month = labelToYYYYMM(monthLabel);
    const res  = await fetch(`/api/hubspot/deals?agent=${encodeURIComponent(agentName)}&month=${month}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    renderDealsTable(body, data.deals, data.total);
  } catch (e) {
    body.innerHTML = `<div class="modal-error">Fehler: ${e.message}</div>`;
  }
}

function renderDealsTable(container, deals, total) {
  if (!deals.length) {
    container.innerHTML = '<div class="modal-empty">Keine Deals für diesen Monat gefunden.</div>';
    return;
  }
  container.innerHTML = `
    <p class="modal-count">${total} Deal${total !== 1 ? 's' : ''} gefunden</p>
    <table class="deals-table">
      <thead><tr>
        <th>Deal-Name</th><th>Websession</th><th>Betrag</th><th>Deal-Phase</th><th></th>
      </tr></thead>
      <tbody>
        ${deals.map(d => `<tr>
          <td class="deal-name">${d.name}</td>
          <td>${fmtHubDate(d.websessionDate)}</td>
          <td class="deal-amount">${fmtEuro(d.amount)}</td>
          <td><span class="deal-stage">${d.stage}</span></td>
          <td>${d.permalink ? `<a href="${d.permalink}" target="_blank" rel="noopener" class="deal-link">↗</a>` : ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}
