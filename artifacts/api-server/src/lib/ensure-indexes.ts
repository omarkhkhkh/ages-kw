import { pool } from "@workspace/db";
import { logger } from "./logger";

/* جداول قديمة كانت مستخدمة في المسارات دون تعريف في الـschema —
   تُنشأ هنا عند الإقلاع كضمانة نهائية حتى لو لم ينشئها drizzle push
   (غيابها في الإنتاج كان يكسر قائمة/تفاصيل العقود للموظفين بـ500). */
const TABLES = [
  `CREATE TABLE IF NOT EXISTS contract_permissions (
     contract_id integer NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
     user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     can_view boolean NOT NULL DEFAULT true,
     PRIMARY KEY (contract_id, user_id)
   )`,
  `CREATE TABLE IF NOT EXISTS contract_documents (
     id serial PRIMARY KEY,
     contract_id integer NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
     uploaded_by integer REFERENCES users(id) ON DELETE SET NULL,
     file_name text NOT NULL,
     file_size integer,
     mime_type text,
     file_data text NOT NULL,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS contract_comments (
     id serial PRIMARY KEY,
     contract_id integer NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
     from_user_id integer REFERENCES users(id) ON DELETE SET NULL,
     to_user_id integer REFERENCES users(id) ON DELETE SET NULL,
     content text NOT NULL,
     is_read boolean NOT NULL DEFAULT false,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
];

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
  for (const ddl of TABLES) {
    try {
      await pool.query(ddl);
    } catch (err) {
      logger.error({ err, ddl: ddl.slice(0, 60) }, "failed to ensure legacy table");
    }
  }
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
