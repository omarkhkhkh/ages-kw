import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import tendersRouter from "./tenders";
import governmentEntitiesRouter from "./government-entities";
import suppliersRouter from "./suppliers";
import rfqRequestsRouter from "./rfq-requests";
import directPurchaseOrdersRouter from "./direct-purchase-orders";
import projectsRouter from "./projects";
import bankGuaranteesRouter from "./bank-guarantees";
import contractsRouter from "./contracts";
import { requireAuth, requireEdit } from "../middleware/auth";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);
router.use("/auth", authRouter);

// Admin routes (admin-only check is inside adminRouter)
router.use("/admin", adminRouter);

// Protected routes — require valid session
router.use(requireAuth);

// For all mutation methods (POST/PUT/PATCH/DELETE) require canEdit or admin role
router.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return requireEdit(req, res, next);
  }
  next();
});

router.use("/tenders", tendersRouter);
router.use("/government-entities", governmentEntitiesRouter);
router.use("/suppliers", suppliersRouter);
router.use("/rfq-requests", rfqRequestsRouter);
router.use("/direct-purchase-orders", directPurchaseOrdersRouter);
router.use("/projects", projectsRouter);
router.use("/bank-guarantees", bankGuaranteesRouter);
router.use("/contracts", contractsRouter);

export default router;
