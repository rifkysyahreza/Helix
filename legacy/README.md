# Legacy quarantine

This folder holds historical Helix surfaces that are **not part of the active Hyperliquid-perps runtime path**.

Why it exists:
- preserve reusable or reference-worthy older work
- keep audit history intact
- stop legacy LP/Meteora code from confusing the active repo shape

What is in here:
- old Meteora / DLMM tooling
- old screening test surfaces
- old Discord listener
- old `.claude` agent/command files

Rules:
- do not wire active runtime imports back into this folder casually
- treat this folder as archive/reference unless there is a deliberate migration plan
- if something from here is revived, port it back intentionally and update docs/tests
