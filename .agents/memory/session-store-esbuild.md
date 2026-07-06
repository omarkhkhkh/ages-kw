---
name: Session store with esbuild bundling
description: How to use connect-pg-simple correctly when the API server is bundled with esbuild
---

## Rule
Add `connect-pg-simple` to the `external` list in `build.mjs`. Create the session table manually before first run using the SQL from the package.

**Why:** connect-pg-simple resolves `table.sql` via `__dirname` at runtime. When bundled with esbuild, `__dirname` becomes the dist directory and the SQL file is not found — causing startup errors and broken sessions.

**How to apply:** 
1. Add `"connect-pg-simple"` to the `external` array in `artifacts/api-server/build.mjs`.
2. Set `createTableIfMissing: false` in the PgSession config.
3. Run the table.sql from the package once via psql to create the `session` table.
4. The session table SQL is: CREATE TABLE "session" (sid varchar NOT NULL COLLATE "default", sess json NOT NULL, expire timestamp(6) NOT NULL, CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE) WITH (OIDS=FALSE); CREATE INDEX IDX_session_expire ON session (expire);
