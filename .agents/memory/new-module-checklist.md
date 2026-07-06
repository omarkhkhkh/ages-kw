---
name: Adding a new module — full checklist
description: All files that must be touched to add a new access-controlled module to the tender-manager monorepo.
---

## Files to update (in order)

1. `lib/db/src/schema/<module>.ts` — new Drizzle table
2. `lib/db/src/schema/index.ts` — add `export * from "./<module>"`
3. `lib/db/src/schema/users.ts` — add `access<Module>: boolean(...)` column
4. Run `psql "$DATABASE_URL"` to add column and create table (Drizzle push not used here)
5. **Run `cd lib/db && npx tsc -p tsconfig.json`** — REQUIRED before api-server typecheck; lib/db is a composite project that emits `.d.ts` files into `dist/`; without this step api-server `tsc --noEmit` reports false "does not exist" errors on all schema symbols
6. `artifacts/api-server/src/middleware/auth.ts` — add to `SessionData`, `MODULE_LABELS`, `MODULE_KEY_MAP`, and `requireModule` Pick type
7. `artifacts/api-server/src/routes/auth.ts` — add to `MODULE_FIELDS` const, `buildUserResponse()`, and `/me` response
8. `artifacts/api-server/src/routes/admin.ts` — add to `USER_SELECT`, POST body destructure + values, PATCH body destructure + updates
9. `artifacts/api-server/src/routes/<module>.ts` — CRUD router
10. `artifacts/api-server/src/routes/index.ts` — `router.use("/<module>", requireModule("access<Module>"), <module>Router)`
11. `artifacts/tender-manager/src/contexts/auth.tsx` — add `access<Module>: boolean` to `AuthUser`; update `useModuleAccess` Pick union
12. `artifacts/tender-manager/src/components/layout.tsx` — import icon, add nav entry with `can("access<Module>")`; add breadcrumb label
13. `artifacts/tender-manager/src/pages/admin-users.tsx` — `UserRow` interface, `MODULES` array, `defaultForm`, `handleSave` PATCH payload
14. `artifacts/tender-manager/src/App.tsx` — import page, add `<Route>` with `<ModuleGuard>`
15. `artifacts/tender-manager/src/pages/<module>-list.tsx` — frontend page

## Why lib/db must be rebuilt
lib/db's tsconfig has `composite: true` and `emitDeclarationOnly: true`. The api-server tsconfig has a `references` entry pointing to `../../lib/db`. TypeScript resolves `@workspace/db` symbols from `lib/db/dist/*.d.ts`, not the source. Stale or missing `.d.ts` files cause phantom "does not exist on type" errors for every schema symbol.

## Drawer form sync
Use `useEffect([editing, open])` to sync form state when editing record changes. Using `useState` (lazy initializer) only runs once and causes stale form data on edit-open.

## Express route ordering in shared router
When a router has both static segment paths (e.g. `GET /teams`, `GET /tasks`) AND dynamic `/:id` for a different resource, the static paths MUST be registered BEFORE `GET /:id`. Otherwise Express matches `/teams` and `/tasks` as `:id = "teams"` and `:id = "tasks"`, silently bypassing the correct handlers. Rule: sort routes by specificity — exact literals first, dynamic segments last.
