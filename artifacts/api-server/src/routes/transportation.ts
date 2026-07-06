import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  transportationTable,
  insertTransportationSchema,
  updateTransportationSchema,
  suppliersTable,
} from "@workspace/db";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const base = db
      .select({
        id: transportationTable.id,
        orderNumber: transportationTable.orderNumber,
        supplierId: transportationTable.supplierId,
        description: transportationTable.description,
        origin: transportationTable.origin,
        destination: transportationTable.destination,
        orderDate: transportationTable.orderDate,
        deliveryDate: transportationTable.deliveryDate,
        value: transportationTable.value,
        status: transportationTable.status,
        vehicleInfo: transportationTable.vehicleInfo,
        notes: transportationTable.notes,
        createdAt: transportationTable.createdAt,
        updatedAt: transportationTable.updatedAt,
        supplierName: suppliersTable.name,
      })
      .from(transportationTable)
      .leftJoin(suppliersTable, eq(transportationTable.supplierId, suppliersTable.id));

    const results = status
      ? await base.where(eq(transportationTable.status, status as string))
      : await base;

    return res.json(results);
  } catch {
    return res.status(500).json({ error: "فشل في جلب أوامر النقل" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .select()
      .from(transportationTable)
      .where(eq(transportationTable.id, id));
    if (!row) return res.status(404).json({ error: "أمر النقل غير موجود" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في جلب أمر النقل" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertTransportationSchema.parse(req.body);
    const [row] = await db.insert(transportationTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء أمر النقل" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateTransportationSchema.parse(req.body);
    const [row] = await db
      .update(transportationTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(transportationTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "أمر النقل غير موجود" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث أمر النقل" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(transportationTable).where(eq(transportationTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف أمر النقل" });
  }
});

export default router;
