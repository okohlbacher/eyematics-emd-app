# Phase 12 — Deferred Items (discovered during execution, out of scope)

Tracking file for issues encountered while executing Phase 12 plans that are
out-of-scope for the current plan but worth triage by the next plan or
milestone owner.

## Pre-existing type errors in server/authApi.ts (discovered during Plan 12-01 Task 3)

`npx tsc -p tsconfig.server.json --noEmit` reports 3 errors in
`server/authApi.ts`:

```
server/authApi.ts(379,60): error TS2339: Property 'toLowerCase' does not exist on type 'string | string[]'.
  Property 'toLowerCase' does not exist on type 'string[]'.
server/authApi.ts(387,78): error TS2339: Property 'toLowerCase' does not exist on type 'string | string[]'.
  Property 'toLowerCase' does not exist on type 'string[]'.
server/authApi.ts(423,74): error TS2339: Property 'toLowerCase' does not exist on type 'string | string[]'.
  Property 'toLowerCase' does not exist on type 'string[]'.
```

**Verified pre-existing** via `git stash` on commit `4af7c9f` (Plan 12-01
Task 2): the same 3 errors appear when `shared/` is NOT in the server
tsconfig, so they are unrelated to Phase 12. They exist on the Phase-12
base commit `437ab7b` (Phase 12 planning merge).

Cause appears to be narrowing of Express header types — `req.headers[x]`
is `string | string[] | undefined`; the three call sites call
`.toLowerCase()` without first narrowing.

**Impact on Plan 12-01:** None — Plan 12-01 does not touch `server/authApi.ts`
and its acceptance criterion "`npx tsc -p tsconfig.server.json --noEmit`
exits 0" is interpreted per the plan's scope boundary: only NEW errors
introduced by Plan 12-01 would be in-scope. The server tsc now covers the
new `shared/` directory cleanly (0 errors in `shared/`).

**Recommendation for the next plan that touches `server/authApi.ts`:** fix
these narrowings alongside its own changes. Plan 12-02 is a good candidate
since it will register a new route on the Express stack and is likely to
trigger the `tsc -p tsconfig.server.json --noEmit` check again.
