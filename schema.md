# Tabs this repo writes

## Approvals tab

One row per proposed change. Humans interact with the `status` column (a
dropdown is added automatically).

| Column | Notes |
|--------|-------|
| `proposal_id` | short unique id |
| `created_at` | ISO timestamp when proposed |
| `campaign_id` | Google Ads campaign id |
| `campaign_name` | |
| `rule_id` | which rule fired (from Rules.js) |
| `action` | `PAUSE_CAMPAIGN` or `ADJUST_BUDGET` |
| `detail` | e.g. `pause campaign`, `budget +20% (resolved at apply)` |
| `reason` | rule note + the metric values that triggered it (Claude sharpens this) |
| `status` | `PENDING` → human sets `APPROVED` / `REJECTED` → engine sets `DONE` / `FAILED` |
| `result` | what `applyApprovals()` did, e.g. `budget $50.00 → $60.00`; dry runs prefixed `[DRY RUN]` |
| `applied_at` | ISO timestamp when actually applied (blank on dry run) |

**Status lifecycle:** `PENDING` → (human) `APPROVED`/`REJECTED` → (apply)
`DONE`/`FAILED`. Dry-run applies leave status at `PENDING` and only fill `result`.

## Changelog tab (append-only audit)

Written only on real (non-dry-run) applies. Immutable history; intended to feed a
future `test-ledger` / reporting repo.

| Column | Notes |
|--------|-------|
| `applied_at` | ISO timestamp |
| `campaign_id` | |
| `campaign_name` | |
| `rule_id` | |
| `action` | |
| `result` | human-readable outcome |
