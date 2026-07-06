# سجل المناقصات

نظام إدارة المناقصات الحكومية — يتتبع دورة حياة المناقصة من بدايتها حتى إغلاقها لشركات المقاولات.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/tender-manager run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (table: `tenders`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend: React + Vite, RTL (Arabic), TanStack Query
- Build: esbuild (CJS bundle)

## Where things live

- DB schema: `lib/db/src/schema/tenders.ts`
- API spec: `lib/api-spec/openapi.yaml`
- API routes: `artifacts/api-server/src/routes/tenders.ts`
- Frontend pages: `artifacts/tender-manager/src/pages/`
- Frontend entry: `artifacts/tender-manager/src/App.tsx`

## Architecture decisions

- Frontend is RTL (dir="rtl") — Arabic-first UI
- Status enum enforced on both server (validation) and client (constants map)
- Urgency logic excludes completed/submitted statuses on both server and client
- Cache invalidated via TanStack Query queryKey helpers after every mutation

## Product

- **لوحة التحكم** (`/`): إحصاءات + رسم بياني للحالات + آخر المناقصات
- **جميع المناقصات** (`/tenders`): قائمة مع بحث وفلاتر وتبويبات الحالة
- **مناقصة جديدة** (`/tenders/new`): نموذج إنشاء
- **تفاصيل المناقصة** (`/tenders/:id`): عرض + تعديل + حذف

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Frontend dev script must pass `--port $PORT --strictPort` explicitly (PORT injected by artifact.toml but needs CLI flag to take effect)
- `tendersTable` columns use camelCase in Drizzle (e.g. `createdAt` not `created_at`) even though DB column is snake_case
