import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import authRouter from "./auth";
import adminRouter from "./admin";
import activityLogsRouter from "./activity-logs";
import tendersRouter from "./tenders";
import governmentEntitiesRouter from "./government-entities";
import entityDirectoryRouter from "./entity-directory";
import suppliersRouter from "./suppliers";
import rfqRequestsRouter from "./rfq-requests";
import directPurchaseOrdersRouter from "./direct-purchase-orders";
import projectsRouter from "./projects";
import bankGuaranteesRouter from "./bank-guarantees";
import contractsRouter from "./contracts";
import transportationRouter from "./transportation";
import vehiclesRouter from "./vehicles";
import financeRouter from "./finance";
import tasksRouter from "./tasks";
import notificationsRouter from "./notifications";
import taskAutomationRouter from "./task-automation";
import practicesRouter from "./practices";
import companyDocumentsRouter from "./company-documents";
import governmentRegistrationsRouter from "./government-registrations";
import competitorsRouter from "./competitors";
import bidResultsRouter from "./bid-results";
import competitorAnalyticsRouter from "./competitor-analytics";
import correspondenceRouter from "./correspondence";
import correspondenceTemplatesRouter from "./correspondence-templates";
import residencyRouter from "./residency";
import maintenanceRouter from "./maintenance";
import maintenanceServiceRouter from "./maintenance-service";
import researchRouter from "./research";
import positionsRouter from "./positions";
import workTransfersRouter from "./work-transfers";
import caseFilesRouter from "./case-files";
import obligationsRouter from "./obligations";
import financialCenterRouter from "./financial-center";
import pricingRouter from "./pricing";
import opportunitiesRouter from "./opportunities";
import costCentersRouter from "./cost-centers";
import pricingBookRouter from "./pricing-book";
import { requireAuth, requireEdit, requireModule, hasModuleAction } from "../middleware/auth";
import { activityLogger } from "../middleware/activity-logger";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);
router.use(storageRouter);
router.use("/auth", authRouter);

// Admin routes (admin-only check is inside adminRouter / activityLogsRouter)
router.use("/admin", adminRouter);
router.use("/admin/activity-logs", activityLogsRouter);

// Protected routes — require valid session
router.use(requireAuth);

// Lightweight user directory — accessible to all authenticated users for team assignment
import { db as _db, usersTable as _usersTable } from "@workspace/db";
import { eq as _eq } from "drizzle-orm";
router.get("/users/directory", async (req, res) => {
  try {
    const rows = await _db
      .select({ id: _usersTable.id, fullName: _usersTable.fullName, username: _usersTable.username })
      .from(_usersTable)
      .where(_eq(_usersTable.isActive, true));
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب قائمة المستخدمين" });
  }
});

// Log all successful mutations (create/update/delete) to activity_logs
router.use(activityLogger);

// المناصب (القبعات) — حراسة الحوكمة داخل الراوتر نفسه (المدير العام أو التنفيذي)
router.use("/positions", positionsRouter);

// النقل الموحّد ولوحة الأحمال — الحوكمة داخل الراوتر (تنفيذ للمديرين، طلبات للملاك)
router.use("/work-transfers", workTransfersRouter);

// ملفات الحالة (رحلة المناقصة/الممارسة) — الحوكمة داخل الراوتر حسب القبعات
router.use("/case-files", caseFilesRouter);

// الالتزامات المتجددة + مسيّر الرواتب — الحوكمة داخل الراوتر حسب القبعات
router.use("/obligations", obligationsRouter);

// المركز المالي — الأبواب الخمسة (الحوكمة داخل الراوتر حسب القبعات)
router.use("/financial-center", financialCenterRouter);

// Notifications — every authenticated user reads/marks-read only their own
router.use("/notifications", notificationsRouter);

// Tasks — mounted BEFORE requireEdit so employees without canEdit can still
// add notes and update status on their assigned tasks. The tasksRouter
// enforces its own ownership checks internally. Gated by accessTasks (default
// true for all existing users, so no access regresses for anyone today).
router.use("/tasks", requireModule("accessTasks"), tasksRouter);

// Practices — mounted BEFORE requireEdit so responsible employees can change
// status and upload files for their own practices. The practicesRouter
// enforces its own ownership checks on PATCH internally.
router.use("/practices", requireModule("accessTenders"), practicesRouter);

// ملاحظة: حارس canEdit العام للكتابة أُزيل — مصفوفة الصلاحيات في requireModule
// تفرض الآن إضافة/تعديل/حذف لكل وحدة على حدة بدقة أعلى (والمستخدمون القدامى
// بلا مصفوفة تُشتق مصفوفتهم من canEdit نفسها، فلا يتغير سلوكهم).

// Per-module routes — each protected by its own module access guard
router.use("/tenders", requireModule("accessTenders"), tendersRouter);
router.use("/government-entities", requireModule("accessEntities"), governmentEntitiesRouter);
// entityDirectoryRouter يعرّف عدة مسارات جذرية — الحارس يُطبق فقط على مساراته
// (تركيبه بلا مسار كان يفرض حارس "الجهات" على كل الوحدات التالية بالخطأ)
router.use((req, res, next) => {
  if (/^\/(departments|contacts|contact-methods|service-types|documents)(\/|$)/.test(req.path)) {
    return requireModule("accessEntities")(req, res, () => entityDirectoryRouter(req, res, next));
  }
  return entityDirectoryRouter(req, res, next);
});
router.use("/suppliers", requireModule("accessSuppliers"), suppliersRouter);
router.use("/rfq-requests", requireModule("accessRfq"), rfqRequestsRouter);
// غرفة السوق المحلي: أهل المشتريات (accessPo) وفريق البحث (accessResearch) — الخادم يقيد ما يرونه داخلها
router.use("/direct-purchase-orders", (req, res, next) => {
  if (req.session?.userId && hasModuleAction(req, "accessResearch", "view")) return directPurchaseOrdersRouter(req, res, next);
  return requireModule("accessPo")(req, res, () => directPurchaseOrdersRouter(req, res, next));
});
router.use("/projects", requireModule("accessProjects"), projectsRouter);
// سجل الكفالات: سياسته «المدراء الثلاثة حصرًا» محروسة داخل المسار نفسه —
// مصفوفة الوحدات لا تنطبق هنا (إدخالهم وتعديلهم اليدوي حق قبعة لا حق مصفوفة)
router.use("/bank-guarantees", (req, res, next) => {
  if (!req.session?.userId) return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
  return bankGuaranteesRouter(req, res, next);
});
router.use("/contracts", requireModule("accessContracts"), contractsRouter);
router.use("/transportation", requireModule("accessTransportation"), transportationRouter);
router.use("/vehicles", requireModule("accessTransportation"), vehiclesRouter);
router.use("/finance", requireModule("accessFinance"), financeRouter);
router.use("/cost-centers", requireModule("accessFinance"), costCentersRouter);
router.use("/pricing-book", requireModule("accessFinance"), pricingBookRouter);
router.use("/company-documents", requireModule("accessTenders"), companyDocumentsRouter);
router.use("/government-registrations", requireModule("accessTenders"), governmentRegistrationsRouter);
router.use("/competitors", requireModule("accessTenders"), competitorsRouter);
router.use("/bid-results", requireModule("accessTenders"), bidResultsRouter);
router.use("/analytics/competitors", requireModule("accessTenders"), competitorAnalyticsRouter);
router.use("/correspondence", requireModule("accessCorrespondence"), correspondenceRouter);
router.use("/correspondence-templates", requireModule("accessCorrespondence"), correspondenceTemplatesRouter);
router.use("/residency", requireModule("accessResidency"), residencyRouter);
// الصيانة: الفني المكلّف يستطيع تحديث أمر عمله (مرحلة/صور/مرفقات) وإصدار تقرير
// الزيارة له دون صلاحية تعديل عامة — هذان المساران يُبوَّبان بصلاحية العرض فقط
// والمسار نفسه يتحقق داخليًا من (صلاحية التعديل || كونه الفني المكلّف).
router.use("/maintenance", (req, res, next) => {
  const techOwnedPath =
    (req.method === "PATCH" && /^\/work-orders\/\d+$/.test(req.path)) ||
    (req.method === "POST" && /^\/work-orders\/\d+\/visit-report$/.test(req.path));
  if (techOwnedPath) {
    if (!req.session?.userId) return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
    if (req.session.role === "admin" || hasModuleAction(req, "accessMaintenance", "view")) return next();
    return res.status(403).json({ error: "ليس لديك صلاحية الوصول إلى هذه الوحدة." });
  }
  return requireModule("accessMaintenance")(req, res, next);
}, maintenanceRouter);
router.use("/maintenance-service", requireModule("accessMaintenance"), maintenanceServiceRouter);
// قناة الفريق (الرسائل) صارت في مركز العمليات — متاحة لكل مسجَّل؛
// ومركز المعرفة صار في ذكاء المنافسين — أهل المناقصات يصلونه؛ والباقي خلف accessResearch
router.use("/research", (req, res, next) => {
  if (req.path.startsWith("/messages")) {
    if (!req.session?.userId) return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
    return researchRouter(req, res, next);
  }
  if (req.path.startsWith("/knowledge") && req.session?.userId && hasModuleAction(req, "accessTenders", "view")) {
    return researchRouter(req, res, next);
  }
  return requireModule("accessResearch")(req, res, () => researchRouter(req, res, next));
});
// التسعير: مسارات العمل على ورقة قائمة (أصناف، أسعار، اعتماد، إعدادات، نسخ، حذف)
// تمرّ هنا بصلاحية العرض فقط، والمسارات نفسها تتحقق داخليًا من (مُنشئ الورقة ||
// صلاحية إضافة/تعديل بالمصفوفة). إنشاء ورقة جديدة مستقلة يبقى على صلاحية الإضافة.
router.use("/pricing", (req, res, next) => {
  const p = req.path;
  const ownerScoped =
    (req.method === "POST" && (
      /^\/sheets\/\d+\/(items|items\/bulk|duplicate)$/.test(p) ||
      /^\/items\/\d+\/duplicate$/.test(p)
    )) ||
    (req.method === "PATCH" && (/^\/sheets\/\d+$/.test(p) || /^\/items\/\d+$/.test(p))) ||
    (req.method === "DELETE" && (/^\/sheets\/\d+$/.test(p) || /^\/items\/\d+$/.test(p)));
  if (ownerScoped) {
    if (!req.session?.userId) return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
    if (req.session.role === "admin" || hasModuleAction(req, "accessPricing", "view")) return next();
    return res.status(403).json({ error: "ليس لديك صلاحية الوصول إلى هذه الوحدة." });
  }
  return requireModule("accessPricing")(req, res, next);
}, pricingRouter);
// قسم البحث والتسعير: مسارات العمل اليومي (استلام الفرصة، البنود، عروض الموردين،
// الملفات، انتقالات الحالة، ورقة التسعير وكتاب العرض) تمرّ هنا بصلاحية العرض فقط،
// والمسارات نفسها تتحقق داخليًا من (المستلم || صلاحية إضافة/تعديل بالمصفوفة ||
// دورَي التسعير/الاعتماد) — إنشاء فرصة جديدة وحذفها يبقيان على المصفوفة الكاملة.
router.use("/opportunities", (req, res, next) => {
  const p = req.path;
  const ownerScoped =
    (req.method === "POST" && (
      /^\/\d+\/(claim|items|files|create-pricing-sheet|build-quotation)$/.test(p) ||
      /^\/items\/\d+\/quotes$/.test(p) ||
      /^\/quotes\/\d+\/choose$/.test(p)
    )) ||
    ((req.method === "PATCH" || req.method === "DELETE") && /^\/(items|quotes|files)\/\d+$/.test(p)) ||
    (req.method === "PATCH" && /^\/\d+$/.test(p));
  if (ownerScoped) {
    if (!req.session?.userId) return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
    if (req.session.role === "admin" || hasModuleAction(req, "accessOpportunities", "view")) return next();
    return res.status(403).json({ error: "ليس لديك صلاحية الوصول إلى هذه الوحدة." });
  }
  return requireModule("accessOpportunities")(req, res, next);
}, opportunitiesRouter);
// حارس المهام يُطبق فقط على مسارات هذا الراوتر (وليس أي مسار غير معروف)
router.use(["/task-types", "/recurring-templates"], (req, res, next) =>
  requireModule("accessTasks")(req, res, next),
);
router.use(taskAutomationRouter); // /task-types, /recurring-templates

export default router;
