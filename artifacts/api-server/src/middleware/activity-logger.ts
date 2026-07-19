import { Request, Response, NextFunction } from "express";
import { db, activityLogsTable } from "@workspace/db";

const MODULE_MAP: Record<string, string> = {
  tenders: "tenders",
  "government-entities": "entities",
  suppliers: "suppliers",
  projects: "projects",
  "bank-guarantees": "guarantees",
  contracts: "contracts",
  "rfq-requests": "rfq",
  "direct-purchase-orders": "po",
  users: "users",
  correspondence: "correspondence",
  vehicles: "vehicles",
  residency: "residency",
  maintenance: "maintenance",
  research: "research",
  pricing: "pricing",
  opportunities: "opportunities",
  tasks: "tasks",
};

function detectAction(method: string, status: number): string | null {
  if (status >= 300) return null; // only log successes
  if (method === "POST") return "create";
  if (method === "PATCH" || method === "PUT") return "update";
  if (method === "DELETE") return "delete";
  return null;
}

function detectModule(path: string): string | null {
  // path looks like /tenders/5 or /government-entities
  const segments = path.split("/").filter(Boolean);
  return MODULE_MAP[segments[0]] ?? null;
}

function detectResourceId(path: string): number | null {
  const segments = path.split("/").filter(Boolean);
  const maybeId = segments[1];
  if (maybeId && /^\d+$/.test(maybeId)) return Number(maybeId);
  return null;
}

/**
 * Middleware that logs API mutations (create/update/delete) to activity_logs.
 * Must be applied AFTER requireAuth so req.session.userId is guaranteed.
 */
export function activityLogger(req: Request, res: Response, next: NextFunction) {
  res.on("finish", () => {
    if (!req.session?.userId) return;

    const action = detectAction(req.method, res.statusCode);
    if (!action) return; // Skip GETs and failed requests

    const module = detectModule(req.path);
    const resourceId = detectResourceId(req.path);

    db.insert(activityLogsTable)
      .values({
        userId: req.session.userId!,
        username: req.session.username ?? "",
        fullName: req.session.fullName ?? "",
        action,
        module,
        resourceId,
        details: null,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || null,
      })
      .catch((err) => console.error("[activity-logger] failed to insert:", err));
  });

  next();
}

/**
 * Log a specific action (login/logout/export) with full details.
 */
export async function logActivity(params: {
  userId: number;
  username: string;
  fullName: string;
  action: string;
  module?: string;
  resourceId?: number;
  details?: string;
  ipAddress?: string;
}) {
  await db.insert(activityLogsTable).values({
    userId: params.userId,
    username: params.username,
    fullName: params.fullName,
    action: params.action,
    module: params.module ?? null,
    resourceId: params.resourceId ?? null,
    details: params.details ?? null,
    ipAddress: params.ipAddress ?? null,
  });
}
