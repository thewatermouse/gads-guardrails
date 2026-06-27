/**
 * Apply.js — execute APPROVED proposals against Google Ads.
 * Entry point: applyApprovals(). Run by a human after reviewing the Approvals
 * tab. Respects CONFIG.dryRun, CONFIG.maxActionsPerRun, budget clamps.
 */

function applyApprovals() {
  const sheet = ss_().getSheetByName(CONFIG.approvalsTab);
  if (!sheet) { Logger.log('No Approvals tab.'); return; }

  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const col = name => header.indexOf(name);
  const C = {
    cid: col('campaign_id'), action: col('action'), detail: col('detail'),
    status: col('status'), result: col('result'), applied: col('applied_at'),
    name: col('campaign_name'), rule: col('rule_id'),
  };

  let applied = 0;
  const now = new Date().toISOString();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[C.status] !== 'APPROVED') continue;
    if (applied >= CONFIG.maxActionsPerRun) { Logger.log('Hit maxActionsPerRun cap.'); break; }

    const sheetRow = i + 1;
    try {
      const result = executeAction_(row[C.action], String(row[C.cid]), row[C.detail]);
      const status = CONFIG.dryRun ? 'PENDING' : 'DONE';   // dry run leaves it for real apply
      sheet.getRange(sheetRow, C.result + 1).setValue((CONFIG.dryRun ? '[DRY RUN] ' : '') + result);
      sheet.getRange(sheetRow, C.status + 1).setValue(status);
      sheet.getRange(sheetRow, C.applied + 1).setValue(CONFIG.dryRun ? '' : now);
      if (!CONFIG.dryRun) logChange_(row, C, result, now);
      applied++;
    } catch (e) {
      sheet.getRange(sheetRow, C.result + 1).setValue('ERROR: ' + e.message);
      sheet.getRange(sheetRow, C.status + 1).setValue('FAILED');
    }
  }

  Logger.log('✅ applyApprovals: ' + applied + ' action(s) ' +
    (CONFIG.dryRun ? 'validated (DRY RUN — nothing changed).' : 'applied.'));
}

/** Dispatch one action. Returns a human-readable result string. */
function executeAction_(actionType, campaignId, detail) {
  if (actionType === 'PAUSE_CAMPAIGN') {
    pauseCampaign_(campaignId);
    return 'paused';
  }
  if (actionType === 'ADJUST_BUDGET') {
    const pct = parsePct_(detail);                 // from "budget +20% (...)"
    const clamped = clamp_(pct, -CONFIG.maxBudgetChangePct, CONFIG.maxBudgetChangePct);
    const b = getCampaignBudget_(campaignId);
    let next = Math.round(b.amountMicros * (1 + clamped));
    const floor = CONFIG.minDailyBudget * 1e6;
    if (next < floor) next = floor;
    updateBudgetMicros_(b.resourceName, next);
    return 'budget $' + money_(b.amountMicros) + ' → $' + money_(next) +
      (clamped !== pct ? ' (clamped to ' + Math.round(clamped * 100) + '%)' : '');
  }
  throw new Error('Unknown action: ' + actionType);
}

/** Append an immutable record of an executed change. Feeds a future test-ledger repo. */
function logChange_(row, C, result, ts) {
  const sheet = getOrCreateSheet_(CONFIG.changelogTab,
    ['applied_at', 'campaign_id', 'campaign_name', 'rule_id', 'action', 'result']);
  sheet.appendRow([ts, row[C.cid], row[C.name], row[C.rule], row[C.action], result]);
}

// ── helpers ─────────────────────────────────────────────────────────────
function parsePct_(detail) {
  const m = String(detail).match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (!m) throw new Error('Could not parse pct from detail: ' + detail);
  return Number(m[1]) / 100;
}
function clamp_(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function money_(micros) { return (Number(micros) / 1e6).toFixed(2); }
