---
name: Per-module access and activity logging architecture
description: How module-level access control and audit logging are implemented across API and frontend
---

## Rule
Module access is controlled by 8 boolean columns on the users table (access_tenders, access_entities, etc.) stored in the session at login. The `requireModule(field)` factory in `middleware/auth.ts` gates each router independently. Admins bypass all module checks.

**Why:** Employees needed different data visibility per department — one might see tenders and RFQ but not suppliers or contracts. Global canView is insufficient for this granularity.

**How to apply:**
- In `routes/index.ts`, wrap each business router: `router.use("/tenders", requireModule("accessTenders"), tendersRouter)`.
- `requireModule` short-circuits for admin role.
- Session must include all 8 fields at login (auth.ts).
- Frontend `useModuleAccess(field)` hook checks the session; admins always return true.
- `ModuleGuard` component in App.tsx wraps each route.

## Activity Logging

The `activityLogger` middleware fires on `res.on("finish")` and logs POST/PATCH/DELETE successes. **Critical**: it must be attached to BOTH the main router (for business routes) AND inside `adminRouter` (for user CRUD) — because `/admin` is mounted before `requireAuth` in `routes/index.ts`, so the global activityLogger does not cover admin mutations.

**Why:** Admin mutations (creating/editing users) are important audit events and would be silently missed otherwise.

**How to apply:**
- Add `router.use(activityLogger)` in `admin.ts` after `requireAdmin`.
- The global `activityLogger` in `routes/index.ts` covers all other business routes.
- Login/logout are logged explicitly via `logActivity()` called from `auth.ts`.

## DB Schema

```sql
-- Apply via psql (drizzle-kit push requires TTY; use direct SQL in CI/Replit shell)
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_tenders boolean NOT NULL DEFAULT true;
-- ... (8 columns total)
CREATE TABLE IF NOT EXISTS activity_logs (id serial PK, user_id int, username text, full_name text, action text, module text, resource_id int, details text, ip_address text, created_at timestamp DEFAULT now());
```

## Input validation in activity-logs route

Clamp limit (max 200), validate action/module against allowlists, use parseSafeDate() for date inputs.
