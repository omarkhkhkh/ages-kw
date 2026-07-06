---
name: Server-side permission enforcement pattern
description: How canEdit permissions are enforced at the API layer
---

## Rule
Apply `requireEdit` middleware to all mutation routes (POST/PATCH/DELETE) at the router level, not individually per endpoint.

**Why:** UI-only gating is insufficient — users can call the API directly. Any employee with a valid session could bypass UI restrictions without server-side checks.

**How to apply:**
In `artifacts/api-server/src/routes/index.ts`, after the `requireAuth` middleware block, add:
```ts
router.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return requireEdit(req, res, next);
  }
  next();
});
```
This covers all downstream routers (tenders, entities, suppliers, projects, guarantees, contracts).
