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
    // مصفوفة الصلاحيات الدقيقة { accessX: { view, add, edit, del } }
    permissions: Record<string, ModuleActions>;
    // خصوصية السجلات الرئيسية: 'own' | 'all'
    recordViewScope: string;
  }
}

export interface ModuleActions { view: boolean; add: boolean; edit: boolean; del: boolean }

/** يشتق مصفوفة افتراضية من الأعمدة القديمة (accessX + canEdit) — للتوافق مع
 *  المستخدمين/الجلسات التي لم تُضبط لها المصفوفة بعد. */
export function synthesizePermissions(src: Record<string, any>): Record<string, ModuleActions> {
  const canWrite = !!src.canEdit;
  const out: Record<string, ModuleActions> = {};
  for (const field of Object.keys(MODULE_LABELS)) {
    const hasAccess = src[field] ?? true;
    out[field] = { view: !!hasAccess, add: !!hasAccess && canWrite, edit: !!hasAccess && canWrite, del: !!hasAccess && canWrite };
  }
  return out;
}

const METHOD_ACTION: Record<string, keyof ModuleActions> = {
  GET: "view", HEAD: "view", POST: "add", PATCH: "edit", PUT: "edit", DELETE: "del",
};
const ACTION_LABELS: Record<string, string> = { view: "العرض", add: "الإضافة", edit: "التعديل", del: "الحذف" };

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

// Factory: middleware يفرض مصفوفة الصلاحيات الدقيقة على مستوى الوحدة كاملة —
// نوع الطلب يحدد الصلاحية المطلوبة تلقائيًا (GET=عرض, POST=إضافة, PATCH/PUT=تعديل, DELETE=حذف).
// المدير يتجاوز كل القيود دائمًا. المحاولات المرفوضة تُسجَّل في سجل الحركات.
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

    const matrix = req.session.permissions ?? synthesizePermissions(req.session as any);
    const actions = matrix[field] ?? { view: false, add: false, edit: false, del: false };
    const action = METHOD_ACTION[req.method] ?? "view";

    if (!actions[action]) {
      const moduleName = MODULE_LABELS[field] ?? field;
      const moduleKey  = MODULE_KEY_MAP[field] ?? field;

      // Log the blocked attempt so admin can see it in activity log
      logActivity({
        userId:   req.session.userId,
        username: req.session.username ?? "",
        fullName: req.session.fullName ?? "",
        action:   "access_denied",
        module:   moduleKey,
        details:  `محاولة ${ACTION_LABELS[action]} في: ${moduleName}`,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || undefined,
      }).catch(() => {});

      res.status(403).json({
        error: actions.view
          ? `ليس لديك صلاحية ${ACTION_LABELS[action]} في وحدة ${moduleName}.`
          : "ليس لديك صلاحية الوصول إلى هذه الوحدة.",
      });
      return;
    }
    next();
  };
}

/** خصوصية السجلات الرئيسية: هل يجب حصر النتائج بسجلات المستخدم نفسه؟
 *  (السجلات القديمة بلا منشئ معروف تبقى مرئية للجميع) */
export function ownRecordsOnly(req: Request): boolean {
  return req.session.role !== "admin" && (req.session.recordViewScope ?? "own") === "own";
}
