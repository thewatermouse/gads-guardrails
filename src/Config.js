/**
 * Config.js — THE ONLY FILE YOU EDIT PER ACCOUNT (besides Rules.js).
 *
 * Secrets (developer token, OAuth client secret, refresh token) live in
 * Script Properties — see Setup.js. They share the same keys as gads-warehouse,
 * so if both run in the same account you reuse the same credentials.
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
};
