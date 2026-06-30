/**
 * Config.js — DEFAULTS. You normally never edit this.
 *
 * Plug-and-play path: use the "⚙ gads-guardrails → Setup" menu in the Sheet.
 * It stores per-account values as CFG_* Script Properties, merged over these
 * defaults by applyConfigOverrides_() at the bottom. Secrets share the same
 * keys as gads-warehouse, so the same account reuses the same credentials.
 *
 * Power-user path: hardcode here and deploy via clasp.
 */
const CONFIG = {
  // ── Account ────────────────────────────────────────────────────────────
  customerId: 'XXXXXXXXXX',        // Google Ads account, digits only
  loginCustomerId: 'XXXXXXXXXX',   // MCC if used; otherwise = customerId
  oauthClientId: 'XXXXXXXXXXXX-xxxx.apps.googleusercontent.com',
  apiVersion: 'v18',

  // ── Source + destination sheet ─────────────────────────────────────────
  // Point this at the SAME spreadsheet gads-warehouse writes to.
  spreadsheetId: '',               // empty = the bound spreadsheet
  mainTab: 'Main',                 // read here (produced by gads-warehouse)
  approvalsTab: 'Approvals',       // proposals land here for human sign-off
  changelogTab: 'Changelog',       // immutable audit log of executed changes

  // ── SAFETY (read these carefully) ──────────────────────────────────────
  dryRun: true,                    // TRUE = validate against the API but never apply.
                                   //        Flip to false only once you trust the proposals.
  maxActionsPerRun: 10,            // hard cap on changes applied in one applyApprovals() run
  maxBudgetChangePct: 0.30,        // clamp any single budget change to ±30%
  minDailyBudget: 10,             // never set a daily budget below this ($)

  // ── Rule thresholds (referenced by Rules.js as config tokens) ──────────
  breakevenRoas: 1.5,              // rules trim budget below this ROAS
  scaleRoas: 4.0,                  // rules scale budget at/above this ROAS
};

/**
 * Merge Setup-dialog values (CFG_* Script Properties) over the defaults above.
 * Lets a copied template run with zero code edits. Booleans/numbers parsed.
 */
(function applyConfigOverrides_() {
  try {
    const p = PropertiesService.getScriptProperties();
    const str = ['customerId', 'loginCustomerId', 'oauthClientId', 'spreadsheetId', 'apiVersion'];
    const num = ['maxActionsPerRun', 'maxBudgetChangePct', 'minDailyBudget', 'breakevenRoas', 'scaleRoas'];
    str.forEach(k => { const v = p.getProperty('CFG_' + k); if (v) CONFIG[k] = v; });
    num.forEach(k => { const v = p.getProperty('CFG_' + k); if (v !== null && v !== '') CONFIG[k] = Number(v); });
    const dr = p.getProperty('CFG_dryRun');
    if (dr !== null && dr !== '') CONFIG.dryRun = (dr === 'true' || dr === '1');
    if (CONFIG.loginCustomerId && /^X+$/.test(CONFIG.loginCustomerId) && CONFIG.customerId) {
      CONFIG.loginCustomerId = CONFIG.customerId;
    }
  } catch (e) { /* no Properties in this context; defaults stand */ }
})();
