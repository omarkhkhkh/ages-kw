---
name: Competitor Intelligence Module
description: Architecture decisions and gotchas for the competitor intelligence module
---

## Tables
- `competitors` — shared company registry
- `bid_results` — one per tender OR practice (UNIQUE index enforced)
- `bid_entries` — one row per company per session; `is_us=true` marks our company
- `bid_items` — bid line items per session
- `bid_item_prices` — unit prices per item × entry

## Critical implementation rules

**Route ordering in competitor-analytics.ts:**
- `GET /:id` MUST be registered LAST, after all static paths (`/summary`, `/gap-analysis`, `/predict`, `/tender-comparison/:id`).
- If registered first, it captures all static paths and they return 404.

**DB transactions in bid-results.ts:**
- POST and PUT handlers must use `db.transaction(async (tx) => { ... })` wrapping all insert/update/delete steps.
- `recalcRanks()` and `syncTenderResult()` run OUTSIDE the transaction (they use raw SQL UPDATE and need committed data).

**Zod in api-server:**
- `zod` must be in `artifacts/api-server/package.json` dependencies (not just workspace root).
- `zod/v4` import path is NOT supported by esbuild — use `"zod"`.

**Field aliases in analytics SQL:**
- `/analytics/competitors/:id` history query: use `t.government_entity AS tender_entity` (not `government_entity`) to match frontend expectation.
- Frontend competitor-detail.tsx expects `h.tender_entity` and `h.practice_entity`.

**predict endpoint:**
- SQL must include `br.id AS bid_result_id` in SELECT to correctly count unique sessions via Set.

**Why:**
- These were all discovered as runtime/review bugs after initial implementation. The transaction fix prevents partial writes on network errors. The route ordering fix prevents static analytics endpoints from being swallowed by the dynamic /:id handler.
