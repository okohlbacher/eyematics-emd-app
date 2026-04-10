# EMD Architecture — After Phase 2

## System Overview

```mermaid
graph TB
    subgraph Browser["Browser (Client)"]
        SPA["React SPA<br/>Vite build"]
        Auth["AuthContext<br/>JWT in sessionStorage"]
        AH["authHeaders.ts<br/>Bearer token injection"]
        Pages["Pages<br/>LoginPage, AuditPage,<br/>CohortBuilder, ..."]
    end

    subgraph Express["Express Production Server (server/index.ts)"]
        JSON_PARSE["express.json()<br/>/api/auth/* only"]
        AUDIT_MW["auditMiddleware<br/>Logs all /api/* requests<br/>Redacts passwords/OTPs"]
        AUTH_MW["authMiddleware<br/>JWT validation on /api/*<br/>Rejects challenge tokens"]

        subgraph Routes["API Routes"]
            AUTH_API["authApiRouter<br/>POST /login, /verify<br/>GET /config, /users"]
            ISSUE_API["issueApiHandler<br/>POST /api/issues"]
            SETTINGS_API["settingsApiHandler<br/>GET/PUT /api/settings"]
            AUDIT_API["auditApiRouter<br/>GET /, /export"]
        end

        STATIC["express.static(dist/)"]
        SPA_FB["SPA Fallback<br/>GET /* → index.html"]
        FHIR_PROXY["FHIR Proxy<br/>/fhir → Blaze"]
    end

    subgraph Data["Data Layer (data/)"]
        JWT_SECRET["jwt-secret.txt<br/>HS256 signing key"]
        USERS["users.json<br/>bcrypt hashes, roles, centers"]
        AUDIT_DB["audit.db (SQLite)<br/>WAL mode, auto-purge"]
        ISSUES_DIR["feedback/<br/>Issue JSON files"]
    end

    subgraph Config["Configuration"]
        YAML["settings.yaml<br/>auth, audit, server,<br/>dataSource, thresholds"]
    end

    subgraph External["External (Optional)"]
        BLAZE["Blaze FHIR Server<br/>localhost:8080"]
        FHIR_DATA["public/data/<br/>Local FHIR bundles"]
    end

    %% Client → Server
    Pages --> AH
    AH -->|"Authorization: Bearer JWT"| JSON_PARSE
    Auth -->|"POST /api/auth/login"| AUTH_API

    %% Middleware chain
    JSON_PARSE --> AUDIT_MW
    AUDIT_MW --> AUTH_MW
    AUTH_MW --> Routes

    %% Routes → Data
    AUTH_API --> JWT_SECRET
    AUTH_API --> USERS
    AUDIT_MW --> AUDIT_DB
    AUDIT_API --> AUDIT_DB
    ISSUE_API --> ISSUES_DIR
    SETTINGS_API --> YAML

    %% Static + FHIR
    STATIC --> SPA
    FHIR_PROXY --> BLAZE
    Express --> FHIR_DATA

    %% Config
    YAML -.->|"startup read"| Express

    classDef middleware fill:#fef3c7,stroke:#d97706
    classDef data fill:#dbeafe,stroke:#2563eb
    classDef external fill:#f3e8ff,stroke:#7c3aed

    class JSON_PARSE,AUDIT_MW,AUTH_MW middleware
    class JWT_SECRET,USERS,AUDIT_DB,ISSUES_DIR data
    class BLAZE,FHIR_DATA external
```

## Middleware Execution Order

```
Request → express.json(/api/auth/*) → auditMiddleware(/api/*) → authMiddleware(/api/*) → Route Handler → Response
                                              ↓                                                              ↓
                                        res.on('finish')  ──────────────────────────────────────→  logAuditEntry(SQLite)
```

1. **express.json** — Parses JSON body, mounted only on `/api/auth/*` (other handlers use `readBody()`)
2. **auditMiddleware** — Wraps response, logs on `finish` event with timing, user, status, redacted body
3. **authMiddleware** — Validates JWT Bearer token, rejects challenge-purpose tokens, skips public paths
4. **Route handler** — Processes request with `req.auth` guaranteed present

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant L as LoginPage
    participant C as AuthContext
    participant S as POST /api/auth/login
    participant V as POST /api/auth/verify
    participant M as authMiddleware

    U->>L: Enter username + password
    L->>C: login(username, password)
    C->>S: POST {username, password}
    S->>S: bcrypt.compare()

    alt 2FA disabled
        S-->>C: {token: JWT}
        C->>C: setJwt(token), decode payload
        C-->>L: {ok: true}
        L->>U: Navigate to home
    else 2FA enabled
        S-->>C: {challengeToken: JWT(purpose=challenge)}
        C-->>L: {needsOtp: true, challengeToken}
        L->>U: Show OTP input
        U->>L: Enter OTP
        L->>C: verifyOtp(challengeToken, otp)
        C->>V: POST {challengeToken, otp}
        V-->>C: {token: JWT}
        C->>C: setJwt(token), decode payload
        C-->>L: {ok: true}
        L->>U: Navigate to home
    end

    Note over C,M: All subsequent API calls include<br/>Authorization: Bearer JWT
```

## Audit Data Flow

```mermaid
flowchart LR
    REQ["API Request"] --> MW["auditMiddleware"]
    MW --> NEXT["next()"]
    NEXT --> HANDLER["Route Handler"]
    HANDLER --> RES["Response"]
    RES -->|"res.on('finish')"| LOG["logAuditEntry()"]
    LOG --> DB["SQLite audit.db"]
    DB -->|"GET /api/audit"| PAGE["AuditPage"]
    PAGE -->|"classifyEntry()"| DISPLAY["Translated Events<br/>(Anmeldung, Kohortenbildung, ...)"]

    PURGE["Daily purge"] -->|"DELETE older than N days"| DB

    style MW fill:#fef3c7
    style DB fill:#dbeafe
    style PURGE fill:#fee2e2
```

## JWT Payload Structure

```json
{
  "sub": "admin",
  "preferred_username": "admin",
  "role": "admin",
  "centers": ["UKA", "UKB", "LMU", "UKT", "UKM"],
  "iat": 1712736000,
  "exp": 1712736600
}
```

- Signed with HS256 using secret from `data/jwt-secret.txt`
- 10-minute expiry
- Challenge tokens add `"purpose": "challenge"` (2-minute expiry, rejected by authMiddleware)

## File Layout (Runtime)

```
emd-app/
  data/                          # Created at first startup
    jwt-secret.txt               #   Auto-generated HS256 key (mode 0600)
    users.json                   #   User records with bcrypt hashes
    audit.db                     #   SQLite audit log (WAL mode)
  dist/                          # Vite production build output
  feedback/                      # Issue reports (JSON + screenshots)
  public/
    settings.yaml                # All configuration
    data/                        # FHIR test bundles
  server/
    index.ts                     # Express entry point
    initAuth.ts                  # JWT secret + user migration
    authMiddleware.ts            # JWT validation middleware
    authApi.ts                   # Login/verify/config/users routes
    auditDb.ts                   # SQLite database layer
    auditMiddleware.ts           # Request auto-logging
    auditApi.ts                  # Read-only audit API
    issueApi.ts                  # Issue reporting (+ Vite plugin)
    settingsApi.ts               # Settings CRUD (+ Vite plugin)
    utils.ts                     # readBody, sendError
```
