import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, rfqRequestsTable, insertRfqRequestSchema, updateRfqRequestSchema, suppliersTable, companiesTable } from "@workspace/db";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const tenderId = req.query.tenderId ? parseInt(req.query.tenderId as string) : undefined;
    const base = db
      .select({
        id: rfqRequestsTable.id,
        tenderId: rfqRequestsTable.tenderId,
        supplierId: rfqRequestsTable.supplierId,
        companyId: rfqRequestsTable.companyId,
        rfqNumber: rfqRequestsTable.rfqNumber,
        itemDescription: rfqRequestsTable.itemDescription,
        requestDate: rfqRequestsTable.requestDate,
        responseDeadline: rfqRequestsTable.responseDeadline,
        quotedPrice: rfqRequestsTable.quotedPrice,
        status: rfqRequestsTable.status,
        notes: rfqRequestsTable.notes,
        createdAt: rfqRequestsTable.createdAt,
        updatedAt: rfqRequestsTable.updatedAt,
        supplierName: suppliersTable.name,
        companyName: companiesTable.name,
      })
      .from(rfqRequestsTable)
      .leftJoin(suppliersTable, eq(rfqRequestsTable.supplierId, suppliersTable.id))
      .leftJoin(companiesTable, eq(rfqRequestsTable.companyId, companiesTable.id));

    const results = tenderId
      ? await base.where(eq(rfqRequestsTable.tenderId, tenderId))
      : await base;
    return res.json(results);
  } catch {
    return res.status(500).json({ error: "فشل في جلب طلبات عروض الأسعار" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [rfq] = await db.select().from(rfqRequestsTable).where(eq(rfqRequestsTable.id, id));
    if (!rfq) return res.status(404).json({ error: "طلب عرض الأسعار غير موجود" });
    return res.json(rfq);
  } catch {
    return res.status(500).json({ error: "فشل في جلب طلب عرض الأسعار" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertRfqRequestSchema.parse(req.body);
    const [rfq] = await db.insert(rfqRequestsTable).values(data).returning();
    return res.status(201).json(rfq);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء طلب عرض الأسعار" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateRfqRequestSchema.parse(req.body);
    const [rfq] = await db
      .update(rfqRequestsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rfqRequestsTable.id, id))
      .returning();
    if (!rfq) return res.status(404).json({ error: "طلب عرض الأسعار غير موجود" });
    return res.json(rfq);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث طلب عرض الأسعار" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(rfqRequestsTable).where(eq(rfqRequestsTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف طلب عرض الأسعار" });
  }
});

export default router;
