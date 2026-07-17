import { Router, type Request, type Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { ownRecordsOnly } from "../middleware/auth";
import {
  db,
  projectsTable,
  insertProjectSchema,
  updateProjectSchema,
  governmentEntitiesTable,
  tendersTable,
  companiesTable,
  departmentsTable,
  governmentContactsTable,
} from "@workspace/db";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const base = db
      .select({
        id: projectsTable.id,
        tenderId: projectsTable.tenderId,
        projectNumber: projectsTable.projectNumber,
        name: projectsTable.name,
        governmentEntityId: projectsTable.governmentEntityId,
        departmentId: projectsTable.departmentId,
        contactId: projectsTable.contactId,
        companyId: projectsTable.companyId,
        contractValue: projectsTable.contractValue,
        startDate: projectsTable.startDate,
        endDate: projectsTable.endDate,
        status: projectsTable.status,
        projectManager: projectsTable.projectManager,
        completionPercentage: projectsTable.completionPercentage,
        notes: projectsTable.notes,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
        entityName: governmentEntitiesTable.name,
        tenderNumber: tendersTable.tenderNumber,
        companyName: companiesTable.name,
        departmentName: departmentsTable.name,
        contactName: governmentContactsTable.name,
      })
      .from(projectsTable)
      .leftJoin(governmentEntitiesTable, eq(projectsTable.governmentEntityId, governmentEntitiesTable.id))
      .leftJoin(tendersTable, eq(projectsTable.tenderId, tendersTable.id))
      .leftJoin(companiesTable, eq(projectsTable.companyId, companiesTable.id))
      .leftJoin(departmentsTable, eq(projectsTable.departmentId, departmentsTable.id))
      .leftJoin(governmentContactsTable, eq(projectsTable.contactId, governmentContactsTable.id))
      .orderBy(projectsTable.createdAt);

    const conditions: any[] = [];
    // خصوصية السجلات: الموظف بنطاق 'own' يرى سجلاته فقط (والقديمة بلا منشئ)
    if (ownRecordsOnly(req)) {
      conditions.push(sql`(${projectsTable.createdByUserId} IS NULL OR ${projectsTable.createdByUserId} = ${req.session.userId})`);
    }
    if (status) conditions.push(eq(projectsTable.status, status as string));

    const results = conditions.length
      ? await base.where(and(...conditions))
      : await base;
    return res.json(results);
  } catch {
    return res.status(500).json({ error: "فشل في جلب المشاريع" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) return res.status(404).json({ error: "المشروع غير موجود" });
    return res.json(project);
  } catch {
    return res.status(500).json({ error: "فشل في جلب المشروع" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertProjectSchema.parse(req.body);
    const [project] = await db.insert(projectsTable).values({ ...data, createdByUserId: req.session.userId ?? null }).returning();
    return res.status(201).json(project);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء المشروع" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateProjectSchema.parse(req.body);
    const [project] = await db
      .update(projectsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projectsTable.id, id))
      .returning();
    if (!project) return res.status(404).json({ error: "المشروع غير موجود" });
    return res.json(project);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث المشروع" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف المشروع" });
  }
});

export default router;
