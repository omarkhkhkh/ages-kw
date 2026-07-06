---
name: CORS and session cookie security
description: Correct CORS and session cookie configuration for the Replit proxy environment
---

## Rule
Never use `cors({ origin: true, credentials: true })` — it reflects any origin and allows credentialed requests from untrusted sites.

**Why:** Combined with cookie-based sessions, this creates a CSRF/data exfiltration vulnerability where any site can make authenticated requests.

**How to apply:**
- Restrict CORS origin to known Replit dev domain: `https://${process.env.REPLIT_DEV_DOMAIN}` in dev.
- Set session cookie: `sameSite: "lax"`, `secure: process.env.NODE_ENV === "production"`.
- Fail fast if SESSION_SECRET is missing: use `process.env.SESSION_SECRET ?? (() => { throw new Error("SESSION_SECRET required") })()`.
