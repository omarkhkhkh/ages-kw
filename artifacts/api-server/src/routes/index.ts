import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tendersRouter from "./tenders";
import governmentEntitiesRouter from "./government-entities";
import suppliersRouter from "./suppliers";
import rfqRequestsRouter from "./rfq-requests";
import directPurchaseOrdersRouter from "./direct-purchase-orders";
import projectsRouter from "./projects";
import bankGuaranteesRouter from "./bank-guarantees";
import contractsRouter from "./contracts";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/tenders", tendersRouter);
router.use("/government-entities", governmentEntitiesRouter);
router.use("/suppliers", suppliersRouter);
router.use("/rfq-requests", rfqRequestsRouter);
router.use("/direct-purchase-orders", directPurchaseOrdersRouter);
router.use("/projects", projectsRouter);
router.use("/bank-guarantees", bankGuaranteesRouter);
router.use("/contracts", contractsRouter);

export default router;
