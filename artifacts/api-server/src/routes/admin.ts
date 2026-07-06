import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, pool, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { activityLogger } from "../middleware/activity-logger";

const router = Router();

// All admin routes require admin role
router.use(requireAdmin);
// Log admin mutations (POST/PATCH/DELETE) — mounted before /admin in index.ts so needs explicit attachment here
router.use(activityLogger);

const USER_SELECT = {
  id: usersTable.id,
  username: usersTable.username,
  fullName: usersTable.fullName,
  role: usersTable.role,
  canView: usersTable.canView,
  canDownload: usersTable.canDownload,
  canUpload: usersTable.canUpload,
  canEdit: usersTable.canEdit,
  accessTenders: usersTable.accessTenders,
  accessEntities: usersTable.accessEntities,
  accessSuppliers: usersTable.accessSuppliers,
  accessProjects: usersTable.accessProjects,
  accessGuarantees: usersTable.accessGuarantees,
  accessContracts: usersTable.accessContracts,
  accessRfq: usersTable.accessRfq,
  accessPo: usersTable.accessPo,
  accessTransportation: usersTable.accessTransportation,
  accessFinance: usersTable.accessFinance,
  isActive: usersTable.isActive,
  createdAt: usersTable.createdAt,
  lastLogin: usersTable.lastLogin,
} as const;

// GET /api/admin/users
router.get("/users", async (_req, res) => {
  const users = await db.select(USER_SELECT).from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

// POST /api/admin/users — create a new user
router.post("/users", async (req, res) => {
  const {
    username, fullName, password, role,
    canView, canDownload, canUpload, canEdit,
    accessTenders, accessEntities, accessSuppliers, accessProjects,
    accessGuarantees, accessContracts, accessRfq, accessPo, accessTransportation, accessFinance,
  } = req.body as any;

  if (!username || !fullName || !password) {
    res.status(400).json({ error: "اسم المستخدم والاسم الكامل وكلمة المرور مطلوبة." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(usersTable)
    .values({
      username, fullName, password: hashed,
      role: role ?? "employee",
      canView: canView ?? true,
      canDownload: canDownload ?? false,
      canUpload: canUpload ?? false,
      canEdit: canEdit ?? false,
      accessTenders: accessTenders ?? true,
      accessEntities: accessEntities ?? true,
      accessSuppliers: accessSuppliers ?? true,
      accessProjects: accessProjects ?? true,
      accessGuarantees: accessGuarantees ?? true,
      accessContracts: accessContracts ?? true,
      accessRfq: accessRfq ?? true,
      accessPo: accessPo ?? true,
      accessTransportation: accessTransportation ?? true,
      accessFinance: accessFinance ?? true,
    })
    .returning(USER_SELECT);

  res.status(201).json(user);
});

// PATCH /api/admin/users/:id
router.patch("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const {
    fullName, role, isActive, password,
    canView, canDownload, canUpload, canEdit,
    accessTenders, accessEntities, accessSuppliers, accessProjects,
    accessGuarantees, accessContracts, accessRfq, accessPo, accessTransportation, accessFinance,
  } = req.body as any;

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (fullName !== undefined) updates.fullName = fullName;
  if (role !== undefined) updates.role = role;
  if (isActive !== undefined) updates.isActive = isActive;
  if (canView !== undefined) updates.canView = canView;
  if (canDownload !== undefined) updates.canDownload = canDownload;
  if (canUpload !== undefined) updates.canUpload = canUpload;
  if (canEdit !== undefined) updates.canEdit = canEdit;
  if (accessTenders !== undefined) updates.accessTenders = accessTenders;
  if (accessEntities !== undefined) updates.accessEntities = accessEntities;
  if (accessSuppliers !== undefined) updates.accessSuppliers = accessSuppliers;
  if (accessProjects !== undefined) updates.accessProjects = accessProjects;
  if (accessGuarantees !== undefined) updates.accessGuarantees = accessGuarantees;
  if (accessContracts !== undefined) updates.accessContracts = accessContracts;
  if (accessRfq !== undefined) updates.accessRfq = accessRfq;
  if (accessPo !== undefined) updates.accessPo = accessPo;
  if (accessTransportation !== undefined) updates.accessTransportation = accessTransportation;
  if (accessFinance !== undefined) updates.accessFinance = accessFinance;

  if (password) {
    if (password.length < 6) {
      res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." });
      return;
    }
    updates.password = await bcrypt.hash(password, 12);
  }

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning(USER_SELECT);

  if (!user) {
    res.status(404).json({ error: "المستخدم غير موجود." });
    return;
  }
  res.json(user);
});

// GET /api/admin/users/:id/profile — full employee profile (tenders, projects, income, sales)
router.get("/users/:id/profile", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "معرّف المستخدم غير صالح" });
    return;
  }

  // Get employee info
  const [user] = await db.select(USER_SELECT).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }

  const name = user.fullName;

  // Tenders where employee has any role (matched by full name, case-insensitive)
  const { rows: tenders } = await pool.query(`
    SELECT id, tender_number AS "tenderNumber", project_name AS "projectName",
           government_entity AS "governmentEntity", status, offer_value AS "offerValue",
           contract_value AS "contractValue", announcement_date AS "announcementDate",
           responsible_engineer AS "responsibleEngineer", tender_manager AS "tenderManager",
           procurement_officer AS "procurementOfficer", financial_officer AS "financialOfficer",
           transport_officer AS "transportOfficer", approval_manager AS "approvalManager"
    FROM tenders
    WHERE responsible_engineer ILIKE $1
       OR tender_manager       ILIKE $1
       OR procurement_officer  ILIKE $1
       OR financial_officer    ILIKE $1
       OR transport_officer    ILIKE $1
       OR approval_manager     ILIKE $1
    ORDER BY created_at DESC
  `, [`%${name}%`]);

  // Contracts linked to those tenders
  const { rows: contracts } = tenders.length > 0
    ? await pool.query(`
        SELECT c.id, c.contract_number AS "contractNumber", c.contract_value AS "contractValue",
               c.status, c.sign_date AS "signDate", c.start_date AS "startDate",
               c.end_date AS "endDate", ge.name AS "governmentEntity"
        FROM contracts c
        LEFT JOIN government_entities ge ON ge.id = c.government_entity_id
        WHERE c.tender_id = ANY($1::int[])
        ORDER BY c.created_at DESC
      `, [tenders.map((t: any) => t.id)])
    : { rows: [] };

  // Projects where employee is project manager
  const { rows: projects } = await pool.query(`
    SELECT p.id, p.project_number AS "projectNumber", p.name,
           p.status, p.contract_value AS "contractValue",
           p.start_date AS "startDate", p.end_date AS "endDate",
           p.completion_percentage AS "completionPercentage",
           p.project_manager AS "projectManager",
           ge.name AS "governmentEntity"
    FROM projects p
    LEFT JOIN government_entities ge ON ge.id = p.government_entity_id
    WHERE p.project_manager ILIKE $1
    ORDER BY p.created_at DESC
  `, [`%${name}%`]);

  // Finance income records
  const { rows: income } = await pool.query(`
    SELECT id, description, amount, date, category, notes, created_at AS "createdAt"
    FROM finance_income
    WHERE employee_id = $1
    ORDER BY date DESC
  `, [id]);

  // Employee sales
  const { rows: sales } = await pool.query(`
    SELECT es.id, es.description, es.total_contract_amount AS "totalContractAmount",
           es.profit_percentage AS "profitPercentage", es.profit_amount AS "profitAmount",
           es.sale_date AS "saleDate", es.notes,
           c.contract_number AS "contractNumber"
    FROM employee_sales es
    LEFT JOIN contracts c ON c.id = es.contract_id
    WHERE es.employee_id = $1
    ORDER BY es.sale_date DESC
  `, [id]);

  res.json({ user, tenders, contracts, projects, income, sales });
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const remaining = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (target?.role === "admin" && remaining.length <= 1) {
    res.status(400).json({ error: "لا يمكن حذف المدير الوحيد." });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).end();
});

export default router;
