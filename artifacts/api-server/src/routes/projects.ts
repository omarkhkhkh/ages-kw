import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  projectsTable,
  insertProjectSchema,
  updateProjectSchema,
  governmentEntitiesTable,
  tendersTable,
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
      })
      .from(projectsTable)
      .leftJoin(governmentEntitiesTable, eq(projectsTable.governmentEntityId, governmentEntitiesTable.id))
      .leftJoin(tendersTable, eq(projectsTable.tenderId, tendersTable.id))
      .orderBy(projectsTable.createdAt);

    const results = status
      ? await base.where(eq(projectsTable.status, status as string))
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
    const [project] = await db.insert(projectsTable).values(data).returning();
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
