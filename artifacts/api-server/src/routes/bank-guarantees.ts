import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  pool,
  bankGuaranteesTable,
  insertBankGuaranteeSchema,
  updateBankGuaranteeSchema,
  tendersTable,
  practicesTable,
  contractsTable,
  companiesTable,
  usersTable,
} from "@workspace/db";

const router = Router();

/* قاعدة الإخفاء الكامل: سجل الكفالات للمدراء الثلاثة حصرًا — قراءةً وكتابةً.
   الإدخال عند المصدر (بطاقات المناقصة/الممارسة وحقول العقد) يمر من مساراته هو. */
router.use(async (req: Request, res: Response, next) => {
  if (req.session.role === "admin") return next();
  const { rows } = await pool.query(
    `SELECT 1 FROM user_positions up JOIN positions p ON p.id = up.position_id
     WHERE up.user_id = $1 AND p.key IN ('general_manager','executive_manager','financial_manager') LIMIT 1`,
    [req.session.userId]);
  if (!rows.length) return res.status(403).json({ error: "سجل الكفالات للمديرين الثلاثة" });
  return next();
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const tenderId = req.query.tenderId ? parseInt(req.query.tenderId as string) : undefined;
    const { status } = req.query;
    const base = db
      .select({
        id: bankGuaranteesTable.id,
        tenderId: bankGuaranteesTable.tenderId,
        companyId: bankGuaranteesTable.companyId,
        assignedUserId: bankGuaranteesTable.assignedUserId,
        assignedName: usersTable.fullName,
        guaranteeNumber: bankGuaranteesTable.guaranteeNumber,
        type: bankGuaranteesTable.type,
        bankName: bankGuaranteesTable.bankName,
        amount: bankGuaranteesTable.amount,
        issueDate: bankGuaranteesTable.issueDate,
        expiryDate: bankGuaranteesTable.expiryDate,
        status: bankGuaranteesTable.status,
        location: bankGuaranteesTable.location,
        extensionCount: bankGuaranteesTable.extensionCount,
        checkReceived: bankGuaranteesTable.checkReceived,
        checkReceivedDate: bankGuaranteesTable.checkReceivedDate,
        notes: bankGuaranteesTable.notes,
        createdAt: bankGuaranteesTable.createdAt,
        updatedAt: bankGuaranteesTable.updatedAt,
        practiceId: bankGuaranteesTable.practiceId,
        contractId: bankGuaranteesTable.contractId,
        tenderNumber: tendersTable.tenderNumber,
        projectName: tendersTable.projectName,
        practiceNumber: practicesTable.practiceNumber,
        contractNumber: contractsTable.contractNumber,
        companyName: companiesTable.name,
      })
      .from(bankGuaranteesTable)
      .leftJoin(tendersTable, eq(bankGuaranteesTable.tenderId, tendersTable.id))
      .leftJoin(practicesTable, eq(bankGuaranteesTable.practiceId, practicesTable.id))
      .leftJoin(contractsTable, eq(bankGuaranteesTable.contractId, contractsTable.id))
      .leftJoin(companiesTable, eq(bankGuaranteesTable.companyId, companiesTable.id))
      .leftJoin(usersTable, eq(bankGuaranteesTable.assignedUserId, usersTable.id))
      .orderBy(bankGuaranteesTable.expiryDate);

    const practiceIdQ = req.query.practiceId ? parseInt(req.query.practiceId as string) : undefined;
    const contractIdQ = req.query.contractId ? parseInt(req.query.contractId as string) : undefined;
    const conditions: any[] = [];
    if (tenderId) conditions.push(eq(bankGuaranteesTable.tenderId, tenderId));
    if (practiceIdQ) conditions.push(eq(bankGuaranteesTable.practiceId, practiceIdQ));
    if (contractIdQ) conditions.push(eq(bankGuaranteesTable.contractId, contractIdQ));
    if (status) conditions.push(eq(bankGuaranteesTable.status, status as string));

    const results = conditions.length
      ? await base.where(and(...conditions))
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
    // المُنشئ يصبح المسؤول افتراضيًا؛ المدير وحده يعيد التعيين لاحقًا
    const [guarantee] = await db.insert(bankGuaranteesTable).values({ ...data, assignedUserId: req.session.userId ?? null }).returning();
    return res.status(201).json(guarantee);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء الكفالة" });
  }
});

/* تمديد الكفالة: انتهاء جديد + عدّاد + أثر في الملاحظات — الحالة تعود فعّالة */
router.post("/:id/extend", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const newExpiry = String(req.body?.newExpiryDate ?? "").trim();
    const reason = String(req.body?.reason ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newExpiry)) return res.status(400).json({ error: "تاريخ الانتهاء الجديد مطلوب (YYYY-MM-DD)" });
    const { rows: cur } = await pool.query(`SELECT to_char(expiry_date, 'YYYY-MM-DD') AS expiry_date, notes FROM bank_guarantees WHERE id = $1`, [id]);
    if (!cur.length) return res.status(404).json({ error: "الكفالة غير موجودة" });
    const oldExp = cur[0].expiry_date ? String(cur[0].expiry_date).slice(0, 10) : "—";
    const stamp = `⏱ مُددت من ${oldExp} إلى ${newExpiry}${reason ? ` — ${reason}` : ""}`;
    const { rows } = await pool.query(
      `UPDATE bank_guarantees
       SET expiry_date = $1, status = 'active', extension_count = extension_count + 1,
           notes = COALESCE(NULLIF(notes, ''), '') || CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE E'\n' END || $2,
           updated_at = now()
       WHERE id = $3 RETURNING id, expiry_date AS "expiryDate", extension_count AS "extensionCount"`,
      [newExpiry, stamp, id]);
    return res.json(rows[0]);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل تمديد الكفالة" }); }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateBankGuaranteeSchema.parse(req.body) as Record<string, any>;
    // إعادة تعيين الموظف المسؤول للمدير فقط
    if (req.session.role !== "admin") delete data.assignedUserId;
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
