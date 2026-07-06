import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logActivity } from "../middleware/activity-logger";

const router = Router();

const MODULE_FIELDS = [
  "accessTenders", "accessEntities", "accessSuppliers", "accessProjects",
  "accessGuarantees", "accessContracts", "accessRfq", "accessPo", "accessTransportation", "accessFinance",
] as const;

function buildUserResponse(user: any) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    canView: user.canView,
    canDownload: user.canDownload,
    canUpload: user.canUpload,
    canEdit: user.canEdit,
    accessTenders: user.accessTenders,
    accessEntities: user.accessEntities,
    accessSuppliers: user.accessSuppliers,
    accessProjects: user.accessProjects,
    accessGuarantees: user.accessGuarantees,
    accessContracts: user.accessContracts,
    accessRfq: user.accessRfq,
    accessPo: user.accessPo,
    accessTransportation: user.accessTransportation,
    accessFinance: user.accessFinance,
  };
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body as { username: string; password: string };

  if (!username || !password) {
    res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));

  if (!user || !user.isActive) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
    return;
  }

  // Update last login
  await db.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, user.id));

  // Store in session
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.fullName = user.fullName;
  req.session.role = user.role;
  req.session.canView = user.canView;
  req.session.canDownload = user.canDownload;
  req.session.canUpload = user.canUpload;
  req.session.canEdit = user.canEdit;
  for (const field of MODULE_FIELDS) {
    req.session[field] = user[field] ?? true;
  }

  // Log login activity
  logActivity({
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    action: "login",
    module: "auth",
    ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || undefined,
  }).catch(() => {});

  res.json(buildUserResponse(user));
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  const userId = req.session?.userId;
  const username = req.session?.username ?? "";
  const fullName = req.session?.fullName ?? "";

  req.session.destroy(() => {
    if (userId) {
      logActivity({ userId, username, fullName, action: "logout", module: "auth" }).catch(() => {});
    }
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "غير مصرح." });
    return;
  }
  res.json({
    id: req.session.userId,
    username: req.session.username,
    fullName: req.session.fullName,
    role: req.session.role,
    canView: req.session.canView,
    canDownload: req.session.canDownload,
    canUpload: req.session.canUpload,
    canEdit: req.session.canEdit,
    accessTenders: req.session.accessTenders ?? true,
    accessEntities: req.session.accessEntities ?? true,
    accessSuppliers: req.session.accessSuppliers ?? true,
    accessProjects: req.session.accessProjects ?? true,
    accessGuarantees: req.session.accessGuarantees ?? true,
    accessContracts: req.session.accessContracts ?? true,
    accessRfq: req.session.accessRfq ?? true,
    accessPo: req.session.accessPo ?? true,
    accessTransportation: req.session.accessTransportation ?? true,
    accessFinance: req.session.accessFinance ?? true,
  });
});

export default router;
