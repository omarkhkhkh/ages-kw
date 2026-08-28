import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { killUserSessions } from "../lib/security";

/* ═══ المناصب (القبعات) — الخارطة الموحّدة، المرحلة ١ ═══
   القبعة حزمة صلاحيات جاهزة تُطبَّق على مصفوفة المستخدم القائمة:
   - أول قبعة تُضبط المصفوفة على حزمتها (القبعة تحدد ما يرى — لا اندماج مع افتراضيات قديمة).
   - القبعات اللاحقة تُدمج بالإضافة (اتحاد الحزم).
   - السحب يسحب ما كانت الحزمة تمنحه إلا ما تغطيه قبعة باقية؛ والتخصيص اليدوي فوق
     الحزم يبقى ممكنًا من شاشة المستخدمين كما هو.
   الحوكمة: القبعات الإدارية يمنحها المدير العام (admin) وحده؛ والتشغيلية هو أو حامل
   قبعة المدير التنفيذي. كل منح/سحب يُقيَّد في سجل دائم باسم فاعله. */

const router = Router();

const MODULE_KEYS = [
  "accessTenders", "accessEntities", "accessSuppliers", "accessProjects",
  "accessGuarantees", "accessContracts", "accessRfq", "accessPo", "accessTransportation", "accessFinance",
  "accessCorrespondence", "accessResidency", "accessMaintenance", "accessResearch", "accessPricing", "accessTasks",
  "accessOpportunities",
] as const;
type ModuleKey = typeof MODULE_KEYS[number];
type Actions = { view: boolean; add: boolean; edit: boolean; del: boolean };
type Matrix = Record<string, Actions>;

const A = (view = false, add = false, edit = false, del = false): Actions => ({ view, add, edit, del });
const FULL = A(true, true, true, true);
const RW = A(true, true, true, false);
const V = A(true, false, false, false);
const VA = A(true, true, false, false);

/** حزمة كل قبعة: ما لم يُذكر من الوحدات فهو محجوب (view:false) — قاعدة «ما لا تملكه لا تراه».
    ملاحظة درجات البيانات: المنافسون وذكاؤهم وجلسات الفض تحت accessTenders — لذلك لا تظهر
    الوحدة إلا في حزم المستشار والمديرين (الطبقة الاستخباراتية). */
const BUNDLES: Record<string, Partial<Record<ModuleKey, Actions>>> = {
  general_manager: Object.fromEntries(MODULE_KEYS.map((k) => [k, FULL])),
  executive_manager: Object.fromEntries(MODULE_KEYS.map((k) => [k, RW])),
  financial_manager: {
    accessFinance: RW, accessPricing: V, accessTenders: V, accessContracts: V,
    accessPo: V, accessMaintenance: V, accessTransportation: V, accessGuarantees: V,
    accessTasks: V, accessOpportunities: V, accessResidency: V,
  },
  consultant: {
    accessTenders: RW, accessOpportunities: RW, accessRfq: RW, accessPricing: RW,
    accessSuppliers: VA, accessEntities: V, accessContracts: V, accessGuarantees: V, accessTasks: VA,
  },
  researcher: {
    accessResearch: RW, accessSuppliers: VA, accessEntities: V, accessTasks: VA,
  },
  delegate: {
    accessCorrespondence: RW, accessEntities: V, accessSuppliers: VA, accessTasks: VA,
  },
  transport_worker: { accessTransportation: V, accessTasks: VA },
  maintenance_worker: { accessMaintenance: V, accessTasks: VA },
};

function emptyMatrix(): Matrix {
  const m: Matrix = {};
  for (const k of MODULE_KEYS) m[k] = A();
  return m;
}
function mergeInto(target: Matrix, bundle: Partial<Record<ModuleKey, Actions>>): Matrix {
  for (const k of MODULE_KEYS) {
    const b = bundle[k];
    if (!b) continue;
    target[k] = {
      view: target[k].view || b.view, add: target[k].add || b.add,
      edit: target[k].edit || b.edit, del: target[k].del || b.del,
    };
  }
  return target;
}
function unionOf(keys: string[]): Matrix {
  const m = emptyMatrix();
  for (const key of keys) if (BUNDLES[key]) mergeInto(m, BUNDLES[key]);
  return m;
}

async function positionsOfUser(userId: number): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT p.key FROM user_positions up JOIN positions p ON p.id = up.position_id WHERE up.user_id = $1 ORDER BY p.sort_order`,
    [userId]
  );
  return rows.map((r) => r.key as string);
}

/** حامل قبعة المدير التنفيذي — يُقرأ من القاعدة لا الجلسة حتى يسري المنح فورًا */
async function isExecutive(req: Request): Promise<boolean> {
  if (!req.session.userId) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM user_positions up JOIN positions p ON p.id = up.position_id
     WHERE up.user_id = $1 AND p.key = 'executive_manager' LIMIT 1`,
    [req.session.userId]
  );
  return rows.length > 0;
}

/** من يدير القبعات: المدير العام (admin) لأي درجة، والمدير التنفيذي للتشغيلية فقط */
async function canManage(req: Request, tier: string): Promise<boolean> {
  if (req.session.role === "admin") return true;
  if (tier === "تشغيلي") return isExecutive(req);
  return false;
}

/** تطبيق حالة القبعات على مصفوفة المستخدم وأعمدة accessX (العرض يقود القائمة الجانبية) */
async function applyMatrix(userId: number, matrix: Matrix): Promise<void> {
  const sets: string[] = [`permissions = $1`];
  const vals: any[] = [JSON.stringify(matrix)];
  const COL: Record<string, string> = {
    accessTenders: "access_tenders", accessEntities: "access_entities", accessSuppliers: "access_suppliers",
    accessProjects: "access_projects", accessGuarantees: "access_guarantees", accessContracts: "access_contracts",
    accessRfq: "access_rfq", accessPo: "access_po", accessTransportation: "access_transportation",
    accessFinance: "access_finance", accessCorrespondence: "access_correspondence", accessResidency: "access_residency",
    accessMaintenance: "access_maintenance", accessResearch: "access_research", accessPricing: "access_pricing",
    accessTasks: "access_tasks", accessOpportunities: "access_opportunities",
  };
  for (const k of MODULE_KEYS) { vals.push(matrix[k].view); sets.push(`${COL[k]} = $${vals.length}`); }
  vals.push(userId);
  await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${vals.length}`, vals);
}

// قائمة القبعات وحامليها — لمن يدير القبعات
router.get("/", async (req: Request, res: Response) => {
  if (!(await canManage(req, "تشغيلي"))) return res.status(403).json({ error: "إدارة القبعات للمدير العام أو التنفيذي" });
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.key, p.name_ar AS "nameAr", p.tier, p.description, p.sort_order AS "sortOrder",
              COALESCE(json_agg(json_build_object('userId', u.id, 'fullName', u.full_name, 'grantedAt', up.granted_at, 'expiresAt', up.expires_at))
                       FILTER (WHERE u.id IS NOT NULL), '[]') AS holders
       FROM positions p
       LEFT JOIN user_positions up ON up.position_id = p.id
       LEFT JOIN users u ON u.id = up.user_id
       GROUP BY p.id ORDER BY p.sort_order`
    );
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب القبعات" }); }
});

// قبعات مستخدم معيّن
router.get("/user/:id", async (req: Request, res: Response) => {
  if (!(await canManage(req, "تشغيلي"))) return res.status(403).json({ error: "إدارة القبعات للمدير العام أو التنفيذي" });
  try { return res.json({ positions: await positionsOfUser(Number(req.params.id)) }); }
  catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب قبعات المستخدم" }); }
});

// سجل المنح والسحب
router.get("/audit", async (req: Request, res: Response) => {
  if (!(await canManage(req, "تشغيلي"))) return res.status(403).json({ error: "إدارة القبعات للمدير العام أو التنفيذي" });
  try {
    const { rows } = await pool.query(
      `SELECT l.id, l.action, l.created_at AS "createdAt",
              p.name_ar AS "positionName", p.key AS "positionKey",
              tu.full_name AS "targetName", au.full_name AS "actorName"
       FROM position_audit_log l
       JOIN positions p ON p.id = l.position_id
       JOIN users tu ON tu.id = l.user_id
       LEFT JOIN users au ON au.id = l.actor_user_id
       ORDER BY l.id DESC LIMIT 200`
    );
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب السجل" }); }
});

// منح قبعة — أول قبعة تضبط المصفوفة على حزمتها، واللاحقة تُدمج بالإضافة
router.post("/grant", async (req: Request, res: Response) => {
  const userId = Number(req.body?.userId);
  const positionKey = String(req.body?.positionKey ?? "");
  if (!userId || !BUNDLES[positionKey]) return res.status(400).json({ error: "المستخدم والقبعة مطلوبان" });
  const client = await pool.connect();
  try {
    const { rows: pr } = await client.query(`SELECT id, tier, name_ar FROM positions WHERE key = $1`, [positionKey]);
    if (!pr.length) return res.status(404).json({ error: "القبعة غير معرّفة" });
    if (!(await canManage(req, pr[0].tier))) {
      return res.status(403).json({ error: pr[0].tier === "إداري" ? "القبعات الإدارية يمنحها المدير العام وحده" : "منح القبعات للمدير العام أو التنفيذي" });
    }
    const { rows: ur } = await client.query(`SELECT id FROM users WHERE id = $1 AND is_active = true`, [userId]);
    if (!ur.length) return res.status(404).json({ error: "المستخدم غير موجود أو موقوف" });

    const before = await positionsOfUser(userId);
    await client.query("BEGIN");
    // الإنابة المؤقتة: تاريخ انتهاء اختياري — تسقط تلقائيًا في موعدها
    const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.expiresAt ?? "")) ? String(req.body.expiresAt) : null;
    const ins = await client.query(
      `INSERT INTO user_positions (user_id, position_id, granted_by, expires_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, position_id) DO NOTHING RETURNING id`,
      [userId, pr[0].id, req.session.userId ?? null, expiresAt]
    );
    if (!ins.rows.length) { await client.query("ROLLBACK"); return res.status(409).json({ error: "المستخدم يحمل هذه القبعة بالفعل" }); }
    await client.query(
      `INSERT INTO position_audit_log (action, user_id, position_id, actor_user_id) VALUES ('منح',$1,$2,$3)`,
      [userId, pr[0].id, req.session.userId ?? null]
    );
    await client.query("COMMIT");

    // خارج المعاملة: تطبيق الصلاحيات (أول قبعة = ضبط، غير ذلك = اتحاد الحزم كلها)
    const after = [...before, positionKey];
    await applyMatrix(userId, unionOf(after));
    // القبعة الجديدة تعمل فورًا: جلساته القديمة بصلاحيات قديمة تُنهى
    await killUserSessions(userId);
    return res.status(201).json({ ok: true, positions: after, reset: before.length === 0 });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* قد لا تكون بدأت */ }
    console.error(e); return res.status(500).json({ error: "فشل منح القبعة" });
  } finally { client.release(); }
});

// سحب قبعة — الصلاحيات تُعاد لاتحاد حزم القبعات الباقية
router.post("/revoke", async (req: Request, res: Response) => {
  const userId = Number(req.body?.userId);
  const positionKey = String(req.body?.positionKey ?? "");
  if (!userId || !positionKey) return res.status(400).json({ error: "المستخدم والقبعة مطلوبان" });
  const client = await pool.connect();
  try {
    const { rows: pr } = await client.query(`SELECT id, tier FROM positions WHERE key = $1`, [positionKey]);
    if (!pr.length) return res.status(404).json({ error: "القبعة غير معرّفة" });
    if (!(await canManage(req, pr[0].tier))) {
      return res.status(403).json({ error: pr[0].tier === "إداري" ? "القبعات الإدارية يسحبها المدير العام وحده" : "سحب القبعات للمدير العام أو التنفيذي" });
    }
    await client.query("BEGIN");
    const del = await client.query(
      `DELETE FROM user_positions WHERE user_id = $1 AND position_id = $2 RETURNING id`,
      [userId, pr[0].id]
    );
    if (!del.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "المستخدم لا يحمل هذه القبعة" }); }
    await client.query(
      `INSERT INTO position_audit_log (action, user_id, position_id, actor_user_id) VALUES ('سحب',$1,$2,$3)`,
      [userId, pr[0].id, req.session.userId ?? null]
    );
    await client.query("COMMIT");

    const remaining = await positionsOfUser(userId);
    if (remaining.length) await applyMatrix(userId, unionOf(remaining));
    // سد الثغرة: المسحوبة قبعته لا يبقى داخلًا بصلاحياتها
    await killUserSessions(userId);
    // آخر قبعة سُحبت: تُترك المصفوفة كما هي — إدارة صلاحياته تعود يدوية بالكامل من شاشة المستخدمين
    return res.json({ ok: true, positions: remaining });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* قد لا تكون بدأت */ }
    console.error(e); return res.status(500).json({ error: "فشل سحب القبعة" });
  } finally { client.release(); }
});

// حزم القبعات للواجهة — لعرض «الفرق عن الحزمة» بالألوان في مصفوفة الصلاحيات
router.get("/bundles", (_req: Request, res: Response) => {
  res.json(BUNDLES);
});

/** كنس الإنابات المنتهية: القبعة المؤقتة تسقط تلقائيًا في موعدها — بقيد في السجل وإعادة حساب الصلاحيات */
export async function revokeExpiredPositions(): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT up.user_id AS uid, up.position_id AS pid, p.key
       FROM user_positions up JOIN positions p ON p.id = up.position_id
       WHERE up.expires_at IS NOT NULL AND up.expires_at < CURRENT_DATE`);
    for (const r of rows) {
      await pool.query(`DELETE FROM user_positions WHERE user_id = $1 AND position_id = $2`, [r.uid, r.pid]);
      await pool.query(
        `INSERT INTO position_audit_log (action, user_id, position_id, actor_user_id) VALUES ('سحب', $1, $2, NULL)`,
        [r.uid, r.pid]);
      const remainingKeys = await positionsOfUser(r.uid);
      if (remainingKeys.length) await applyMatrix(r.uid, unionOf(remainingKeys));
      await killUserSessions(r.uid);
      console.log(`⏳ انتهت إنابة ${r.key} للمستخدم #${r.uid} — سُحبت تلقائيًا`);
    }
  } catch (err) { console.error("revokeExpiredPositions failed", err); }
}

export { positionsOfUser };
export default router;
