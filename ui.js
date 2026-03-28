// Runs in ISOLATED world at document_idle

const TOKEN_DECIMALS = 1_000_000;

function fmt(raw) {
  return (Number(raw) / TOKEN_DECIMALS).toFixed(2);
}

function tierAvgPrice(nodes) {
  if (!nodes || nodes.length === 0) return 0;
  const totalQty = nodes.reduce((s, n) => s + Number(n.availableQuantity), 0);
  if (totalQty === 0) return nodes.reduce((s, n) => s + Number(n.price), 0) / nodes.length;
  return nodes.reduce((s, n) => s + Number(n.price) * Number(n.availableQuantity), 0) / totalQty;
}

const RESELL_RATE = 0.85;

function calcEV(tiers) {
  return tiers.reduce((sum, t) => sum + t.avgPrice * Number(t.ratio), 0) / 10000;
}
function calcResellEV(tiers) {
  return tiers.reduce((sum, t) => sum + t.avgPrice * RESELL_RATE * Number(t.ratio), 0) / 10000;
}

const TIER_COLORS = {
  gray:   '#9CA3AF',
  green:  '#22C55E',
  blue:   '#3B82F6',
  purple: '#A855F7',
  orange: '#F97316',
  yellow: '#EAB308',
  red:    '#EF4444',
};
function tierColor(c) { return TIER_COLORS[c?.toLowerCase()] ?? '#9CA3AF'; }

// Logo as base64 is loaded via chrome.runtime.getURL
const LOGO_URL = typeof chrome !== 'undefined' && chrome.runtime
  ? chrome.runtime.getURL('getvoltev.png')
  : '';

function injectStyles() {
  if (document.getElementById('volt-ev-styles')) return;
  const s = document.createElement('style');
  s.id = 'volt-ev-styles';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    #volt-ev-panel {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      width: 300px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      color: #111111;
      filter: drop-shadow(0 4px 20px rgba(0,0,0,0.10));
    }

    #volt-ev-panel * { box-sizing: border-box; }

    /* Card shell */
    #volt-ev-panel .ev-card {
      background: #FFFFFF;
      border: 1.5px solid #E9E9E9;
      border-radius: 12px;
      overflow: hidden;
    }

    /* Orange top bar */
    #volt-ev-panel .ev-topbar {
      height: 3px;
      background: #F26722;
    }

    /* Collapsed tab / header */
    #volt-ev-panel .ev-tab {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 9px 13px;
      cursor: pointer;
      border-bottom: 1px solid transparent;
      transition: background 0.15s;
    }
    #volt-ev-panel .ev-tab:hover { background: #FAFAFA; }
    #volt-ev-panel.expanded .ev-tab { border-bottom-color: #F3F3F3; }

    #volt-ev-panel .ev-tab-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #volt-ev-panel .ev-logo {
      height: 16px;
      width: auto;
      display: block;
    }
    #volt-ev-panel .ev-tab-label {
      font-size: 10px;
      font-weight: 700;
      color: #9CA3AF;
      letter-spacing: 0.10em;
      text-transform: uppercase;
    }
    #volt-ev-panel .ev-badges {
      display: flex;
      gap: 5px;
    }
    #volt-ev-panel .ev-badge {
      font-size: 12px;
      font-weight: 700;
      padding: 2px 9px;
      border-radius: 20px;
      white-space: nowrap;
    }
    #volt-ev-panel .ev-badge.positive { color: #16A34A; background: #F0FDF4; }
    #volt-ev-panel .ev-badge.negative { color: #DC2626; background: #FEF2F2; }
    #volt-ev-panel .ev-badge.sell     { color: #6B7280; background: #F5F5F4; font-weight: 600; }

    #volt-ev-panel .ev-chevron {
      font-size: 10px;
      color: #D1D5DB;
      transition: transform 0.2s;
      flex-shrink: 0;
    }
    #volt-ev-panel.expanded .ev-chevron { transform: rotate(180deg); }

    /* Expandable body */
    #volt-ev-panel .ev-body { display: none; }
    #volt-ev-panel.expanded .ev-body { display: block; }

    /* Pack name */
    #volt-ev-panel .ev-pack-name {
      padding: 11px 13px 0;
      font-size: 13px;
      font-weight: 700;
      color: #111111;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Stat rows */
    #volt-ev-panel .ev-stats {
      padding: 9px 13px 0;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    #volt-ev-panel .ev-stat-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-radius: 8px;
      padding: 7px 10px;
    }
    #volt-ev-panel .ev-stat-row.neutral  { background: #F9F9F8; }
    #volt-ev-panel .ev-stat-row.positive { background: #F0FDF4; }
    #volt-ev-panel .ev-stat-row.negative { background: #FFF7ED; }

    #volt-ev-panel .ev-stat-lhs { display: flex; flex-direction: column; gap: 1px; }
    #volt-ev-panel .ev-stat-label {
      font-size: 10px;
      font-weight: 600;
      color: #9CA3AF;
      text-transform: uppercase;
      letter-spacing: 0.07em;
    }
    #volt-ev-panel .ev-stat-sub {
      font-size: 10px;
      font-weight: 400;
    }
    #volt-ev-panel .ev-stat-row.positive .ev-stat-sub { color: #86EFAC; }
    #volt-ev-panel .ev-stat-row.negative .ev-stat-sub { color: #FDBA74; }

    #volt-ev-panel .ev-stat-rhs {
      display: flex;
      align-items: baseline;
      gap: 5px;
    }
    #volt-ev-panel .ev-stat-value {
      font-size: 15px;
      font-weight: 700;
    }
    #volt-ev-panel .ev-stat-row.neutral  .ev-stat-value { color: #111111; }
    #volt-ev-panel .ev-stat-row.positive .ev-stat-value { color: #16A34A; }
    #volt-ev-panel .ev-stat-row.negative .ev-stat-value { color: #EA580C; }
    #volt-ev-panel .ev-stat-pct {
      font-size: 11px;
      font-weight: 600;
    }
    #volt-ev-panel .ev-stat-row.positive .ev-stat-pct { color: #4ADE80; }
    #volt-ev-panel .ev-stat-row.negative .ev-stat-pct { color: #FB923C; }

    /* Tier breakdown */
    #volt-ev-panel .ev-tiers {
      padding: 11px 13px 13px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    #volt-ev-panel .ev-tiers-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 6px;
      border-bottom: 1px solid #F3F3F3;
    }
    #volt-ev-panel .ev-tiers-title {
      font-size: 10px;
      font-weight: 600;
      color: #9CA3AF;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    #volt-ev-panel .ev-col-headers {
      display: flex;
      gap: 10px;
    }
    #volt-ev-panel .ev-col-hdr {
      font-size: 9px;
      font-weight: 500;
      color: #C4C4C4;
      text-align: right;
    }
    #volt-ev-panel .ev-col-hdr.resell { color: #F26722; font-weight: 600; }

    #volt-ev-panel .ev-tier-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #volt-ev-panel .ev-tier-left {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    #volt-ev-panel .ev-tier-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    #volt-ev-panel .ev-tier-name {
      font-size: 12px;
      font-weight: 500;
      color: #374151;
    }
    #volt-ev-panel .ev-tier-right {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    #volt-ev-panel .ev-tier-pct    { font-size:12px; color:#6B7280; width:36px; text-align:right; }
    #volt-ev-panel .ev-tier-market { font-size:12px; font-weight:600; color:#111111; width:42px; text-align:right; }
    #volt-ev-panel .ev-tier-resell { font-size:12px; font-weight:600; color:#EA580C; width:42px; text-align:right; }
  `;
  document.head.appendChild(s);
}

let isExpanded = false;

function buildPanel(data) {
  const { packName, unitPrice, tiers } = data;

  const tiersWithAvg = tiers.map((t) => ({
    ...t,
    avgPrice: t.nodes.length > 0 ? tierAvgPrice(t.nodes) : Number(t.tierPrice),
    loadedItems: t.nodes.length,
  }));

  const ev        = calcEV(tiersWithAvg);
  const resellEV  = calcResellEV(tiersWithAvg);
  const cost      = Number(unitPrice);
  const evPct     = cost > 0 ? (ev / cost) * 100 : 0;
  const resellPct = cost > 0 ? (resellEV / cost) * 100 : 0;
  const evPos     = ev >= cost;
  const resellPos = resellEV >= cost;

  const panel = document.createElement('div');
  panel.id = 'volt-ev-panel';
  if (isExpanded) panel.classList.add('expanded');

  // --- Tab (collapsed header) ---
  const logoHTML = LOGO_URL
    ? `<img class="ev-logo" src="${LOGO_URL}" alt="Volt">`
    : `<span class="ev-tab-label">EV</span>`;

  panel.innerHTML = `
    <div class="ev-card">
      <div class="ev-topbar"></div>
      <div class="ev-tab" id="volt-ev-tab">
        <div class="ev-tab-left">
          ${logoHTML}
          <div class="ev-badges">
            <span class="ev-badge ${evPos ? 'positive' : 'negative'}">${evPct.toFixed(1)}%</span>
            <span class="ev-badge sell">${resellPct.toFixed(1)}% sell</span>
          </div>
        </div>
        <span class="ev-chevron">▲</span>
      </div>

      <div class="ev-body">
        <div class="ev-pack-name">${packName}</div>

        <div class="ev-stats">
          <div class="ev-stat-row neutral">
            <div class="ev-stat-lhs"><span class="ev-stat-label">Pack Cost</span></div>
            <div class="ev-stat-rhs"><span class="ev-stat-value">$${fmt(cost)}</span></div>
          </div>
          <div class="ev-stat-row ${evPos ? 'positive' : 'negative'}">
            <div class="ev-stat-lhs">
              <span class="ev-stat-label">EV (keep)</span>
              <span class="ev-stat-sub">at market price</span>
            </div>
            <div class="ev-stat-rhs">
              <span class="ev-stat-value">$${fmt(ev)}</span>
              <span class="ev-stat-pct">${evPct.toFixed(1)}%</span>
            </div>
          </div>
          <div class="ev-stat-row ${resellPos ? 'positive' : 'negative'}">
            <div class="ev-stat-lhs">
              <span class="ev-stat-label">EV (sell)</span>
              <span class="ev-stat-sub">at 85% resell</span>
            </div>
            <div class="ev-stat-rhs">
              <span class="ev-stat-value">$${fmt(resellEV)}</span>
              <span class="ev-stat-pct">${resellPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div class="ev-tiers">
          <div class="ev-tiers-header">
            <span class="ev-tiers-title">Tier Breakdown</span>
            <div class="ev-col-headers">
              <span class="ev-col-hdr" style="width:36px">Chance</span>
              <span class="ev-col-hdr" style="width:42px">Market</span>
              <span class="ev-col-hdr resell" style="width:42px">Resell</span>
            </div>
          </div>
          <div id="volt-ev-tier-rows"></div>
        </div>
      </div>
    </div>
  `;

  // Tier rows
  const rowsContainer = panel.querySelector('#volt-ev-tier-rows');
  [...tiersWithAvg]
    .sort((a, b) => Number(b.ratio) - Number(a.ratio))
    .forEach((t) => {
      const pct = (Number(t.ratio) / 100).toFixed(2);
      const row = document.createElement('div');
      row.className = 'ev-tier-row';
      row.innerHTML = `
        <div class="ev-tier-left">
          <div class="ev-tier-dot" style="background:${tierColor(t.color)}"></div>
          <span class="ev-tier-name">${t.name}</span>
        </div>
        <div class="ev-tier-right">
          <span class="ev-tier-pct">${pct}%</span>
          <span class="ev-tier-market">$${fmt(t.avgPrice)}</span>
          <span class="ev-tier-resell">$${fmt(t.avgPrice * RESELL_RATE)}</span>
        </div>
      `;
      rowsContainer.appendChild(row);
    });

  panel.querySelector('#volt-ev-tab').addEventListener('click', () => {
    isExpanded = !isExpanded;
    panel.classList.toggle('expanded', isExpanded);
  });

  return panel;
}

function mountPanel(data) {
  injectStyles();
  const existing = document.getElementById('volt-ev-panel');
  if (existing) existing.remove();
  document.body.appendChild(buildPanel(data));
}

window.addEventListener('VoltEVData', (e) => mountPanel(e.detail));
