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
  // ربط المشروع/العقد بممارسة مرتبطة (بجانب المناقصة المرتبطة الموجودة)
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS practice_id integer REFERENCES practices(id) ON DELETE SET NULL`,
  `ALTER TABLE contracts ADD COLUMN IF NOT EXISTS practice_id integer REFERENCES practices(id) ON DELETE SET NULL`,
  // طلب عرض السعر: الربط بعقد بدل المناقصة
  `ALTER TABLE rfq_requests ADD COLUMN IF NOT EXISTS contract_id integer REFERENCES contracts(id) ON DELETE SET NULL`,
  // الموظف المسؤول (assigned_user_id) عبر 7 وحدات — يقود خصوصية "سجلاتي فقط" ويُسنده المدير
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS assigned_user_id integer REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE contracts ADD COLUMN IF NOT EXISTS assigned_user_id integer REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE direct_purchase_orders ADD COLUMN IF NOT EXISTS assigned_user_id integer REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE rfq_requests ADD COLUMN IF NOT EXISTS assigned_user_id integer REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE government_registrations ADD COLUMN IF NOT EXISTS assigned_user_id integer REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE bank_guarantees ADD COLUMN IF NOT EXISTS assigned_user_id integer REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE company_documents ADD COLUMN IF NOT EXISTS assigned_user_id integer REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE practices ADD COLUMN IF NOT EXISTS assigned_user_id integer REFERENCES users(id) ON DELETE SET NULL`,
  // مرة واحدة: الوحدات التي كانت تُخصّص بالمنشئ تبقى مرئية لمنشئيها (نُسند المسؤول = المنشئ حيث لم يُسنَد بعد)
  `UPDATE projects SET assigned_user_id = created_by_user_id WHERE assigned_user_id IS NULL AND created_by_user_id IS NOT NULL`,
  `UPDATE contracts SET assigned_user_id = created_by_user_id WHERE assigned_user_id IS NULL AND created_by_user_id IS NOT NULL`,
  `UPDATE direct_purchase_orders SET assigned_user_id = created_by_user_id WHERE assigned_user_id IS NULL AND created_by_user_id IS NOT NULL`,
  `UPDATE practices SET assigned_user_id = created_by_user_id WHERE assigned_user_id IS NULL AND created_by_user_id IS NOT NULL`,
  `UPDATE practices SET status = 'won' WHERE status IN ('current', 'previous', 'completed')`,
  `UPDATE practices SET status = 'studying' WHERE status = 'targeted'`,
  `UPDATE practices SET status = 'under_evaluation' WHERE status = 'under_submission'`,
  `UPDATE practices SET status = 'new' WHERE status = 'future'`,
  // قائمة تصنيفات الموردين المركزية القابلة للتوسّع + زرع الأنواع الافتراضية
  `CREATE TABLE IF NOT EXISTS supplier_types (id serial PRIMARY KEY, name text NOT NULL UNIQUE, created_at timestamp NOT NULL DEFAULT now())`,
  `INSERT INTO supplier_types (name) VALUES ('مقاول'), ('مورد'), ('استشاري'), ('مصنّع') ON CONFLICT (name) DO NOTHING`,

  /* ═══ النظام المالي الموحّد — المرحلة ١: الأساس (إضافي وغير كاسر) ═══ */
  // جدول مراكز التكلفة/الربح (أقسام الشركة الداخلية) + زرع الأقسام الأساسية
  `CREATE TABLE IF NOT EXISTS cost_centers (id serial PRIMARY KEY, name text NOT NULL UNIQUE,
     type text NOT NULL DEFAULT 'profit', evaluation_metric text,
     is_active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now(),
     updated_at timestamp NOT NULL DEFAULT now())`,
  `INSERT INTO cost_centers (name, type) VALUES
     ('الصيانة','profit'), ('النقل','profit'), ('العقود','profit'),
     ('المشتريات','cost'), ('عام/غير موزّع','allocatable') ON CONFLICT (name) DO NOTHING`,
  // بُعد القسم على الدخل والمصروف + تاريخ المعاملة الصريح على المصروف
  `ALTER TABLE finance_income   ADD COLUMN IF NOT EXISTS cost_center_id integer REFERENCES cost_centers(id) ON DELETE SET NULL`,
  `ALTER TABLE finance_expenses ADD COLUMN IF NOT EXISTS cost_center_id integer REFERENCES cost_centers(id) ON DELETE SET NULL`,
  `ALTER TABLE finance_expenses ADD COLUMN IF NOT EXISTS transaction_date date`,
  // ترحيل خلفي — تاريخ المعاملة من التاريخ الموجود
  `UPDATE finance_expenses SET transaction_date = COALESCE(paid_date, due_date, created_at::date) WHERE transaction_date IS NULL`,
  // ترحيل خلفي — القسم بنفس أولوية "حسب الوحدة" (أول شرط ينطبق يفوز؛ IS NULL يضمن idempotency ويلتقط أي سجل جديد لاحقًا)
  `UPDATE finance_expenses fe SET cost_center_id = (SELECT id FROM cost_centers WHERE name='الصيانة')
     WHERE fe.cost_center_id IS NULL AND (fe.maintenance_work_order_id IS NOT NULL OR fe.source_module='maintenance'
       OR EXISTS (SELECT 1 FROM workers w WHERE w.id = fe.worker_id AND w.assigned_module='maintenance'))`,
  `UPDATE finance_expenses fe SET cost_center_id = (SELECT id FROM cost_centers WHERE name='النقل')
     WHERE fe.cost_center_id IS NULL AND (fe.transportation_order_id IS NOT NULL OR fe.vehicle_id IS NOT NULL
       OR EXISTS (SELECT 1 FROM workers w WHERE w.id = fe.worker_id AND w.assigned_module='transportation'))`,
  `UPDATE finance_expenses SET cost_center_id = (SELECT id FROM cost_centers WHERE name='العقود') WHERE cost_center_id IS NULL AND contract_id IS NOT NULL`,
  `UPDATE finance_expenses SET cost_center_id = (SELECT id FROM cost_centers WHERE name='المشتريات') WHERE cost_center_id IS NULL AND purchase_order_id IS NOT NULL`,
  `UPDATE finance_expenses SET cost_center_id = (SELECT id FROM cost_centers WHERE name='عام/غير موزّع') WHERE cost_center_id IS NULL`,
  `UPDATE finance_income fi SET cost_center_id = (SELECT id FROM cost_centers WHERE name='الصيانة')
     WHERE fi.cost_center_id IS NULL AND (fi.maintenance_work_order_id IS NOT NULL OR fi.source_module='maintenance')`,
  `UPDATE finance_income fi SET cost_center_id = (SELECT id FROM cost_centers WHERE name='النقل')
     WHERE fi.cost_center_id IS NULL AND (fi.transportation_order_id IS NOT NULL OR fi.source_module='transportation')`,
  `UPDATE finance_income SET cost_center_id = (SELECT id FROM cost_centers WHERE name='العقود') WHERE cost_center_id IS NULL AND contract_id IS NOT NULL`,
  `UPDATE finance_income SET cost_center_id = (SELECT id FROM cost_centers WHERE name='عام/غير موزّع') WHERE cost_center_id IS NULL`,
  // المرحلة ٥: إسناد القسم لحظيًا عند الإدراج (نفس أولوية الترحيل الخلفي حرفيًا) — يجعل بُعد القسم دقيقًا
  // فور الكتابة من أي مسار (لا يعتمد على إعادة تشغيل الخادم). BEFORE INSERT فقط، وعند cost_center_id NULL —
  // فلا يمسّ أي إسناد يدوي. هذا شرط أمان القطع النهائي: الميزانيات الموحّدة تقرأ بُعدًا دقيقًا لحظيًا.
  `CREATE OR REPLACE FUNCTION assign_expense_cost_center() RETURNS trigger AS $fn$
   BEGIN
     IF NEW.cost_center_id IS NULL THEN
       NEW.cost_center_id := (SELECT id FROM cost_centers WHERE name = (CASE
         WHEN NEW.maintenance_work_order_id IS NOT NULL OR NEW.source_module = 'maintenance'
              OR EXISTS (SELECT 1 FROM workers w WHERE w.id = NEW.worker_id AND w.assigned_module = 'maintenance') THEN 'الصيانة'
         WHEN NEW.transportation_order_id IS NOT NULL OR NEW.vehicle_id IS NOT NULL
              OR EXISTS (SELECT 1 FROM workers w WHERE w.id = NEW.worker_id AND w.assigned_module = 'transportation') THEN 'النقل'
         WHEN NEW.contract_id IS NOT NULL THEN 'العقود'
         WHEN NEW.purchase_order_id IS NOT NULL THEN 'المشتريات'
         ELSE 'عام/غير موزّع' END) LIMIT 1);
     END IF;
     RETURN NEW;
   END; $fn$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS trg_assign_expense_cc ON finance_expenses`,
  `CREATE TRIGGER trg_assign_expense_cc BEFORE INSERT ON finance_expenses FOR EACH ROW EXECUTE FUNCTION assign_expense_cost_center()`,
  `CREATE OR REPLACE FUNCTION assign_income_cost_center() RETURNS trigger AS $fn$
   BEGIN
     IF NEW.cost_center_id IS NULL THEN
       NEW.cost_center_id := (SELECT id FROM cost_centers WHERE name = (CASE
         WHEN NEW.maintenance_work_order_id IS NOT NULL OR NEW.source_module = 'maintenance' THEN 'الصيانة'
         WHEN NEW.transportation_order_id IS NOT NULL OR NEW.source_module = 'transportation' THEN 'النقل'
         WHEN NEW.contract_id IS NOT NULL THEN 'العقود'
         ELSE 'عام/غير موزّع' END) LIMIT 1);
     END IF;
     RETURN NEW;
   END; $fn$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS trg_assign_income_cc ON finance_income`,
  `CREATE TRIGGER trg_assign_income_cc BEFORE INSERT ON finance_income FOR EACH ROW EXECUTE FUNCTION assign_income_cost_center()`,

  /* ═══ النظام المالي الموحّد — المرحلة ٢: جدول أصول موحّد + ميزانية موحّدة (تشغيل متوازٍ) ═══ */
  // بُعد القسم على المعدات والمركبات
  `ALTER TABLE maintenance_equipment ADD COLUMN IF NOT EXISTS cost_center_id integer REFERENCES cost_centers(id) ON DELETE SET NULL`,
  `ALTER TABLE fleet_vehicles        ADD COLUMN IF NOT EXISTS cost_center_id integer REFERENCES cost_centers(id) ON DELETE SET NULL`,
  `UPDATE maintenance_equipment SET cost_center_id = (SELECT id FROM cost_centers WHERE name='الصيانة') WHERE cost_center_id IS NULL`,
  `UPDATE fleet_vehicles        SET cost_center_id = (SELECT id FROM cost_centers WHERE name='النقل')   WHERE cost_center_id IS NULL`,
  // جدول الأصول الموحّد
  `CREATE TABLE IF NOT EXISTS assets (id serial PRIMARY KEY,
     cost_center_id integer REFERENCES cost_centers(id) ON DELETE SET NULL,
     asset_type text NOT NULL DEFAULT 'other', name text NOT NULL, code text, category text, status text,
     location text, branch text, purchase_value numeric(15,3), purchase_date date,
     legacy_source text, legacy_id integer, notes text,
     created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
     CONSTRAINT uq_assets_legacy UNIQUE (legacy_source, legacy_id))`,
  // مزامنة المعدات → assets (idempotent: يُعاد كل إقلاع فيلتقط أي تغيير)
  `INSERT INTO assets (cost_center_id, asset_type, name, code, category, status, location, branch, purchase_value, purchase_date, legacy_source, legacy_id, notes)
     SELECT cost_center_id, 'equipment', name, asset_number, category, status, location, branch, purchase_value, purchase_date, 'maintenance_equipment', id, notes FROM maintenance_equipment
     ON CONFLICT (legacy_source, legacy_id) DO UPDATE SET cost_center_id=EXCLUDED.cost_center_id, name=EXCLUDED.name, code=EXCLUDED.code,
       category=EXCLUDED.category, status=EXCLUDED.status, location=EXCLUDED.location, branch=EXCLUDED.branch,
       purchase_value=EXCLUDED.purchase_value, purchase_date=EXCLUDED.purchase_date, notes=EXCLUDED.notes, updated_at=now()`,
  // مزامنة المركبات → assets
  `INSERT INTO assets (cost_center_id, asset_type, name, code, category, status, purchase_value, purchase_date, legacy_source, legacy_id, notes)
     SELECT cost_center_id, 'vehicle', COALESCE(NULLIF(make_model,''), plate_number), plate_number, vehicle_type, status, purchase_value, purchase_date, 'fleet_vehicles', id, notes FROM fleet_vehicles
     ON CONFLICT (legacy_source, legacy_id) DO UPDATE SET cost_center_id=EXCLUDED.cost_center_id, name=EXCLUDED.name, code=EXCLUDED.code,
       category=EXCLUDED.category, status=EXCLUDED.status, purchase_value=EXCLUDED.purchase_value, purchase_date=EXCLUDED.purchase_date, notes=EXCLUDED.notes, updated_at=now()`,
  // تنظيف الأصول اليتيمة (المصدر حُذف)
  `DELETE FROM assets WHERE legacy_source='maintenance_equipment' AND legacy_id NOT IN (SELECT id FROM maintenance_equipment)`,
  `DELETE FROM assets WHERE legacy_source='fleet_vehicles' AND legacy_id NOT IN (SELECT id FROM fleet_vehicles)`,
  // جدول الميزانية الموحّد + ترحيل ميزانيات الصيانة والنقل
  `CREATE TABLE IF NOT EXISTS cost_center_budgets (id serial PRIMARY KEY,
     cost_center_id integer NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
     year integer NOT NULL, month integer NOT NULL, target_amount numeric(15,3) NOT NULL DEFAULT 0,
     created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
     CONSTRAINT uq_ccb_ym UNIQUE (cost_center_id, year, month))`,
  `INSERT INTO cost_center_budgets (cost_center_id, year, month, target_amount)
     SELECT (SELECT id FROM cost_centers WHERE name='الصيانة'), year, month, amount FROM maintenance_budgets
     ON CONFLICT (cost_center_id, year, month) DO UPDATE SET target_amount=EXCLUDED.target_amount, updated_at=now()`,
  `INSERT INTO cost_center_budgets (cost_center_id, year, month, target_amount)
     SELECT (SELECT id FROM cost_centers WHERE name='النقل'), year, month, amount FROM transportation_budgets
     ON CONFLICT (cost_center_id, year, month) DO UPDATE SET target_amount=EXCLUDED.target_amount, updated_at=now()`,

  /* ═══ النظام المالي الموحّد — المرحلة ٤: قواعد توزيع التكاليف غير المباشرة ═══ */
  `CREATE TABLE IF NOT EXISTS cost_allocation_rules (id serial PRIMARY KEY,
     cost_center_id integer NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
     cost_type text, driver text, share_ratio numeric(6,4) NOT NULL DEFAULT 0, notes text,
     created_at timestamp NOT NULL DEFAULT now())`,

  /* ═══ المرحلة ٦: دفتر الأحداث المالية (append-only، غير قابل للحذف) ═══
     مرآة موحّدة لكل حركة مالية كحدث ثابت. تشغيل متوازٍ: دفترا الدخل/المصروف يبقيان مصدر
     الحقيقة التشغيلي، وهذا الدفتر ينعكس منهما تلقائيًا (trigger) + ترحيل خلفي. التصحيح يتم
     بحدث عكسي (reverses_event_id) لا بحذف. UNIQUE(source_ledger, source_id) يضمن idempotency. */
  `CREATE TABLE IF NOT EXISTS financial_events (
     id serial PRIMARY KEY,
     event_type text NOT NULL,                 -- income | expense | reversal
     source_ledger text,                       -- finance_income | finance_expenses | manual
     source_id integer,
     amount numeric(15,3) NOT NULL DEFAULT 0,
     cost_center_id integer REFERENCES cost_centers(id) ON DELETE SET NULL,
     transaction_date date,
     description text,
     reverses_event_id integer REFERENCES financial_events(id) ON DELETE SET NULL,
     created_by integer,
     created_at timestamp NOT NULL DEFAULT now(),
     CONSTRAINT uq_fin_event_source UNIQUE (source_ledger, source_id))`,
  `CREATE INDEX IF NOT EXISTS idx_fin_events_txn ON financial_events (transaction_date)`,
  `CREATE INDEX IF NOT EXISTS idx_fin_events_cc ON financial_events (cost_center_id)`,
  // مرآة لحظية عند إدراج مصروف/دخل (AFTER INSERT — بعد أن يضبط trigger القسم cost_center_id)
  `CREATE OR REPLACE FUNCTION mirror_expense_event() RETURNS trigger AS $fn$
   BEGIN
     INSERT INTO financial_events (event_type, source_ledger, source_id, amount, cost_center_id, transaction_date, description, created_at)
     VALUES ('expense', 'finance_expenses', NEW.id, NEW.amount, NEW.cost_center_id, COALESCE(NEW.transaction_date, NEW.created_at::date), NEW.description, NEW.created_at)
     ON CONFLICT (source_ledger, source_id) DO NOTHING;
     RETURN NEW;
   END; $fn$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS trg_mirror_expense_event ON finance_expenses`,
  `CREATE TRIGGER trg_mirror_expense_event AFTER INSERT ON finance_expenses FOR EACH ROW EXECUTE FUNCTION mirror_expense_event()`,
  `CREATE OR REPLACE FUNCTION mirror_income_event() RETURNS trigger AS $fn$
   BEGIN
     INSERT INTO financial_events (event_type, source_ledger, source_id, amount, cost_center_id, transaction_date, description, created_at)
     VALUES ('income', 'finance_income', NEW.id, NEW.amount, NEW.cost_center_id, NEW.date, NEW.description, NEW.created_at)
     ON CONFLICT (source_ledger, source_id) DO NOTHING;
     RETURN NEW;
   END; $fn$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS trg_mirror_income_event ON finance_income`,
  `CREATE TRIGGER trg_mirror_income_event AFTER INSERT ON finance_income FOR EACH ROW EXECUTE FUNCTION mirror_income_event()`,
  // ترحيل خلفي — انعكاس كل السجلات الموجودة (idempotent عبر ON CONFLICT)
  `INSERT INTO financial_events (event_type, source_ledger, source_id, amount, cost_center_id, transaction_date, description, created_at)
     SELECT 'expense', 'finance_expenses', id, amount, cost_center_id, COALESCE(transaction_date, created_at::date), description, created_at FROM finance_expenses
     ON CONFLICT (source_ledger, source_id) DO NOTHING`,
  `INSERT INTO financial_events (event_type, source_ledger, source_id, amount, cost_center_id, transaction_date, description, created_at)
     SELECT 'income', 'finance_income', id, amount, cost_center_id, date, description, created_at FROM finance_income
     ON CONFLICT (source_ledger, source_id) DO NOTHING`,

  /* ═══ المرحلة ٧: دفتر التسعير المرجعي (pricing_book) ═══
     كتالوج مركزي للأصناف بأسعار تكلفة/بيع قياسية. اسم متعمّد (ليس pricing — محجوز لأداة الاستيراد). */
  `CREATE TABLE IF NOT EXISTS pricing_book (
     id serial PRIMARY KEY,
     item_code text NOT NULL UNIQUE,
     item_name text NOT NULL,
     category text,
     unit text,
     standard_cost numeric(15,3) NOT NULL DEFAULT 0,
     standard_price numeric(15,3) NOT NULL DEFAULT 0,
     currency text NOT NULL DEFAULT 'KWD',
     notes text,
     is_active boolean NOT NULL DEFAULT true,
     created_at timestamp NOT NULL DEFAULT now(),
     updated_at timestamp NOT NULL DEFAULT now())`,

  /* ═══ المرحلة ٨: تكلفة المخزون بالمتوسط المرجّح ═══
     عمود متوسط تكلفة متحرّك على مخزون الصيانة، يُعاد حسابه عند كل استلام. */
  `ALTER TABLE maintenance_inventory ADD COLUMN IF NOT EXISTS avg_cost numeric(15,3) NOT NULL DEFAULT 0`,
  `UPDATE maintenance_inventory SET avg_cost = COALESCE(unit_cost, 0) WHERE avg_cost = 0 AND unit_cost IS NOT NULL`,

  /* ═══ صيانة العقود — المرحلة ١: كتالوج الأنواع + الهيكل التعليمي (منطقة ← مدرسة ← ورشة) ═══
     توسيع نظام الصيانة نحو نموذج صيانة عقود الورش. إضافي/غير مدمّر، تشغيل متوازٍ. */
  `CREATE TABLE IF NOT EXISTS maintenance_equipment_types (
     id serial PRIMARY KEY,
     code text NOT NULL UNIQUE,
     name_ar text NOT NULL,
     name_en text,
     default_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
     created_at timestamp NOT NULL DEFAULT now())`,
  `ALTER TABLE maintenance_equipment ADD COLUMN IF NOT EXISTS type_id integer REFERENCES maintenance_equipment_types(id) ON DELETE SET NULL`,
  `CREATE TABLE IF NOT EXISTS maintenance_districts (
     id serial PRIMARY KEY,
     name_ar text NOT NULL UNIQUE,
     contact_name text, contact_phone text, payment_terms text,
     is_active boolean NOT NULL DEFAULT true,
     created_at timestamp NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS maintenance_schools (
     id serial PRIMARY KEY,
     district_id integer NOT NULL REFERENCES maintenance_districts(id) ON DELETE CASCADE,
     name_ar text NOT NULL, code text UNIQUE, address text, phone text,
     is_active boolean NOT NULL DEFAULT true,
     created_at timestamp NOT NULL DEFAULT now(),
     CONSTRAINT uq_msch_district_name UNIQUE (district_id, name_ar))`,
  `CREATE TABLE IF NOT EXISTS maintenance_workshops (
     id serial PRIMARY KEY,
     school_id integer NOT NULL REFERENCES maintenance_schools(id) ON DELETE CASCADE,
     name_ar text NOT NULL DEFAULT 'ورشة الدراسات العملية',
     supervisor_name text,
     created_at timestamp NOT NULL DEFAULT now(),
     CONSTRAINT uq_mwsh_school_name UNIQUE (school_id, name_ar))`,
  // بذور من النموذج الورقي الفعلي (idempotent)
  `INSERT INTO maintenance_equipment_types (code, name_ar, name_en) VALUES
     ('CNC','مكينة CNC','CNC Machine'),
     ('THICK','مكينة التخانة','Thickness Machine'),
     ('BANDSAW','منشار شريطي','Band Saw'),
     ('MORTIZE','مثقاب النقر','Mortize Drill'),
     ('SANDER','مكينة الصنفرة','Sander'),
     ('WALLSAW','منشار حائط','Wall Saw'),
     ('PLANNER','الرابوة','Surface Planner'),
     ('BORING','التثقيب المتعدد','Boring Machine')
     ON CONFLICT (code) DO NOTHING`,
  `INSERT INTO maintenance_districts (name_ar, contact_phone) VALUES ('حولي','51562637') ON CONFLICT (name_ar) DO NOTHING`,
  `INSERT INTO maintenance_schools (district_id, name_ar)
     SELECT id, 'مدرسة مشعان الخضير' FROM maintenance_districts WHERE name_ar='حولي'
     ON CONFLICT (district_id, name_ar) DO NOTHING`,

  /* ═══ صيانة العقود — المرحلة ٢: عقود الصيانة + مصفوفة التغطية + قائمة الأسعار + SLA ═══
     اسم service_contracts متعمّد (ليس contracts المحجوز لعقود المناقصات). */
  `CREATE TABLE IF NOT EXISTS service_contracts (
     id serial PRIMARY KEY,
     contract_number text NOT NULL UNIQUE,
     district_id integer NOT NULL REFERENCES maintenance_districts(id),
     title text,
     contract_type text NOT NULL DEFAULT 'شامل'
       CHECK (contract_type IN ('شامل','وقائي فقط','تحت الطلب','ضمان ممتد')),
     billing_model text NOT NULL DEFAULT 'مقطوع سنوي'
       CHECK (billing_model IN ('مقطوع سنوي','لكل زيارة','قطع وأجرة','مختلط')),
     start_date date NOT NULL,
     end_date date NOT NULL,
     contract_value numeric(14,3),
     currency char(3) NOT NULL DEFAULT 'KWD',
     pm_visits_per_year smallint,
     auto_renew boolean NOT NULL DEFAULT false,
     status text NOT NULL DEFAULT 'مسودة'
       CHECK (status IN ('مسودة','نشط','منتهٍ','ملغى','معلّق لعدم السداد')),
     created_at timestamp NOT NULL DEFAULT now(),
     updated_at timestamp NOT NULL DEFAULT now(),
     CONSTRAINT ck_sc_dates CHECK (end_date > start_date))`,
  // مصفوفة التغطية: ثلاث حالات لكل بند + سقف إلزامي مع "مشمول بسقف" فقط
  `CREATE TABLE IF NOT EXISTS service_contract_coverage (
     id serial PRIMARY KEY,
     contract_id integer NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
     item_code text NOT NULL,
     item_label_ar text NOT NULL,
     coverage text NOT NULL CHECK (coverage IN ('مشمول','مشمول بسقف','غير مشمول')),
     annual_cap numeric(14,3),
     consumed numeric(14,3) NOT NULL DEFAULT 0,
     CONSTRAINT uq_scc UNIQUE (contract_id, item_code),
     CONSTRAINT ck_scc_cap CHECK ((coverage = 'مشمول بسقف') = (annual_cap IS NOT NULL)))`,
  // قائمة أسعار العقد — تجعل نموذج "مختلط" قابلًا للتنفيذ
  `CREATE TABLE IF NOT EXISTS service_contract_price_list (
     id serial PRIMARY KEY,
     contract_id integer NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
     item_code text NOT NULL,
     unit text NOT NULL,
     unit_price numeric(12,3),
     markup_pct numeric(5,2),
     CONSTRAINT uq_scpl UNIQUE (contract_id, item_code))`,
  // اتفاقية مستوى الخدمة (SLA) لكل أولوية — أضفنا id سطحيًا ليوافق نمط CRUD الموحّد
  `CREATE TABLE IF NOT EXISTS service_contract_sla (
     id serial PRIMARY KEY,
     contract_id integer NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
     priority text NOT NULL CHECK (priority IN ('طارئ','عالي','عادي')),
     response_hours smallint NOT NULL,
     resolution_hours smallint NOT NULL,
     CONSTRAINT uq_scsla UNIQUE (contract_id, priority))`,
  // بذور العقدين ١٢٧ و١٤٣ (حولي) + مصفوفة تغطية العقد ١٢٧ من النموذج الفعلي
  `INSERT INTO service_contracts (contract_number, district_id, title, contract_type, billing_model, start_date, end_date, pm_visits_per_year, status)
     SELECT '127', id, 'تطوير وتحديث ورش ومختبرات الدراسات العملية', 'شامل', 'مختلط', DATE '2026-01-01', DATE '2026-12-31', 4, 'نشط'
     FROM maintenance_districts WHERE name_ar='حولي' ON CONFLICT (contract_number) DO NOTHING`,
  `INSERT INTO service_contracts (contract_number, district_id, title, contract_type, billing_model, start_date, end_date, pm_visits_per_year, status)
     SELECT '143', id, 'تطوير وتحديث ورش ومختبرات الدراسات العملية', 'شامل', 'مختلط', DATE '2026-01-01', DATE '2026-12-31', 4, 'نشط'
     FROM maintenance_districts WHERE name_ar='حولي' ON CONFLICT (contract_number) DO NOTHING`,
  `INSERT INTO service_contract_coverage (contract_id, item_code, item_label_ar, coverage, annual_cap)
     SELECT c.id, x.code, x.label, x.cov, x.cap
     FROM service_contracts c,
       (VALUES
          ('labor_pm','أجرة عمل — صيانة وقائية','مشمول',NULL::numeric),
          ('labor_cm','أجرة عمل — صيانة تصحيحية','مشمول',NULL),
          ('labor_ot','أجرة عمل — خارج الدوام','غير مشمول',NULL),
          ('parts','قطع الغيار','مشمول بسقف',500.000),
          ('consumables','المستهلكات','مشمول',NULL),
          ('transport','النقل والانتقال','مشمول',NULL),
          ('misuse','أعطال سوء الاستخدام','غير مشمول',NULL)
       ) AS x(code,label,cov,cap)
     WHERE c.contract_number='127' ON CONFLICT (contract_id, item_code) DO NOTHING`,

  /* ═══ صيانة العقود — المرحلة ٣: الإسناد الزمني للمكائن (منع تداخل الفترات) ═══
     المكينة تُنقل بين المدارس وعقدها يتغيّر؛ قيد EXCLUDE يمنع تداخل فترتين لنفس المكينة. */
  `CREATE EXTENSION IF NOT EXISTS btree_gist`,
  `CREATE TABLE IF NOT EXISTS maintenance_equipment_assignments (
     id serial PRIMARY KEY,
     equipment_id integer NOT NULL REFERENCES maintenance_equipment(id) ON DELETE CASCADE,
     school_id integer NOT NULL REFERENCES maintenance_schools(id),
     workshop_id integer REFERENCES maintenance_workshops(id) ON DELETE SET NULL,
     contract_id integer REFERENCES service_contracts(id) ON DELETE SET NULL,
     valid_from date NOT NULL,
     valid_to date,
     reason text,
     created_at timestamp NOT NULL DEFAULT now(),
     CONSTRAINT ck_mea_dates CHECK (valid_to IS NULL OR valid_to > valid_from))`,
  `CREATE INDEX IF NOT EXISTS idx_mea_lookup ON maintenance_equipment_assignments (equipment_id, valid_from)`,
  // قيد منع التداخل — يُضاف دفاعيًا (لو btree_gist غير متاح في بيئة مقيّدة، يُعتمد على فحص التطبيق)
  `DO $do$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='excl_mea_overlap') THEN
       ALTER TABLE maintenance_equipment_assignments ADD CONSTRAINT excl_mea_overlap
         EXCLUDE USING gist (equipment_id WITH =, daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[)') WITH &&);
     END IF;
   EXCEPTION WHEN others THEN NULL;
   END $do$`,

  /* ═══ صيانة العقود — المرحلة ٤: الزيارات (القلب) + بنودها + مكتبة العبارات ═══
     الزيارة = وحدة العمل الحقيقية: زيارة لمدرسة واحدة تغطي عدة مكائن من عدة عقود. */
  `CREATE TABLE IF NOT EXISTS maintenance_visits (
     id serial PRIMARY KEY,
     visit_number text NOT NULL UNIQUE,
     school_id integer NOT NULL REFERENCES maintenance_schools(id),
     workshop_id integer REFERENCES maintenance_workshops(id) ON DELETE SET NULL,
     visit_date date NOT NULL,
     maintenance_type text NOT NULL DEFAULT 'دورية' CHECK (maintenance_type IN ('دورية','طارئة')),
     technician_id integer REFERENCES users(id) ON DELETE SET NULL,
     arrived_at timestamp, departed_at timestamp,
     status text NOT NULL DEFAULT 'مسودة'
       CHECK (status IN ('مسودة','قيد التنفيذ','بانتظار الاعتماد','معتمدة','صادرة','ملغاة')),
     receiver_name text, receiver_title text, received_at date, receiver_signature text,
     approved_by integer REFERENCES users(id) ON DELETE SET NULL,
     issued_at timestamp,
     created_at timestamp NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS idx_mvisits_school_date ON maintenance_visits (school_id, visit_date DESC)`,
  `CREATE TABLE IF NOT EXISTS maintenance_visit_lines (
     id serial PRIMARY KEY,
     visit_id integer NOT NULL REFERENCES maintenance_visits(id) ON DELETE CASCADE,
     equipment_id integer NOT NULL REFERENCES maintenance_equipment(id),
     contract_id integer REFERENCES service_contracts(id) ON DELETE SET NULL,
     line_no smallint NOT NULL,
     is_included boolean NOT NULL DEFAULT true,
     exclusion_reason text CHECK (exclusion_reason IN
       ('تعذّر الوصول للورشة','المكينة غير موجودة بالموقع','المكينة خارج العقد','خُدمت في زيارة سابقة','بطلب من إدارة المدرسة')),
     exclusion_approved_by integer REFERENCES users(id) ON DELETE SET NULL,
     condition text CHECK (condition IN ('جيدة','تحتاج صيانة')),
     works_done text, notes text,
     work_order_id integer REFERENCES maintenance_work_orders(id) ON DELETE SET NULL,
     coverage_decision jsonb, snapshot jsonb,
     created_at timestamp NOT NULL DEFAULT now(),
     CONSTRAINT uq_mvl_equip UNIQUE (visit_id, equipment_id),
     CONSTRAINT uq_mvl_lineno UNIQUE (visit_id, line_no),
     CONSTRAINT ck_mvl_incl CHECK (
       (is_included AND condition IS NOT NULL AND exclusion_reason IS NULL)
       OR (NOT is_included AND exclusion_reason IS NOT NULL)),
     CONSTRAINT ck_mvl_wo CHECK (work_order_id IS NULL OR condition = 'تحتاج صيانة'))`,
  `CREATE INDEX IF NOT EXISTS idx_mvl_equipment ON maintenance_visit_lines (equipment_id)`,
  `CREATE TABLE IF NOT EXISTS maintenance_standard_phrases (
     id serial PRIMARY KEY,
     category text NOT NULL CHECK (category IN ('فحص','عطل','إجراء')),
     text_ar text NOT NULL,
     type_id integer REFERENCES maintenance_equipment_types(id) ON DELETE SET NULL,
     usage_count int NOT NULL DEFAULT 0,
     is_active boolean NOT NULL DEFAULT true)`,
  // بذور العبارات الجاهزة من النموذج الورقي (idempotent عبر فحص عدم التكرار)
  `INSERT INTO maintenance_standard_phrases (category, text_ar)
     SELECT v.category, v.text_ar FROM (VALUES
        ('فحص','تم فحص المكينة وتنظيفها وتجربتها وتعمل بشكل جيد'),
        ('عطل','المكينة تحتاج إلى صيانة وتم عمل الآتي'),
        ('إجراء','تم تغيير القطعة التالفة وتجربة المكينة وتعمل بشكل جيد'),
        ('إجراء','تم التشحيم والضبط ومعايرة المكينة'),
        ('عطل','المكينة متوقفة بانتظار وصول قطعة غيار من المورّد')
     ) AS v(category, text_ar)
     WHERE NOT EXISTS (SELECT 1 FROM maintenance_standard_phrases p WHERE p.text_ar = v.text_ar)`,

  /* ═══ صيانة العقود — المرحلة ٥: التقارير الرسمية + السجلات + الترقيم + مطالبات الضمان ═══
     بديل ٣٠ قالب Word: ٣ تخطيطات + تسميات حقول لكل جهة. سجل صادر/وارد بترقيم رسمي متسلسل. */
  `CREATE TABLE IF NOT EXISTS maintenance_presentation_profiles (
     id serial PRIMARY KEY,
     name text NOT NULL,
     district_id integer REFERENCES maintenance_districts(id) ON DELETE SET NULL,
     contract_id integer REFERENCES service_contracts(id) ON DELETE SET NULL,
     base_layout text NOT NULL CHECK (base_layout IN ('جدولي متعدد المكائن','مبسّط','مفصّل','ملف Word مرفوع')),
     raw_template_path text,
     show_costs boolean NOT NULL DEFAULT false,
     show_parts boolean NOT NULL DEFAULT true,
     logo_path text,
     signature_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
     is_default boolean NOT NULL DEFAULT false,
     created_at timestamp NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS maintenance_field_labels (
     id serial PRIMARY KEY,
     profile_id integer NOT NULL REFERENCES maintenance_presentation_profiles(id) ON DELETE CASCADE,
     field_key text NOT NULL,
     label_ar text NOT NULL,
     label_en text,
     is_visible boolean NOT NULL DEFAULT true,
     sort_order smallint NOT NULL DEFAULT 0,
     CONSTRAINT uq_mfl UNIQUE (profile_id, field_key))`,
  // الترقيم الرسمي المتسلسل الآمن عند التزامن
  `CREATE TABLE IF NOT EXISTS maintenance_document_sequences (
     doc_type text NOT NULL, year smallint NOT NULL, last_number int NOT NULL DEFAULT 0,
     PRIMARY KEY (doc_type, year))`,
  `CREATE TABLE IF NOT EXISTS maintenance_outgoing_register (
     id serial PRIMARY KEY,
     doc_number text NOT NULL,
     version smallint NOT NULL DEFAULT 1,
     doc_type text NOT NULL CHECK (doc_type IN ('تقرير زيارة','مطالبة مالية','عرض سعر','محضر استلام','كتاب رسمي')),
     visit_id integer REFERENCES maintenance_visits(id) ON DELETE SET NULL,
     district_id integer REFERENCES maintenance_districts(id) ON DELETE SET NULL,
     subject text, file_path text,
     delivery_method text CHECK (delivery_method IN ('تسليم باليد','بريد','نظام الجهة')),
     delivered_at date, receiver_name text, receiver_title text, receiver_ref text,
     status text NOT NULL DEFAULT 'أُرسل' CHECK (status IN ('أُرسل','استُلم','قُبل','أُعيد للتعديل')),
     revision_reason text,
     issued_by integer REFERENCES users(id) ON DELETE SET NULL,
     issued_at timestamp NOT NULL DEFAULT now(),
     CONSTRAINT uq_mout UNIQUE (doc_number, version))`,
  `CREATE TABLE IF NOT EXISTS maintenance_incoming_register (
     id serial PRIMARY KEY,
     ref_number text,
     received_at date NOT NULL,
     district_id integer REFERENCES maintenance_districts(id) ON DELETE SET NULL,
     school_id integer REFERENCES maintenance_schools(id) ON DELETE SET NULL,
     subject text NOT NULL, file_path text,
     generated_visit_id integer REFERENCES maintenance_visits(id) ON DELETE SET NULL,
     generated_wo_id integer REFERENCES maintenance_work_orders(id) ON DELETE SET NULL,
     created_at timestamp NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS maintenance_warranty_claims (
     id serial PRIMARY KEY,
     work_order_id integer NOT NULL REFERENCES maintenance_work_orders(id) ON DELETE CASCADE,
     supplier_id integer NOT NULL REFERENCES suppliers(id),
     claim_number text, requested_parts text,
     requested_at date NOT NULL DEFAULT CURRENT_DATE, received_at date,
     status text NOT NULL DEFAULT 'مقدّمة' CHECK (status IN ('مقدّمة','مقبولة','مرفوضة','وصلت القطع')),
     notes text)`,
  // ملف عرض افتراضي مطابق للنموذج الورقي (idempotent: يُدرج فقط إن لم يوجد ملف افتراضي)
  `INSERT INTO maintenance_presentation_profiles (name, district_id, base_layout, show_costs, is_default, signature_blocks)
     SELECT 'نموذج وزارة التربية — جدولي', d.id, 'جدولي متعدد المكائن', false, true,
        '[{"label":"توقيع مسؤول الورشة أو من ينوب عنه"},{"label":"توقيع وختم إدارة المدرسة","require_name":true,"require_date":true}]'::jsonb
     FROM maintenance_districts d
     WHERE d.name_ar='حولي' AND NOT EXISTS (SELECT 1 FROM maintenance_presentation_profiles p WHERE p.is_default = true)`,

  /* ═══ صيانة العقود — وصل الفجوات الثلاث (بعد اكتمال المراحل ١-٦) ═══
     (١) فوترة العمل غير المشمول/المتجاوز للسقف كإيراد، (٢) ربط الخطة الوقائية بعقد الصيانة،
     (٣) توحيد نظامَي التقارير: محرّك قوالب واحد + سجل صادر واحد بترقيم رسمي. كله إضافي وغير كاسر. */

  // (١) الفوترة — بند الزيارة يحمل مرجع سجل الإيراد المولَّد منه (income_id يمنع الفوترة مرتين)
  `ALTER TABLE maintenance_visit_lines ADD COLUMN IF NOT EXISTS income_id integer REFERENCES finance_income(id) ON DELETE SET NULL`,
  `ALTER TABLE maintenance_visit_lines ADD COLUMN IF NOT EXISTS billed_amount numeric(15,3)`,
  `ALTER TABLE maintenance_visit_lines ADD COLUMN IF NOT EXISTS billed_at timestamp`,
  `ALTER TABLE maintenance_visit_lines ADD COLUMN IF NOT EXISTS billing_note text`,
  `CREATE INDEX IF NOT EXISTS idx_mvl_income ON maintenance_visit_lines (income_id)`,

  // (٢) الخطة الوقائية ← عقد الصيانة (يُملأ يدويًا أو بالربط التلقائي من إسناد المكينة)
  `ALTER TABLE maintenance_preventive_plans ADD COLUMN IF NOT EXISTS contract_id integer REFERENCES service_contracts(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_mpp_contract ON maintenance_preventive_plans (contract_id)`,

  // (٣) توحيد التقارير — سجل الصادر يستوعب مستندات أوامر الصيانة، ويعرف القالب/ملف العرض المستخدم
  `ALTER TABLE maintenance_outgoing_register ADD COLUMN IF NOT EXISTS work_order_id integer REFERENCES maintenance_work_orders(id) ON DELETE SET NULL`,
  `ALTER TABLE maintenance_outgoing_register ADD COLUMN IF NOT EXISTS template_id integer REFERENCES maintenance_report_templates(id) ON DELETE SET NULL`,
  `ALTER TABLE maintenance_outgoing_register ADD COLUMN IF NOT EXISTS profile_id integer REFERENCES maintenance_presentation_profiles(id) ON DELETE SET NULL`,
  // سجل التقارير المولّدة القديم يستوعب تقرير زيارة (بلا أمر صيانة) ويربط بقيده في سجل الصادر
  `ALTER TABLE maintenance_generated_reports ADD COLUMN IF NOT EXISTS visit_id integer REFERENCES maintenance_visits(id) ON DELETE SET NULL`,
  `ALTER TABLE maintenance_generated_reports ADD COLUMN IF NOT EXISTS outgoing_register_id integer REFERENCES maintenance_outgoing_register(id) ON DELETE SET NULL`,
  `ALTER TABLE maintenance_generated_reports ALTER COLUMN work_order_id DROP NOT NULL`,
  // توحيد الترقيم: السلسلة الرسمية تبدأ من أعلى RPT قائم لهذه السنة، وإلا أعادت إصدار رقم مستخدم.
  // GREATEST يجعلها idempotent عند كل إقلاع، وفحص النمط يمنع فشل التحويل على أي رقم شاذ.
  `INSERT INTO maintenance_document_sequences (doc_type, year, last_number)
     SELECT 'تقرير زيارة', EXTRACT(YEAR FROM CURRENT_DATE)::smallint,
            COALESCE(MAX(CASE WHEN split_part(report_number,'-',3) ~ '^[0-9]+$'
                              THEN split_part(report_number,'-',3)::int END), 0)
       FROM maintenance_generated_reports
      WHERE report_number LIKE 'RPT-' || EXTRACT(YEAR FROM CURRENT_DATE)::text || '-%'
   ON CONFLICT (doc_type, year) DO UPDATE
      SET last_number = GREATEST(maintenance_document_sequences.last_number, EXCLUDED.last_number)`,


  /* ═══ الخارطة الموحّدة — المرحلة ١: المناصب (القبعات) + الحوكمة + سجل المنح ═══
     المنصب قبعة تُلبَس فوق مصفوفة الصلاحيات القائمة: منحُها يطبّق حزمتها على المصفوفة،
     وسحبُها يسحب ما لا تغطيه قبعة أخرى. المنح محكوم: الإدارية للمدير العام وحده،
     والتشغيلية له وللمدير التنفيذي — وكل منح/سحب يُقيَّد في سجل دائم. */
  `CREATE TABLE IF NOT EXISTS positions (
     id serial PRIMARY KEY,
     key text NOT NULL UNIQUE,
     name_ar text NOT NULL,
     tier text NOT NULL CHECK (tier IN ('إداري','تشغيلي')),
     description text,
     sort_order smallint NOT NULL DEFAULT 0)`,
  `INSERT INTO positions (key, name_ar, tier, description, sort_order) VALUES
     ('general_manager',   'المدير العام',    'إداري',  'القرار النهائي: قبول أو رفض — وتجاوز مسجَّل لأي حاجز', 1),
     ('executive_manager', 'المدير التنفيذي', 'إداري',  'يراقب الفرق، يصنع جدول أسعار أوامر الشراء، يوزّع وينقل', 2),
     ('financial_manager', 'المدير المالي',   'إداري',  'يراجع كل ورقة تسعير ويوقف الملفات ذات الأثر المالي', 3),
     ('consultant',        'مستشار',          'تشغيلي', 'يرفع المناقصات والممارسات ويختار العروض ويبني التسعير المبدئي', 4),
     ('researcher',        'باحث',            'تشغيلي', 'يجمع عروض الأسعار والمواصفات للبنود الخارجية — لا يسعّر', 5),
     ('delegate',          'مندوب',           'تشغيلي', 'الكتب والمراجعات والتجديدات وجمع أسعار البنود المحلية', 6),
     ('transport_worker',  'موظف نقل',        'تشغيلي', 'ينفّذ جدول المتابعة اليومي بشروط كل مهمة', 7),
     ('maintenance_worker','موظف صيانة',      'تشغيلي', 'ينفّذ أوامر الصيانة والزيارات المسندة له', 8)
   ON CONFLICT (key) DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS user_positions (
     id serial PRIMARY KEY,
     user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     position_id integer NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
     granted_by integer REFERENCES users(id) ON DELETE SET NULL,
     granted_at timestamp NOT NULL DEFAULT now(),
     CONSTRAINT uq_user_position UNIQUE (user_id, position_id))`,
  `CREATE INDEX IF NOT EXISTS idx_user_positions_user ON user_positions (user_id)`,
  `CREATE TABLE IF NOT EXISTS position_audit_log (
     id serial PRIMARY KEY,
     action text NOT NULL CHECK (action IN ('منح','سحب')),
     user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     position_id integer NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
     actor_user_id integer REFERENCES users(id) ON DELETE SET NULL,
     created_at timestamp NOT NULL DEFAULT now())`,


  /* ═══ الخارطة الموحّدة — المرحلة ٢: النقل الموحّد + طلباته (سيرة الملف تبدأ هنا) ═══
     زر واحد وسلوك واحد لكل عمل مسند: النقل يغيّر المالك في جدول الكيان نفسه ويقيّد
     سطرًا دائمًا (من ← إلى، بواسطة، السبب). الموظف يطلب ولا ينقل؛ التنفيذي والعام ينفذان. */
  `CREATE TABLE IF NOT EXISTS work_transfer_requests (
     id serial PRIMARY KEY,
     entity_type text NOT NULL,
     entity_id integer NOT NULL,
     requested_by integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     suggested_to_user_id integer REFERENCES users(id) ON DELETE SET NULL,
     reason text NOT NULL,
     status text NOT NULL DEFAULT 'معلق' CHECK (status IN ('معلق','منفذ','مرفوض')),
     decided_by integer REFERENCES users(id) ON DELETE SET NULL,
     decided_at timestamp,
     created_at timestamp NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS idx_wtr_status ON work_transfer_requests (status)`,
  `CREATE TABLE IF NOT EXISTS work_transfers (
     id serial PRIMARY KEY,
     entity_type text NOT NULL,
     entity_id integer NOT NULL,
     from_user_id integer REFERENCES users(id) ON DELETE SET NULL,
     to_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     transferred_by integer REFERENCES users(id) ON DELETE SET NULL,
     reason text NOT NULL,
     request_id integer REFERENCES work_transfer_requests(id) ON DELETE SET NULL,
     created_at timestamp NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS idx_wt_entity ON work_transfers (entity_type, entity_id)`,


  /* ═══ الخارطة الموحّدة — المرحلة ٣: ملف الحالة (رحلة المناقصة/الممارسة) ═══
     لكل مناقصة/ممارسة ملفٌ واحد: من رفعه، مسار توريده المُعلَن (فريق البحث ← باحث يختاره
     المستشار، أو مصدر خاص ← مورد مسجَّل ظاهر للمديرَين)، حالته (بما فيها موقوف ماليًا
     بسبب مُلزم)، وقراره النهائي عند المدير العام — وتجاوزُه لأي إيقاف يُسجَّل باسمه. */
  `CREATE TABLE IF NOT EXISTS case_files (
     id serial PRIMARY KEY,
     entity_type text NOT NULL CHECK (entity_type IN ('tender','practice')),
     entity_id integer NOT NULL,
     raised_by integer REFERENCES users(id) ON DELETE SET NULL,
     sourcing_path text CHECK (sourcing_path IN ('فريق البحث','مصدر خاص')),
     own_source_supplier_id integer REFERENCES suppliers(id) ON DELETE SET NULL,
     researcher_user_id integer REFERENCES users(id) ON DELETE SET NULL,
     research_assignment_id integer REFERENCES research_assignments(id) ON DELETE SET NULL,
     status text NOT NULL DEFAULT 'مفتوح'
       CHECK (status IN ('مفتوح','قيد العمل','موقوف ماليًا','بانتظار الاعتماد','معتمد','مرفوض','مغلق')),
     prev_status text,
     hold_reason text,
     held_by integer REFERENCES users(id) ON DELETE SET NULL,
     held_at timestamp,
     submitted_by integer REFERENCES users(id) ON DELETE SET NULL,
     submitted_at timestamp,
     decided_by integer REFERENCES users(id) ON DELETE SET NULL,
     decided_at timestamp,
     decision_note text,
     gm_override boolean NOT NULL DEFAULT false,
     created_at timestamp NOT NULL DEFAULT now(),
     updated_at timestamp NOT NULL DEFAULT now(),
     CONSTRAINT uq_case_entity UNIQUE (entity_type, entity_id),
     CONSTRAINT ck_case_own_source CHECK (sourcing_path <> 'مصدر خاص' OR own_source_supplier_id IS NOT NULL))`,
  `CREATE INDEX IF NOT EXISTS idx_case_files_status ON case_files (status)`,
  `CREATE TABLE IF NOT EXISTS case_file_events (
     id serial PRIMARY KEY,
     case_file_id integer NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
     event text NOT NULL,
     details text,
     actor_user_id integer REFERENCES users(id) ON DELETE SET NULL,
     created_at timestamp NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS idx_cfe_case ON case_file_events (case_file_id)`,


  /* ═══ الخارطة الموحّدة — المرحلة ٤: بوابتا الإغلاق (جلسة الفض + الدرس) ═══
     الملف لا يُغلق بفوز/خسارة قبل تسجيل جلسة فض العطاء (تغذّي ذكاء المنافسين قسرًا)
     والدرس المستفاد (يغذّي مركز المعرفة) — والانسحاب قبل التقديم يُعفى من الجلسة. */
  `ALTER TABLE case_files ADD COLUMN IF NOT EXISTS outcome text`,
  `ALTER TABLE case_files ADD COLUMN IF NOT EXISTS bid_result_id integer REFERENCES bid_results(id) ON DELETE SET NULL`,
  `ALTER TABLE case_files ADD COLUMN IF NOT EXISTS knowledge_entry_id integer REFERENCES knowledge_entries(id) ON DELETE SET NULL`,


  /* ═══ الخارطة الموحّدة — المرحلة ٥: العقد النشط بملف تشغيله + الانحرافات ═══
     الملف الفائز يتحول لعقد نشط بملف تشغيل (توريد فقط/+صيانة/+نقل/+كلاهما) يحدد أي
     أقسام تشتغل تحته — ونسبُ مصروفِ صيانةٍ لعقد توريدٍ صرف يُرفض. والتقديري يُجمَّد
     والفعلي يُقيَّد بجانبه: النزول وفر والارتفاع نزيف بسبب، والتزام المورد يُقاس منهما. */
  `ALTER TABLE contracts ADD COLUMN IF NOT EXISTS ops_profile text NOT NULL DEFAULT 'توريد فقط'`,
  `ALTER TABLE case_files ADD COLUMN IF NOT EXISTS contract_id integer REFERENCES contracts(id) ON DELETE SET NULL`,
  `CREATE TABLE IF NOT EXISTS contract_variances (
     id serial PRIMARY KEY,
     contract_id integer NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
     item_name text NOT NULL,
     estimated_cost numeric(15,3),
     actual_cost numeric(15,3) NOT NULL,
     supplier_id integer REFERENCES suppliers(id) ON DELETE SET NULL,
     reason text NOT NULL,
     created_by integer REFERENCES users(id) ON DELETE SET NULL,
     created_at timestamp NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS idx_cv_contract ON contract_variances (contract_id)`,


  /* ═══ الخارطة الموحّدة — المرحلة ٦: مسيّر الرواتب على مراكز تكلفة الأقسام ═══
     مسودة شهرية تتولد بكل عامل نشط وراتبه ومركز قسمه (من وحدته المسندة)، يراجعها
     المدير المالي ويرحّلها — فيتقيد كل راتب مصروفًا على مركز قسم صاحبه. */
  `CREATE TABLE IF NOT EXISTS payroll_runs (
     id serial PRIMARY KEY,
     year integer NOT NULL,
     month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
     status text NOT NULL DEFAULT 'مسودة' CHECK (status IN ('مسودة','مرحّل')),
     created_by integer REFERENCES users(id) ON DELETE SET NULL,
     posted_by integer REFERENCES users(id) ON DELETE SET NULL,
     posted_at timestamp,
     created_at timestamp NOT NULL DEFAULT now(),
     CONSTRAINT uq_payroll_month UNIQUE (year, month))`,
  `CREATE TABLE IF NOT EXISTS payroll_items (
     id serial PRIMARY KEY,
     run_id integer NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
     worker_id integer NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
     worker_name text NOT NULL,
     salary numeric(12,3) NOT NULL,
     cost_center_id integer REFERENCES cost_centers(id) ON DELETE SET NULL,
     cost_center_name text,
     expense_id integer REFERENCES finance_expenses(id) ON DELETE SET NULL,
     CONSTRAINT uq_payroll_worker UNIQUE (run_id, worker_id))`,

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
