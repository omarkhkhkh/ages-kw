import { Router, type Request, type Response } from "express";
import { eq, gt } from "drizzle-orm";
import {
  db,
  pool,
  supplierEvaluationsTable,
  insertSupplierEvaluationSchema,
  knowledgeEntriesTable,
  insertKnowledgeEntrySchema,
  updateKnowledgeEntrySchema,
  teamMessagesTable,
  insertTeamMessageSchema,
  researchSpecsTable,
  insertResearchSpecSchema,
  updateResearchSpecSchema,
  researchAssignmentsTable,
  insertResearchAssignmentSchema,
  updateResearchAssignmentSchema,
} from "@workspace/db";

const router = Router();

const isAdmin = (req: Request) => req.session.role === "admin";

function parseId(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ══════════════════════════════════════
   DASHBOARD STATS
══════════════════════════════════════ */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    if (isAdmin(req)) {
      const { rows } = await pool.query(`
        SELECT
          'admin' AS "scope",
          (SELECT COUNT(*)::int FROM suppliers) AS "totalSuppliers",
          (SELECT COUNT(*)::int FROM suppliers WHERE status = 'draft') AS "pendingSuppliers",
          (SELECT COUNT(*)::int FROM competitors) AS "totalCompetitors",
          (SELECT COUNT(*)::int FROM knowledge_entries) AS "totalKnowledgeEntries",
          (SELECT COUNT(*)::int FROM research_specs) AS "totalSpecs",
          (SELECT COUNT(*)::int FROM research_assignments WHERE status <> 'completed') AS "openAssignments",
          (SELECT COUNT(*)::int FROM tasks WHERE task_type = 'بحث' AND status NOT IN ('completed', 'cancelled')) AS "openResearchTasks"
      `);
      return res.json(rows[0]);
    }
    const userId = req.session.userId!;
    const { rows } = await pool.query(
      `SELECT
         'employee' AS "scope",
         (SELECT COUNT(*)::int FROM suppliers WHERE created_by_user_id = $1) AS "mySuppliers",
         (SELECT COUNT(*)::int FROM knowledge_entries WHERE created_by_user_id = $1) AS "myKnowledgeEntries",
         (SELECT COUNT(*)::int FROM research_specs WHERE created_by_user_id = $1) AS "mySpecs",
         (SELECT COUNT(*)::int FROM research_assignments WHERE assigned_to_user_id = $1 AND status <> 'completed') AS "myOpenAssignments"`,
      [userId]
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب المؤشرات" });
  }
});

/* ══════════════════════════════════════
   UNIFIED SEARCH
══════════════════════════════════════ */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json([]);
    const like = `%${q}%`;
    const admin = isAdmin(req);
    const userId = req.session.userId!;
    // "specs"/"knowledge" are per-employee work product — scoped to the requester unless admin.
    // Suppliers/competitors/tenders remain shared reference data, visible to everyone.
    const knowledgeScope = admin ? "" : `AND created_by_user_id = ${Number(userId)}`;
    const specsScope = admin ? "" : `AND created_by_user_id = ${Number(userId)}`;
    const { rows } = await pool.query(
      `
      (SELECT 'supplier' AS type, id, name AS title, COALESCE(specialization, type) AS subtitle
       FROM suppliers WHERE (name ILIKE $1 OR specialization ILIKE $1) AND (status = 'approved' OR created_by_user_id = ${Number(userId)} OR ${admin}) LIMIT 5)
      UNION ALL
      (SELECT 'competitor' AS type, id, name AS title, COALESCE(short_name, '') AS subtitle
       FROM competitors WHERE name ILIKE $1 OR short_name ILIKE $1 LIMIT 5)
      UNION ALL
      (SELECT 'tender' AS type, id, project_name AS title, tender_number AS subtitle
       FROM tenders WHERE project_name ILIKE $1 OR tender_number ILIKE $1 LIMIT 5)
      UNION ALL
      (SELECT 'knowledge' AS type, id, title, outcome AS subtitle
       FROM knowledge_entries WHERE (title ILIKE $1 OR reasons ILIKE $1 OR lessons_learned ILIKE $1) ${knowledgeScope} LIMIT 5)
      UNION ALL
      (SELECT 'spec' AS type, id, item_name AS title, linked_entity_type AS subtitle
       FROM research_specs WHERE (item_name ILIKE $1 OR notes ILIKE $1) ${specsScope} LIMIT 5)
      `,
      [like]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في البحث" });
  }
});

/* ══════════════════════════════════════
   SUPPLIER EVALUATIONS (تقييم الموردين/المصانع)
══════════════════════════════════════ */
router.get("/evaluations", async (req: Request, res: Response) => {
  try {
    const supplierId = req.query.supplierId ? Number(req.query.supplierId) : null;
    if (!supplierId) return res.status(400).json({ error: "معرّف المورد مطلوب" });
    const { rows } = await pool.query(
      `SELECT se.id, se.supplier_id AS "supplierId", se.quality_score AS "qualityScore",
              se.price_score AS "priceScore", se.commitment_score AS "commitmentScore",
              se.notes, se.evaluated_at AS "evaluatedAt", u.full_name AS "evaluatedByName"
       FROM supplier_evaluations se
       LEFT JOIN users u ON u.id = se.evaluated_by_user_id
       WHERE se.supplier_id = $1
       ORDER BY se.evaluated_at DESC`,
      [supplierId]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب التقييمات" });
  }
});

router.get("/evaluations/summary", async (req: Request, res: Response) => {
  try {
    const supplierId = req.query.supplierId ? Number(req.query.supplierId) : null;
    if (!supplierId) return res.status(400).json({ error: "معرّف المورد مطلوب" });
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int AS "count",
         ROUND(AVG(quality_score)::numeric, 2) AS "avgQuality",
         ROUND(AVG(price_score)::numeric, 2) AS "avgPrice",
         ROUND(AVG(commitment_score)::numeric, 2) AS "avgCommitment",
         ROUND(AVG((quality_score + price_score + commitment_score) / 3.0)::numeric, 2) AS "overallStars"
       FROM supplier_evaluations WHERE supplier_id = $1`,
      [supplierId]
    );
    return res.json(rows[0]);
  } catch {
    return res.status(500).json({ error: "فشل في جلب ملخص التقييم" });
  }
});

router.post("/evaluations", async (req: Request, res: Response) => {
  try {
    const data = insertSupplierEvaluationSchema.parse({ ...req.body, evaluatedByUserId: req.session.userId! });
    const [row] = await db.insert(supplierEvaluationsTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة التقييم" });
  }
});

/* ══════════════════════════════════════
   KNOWLEDGE CENTER (مركز المعرفة المؤسسية)
══════════════════════════════════════ */
router.get("/knowledge", async (req: Request, res: Response) => {
  try {
    const { outcome, tenderId, search, employeeId } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (outcome) { params.push(outcome); conditions.push(`ke.outcome = $${params.length}`); }
    if (tenderId) { params.push(Number(tenderId)); conditions.push(`ke.tender_id = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(ke.title ILIKE $${params.length} OR ke.reasons ILIKE $${params.length} OR ke.lessons_learned ILIKE $${params.length})`); }
    if (isAdmin(req)) {
      // Manager may optionally narrow to one employee's work; otherwise sees everyone's.
      if (employeeId) { params.push(Number(employeeId)); conditions.push(`ke.created_by_user_id = $${params.length}`); }
    } else {
      // Employees never see each other's knowledge entries — forced regardless of any query param.
      params.push(req.session.userId!);
      conditions.push(`ke.created_by_user_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT ke.id, ke.tender_id AS "tenderId", ke.practice_id AS "practiceId", ke.title, ke.outcome,
              ke.reasons, ke.lessons_learned AS "lessonsLearned", ke.competitor_names AS "competitorNames",
              ke.tags, ke.created_at AS "createdAt", ke.updated_at AS "updatedAt",
              u.full_name AS "createdByName", t.tender_number AS "tenderNumber", pr.practice_number AS "practiceNumber"
       FROM knowledge_entries ke
       LEFT JOIN users u ON u.id = ke.created_by_user_id
       LEFT JOIN tenders t ON t.id = ke.tender_id
       LEFT JOIN practices pr ON pr.id = ke.practice_id
       ${where}
       ORDER BY ke.created_at DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب مركز المعرفة" });
  }
});

router.post("/knowledge", async (req: Request, res: Response) => {
  try {
    const data = insertKnowledgeEntrySchema.parse({ ...req.body, createdByUserId: req.session.userId! });
    const [row] = await db.insert(knowledgeEntriesTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة الدرس المستفاد" });
  }
});

router.patch("/knowledge/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [existing] = await db.select().from(knowledgeEntriesTable).where(eq(knowledgeEntriesTable.id, id));
    if (!existing) return res.status(404).json({ error: "السجل غير موجود" });
    if (!isAdmin(req) && existing.createdByUserId !== req.session.userId) return res.status(403).json({ error: "لا يمكنك تعديل سجل موظف آخر" });
    const data = updateKnowledgeEntrySchema.parse(req.body);
    const [row] = await db.update(knowledgeEntriesTable).set({ ...data, updatedAt: new Date() }).where(eq(knowledgeEntriesTable.id, id)).returning();
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث السجل" });
  }
});

router.delete("/knowledge/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [existing] = await db.select().from(knowledgeEntriesTable).where(eq(knowledgeEntriesTable.id, id));
    if (!existing) return res.status(404).json({ error: "السجل غير موجود" });
    if (!isAdmin(req) && existing.createdByUserId !== req.session.userId) return res.status(403).json({ error: "لا يمكنك حذف سجل موظف آخر" });
    await db.delete(knowledgeEntriesTable).where(eq(knowledgeEntriesTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف السجل" });
  }
});

/* ══════════════════════════════════════
   SPECS HUB (مركز المواصفات — ملفات مرتبطة بصنف/مناقصة/ممارسة/طلب عرض سعر)
══════════════════════════════════════ */
router.get("/specs", async (req: Request, res: Response) => {
  try {
    const { search, employeeId, linkedEntityType } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (search) { params.push(`%${search}%`); conditions.push(`(rs.item_name ILIKE $${params.length} OR rs.notes ILIKE $${params.length})`); }
    if (linkedEntityType) { params.push(linkedEntityType); conditions.push(`rs.linked_entity_type = $${params.length}`); }
    if (isAdmin(req)) {
      if (employeeId) { params.push(Number(employeeId)); conditions.push(`rs.created_by_user_id = $${params.length}`); }
    } else {
      params.push(req.session.userId!);
      conditions.push(`rs.created_by_user_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT rs.id, rs.item_name AS "itemName", rs.file_url AS "fileUrl",
              rs.linked_entity_type AS "linkedEntityType", rs.linked_entity_id AS "linkedEntityId",
              rs.notes, rs.created_at AS "createdAt", rs.updated_at AS "updatedAt",
              rs.created_by_user_id AS "createdByUserId", u.full_name AS "createdByName"
       FROM research_specs rs
       LEFT JOIN users u ON u.id = rs.created_by_user_id
       ${where}
       ORDER BY rs.created_at DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب المواصفات" });
  }
});

router.post("/specs", async (req: Request, res: Response) => {
  try {
    const data = insertResearchSpecSchema.parse({ ...req.body, createdByUserId: req.session.userId! });
    const [row] = await db.insert(researchSpecsTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة المواصفة" });
  }
});

router.patch("/specs/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [existing] = await db.select().from(researchSpecsTable).where(eq(researchSpecsTable.id, id));
    if (!existing) return res.status(404).json({ error: "السجل غير موجود" });
    if (!isAdmin(req) && existing.createdByUserId !== req.session.userId) return res.status(403).json({ error: "لا يمكنك تعديل مواصفة موظف آخر" });
    const data = updateResearchSpecSchema.parse(req.body);
    const [row] = await db.update(researchSpecsTable).set({ ...data, updatedAt: new Date() }).where(eq(researchSpecsTable.id, id)).returning();
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث المواصفة" });
  }
});

router.delete("/specs/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [existing] = await db.select().from(researchSpecsTable).where(eq(researchSpecsTable.id, id));
    if (!existing) return res.status(404).json({ error: "السجل غير موجود" });
    if (!isAdmin(req) && existing.createdByUserId !== req.session.userId) return res.status(403).json({ error: "لا يمكنك حذف مواصفة موظف آخر" });
    await db.delete(researchSpecsTable).where(eq(researchSpecsTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف المواصفة" });
  }
});

/* ══════════════════════════════════════
   ASSIGNMENTS (تكليفات المدير للموظفين — توجيه مهمة/مواصفة)
══════════════════════════════════════ */
router.get("/assignments", async (req: Request, res: Response) => {
  try {
    const { status, assignedToUserId } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (status) { params.push(status); conditions.push(`ra.status = $${params.length}`); }
    if (isAdmin(req)) {
      // Manager sees everyone's assignments; may optionally narrow to one employee.
      if (assignedToUserId) { params.push(Number(assignedToUserId)); conditions.push(`ra.assigned_to_user_id = $${params.length}`); }
    } else {
      // Employees only ever see assignments directed at them — forced regardless of any query param.
      params.push(req.session.userId!);
      conditions.push(`ra.assigned_to_user_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT ra.id, ra.title, ra.description, ra.status,
              ra.assigned_to_user_id AS "assignedToUserId", au.full_name AS "assignedToName",
              ra.assigned_by_user_id AS "assignedByUserId", bu.full_name AS "assignedByName",
              ra.linked_entity_type AS "linkedEntityType", ra.linked_entity_id AS "linkedEntityId",
              ra.created_at AS "createdAt", ra.updated_at AS "updatedAt"
       FROM research_assignments ra
       LEFT JOIN users au ON au.id = ra.assigned_to_user_id
       LEFT JOIN users bu ON bu.id = ra.assigned_by_user_id
       ${where}
       ORDER BY ra.created_at DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب التكليفات" });
  }
});

router.post("/assignments", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const data = insertResearchAssignmentSchema.parse({ ...req.body, assignedByUserId: req.session.userId! });
    const [row] = await db.insert(researchAssignmentsTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء التكليف" });
  }
});

router.patch("/assignments/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [existing] = await db.select().from(researchAssignmentsTable).where(eq(researchAssignmentsTable.id, id));
    if (!existing) return res.status(404).json({ error: "التكليف غير موجود" });
    const admin = isAdmin(req);
    if (!admin && existing.assignedToUserId !== req.session.userId) return res.status(403).json({ error: "هذا التكليف موجّه لموظف آخر" });
    // Employees may only update the status of their own assignment (e.g. start/complete it) — not reassign or retitle it.
    const data = admin ? updateResearchAssignmentSchema.parse(req.body) : { status: req.body.status };
    const [row] = await db.update(researchAssignmentsTable).set({ ...data, updatedAt: new Date() }).where(eq(researchAssignmentsTable.id, id)).returning();
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث التكليف" });
  }
});

/* ══════════════════════════════════════
   TEAM CHAT (قناة واحدة مشتركة)
══════════════════════════════════════ */
router.get("/messages", async (req: Request, res: Response) => {
  try {
    const after = req.query.after ? Number(req.query.after) : null;
    const rows = after
      ? await db.select({
          id: teamMessagesTable.id, userId: teamMessagesTable.userId,
          content: teamMessagesTable.content, createdAt: teamMessagesTable.createdAt,
        }).from(teamMessagesTable).where(gt(teamMessagesTable.id, after)).orderBy(teamMessagesTable.id)
      : await pool.query(
          `SELECT tm.id, tm.user_id AS "userId", tm.content, tm.created_at AS "createdAt", u.full_name AS "userName"
           FROM team_messages tm LEFT JOIN users u ON u.id = tm.user_id
           ORDER BY tm.id DESC LIMIT 100`
        ).then(r => r.rows.reverse());
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب الرسائل" });
  }
});

router.post("/messages", async (req: Request, res: Response) => {
  try {
    const data = insertTeamMessageSchema.parse({ content: req.body.content, userId: req.session.userId! });
    const [row] = await db.insert(teamMessagesTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إرسال الرسالة" });
  }
});

/* ══════════════════════════════════════
   PERFORMANCE ANALYTICS (تحليل الإنجاز)
══════════════════════════════════════ */
router.get("/performance", async (req: Request, res: Response) => {
  try {
    const admin = isAdmin(req);
    // Employees only ever see their own row/breakdown — never a colleague's, regardless of query params.
    const employeeFilter = admin ? "" : `AND t.assigned_to = ${Number(req.session.userId!)}`;
    const typeFilter = admin ? "" : `WHERE assigned_to = ${Number(req.session.userId!)}`;
    const [byEmployee, byType] = await Promise.all([
      pool.query(`
        SELECT u.id, u.full_name AS "fullName",
               COUNT(*) FILTER (WHERE t.status = 'completed')::int AS "completedCount",
               COUNT(*) FILTER (WHERE t.status NOT IN ('completed', 'cancelled'))::int AS "openCount",
               COUNT(*) FILTER (WHERE t.due_date IS NOT NULL AND t.due_date < now() AND t.status NOT IN ('completed', 'cancelled'))::int AS "overdueCount",
               COALESCE(ROUND(AVG(
                 CASE WHEN t.status = 'completed' AND t.completed_at IS NOT NULL
                   THEN EXTRACT(EPOCH FROM (t.completed_at::timestamp - t.created_at::timestamp)) / 3600
                 END
               )::numeric, 1), 0) AS "avgCompletionHours"
        FROM tasks t
        JOIN users u ON u.id = t.assigned_to
        WHERE 1=1 ${employeeFilter}
        GROUP BY u.id, u.full_name
        ORDER BY "completedCount" DESC
      `),
      pool.query(`
        SELECT task_type AS "taskType",
               COUNT(*)::int AS "total",
               COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < now() AND status NOT IN ('completed', 'cancelled'))::int AS "overdueCount"
        FROM tasks
        ${typeFilter}
        GROUP BY task_type
        ORDER BY "overdueCount" DESC
      `),
    ]);
    return res.json({ scope: admin ? "admin" : "employee", byEmployee: byEmployee.rows, byType: byType.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب تحليل الإنجاز" });
  }
});

export default router;
