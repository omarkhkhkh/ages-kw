import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";

const router = Router();

// All admin routes require admin role
router.use(requireAdmin);

// GET /api/admin/users
router.get("/users", async (_req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      fullName: usersTable.fullName,
      role: usersTable.role,
      canView: usersTable.canView,
      canDownload: usersTable.canDownload,
      canUpload: usersTable.canUpload,
      canEdit: usersTable.canEdit,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
      lastLogin: usersTable.lastLogin,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  res.json(users);
});

// POST /api/admin/users — create a new user
router.post("/users", async (req, res) => {
  const { username, fullName, password, role, canView, canDownload, canUpload, canEdit } =
    req.body as {
      username: string;
      fullName: string;
      password: string;
      role?: string;
      canView?: boolean;
      canDownload?: boolean;
      canUpload?: boolean;
      canEdit?: boolean;
    };

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
      username,
      fullName,
      password: hashed,
      role: role ?? "employee",
      canView: canView ?? true,
      canDownload: canDownload ?? false,
      canUpload: canUpload ?? false,
      canEdit: canEdit ?? false,
    })
    .returning({
      id: usersTable.id,
      username: usersTable.username,
      fullName: usersTable.fullName,
      role: usersTable.role,
      canView: usersTable.canView,
      canDownload: usersTable.canDownload,
      canUpload: usersTable.canUpload,
      canEdit: usersTable.canEdit,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    });

  res.status(201).json(user);
});

// PATCH /api/admin/users/:id — update user (permissions, name, role, active status)
router.patch("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { fullName, role, canView, canDownload, canUpload, canEdit, isActive, password } =
    req.body as {
      fullName?: string;
      role?: string;
      canView?: boolean;
      canDownload?: boolean;
      canUpload?: boolean;
      canEdit?: boolean;
      isActive?: boolean;
      password?: string;
    };

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (fullName !== undefined) updates.fullName = fullName;
  if (role !== undefined) updates.role = role;
  if (canView !== undefined) updates.canView = canView;
  if (canDownload !== undefined) updates.canDownload = canDownload;
  if (canUpload !== undefined) updates.canUpload = canUpload;
  if (canEdit !== undefined) updates.canEdit = canEdit;
  if (isActive !== undefined) updates.isActive = isActive;
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
    .returning({
      id: usersTable.id,
      username: usersTable.username,
      fullName: usersTable.fullName,
      role: usersTable.role,
      canView: usersTable.canView,
      canDownload: usersTable.canDownload,
      canUpload: usersTable.canUpload,
      canEdit: usersTable.canEdit,
      isActive: usersTable.isActive,
    });

  if (!user) {
    res.status(404).json({ error: "المستخدم غير موجود." });
    return;
  }
  res.json(user);
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  // Prevent deleting the last admin
  const remaining = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (target?.role === "admin" && remaining.length <= 1) {
    res.status(400).json({ error: "لا يمكن حذف المدير الوحيد." });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).end();
});

export default router;
