import { Router, type Request, type Response } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db, pool, governmentEntitiesTable, insertGovernmentEntitySchema, updateGovernmentEntitySchema,
  departmentsTable, insertDepartmentSchema,
  governmentContactsTable,
  contactMethodsTable,
} from "@workspace/db";
import { insertAutomationTask } from "./task-automation";

const router = Router();

/* ══════════════════════════════════════
   البحث الذكي الموحّد
══════════════════════════════════════ */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json([]);
    const like = `%${q}%`;
    const { rows } = await pool.query(
      `
      (SELECT 'entity' AS type, ge.id, ge.id AS "entityId", NULL::int AS "departmentId", ge.name AS title, ge.type AS subtitle
       FROM government_entities ge WHERE ge.name ILIKE $1 LIMIT 8)
      UNION ALL
      (SELECT 'department' AS type, d.id, d.government_entity_id AS "entityId", d.id AS "departmentId",
              d.name AS title, COALESCE(d.specialization_type, d.governorate, '') AS subtitle
       FROM departments d WHERE d.name ILIKE $1 OR d.specialization_type ILIKE $1 OR d.governorate ILIKE $1 LIMIT 8)
      UNION ALL
      (SELECT 'contact' AS type, c.id, d.government_entity_id AS "entityId", c.department_id AS "departmentId",
              c.name AS title, COALESCE(c.role, '') AS subtitle
       FROM government_contacts c JOIN departments d ON d.id = c.department_id
       WHERE c.name ILIKE $1 LIMIT 8)
      UNION ALL
      (SELECT 'contact_method' AS type, cm.id, d.government_entity_id AS "entityId", c.department_id AS "departmentId",
              cm.value AS title, c.name AS subtitle
       FROM contact_methods cm JOIN government_contacts c ON c.id = cm.contact_id
       JOIN departments d ON d.id = c.department_id
       WHERE cm.value ILIKE $1 LIMIT 8)
      UNION ALL
      (SELECT 'letter' AS type, cl.id, ge.id AS "entityId", cl.department_id AS "departmentId",
              cl.letter_number AS title, ge.name AS subtitle
       FROM correspondence_letters cl JOIN government_entities ge ON ge.id = cl.government_entity_id
       WHERE cl.letter_number ILIKE $1 LIMIT 5)
      UNION ALL
      (SELECT 'contract' AS type, c.id, ge.id AS "entityId", c.department_id AS "departmentId",
              c.contract_number AS title, ge.name AS subtitle
       FROM contracts c JOIN government_entities ge ON ge.id = c.government_entity_id
       WHERE c.contract_number ILIKE $1 LIMIT 5)
      `,
      [like]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في البحث" });
  }
});

/* ── الدليل الكامل (اختصاصات ← مسؤولين ← وسائل تواصل) لجهة واحدة ── */
router.get("/:id/directory", async (req: Request, res: Response) => {
  try {
    const entityId = Number(req.params.id);
    const departments = await db.select().from(departmentsTable).where(eq(departmentsTable.governmentEntityId, entityId)).orderBy(departmentsTable.name);
    const deptIds = departments.map(d => d.id);
    const contacts = deptIds.length
      ? await db.select().from(governmentContactsTable).where(inArray(governmentContactsTable.departmentId, deptIds)).orderBy(governmentContactsTable.name)
      : [];
    const contactIds = contacts.map(c => c.id);
    const methods = contactIds.length
      ? await db.select().from(contactMethodsTable).where(inArray(contactMethodsTable.contactId, contactIds))
      : [];

    const methodsByContact = new Map<number, typeof methods>();
    for (const m of methods) {
      if (!methodsByContact.has(m.contactId)) methodsByContact.set(m.contactId, []);
      methodsByContact.get(m.contactId)!.push(m);
    }
    const contactsByDept = new Map<number, any[]>();
    for (const c of contacts) {
      if (!contactsByDept.has(c.departmentId)) contactsByDept.set(c.departmentId, []);
      contactsByDept.get(c.departmentId)!.push({ ...c, methods: methodsByContact.get(c.id) ?? [] });
    }
    const tree = departments.map(d => ({ ...d, contacts: contactsByDept.get(d.id) ?? [] }));
    return res.json({ departments: tree });
  } catch {
    return res.status(500).json({ error: "فشل في جلب دليل الجهة" });
  }
});

router.post("/:id/departments", async (req: Request, res: Response) => {
  try {
    const governmentEntityId = Number(req.params.id);
    const data = insertDepartmentSchema.parse({ ...req.body, governmentEntityId });
    const [dept] = await db.insert(departmentsTable).values(data).returning();
    return res.status(201).json(dept);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء الاختصاص" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const { companyId } = req.query as Record<string, string>;
    let query = db.select().from(governmentEntitiesTable).$dynamic();
    if (companyId) query = query.where(eq(governmentEntitiesTable.companyId, Number(companyId)));
    const entities = await query.orderBy(governmentEntitiesTable.name);
    return res.json(entities);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الجهات الحكومية" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [entity] = await db
      .select()
      .from(governmentEntitiesTable)
      .where(eq(governmentEntitiesTable.id, id));
    if (!entity) return res.status(404).json({ error: "الجهة غير موجودة" });
    return res.json(entity);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الجهة" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertGovernmentEntitySchema.parse(req.body);
    const [entity] = await db.insert(governmentEntitiesTable).values(data).returning();
    insertAutomationTask({
      title: `إعداد ملف جهة حكومية جديدة: ${entity.name}`,
      sourceType: "entity_registered", sourceId: entity.id, triggerKey: "created",
      linkedEntityType: "governmentEntity", linkedEntityId: entity.id,
    }).catch(() => {});
    return res.status(201).json(entity);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء الجهة" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateGovernmentEntitySchema.parse(req.body);
    const [entity] = await db
      .update(governmentEntitiesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(governmentEntitiesTable.id, id))
      .returning();
    if (!entity) return res.status(404).json({ error: "الجهة غير موجودة" });
    return res.json(entity);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث الجهة" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(governmentEntitiesTable).where(eq(governmentEntitiesTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الجهة" });
  }
});

export default router;
