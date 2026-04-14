# Helix Burn-In Runbook

## Purpose

This runbook is the operator procedure for moving Helix through:
1. paper
2. approval
3. tiny supervised autonomous

This is **not** permission to trust Helix with size.
This is a controlled validation path.

## Stage 1: Paper

### Goal
Validate signal quality, management behavior, stream stability, and safety gating without real execution.

### Required mode
- `HELIX_EXECUTION_MODE=paper`

### Minimum pass targets
- at least 10 paper cycles
- 0 severe incidents
- at most 1 drift event
- 0 execution errors
- 0 stream failures during the stage

### Operator checks after each session
- inspect `/health`
- inspect burn-in protocol summary
- inspect recent execution incidents
- confirm stream health is healthy
- confirm no unexpected safety lockouts

### Promotion rule
Promote to Approval only if the burn-in checklist is clean and operator review agrees the proposals/actions are sane.

### Rollback triggers
- repeated bad proposals
- unexpected drift or state repair
- stream instability
- safety rails firing for reasons you do not understand

## Stage 2: Approval

### Goal
Validate exact action intents and management logic under near-live conditions without autonomous submission.

### Required mode
- `HELIX_EXECUTION_MODE=approval`

### Minimum pass targets
- at least 5 reviewed approval cycles
- 0 severe incidents
- 0 execution errors
- 0 stream failures
- no obvious nonsense in open/reduce/close intents

### Operator checks after each session
- inspect approval intents
- confirm entries match thesis and trade veto logic
- confirm reduce/close/protection actions are plausible
- confirm no unhealthy drift in management behavior

### Promotion rule
Promote to Tiny Autonomous only if approval intents remain consistently sane and go-live check recommends tiny autonomous.

### Rollback triggers
- bad order intent shape
- protection logic repricing something stupid
- repeated stale-order escalation weirdness
- unexplained safety / regime throttles

## Stage 3: Tiny Supervised Autonomous

### Goal
Validate real live behavior with tiny risk and active operator supervision.

### Required mode
- `HELIX_EXECUTION_MODE=autonomous`
- tiny size only
- operator actively watching

### Minimum pass targets
- clean go-live check
- burn-in protocol next stage must indicate autonomous_tiny or continue_supervised with no unresolved blockers
- no severe incidents
- no stream instability
- no unexplained reconciliation drift

### Operating rules
- use the smallest meaningful size
- do not leave Helix unattended for long periods
- review `/health` and burn-in protocol after each session
- stop immediately if state truth looks questionable

### Hard stop triggers
- unexplained live order behavior
- repeated stream failures or reconnect churn
- incorrect reduce/close behavior
- wrong-side trade actions
- protective stop logic acting against intended position management

## Promotion and rollback logic

### Promote only when
- checklist is green
- operator review agrees
- health summary is clean
- go-live check is clean enough for the next stage

### Roll back immediately when
- severe incident occurs
- stream health degrades materially
- reconciliation reveals truth drift
- safety lockout triggers without clear explanation
- live behavior and expected behavior diverge

## Recommended operator command flow

### Before a session
- `/status`
- `/health`
- `/burn-in status`
- inspect `get_burn_in_protocol`

### During a session
- `/watch`
- `/manage`
- `/maintain`
- inspect stream health if anything looks stale

### After a session
- `/health`
- inspect incidents
- inspect burn-in protocol
- decide: hold stage, promote, or roll back

## Blunt rule
If you have to explain away something sketchy, do not promote the stage.
