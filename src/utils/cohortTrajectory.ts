// retained: re-export shim consumed by 17 callers (src/components/outcomes/*,
// src/services/outcomesAggregateService.ts, tests/helpers/renderOutcomesView.tsx,
// and multiple test files via vi.mock('../src/utils/cohortTrajectory', ...) factories).
// tests/cohortTrajectoryShared.test.ts is the Phase 12 shared-extraction parity
// test that deliberately compares this shim to shared/cohortTrajectory for
// byte-identical output — deletion would break the parity test contract.
// Per D-06 / D-15 this is a stable public import surface; canonical source is
// shared/cohortTrajectory.ts and is imported from below.
export * from '../../shared/cohortTrajectory';
