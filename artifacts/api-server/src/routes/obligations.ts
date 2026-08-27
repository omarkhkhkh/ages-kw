import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { insertAutomationTask } from "./task-automation";

/* ═══ الالتزامات المتجددة + مسيّر الرواتب — الخارطة الموحّدة، المرحلة ٦ ═══
   نمط واحد لثلاثة أنواع (تسجيلات الجهات، مستندات الشركة، وثائق العمال الأربع):
   النظام يراقب الانتهاء ← لوحة التجديدات عند التنفيذي ← مهمة للمندوب بضغطة ←
   إغلاقها بإثباتين إلزاميين: التاريخ الجديد + المبلغ (والصفر يُسجَّل صراحةً ليفرَّق
   «جُدّد مجانًا» عن «لم يُتابَع») ← المصروف يتقيد وحده على مركز التكلفة الصحيح —
   وإقامة عامل الصيانة على مركز الصيانة تحديدًا. والمسيّر: مسودة شهرية يرحّلها المالي. */

const router = Router();

const WORKER_DOCS: Record<string, { col: string; labelAr: string }> = {
  residency:        { col: "residency_expiry",        labelAr: "إقامة" },
  passport:         { col: "passport_expiry",         labelAr: "جواز" },
  health_insurance: { col: "health_insurance_expiry", labelAr: "تأمين صحي" },
  work_permit:      { col: "work_permit_expiry",      labelAr: "إذن عمل" },
};
const KINDS = ["government_registration", "company_document", "worker"] as const;

async function hasHat(userId: number | undefined, key: string): Promise<boolean> {
  if (!userId) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM user_positions up JOIN positions p ON p.id = up.position_id
     WHERE up.user_id = $1 AND p.key = $2 LIMIT 1`, [userId, key]);
  return rows.length > 0;
}
const isGM = async (req: Request) => req.session.role === "admin" || (await hasHat(req.session.userId, "general_manager"));
const isExec = async (req: Request) => hasHat(req.session.userId, "executive_manager");
const isCFO = async (req: Request) => hasHat(req.session.userId, "financial_manager");
const canManageRenewals = async (req: Request) => (await isGM(req)) || (await isExec(req));
const canSeeBoard = async (req: Request) => (await canManageRenewals(req)) || (await isCFO(req));
const canPayroll = async (req: Request) => (await isGM(req)) || (await isCFO(req));

/** مركز تكلفة قسم العامل — من وحدته المسندة */
async function workerCostCenter(assignedModule: string | null): Promise<{ id: number; name: string } | null> {
  const name = assignedModule === "maintenance" ? "الصيانة" : assignedModule === "transportation" ? "النقل" : null;
  if (!name) return null;
  const { rows } = await pool.query(`SELECT id, name FROM cost_centers WHERE name = $1`, [name]);
  return rows[0] ?? null;
}

/* ── لوحة التجديدات: الأنواع الثلاثة في جدول واحد مع حالة مهمة كلٍّ ── */
router.get("/board", async (req: Request, res: Response) => {
  if (!(await canSeeBoard(req))) return res.status(403).json({ error: "لوحة التجديدات للمديرين" });
  const windowDays = Math.min(365, Number(req.query.windowDays) || 60);
  try {
    const { rows } = await pool.query(
      `SELECT * FROM (
         SELECT 'government_registration' AS kind, gr.id, gr.entity_name AS name, NULL AS doc_type,
                gr.expiry_date AS expiry, NULL::text AS module
         FROM government_registrations gr WHERE gr.expiry_date IS NOT NULL
         UNION ALL
         SELECT 'company_document', cd.id, cd.name, NULL, cd.expiry_date, NULL
         FROM company_documents cd WHERE cd.expiry_date IS NOT NULL
         UNION ALL
         SELECT 'worker', w.id, w.full_name, d.doc_type, d.expiry, w.assigned_module
         FROM workers w
         CROSS JOIN LATERAL (VALUES
           ('residency', w.residency_expiry), ('passport', w.passport_expiry),
           ('health_insurance', w.health_insurance_expiry), ('work_permit', w.work_permit_expiry)
         ) AS d(doc_type, expiry)
         WHERE w.status = 'active' AND d.expiry IS NOT NULL
       ) obligations
       WHERE expiry <= CURRENT_DATE + $1::int
       ORDER BY expiry`, [windowDays]);

    // مهام التجديد المفتوحة — لعرض «مهمة قائمة» بدل زر الإرسال
    const { rows: openTasks } = await pool.query(
      `SELECT id, linked_entity_type AS "kind", linked_entity_id AS "entityId", trigger_key AS "triggerKey",
              assigned_to AS "assignedTo", status
       FROM tasks WHERE source_type = 'obligation' AND status NOT IN ('completed','cancelled')`);
    const taskOf = (kind: string, id: number, docType: string | null) =>
      openTasks.find((t: any) => t.kind === kind && Number(t.entityId) === Number(id) &&
        (kind !== "worker" || t.triggerKey?.startsWith(`renew:${docType}:`)));

    return res.json(rows.map((r: any) => {
      const t = taskOf(r.kind, r.id, r.doc_type);
      return {
        kind: r.kind, id: r.id, name: r.name, docType: r.doc_type,
        docLabel: r.doc_type ? WORKER_DOCS[r.doc_type]?.labelAr : r.kind === "government_registration" ? "تسجيل جهة" : "مستند شركة",
        expiry: r.expiry, module: r.module,
        daysLeft: Math.ceil((new Date(r.expiry).getTime() - Date.now()) / 86400000),
        openTaskId: t?.id ?? null, openTaskAssignee: t?.assignedTo ?? null,
      };
    }));
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب لوحة التجديدات" }); }
});

/* ── إرسال مهمة تجديد للمندوب — بضغطة، بمنع تكرار ── */
router.post("/dispatch", async (req: Request, res: Response) => {
  if (!(await canManageRenewals(req))) return res.status(403).json({ error: "إرسال التجديدات للمدير العام أو التنفيذي" });
  const kind = String(req.body?.kind ?? "");
  const id = Number(req.body?.id);
  const docType = req.body?.docType ? String(req.body.docType) : null;
  const assigneeUserId = Number(req.body?.assigneeUserId);
  if (!KINDS.includes(kind as any) || !id) return res.status(400).json({ error: "نوع الالتزام ومعرّفه مطلوبان" });
  if (kind === "worker" && !WORKER_DOCS[docType ?? ""]) return res.status(400).json({ error: "حدد وثيقة العامل: إقامة/جواز/تأمين صحي/إذن عمل" });
  if (!assigneeUserId) return res.status(400).json({ error: "اختر المندوب المنفّذ" });
  try {
    let name = "", expiry: string | null = null;
    if (kind === "government_registration") {
      const { rows } = await pool.query(`SELECT entity_name AS n, expiry_date AS e FROM government_registrations WHERE id = $1`, [id]);
      if (!rows.length) return res.status(404).json({ error: "التسجيل غير موجود" });
      name = `تسجيل ${rows[0].n}`; expiry = rows[0].e;
    } else if (kind === "company_document") {
      const { rows } = await pool.query(`SELECT name AS n, expiry_date AS e FROM company_documents WHERE id = $1`, [id]);
      if (!rows.length) return res.status(404).json({ error: "المستند غير موجود" });
      name = `مستند ${rows[0].n}`; expiry = rows[0].e;
    } else {
      const { rows } = await pool.query(`SELECT full_name AS n, ${WORKER_DOCS[docType!].col} AS e FROM workers WHERE id = $1`, [id]);
      if (!rows.length) return res.status(404).json({ error: "العامل غير موجود" });
      name = `${WORKER_DOCS[docType!].labelAr} العامل ${rows[0].n}`; expiry = rows[0].e;
    }
    // منع مهمتين مفتوحتين لنفس الالتزام
    const { rows: dup } = await pool.query(
      `SELECT id FROM tasks WHERE source_type = 'obligation' AND linked_entity_type = $1 AND linked_entity_id = $2
         AND ($3::text IS NULL OR trigger_key LIKE 'renew:' || $3 || ':%')
         AND status NOT IN ('completed','cancelled') LIMIT 1`, [kind, id, docType]);
    if (dup.length) return res.status(409).json({ error: `مهمة تجديد مفتوحة بالفعل (#${dup[0].id})` });

    const taskId = await insertAutomationTask({
      title: `تجديد ${name}`,
      description: `التزام متجدد — أغلق المهمة من لوحة التجديدات بإثباتين: تاريخ الانتهاء الجديد + المبلغ المدفوع (والمجاني يُسجَّل صفرًا).`,
      sourceType: "obligation", sourceId: id,
      triggerKey: `renew:${docType ?? "expiry"}:${expiry ?? "none"}`,
      linkedEntityType: kind, linkedEntityId: id,
      priority: "high", dueDate: expiry, assignedTo: assigneeUserId, proofType: "note",
      notificationMessage: `تجديد مطلوب: ${name}`,
    });
    if (!taskId) return res.status(409).json({ error: "المهمة موجودة بالفعل لنفس الاستحقاق" });
    return res.status(201).json({ taskId });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل إرسال مهمة التجديد" }); }
});

/* ── إتمام التجديد بإثباتين: التاريخ الجديد + المبلغ (الصفر صراحةً) ── */
router.post("/complete", async (req: Request, res: Response) => {
  const taskId = Number(req.body?.taskId);
  const newExpiryDate = String(req.body?.newExpiryDate ?? "").trim();
  const amountRaw = req.body?.amount;
  const notes = String(req.body?.notes ?? "").trim() || null;
  if (!taskId || !newExpiryDate) return res.status(400).json({ error: "المهمة وتاريخ الانتهاء الجديد مطلوبان" });
  if (amountRaw === undefined || amountRaw === null || amountRaw === "") {
    return res.status(400).json({ error: "المبلغ إلزامي — والمجاني يُسجَّل صفرًا ليفرَّق «جُدّد مجانًا» عن «لم يُتابَع»" });
  }
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "مبلغ غير صالح" });
  const client = await pool.connect();
  try {
    const { rows: tr } = await pool.query(
      `SELECT id, linked_entity_type AS kind, linked_entity_id AS eid, trigger_key AS tk, assigned_to AS assignee, status, title
       FROM tasks WHERE id = $1 AND source_type = 'obligation'`, [taskId]);
    if (!tr.length) return res.status(404).json({ error: "مهمة التجديد غير موجودة" });
    const t = tr[0];
    if (t.status === "completed") return res.status(409).json({ error: "المهمة مكتملة بالفعل" });
    if (t.assignee !== req.session.userId && !(await canManageRenewals(req))) {
      return res.status(403).json({ error: "الإتمام للمندوب المكلَّف أو المديرين" });
    }

    // تحديد العمود المُحدَّث + مركز تكلفة المصروف
    let updateSql = "", label = "", category = "general";
    let cc: { id: number; name: string } | null = null;
    if (t.kind === "government_registration") {
      updateSql = `UPDATE government_registrations SET expiry_date = $1, status = 'active', updated_at = now() WHERE id = $2`;
      label = "تسجيل جهة";
    } else if (t.kind === "company_document") {
      updateSql = `UPDATE company_documents SET expiry_date = $1, updated_at = now() WHERE id = $2`;
      label = "مستند شركة";
    } else if (t.kind === "worker") {
      const docType = String(t.tk ?? "").split(":")[1] ?? "";
      const doc = WORKER_DOCS[docType];
      if (!doc) return res.status(400).json({ error: "وثيقة العامل غير معروفة في المهمة" });
      updateSql = `UPDATE workers SET ${doc.col} = $1, updated_at = now() WHERE id = $2`;
      label = doc.labelAr;
      category = "residency";
      const { rows: w } = await pool.query(`SELECT assigned_module AS m FROM workers WHERE id = $1`, [t.eid]);
      cc = await workerCostCenter(w[0]?.m ?? null); // إقامة عامل الصيانة → مركز الصيانة
    } else {
      return res.status(400).json({ error: "نوع الالتزام غير معروف" });
    }

    await client.query("BEGIN");
    await client.query(updateSql, [newExpiryDate, t.eid]);
    let expenseId: number | null = null;
    if (amount > 0) {
      const { rows: ex } = await client.query(
        `INSERT INTO finance_expenses (description, amount, due_date, paid_date, status, category, cost_center_id, worker_id, notes, created_by)
         VALUES ($1,$2,CURRENT_DATE,CURRENT_DATE,'paid',$3,$4,$5,$6,$7) RETURNING id`,
        [`تجديد ${label} — ${t.title.replace(/^تجديد /, "")}`, String(amount), category,
         cc?.id ?? null, t.kind === "worker" ? t.eid : null,
         notes ?? "مصروف تشغيلي مولَّد من حلقة التجديدات", req.session.userId ?? null]);
      expenseId = ex[0].id;
    }
    await client.query(
      `UPDATE tasks SET status = 'completed', completed_at = now(), actual_cost = $1, progress_percent = 100,
              description = COALESCE(description || E'\n', '') || $2, updated_at = now() WHERE id = $3`,
      [String(amount),
       `إثبات الإتمام: الانتهاء الجديد ${newExpiryDate} · المبلغ ${amount === 0 ? "صفر (مجاني)" : amount + " د.ك"}${expenseId ? ` · مصروف #${expenseId}` : ""}${notes ? ` · ${notes}` : ""}`,
       taskId]);
    await client.query("COMMIT");
    return res.json({ ok: true, expenseId, costCenter: cc?.name ?? (amount > 0 ? "حسب التصنيف التلقائي" : null), free: amount === 0 });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* قد لا تكون بدأت */ }
    console.error(e); return res.status(500).json({ error: "فشل إتمام التجديد" });
  } finally { client.release(); }
});

/* ══════════ مسيّر الرواتب ══════════ */

router.post("/payroll/generate", async (req: Request, res: Response) => {
  if (!(await canPayroll(req))) return res.status(403).json({ error: "المسيّر للمدير المالي أو العام" });
  const year = Number(req.body?.year);
  const month = Number(req.body?.month);
  if (!year || !month || month < 1 || month > 12) return res.status(400).json({ error: "السنة والشهر مطلوبان" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const run = await client.query(
      `INSERT INTO payroll_runs (year, month, created_by) VALUES ($1,$2,$3)
       ON CONFLICT (year, month) DO NOTHING RETURNING id`,
      [year, month, req.session.userId ?? null]);
    if (!run.rows.length) { await client.query("ROLLBACK"); return res.status(409).json({ error: "مسيّر هذا الشهر موجود بالفعل" }); }
    const runId = run.rows[0].id;
    // كل عامل نشط براتب — مركزه من وحدته المسندة، وبلا وحدة → عام (يصنَّف تلقائيًا)
    const { rows: items } = await client.query(
      `INSERT INTO payroll_items (run_id, worker_id, worker_name, salary, cost_center_id, cost_center_name)
       SELECT $1, w.id, w.full_name, w.salary,
              cc.id, cc.name
       FROM workers w
       LEFT JOIN cost_centers cc ON cc.name = CASE w.assigned_module WHEN 'maintenance' THEN 'الصيانة' WHEN 'transportation' THEN 'النقل' END
       WHERE w.status = 'active' AND w.salary IS NOT NULL AND w.salary > 0
       RETURNING id`, [runId]);
    await client.query("COMMIT");
    return res.status(201).json({ runId, workers: items.length });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* قد لا تكون بدأت */ }
    console.error(e); return res.status(500).json({ error: "فشل توليد المسيّر" });
  } finally { client.release(); }
});

router.get("/payroll", async (req: Request, res: Response) => {
  if (!(await canPayroll(req)) && !(await isExec(req))) return res.status(403).json({ error: "المسيّر للمديرين" });
  try {
    const { rows: runs } = await pool.query(
      `SELECT r.id, r.year, r.month, r.status, r.posted_at AS "postedAt",
              cu.full_name AS "createdByName", pu.full_name AS "postedByName",
              (SELECT COALESCE(SUM(salary),0) FROM payroll_items i WHERE i.run_id = r.id)::numeric AS total,
              (SELECT COUNT(*)::int FROM payroll_items i WHERE i.run_id = r.id) AS workers
       FROM payroll_runs r
       LEFT JOIN users cu ON cu.id = r.created_by
       LEFT JOIN users pu ON pu.id = r.posted_by
       ORDER BY r.year DESC, r.month DESC LIMIT 24`);
    const runId = req.query.runId ? Number(req.query.runId) : runs[0]?.id;
    let items: any[] = [];
    if (runId) {
      const { rows } = await pool.query(
        `SELECT i.id, i.worker_id AS "workerId", i.worker_name AS "workerName", i.salary,
                i.cost_center_name AS "costCenterName", i.expense_id AS "expenseId"
         FROM payroll_items i WHERE i.run_id = $1 ORDER BY i.worker_name`, [runId]);
      items = rows;
    }
    return res.json({ runs, items, itemsRunId: runId ?? null });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب المسيّر" }); }
});

// تعديل/استبعاد بند — على المسودة فقط
router.patch("/payroll/items/:id", async (req: Request, res: Response) => {
  if (!(await canPayroll(req))) return res.status(403).json({ error: "للمدير المالي أو العام" });
  const salary = Number(req.body?.salary);
  if (!Number.isFinite(salary) || salary <= 0) return res.status(400).json({ error: "راتب غير صالح" });
  try {
    const { rows } = await pool.query(
      `UPDATE payroll_items i SET salary = $1
       FROM payroll_runs r WHERE i.id = $2 AND r.id = i.run_id AND r.status = 'مسودة' RETURNING i.id`,
      [String(salary), Number(req.params.id)]);
    if (!rows.length) return res.status(409).json({ error: "البند غير موجود أو المسيّر مرحَّل" });
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل التعديل" }); }
});
router.delete("/payroll/items/:id", async (req: Request, res: Response) => {
  if (!(await canPayroll(req))) return res.status(403).json({ error: "للمدير المالي أو العام" });
  try {
    const { rows } = await pool.query(
      `DELETE FROM payroll_items i USING payroll_runs r
       WHERE i.id = $1 AND r.id = i.run_id AND r.status = 'مسودة' RETURNING i.id`, [Number(req.params.id)]);
    if (!rows.length) return res.status(409).json({ error: "البند غير موجود أو المسيّر مرحَّل" });
    return res.status(204).send();
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل الحذف" }); }
});

/* ── الترحيل: كل راتب مصروفٌ على مركز قسم صاحبه — بمراجعة المالي ── */
router.post("/payroll/:id/post", async (req: Request, res: Response) => {
  if (!(await canPayroll(req))) return res.status(403).json({ error: "الترحيل للمدير المالي أو العام" });
  const runId = Number(req.params.id);
  const client = await pool.connect();
  try {
    const { rows: rr } = await pool.query(`SELECT * FROM payroll_runs WHERE id = $1`, [runId]);
    if (!rr.length) return res.status(404).json({ error: "المسيّر غير موجود" });
    if (rr[0].status === "مرحّل") return res.status(409).json({ error: "المسيّر مرحَّل بالفعل" });
    const { rows: items } = await pool.query(`SELECT * FROM payroll_items WHERE run_id = $1`, [runId]);
    if (!items.length) return res.status(400).json({ error: "المسيّر بلا بنود" });

    await client.query("BEGIN");
    for (const it of items) {
      const { rows: ex } = await client.query(
        `INSERT INTO finance_expenses (description, amount, due_date, status, category, cost_center_id, worker_id, created_by)
         VALUES ($1,$2,CURRENT_DATE,'pending','salary',$3,$4,$5) RETURNING id`,
        [`راتب ${it.worker_name} — ${rr[0].month}/${rr[0].year}`, it.salary, it.cost_center_id, it.worker_id, req.session.userId ?? null]);
      await client.query(`UPDATE payroll_items SET expense_id = $1 WHERE id = $2`, [ex[0].id, it.id]);
    }
    await client.query(
      `UPDATE payroll_runs SET status = 'مرحّل', posted_by = $1, posted_at = now() WHERE id = $2`,
      [req.session.userId ?? null, runId]);
    await client.query("COMMIT");
    return res.json({ ok: true, expenses: items.length });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* قد لا تكون بدأت */ }
    console.error(e); return res.status(500).json({ error: "فشل ترحيل المسيّر" });
  } finally { client.release(); }
});

export default router;
