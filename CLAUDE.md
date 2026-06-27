# CLAUDE.md — gads-guardrails

Instructions for a Claude project handed this repo. It does two jobs: **deploy
the engine**, and **act as the review layer** between `proposeChanges()` and
`applyApprovals()`.

## What this is

An Apps Script project that reads the `Main` tab (from `gads-warehouse`),
evaluates `Rules.js`, and writes proposed campaign changes to an `Approvals`
tab. A human approves; `applyApprovals()` pushes approved changes to Google Ads.
There is no server. Writes honor `CONFIG.dryRun`.

## Deploy checklist

1. Ensure `gads-warehouse` is deployed and writing the `Main` tab.
2. `clasp` installed + logged in; `clasp create --type standalone` writes `.clasp.json`.
3. Edit `src/Config.js`: account IDs, and set `spreadsheetId` to the SAME sheet
   the warehouse writes to (or leave empty if both are bound to it). Review the
   safety caps. **Leave `dryRun: true` for initial rollout.**
4. Edit `src/Rules.js` thresholds for this account.
5. `clasp push`; run `setup()` (reuses the warehouse `GADS_*` Script Properties —
   no new credentials needed if same account), then `installTriggers()`.
6. Run `proposeChanges()`; confirm proposals appear in `Approvals` as PENDING.

## Claude as the review layer (the valuable part)

After `proposeChanges()` runs, before a human approves, a Claude project pointed
at this sheet should:

1. Read the PENDING rows in the `Approvals` tab and the underlying `Main` data.
2. For each proposal, **sharpen the `reason`** and add judgment the numeric rules
   can't: Is this campaign mid-learning? Is spend trending the right way despite a
   bad 7-day snapshot? Is it a shared budget (one budget change hits several
   campaigns)? Is there a known seasonality or a paused-platform reason (check the
   user's context/memory) that explains the anomaly?
3. **Recommend** APPROVE or REJECT per row with a one-line rationale — but DO NOT
   flip the status yourself unless the user explicitly tells you to. The human
   sets `status`. That is the whole point of the gate.
4. Surface anything the rules missed (e.g. a campaign the user would obviously
   want paused that no rule caught) as a note, not an action.

Claude is the *narrative + judgment* layer. The deterministic engine proposes;
Claude annotates and advises; the human decides; the script executes.

## Operating

- `proposeChanges()` — safe to run anytime; read-only; dedupes against existing PENDING.
- `applyApprovals()` — only acts on `APPROVED` rows; respects `maxActionsPerRun`,
  clamps budget changes to `maxBudgetChangePct`, floors at `minDailyBudget`.
- Going live: run a few cycles with `dryRun: true` (results prefixed `[DRY RUN]`,
  status stays PENDING). When the validations look right, set `dryRun: false`.

## Guardrails when editing

- NEVER auto-schedule `applyApprovals()`. It must stay human-triggered.
- Don't widen the safety caps without the user explicitly asking.
- Budget changes operate on the campaign's budget resource — flag shared budgets,
  which affect multiple campaigns.
- Keep `proposeChanges()` read-only. All writes to Google Ads live in `Apply.js`.
