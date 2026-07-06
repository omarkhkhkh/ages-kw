import { Router } from "express";
import { db, activityLogsTable, usersTable } from "@workspace/db";
import { eq, desc, and, gte, lte, SQL } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";

const router = Router();

// All activity log routes are admin-only
router.use(requireAdmin);

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function parsePositiveInt(val: string | undefined, fallback: number, max?: number): number {
  const n = parseInt(val ?? "", 10);
  if (isNaN(n) || n < 0) return fallback;
  return max !== undefined ? Math.min(n, max) : n;
}

function parseSafeDate(val: string | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

const VALID_ACTIONS = new Set(["login", "logout", "create", "update", "delete", "export", "access_denied"]);
const VALID_MODULES = new Set(["tenders", "entities", "suppliers", "projects", "guarantees", "contracts", "rfq", "po", "users", "auth"]);

// GET /api/admin/activity-logs
router.get("/", async (req, res) => {
  const { userId, module, action, from, to } = req.query as Record<string, string>;
  const limit = parsePositiveInt(req.query.limit as string, DEFAULT_LIMIT, MAX_LIMIT);
  const offset = parsePositiveInt(req.query.offset as string, 0);

  const conditions: SQL[] = [];

  if (userId) {
    const uid = parseInt(userId, 10);
    if (!isNaN(uid)) conditions.push(eq(activityLogsTable.userId, uid));
  }
  if (module && VALID_MODULES.has(module)) {
    conditions.push(eq(activityLogsTable.module, module));
  }
  if (action && VALID_ACTIONS.has(action)) {
    conditions.push(eq(activityLogsTable.action, action));
  }

  const fromDate = parseSafeDate(from);
  if (fromDate) conditions.push(gte(activityLogsTable.createdAt, fromDate));

  const toDate = parseSafeDate(to);
  if (toDate) {
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(activityLogsTable.createdAt, toDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, countRows] = await Promise.all([
    db.select().from(activityLogsTable).where(where)
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ id: activityLogsTable.id }).from(activityLogsTable).where(where),
  ]);

  res.json({ logs, total: countRows.length });
});

// GET /api/admin/activity-logs/users — list all users for the filter dropdown
router.get("/users", async (_req, res) => {
  const users = await db
    .select({ id: usersTable.id, fullName: usersTable.fullName, username: usersTable.username })
    .from(usersTable)
    .orderBy(usersTable.fullName);
  res.json(users);
});

export default router;
