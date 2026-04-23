// retained: re-export shim consumed by 30+ src/ callers across pages,
// components, hooks, context, and services. Convention (see 16-03-SUMMARY.md
// key-decisions) is that src/ imports types via this shim; shared/ modules
// import via './types/fhir.js' directly. Preserving this convention avoids
// a repo-wide churn on type-only imports. Canonical source: shared/types/fhir.ts
export * from '../../shared/types/fhir';
