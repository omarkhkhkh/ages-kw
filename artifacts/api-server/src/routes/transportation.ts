import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  pool,
  transportationTable,
  insertTransportationSchema,
  updateTransportationSchema,
  suppliersTable,
  transportTeamsTable,
  transportTeamMembersTable,
  transportTasksTable,
} from "@workspace/db";

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
        description: transportationTable.description,
        origin: transportationTable.origin,
        destination: transportationTable.destination,
        orderDate: transportationTable.orderDate,
        deliveryDate: transportationTable.deliveryDate,
        value: transportationTable.value,
        status: transportationTable.status,
        vehicleInfo: transportationTable.vehicleInfo,
        notes: transportationTable.notes,
        createdAt: transportationTable.createdAt,
        updatedAt: transportationTable.updatedAt,
        supplierName: suppliersTable.name,
      })
      .from(transportationTable)
      .leftJoin(suppliersTable, eq(transportationTable.supplierId, suppliersTable.id));

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
