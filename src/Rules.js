/**
 * Rules.js — the rule "spec". Plain declarative objects; edit freely per account.
 *
 * Each rule is evaluated per campaign over a trailing window of `window` days
 * (ending on the latest date present in the Main tab). ALL clauses in `when`
 * must pass for the rule to fire. A firing rule writes a PENDING proposal to the
 * Approvals tab — nothing is applied until a human marks it APPROVED.
 *
 * Available metrics (computed per campaign over the window):
 *   spend         total spend
 *   conversions   total conversions
 *   value         total conversion value (revenue)
 *   cpa           spend / conversions
 *   roas          value / spend
 *   spend_pct     % change vs the prior equal-length window  (e.g. 0.25 = +25%)
 *   roas_pct      % change in roas vs the prior window
 *
 * Operators: '>'  '>='  '<'  '<='  '=='  '!='
 *
 * Actions:
 *   { type: 'PAUSE_CAMPAIGN' }
 *   { type: 'ADJUST_BUDGET', pct: -0.20 }   // ±fraction; clamped by CONFIG.maxBudgetChangePct
 */
const RULES = [
  {
    id: 'pause-zero-conv-spenders',
    window: 7,
    when: [
      { metric: 'spend', op: '>=', value: 100 },
      { metric: 'conversions', op: '==', value: 0 },
    ],
    action: { type: 'PAUSE_CAMPAIGN' },
    note: 'Spent ≥$100 over 7d with 0 conversions',
  },
  {
    id: 'cut-budget-high-cpa',
    window: 7,
    when: [
      { metric: 'spend', op: '>=', value: 50 },
      { metric: 'conversions', op: '>=', value: 1 },
      { metric: 'roas', op: '<', value: 'breakevenRoas' },   // resolved from Setup (config token)
    ],
    action: { type: 'ADJUST_BUDGET', pct: -0.20 },
    note: 'ROAS below break-even over 7d on a spending campaign — trim 20%',
  },
  {
    id: 'scale-strong-roas',
    window: 7,
    when: [
      { metric: 'spend', op: '>=', value: 50 },
      { metric: 'roas', op: '>=', value: 'scaleRoas' },  // resolved from Setup (config token)
    ],
    action: { type: 'ADJUST_BUDGET', pct: 0.20 },
    note: 'ROAS ≥ 4.0 over 7d — scale budget 20%',
  },
];
