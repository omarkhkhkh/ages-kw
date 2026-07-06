import { Request, Response, NextFunction } from "express";

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

// Factory: create middleware that checks access to a specific module
export function requireModule(field: keyof Pick<Express.Request["session"], 
  "accessTenders" | "accessEntities" | "accessSuppliers" | "accessProjects" |
  "accessGuarantees" | "accessContracts" | "accessRfq" | "accessPo"
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
      res.status(403).json({ error: "ليس لديك صلاحية الوصول إلى هذه الوحدة." });
      return;
    }
    next();
  };
}
