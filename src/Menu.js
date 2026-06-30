/**
 * Menu.js — no-code surface for guardrails. When bound to a Sheet, onOpen()
 * adds a "🛡 gads-guardrails" menu. Applying changes is kept one extra click
 * away (with a confirm) because it can alter live spend.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🛡 gads-guardrails')
    .addItem('1. Setup…', 'openSetup')
    .addItem('2. Check connection (preflight)', 'runPreflightDialog')
    .addItem('3. Propose changes now', 'proposeChanges')
    .addItem('4. Review → open Approvals tab', 'openApprovals')
    .addSeparator()
    .addItem('Apply APPROVED changes…', 'applyApprovalsConfirm')
    .addItem('Install daily PROPOSE schedule', 'installTriggers')
    .addToUi();
}

function openSetup() {
  const html = HtmlService.createHtmlOutputFromFile('Setup').setTitle('gads-guardrails setup');
  SpreadsheetApp.getUi().showSidebar(html);
}

function saveSetup(form) {
  const props = PropertiesService.getScriptProperties();
  if (form.developerToken) props.setProperty(SECRET_KEYS.developerToken, form.developerToken.trim());
  if (form.oauthClientSecret) props.setProperty(SECRET_KEYS.oauthClientSecret, form.oauthClientSecret.trim());
  if (form.refreshToken) props.setProperty(SECRET_KEYS.refreshToken, form.refreshToken.trim());

  const setCfg = (k, v) => { if (v !== undefined && v !== '') props.setProperty('CFG_' + k, String(v).trim()); };
  setCfg('customerId', form.customerId);
  setCfg('loginCustomerId', form.loginCustomerId || form.customerId);
  setCfg('oauthClientId', form.oauthClientId);
  setCfg('breakevenRoas', form.breakevenRoas);
  setCfg('scaleRoas', form.scaleRoas);
  setCfg('maxBudgetChangePct', form.maxBudgetChangePct);
  setCfg('minDailyBudget', form.minDailyBudget);
  setCfg('maxActionsPerRun', form.maxActionsPerRun);
  // dryRun is a checkbox: store explicit 'true'/'false'
  props.setProperty('CFG_dryRun', form.dryRun ? 'true' : 'false');

  return 'Saved. ' + (form.dryRun ? 'Dry-run is ON (safe).' : '⚠️ Dry-run is OFF — changes will go live.');
}

function loadSetup() {
  const p = PropertiesService.getScriptProperties();
  const has = k => (p.getProperty(k) ? '••••••••' : '');
  const dr = p.getProperty('CFG_dryRun');
  return {
    developerToken: has(SECRET_KEYS.developerToken),
    oauthClientSecret: has(SECRET_KEYS.oauthClientSecret),
    refreshToken: has(SECRET_KEYS.refreshToken),
    customerId: p.getProperty('CFG_customerId') || '',
    loginCustomerId: p.getProperty('CFG_loginCustomerId') || '',
    oauthClientId: p.getProperty('CFG_oauthClientId') || CONFIG.oauthClientId || '',
    breakevenRoas: p.getProperty('CFG_breakevenRoas') || CONFIG.breakevenRoas,
    scaleRoas: p.getProperty('CFG_scaleRoas') || CONFIG.scaleRoas,
    maxBudgetChangePct: p.getProperty('CFG_maxBudgetChangePct') || CONFIG.maxBudgetChangePct,
    minDailyBudget: p.getProperty('CFG_minDailyBudget') || CONFIG.minDailyBudget,
    maxActionsPerRun: p.getProperty('CFG_maxActionsPerRun') || CONFIG.maxActionsPerRun,
    dryRun: dr === null ? true : (dr === 'true'),
  };
}

function runPreflightDialog() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Connection check', preflight(), ui.ButtonSet.OK);
}

function openApprovals() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.approvalsTab);
  if (sheet) sheet.activate();
  else SpreadsheetApp.getUi().alert('No Approvals tab yet — run "3. Propose changes now" first.');
}

/** Apply with an explicit confirm; surfaces dry-run vs live state. */
function applyApprovalsConfirm() {
  const ui = SpreadsheetApp.getUi();
  const live = !CONFIG.dryRun;
  const msg = live
    ? '⚠️ Dry-run is OFF. This will apply APPROVED changes to LIVE Google Ads campaigns. Continue?'
    : 'Dry-run is ON — this validates APPROVED changes without applying them. Continue?';
  if (ui.alert('Apply approved changes', msg, ui.ButtonSet.YES_NO) === ui.Button.YES) {
    applyApprovals();
    ui.alert('Done. See the result column in the Approvals tab' + (live ? ' and the Changelog.' : ' ([DRY RUN]).'));
  }
}
