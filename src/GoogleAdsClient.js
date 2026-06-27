/**
 * GoogleAdsClient.js — read (GAQL) + write (mutate) wrapper.
 * The mutate calls honor CONFIG.dryRun via the API's validateOnly flag, so a
 * dry run round-trips to Google and validates without changing anything.
 */

function getAccessToken_() {
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post', muteHttpExceptions: true,
    payload: {
      client_id: CONFIG.oauthClientId,
      client_secret: getSecret_(SECRET_KEYS.oauthClientSecret),
      refresh_token: getSecret_(SECRET_KEYS.refreshToken),
      grant_type: 'refresh_token',
    },
  });
  const body = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200 || !body.access_token) {
    throw new Error('OAuth token refresh failed: ' + res.getContentText());
  }
  return body.access_token;
}

function adsHeaders_() {
  return {
    Authorization: 'Bearer ' + getAccessToken_(),
    'developer-token': getSecret_(SECRET_KEYS.developerToken),
    'login-customer-id': CONFIG.loginCustomerId,
  };
}

function adsBaseUrl_() {
  return 'https://googleads.googleapis.com/' + CONFIG.apiVersion +
    '/customers/' + CONFIG.customerId;
}

/** GAQL searchStream → flat array of result rows. */
function gaqlSearch_(query) {
  const res = UrlFetchApp.fetch(adsBaseUrl_() + '/googleAds:searchStream', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: adsHeaders_(), payload: JSON.stringify({ query: query }),
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('GAQL error ' + res.getResponseCode() + ': ' + res.getContentText());
  }
  const rows = [];
  JSON.parse(res.getContentText()).forEach(b => (b.results || []).forEach(r => rows.push(r)));
  return rows;
}

/** Generic mutate. resource e.g. 'campaigns' | 'campaignBudgets'. */
function mutate_(resource, operations) {
  const res = UrlFetchApp.fetch(adsBaseUrl_() + '/' + resource + ':mutate', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: adsHeaders_(),
    payload: JSON.stringify({
      operations: operations,
      partialFailure: false,
      validateOnly: CONFIG.dryRun,   // ← dry run validates without applying
    }),
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Mutate error ' + res.getResponseCode() + ': ' + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

// ── high-level write helpers ────────────────────────────────────────────

function pauseCampaign_(campaignId) {
  return mutate_('campaigns', [{
    update: { resourceName: 'customers/' + CONFIG.customerId + '/campaigns/' + campaignId, status: 'PAUSED' },
    updateMask: 'status',
  }]);
}

/** Resolve a campaign's budget resource + current amount (micros). */
function getCampaignBudget_(campaignId) {
  const rows = gaqlSearch_(
    'SELECT campaign_budget.resource_name, campaign_budget.amount_micros ' +
    'FROM campaign WHERE campaign.id = ' + campaignId);
  if (!rows.length) throw new Error('Campaign ' + campaignId + ' not found / no budget');
  const b = rows[0].campaignBudget;
  return { resourceName: b.resourceName, amountMicros: Number(b.amountMicros) };
}

function updateBudgetMicros_(resourceName, amountMicros) {
  return mutate_('campaignBudgets', [{
    update: { resourceName: resourceName, amountMicros: String(amountMicros) },
    updateMask: 'amount_micros',
  }]);
}
