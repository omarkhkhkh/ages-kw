import { Router, type Request, type Response } from "express";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  pool,
  sponsorCompaniesTable,
  insertSponsorCompanySchema,
  updateSponsorCompanySchema,
  workersTable,
  insertWorkerSchema,
  updateWorkerSchema,
  workerDocumentsTable,
  workerHistoryTable,
} from "@workspace/db";

const router = Router();

function parseId(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseStr(raw: string | string[]): string {
  return Array.isArray(raw) ? raw[0] : raw;
}

/* ══════════════════════════════════════
   SPONSOR COMPANIES
══════════════════════════════════════ */
router.get("/companies", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.notes, c.created_at AS "createdAt", c.updated_at AS "updatedAt",
             COUNT(w.id)::int AS "workerCount"
      FROM sponsor_companies c
      LEFT JOIN workers w ON w.company_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الشركات" });
  }
});

router.post("/companies", async (req: Request, res: Response) => {
  try {
    const data = insertSponsorCompanySchema.parse(req.body);
    const [row] = await db.insert(sponsorCompaniesTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء الشركة" });
  }
});

router.patch("/companies/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const data = updateSponsorCompanySchema.parse(req.body);
    const [row] = await db.update(sponsorCompaniesTable).set({ ...data, updatedAt: new Date() }).where(eq(sponsorCompaniesTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "الشركة غير موجودة" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث الشركة" });
  }
});

router.delete("/companies/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    await db.delete(sponsorCompaniesTable).where(eq(sponsorCompaniesTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الشركة" });
  }
});

/* ══════════════════════════════════════
   COMPANY STATS (dashboard)
══════════════════════════════════════ */
router.get("/companies/:id/stats", async (req: Request, res: Response) => {
  const companyId = parseId(req.params.id);
  if (!companyId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [counts] = await db.select({
      total: sql<number>`count(*)::int`,
      residencyExpired: sql<number>`count(*) filter (where residency_expiry < current_date)::int`,
      residencyExpiring30: sql<number>`count(*) filter (where residency_expiry <= current_date + interval '30 days' and residency_expiry >= current_date)::int`,
      passportExpired: sql<number>`count(*) filter (where passport_expiry < current_date)::int`,
      insuranceExpired: sql<number>`count(*) filter (where health_insurance_expiry < current_date)::int`,
      workPermitExpired: sql<number>`count(*) filter (where work_permit_expiry < current_date)::int`,
      residencyGreen: sql<number>`count(*) filter (where residency_expiry > current_date + interval '60 days')::int`,
      residencyYellow: sql<number>`count(*) filter (where residency_expiry <= current_date + interval '60 days' and residency_expiry >= current_date)::int`,
      residencyRed: sql<number>`count(*) filter (where residency_expiry < current_date)::int`,
    }).from(workersTable).where(eq(workersTable.companyId, companyId));

    const byNationality = await pool.query(
      `SELECT COALESCE(nationality, 'غير محدد') AS nationality, COUNT(*)::int AS count
       FROM workers WHERE company_id = $1 GROUP BY nationality ORDER BY count DESC`,
      [companyId]
    );
    const byDepartment = await pool.query(
      `SELECT COALESCE(department, 'غير محدد') AS department, COUNT(*)::int AS count
       FROM workers WHERE company_id = $1 GROUP BY department ORDER BY count DESC`,
      [companyId]
    );

    return res.json({
      ...counts,
      byNationality: byNationality.rows,
      byDepartment: byDepartment.rows,
      byResidencyStatus: [
        { status: "green", label: "أكثر من 60 يوم", count: counts.residencyGreen },
        { status: "yellow", label: "خلال 60 يوم", count: counts.residencyYellow },
        { status: "red", label: "منتهية", count: counts.residencyRed },
      ],
    });
  } catch {
    return res.status(500).json({ error: "فشل في جلب إحصائيات الشركة" });
  }
});

/* ══════════════════════════════════════
   ALERTS — workers with any document expiring within N days
══════════════════════════════════════ */
router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const days = Number(req.query.days) || 30;
    const companyId = req.query.companyId ? Number(req.query.companyId) : null;
    const params: any[] = [days];
    let where = `(
      (w.residency_expiry IS NOT NULL AND w.residency_expiry <= current_date + ($1 || ' days')::interval) OR
      (w.passport_expiry IS NOT NULL AND w.passport_expiry <= current_date + ($1 || ' days')::interval) OR
      (w.health_insurance_expiry IS NOT NULL AND w.health_insurance_expiry <= current_date + ($1 || ' days')::interval) OR
      (w.work_permit_expiry IS NOT NULL AND w.work_permit_expiry <= current_date + ($1 || ' days')::interval)
    )`;
    if (companyId) {
      params.push(companyId);
      where += ` AND w.company_id = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT w.id, w.full_name AS "fullName", w.photo_url AS "photoUrl", w.company_id AS "companyId",
              c.name AS "companyName",
              w.residency_number AS "residencyNumber", w.residency_expiry::text AS "residencyExpiry",
              w.passport_number AS "passportNumber", w.passport_expiry::text AS "passportExpiry",
              w.health_insurance_expiry::text AS "healthInsuranceExpiry",
              w.work_permit_expiry::text AS "workPermitExpiry"
       FROM workers w
       LEFT JOIN sponsor_companies c ON c.id = w.company_id
       WHERE ${where}
       ORDER BY LEAST(
         COALESCE(w.residency_expiry, '9999-12-31'), COALESCE(w.passport_expiry, '9999-12-31'),
         COALESCE(w.health_insurance_expiry, '9999-12-31'), COALESCE(w.work_permit_expiry, '9999-12-31')
       )`,
      params
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب التنبيهات" });
  }
});

/* ══════════════════════════════════════
   WORKERS
══════════════════════════════════════ */
router.get("/workers", async (req: Request, res: Response) => {
  try {
    const { companyId, search, nationality, department, status, assignedModule } = req.query as Record<string, string>;
    const conditions: SQL[] = [];
    if (companyId) conditions.push(eq(workersTable.companyId, Number(companyId)));
    if (nationality) conditions.push(eq(workersTable.nationality, nationality));
    if (department) conditions.push(eq(workersTable.department, department));
    if (status) conditions.push(eq(workersTable.status, status));
    if (assignedModule) conditions.push(eq(workersTable.assignedModule, assignedModule));
    if (search) {
      conditions.push(or(
        ilike(workersTable.fullName, `%${search}%`),
        ilike(workersTable.residencyNumber, `%${search}%`),
        ilike(workersTable.civilId, `%${search}%`),
        ilike(workersTable.passportNumber, `%${search}%`),
      )!);
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await db.select().from(workersTable).where(where).orderBy(desc(workersTable.createdAt));
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب العمال" });
  }
});

router.get("/workers/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [row] = await db.select().from(workersTable).where(eq(workersTable.id, id));
    if (!row) return res.status(404).json({ error: "العامل غير موجود" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في جلب بيانات العامل" });
  }
});

router.post("/workers", async (req: Request, res: Response) => {
  try {
    const data = insertWorkerSchema.parse(req.body);
    const [row] = await db.insert(workersTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة العامل" });
  }
});

const HISTORY_FIELDS: { field: keyof typeof workersTable.$inferSelect; label: string }[] = [
  { field: "residencyExpiry", label: "تجديد إقامة" },
  { field: "passportExpiry", label: "تجديد جواز" },
  { field: "workPermitExpiry", label: "تجديد إذن عمل" },
  { field: "jobTitle", label: "تعديل مهنة" },
];

router.patch("/workers/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [existing] = await db.select().from(workersTable).where(eq(workersTable.id, id));
    if (!existing) return res.status(404).json({ error: "العامل غير موجود" });

    const data = updateWorkerSchema.parse(req.body) as Record<string, any>;
    // date/numeric columns reject "" at the driver level — normalize blank strings to null
    for (const f of ["hireDate", "residencyExpiry", "passportExpiry", "healthInsuranceExpiry", "workPermitExpiry", "salary"]) {
      if (data[f] === "") data[f] = null;
    }
    const [row] = await db.update(workersTable).set({ ...data, updatedAt: new Date() }).where(eq(workersTable.id, id)).returning();

    const userId = req.session.userId!;
    const existingAny = existing as Record<string, any>;
    const historyRows = HISTORY_FIELDS
      .filter(({ field }) => data[field] !== undefined && String(data[field] ?? "") !== String(existingAny[field] ?? ""))
      .map(({ field, label }) => ({
        workerId: id,
        operationType: label,
        oldValue: existingAny[field] ? String(existingAny[field]) : null,
        newValue: data[field] ? String(data[field]) : null,
        effectiveDate: new Date().toISOString().slice(0, 10),
        createdByUserId: userId,
      }));
    if (historyRows.length) await db.insert(workerHistoryTable).values(historyRows);

    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "فشل في تحديث بيانات العامل" });
  }
});

router.delete("/workers/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    await db.delete(workersTable).where(eq(workersTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف العامل" });
  }
});

/* ══════════════════════════════════════
   WORKER DOCUMENTS (8 fixed slots)
══════════════════════════════════════ */
router.get("/workers/:id/documents", async (req: Request, res: Response) => {
  const workerId = parseId(req.params.id);
  if (!workerId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const rows = await db.select().from(workerDocumentsTable).where(eq(workerDocumentsTable.workerId, workerId));
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب مستندات العامل" });
  }
});

router.put("/workers/:id/documents/:type", async (req: Request, res: Response) => {
  const workerId = parseId(req.params.id);
  const documentType = parseStr(req.params.type);
  if (!workerId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { fileUrl, mimeType, fileSize } = req.body as any;
    if (!fileUrl) return res.status(400).json({ error: "رابط الملف مطلوب" });
    const { rows } = await pool.query(
      `INSERT INTO worker_documents (worker_id, document_type, file_url, mime_type, file_size, uploaded_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (worker_id, document_type)
       DO UPDATE SET file_url = EXCLUDED.file_url, mime_type = EXCLUDED.mime_type,
                      file_size = EXCLUDED.file_size, uploaded_by_user_id = EXCLUDED.uploaded_by_user_id,
                      created_at = now()
       RETURNING id, worker_id AS "workerId", document_type AS "documentType", file_url AS "fileUrl",
                 mime_type AS "mimeType", file_size AS "fileSize", created_at AS "createdAt"`,
      [workerId, documentType, fileUrl, mimeType || null, fileSize || null, req.session.userId!]
    );
    return res.status(201).json(rows[0]);
  } catch {
    return res.status(500).json({ error: "فشل في حفظ المستند" });
  }
});

router.delete("/workers/:id/documents/:type", async (req: Request, res: Response) => {
  const workerId = parseId(req.params.id);
  if (!workerId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    await db.delete(workerDocumentsTable).where(
      and(eq(workerDocumentsTable.workerId, workerId), eq(workerDocumentsTable.documentType, parseStr(req.params.type)))
    );
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف المستند" });
  }
});

/* ══════════════════════════════════════
   WORKER HISTORY (سجل التجديد)
══════════════════════════════════════ */
router.get("/workers/:id/history", async (req: Request, res: Response) => {
  const workerId = parseId(req.params.id);
  if (!workerId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { rows } = await pool.query(
      `SELECT h.id, h.worker_id AS "workerId", h.operation_type AS "operationType",
              h.old_value AS "oldValue", h.new_value AS "newValue", h.effective_date AS "effectiveDate",
              h.notes, h.created_at AS "createdAt", u.full_name AS "createdByName"
       FROM worker_history h
       LEFT JOIN users u ON u.id = h.created_by_user_id
       WHERE h.worker_id = $1
       ORDER BY h.created_at DESC`,
      [workerId]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب سجل التجديد" });
  }
});

router.post("/workers/:id/history", async (req: Request, res: Response) => {
  const workerId = parseId(req.params.id);
  if (!workerId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { operationType, oldValue, newValue, effectiveDate, notes } = req.body as any;
    if (!operationType?.trim()) return res.status(400).json({ error: "نوع العملية مطلوب" });
    const [row] = await db.insert(workerHistoryTable).values({
      workerId,
      operationType: operationType.trim(),
      oldValue: oldValue || null,
      newValue: newValue || null,
      effectiveDate: effectiveDate || null,
      notes: notes || null,
      createdByUserId: req.session.userId!,
    }).returning();
    return res.status(201).json(row);
  } catch {
    return res.status(500).json({ error: "فشل في إضافة قيد السجل" });
  }
});

export default router;
