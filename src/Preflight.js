/**
 * Preflight.js — plain-English connection check for guardrails. Adds a check
 * that the warehouse's Main tab exists (guardrails reads it) and reports the
 * current dry-run state prominently.
 */

function preflight() {
  const lines = [];
  const ok = s => lines.push('✅ ' + s);
  const bad = s => lines.push('❌ ' + s);
  const warn = s => lines.push('⚠️ ' + s);

  const p = PropertiesService.getScriptProperties();
  const missing = Object.entries(SECRET_KEYS).filter(([, k]) => !p.getProperty(k)).map(([n]) => n);
  if (missing.length) { bad('Missing secret(s): ' + missing.join(', ') + ' — run Setup.'); return lines.join('\n'); }
  ok('Secrets present.');

  if (!CONFIG.customerId || /^X+$/.test(CONFIG.customerId)) { bad('Customer ID not set — run Setup.'); return lines.join('\n'); }
  ok('Customer ID: ' + CONFIG.customerId);

  try { getAccessToken_(); ok('OAuth token refresh works.'); }
  catch (e) { bad('OAuth failed: ' + e.message); return lines.join('\n'); }

  const candidates = [CONFIG.apiVersion].concat(['v18', 'v19', 'v17', 'v20', 'v16'].filter(v => v !== CONFIG.apiVersion));
  let working = null;
  for (const v of candidates) { try { probeVersion_(v); working = v; break; } catch (e) { /* next */ } }
  if (!working) { bad('Google Ads API unreachable on any known version. Check developer-token access.'); return lines.join('\n'); }
  if (working === CONFIG.apiVersion) ok('API reachable on ' + working + '.');
  else { warn('Version ' + CONFIG.apiVersion + ' failed; ' + working + ' works — saving it.');
    p.setProperty('CFG_apiVersion', working); }

  // Main tab from the warehouse
  try {
    const ss = ss_();
    const main = ss.getSheetByName(CONFIG.mainTab);
    if (!main || main.getLastRow() < 2) warn('Main tab is empty — deploy/run gads-warehouse first so there is data to evaluate.');
    else ok('Main tab found (' + (main.getLastRow() - 1) + ' rows).');
  } catch (e) { bad('Sheet problem: ' + e.message); }

  // Safety state
  lines.push('');
  lines.push((CONFIG.dryRun ? '🟢 Dry-run is ON' : '🔴 Dry-run is OFF (changes go live)') +
    ' · budget clamp ±' + Math.round(CONFIG.maxBudgetChangePct * 100) + '% · break-even ROAS ' +
    CONFIG.breakevenRoas + ' · scale ROAS ' + CONFIG.scaleRoas);
  lines.push('Run "3. Propose changes now" to generate proposals.');
  return lines.join('\n');
}

function probeVersion_(version) {
  const url = 'https://googleads.googleapis.com/' + version +
    '/customers/' + CONFIG.customerId + '/googleAds:searchStream';
  const res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + getAccessToken_(),
      'developer-token': getSecret_(SECRET_KEYS.developerToken),
      'login-customer-id': CONFIG.loginCustomerId,
    },
    payload: JSON.stringify({ query: 'SELECT customer.id FROM customer LIMIT 1' }),
  });
  if (res.getResponseCode() !== 200) throw new Error(res.getResponseCode() + ': ' + res.getContentText());
}
