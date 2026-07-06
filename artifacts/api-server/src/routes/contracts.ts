import { Router, type Request, type Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  contractsTable,
  insertContractSchema,
  updateContractSchema,
  governmentEntitiesTable,
  tendersTable,
} from "@workspace/db";
import { pool } from "@workspace/db";
import { requireAdmin } from "../middleware/auth";

const router = Router();

/* ─── Helper: check employee can access a contract ─── */
async function canAccessContract(contractId: number, userId: number, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true;
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int as blocked
     FROM contract_permissions
     WHERE contract_id = $1 AND user_id = $2 AND can_view = false`,
    [contractId, userId]
  );
  return rows[0].blocked === 0;
}

/* ═══════════════════════════════════════════
   CONTRACTS CRUD
═══════════════════════════════════════════ */

router.get("/", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const userId = req.session.userId!;
    const isAdmin = req.session.role === "admin";

    // Build base query
    let query = `
      SELECT
        c.id, c.tender_id as "tenderId", c.contract_number as "contractNumber",
        c.government_entity_id as "governmentEntityId", c.contract_value as "contractValue",
        c.sign_date as "signDate", c.start_date as "startDate", c.end_date as "endDate",
        c.status, c.notes, c.created_at as "createdAt", c.updated_at as "updatedAt",
        ge.name as "entityName", t.tender_number as "tenderNumber"
      FROM contracts c
      LEFT JOIN government_entities ge ON c.government_entity_id = ge.id
      LEFT JOIN tenders t ON c.tender_id = t.id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    // For employees: only show contracts they have permission to view
    // (either no explicit restriction set, or can_view = true)
    if (!isAdmin) {
      params.push(userId);
      conditions.push(`
        NOT EXISTS (
          SELECT 1 FROM contract_permissions cp
          WHERE cp.contract_id = c.id AND cp.user_id = $${params.length} AND cp.can_view = false
        )
      `);
    }

    if (status && status !== "all") {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY c.created_at DESC";

    const { rows } = await pool.query(query, params);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب العقود" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const userId = req.session.userId!;
    const isAdmin = req.session.role === "admin";
    if (!await canAccessContract(id, userId, isAdmin))
      return res.status(403).json({ error: "لا تملك صلاحية الوصول إلى هذا العقد" });
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

/* ═══════════════════════════════════════════
   DOCUMENTS (file attachments)
═══════════════════════════════════════════ */

// List documents for a contract
router.get("/:id/documents", async (req: Request, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const userId = req.session.userId!;
    const isAdmin = req.session.role === "admin";
    if (!await canAccessContract(contractId, userId, isAdmin))
      return res.status(403).json({ error: "لا تملك صلاحية الوصول إلى هذا العقد" });

    let query = `
      SELECT d.id, d.contract_id, d.uploaded_by, d.file_name, d.file_size,
             d.mime_type, d.created_at,
             u.full_name as uploader_name
      FROM contract_documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.contract_id = $1
    `;
    const params: any[] = [contractId];

    // Employees see only their own uploads
    if (!isAdmin) {
      params.push(userId);
      query += ` AND d.uploaded_by = $2`;
    }

    query += " ORDER BY d.created_at DESC";
    const { rows } = await pool.query(query, params);
    // Don't send file_data in list (too heavy); provide separate download endpoint
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب الملفات" });
  }
});

// Upload a document
router.post("/:id/documents", async (req: Request, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const userId = req.session.userId!;
    const isAdmin = req.session.role === "admin";
    if (!await canAccessContract(contractId, userId, isAdmin))
      return res.status(403).json({ error: "لا تملك صلاحية الوصول إلى هذا العقد" });
    const { fileName, fileSize, mimeType, fileData } = req.body;

    if (!fileName || !fileData) {
      return res.status(400).json({ error: "اسم الملف والبيانات مطلوبة" });
    }
    if (fileData.length > 8 * 1024 * 1024 * 1.4) { // ~8MB base64 limit
      return res.status(413).json({ error: "حجم الملف كبير جداً (الحد الأقصى 5 ميغابايت)" });
    }

    const { rows } = await pool.query(
      `INSERT INTO contract_documents (contract_id, uploaded_by, file_name, file_size, mime_type, file_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, contract_id, uploaded_by, file_name, file_size, mime_type, created_at`,
      [contractId, userId, fileName, fileSize || null, mimeType || null, fileData]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في رفع الملف" });
  }
});

// Download a document
router.get("/:id/documents/:docId/download", async (req: Request, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const docId = Number(req.params.docId);
    const userId = req.session.userId!;
    const isAdmin = req.session.role === "admin";
    if (!await canAccessContract(contractId, userId, isAdmin))
      return res.status(403).json({ error: "لا تملك صلاحية الوصول إلى هذا العقد" });

    const { rows } = await pool.query(
      `SELECT * FROM contract_documents WHERE id = $1 AND contract_id = $2`,
      [docId, contractId]
    );
    if (!rows.length) return res.status(404).json({ error: "الملف غير موجود" });

    const doc = rows[0];
    // Employee can only download their own files
    if (!isAdmin && doc.uploaded_by !== userId) {
      return res.status(403).json({ error: "لا تملك صلاحية تنزيل هذا الملف" });
    }

    const buffer = Buffer.from(doc.file_data, "base64");
    res.set({
      "Content-Type": doc.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.file_name)}"`,
      "Content-Length": buffer.length,
    });
    return res.send(buffer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في تنزيل الملف" });
  }
});

// Delete a document
router.delete("/:id/documents/:docId", async (req: Request, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const docId = Number(req.params.docId);
    const userId = req.session.userId!;
    const isAdmin = req.session.role === "admin";
    if (!await canAccessContract(contractId, userId, isAdmin))
      return res.status(403).json({ error: "لا تملك صلاحية الوصول إلى هذا العقد" });

    const { rows } = await pool.query(
      `SELECT * FROM contract_documents WHERE id = $1 AND contract_id = $2`,
      [docId, contractId]
    );
    if (!rows.length) return res.status(404).json({ error: "الملف غير موجود" });

    // Only uploader or admin can delete
    if (!isAdmin && rows[0].uploaded_by !== userId) {
      return res.status(403).json({ error: "لا تملك صلاحية حذف هذا الملف" });
    }

    await pool.query("DELETE FROM contract_documents WHERE id = $1", [docId]);
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في حذف الملف" });
  }
});

/* ═══════════════════════════════════════════
   PERMISSIONS (admin only)
═══════════════════════════════════════════ */

// Get permissions for a contract (returns all employees with their access)
router.get("/:id/permissions", requireAdmin, async (req: Request, res: Response) => {
  try {
    const contractId = Number(req.params.id);

    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.full_name,
              COALESCE(cp.can_view, true) as can_view
       FROM users u
       LEFT JOIN contract_permissions cp ON cp.contract_id = $1 AND cp.user_id = u.id
       WHERE u.role = 'employee'
       ORDER BY u.full_name`,
      [contractId]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب الصلاحيات" });
  }
});

// Set permission for a specific employee on a contract
router.put("/:id/permissions/:userId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const targetUserId = Number(req.params.userId);
    const { canView } = req.body;

    await pool.query(
      `INSERT INTO contract_permissions (contract_id, user_id, can_view)
       VALUES ($1, $2, $3)
       ON CONFLICT (contract_id, user_id)
       DO UPDATE SET can_view = EXCLUDED.can_view`,
      [contractId, targetUserId, canView !== false]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في تحديث الصلاحية" });
  }
});

/* ═══════════════════════════════════════════
   COMMENTS (admin → employee)
═══════════════════════════════════════════ */

// Get comments for a contract
router.get("/:id/comments", async (req: Request, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const userId = req.session.userId!;
    const isAdmin = req.session.role === "admin";
    if (!await canAccessContract(contractId, userId, isAdmin))
      return res.status(403).json({ error: "لا تملك صلاحية الوصول إلى هذا العقد" });

    let query = `
      SELECT cc.id, cc.contract_id, cc.content, cc.is_read, cc.created_at,
             fu.full_name as from_name, fu.role as from_role,
             tu.full_name as to_name, cc.from_user_id, cc.to_user_id
      FROM contract_comments cc
      LEFT JOIN users fu ON cc.from_user_id = fu.id
      LEFT JOIN users tu ON cc.to_user_id = tu.id
      WHERE cc.contract_id = $1
    `;
    const params: any[] = [contractId];

    // Employees see only comments addressed to them
    if (!isAdmin) {
      params.push(userId);
      query += ` AND cc.to_user_id = $2`;
    }

    query += " ORDER BY cc.created_at DESC";
    const { rows } = await pool.query(query, params);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب التعليقات" });
  }
});

// Add a comment (admin only)
router.post("/:id/comments", requireAdmin, async (req: Request, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const fromUserId = req.session.userId!;
    const { toUserId, content } = req.body;

    if (!toUserId || !content?.trim()) {
      return res.status(400).json({ error: "الموظف والتعليق مطلوبان" });
    }

    const { rows } = await pool.query(
      `INSERT INTO contract_comments (contract_id, from_user_id, to_user_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [contractId, fromUserId, toUserId, content.trim()]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في إضافة التعليق" });
  }
});

// Mark comment(s) as read
router.patch("/:id/comments/read", async (req: Request, res: Response) => {
  try {
    const contractId = Number(req.params.id);
    const userId = req.session.userId!;

    await pool.query(
      `UPDATE contract_comments SET is_read = true
       WHERE contract_id = $1 AND to_user_id = $2 AND is_read = false`,
      [contractId, userId]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في تحديث حالة التعليقات" });
  }
});

// Delete a comment (admin only)
router.delete("/:id/comments/:commentId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const commentId = Number(req.params.commentId);
    await pool.query("DELETE FROM contract_comments WHERE id = $1", [commentId]);
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في حذف التعليق" });
  }
});

/* ═══════════════════════════════════════════
   UNREAD COMMENTS COUNT (for dashboard badge)
═══════════════════════════════════════════ */
router.get("/meta/unread-comments", async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int as count
       FROM contract_comments
       WHERE to_user_id = $1 AND is_read = false`,
      [userId]
    );
    return res.json({ count: rows[0].count });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ count: 0 });
  }
});

export default router;
