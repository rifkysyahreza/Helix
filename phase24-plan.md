# Phase 24 Scope

Requested additions for Helix:

- live reduce execution
- live reduce-only close execution
- approval replay into execution
- richer belief-driven manager policy
- more polished operator briefing output

Implementation intent:

1. Add an execution helper that can submit reduce-only orders against real live positions using normalized account-state symbol/size context.
2. Extend pending-intent resolution so approved intents can be replayed into the execution seam rather than only changing status.
3. Make manager reasoning use learned beliefs and position context more explicitly.
4. Upgrade briefing/reporting into a cleaner operator-facing summary.

Note: this scope is under active implementation and should remain guarded, explicit, and auditable.
