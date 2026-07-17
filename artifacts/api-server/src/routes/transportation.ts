import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  pool,
  transportationTable,
  insertTransportationSchema,
  updateTransportationSchema,
  suppliersTable,
  contractsTable,
  transportTeamsTable,
  transportTeamMembersTable,
  transportTasksTable,
  insertTransportationBudgetSchema,
} from "@workspace/db";
import { insertAutomationTask } from "./task-automation";

const router = Router();

/* ══════════════════════════════════════════════════════════════════
   IMPORTANT: All static routes (/teams, /tasks, etc.) MUST be
   registered BEFORE dynamic routes (/:id) to prevent Express from
   swallowing "teams"/"tasks" as an :id parameter.
══════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════
   TRANSPORTATION ORDERS — STATIC
══════════════════════════════════════ */

// GET /transportation/ — list orders
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const base = db
      .select({
        id: transportationTable.id,
        orderNumber: transportationTable.orderNumber,
        supplierId: transportationTable.supplierId,
        contractId: transportationTable.contractId,
        description: transportationTable.description,
        origin: transportationTable.origin,
        destination: transportationTable.destination,
        orderDate: transportationTable.orderDate,
        deliveryDate: transportationTable.deliveryDate,
        value: transportationTable.value,
        status: transportationTable.status,
        vehicleInfo: transportationTable.vehicleInfo,
        notes: transportationTable.notes,
        actualDeliveryDate: transportationTable.actualDeliveryDate,
        completionNotes: transportationTable.completionNotes,
        createdAt: transportationTable.createdAt,
        updatedAt: transportationTable.updatedAt,
        supplierName: suppliersTable.name,
        contractNumber: contractsTable.contractNumber,
      })
      .from(transportationTable)
      .leftJoin(suppliersTable, eq(transportationTable.supplierId, suppliersTable.id))
      .leftJoin(contractsTable, eq(transportationTable.contractId, contractsTable.id));

    const results = status
      ? await base.where(eq(transportationTable.status, status as string))
      : await base;

    return res.json(results);
  } catch {
    return res.status(500).json({ error: "فشل في جلب أوامر النقل" });
  }
});

// POST /transportation/ — create order
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertTransportationSchema.parse(req.body);
    const [row] = await db.insert(transportationTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء أمر النقل" });
  }
});

/* ══════════════════════════════════════
   TEAMS — all static paths first
══════════════════════════════════════ */

// GET /transportation/teams — list all teams with member count
router.get("/teams", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        t.id, t.name, t.description, t.color, t.created_at AS "createdAt",
        COUNT(m.id)::int AS "memberCount"
      FROM transport_teams t
      LEFT JOIN transport_team_members m ON m.team_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الفرق" });
  }
});

// POST /transportation/teams — create team
router.post("/teams", async (req: Request, res: Response) => {
  try {
    const { name, description, color } = req.body as any;
    if (!name?.trim()) return res.status(400).json({ error: "اسم الفريق مطلوب" });
    const [team] = await db.insert(transportTeamsTable)
      .values({ name: name.trim(), description: description || null, color: color || "#D4A534" })
      .returning();
    return res.status(201).json(team);
  } catch {
    return res.status(500).json({ error: "فشل في إنشاء الفريق" });
  }
});

// GET /transportation/teams/:id/members — list members (before PATCH/DELETE /teams/:id)
router.get("/teams/:id/members", async (req: Request, res: Response) => {
  try {
    const teamId = Number(req.params.id);
    const { rows } = await pool.query(`
      SELECT m.id, m.user_id AS "userId", m.joined_at AS "joinedAt",
             u.full_name AS "fullName", u.username
      FROM transport_team_members m
      JOIN users u ON u.id = m.user_id
      WHERE m.team_id = $1
      ORDER BY m.joined_at ASC
    `, [teamId]);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب أعضاء الفريق" });
  }
});

// POST /transportation/teams/:id/members — add member
router.post("/teams/:id/members", async (req: Request, res: Response) => {
  try {
    const teamId = Number(req.params.id);
    const { userId } = req.body as any;
    if (!userId) return res.status(400).json({ error: "userId مطلوب" });
    // Handle duplicate silently
    const { rows } = await pool.query(
      `INSERT INTO transport_team_members (team_id, user_id) VALUES ($1, $2)
       ON CONFLICT (team_id, user_id) DO NOTHING RETURNING *`,
      [teamId, Number(userId)]
    );
    return res.status(rows.length ? 201 : 200).json(rows[0] ?? { teamId, userId });
  } catch {
    return res.status(500).json({ error: "فشل في إضافة العضو" });
  }
});

// DELETE /transportation/teams/:id/members/:userId — admin only
router.delete("/teams/:id/members/:userId", async (req: Request, res: Response) => {
  if (req.session.role !== "admin") return res.status(403).json({ error: "إزالة الأعضاء للمدير فقط" });
  try {
    const teamId = Number(req.params.id);
    const userId = Number(req.params.userId);
    await db.delete(transportTeamMembersTable)
      .where(and(eq(transportTeamMembersTable.teamId, teamId), eq(transportTeamMembersTable.userId, userId)));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في إزالة العضو" });
  }
});

// PATCH /transportation/teams/:id — update team
router.patch("/teams/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, description, color } = req.body as any;
    const [team] = await db.update(transportTeamsTable)
      .set({ name, description, color, updatedAt: new Date() })
      .where(eq(transportTeamsTable.id, id))
      .returning();
    if (!team) return res.status(404).json({ error: "الفريق غير موجود" });
    return res.json(team);
  } catch {
    return res.status(500).json({ error: "فشل في تحديث الفريق" });
  }
});

// DELETE /transportation/teams/:id — admin only
router.delete("/teams/:id", async (req: Request, res: Response) => {
  if (req.session.role !== "admin") return res.status(403).json({ error: "حذف الفريق للمدير فقط" });
  try {
    const id = Number(req.params.id);
    await db.delete(transportTeamsTable).where(eq(transportTeamsTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الفريق" });
  }
});

/* ══════════════════════════════════════
   TASKS — all static paths first
══════════════════════════════════════ */

// GET /transportation/tasks — list all tasks
router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const { date, teamId } = req.query;
    let q = `
      SELECT
        tk.id, tk.team_id AS "teamId", tk.title, tk.description,
        tk.due_date AS "dueDate", tk.due_time AS "dueTime",
        tk.status, tk.notes, tk.assigned_to AS "assignedTo",
        tk.created_by AS "createdBy", tk.created_at AS "createdAt", tk.updated_at AS "updatedAt",
        u.full_name AS "assignedToName",
        t.name AS "teamName", t.color AS "teamColor"
      FROM transport_tasks tk
      LEFT JOIN users u ON u.id = tk.assigned_to
      LEFT JOIN transport_teams t ON t.id = tk.team_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (date)   { params.push(date);          q += ` AND tk.due_date = $${params.length}`; }
    if (teamId) { params.push(Number(teamId)); q += ` AND tk.team_id = $${params.length}`; }
    q += " ORDER BY tk.due_date ASC NULLS LAST, tk.due_time ASC NULLS LAST, tk.created_at ASC";
    const { rows } = await pool.query(q, params);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب المهام" });
  }
});

// POST /transportation/tasks — any canEdit user
router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const { teamId, title, description, dueDate, dueTime, status, notes, assignedTo } = req.body as any;
    if (!title?.trim()) return res.status(400).json({ error: "عنوان المهمة مطلوب" });
    const [task] = await db.insert(transportTasksTable).values({
      teamId:     teamId     ? Number(teamId)     : null,
      title:      title.trim(),
      description: description || null,
      dueDate:    dueDate    || null,
      dueTime:    dueTime    || null,
      status:     status     || "pending",
      notes:      notes      || null,
      assignedTo: assignedTo ? Number(assignedTo) : null,
      createdBy:  req.session.userId!,
    }).returning();
    return res.status(201).json(task);
  } catch {
    return res.status(500).json({ error: "فشل في إنشاء المهمة" });
  }
});

// PATCH /transportation/tasks/:id — any canEdit user
router.patch("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { title, description, dueDate, dueTime, status, notes, assignedTo, teamId } = req.body as any;
    const updates: any = { updatedAt: new Date() };
    if (title       !== undefined) updates.title       = title;
    if (description !== undefined) updates.description = description;
    if (dueDate     !== undefined) updates.dueDate     = dueDate  || null;
    if (dueTime     !== undefined) updates.dueTime     = dueTime  || null;
    if (status      !== undefined) updates.status      = status;
    if (notes       !== undefined) updates.notes       = notes;
    if (assignedTo  !== undefined) updates.assignedTo  = assignedTo ? Number(assignedTo) : null;
    if (teamId      !== undefined) updates.teamId      = teamId    ? Number(teamId)      : null;
    const [task] = await db.update(transportTasksTable).set(updates).where(eq(transportTasksTable.id, id)).returning();
    if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });
    return res.json(task);
  } catch {
    return res.status(500).json({ error: "فشل في تحديث المهمة" });
  }
});

// DELETE /transportation/tasks/:id — admin only
router.delete("/tasks/:id", async (req: Request, res: Response) => {
  if (req.session.role !== "admin") return res.status(403).json({ error: "حذف المهام للمدير فقط" });
  try {
    const id = Number(req.params.id);
    await db.delete(transportTasksTable).where(eq(transportTasksTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف المهمة" });
  }
});

/* ══════════════════════════════════════
   GPS LOCATION UPDATE — static path, before /:id
══════════════════════════════════════ */

// PATCH /transportation/:id/location — update truck GPS (any canEdit user)
router.patch("/:id/location", async (req: Request, res: Response) => {
  try {
    const id  = Number(req.params.id);
    const { lat, lng } = req.body as any;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "lat و lng مطلوبان" });
    }
    const [row] = await db
      .update(transportationTable)
      .set({ lat: String(lat), lng: String(lng), locationUpdatedAt: new Date(), updatedAt: new Date() })
      .where(eq(transportationTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "أمر النقل غير موجود" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في تحديث الموقع" });
  }
});

/* ══════════════════════════════════════
   ORDER COMPLETION — static path, before /:id
══════════════════════════════════════ */

// PATCH /transportation/:id/complete — mark an order delivered with an actual
// delivery date + optional completion notes (distinct from the planned deliveryDate)
router.patch("/:id/complete", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { actualDeliveryDate, completionNotes } = req.body as any;
    if (!actualDeliveryDate) {
      return res.status(400).json({ error: "تاريخ التسليم الفعلي مطلوب" });
    }
    const [row] = await db
      .update(transportationTable)
      .set({
        status: "delivered",
        actualDeliveryDate,
        completionNotes: completionNotes || null,
        updatedAt: new Date(),
      })
      .where(eq(transportationTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "أمر النقل غير موجود" });
    insertAutomationTask({
      title: `متابعة ما بعد وصول شحنة: ${row.orderNumber ?? id}`,
      sourceType: "transport_completed", sourceId: id, triggerKey: "completed",
      linkedEntityType: "transportationOrder", linkedEntityId: id,
    }).catch(() => {});
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في إتمام أمر النقل" });
  }
});

// POST /transportation/:id/log-income — copy the order's value into finance_income as an actual recorded income entry
router.post("/:id/log-income", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [order] = await db.select().from(transportationTable).where(eq(transportationTable.id, id));
    if (!order) return res.status(404).json({ error: "أمر النقل غير موجود" });
    if (!order.value) return res.status(400).json({ error: "لا توجد قيمة مسجّلة على هذا الأمر" });

    const { rows } = await pool.query(
      `INSERT INTO finance_income (contract_id, transportation_order_id, description, amount, date, category, created_by)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, 'contract', $5)
       RETURNING id, amount, date`,
      [order.contractId ?? null, id, `فاتورة أمر نقل رقم ${order.orderNumber ?? id}`, order.value, req.session.userId!]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في تسجيل الإيراد" });
  }
});

/* ══════════════════════════════════════
   BUDGETS (الميزانية) — static paths, before /:id
══════════════════════════════════════ */

router.get("/budgets", async (req: Request, res: Response) => {
  try {
    const { year } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (year) { params.push(Number(year)); conditions.push(`year = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT id, year, month, amount, notes FROM transportation_budgets ${where} ORDER BY year DESC, month ASC`,
      params
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الميزانية" });
  }
});

router.post("/budgets", async (req: Request, res: Response) => {
  try {
    const data = insertTransportationBudgetSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO transportation_budgets (year, month, amount, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (year, month) DO UPDATE SET amount = EXCLUDED.amount, notes = EXCLUDED.notes, updated_at = now()
       RETURNING id, year, month, amount, notes`,
      [data.year, data.month, data.amount, data.notes ?? null]
    );
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في حفظ الميزانية" });
  }
});

router.get("/budgets/summary", async (req: Request, res: Response) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const [monthly, income, capex, capexList, byType, byVehicle, byOrder, byWorkerCost] = await Promise.all([
      pool.query(
        `SELECT gs.month, COALESCE(b.amount, 0)::numeric AS budget,
           COALESCE((
             SELECT SUM(fe.amount) FROM finance_expenses fe
             LEFT JOIN workers w ON w.id = fe.worker_id
             WHERE EXTRACT(YEAR FROM fe.created_at)::int = $1
               AND EXTRACT(MONTH FROM fe.created_at)::int = gs.month
               AND (fe.transportation_order_id IS NOT NULL OR fe.vehicle_id IS NOT NULL
                    OR (fe.worker_id IS NOT NULL AND w.assigned_module = 'transportation'))
           ), 0)::numeric AS spent
         FROM generate_series(1, 12) AS gs(month)
         LEFT JOIN transportation_budgets b ON b.year = $1 AND b.month = gs.month
         ORDER BY gs.month`,
        [year]
      ),
      pool.query(
        `SELECT EXTRACT(MONTH FROM fi.date)::int AS month, COALESCE(SUM(fi.amount), 0)::numeric AS income
         FROM finance_income fi
         WHERE fi.transportation_order_id IS NOT NULL AND EXTRACT(YEAR FROM fi.date)::int = $1
         GROUP BY month`,
        [year]
      ),
      pool.query(
        `SELECT EXTRACT(MONTH FROM fv.purchase_date)::int AS month, COALESCE(SUM(fv.purchase_value), 0)::numeric AS capex
         FROM fleet_vehicles fv
         WHERE fv.purchase_date IS NOT NULL AND EXTRACT(YEAR FROM fv.purchase_date)::int = $1
         GROUP BY month`,
        [year]
      ),
      pool.query(
        `SELECT fv.id, fv.plate_number AS "plateNumber", fv.make_model AS "makeModel",
                fv.purchase_date AS "purchaseDate", fv.purchase_value AS "purchaseValue"
         FROM fleet_vehicles fv
         WHERE fv.purchase_date IS NOT NULL AND EXTRACT(YEAR FROM fv.purchase_date)::int = $1
         ORDER BY fv.purchase_date DESC`,
        [year]
      ),
      pool.query(
        `SELECT CASE WHEN fe.transportation_order_id IS NOT NULL THEN 'أمر نقل' ELSE 'صيانة مركبة' END AS label,
                COALESCE(SUM(fe.amount), 0)::numeric AS total
         FROM finance_expenses fe
         WHERE (fe.transportation_order_id IS NOT NULL OR fe.vehicle_id IS NOT NULL)
           AND EXTRACT(YEAR FROM fe.created_at)::int = $1
         GROUP BY label ORDER BY total DESC`,
        [year]
      ),
      pool.query(
        `SELECT fv.plate_number AS label, COALESCE(SUM(fe.amount), 0)::numeric AS total
         FROM finance_expenses fe
         JOIN fleet_vehicles fv ON fv.id = fe.vehicle_id
         WHERE EXTRACT(YEAR FROM fe.created_at)::int = $1
         GROUP BY fv.plate_number ORDER BY total DESC LIMIT 10`,
        [year]
      ),
      pool.query(
        `SELECT to2.order_number AS label, COALESCE(SUM(fe.amount), 0)::numeric AS total
         FROM finance_expenses fe
         JOIN transportation_orders to2 ON to2.id = fe.transportation_order_id
         WHERE EXTRACT(YEAR FROM fe.created_at)::int = $1
         GROUP BY to2.order_number ORDER BY total DESC LIMIT 10`,
        [year]
      ),
      pool.query(
        `SELECT w.full_name AS label, COALESCE(SUM(fe.amount), 0)::numeric AS total
         FROM finance_expenses fe
         JOIN workers w ON w.id = fe.worker_id
         WHERE w.assigned_module = 'transportation' AND EXTRACT(YEAR FROM fe.created_at)::int = $1
         GROUP BY w.full_name ORDER BY total DESC LIMIT 10`,
        [year]
      ),
    ]);

    const incomeByMonth: Record<number, number> = {};
    for (const r of income.rows) incomeByMonth[r.month] = Number(r.income);
    const capexByMonth: Record<number, number> = {};
    for (const r of capex.rows) capexByMonth[r.month] = Number(r.capex);

    const monthlyRows = monthly.rows.map((r: any) => {
      const monthIncome = incomeByMonth[r.month] ?? 0;
      const spent = Number(r.spent);
      return { ...r, income: monthIncome, net: monthIncome - spent, capex: capexByMonth[r.month] ?? 0 };
    });

    const annualBudget = monthlyRows.reduce((s: number, r: any) => s + Number(r.budget), 0);
    const annualSpent = monthlyRows.reduce((s: number, r: any) => s + Number(r.spent), 0);
    const annualIncome = monthlyRows.reduce((s: number, r: any) => s + Number(r.income), 0);
    const annualCapex = monthlyRows.reduce((s: number, r: any) => s + Number(r.capex), 0);

    return res.json({
      year,
      annualBudget, annualSpent, annualRemaining: annualBudget - annualSpent,
      annualIncome, annualCapex, annualNet: annualIncome - annualSpent,
      monthly: monthlyRows,
      capexList: capexList.rows,
      byType: byType.rows,
      byVehicle: byVehicle.rows,
      byOrder: byOrder.rows,
      byWorkerCost: byWorkerCost.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب ملخص الميزانية" });
  }
});

/* ══════════════════════════════════════
   TRANSPORTATION ORDERS — DYNAMIC (/:id last)
   Must come AFTER all static routes above.
══════════════════════════════════════ */

// GET /transportation/:id — single order
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(transportationTable).where(eq(transportationTable.id, id));
    if (!row) return res.status(404).json({ error: "أمر النقل غير موجود" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في جلب أمر النقل" });
  }
});

// PATCH /transportation/:id — update order
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateTransportationSchema.parse(req.body);
    const [row] = await db
      .update(transportationTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(transportationTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "أمر النقل غير موجود" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث أمر النقل" });
  }
});

// DELETE /transportation/:id — delete order
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(transportationTable).where(eq(transportationTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف أمر النقل" });
  }
});

export default router;
