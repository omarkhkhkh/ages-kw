import { Request, Response, NextFunction } from "express";
import { logActivity } from "./activity-logger";

declare module "express-session" {
  interface SessionData {
    userId: number;
    username: string;
    fullName: string;
    role: string;
    canView: boolean;
    canDownload: boolean;
    canUpload: boolean;
    canEdit: boolean;
    // Per-module access
    accessTenders: boolean;
    accessEntities: boolean;
    accessSuppliers: boolean;
    accessProjects: boolean;
    accessGuarantees: boolean;
    accessContracts: boolean;
    accessRfq: boolean;
    accessPo: boolean;
    accessTransportation: boolean;
    accessFinance: boolean;
    accessCorrespondence: boolean;
    accessResidency: boolean;
    accessMaintenance: boolean;
    accessResearch: boolean;
    accessPricing: boolean;
    accessTasks: boolean;
    taskViewScope: string;
    correspondenceViewAll: boolean;
    taskCanApprove: boolean;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
    return;
  }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "ممنوع. هذه الصفحة للمدير فقط." });
    return;
  }
  next();
}

export function requireEdit(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
    return;
  }
  if (req.session.role !== "admin" && !req.session.canEdit) {
    res.status(403).json({ error: "ليس لديك صلاحية التعديل." });
    return;
  }
  next();
}

const MODULE_LABELS: Record<string, string> = {
  accessTenders:        "المناقصات",
  accessEntities:       "الجهات الحكومية",
  accessSuppliers:      "الموردون",
  accessProjects:       "المشاريع",
  accessGuarantees:     "الكفالات البنكية",
  accessContracts:      "العقود",
  accessRfq:            "طلبات عروض الأسعار",
  accessPo:             "أوامر الشراء المباشر",
  accessTransportation: "النقل والتوزيع",
  accessFinance:        "الإدارة المالية",
  accessCorrespondence: "المراسلات",
  accessResidency:      "إدارة الإقامات",
  accessMaintenance:    "إدارة الصيانة",
  accessResearch:       "البحث والتطوير",
  accessPricing:        "التسعير",
  accessTasks:          "المهام / مركز العمليات",
};

const MODULE_KEY_MAP: Record<string, string> = {
  accessTenders:        "tenders",
  accessEntities:       "entities",
  accessSuppliers:      "suppliers",
  accessProjects:       "projects",
  accessGuarantees:     "guarantees",
  accessContracts:      "contracts",
  accessRfq:            "rfq",
  accessPo:             "po",
  accessTransportation: "transportation",
  accessFinance:        "finance",
  accessCorrespondence: "correspondence",
  accessResidency:      "residency",
  accessMaintenance:    "maintenance",
  accessResearch:       "research",
  accessPricing:        "pricing",
  accessTasks:          "tasks",
};

// Factory: creates middleware that checks session access to a specific module.
// Admins bypass all module restrictions. Blocked attempts are logged to activity_logs.
export function requireModule(field: keyof Pick<Express.Request["session"],
  "accessTenders" | "accessEntities" | "accessSuppliers" | "accessProjects" |
  "accessGuarantees" | "accessContracts" | "accessRfq" | "accessPo" | "accessTransportation" | "accessFinance" |
  "accessCorrespondence" | "accessResidency" | "accessMaintenance" | "accessResearch" | "accessPricing" | "accessTasks"
>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
      return;
    }
    // Admins bypass module restrictions
    if (req.session.role === "admin") {
      next();
      return;
    }
    if (!req.session[field]) {
      const moduleName = MODULE_LABELS[field] ?? field;
      const moduleKey  = MODULE_KEY_MAP[field] ?? field;

      // Log the blocked attempt so admin can see it in activity log
      logActivity({
        userId:   req.session.userId,
        username: req.session.username ?? "",
        fullName: req.session.fullName ?? "",
        action:   "access_denied",
        module:   moduleKey,
        details:  `محاولة الوصول إلى: ${moduleName}`,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || undefined,
      }).catch(() => {});

      res.status(403).json({ error: "ليس لديك صلاحية الوصول إلى هذه الوحدة." });
      return;
    }
    next();
  };
}
