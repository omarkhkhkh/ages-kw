import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
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
    accessGuarantees, accessContracts, accessRfq, accessPo,
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
    accessGuarantees, accessContracts, accessRfq, accessPo,
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
