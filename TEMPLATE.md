# Making the plug-and-play template (one-time, ~5 min)

Same idea as the warehouse: build one master Sheet with a bound script, then
hand out a "Make a copy" link. No clasp/code for end users.

## Build the master (you, once)

1. Create a new blank Google Sheet (or reuse the same sheet as the warehouse —
   guardrails reads the warehouse's `Main` tab, so co-locating them is fine and
   means one set of credentials).
2. Attach this code as a bound script:
   ```bash
   git clone https://github.com/thewatermouse/gads-guardrails && cd gads-guardrails
   clasp create --type sheets --title "gads-guardrails" --parentId <THE_SHEET_ID>
   clasp push
   ```
   (Or paste `src/*` via Extensions → Apps Script.)
3. Reload the Sheet. Confirm the **🛡 gads-guardrails** menu appears.

## Distribute

```
https://docs.google.com/spreadsheets/d/<THE_SHEET_ID>/copy
```

Each user: **Make a copy → 🛡 gads-guardrails → 1. Setup** (enter creds, set
break-even/scale ROAS, **leave Dry-run ON**) → **2. Check connection** →
**3. Propose changes now** → review the Approvals tab → **Apply APPROVED
changes** (confirms first).

## Safety notes specific to guardrails

- The master ships with **Dry-run ON** by default. Don't distribute a master with
  it off.
- "Apply" is deliberately one extra click with a confirm dialog, and it never
  runs on a schedule — only `Propose` does. The human approving in the sheet is
  the gate.
- Script Properties (secrets + the dry-run flag) are not copied with the sheet,
  so every copy starts safe and isolated.
