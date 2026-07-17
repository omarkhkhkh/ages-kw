import { Router, type Request, type Response } from "express";
import {
  db, pool,
  taskTypesTable, insertTaskTypeSchema,
  recurringTaskTemplatesTable, insertRecurringTaskTemplateSchema, updateRecurringTaskTemplateSchema,
  tasksTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";
import { createNotification } from "./notifications";

const router = Router();

/* ══════════════════════════════════════
   أنواع المهام (إداري)
══════════════════════════════════════ */
router.get("/task-types", async (_req: Request, res: Response) => {
  const rows = await db.select().from(taskTypesTable).orderBy(taskTypesTable.name);
  return res.json(rows);
});

router.post("/task-types", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = insertTaskTypeSchema.parse(req.body);
    const [row] = await db.insert(taskTypesTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    if (err?.code === "23505") return res.status(409).json({ error: "هذا النوع موجود بالفعل" });
    return res.status(500).json({ error: "فشل في إضافة نوع المهمة" });
  }
});

router.patch("/task-types/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = insertTaskTypeSchema.partial().parse(req.body);
    const [row] = await db.update(taskTypesTable).set(data).where(eq(taskTypesTable.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "غير موجود" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث نوع المهمة" });
  }
});

router.delete("/task-types/:id", requireAdmin, async (req: Request, res: Response) => {
  await db.delete(taskTypesTable).where(eq(taskTypesTable.id, Number(req.params.id)));
  return res.status(204).end();
});

/* ══════════════════════════════════════
   قوالب المهام المتكررة (إداري)
══════════════════════════════════════ */
router.get("/recurring-templates", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.select().from(recurringTaskTemplatesTable).orderBy(recurringTaskTemplatesTable.title);
  return res.json(rows);
});

router.post("/recurring-templates", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = insertRecurringTaskTemplateSchema.parse({ ...req.body, createdByUserId: req.session.userId });
    const [row] = await db.insert(recurringTaskTemplatesTable).values(data).returning();
    // توليد فوري لنسخة اليوم إن كان القالب مستحقًا الآن — فيصل الإشعار للموظف لحظة الحفظ
    if (row.isActive && isTemplateDueToday(row)) await generateForTemplate(row);
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء القالب" });
  }
});

router.patch("/recurring-templates/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = updateRecurringTaskTemplateSchema.parse(req.body);
    const [row] = await db.update(recurringTaskTemplatesTable).set(data).where(eq(recurringTaskTemplatesTable.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "غير موجود" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث القالب" });
  }
});

router.delete("/recurring-templates/:id", requireAdmin, async (req: Request, res: Response) => {
  await db.delete(recurringTaskTemplatesTable).where(eq(recurringTaskTemplatesTable.id, Number(req.params.id)));
  return res.status(204).end();
});

export default router;

/* ══════════════════════════════════════
   دوال الأتمتة (غير-HTTP) — تُستخدم من ملفات routes أخرى + الفاحص الدوري
══════════════════════════════════════ */

interface AutomationTaskInput {
  title: string;
  description?: string;
  sourceType: string;
  sourceId: number;
  triggerKey: string;
  linkedEntityType?: string;
  linkedEntityId?: number;
  priority?: string;
  dueDate?: string | null;
  assignedTo?: number | null;
  proofType?: string;
  notificationMessage?: string;
}

/** إدراج idempotent — لا يُنشئ مهمة مكررة لنفس الحدث */
export async function insertAutomationTask(input: AutomationTaskInput): Promise<number | null> {
  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks (title, description, priority, status, source_type, source_id, trigger_key, linked_entity_type, linked_entity_id, due_date, assigned_to, proof_type, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
       ON CONFLICT (source_type, source_id, trigger_key) DO NOTHING
       RETURNING id`,
      [
        input.title, input.description ?? null, input.priority ?? "medium",
        input.sourceType, input.sourceId, input.triggerKey,
        input.linkedEntityType ?? null, input.linkedEntityId ?? null,
        input.dueDate ?? null, input.assignedTo ?? null,
        input.proofType ?? "none",
      ]
    );
    const taskId = rows[0]?.id ?? null;
    if (taskId && input.assignedTo) {
      await createNotification({ recipientUserId: input.assignedTo, type: "task_created", message: input.notificationMessage ?? `مهمة تلقائية جديدة: ${input.title}`, link: `/tasks?id=${taskId}` });
    }
    return taskId;
  } catch (err) {
    logger.error({ err }, "insertAutomationTask failed");
    return null;
  }
}

const EXPIRY_WINDOW_DAYS = 30;
const SUPPLIER_DELAY_DAYS = 10;

/** فحوصات دورية: اقتراب انتهاء الضمانات/التسجيلات + تأخر مورد استدلالي */
export async function runAutomationChecks(): Promise<void> {
  try {
    // اقتراب انتهاء ضمان بنكي
    const { rows: guarantees } = await pool.query(
      `SELECT id, guarantee_number AS "num", expiry_date AS "expiryDate" FROM bank_guarantees
       WHERE expiry_date IS NOT NULL AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::int`,
      [EXPIRY_WINDOW_DAYS]
    );
    for (const g of guarantees) {
      await insertAutomationTask({
        title: `متابعة اقتراب انتهاء ضمان بنكي رقم ${g.num ?? g.id}`,
        sourceType: "guarantee_expiry", sourceId: g.id, triggerKey: `expiry_${EXPIRY_WINDOW_DAYS}d`,
        linkedEntityType: "bankGuarantee", linkedEntityId: g.id, priority: "high", dueDate: g.expiryDate,
      });
    }

    // اقتراب انتهاء تسجيل جهة حكومية
    const { rows: registrations } = await pool.query(
      `SELECT id, expiry_date AS "expiryDate" FROM government_registrations
       WHERE expiry_date IS NOT NULL AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::int`,
      [EXPIRY_WINDOW_DAYS]
    );
    for (const r of registrations) {
      await insertAutomationTask({
        title: `متابعة اقتراب انتهاء تسجيل جهة حكومية #${r.id}`,
        sourceType: "registration_expiry", sourceId: r.id, triggerKey: `expiry_${EXPIRY_WINDOW_DAYS}d`,
        linkedEntityType: "governmentRegistration", linkedEntityId: r.id, priority: "high", dueDate: r.expiryDate,
      });
    }

    // تأخر مورد (استدلالي) — أمر شراء بلا تقدّم في مراحله منذ فترة، وحالته غير نهائية
    const { rows: delayedPOs } = await pool.query(
      `SELECT po.id, po.order_number AS "orderNumber", po.execution_stage AS "executionStage", MAX(h.changed_at) AS "lastChange"
       FROM direct_purchase_orders po
       LEFT JOIN po_stage_history h ON h.purchase_order_id = po.id
       WHERE po.execution_stage NOT IN ('closed', 'delivered_to_entity')
       GROUP BY po.id, po.order_number, po.execution_stage
       HAVING COALESCE(MAX(h.changed_at), po.created_at) < now() - ($1::int || ' days')::interval`,
      [SUPPLIER_DELAY_DAYS]
    );
    for (const po of delayedPOs) {
      await insertAutomationTask({
        title: `متابعة تأخر مورد — أمر شراء ${po.orderNumber ?? po.id} (استدلالي)`,
        description: "لم يتقدّم أمر الشراء في مراحله منذ فترة — يُنصح بالمتابعة مع المورد.",
        sourceType: "supplier_delay", sourceId: po.id, triggerKey: `delay_${SUPPLIER_DELAY_DAYS}d`,
        linkedEntityType: "purchaseOrder", linkedEntityId: po.id, priority: "high",
      });
    }

    // تنبيهات اقتراب/تجاوز موعد الاستحقاق للمهام القائمة
    const { rows: dueSoon } = await pool.query(
      `SELECT id, title, assigned_to AS "assignedTo", due_date AS "dueDate" FROM tasks
       WHERE status NOT IN ('completed','cancelled') AND due_date IS NOT NULL
         AND due_date BETWEEN now() AND now() + interval '2 days' AND assigned_to IS NOT NULL`
    );
    for (const t of dueSoon) {
      const { rows: existing } = await pool.query(`SELECT 1 FROM notifications WHERE link=$1 AND type='due_soon' LIMIT 1`, [`/tasks?id=${t.id}`]);
      if (!existing.length) await createNotification({ recipientUserId: t.assignedTo, type: "due_soon", message: `اقترب موعد استحقاق مهمتك: ${t.title}`, link: `/tasks?id=${t.id}` });
    }
    const { rows: overdue } = await pool.query(
      `SELECT id, title, assigned_to AS "assignedTo" FROM tasks
       WHERE status NOT IN ('completed','cancelled') AND due_date IS NOT NULL AND due_date < now() AND assigned_to IS NOT NULL`
    );
    for (const t of overdue) {
      const { rows: existing } = await pool.query(`SELECT 1 FROM notifications WHERE link=$1 AND type='overdue' LIMIT 1`, [`/tasks?id=${t.id}`]);
      if (!existing.length) await createNotification({ recipientUserId: t.assignedTo, type: "overdue", message: `تأخرت مهمتك عن موعدها: ${t.title}`, link: `/tasks?id=${t.id}` });
    }
  } catch (err) {
    logger.error({ err }, "runAutomationChecks failed");
  }
}

/** هل القالب مستحق التوليد اليوم حسب قاعدة تكراره؟ */
function isTemplateDueToday(t: typeof recurringTaskTemplatesTable.$inferSelect): boolean {
  const today = new Date();
  if (t.recurrenceRule === "daily") return true;
  if (t.recurrenceRule === "weekly") return today.getDay() === (t.dayOfWeek ?? 0);
  if (t.recurrenceRule === "monthly") return today.getDate() === (t.dayOfMonth ?? 1);
  return false;
}

/**
 * توليد نسخة اليوم من قالب واحد: يؤرشف نسخ الأيام السابقة أولاً، ثم يُنشئ نسخة
 * اليوم (idempotent عبر trigger_key اليومي) بموعد استحقاق نهاية اليوم وشرط الإثبات.
 */
async function generateForTemplate(t: typeof recurringTaskTemplatesTable.$inferSelect): Promise<number | null> {
  const today = new Date();
  const dedupeKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // أرشفة نسخ الأيام السابقة من نفس القالب (تبقى بحالتها كسجل تاريخي، لكنها تختفي من القوائم النشطة)
  await pool.query(
    `UPDATE tasks SET is_archived = true, updated_at = now()
     WHERE recurring_template_id = $1 AND is_archived = false AND trigger_key IS DISTINCT FROM $2`,
    [t.id, dedupeKey]
  );

  const taskId = await insertAutomationTask({
    title: t.title,
    description: t.description ?? undefined,
    sourceType: "recurring_template",
    sourceId: t.id,
    triggerKey: dedupeKey,
    priority: t.priority,
    assignedTo: t.assignedTo,
    dueDate: `${ymd}T23:59:59`,
    proofType: t.proofType ?? "none",
    notificationMessage: `تم إضافة مهمة دورية جديدة لقائمتك: ${t.title}`,
  });
  if (taskId) {
    await db.update(tasksTable).set({ taskTypeId: t.taskTypeId, recurringTemplateId: t.id }).where(eq(tasksTable.id, taskId));
    await db.update(recurringTaskTemplatesTable).set({ lastGeneratedAt: new Date().toISOString() }).where(eq(recurringTaskTemplatesTable.id, t.id));
  }
  return taskId;
}

/** توليد المهام المستحقة من قوالب التكرار (يومي/أسبوعي/شهري) */
export async function generateDueRecurringTasks(): Promise<void> {
  try {
    const templates = await db.select().from(recurringTaskTemplatesTable).where(eq(recurringTaskTemplatesTable.isActive, true));
    for (const t of templates) {
      if (!isTemplateDueToday(t)) continue;
      await generateForTemplate(t);
    }
  } catch (err) {
    logger.error({ err }, "generateDueRecurringTasks failed");
  }
}
