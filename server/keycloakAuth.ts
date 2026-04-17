/**
 * Keycloak JWKS client module.
 *
 * Provides provider state and JWKS client singleton.
 * Initialized by initAuth.ts when auth.provider=keycloak.
 *
 * Security: JWKS caching with 10-min TTL and rate limiting per T-06-02.
 */

import jwksRsa from 'jwks-rsa';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let _provider: 'local' | 'keycloak' = 'local';
let _jwksClient: jwksRsa.JwksClient | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize Keycloak JWKS client for the given issuer URL.
 * Sets provider to 'keycloak' and configures the JWKS client with caching
 * and rate limiting per T-06-02 (prevents kid-enumeration DoS).
 *
 * @param issuer - Keycloak realm URL (e.g. https://auth.example.com/realms/emd)
 */
export function initKeycloakAuth(issuer: string): void {
  _provider = 'keycloak';
  _jwksClient = jwksRsa({
    jwksUri: `${issuer}/protocol/openid-connect/certs`,
    cache: true,
    cacheMaxAge: 10 * 60 * 1000,
    rateLimit: true,
  });
  console.log(`[keycloakAuth] JWKS client configured for ${issuer}`);
}

/**
 * Returns the current auth provider.
 * Defaults to 'local' if initKeycloakAuth has not been called.
 */
export function getAuthProvider(): 'local' | 'keycloak' {
  return _provider;
}

/**
 * Returns the JWKS client instance, or null if not initialized.
 */
export function getJwksClient(): jwksRsa.JwksClient | null {
  return _jwksClient;
}

/**
 * Reset module state to defaults.
 * FOR TESTING ONLY — do not call in production code.
 */
export function _resetForTesting(): void {
  _provider = 'local';
  _jwksClient = null;
}
