import { Router } from "express";
import { positionsOfUser } from "./positions";
import bcrypt from "bcryptjs";
import { passwordPolicyError, logLoginAttempt } from "../lib/security";
import { pool } from "@workspace/db";
import { createNotification } from "./notifications";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logActivity } from "../middleware/activity-logger";
import { synthesizePermissions } from "../middleware/auth";

const router = Router();

const MODULE_FIELDS = [
  "accessTenders", "accessEntities", "accessSuppliers", "accessProjects",
  "accessGuarantees", "accessContracts", "accessRfq", "accessPo", "accessTransportation", "accessFinance",
  "accessCorrespondence", "accessResidency", "accessMaintenance", "accessResearch", "accessPricing", "accessTasks",
  "accessOpportunities",
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
    accessCorrespondence: user.accessCorrespondence,
    accessResidency: user.accessResidency,
    accessMaintenance: user.accessMaintenance,
    accessResearch: user.accessResearch,
    accessPricing: user.accessPricing,
    accessTasks: user.accessTasks,
    accessOpportunities: user.accessOpportunities,
    opportunityCanPrice: user.opportunityCanPrice,
    opportunityCanApprove: user.opportunityCanApprove,
    taskViewScope: user.taskViewScope,
    taskCanApprove: user.taskCanApprove,
    correspondenceViewAll: user.correspondenceViewAll,
    permissions: user.permissions ?? synthesizePermissions(user),
    recordViewScope: user.recordViewScope ?? "own",
    positions: user.positions ?? [],
    mustChangePassword: user.mustChangePassword ?? false,
  };
}

// POST /api/auth/reset-request — «نسيت كلمة المرور»: طلب داخلي يصل المدراء
// رد موحّد دائمًا (لا كشف لوجود الحساب) + طلب واحد لكل اسم كل 10 دقائق
router.post("/reset-request", async (req, res) => {
  const UNIFORM = { ok: true, message: "إن كان الحساب موجودًا فقد وصل طلبك للمدير — سيتواصل معك بكلمة مرور مؤقتة." };
  try {
    const username = String(req.body?.username ?? "").trim().slice(0, 100);
    if (!username) { res.json(UNIFORM); return; }
    const { rows: recent } = await pool.query(
      `SELECT 1 FROM password_reset_requests WHERE username = $1 AND created_at > now() - interval '10 minutes' LIMIT 1`,
      [username]);
    await pool.query(`INSERT INTO password_reset_requests (username) VALUES ($1)`, [username]);
    if (!recent.length) {
      const [target] = await db.select().from(usersTable).where(eq(usersTable.username, username));
      if (target && target.isActive) {
        // يصل للأدمن (ومنه حساب الأمان المستقل) ولحامل قبعة المدير العام
        const { rows: recipients } = await pool.query(
          `SELECT id FROM users WHERE role = 'admin' AND is_active = true
           UNION
           SELECT up.user_id FROM user_positions up JOIN positions p ON p.id = up.position_id
           JOIN users u2 ON u2.id = up.user_id
           WHERE p.key = 'general_manager' AND u2.is_active = true`);
        for (const r of recipients) {
          createNotification({
            recipientUserId: r.id, type: "password_reset_request",
            message: `🔑 ${target.fullName} (@${username}) يطلب إعادة تعيين كلمة مروره — من إدارة المستخدمين: 🎲 توليد كلمة مؤقتة`,
            link: "/admin/users",
          }).catch(() => {});
        }
      }
    }
  } catch (err) { console.error("reset-request failed", err); }
  res.json(UNIFORM);
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body as { username: string; password: string };

  if (!username || !password) {
    res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));

  if (!user || !user.isActive) {
    await logLoginAttempt(username, false, req.ip);
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
    return;
  }

  // القفل المؤقت بعد ٥ محاولات فاشلة
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const mins = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
    await logLoginAttempt(username, false, req.ip);
    res.status(423).json({ error: `الحساب مقفل مؤقتًا بعد محاولات فاشلة — حاول بعد ${mins} دقيقة` });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    const fails = (user.failedLogins ?? 0) + 1;
    if (fails >= 5) {
      await db.update(usersTable).set({ failedLogins: 0, lockedUntil: new Date(Date.now() + 15 * 60000) }).where(eq(usersTable.id, user.id));
    } else {
      await db.update(usersTable).set({ failedLogins: fails }).where(eq(usersTable.id, user.id));
    }
    await logLoginAttempt(username, false, req.ip);
    res.status(401).json({ error: fails >= 5 ? "قُفل الحساب 15 دقيقة بعد 5 محاولات فاشلة" : "اسم المستخدم أو كلمة المرور غير صحيحة." });
    return;
  }

  // Update last login + تصفير عدّاد الفشل
  await db.update(usersTable).set({ lastLogin: new Date(), failedLogins: 0, lockedUntil: null }).where(eq(usersTable.id, user.id));
  await logLoginAttempt(username, true, req.ip);

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
  req.session.taskViewScope = user.taskViewScope ?? "own";
  req.session.taskCanApprove = user.taskCanApprove ?? false;
  req.session.opportunityCanPrice = user.opportunityCanPrice ?? false;
  req.session.opportunityCanApprove = user.opportunityCanApprove ?? false;
  req.session.correspondenceViewAll = user.correspondenceViewAll ?? false;
  req.session.permissions = user.permissions ?? synthesizePermissions(user);
  req.session.recordViewScope = user.recordViewScope ?? "own";
  try { req.session.positions = await positionsOfUser(user.id); } catch { req.session.positions = []; }
  (req.session as any).mustChangePassword = user.mustChangePassword ?? false;

  // Log login activity
  logActivity({
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    action: "login",
    module: "auth",
    ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || undefined,
  }).catch(() => {});

  res.json(buildUserResponse({ ...user, positions: req.session.positions ?? [] }));
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
    accessCorrespondence: req.session.accessCorrespondence ?? true,
    accessResidency: req.session.accessResidency ?? true,
    accessMaintenance: req.session.accessMaintenance ?? true,
    accessResearch: req.session.accessResearch ?? true,
    accessPricing: req.session.accessPricing ?? true,
    accessTasks: req.session.accessTasks ?? true,
    accessOpportunities: req.session.accessOpportunities ?? true,
    opportunityCanPrice: req.session.opportunityCanPrice ?? false,
    opportunityCanApprove: req.session.opportunityCanApprove ?? false,
    positions: req.session.positions ?? [],
    taskViewScope: req.session.taskViewScope ?? "own",
    taskCanApprove: req.session.taskCanApprove ?? false,
    correspondenceViewAll: req.session.correspondenceViewAll ?? false,
    permissions: req.session.permissions ?? synthesizePermissions(req.session as any),
    recordViewScope: req.session.recordViewScope ?? "own",
    mustChangePassword: (req.session as any).mustChangePassword ?? false,
  });
});

// POST /api/auth/change-password — المستخدم يغيّر كلمته (وإجباريًا بعد الإنشاء/إعادة التعيين)
router.post("/change-password", async (req, res) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "غير مصرح." });
    return;
  }
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "كلمة المرور الحالية والجديدة مطلوبتان." });
    return;
  }
  const policy = passwordPolicyError(newPassword);
  if (policy) { res.status(400).json({ error: policy }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) { res.status(404).json({ error: "المستخدم غير موجود." }); return; }
  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) { res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة." }); return; }
  if (currentPassword === newPassword) { res.status(400).json({ error: "الكلمة الجديدة يجب أن تختلف عن الحالية." }); return; }

  const hashed = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ password: hashed, mustChangePassword: false }).where(eq(usersTable.id, user.id));
  (req.session as any).mustChangePassword = false;
  logActivity({ userId: user.id, username: user.username, fullName: user.fullName, action: "change_password", module: "auth" }).catch(() => {});
  res.json({ ok: true });
});

export default router;
