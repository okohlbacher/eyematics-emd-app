# Keycloak Setup Guide for EMD

This guide covers configuring Keycloak as the authentication provider for the EMD application.

## Prerequisites

- Keycloak server running (v22+ recommended)
- Admin access to Keycloak Administration Console
- EMD application deployed and accessible
- Network connectivity between EMD server and Keycloak server

## 1. Create Realm

1. Log in to Keycloak Administration Console
2. Click "Create realm"
3. Set Realm name: `emd`
4. Click "Create"

## 2. Create Client

1. Navigate to Clients > Create client
2. Client type: OpenID Connect
3. Client ID: `emd-app`
4. Click Next
5. Client authentication: OFF (public client)
6. Authorization: OFF
7. Click Next
8. Valid redirect URIs: `https://your-emd-server/*`
9. Web origins: `https://your-emd-server`
10. Click Save

## 3. Create Realm Roles

Create one realm role for each EMD role:

| Keycloak Realm Role | EMD Role | Description |
|---------------------|----------|-------------|
| admin | admin | Full system access |
| researcher | researcher | Research data access |
| epidemiologist | epidemiologist | Epidemiological analysis |
| clinician | clinician | Clinical data access |
| data_manager | data_manager | Data management |
| clinic_lead | clinic_lead | Clinic leadership access |

Steps:
1. Navigate to Realm roles > Create role
2. Enter role name (must match exactly as shown above)
3. Click Save
4. Repeat for all 6 roles

## 4. Configure Token Claim Mappers

EMD requires two custom claims in the access token: `role` and `centers`.

### 4.1 Role Mapper

Maps the user's primary realm role to a `role` claim in the token.

1. Navigate to Client scopes > `emd-app-dedicated` (or create a new scope assigned to the client)
2. Click Mappers > Add mapper > By configuration
3. Select "User Realm Role"
4. Configure:
   - Name: `emd-role`
   - Token Claim Name: `role`
   - Multivalued: **OFF** (EMD expects a single role string)
   - Add to ID token: ON
   - Add to access token: ON
   - Add to userinfo: ON
5. Click Save

### 4.2 Centers Mapper

Maps the user's `centers` attribute to a `centers` array claim in the token.

1. Navigate to Client scopes > `emd-app-dedicated` > Mappers > Add mapper > By configuration
2. Select "User Attribute"
3. Configure:
   - Name: `emd-centers`
   - User Attribute: `centers`
   - Token Claim Name: `centers`
   - Claim JSON Type: String
   - Multivalued: **ON** (EMD expects an array of center codes)
   - Add to ID token: ON
   - Add to access token: ON
   - Add to userinfo: ON
4. Click Save

## 5. Create Users

1. Navigate to Users > Add user
2. Set username (will map to `preferred_username` in JWT)
3. Set email, first name, last name as needed
4. Click Create
5. Go to Role mapping tab > Assign role > select one EMD role (e.g., `researcher`)
6. Go to Attributes tab > Add attribute:
   - Key: `centers`
   - Value: center code (e.g., `org-uka`)
   - For multiple centers, add multiple values: `org-uka`, `org-ukb`, etc.
7. Go to Credentials tab > Set password

Valid center codes: `org-uka`, `org-ukb`, `org-lmu`, `org-ukt`, `org-ukm`

## 6. Configure EMD settings.yaml

Update the EMD application's `config/settings.yaml`:

```yaml
auth:
  provider: keycloak
  twoFactorEnabled: false
  maxLoginAttempts: 5
  otpCode: '123456'
  keycloak:
    issuer: https://your-keycloak-server/realms/emd
    clientId: emd-app
```

Replace `https://your-keycloak-server` with your actual Keycloak server URL.

**Important:** Restart the EMD server after changing `auth.provider`. The provider is read once at startup.

## 7. Verification

### 7.1 Verify JWKS Endpoint

```bash
curl -s https://your-keycloak-server/realms/emd/protocol/openid-connect/certs | jq .
```

Should return a JSON object with a `keys` array containing RSA public keys.

### 7.2 Verify Token Claims

1. Obtain a test token:
```bash
curl -s -X POST https://your-keycloak-server/realms/emd/protocol/openid-connect/token \
  -d "client_id=emd-app" \
  -d "username=testuser" \
  -d "password=testpassword" \
  -d "grant_type=password" | jq -r '.access_token'
```

2. Decode the token at https://jwt.io and verify these claims are present:
   - `sub` — unique user ID
   - `preferred_username` — username
   - `role` — single string matching an EMD role
   - `centers` — array of center codes (e.g., `["org-uka", "org-ukb"]`)

### 7.3 Verify EMD Integration

1. Start the EMD server with `auth.provider: keycloak` in settings.yaml
2. Open the EMD login page — should show "Login with Keycloak" button instead of username/password form
3. Check server logs for: `[keycloakAuth] JWKS client configured for https://your-keycloak-server/realms/emd`

## Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| 503 on all API requests | Keycloak server unreachable | Check network connectivity to Keycloak; verify `auth.keycloak.issuer` URL |
| 401 with valid Keycloak token | Missing `role` or `centers` claim | Verify token mappers in step 4; decode token to check claims |
| Role shows as array in token | Multivalued ON for role mapper | Set Multivalued to OFF in the role mapper (step 4.1) |
| Login page still shows local form | Config not updated | Verify `auth.provider: keycloak` in settings.yaml; restart EMD server |
| "Keycloak auth not initialized" | Missing keycloak config | Verify `auth.keycloak.issuer` is set in settings.yaml |

## Current Limitations (v1)

- The "Login with Keycloak" button shows an informational message only — the full OIDC redirect flow is planned for v2
- Token refresh is not yet implemented — sessions expire per Keycloak token lifetime
- No automatic role sync — roles must be configured manually in both Keycloak and EMD
