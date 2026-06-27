/**
 * Setup.js — one-time setup. Shares secret keys with gads-warehouse.
 */
const SECRET_KEYS = {
  developerToken: 'GADS_DEVELOPER_TOKEN',
  oauthClientSecret: 'GADS_OAUTH_CLIENT_SECRET',
  refreshToken: 'GADS_REFRESH_TOKEN',
};

/** Run once. Logs which Script Properties to set (Project Settings → Script Properties). */
function setup() {
  const props = PropertiesService.getScriptProperties();
  const missing = Object.values(SECRET_KEYS).filter(k => !props.getProperty(k));
  if (missing.length === 0) {
    Logger.log('✅ Secrets present. Run proposeChanges() then (after review) applyApprovals().');
    return;
  }
  Logger.log('Add these Script Properties:');
  Logger.log('  ' + SECRET_KEYS.developerToken + '     = <Google Ads developer token>');
  Logger.log('  ' + SECRET_KEYS.oauthClientSecret + ' = <OAuth client secret>');
  Logger.log('  ' + SECRET_KEYS.refreshToken + '      = <OAuth refresh token>');
  Logger.log('Still missing: ' + missing.join(', '));
}

function getSecret_(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Missing Script Property: ' + key + ' — run setup().');
  return v;
}

/**
 * Schedule the PROPOSE step daily. Applying changes is deliberately NOT
 * scheduled — applyApprovals() is run by a human (or a Claude review pass)
 * after the Approvals tab has been signed off. That's the human-in-loop gate.
 */
function installTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'proposeChanges')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('proposeChanges')
    .timeBased().everyDays(1).atHour(7) // after the warehouse 6am pull
    .create();

  Logger.log('✅ Installed daily trigger for proposeChanges() at ~7am. applyApprovals() stays manual.');
}
