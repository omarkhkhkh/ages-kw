import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  contractsTable,
  insertContractSchema,
  updateContractSchema,
  governmentEntitiesTable,
  tendersTable,
} from "@workspace/db";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const base = db
      .select({
        id: contractsTable.id,
        tenderId: contractsTable.tenderId,
        contractNumber: contractsTable.contractNumber,
        governmentEntityId: contractsTable.governmentEntityId,
        contractValue: contractsTable.contractValue,
        signDate: contractsTable.signDate,
        startDate: contractsTable.startDate,
        endDate: contractsTable.endDate,
        status: contractsTable.status,
        notes: contractsTable.notes,
        createdAt: contractsTable.createdAt,
        updatedAt: contractsTable.updatedAt,
        entityName: governmentEntitiesTable.name,
        tenderNumber: tendersTable.tenderNumber,
      })
      .from(contractsTable)
      .leftJoin(governmentEntitiesTable, eq(contractsTable.governmentEntityId, governmentEntitiesTable.id))
      .leftJoin(tendersTable, eq(contractsTable.tenderId, tendersTable.id))
      .orderBy(contractsTable.createdAt);

    const results = status
      ? await base.where(eq(contractsTable.status, status as string))
      : await base;
    return res.json(results);
  } catch {
    return res.status(500).json({ error: "فشل في جلب العقود" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
    if (!contract) return res.status(404).json({ error: "العقد غير موجود" });
    return res.json(contract);
  } catch {
    return res.status(500).json({ error: "فشل في جلب العقد" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertContractSchema.parse(req.body);
    const [contract] = await db.insert(contractsTable).values(data).returning();
    return res.status(201).json(contract);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء العقد" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateContractSchema.parse(req.body);
    const [contract] = await db
      .update(contractsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contractsTable.id, id))
      .returning();
    if (!contract) return res.status(404).json({ error: "العقد غير موجود" });
    return res.json(contract);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث العقد" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(contractsTable).where(eq(contractsTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف العقد" });
  }
});

export default router;
