import { sql } from "drizzle-orm";
import { db, serviceTypesTable } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_SERVICE_TYPES = [
  "تسليم عينات",
  "استلام عينات",
  "تقديم مناقصات",
  "تقديم ممارسات",
  "توقيع عقود",
  "متابعة العقود",
  "تسليم أوامر شراء",
  "متابعة الفواتير",
  "اعتماد مستخلصات",
  "متابعة الدفعات",
  "تسليم كتب رسمية",
  "استلام كتب رسمية",
  "مراجعة فنية",
  "مراجعة مالية",
  "تسليم كفالات",
  "استلام كفالات",
  "متابعة المشاريع",
  "متابعة أوامر التوريد",
];

/**
 * Idempotently seeds the 18 default service types on first server boot.
 * Safe to call on every startup — no-ops once any service types already exist.
 * Unlike system correspondence templates, these are fully editable afterward (not protected).
 */
export async function ensureDefaultServiceTypes(): Promise<void> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(serviceTypesTable);
  if (count > 0) return;

  await db.insert(serviceTypesTable).values(DEFAULT_SERVICE_TYPES.map(name => ({ name })));

  logger.info({ count: DEFAULT_SERVICE_TYPES.length }, "Seeded default service types");
}
