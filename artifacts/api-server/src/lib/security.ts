import { pool } from "@workspace/db";
import bcrypt from "bcryptjs";

/** إنهاء كل جلسات مستخدم فورًا — يُستدعى عند التعطيل/سحب القبعة/تغيير الصلاحيات/إعادة تعيين الكلمة.
    (كانت الثغرة: الموقوف يبقى داخلًا بجلسته حتى يخرج بنفسه) */
export async function killUserSessions(userId: number): Promise<void> {
  try {
    await pool.query(`DELETE FROM session WHERE (sess->>'userId')::int = $1`, [userId]);
  } catch (err) {
    console.error("killUserSessions failed", err);
  }
}

/** سياسة كلمة المرور: ٨ أحرف فأكثر وفيها حرف ورقم — تعيد رسالة الخطأ أو null */
export function passwordPolicyError(pw: string): string | null {
  if (!pw || pw.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
  if (!/[A-Za-z\u0600-\u06FF]/.test(pw)) return "كلمة المرور يجب أن تحتوي حرفًا واحدًا على الأقل";
  if (!/\d/.test(pw)) return "كلمة المرور يجب أن تحتوي رقمًا واحدًا على الأقل";
  return null;
}

/** حساب الأمان المستقل: أدمن مخصص لإدارة المستخدمين والأمان — منفصل عن حساب المدير العام اليومي.
    يُنشأ مرة واحدة عند الإقلاع بكلمة مؤقتة معروفة، والدخول الأول يجبر على استبدالها. */
export async function ensureSecurityAdmin(): Promise<void> {
  try {
    const { rows } = await pool.query(`SELECT id FROM users WHERE username = 'security' LIMIT 1`);
    if (rows.length) return;
    const hashed = await bcrypt.hash("Security@2026", 12);
    await pool.query(
      `INSERT INTO users (username, full_name, password, role, can_view, can_download, can_upload, can_edit, is_active, must_change_password, record_view_scope)
       VALUES ('security', 'مسؤول الأمان', $1, 'admin', true, true, true, true, true, true, 'all')`,
      [hashed]);
    console.log("🛡 أُنشئ حساب الأمان المستقل: security / Security@2026 — التغيير إجباري عند أول دخول");
  } catch (err) { console.error("ensureSecurityAdmin failed", err); }
}

/** تسجيل محاولة دخول (ناجحة/فاشلة) لسجل الإدارة */
export async function logLoginAttempt(username: string, success: boolean, ip?: string | null): Promise<void> {
  try {
    await pool.query(`INSERT INTO login_attempts (username, success, ip) VALUES ($1,$2,$3)`, [username.slice(0, 100), success, ip ?? null]);
  } catch { /* لا يوقف الدخول */ }
}
