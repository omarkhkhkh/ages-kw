import { Router, type Request, type Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db, pool,
  financeIncomeTable,
  financeExpensesTable,
  employeeSalesTable,
  usersTable,
  contractsTable,
} from "@workspace/db";
import multer from "multer";
import * as XLSX from "xlsx";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
const isAdmin = (req: Request) => req.session.role === "admin";

/* ══════════════════════════════════════
   SUMMARY — dashboard numbers
══════════════════════════════════════ */
router.get("/summary", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COALESCE(SUM(amount),0) FROM finance_income)::numeric                              AS "totalIncome",
        (SELECT COALESCE(SUM(amount),0) FROM finance_expenses WHERE status='paid')::numeric        AS "totalPaid",
        (SELECT COALESCE(SUM(amount),0) FROM finance_expenses WHERE status='pending')::numeric     AS "totalPending",
        (SELECT COALESCE(SUM(amount),0) FROM finance_expenses WHERE status='overdue')::numeric     AS "totalOverdue",
        (SELECT COALESCE(SUM(amount),0) FROM finance_income)
          - (SELECT COALESCE(SUM(amount),0) FROM finance_expenses WHERE status='paid')             AS "balance"
    `);
    return res.json(rows[0]);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الملخص" });
  }
});

/* ══════════════════════════════════════
   INCOME (مدخولات)
══════════════════════════════════════ */
router.get("/income", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const { rows } = await pool.query(`
      SELECT
        fi.id, fi.contract_id AS "contractId", fi.employee_id AS "employeeId",
        fi.description, fi.amount, fi.date, fi.category, fi.notes,
        fi.created_at AS "createdAt",
        u.full_name AS "employeeName",
        c.contract_number AS "contractNumber"
      FROM finance_income fi
      LEFT JOIN users u ON u.id = fi.employee_id
      LEFT JOIN contracts c ON c.id = fi.contract_id
      ORDER BY fi.date DESC, fi.created_at DESC
    `);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الإيرادات" });
  }
});

router.post("/income", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const { contractId, employeeId, description, amount, date, category, notes } = req.body as any;
    if (!description?.trim() || !amount || !date) return res.status(400).json({ error: "الوصف والمبلغ والتاريخ مطلوبة" });
    const [row] = await db.insert(financeIncomeTable).values({
      contractId: contractId ? Number(contractId) : null,
      employeeId: employeeId ? Number(employeeId) : null,
      description: description.trim(),
      amount: String(amount),
      date,
      category: category || "contract",
      notes: notes || null,
      createdBy: req.session.userId!,
    }).returning();
    return res.status(201).json(row);
  } catch {
    return res.status(500).json({ error: "فشل في إضافة الإيراد" });
  }
});

router.patch("/income/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const id = Number(req.params.id);
    const { description, amount, date, category, notes, contractId, employeeId } = req.body as any;
    const updates: any = { updatedAt: new Date() };
    if (description !== undefined) updates.description = description;
    if (amount !== undefined) updates.amount = String(amount);
    if (date !== undefined) updates.date = date;
    if (category !== undefined) updates.category = category;
    if (notes !== undefined) updates.notes = notes;
    if (contractId !== undefined) updates.contractId = contractId ? Number(contractId) : null;
    if (employeeId !== undefined) updates.employeeId = employeeId ? Number(employeeId) : null;
    const [row] = await db.update(financeIncomeTable).set(updates).where(eq(financeIncomeTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "السجل غير موجود" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في تحديث الإيراد" });
  }
});

router.delete("/income/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    await db.delete(financeIncomeTable).where(eq(financeIncomeTable.id, Number(req.params.id)));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الإيراد" });
  }
});

/* ══════════════════════════════════════
   EXPENSES (مصروفات)
══════════════════════════════════════ */
router.get("/expenses", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const { rows } = await pool.query(`
      SELECT id, description, amount, due_date AS "dueDate", paid_date AS "paidDate",
             status, category, vendor, notes, created_at AS "createdAt"
      FROM finance_expenses
      ORDER BY COALESCE(due_date, '9999-12-31'::date) ASC, created_at DESC
    `);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب المصروفات" });
  }
});

router.post("/expenses", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const { description, amount, dueDate, paidDate, status, category, vendor, notes } = req.body as any;
    if (!description?.trim() || !amount) return res.status(400).json({ error: "الوصف والمبلغ مطلوبان" });
    const [row] = await db.insert(financeExpensesTable).values({
      description: description.trim(),
      amount: String(amount),
      dueDate: dueDate || null,
      paidDate: paidDate || null,
      status: status || "pending",
      category: category || "general",
      vendor: vendor || null,
      notes: notes || null,
      createdBy: req.session.userId!,
    }).returning();
    return res.status(201).json(row);
  } catch {
    return res.status(500).json({ error: "فشل في إضافة المصروف" });
  }
});

router.patch("/expenses/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const id = Number(req.params.id);
    const { description, amount, dueDate, paidDate, status, category, vendor, notes } = req.body as any;
    const updates: any = { updatedAt: new Date() };
    if (description !== undefined) updates.description = description;
    if (amount !== undefined) updates.amount = String(amount);
    if (dueDate !== undefined) updates.dueDate = dueDate || null;
    if (paidDate !== undefined) updates.paidDate = paidDate || null;
    if (status !== undefined) updates.status = status;
    if (category !== undefined) updates.category = category;
    if (vendor !== undefined) updates.vendor = vendor;
    if (notes !== undefined) updates.notes = notes;
    const [row] = await db.update(financeExpensesTable).set(updates).where(eq(financeExpensesTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "السجل غير موجود" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في تحديث المصروف" });
  }
});

router.delete("/expenses/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    await db.delete(financeExpensesTable).where(eq(financeExpensesTable.id, Number(req.params.id)));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف المصروف" });
  }
});

/* ══════════════════════════════════════
   EMPLOYEE SALES (مبيعات الموظفين)
   - Admin: sees all fields including totalContractAmount & profitAmount
   - Employee: sees own records, profitPercentage only — NO totalContractAmount/profitAmount
══════════════════════════════════════ */
router.get("/sales", async (req: Request, res: Response) => {
  try {
    const admin = isAdmin(req);
    const userId = req.session.userId!;
    let q = `
      SELECT
        es.id, es.employee_id AS "employeeId", es.contract_id AS "contractId",
        es.description, es.profit_percentage AS "profitPercentage",
        es.sale_date AS "saleDate", es.notes, es.created_at AS "createdAt",
        u.full_name AS "employeeName",
        c.contract_number AS "contractNumber"
        ${admin ? `, es.total_contract_amount AS "totalContractAmount", es.profit_amount AS "profitAmount"` : ""}
      FROM employee_sales es
      LEFT JOIN users u ON u.id = es.employee_id
      LEFT JOIN contracts c ON c.id = es.contract_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (!admin) { params.push(userId); q += ` AND es.employee_id = $${params.length}`; }
    q += " ORDER BY es.sale_date DESC, es.created_at DESC";
    const { rows } = await pool.query(q, params);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب المبيعات" });
  }
});

router.post("/sales", async (req: Request, res: Response) => {
  try {
    const admin = isAdmin(req);
    const { employeeId, contractId, description, totalContractAmount, profitPercentage, saleDate, notes } = req.body as any;
    if (!description?.trim() || !saleDate) return res.status(400).json({ error: "الوصف والتاريخ مطلوبان" });
    // Non-admins can only create for themselves
    const targetEmployeeId = admin ? (employeeId ? Number(employeeId) : req.session.userId!) : req.session.userId!;
    // Only admin can set totalContractAmount
    const tca = admin && totalContractAmount ? String(totalContractAmount) : null;
    const pp  = profitPercentage ? String(profitPercentage) : null;
    const pa  = (tca && pp) ? String(Number(tca) * Number(pp) / 100) : null;
    const [row] = await db.insert(employeeSalesTable).values({
      employeeId: targetEmployeeId,
      contractId: contractId ? Number(contractId) : null,
      description: description.trim(),
      totalContractAmount: tca,
      profitPercentage: pp,
      profitAmount: pa,
      saleDate,
      notes: notes || null,
      createdBy: req.session.userId!,
    }).returning();
    // Strip sensitive fields for non-admins
    if (!admin) {
      const { totalContractAmount: _tca, profitAmount: _pa, ...safe } = row as any;
      return res.status(201).json(safe);
    }
    return res.status(201).json(row);
  } catch {
    return res.status(500).json({ error: "فشل في إضافة المبيعة" });
  }
});

router.patch("/sales/:id", async (req: Request, res: Response) => {
  try {
    const admin = isAdmin(req);
    const id = Number(req.params.id);
    const { description, profitPercentage, totalContractAmount, saleDate, notes, contractId } = req.body as any;

    // Load existing record first — needed for ownership check and profit recomputation
    const existing = await db.select().from(employeeSalesTable).where(eq(employeeSalesTable.id, id));
    if (!existing[0]) return res.status(404).json({ error: "السجل غير موجود" });

    // Non-admins can only modify their own records
    if (!admin && existing[0].employeeId !== req.session.userId) {
      return res.status(403).json({ error: "لا يمكنك تعديل سجلات موظفين آخرين" });
    }

    const updates: any = { updatedAt: new Date() };
    if (description !== undefined) updates.description = description;
    if (saleDate !== undefined) updates.saleDate = saleDate;
    if (notes !== undefined) updates.notes = notes;
    if (contractId !== undefined) updates.contractId = contractId ? Number(contractId) : null;
    if (profitPercentage !== undefined) updates.profitPercentage = profitPercentage ? String(profitPercentage) : null;
    // Only admin can change totalContractAmount
    if (admin && totalContractAmount !== undefined) {
      updates.totalContractAmount = totalContractAmount ? String(totalContractAmount) : null;
    }
    // Recompute profitAmount when both fields are present
    const tca = updates.totalContractAmount ?? existing[0].totalContractAmount;
    const pp  = updates.profitPercentage    ?? existing[0].profitPercentage;
    if (tca && pp) updates.profitAmount = String(Number(tca) * Number(pp) / 100);

    const [row] = await db.update(employeeSalesTable).set(updates).where(eq(employeeSalesTable.id, id)).returning();
    if (!admin) {
      const { totalContractAmount: _tca, profitAmount: _pa, ...safe } = row as any;
      return res.json(safe);
    }
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في تحديث المبيعة" });
  }
});

router.delete("/sales/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    await db.delete(employeeSalesTable).where(eq(employeeSalesTable.id, Number(req.params.id)));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف السجل" });
  }
});

/* ══════════════════════════════════════
   EXCEL IMPORT
══════════════════════════════════════ */
router.post("/import/income", upload.single("file"), async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    if (!req.file) return res.status(400).json({ error: "لم يتم رفع ملف" });
    const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });
    const inserted: any[] = [];
    for (const r of rows) {
      const description = String(r["الوصف"] ?? r["description"] ?? "").trim();
      const amount      = Number(r["المبلغ"] ?? r["amount"] ?? 0);
      const date        = r["التاريخ"] ?? r["date"];
      if (!description || !amount || !date) continue;
      const dateStr = date instanceof Date
        ? date.toISOString().split("T")[0]
        : String(date).trim();
      const [row] = await db.insert(financeIncomeTable).values({
        description,
        amount: String(amount),
        date: dateStr,
        category: String(r["الفئة"] ?? r["category"] ?? "contract"),
        notes: r["الملاحظات"] ?? r["notes"] ?? null,
        createdBy: req.session.userId!,
      }).returning();
      inserted.push(row);
    }
    return res.json({ inserted: inserted.length, rows: inserted });
  } catch (err: any) {
    return res.status(500).json({ error: `فشل في استيراد الملف: ${err.message}` });
  }
});

router.post("/import/expenses", upload.single("file"), async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    if (!req.file) return res.status(400).json({ error: "لم يتم رفع ملف" });
    const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });
    const inserted: any[] = [];
    for (const r of rows) {
      const description = String(r["الوصف"] ?? r["description"] ?? "").trim();
      const amount      = Number(r["المبلغ"] ?? r["amount"] ?? 0);
      if (!description || !amount) continue;
      const dueDateRaw = r["تاريخ الاستحقاق"] ?? r["due_date"];
      const dueDate = dueDateRaw instanceof Date
        ? dueDateRaw.toISOString().split("T")[0]
        : dueDateRaw ? String(dueDateRaw).trim() : null;
      const [row] = await db.insert(financeExpensesTable).values({
        description,
        amount: String(amount),
        dueDate,
        status: String(r["الحالة"] ?? r["status"] ?? "pending"),
        category: String(r["الفئة"] ?? r["category"] ?? "general"),
        vendor: r["المورد"] ?? r["vendor"] ?? null,
        notes: r["الملاحظات"] ?? r["notes"] ?? null,
        createdBy: req.session.userId!,
      }).returning();
      inserted.push(row);
    }
    return res.json({ inserted: inserted.length, rows: inserted });
  } catch (err: any) {
    return res.status(500).json({ error: `فشل في استيراد الملف: ${err.message}` });
  }
});

/* ══════════════════════════════════════
   EXPENSES BY CATEGORY (admin only)
══════════════════════════════════════ */
router.get("/expenses/by-category", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const { rows } = await pool.query(`
      SELECT
        category,
        COUNT(*)::int                                                          AS count,
        COALESCE(SUM(amount),0)::numeric                                      AS total,
        COALESCE(SUM(CASE WHEN status='paid'    THEN amount ELSE 0 END),0)::numeric AS paid,
        COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),0)::numeric AS pending,
        COALESCE(SUM(CASE WHEN status='overdue' THEN amount ELSE 0 END),0)::numeric AS overdue
      FROM finance_expenses
      GROUP BY category
      ORDER BY total DESC
    `);
    const grandTotal = rows.reduce((s: number, r: any) => s + Number(r.total), 0);
    const data = rows.map((r: any) => ({
      ...r,
      pct: grandTotal > 0 ? ((Number(r.total) / grandTotal) * 100).toFixed(1) : "0.0",
    }));
    return res.json({ rows: data, grandTotal });
  } catch {
    return res.status(500).json({ error: "فشل في جلب التصنيفات" });
  }
});

/* ══════════════════════════════════════
   FILTERED EXPENSES EXPORT (admin only)
══════════════════════════════════════ */
router.get("/export/expenses-filtered", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const { category, status, dateFrom, dateTo } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (category && category !== "all") { params.push(category); conditions.push(`category = ${params.length}`); }
    if (status   && status   !== "all") { params.push(status);   conditions.push(`status = ${params.length}`); }
    if (dateFrom) { params.push(dateFrom); conditions.push(`due_date >= ${params.length}`); }
    if (dateTo)   { params.push(dateTo);   conditions.push(`due_date <= ${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(`
      SELECT description AS "الوصف", amount AS "المبلغ (د.ك)",
             due_date AS "تاريخ الاستحقاق", paid_date AS "تاريخ الدفع",
             status AS "الحالة", category AS "الفئة", vendor AS "المورد/الجهة",
             notes AS "الملاحظات"
      FROM finance_expenses ${where}
      ORDER BY COALESCE(due_date,'9999-12-31'::date) ASC
    `, params);

    // Translate status/category to Arabic
    const AR_STATUS: Record<string,string> = { pending: "قيد الانتظار", paid: "مدفوعة", overdue: "متأخرة" };
    const AR_CAT: Record<string,string> = { general:"عام",salary:"رواتب",rent:"إيجار",utilities:"مرافق",maintenance:"صيانة",tax:"ضرائب",other:"أخرى" };
    const translated = rows.map((r: any) => ({
      ...r,
      "الحالة": AR_STATUS[r["الحالة"]] ?? r["الحالة"],
      "الفئة":  AR_CAT[r["الفئة"]]    ?? r["الفئة"],
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(translated), "الفواتير");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", 'attachment; filename="expenses-filtered.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buf);
  } catch {
    return res.status(500).json({ error: "فشل في التصدير" });
  }
});

/* ══════════════════════════════════════
   INCOME STATEMENT EXPORT (admin only)
   Multi-sheet: P&L summary + by-category + pending + overdue
══════════════════════════════════════ */
router.get("/export/income-statement", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    // 1. Top-level summary
    const { rows: [summary] } = await pool.query(`
      SELECT
        (SELECT COALESCE(SUM(amount),0) FROM finance_income)::numeric        AS total_income,
        (SELECT COALESCE(SUM(amount),0) FROM finance_expenses)::numeric       AS total_expenses,
        (SELECT COALESCE(SUM(amount),0) FROM finance_expenses WHERE status='paid')::numeric    AS paid_expenses,
        (SELECT COALESCE(SUM(amount),0) FROM finance_expenses WHERE status='pending')::numeric AS pending_expenses,
        (SELECT COALESCE(SUM(amount),0) FROM finance_expenses WHERE status='overdue')::numeric AS overdue_expenses
    `);
    const netProfit = Number(summary.total_income) - Number(summary.paid_expenses);

    const plRows = [
      { "البند": "إجمالي الإيرادات",     "المبلغ (د.ك)": Number(summary.total_income).toFixed(3) },
      { "البند": "إجمالي المصروفات",     "المبلغ (د.ك)": Number(summary.total_expenses).toFixed(3) },
      { "البند": "— منها مدفوعة",        "المبلغ (د.ك)": Number(summary.paid_expenses).toFixed(3) },
      { "البند": "— منها قيد الانتظار", "المبلغ (د.ك)": Number(summary.pending_expenses).toFixed(3) },
      { "البند": "— منها متأخرة",        "المبلغ (د.ك)": Number(summary.overdue_expenses).toFixed(3) },
      { "البند": "صافي الربح (الإيرادات - المدفوع)", "المبلغ (د.ك)": netProfit.toFixed(3) },
    ];

    // 2. Income by category
    const { rows: incCat } = await pool.query(`
      SELECT category AS "الفئة", COUNT(*)::int AS "العدد",
             COALESCE(SUM(amount),0)::numeric AS "الإجمالي (د.ك)"
      FROM finance_income GROUP BY category ORDER BY "الإجمالي (د.ك)" DESC
    `);
    const AR_ICAT: Record<string,string> = { contract:"عقد",other:"أخرى",bonus:"مكافأة",penalty:"غرامة" };
    const incCatAr = incCat.map((r: any) => ({ ...r, "الفئة": AR_ICAT[r["الفئة"]] ?? r["الفئة"] }));

    // 3. Expenses by category with percentages
    const { rows: expCat } = await pool.query(`
      SELECT category AS "الفئة",
             COUNT(*)::int AS "العدد",
             COALESCE(SUM(amount),0)::numeric AS "الإجمالي (د.ك)",
             COALESCE(SUM(CASE WHEN status='paid'    THEN amount ELSE 0 END),0)::numeric AS "المدفوع (د.ك)",
             COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),0)::numeric AS "الانتظار (د.ك)",
             COALESCE(SUM(CASE WHEN status='overdue' THEN amount ELSE 0 END),0)::numeric AS "المتأخر (د.ك)"
      FROM finance_expenses GROUP BY category ORDER BY "الإجمالي (د.ك)" DESC
    `);
    const AR_ECAT: Record<string,string> = { general:"عام",salary:"رواتب",rent:"إيجار",utilities:"مرافق",maintenance:"صيانة",tax:"ضرائب",other:"أخرى" };
    const grandExpTotal = expCat.reduce((s: number, r: any) => s + Number(r["الإجمالي (د.ك)"]), 0);
    const expCatAr = expCat.map((r: any) => ({
      "الفئة": AR_ECAT[r["الفئة"]] ?? r["الفئة"],
      "العدد": r["العدد"],
      "الإجمالي (د.ك)": Number(r["الإجمالي (د.ك)"]).toFixed(3),
      "المدفوع (د.ك)":  Number(r["المدفوع (د.ك)"]).toFixed(3),
      "الانتظار (د.ك)": Number(r["الانتظار (د.ك)"]).toFixed(3),
      "المتأخر (د.ك)":  Number(r["المتأخر (د.ك)"]).toFixed(3),
      "النسبة %": grandExpTotal > 0 ? ((Number(r["الإجمالي (د.ك)"]) / grandExpTotal) * 100).toFixed(1) + "%" : "0%",
    }));

    // 4. Pending invoices
    const { rows: pending } = await pool.query(`
      SELECT description AS "الوصف", amount AS "المبلغ (د.ك)",
             due_date AS "تاريخ الاستحقاق", vendor AS "المورد/الجهة",
             category AS "الفئة"
      FROM finance_expenses WHERE status='pending'
      ORDER BY COALESCE(due_date,'9999-12-31'::date) ASC
    `);
    const pendingAr = pending.map((r: any) => ({ ...r, "الفئة": AR_ECAT[r["الفئة"]] ?? r["الفئة"] }));

    // 5. Overdue invoices
    const { rows: overdue } = await pool.query(`
      SELECT description AS "الوصف", amount AS "المبلغ (د.ك)",
             due_date AS "تاريخ الاستحقاق", vendor AS "المورد/الجهة",
             category AS "الفئة"
      FROM finance_expenses WHERE status='overdue'
      ORDER BY due_date ASC
    `);
    const overdueAr = overdue.map((r: any) => ({ ...r, "الفئة": AR_ECAT[r["الفئة"]] ?? r["الفئة"] }));

    // Build workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(plRows),     "قائمة الدخل");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incCatAr),   "الإيرادات بالتصنيف");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expCatAr),   "المصروفات بالتصنيف");
    if (pendingAr.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pendingAr), "الفواتير المستحقة");
    if (overdueAr.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overdueAr), "الفواتير المتأخرة");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `income-statement-${new Date().toISOString().slice(0,10)}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buf);
  } catch (err: any) {
    return res.status(500).json({ error: `فشل في إنشاء قائمة الدخل: ${err.message}` });
  }
});

/* ══════════════════════════════════════
   EXCEL EXPORT (admin only)
══════════════════════════════════════ */
router.get("/export/income", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const { rows } = await pool.query(`
      SELECT fi.date AS "التاريخ", fi.description AS "الوصف", fi.amount AS "المبلغ",
             fi.category AS "الفئة", u.full_name AS "الموظف",
             c.contract_number AS "رقم العقد", fi.notes AS "الملاحظات"
      FROM finance_income fi
      LEFT JOIN users u ON u.id = fi.employee_id
      LEFT JOIN contracts c ON c.id = fi.contract_id
      ORDER BY fi.date DESC
    `);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "الإيرادات");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", 'attachment; filename="income.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buf);
  } catch {
    return res.status(500).json({ error: "فشل في تصدير البيانات" });
  }
});

router.get("/export/expenses", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const { rows } = await pool.query(`
      SELECT description AS "الوصف", amount AS "المبلغ", due_date AS "تاريخ الاستحقاق",
             paid_date AS "تاريخ الدفع", status AS "الحالة", category AS "الفئة",
             vendor AS "المورد", notes AS "الملاحظات"
      FROM finance_expenses ORDER BY COALESCE(due_date,'9999-12-31'::date) ASC
    `);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "المصروفات");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", 'attachment; filename="expenses.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buf);
  } catch {
    return res.status(500).json({ error: "فشل في تصدير البيانات" });
  }
});

router.get("/export/sales", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const { rows } = await pool.query(`
      SELECT u.full_name AS "الموظف", es.sale_date AS "التاريخ",
             es.description AS "الوصف", es.total_contract_amount AS "إجمالي العقد",
             es.profit_percentage AS "نسبة الربح %", es.profit_amount AS "مبلغ الربح",
             c.contract_number AS "رقم العقد", es.notes AS "الملاحظات"
      FROM employee_sales es
      LEFT JOIN users u ON u.id = es.employee_id
      LEFT JOIN contracts c ON c.id = es.contract_id
      ORDER BY es.sale_date DESC
    `);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "مبيعات الموظفين");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", 'attachment; filename="sales.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buf);
  } catch {
    return res.status(500).json({ error: "فشل في تصدير البيانات" });
  }
});

export default router;
