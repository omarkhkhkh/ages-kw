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

/* ترحيل حالات الممارسات القديمة إلى دورة حياة المناقصات (idempotent —
   لا يمس السجلات التي تحمل الحالات الجديدة أصلًا) */
const MIGRATIONS = [
  // نظام التسعير v2: نظام الحاويات + حاويات لكل بند
  `ALTER TABLE pricing_sheets ADD COLUMN IF NOT EXISTS container_mode text NOT NULL DEFAULT 'shared'`,
  `ALTER TABLE pricing_items ADD COLUMN IF NOT EXISTS containers numeric(8,2) NOT NULL DEFAULT 0`,
  // لقب المخاطبة القابل للاختيار (المحترمين/المحترم) على الكتب
  `ALTER TABLE correspondence_letters ADD COLUMN IF NOT EXISTS recipient_honorific text NOT NULL DEFAULT 'المحترمين'`,
  `ALTER TABLE correspondence_letters ADD COLUMN IF NOT EXISTS attention_honorific text NOT NULL DEFAULT 'المحترمين'`,
  // أعمدة ميزانية الصيانة v2 — ضمانة إنشاء في الإنتاج حتى لو تخطاها drizzle push
  `ALTER TABLE finance_income ADD COLUMN IF NOT EXISTS source_module text`,
  `ALTER TABLE finance_income ADD COLUMN IF NOT EXISTS income_source text`,
  `ALTER TABLE finance_income ADD COLUMN IF NOT EXISTS inventory_item_id integer REFERENCES maintenance_inventory(id) ON DELETE SET NULL`,
  `ALTER TABLE finance_income ADD COLUMN IF NOT EXISTS quantity numeric(12,3)`,
  `ALTER TABLE finance_expenses ADD COLUMN IF NOT EXISTS source_module text`,
  `UPDATE practices SET status = 'won' WHERE status IN ('current', 'previous', 'completed')`,
  `UPDATE practices SET status = 'studying' WHERE status = 'targeted'`,
  `UPDATE practices SET status = 'under_evaluation' WHERE status = 'under_submission'`,
  `UPDATE practices SET status = 'new' WHERE status = 'future'`,
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
  for (const ddl of MIGRATIONS) {
    try {
      await pool.query(ddl);
    } catch (err) {
      logger.warn({ err, ddl: ddl.slice(0, 60) }, "skipping migration");
    }
  }
  logger.info("Performance indexes ensured");
}
