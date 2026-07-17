import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  bankGuaranteesTable,
  insertBankGuaranteeSchema,
  updateBankGuaranteeSchema,
  tendersTable,
  companiesTable,
} from "@workspace/db";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const tenderId = req.query.tenderId ? parseInt(req.query.tenderId as string) : undefined;
    const { status } = req.query;
    const base = db
      .select({
        id: bankGuaranteesTable.id,
        tenderId: bankGuaranteesTable.tenderId,
        companyId: bankGuaranteesTable.companyId,
        guaranteeNumber: bankGuaranteesTable.guaranteeNumber,
        type: bankGuaranteesTable.type,
        bankName: bankGuaranteesTable.bankName,
        amount: bankGuaranteesTable.amount,
        issueDate: bankGuaranteesTable.issueDate,
        expiryDate: bankGuaranteesTable.expiryDate,
        status: bankGuaranteesTable.status,
        notes: bankGuaranteesTable.notes,
        createdAt: bankGuaranteesTable.createdAt,
        updatedAt: bankGuaranteesTable.updatedAt,
        tenderNumber: tendersTable.tenderNumber,
        projectName: tendersTable.projectName,
        companyName: companiesTable.name,
      })
      .from(bankGuaranteesTable)
      .leftJoin(tendersTable, eq(bankGuaranteesTable.tenderId, tendersTable.id))
      .leftJoin(companiesTable, eq(bankGuaranteesTable.companyId, companiesTable.id))
      .orderBy(bankGuaranteesTable.expiryDate);

    const results = tenderId
      ? await base.where(eq(bankGuaranteesTable.tenderId, tenderId))
      : status
      ? await base.where(eq(bankGuaranteesTable.status, status as string))
      : await base;
    return res.json(results);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الكفالات البنكية" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [guarantee] = await db.select().from(bankGuaranteesTable).where(eq(bankGuaranteesTable.id, id));
    if (!guarantee) return res.status(404).json({ error: "الكفالة غير موجودة" });
    return res.json(guarantee);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الكفالة" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertBankGuaranteeSchema.parse(req.body);
    const [guarantee] = await db.insert(bankGuaranteesTable).values(data).returning();
    return res.status(201).json(guarantee);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء الكفالة" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateBankGuaranteeSchema.parse(req.body);
    const [guarantee] = await db
      .update(bankGuaranteesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bankGuaranteesTable.id, id))
      .returning();
    if (!guarantee) return res.status(404).json({ error: "الكفالة غير موجودة" });
    return res.json(guarantee);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث الكفالة" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(bankGuaranteesTable).where(eq(bankGuaranteesTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الكفالة" });
  }
});

export default router;
