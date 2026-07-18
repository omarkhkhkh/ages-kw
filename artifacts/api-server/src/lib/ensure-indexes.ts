import { pool } from "@workspace/db";
import { logger } from "./logger";

/* فهارس أداء تُنشأ عند الإقلاع (idempotent) — أهمها فهارس منشئ السجل
   التي يستخدمها فلتر خصوصية "يرى سجلاته فقط" في كل استعلام قائمة. */
const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tenders_created_by ON tenders (created_by_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_practices_created_by ON practices (created_by_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON contracts (created_by_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects (created_by_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_po_created_by ON direct_purchase_orders (created_by_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_letters_created_by ON correspondence_letters (created_by_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_letters_direction_created ON correspondence_letters (direction, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks (assigned_to)`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_created ON finance_expenses (created_at)`,
];

export async function ensurePerformanceIndexes(): Promise<void> {
  for (const ddl of INDEXES) {
    try {
      await pool.query(ddl);
    } catch (err) {
      // فهرس على عمود غير موجود بعد (نشرة أقدم) — لا يوقف الإقلاع
      logger.warn({ err, ddl }, "skipping index");
    }
  }
  logger.info("Performance indexes ensured");
}
