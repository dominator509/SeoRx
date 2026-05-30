# Phase 3: Cryptography, Identity, and Access Control

## Authentication Mechanisms
- **Frontend/Backend Integration:** The application uses Clerk for authentication (`@clerk/express`). This is a robust standard.
- **Middleware (`auth.ts`):** Verifies the JWT emitted by Clerk using `getAuth(req)`. If `userId` exists, access is granted.
- **API Keys (`api-key-auth.ts`):** Custom middleware requires `Bearer srx_...`. Verifies the hashed version of the API key against the database (`apiKeysTable`). This mitigates database leak scenarios by not storing plaintext keys.

## Authorization and Access Control (RBAC)
- **RBAC Middleware (`rbac.ts`):** Validates org membership (`req.seorxUser?.role !== "superadmin" && !getMembershipForOrg(req, orgId)`).
- Privilege checking seems centralized in `rbac.ts`.

## Cryptography and Key Management
- **Key Derivation & Secrets Storage (`crypto.ts`):**
  - Uses `aes-256-gcm` for secrets encryption (e.g. encrypting integration credentials).
  - IV generation and Tag length configuration are secure.
  - **Vulnerability / Weakness Identified:** Fallback mechanism for `ENCRYPTION_KEY` — if not provided, the system falls back to basic `base64` encoding (`b64:...`), printing only a warning log. This is a severe weakness in production if configuration management fails. While it logs a warning, silently downgrading encryption to encoding creates a false sense of security.

### Conclusion
Phase 3 completed. Identity and authentication look solid leveraging Clerk and hashed API Keys. The encryption fallback is noted as a significant operational risk.
