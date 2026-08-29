import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";

/* ═══ غرفة القيادة — ملخص الشاشة الرئيسية بطلب واحد ═══
   ① ينتظر قرارك  ② نبض الشركة  ③ أجندة الأسبوع  ④ آخر الحركة
   الحوكمة: الشاشة للمديرين (أدمن/مدير عام/تنفيذي/مالي)؛ أرقام المال للعام والمالي فقط. */

const router = Router();

async function hats(userId: number | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const { rows } = await pool.query(
    `SELECT p.key FROM user_positions up JOIN positions p ON p.id = up.position_id WHERE up.user_id = $1`,
    [userId]);
  return new Set(rows.map((r: any) => r.key));
}

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const h = await hats(req.session.userId);
    const isAdmin = req.session.role === "admin";
    const isGM = isAdmin || h.has("general_manager");
    const isCFO = h.has("financial_manager");
    const isExec = h.has("executive_manager");
    if (!isGM && !isCFO && !isExec)
      return res.status(403).json({ error: "غرفة القيادة للمديرين" });

    const q = (sql: string, params: any[] = []) => pool.query(sql, params).then(r => r.rows);

    const [
      pendingCaseFiles, resetRequests, bidsClosing, expiredRow,
      pulseRow, moneyRow, agenda, activity,
    ] = await Promise.all([
      /* ① ملفات بانتظار الاعتماد — قرار المدير العام */
      isGM ? q(
        `SELECT cf.id, cf.entity_type AS "entityType",
                COALESCE(t.project_name, pr.project_name, 'ملف #' || cf.id) AS title,
                to_char(cf.submitted_at, 'YYYY-MM-DD') AS "submittedAt"
           FROM case_files cf
           LEFT JOIN tenders   t  ON cf.entity_type = 'tender'   AND t.id  = cf.entity_id
           LEFT JOIN practices pr ON cf.entity_type = 'practice' AND pr.id = cf.entity_id
          WHERE cf.status = 'بانتظار الاعتماد'
          ORDER BY cf.submitted_at ASC NULLS LAST LIMIT 8`) : [],

      /* ① طلبات إعادة تعيين كلمة المرور خلال أسبوع — أدمن/مدير عام */
      isGM ? q(
        `SELECT username, to_char(created_at, 'YYYY-MM-DD HH24:MI') AS at
           FROM password_reset_requests
          WHERE created_at > now() - interval '7 days'
          ORDER BY created_at DESC LIMIT 5`) : [],

      /* ① عطاءات شراء آخر موعدها ≤ ٣ أيام ولم نقرر */
      q(`SELECT id, order_number AS "orderNumber", description AS title,
                to_char(bid_deadline, 'YYYY-MM-DD') AS deadline
           FROM direct_purchase_orders
          WHERE award_result = 'بانتظار النتيجة' AND bid_deadline IS NOT NULL
            AND bid_deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + 3
          ORDER BY bid_deadline LIMIT 8`),

      /* ① المنتهي فعلًا: كفالات + وثائق شركة + اشتراكات حكومية */
      q(`SELECT
           (SELECT COUNT(*) FROM bank_guarantees WHERE status = 'active' AND expiry_date < CURRENT_DATE)::int AS guarantees,
           (SELECT COUNT(*) FROM company_documents WHERE expiry_date < CURRENT_DATE)::int AS docs,
           (SELECT COUNT(*) FROM government_registrations WHERE expiry_date < CURRENT_DATE)::int AS regs`),

      /* ② نبض الشركة — الأعمال والالتزامات والتشغيل */
      q(`SELECT
           (SELECT COUNT(*) FROM direct_purchase_orders WHERE award_result = 'بانتظار النتيجة')::int AS "openBids",
           (SELECT COUNT(*) FROM bank_guarantees WHERE status = 'active'
              AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60)::int AS "guarantees60",
           (SELECT COUNT(*) FROM contracts WHERE status = 'active'
              AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60)::int AS "contracts60",
           (SELECT COUNT(*) FROM workers
              WHERE residency_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + 60)::int AS "residency60",
           (SELECT COUNT(*) FROM tasks WHERE status IN ('pending','in_progress')
              AND due_date IS NOT NULL AND due_date::timestamp < now())::int AS "overdueTasks",
           (SELECT COUNT(*) FROM maintenance_work_orders WHERE stage NOT IN ('closed','completed'))::int AS "openWorkOrders",
           (SELECT COUNT(*) FROM case_files WHERE status IN ('مفتوح','قيد العمل'))::int AS "activeCaseFiles"`),

      /* ② المال — للمدير العام والمالي فقط */
      (isGM || isCFO) ? q(
        `SELECT
           (SELECT COALESCE(SUM(amount),0) FROM finance_expenses
             WHERE date_trunc('month', COALESCE(transaction_date, created_at::date)) = date_trunc('month', CURRENT_DATE))::numeric AS "monthExpense",
           (SELECT COALESCE(SUM(target_amount),0) FROM cost_center_budgets
             WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)::int AND month = EXTRACT(MONTH FROM CURRENT_DATE)::int)::numeric AS "monthBudget",
           (SELECT COALESCE(SUM(amount),0) FROM finance_expenses WHERE status = 'pending')::numeric AS "pendingExpenses",
           ((SELECT COALESCE(SUM(amount),0) FROM finance_income)
            - (SELECT COALESCE(SUM(amount),0) FROM finance_expenses WHERE status = 'paid'))::numeric AS cash`) : [],

      /* ③ أجندة الأسبوع — كل المواعيد خلال ٧ أيام */
      q(`SELECT * FROM (
             SELECT to_char(deadline,'YYYY-MM-DD') AS d, 'مناقصة' AS kind, project_name AS title,
                    '/tenders/' || id AS href
               FROM tenders WHERE deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
           UNION ALL
             SELECT to_char(deadline,'YYYY-MM-DD'), 'ممارسة', project_name, '/practices/' || id
               FROM practices WHERE deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
           UNION ALL
             SELECT to_char(bid_deadline,'YYYY-MM-DD'), 'عطاء شراء',
                    COALESCE(description, order_number), '/purchase-orders'
               FROM direct_purchase_orders
              WHERE award_result = 'بانتظار النتيجة'
                AND bid_deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
           UNION ALL
             SELECT to_char(expiry_date,'YYYY-MM-DD'), 'كفالة تنتهي',
                    COALESCE(NULLIF(concat_ws(' — ', type, guarantee_number), ''), 'كفالة'), '/guarantees'
               FROM bank_guarantees
              WHERE status = 'active' AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
           UNION ALL
             SELECT to_char(end_date,'YYYY-MM-DD'), 'عقد ينتهي',
                    'عقد ' || contract_number, '/contracts'
               FROM contracts
              WHERE status = 'active' AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
           UNION ALL
             SELECT to_char(deadline_date,'YYYY-MM-DD'), 'رد على خطاب', subject, '/correspondence'
               FROM correspondence_letters
              WHERE status NOT IN ('closed','cancelled')
                AND deadline_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
         ) x ORDER BY d ASC LIMIT 24`),

      /* ④ آخر الحركة: أحداث الملفات + سجل العمليات */
      q(`SELECT * FROM (
             SELECT e.created_at AS at, u.full_name AS actor, 'case' AS src,
                    e.event AS action, NULL AS module,
                    COALESCE(t.project_name, pr.project_name, 'ملف #' || cf.id) AS subject
               FROM case_file_events e
               JOIN case_files cf ON cf.id = e.case_file_id
               LEFT JOIN users u  ON u.id = e.actor_user_id
               LEFT JOIN tenders   t  ON cf.entity_type = 'tender'   AND t.id  = cf.entity_id
               LEFT JOIN practices pr ON cf.entity_type = 'practice' AND pr.id = cf.entity_id
           UNION ALL
             SELECT created_at, full_name, 'log', action, module, NULL
               FROM activity_logs
              WHERE action IN ('create','update','delete') AND module IS NOT NULL
         ) x ORDER BY at DESC LIMIT 12`),
    ]);

    const money = (moneyRow as any[])[0] ?? null;
    return res.json({
      role: { isGM, isCFO, isExec },
      decisions: {
        pendingCaseFiles,
        resetRequests,
        bidsClosing,
        expired: (expiredRow as any[])[0] ?? { guarantees: 0, docs: 0, regs: 0 },
      },
      pulse: {
        ...((pulseRow as any[])[0] ?? {}),
        money: money && {
          monthExpense: Number(money.monthExpense),
          monthBudget: Number(money.monthBudget),
          pendingExpenses: Number(money.pendingExpenses),
          cash: Number(money.cash),
        },
      },
      agenda,
      activity: (activity as any[]).map(a => ({
        at: a.at, actor: a.actor, src: a.src, action: a.action,
        module: a.module, subject: a.subject,
      })),
    });
  } catch (err) {
    console.error("dashboard summary error:", err);
    return res.status(500).json({ error: "فشل في تجميع ملخص الشاشة الرئيسية" });
  }
});

export default router;
