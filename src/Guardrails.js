/**
 * Guardrails.js — evaluate RULES against the Main tab and write PENDING
 * proposals to the Approvals tab. READ-ONLY against Google Ads.
 * Entry point: proposeChanges().
 */

const APPROVAL_HEADERS = [
  'proposal_id', 'created_at', 'campaign_id', 'campaign_name', 'rule_id',
  'action', 'detail', 'reason', 'status', 'result', 'applied_at',
];

function proposeChanges() {
  const rows = readMain_();
  if (!rows.length) { Logger.log('Main tab empty — nothing to evaluate.'); return; }

  const byCampaign = groupByCampaign_(rows);
  const latest = maxDate_(rows);
  const existing = loadPendingKeys_();
  const now = new Date().toISOString();

  const proposals = [];
  Object.keys(byCampaign).forEach(cid => {
    const camp = byCampaign[cid];
    RULES.forEach(rule => {
      const m = computeMetrics_(camp.rows, latest, rule.window);
      if (m === null) return;                     // not enough data
      if (!clausesPass_(rule.when, m)) return;     // rule didn't fire

      const key = cid + '|' + rule.id;
      if (existing[key]) return;                   // already pending — don't duplicate

      proposals.push([
        Utilities.getUuid().slice(0, 8),
        now, cid, camp.name, rule.id,
        rule.action.type,
        actionDetail_(rule.action),
        rule.note + ' — ' + metricSummary_(rule.when, m),
        'PENDING', '', '',
      ]);
    });
  });

  appendApprovals_(proposals);
  Logger.log('✅ proposeChanges: ' + proposals.length + ' new proposal(s) written.');
}

// ── metric computation ────────────────────────────────────────────────────

/** Trailing + prior window aggregates → metric object, or null if no recent data. */
function computeMetrics_(rows, latest, windowDays) {
  const recentStart = addDays_(latest, -(windowDays - 1));
  const priorEnd = addDays_(latest, -windowDays);
  const priorStart = addDays_(latest, -(2 * windowDays - 1));

  const r = blank_(), p = blank_();
  rows.forEach(row => {
    const d = new Date(row.date);
    if (inRange_(d, recentStart, latest)) accumulate_(r, row);
    else if (inRange_(d, priorStart, priorEnd)) accumulate_(p, row);
  });
  if (r.spend === 0 && r.conv === 0) return null;

  const cpa = r.conv > 0 ? r.spend / r.conv : Infinity;
  const roas = r.spend > 0 ? r.value / r.spend : 0;
  const roasPrior = p.spend > 0 ? p.value / p.spend : 0;
  return {
    spend: r.spend, conversions: r.conv, value: r.value, cpa: cpa, roas: roas,
    spend_pct: p.spend > 0 ? (r.spend - p.spend) / p.spend : 0,
    roas_pct: roasPrior > 0 ? (roas - roasPrior) / roasPrior : 0,
  };
}

function clausesPass_(clauses, m) {
  return clauses.every(c => compare_(m[c.metric], c.op, c.value));
}

function compare_(a, op, b) {
  switch (op) {
    case '>': return a > b;   case '>=': return a >= b;
    case '<': return a < b;   case '<=': return a <= b;
    case '==': return a === b; case '!=': return a !== b;
    default: throw new Error('Unknown operator: ' + op);
  }
}

// ── formatting ─────────────────────────────────────────────────────────────

function actionDetail_(action) {
  if (action.type === 'PAUSE_CAMPAIGN') return 'pause campaign';
  if (action.type === 'ADJUST_BUDGET') {
    const sign = action.pct >= 0 ? '+' : '';
    return 'budget ' + sign + Math.round(action.pct * 100) + '% (resolved at apply)';
  }
  return action.type;
}

function metricSummary_(clauses, m) {
  return clauses.map(c => c.metric + '=' + fmt_(m[c.metric])).join(', ');
}
function fmt_(n) { return (n === Infinity) ? '∞' : Math.round(n * 100) / 100; }

// ── sheet I/O ──────────────────────────────────────────────────────────────

function readMain_() {
  const ss = ss_();
  const sheet = ss.getSheetByName(CONFIG.mainTab);
  if (!sheet) throw new Error('Main tab not found — is gads-warehouse writing to this sheet?');
  const data = sheet.getDataRange().getValues();
  const header = data.shift();
  const idx = name => header.indexOf(name);
  const I = { date: idx('date'), cid: idx('campaign_id'), name: idx('campaign_name'),
    spend: idx('spend'), conv: idx('conversions'), value: idx('conv_value') };
  return data.filter(r => r[I.cid]).map(r => ({
    date: r[I.date], campaign_id: String(r[I.cid]), campaign_name: r[I.name],
    spend: Number(r[I.spend]) || 0, conv: Number(r[I.conv]) || 0, value: Number(r[I.value]) || 0,
  }));
}

function groupByCampaign_(rows) {
  const g = {};
  rows.forEach(r => {
    g[r.campaign_id] = g[r.campaign_id] || { name: r.campaign_name, rows: [] };
    g[r.campaign_id].rows.push(r);
  });
  return g;
}

function loadPendingKeys_() {
  const sheet = ss_().getSheetByName(CONFIG.approvalsTab);
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const header = data.shift();
  const cid = header.indexOf('campaign_id'), rid = header.indexOf('rule_id'), st = header.indexOf('status');
  const keys = {};
  data.forEach(r => { if (r[st] === 'PENDING') keys[r[cid] + '|' + r[rid]] = true; });
  return keys;
}

function appendApprovals_(proposals) {
  const sheet = getOrCreateSheet_(CONFIG.approvalsTab, APPROVAL_HEADERS);
  if (!proposals.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, proposals.length, APPROVAL_HEADERS.length)
    .setValues(proposals);
  addStatusValidation_(sheet);
}

/** Add a dropdown to the status column so a human flips PENDING → APPROVED/REJECTED. */
function addStatusValidation_(sheet) {
  const statusCol = APPROVAL_HEADERS.indexOf('status') + 1;
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['PENDING', 'APPROVED', 'REJECTED', 'DONE', 'FAILED'], true)
    .setAllowInvalid(true).build();
  sheet.getRange(2, statusCol, Math.max(sheet.getLastRow() - 1, 1), 1).setDataValidation(rule);
}

// ── shared helpers ──────────────────────────────────────────────────────────

function ss_() {
  const ss = CONFIG.spreadsheetId
    ? SpreadsheetApp.openById(CONFIG.spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No spreadsheet. Set CONFIG.spreadsheetId for a standalone script.');
  return ss;
}
function getOrCreateSheet_(name, headers) {
  const ss = ss_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}
function blank_() { return { spend: 0, conv: 0, value: 0 }; }
function accumulate_(acc, row) { acc.spend += row.spend; acc.conv += row.conv; acc.value += row.value; }
function maxDate_(rows) { return new Date(rows.map(r => r.date).filter(Boolean).sort().pop()); }
function addDays_(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function stripTime_(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function inRange_(d, a, b) { return stripTime_(d) >= stripTime_(a) && stripTime_(d) <= stripTime_(b); }
