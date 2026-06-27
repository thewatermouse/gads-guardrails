# gads-guardrails

Rule-driven Google Ads change engine with a human-in-the-loop approval gate.
Reads the `Main` tab that [`gads-warehouse`](../gads-warehouse) produces,
evaluates your rules, and proposes campaign changes (pause / budget). **Nothing
goes live until a human marks it APPROVED** — then a separate step pushes the
change via the Google Ads API. No UI, no server, just Sheets + Apps Script.

## The flow

```
gads-warehouse ──► [Main tab]
                       │
        proposeChanges()  (daily, automatic, READ-ONLY)
                       ▼
                  [Approvals tab]   ← proposals land here as PENDING
                       │
            human (or a Claude review pass) flips
            status PENDING → APPROVED / REJECTED
                       │
        applyApprovals()  (manual — the human-in-loop gate)
                       ▼
            Google Ads API  +  [Changelog tab] (audit log)
```

Two functions, deliberately split:

| Function | When | Touches Google Ads? |
|----------|------|---------------------|
| `proposeChanges()` | daily trigger | **read only** — writes proposals to a sheet |
| `applyApprovals()` | run by a human, after review | **writes** — only APPROVED rows, capped & clamped |

## Safety rails (in Config.js)

- **`dryRun: true`** by default — `applyApprovals()` round-trips to the API with
  `validateOnly`, so it confirms the change is valid **without applying it**.
  Flip to `false` only once you trust the proposals.
- **`maxActionsPerRun`** — hard cap on changes per apply run.
- **`maxBudgetChangePct`** — every budget change is clamped to ±this, no matter
  what a rule says.
- **`minDailyBudget`** — a budget cut can never drop below this floor.
- **Append-only `Changelog` tab** — every executed change is logged immutably.

## Rules

Plain declarative objects in [`src/Rules.js`](src/Rules.js) — see
[RULES.md](RULES.md) for the full schema. Three sensible starters ship in the
box (pause zero-conversion spenders, trim low-ROAS, scale strong-ROAS). Tune the
thresholds to your account; they're just numbers.

## Quick start

1. Deploy `gads-warehouse` first — this repo reads its `Main` tab.
2. `clasp create --type standalone --title "gads-guardrails"`
3. Edit [`src/Config.js`](src/Config.js) (point `spreadsheetId` at the SAME sheet
   the warehouse writes to) and [`src/Rules.js`](src/Rules.js).
4. `clasp push`; run `setup()` (reuses the warehouse's `GADS_*` secrets), then
   `installTriggers()`.
5. Run `proposeChanges()` → review the `Approvals` tab → set a row to `APPROVED`
   → run `applyApprovals()`. Keep `dryRun: true` for the first few cycles.

## Files

```
gads-guardrails/
├── README.md
├── CLAUDE.md              # deploy + how Claude acts as the review layer
├── RULES.md               # rule schema reference
├── schema.md              # Approvals + Changelog tab columns
├── .clasp.json.example
├── .gitignore
└── src/
    ├── appsscript.json
    ├── Config.js          # ← per-account knobs + safety caps
    ├── Rules.js           # ← the rule spec (edit freely)
    ├── Setup.js
    ├── GoogleAdsClient.js # read + mutate (mutate honors dryRun)
    ├── Guardrails.js      # proposeChanges(): evaluate → Approvals tab
    └── Apply.js           # applyApprovals(): APPROVED → Google Ads + Changelog
```
