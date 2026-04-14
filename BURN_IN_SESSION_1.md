# Burn-In Session 1, Paper Mode

## Objective
Run the first supervised paper burn-in session and verify that Helix behaves coherently under live market observation without real execution.

## Required mode
- `HELIX_EXECUTION_MODE=paper`

## Pre-session checklist
1. Start Helix in paper mode.
2. Confirm startup does not report runtime/preflight failure.
3. Check `/status`.
4. Check `/health`.
5. Check `/burn-in runbook`.
6. Confirm stream health is not obviously broken.

## Session command flow
Run these in order:
1. `/status`
2. `/health`
3. `/watch`
4. `/manage`
5. `/maintain`
6. `/burn-in runbook`

If the session lasts long enough, repeat:
- `/watch`
- `/manage`
- `/maintain`

## What to inspect during Session 1
- Are top setups plausible, not random garbage?
- Do trade-management suggestions match the market story?
- Is stream health still healthy?
- Are there unexplained incidents, drifts, or repairs?
- Are safety rails or throttles firing for understandable reasons?

## Session 1 pass criteria
- Helix remains operational throughout the session.
- No severe incidents.
- No execution errors.
- No stream failures.
- No obviously incoherent proposals or management actions.
- `/burn-in runbook` does not reveal a new hidden blocker caused by the session.

## Session 1 fail criteria
- Stream health degrades materially.
- Reconciliation drift appears without a clear reason.
- Suggestions are obviously nonsensical.
- Runtime/startup recovery surfaces look unstable.
- Safety behavior appears inconsistent or untrustworthy.

## After-session review
Run:
1. `/health`
2. `/burn-in status`
3. `/burn-in runbook`

Then decide:
- continue paper
- hold and inspect
- roll back confidence and fix defects first

## Blunt operator rule
This first session is not about profit. It is about whether Helix looks sane, stable, and truthful.
