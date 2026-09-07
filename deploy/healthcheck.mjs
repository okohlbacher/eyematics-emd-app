// Liveness probe shared by HEALTHCHECK (Containerfile) and HealthCmd (deploy/EMD.container).
// The inner port is fixed at 3000 — remap on the host side (PublishPort / -p), not in settings.yaml.
fetch('http://127.0.0.1:3000/healthz').then(
  (r) => process.exit(r.ok ? 0 : 1),
  () => process.exit(1),
);
