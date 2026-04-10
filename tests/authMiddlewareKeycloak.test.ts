import { describe, it, expect, beforeEach } from 'vitest';
import { initKeycloakAuth, getAuthProvider, getJwksClient, _resetForTesting } from '../server/keycloakAuth.js';

describe('keycloakAuth module', () => {
  beforeEach(() => { _resetForTesting(); });

  it('defaults to local provider', () => {
    expect(getAuthProvider()).toBe('local');
  });

  it('getJwksClient returns null before init', () => {
    expect(getJwksClient()).toBeNull();
  });

  it('switches to keycloak after initKeycloakAuth', () => {
    initKeycloakAuth('https://auth.example.com/realms/emd');
    expect(getAuthProvider()).toBe('keycloak');
    expect(getJwksClient()).not.toBeNull();
  });
});
