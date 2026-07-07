import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import activityLogsRouter from "./activity-logs";
import tendersRouter from "./tenders";
import governmentEntitiesRouter from "./government-entities";
import suppliersRouter from "./suppliers";
import rfqRequestsRouter from "./rfq-requests";
import directPurchaseOrdersRouter from "./direct-purchase-orders";
import projectsRouter from "./projects";
import bankGuaranteesRouter from "./bank-guarantees";
import contractsRouter from "./contracts";
import transportationRouter from "./transportation";
import financeRouter from "./finance";
import tasksRouter from "./tasks";
import practicesRouter from "./practices";
import { requireAuth, requireEdit, requireModule } from "../middleware/auth";
import { activityLogger } from "../middleware/activity-logger";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);
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

// Tasks — mounted BEFORE requireEdit so employees without canEdit can still
// add notes and update status on their assigned tasks. The tasksRouter
// enforces its own ownership checks internally.
router.use("/tasks", tasksRouter);

// Require canEdit for all mutation methods (POST/PUT/PATCH/DELETE)
router.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return requireEdit(req, res, next);
  }
  next();
});

// Per-module routes — each protected by its own module access guard
router.use("/tenders", requireModule("accessTenders"), tendersRouter);
router.use("/government-entities", requireModule("accessEntities"), governmentEntitiesRouter);
router.use("/suppliers", requireModule("accessSuppliers"), suppliersRouter);
router.use("/rfq-requests", requireModule("accessRfq"), rfqRequestsRouter);
router.use("/direct-purchase-orders", requireModule("accessPo"), directPurchaseOrdersRouter);
router.use("/projects", requireModule("accessProjects"), projectsRouter);
router.use("/bank-guarantees", requireModule("accessGuarantees"), bankGuaranteesRouter);
router.use("/contracts", requireModule("accessContracts"), contractsRouter);
router.use("/transportation", requireModule("accessTransportation"), transportationRouter);
router.use("/finance", requireModule("accessFinance"), financeRouter);
router.use("/practices", requireModule("accessTenders"), practicesRouter);

export default router;
