import { Router, type Request, type Response } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db, pool,
  departmentsTable, updateDepartmentSchema,
  governmentContactsTable, insertGovernmentContactSchema, updateGovernmentContactSchema,
  contactMethodsTable, insertContactMethodSchema, updateContactMethodSchema,
  serviceTypesTable, insertServiceTypeSchema,
  departmentServiceTypesTable,
  departmentDocumentsTable, insertDepartmentDocumentSchema,
} from "@workspace/db";
import { requireAdmin } from "../middleware/auth";

const router = Router();

/* ── الاختصاصات (departments) ── */
router.patch("/departments/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateDepartmentSchema.parse(req.body);
    const [dept] = await db.update(departmentsTable).set({ ...data, updatedAt: new Date() }).where(eq(departmentsTable.id, id)).returning();
    if (!dept) return res.status(404).json({ error: "الاختصاص غير موجود" });
    return res.json(dept);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث الاختصاص" });
  }
});

router.delete("/departments/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(departmentsTable).where(eq(departmentsTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الاختصاص" });
  }
});

/* ── المسؤولون (contacts) ── */
router.post("/departments/:departmentId/contacts", async (req: Request, res: Response) => {
  try {
    const departmentId = Number(req.params.departmentId);
    const data = insertGovernmentContactSchema.parse({ ...req.body, departmentId });
    const [contact] = await db.insert(governmentContactsTable).values(data).returning();
    return res.status(201).json(contact);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة المسؤول" });
  }
});

router.patch("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateGovernmentContactSchema.parse(req.body);
    const [contact] = await db.update(governmentContactsTable).set({ ...data, updatedAt: new Date() }).where(eq(governmentContactsTable.id, id)).returning();
    if (!contact) return res.status(404).json({ error: "المسؤول غير موجود" });
    return res.json(contact);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث المسؤول" });
  }
});

router.delete("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(governmentContactsTable).where(eq(governmentContactsTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف المسؤول" });
  }
});

/* ── وسائل التواصل (contact methods) ── */
router.post("/contacts/:contactId/methods", async (req: Request, res: Response) => {
  try {
    const contactId = Number(req.params.contactId);
    const data = insertContactMethodSchema.parse({ ...req.body, contactId });
    const [method] = await db.insert(contactMethodsTable).values(data).returning();
    return res.status(201).json(method);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة وسيلة التواصل" });
  }
});

router.patch("/contact-methods/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateContactMethodSchema.parse(req.body);
    const [method] = await db.update(contactMethodsTable).set({ ...data, updatedAt: new Date() }).where(eq(contactMethodsTable.id, id)).returning();
    if (!method) return res.status(404).json({ error: "وسيلة التواصل غير موجودة" });
    return res.json(method);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث وسيلة التواصل" });
  }
});

router.delete("/contact-methods/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(contactMethodsTable).where(eq(contactMethodsTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف وسيلة التواصل" });
  }
});

/* ══════════════════════════════════════
   أنواع التعامل (service types) — قائمة مركزية قابلة للتعديل الإداري
══════════════════════════════════════ */
router.get("/service-types", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(serviceTypesTable).orderBy(serviceTypesTable.name);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب أنواع التعامل" });
  }
});

router.post("/service-types", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = insertServiceTypeSchema.parse(req.body);
    const [row] = await db.insert(serviceTypesTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    if (err?.code === "23505") return res.status(409).json({ error: "هذا النوع موجود بالفعل" });
    return res.status(500).json({ error: "فشل في إضافة نوع التعامل" });
  }
});

router.delete("/service-types/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(serviceTypesTable).where(eq(serviceTypesTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف نوع التعامل" });
  }
});

/* ── ربط أنواع التعامل بإدارة ── */
router.get("/departments/:id/service-types", async (req: Request, res: Response) => {
  try {
    const departmentId = Number(req.params.id);
    const rows = await db
      .select({ id: serviceTypesTable.id, name: serviceTypesTable.name })
      .from(departmentServiceTypesTable)
      .innerJoin(serviceTypesTable, eq(departmentServiceTypesTable.serviceTypeId, serviceTypesTable.id))
      .where(eq(departmentServiceTypesTable.departmentId, departmentId));
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب أنواع تعامل الإدارة" });
  }
});

router.put("/departments/:id/service-types", async (req: Request, res: Response) => {
  try {
    const departmentId = Number(req.params.id);
    const serviceTypeIds: number[] = Array.isArray(req.body?.serviceTypeIds) ? req.body.serviceTypeIds.map(Number) : [];
    await db.delete(departmentServiceTypesTable).where(eq(departmentServiceTypesTable.departmentId, departmentId));
    if (serviceTypeIds.length) {
      await db.insert(departmentServiceTypesTable).values(serviceTypeIds.map(serviceTypeId => ({ departmentId, serviceTypeId })));
    }
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في تحديث أنواع تعامل الإدارة" });
  }
});

/* ══════════════════════════════════════
   مستندات الإدارة
══════════════════════════════════════ */
router.get("/departments/:id/documents", async (req: Request, res: Response) => {
  try {
    const departmentId = Number(req.params.id);
    const rows = await db.select().from(departmentDocumentsTable).where(eq(departmentDocumentsTable.departmentId, departmentId)).orderBy(departmentDocumentsTable.createdAt);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب مستندات الإدارة" });
  }
});

router.post("/departments/:id/documents", async (req: Request, res: Response) => {
  try {
    const departmentId = Number(req.params.id);
    const data = insertDepartmentDocumentSchema.parse({ ...req.body, departmentId, uploadedByUserId: req.session.userId ?? null });
    const [row] = await db.insert(departmentDocumentsTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة المستند" });
  }
});

router.delete("/documents/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(departmentDocumentsTable).where(eq(departmentDocumentsTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف المستند" });
  }
});

/* ══════════════════════════════════════
   سجل التعاملات (transaction log) — مجمّع من الوحدات المرتبطة فعليًا
══════════════════════════════════════ */
router.get("/departments/:id/timeline", async (req: Request, res: Response) => {
  try {
    const departmentId = Number(req.params.id);
    const { type, from, to, search } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: any[] = [departmentId];
    if (from) { params.push(from); conditions.push(`date >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`date <= $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`label ILIKE $${params.length}`); }
    if (type) { params.push(type); conditions.push(`type = $${params.length}`); }
    const extraWhere = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `
      SELECT * FROM (
        (SELECT 'tender' AS type, id, tender_number AS label, created_at AS date, status
         FROM tenders WHERE department_id = $1)
        UNION ALL
        (SELECT 'practice' AS type, id, practice_number AS label, created_at AS date, status
         FROM practices WHERE department_id = $1)
        UNION ALL
        (SELECT 'contract' AS type, id, contract_number AS label, COALESCE(sign_date::timestamp, created_at) AS date, status
         FROM contracts WHERE department_id = $1)
        UNION ALL
        (SELECT 'project' AS type, id, COALESCE(project_number, name) AS label, COALESCE(start_date::timestamp, created_at) AS date, status
         FROM projects WHERE department_id = $1)
        UNION ALL
        (SELECT 'purchase_order' AS type, id, order_number AS label, COALESCE(order_date::timestamp, created_at) AS date, status
         FROM direct_purchase_orders WHERE department_id = $1)
        UNION ALL
        (SELECT CASE WHEN direction = 'outgoing' THEN 'correspondence_out' ELSE 'correspondence_in' END AS type,
                id, letter_number AS label, letter_date::timestamp AS date, status
         FROM correspondence_letters WHERE department_id = $1)
        UNION ALL
        (SELECT 'maintenance' AS type, id, order_number AS label, report_date AS date, stage AS status
         FROM maintenance_work_orders WHERE department_id = $1)
      ) t
      ${extraWhere}
      ORDER BY date DESC
      LIMIT 300
      `,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب سجل التعاملات" });
  }
});

/* ══════════════════════════════════════
   لوحة إحصائيات الإدارة
══════════════════════════════════════ */
router.get("/departments/:id/stats", async (req: Request, res: Response) => {
  try {
    const departmentId = Number(req.params.id);
    const { rows } = await pool.query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM tenders WHERE department_id = $1) AS "tendersCount",
        (SELECT COUNT(*)::int FROM contracts WHERE department_id = $1) AS "contractsCount",
        (SELECT COUNT(*)::int FROM direct_purchase_orders WHERE department_id = $1) AS "purchaseOrdersCount",
        (SELECT COUNT(*)::int FROM correspondence_letters WHERE department_id = $1 AND direction = 'outgoing') AS "outgoingLettersCount",
        (SELECT COUNT(*)::int FROM correspondence_letters WHERE department_id = $1 AND direction = 'incoming') AS "incomingLettersCount",
        (SELECT COUNT(*)::int FROM government_contacts WHERE department_id = $1) AS "contactsCount",
        (SELECT COUNT(*)::int FROM department_documents WHERE department_id = $1) AS "documentsCount",
        (SELECT MAX(d) FROM (
          SELECT created_at AS d FROM tenders WHERE department_id = $1
          UNION ALL SELECT created_at FROM practices WHERE department_id = $1
          UNION ALL SELECT COALESCE(sign_date::timestamp, created_at) FROM contracts WHERE department_id = $1
          UNION ALL SELECT COALESCE(order_date::timestamp, created_at) FROM direct_purchase_orders WHERE department_id = $1
          UNION ALL SELECT letter_date::timestamp FROM correspondence_letters WHERE department_id = $1
          UNION ALL SELECT report_date FROM maintenance_work_orders WHERE department_id = $1
        ) x) AS "lastContactDate",
        (SELECT MAX(created_at) FROM department_documents WHERE department_id = $1) AS "lastDocumentDate"
      `,
      [departmentId]
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب إحصائيات الإدارة" });
  }
});

export default router;
