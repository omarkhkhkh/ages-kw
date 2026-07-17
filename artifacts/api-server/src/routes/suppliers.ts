import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, pool, suppliersTable, insertSupplierSchema, updateSupplierSchema } from "@workspace/db";

const router = Router();
const isAdmin = (req: Request) => req.session.role === "admin";

router.get("/", async (req: Request, res: Response) => {
  try {
    const admin = isAdmin(req);
    const userId = req.session.userId!;
    const { status } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (status) {
      // Explicit status filter (e.g. manager reviewing pending drafts) — still scoped to what the requester may see.
      params.push(status);
      conditions.push(`status = $${params.length}`);
      if (!admin) { params.push(userId); conditions.push(`created_by_user_id = $${params.length}`); }
    } else if (!admin) {
      // Default visibility: approved suppliers (shared company data) + my own drafts pending review.
      params.push(userId);
      conditions.push(`(status = 'approved' OR created_by_user_id = $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.company_id AS "companyId", s.type, s.contact_person AS "contactPerson",
              s.phone, s.email, s.address, s.specialization, s.commercial_reg_no AS "commercialRegNo",
              s.notes, s.status, s.created_by_user_id AS "createdByUserId", u.full_name AS "createdByName",
              s.created_at AS "createdAt", s.updated_at AS "updatedAt"
       FROM suppliers s
       LEFT JOIN users u ON u.id = s.created_by_user_id
       ${where}
       ORDER BY s.name`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب الموردين" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [supplier] = await db
      .select()
      .from(suppliersTable)
      .where(eq(suppliersTable.id, id));
    if (!supplier) return res.status(404).json({ error: "المورد غير موجود" });
    return res.json(supplier);
  } catch {
    return res.status(500).json({ error: "فشل في جلب المورد" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    // Suppliers registered by a non-manager start as a draft awaiting the manager's approval
    // before they become part of the shared company-wide supplier list.
    const data = insertSupplierSchema.parse({
      ...req.body,
      createdByUserId: req.session.userId!,
      status: isAdmin(req) ? "approved" : "draft",
    });
    const [supplier] = await db.insert(suppliersTable).values(data).returning();
    return res.status(201).json(supplier);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء المورد" });
  }
});

router.patch("/:id/approve", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const id = Number(req.params.id);
    const [supplier] = await db.update(suppliersTable).set({ status: "approved", updatedAt: new Date() }).where(eq(suppliersTable.id, id)).returning();
    if (!supplier) return res.status(404).json({ error: "المورد غير موجود" });
    return res.json(supplier);
  } catch {
    return res.status(500).json({ error: "فشل في اعتماد المورد" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateSupplierSchema.parse(req.body);
    const [supplier] = await db
      .update(suppliersTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(suppliersTable.id, id))
      .returning();
    if (!supplier) return res.status(404).json({ error: "المورد غير موجود" });
    return res.json(supplier);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث المورد" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف المورد" });
  }
});

export default router;
