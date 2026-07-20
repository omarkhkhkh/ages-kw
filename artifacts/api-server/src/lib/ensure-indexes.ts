import { pool } from "@workspace/db";
import { logger } from "./logger";

/* جداول قديمة كانت مستخدمة في المسارات دون تعريف في الـschema —
   تُنشأ هنا عند الإقلاع كضمانة نهائية حتى لو لم ينشئها drizzle push
   (غيابها في الإنتاج كان يكسر قائمة/تفاصيل العقود للموظفين بـ500). */
const TABLES = [
  // قسم البحث والتسعير — فرص أوامر الشراء الحكومية (5 جداول)
  `CREATE TABLE IF NOT EXISTS procurement_opportunities (
     id serial PRIMARY KEY,
     order_number text NOT NULL,
     title text NOT NULL,
     government_entity_id integer REFERENCES government_entities(id) ON DELETE SET NULL,
     department_id integer REFERENCES departments(id) ON DELETE SET NULL,
     contact_id integer REFERENCES government_contacts(id) ON DELETE SET NULL,
     entity_type text,
     issue_date date,
     submission_deadline date,
     opening_date date,
     bond_value numeric(15,3),
     is_urgent boolean NOT NULL DEFAULT false,
     notes text,
     status text NOT NULL DEFAULT 'new',
     claimed_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
     claimed_at timestamp,
     discovered_at timestamp NOT NULL DEFAULT now(),
     research_done_at timestamp,
     priced_at timestamp,
     quotation_sent_at timestamp,
     result_at timestamp,
     pricing_sheet_id integer REFERENCES pricing_sheets(id) ON DELETE SET NULL,
     quotation_letter_id integer REFERENCES correspondence_letters(id) ON DELETE SET NULL,
     contract_id integer REFERENCES contracts(id) ON DELETE SET NULL,
     winner_name text,
     winner_price numeric(15,3),
     our_price numeric(15,3),
     loss_reason text,
     loss_notes text,
     created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
     created_at timestamp NOT NULL DEFAULT now(),
     updated_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS opportunity_items (
     id serial PRIMARY KEY,
     opportunity_id integer NOT NULL REFERENCES procurement_opportunities(id) ON DELETE CASCADE,
     item_name text NOT NULL,
     specifications text,
     quantity numeric(12,3) NOT NULL DEFAULT 1,
     unit text,
     notes text,
     sort_order integer NOT NULL DEFAULT 0,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS opportunity_item_quotes (
     id serial PRIMARY KEY,
     item_id integer NOT NULL REFERENCES opportunity_items(id) ON DELETE CASCADE,
     supplier_id integer REFERENCES suppliers(id) ON DELETE SET NULL,
     supplier_name text,
     contact_person text,
     phone text,
     whatsapp text,
     email text,
     price numeric(15,3) NOT NULL DEFAULT 0,
     delivery_days integer,
     quality_rating integer,
     warranty text,
     quote_file_url text,
     catalog_file_url text,
     image_file_url text,
     notes text,
     is_chosen boolean NOT NULL DEFAULT false,
     created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS opportunity_files (
     id serial PRIMARY KEY,
     opportunity_id integer NOT NULL REFERENCES procurement_opportunities(id) ON DELETE CASCADE,
     file_name text NOT NULL,
     file_url text NOT NULL,
     extracted_text text,
     uploaded_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS opportunity_stage_history (
     id serial PRIMARY KEY,
     opportunity_id integer NOT NULL REFERENCES procurement_opportunities(id) ON DELETE CASCADE,
     stage text NOT NULL,
     changed_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
     changed_at timestamp NOT NULL DEFAULT now(),
     note text
   )`,
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
  // قسم البحث والتسعير + وضع التسعير المبسّط
  `ALTER TABLE pricing_sheets ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'import'`,
  `ALTER TABLE pricing_sheets ADD COLUMN IF NOT EXISTS transport_cost numeric(15,3) NOT NULL DEFAULT 0`,
  `ALTER TABLE pricing_sheets ADD COLUMN IF NOT EXISTS simple_profit_percent numeric(5,2) NOT NULL DEFAULT 20`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS access_opportunities boolean NOT NULL DEFAULT true`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS opportunity_can_price boolean NOT NULL DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS opportunity_can_approve boolean NOT NULL DEFAULT false`,
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
  // ربط المشروع بممارسة مرتبطة (بجانب المناقصة المرتبطة الموجودة)
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS practice_id integer REFERENCES practices(id) ON DELETE SET NULL`,
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
