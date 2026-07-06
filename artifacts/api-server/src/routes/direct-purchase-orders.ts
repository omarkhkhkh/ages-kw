import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  directPurchaseOrdersTable,
  insertDirectPurchaseOrderSchema,
  updateDirectPurchaseOrderSchema,
  suppliersTable,
  governmentEntitiesTable,
} from "@workspace/db";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const base = db
      .select({
        id: directPurchaseOrdersTable.id,
        orderNumber: directPurchaseOrdersTable.orderNumber,
        supplierId: directPurchaseOrdersTable.supplierId,
        governmentEntityId: directPurchaseOrdersTable.governmentEntityId,
        description: directPurchaseOrdersTable.description,
        amount: directPurchaseOrdersTable.amount,
        orderDate: directPurchaseOrdersTable.orderDate,
        deliveryDate: directPurchaseOrdersTable.deliveryDate,
        status: directPurchaseOrdersTable.status,
        notes: directPurchaseOrdersTable.notes,
        createdAt: directPurchaseOrdersTable.createdAt,
        updatedAt: directPurchaseOrdersTable.updatedAt,
        supplierName: suppliersTable.name,
        entityName: governmentEntitiesTable.name,
      })
      .from(directPurchaseOrdersTable)
      .leftJoin(suppliersTable, eq(directPurchaseOrdersTable.supplierId, suppliersTable.id))
      .leftJoin(governmentEntitiesTable, eq(directPurchaseOrdersTable.governmentEntityId, governmentEntitiesTable.id))
      .orderBy(directPurchaseOrdersTable.createdAt);

    const results = status
      ? await base.where(eq(directPurchaseOrdersTable.status, status as string))
      : await base;
    return res.json(results);
  } catch {
    return res.status(500).json({ error: "فشل في جلب أوامر الشراء المباشر" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [order] = await db.select().from(directPurchaseOrdersTable).where(eq(directPurchaseOrdersTable.id, id));
    if (!order) return res.status(404).json({ error: "أمر الشراء غير موجود" });
    return res.json(order);
  } catch {
    return res.status(500).json({ error: "فشل في جلب أمر الشراء" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertDirectPurchaseOrderSchema.parse(req.body);
    const [order] = await db.insert(directPurchaseOrdersTable).values(data).returning();
    return res.status(201).json(order);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء أمر الشراء" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateDirectPurchaseOrderSchema.parse(req.body);
    const [order] = await db
      .update(directPurchaseOrdersTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(directPurchaseOrdersTable.id, id))
      .returning();
    if (!order) return res.status(404).json({ error: "أمر الشراء غير موجود" });
    return res.json(order);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث أمر الشراء" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(directPurchaseOrdersTable).where(eq(directPurchaseOrdersTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف أمر الشراء" });
  }
});

export default router;
