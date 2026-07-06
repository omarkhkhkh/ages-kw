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
