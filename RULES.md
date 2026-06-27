# RULES.md — rule schema

Rules live in [`src/Rules.js`](src/Rules.js) as a plain array. Each rule is
evaluated **per campaign** over a trailing window. All clauses in `when` must
pass for the rule to fire; a firing rule writes one PENDING proposal.

## Shape

```js
{
  id: 'unique-kebab-id',     // also the dedupe key (one PENDING per campaign+id)
  window: 7,                 // trailing days, ending on latest date in Main
  when: [                    // ALL must pass (logical AND)
    { metric: 'spend', op: '>=', value: 100 },
    { metric: 'conversions', op: '==', value: 0 },
  ],
  action: { type: 'PAUSE_CAMPAIGN' },
  note: 'human-readable why',
}
```

## Metrics (computed per campaign over `window`)

| Metric | Meaning |
|--------|---------|
| `spend` | total spend in the window |
| `conversions` | total conversions |
| `value` | total conversion value (revenue) |
| `cpa` | `spend / conversions` (`∞` if 0 conversions) |
| `roas` | `value / spend` |
| `spend_pct` | % change vs the prior equal-length window (`0.25` = +25%) |
| `roas_pct` | % change in ROAS vs the prior window |

## Operators

`>`  `>=`  `<`  `<=`  `==`  `!=`

## Actions

| Action | Effect |
|--------|--------|
| `{ type: 'PAUSE_CAMPAIGN' }` | sets campaign status PAUSED |
| `{ type: 'ADJUST_BUDGET', pct: -0.20 }` | multiplies daily budget by `1+pct`; clamped to `±CONFIG.maxBudgetChangePct`, floored at `CONFIG.minDailyBudget` |

## Notes & gotchas

- **AND only.** For OR logic, write two rules with different `id`s.
- **Dedupe is by `campaign_id + id`.** While a proposal is PENDING, the same rule
  won't re-propose for that campaign. Once it's APPROVED/REJECTED/DONE, the rule
  can fire again on a future run if conditions still hold — so reject things you
  want to stay rejected, don't leave them PENDING.
- **Budget `pct` is intent, not guarantee.** The actual $ is resolved at apply
  time from the live budget, then clamped/floored. A rule asking for -50% becomes
  -30% if that's your cap.
- **Shared budgets** affect every campaign on that budget — Claude's review pass
  is told to flag these.
- Tune thresholds to the account's break-even ROAS / target CPA. The shipped
  numbers are conservative placeholders.
