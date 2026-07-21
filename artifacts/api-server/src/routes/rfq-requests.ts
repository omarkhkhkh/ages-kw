import { Router, type Request, type Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { ownRecordsOnly } from "../middleware/auth";
import { db, rfqRequestsTable, insertRfqRequestSchema, updateRfqRequestSchema, suppliersTable, companiesTable, contractsTable, usersTable } from "@workspace/db";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const tenderId = req.query.tenderId ? parseInt(req.query.tenderId as string) : undefined;
    const base = db
      .select({
        id: rfqRequestsTable.id,
        tenderId: rfqRequestsTable.tenderId,
        contractId: rfqRequestsTable.contractId,
        supplierId: rfqRequestsTable.supplierId,
        companyId: rfqRequestsTable.companyId,
        assignedUserId: rfqRequestsTable.assignedUserId,
        assignedName: usersTable.fullName,
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
        contractNumber: contractsTable.contractNumber,
      })
      .from(rfqRequestsTable)
      .leftJoin(suppliersTable, eq(rfqRequestsTable.supplierId, suppliersTable.id))
      .leftJoin(companiesTable, eq(rfqRequestsTable.companyId, companiesTable.id))
      .leftJoin(contractsTable, eq(rfqRequestsTable.contractId, contractsTable.id))
      .leftJoin(usersTable, eq(rfqRequestsTable.assignedUserId, usersTable.id));

    const conditions: any[] = [];
    // خصوصية السجلات: الموظف بنطاق 'own' يرى ما هو مُسنَد إليه فقط (وغير المُسنَد للمدير فقط)
    if (ownRecordsOnly(req)) {
      conditions.push(sql`${rfqRequestsTable.assignedUserId} = ${req.session.userId}`);
    }
    if (tenderId) conditions.push(eq(rfqRequestsTable.tenderId, tenderId));

    const results = conditions.length
      ? await base.where(and(...conditions))
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
    // المُنشئ يصبح المسؤول افتراضيًا؛ المدير وحده يعيد التعيين لاحقًا
    const [rfq] = await db.insert(rfqRequestsTable).values({ ...data, assignedUserId: req.session.userId ?? null }).returning();
    return res.status(201).json(rfq);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء طلب عرض الأسعار" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateRfqRequestSchema.parse(req.body) as Record<string, any>;
    // إعادة تعيين الموظف المسؤول للمدير فقط
    if (req.session.role !== "admin") delete data.assignedUserId;
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
