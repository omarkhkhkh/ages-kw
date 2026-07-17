import { Router, type Request, type Response } from "express";
import {
  db, pool,
  tasksTable, usersTable, taskTypesTable,
  taskCollaboratorsTable, insertTaskCollaboratorSchema,
  taskStagesTable, insertTaskStageSchema, updateTaskStageSchema,
  taskCommentsTable, insertTaskCommentSchema, taskCommentMentionsTable,
  taskAttachmentsTable, insertTaskAttachmentSchema,
  taskActivityLogTable,
  taskApprovalsTable,
} from "@workspace/db";
import { eq, and, desc, or, inArray, sql as dsql } from "drizzle-orm";
import { createNotification } from "./notifications";

const router = Router();

const isAdmin = (req: Request) => req.session.role === "admin";
const canApprove = (req: Request) => isAdmin(req) || !!req.session.taskCanApprove;

/* ─── helpers ─── */
const TASK_SELECT = {
  id:               tasksTable.id,
  title:            tasksTable.title,
  taskType:         tasksTable.taskType,
  taskTypeId:       tasksTable.taskTypeId,
  description:      tasksTable.description,
  priority:         tasksTable.priority,
  status:           tasksTable.status,
  assignedTo:       tasksTable.assignedTo,
  requestedBy:      tasksTable.requestedBy,
  createdBy:        tasksTable.createdBy,
  linkedEntityType: tasksTable.linkedEntityType,
  linkedEntityId:   tasksTable.linkedEntityId,
  startDate:        tasksTable.startDate,
  dueDate:          tasksTable.dueDate,
  expectedDurationHours: tasksTable.expectedDurationHours,
  actualTimeHours:  tasksTable.actualTimeHours,
  progressPercent:  tasksTable.progressPercent,
  budget:           tasksTable.budget,
  actualCost:       tasksTable.actualCost,
  qualityRating:    tasksTable.qualityRating,
  recurringTemplateId: tasksTable.recurringTemplateId,
  proofType:        tasksTable.proofType,
  isArchived:       tasksTable.isArchived,
  sourceType:       tasksTable.sourceType,
  completedAt:      tasksTable.completedAt,
  employeeNotes:    tasksTable.employeeNotes,
  notesUpdatedAt:   tasksTable.notesUpdatedAt,
  notesReadByAdmin: tasksTable.notesReadByAdmin,
  createdAt:        tasksTable.createdAt,
  updatedAt:        tasksTable.updatedAt,
};

async function enrichTasks(rows: any[]) {
  if (!rows.length) return [];
  const userIds = [...new Set([
    ...rows.map(r => r.assignedTo),
    ...rows.map(r => r.createdBy),
    ...rows.map(r => r.requestedBy),
  ].filter(Boolean))];
  const typeIds = [...new Set(rows.map(r => r.taskTypeId).filter(Boolean))];

  const [users, types] = await Promise.all([
    userIds.length
      ? db.select({ id: usersTable.id, fullName: usersTable.fullName }).from(usersTable).where(or(...userIds.map(id => eq(usersTable.id, id))))
      : Promise.resolve([] as { id: number; fullName: string }[]),
    typeIds.length
      ? db.select({ id: taskTypesTable.id, name: taskTypesTable.name }).from(taskTypesTable).where(or(...typeIds.map(id => eq(taskTypesTable.id, id))))
      : Promise.resolve([] as { id: number; name: string }[]),
  ]);
  const userMap: Record<number, string> = {};
  users.forEach(u => { userMap[u.id] = u.fullName; });
  const typeMap: Record<number, string> = {};
  types.forEach(t => { typeMap[t.id] = t.name; });

  return rows.map(r => ({
    ...r,
    assigneeName: r.assignedTo ? (userMap[r.assignedTo] ?? null) : null,
    creatorName:  r.createdBy  ? (userMap[r.createdBy]  ?? null) : null,
    requesterName: r.requestedBy ? (userMap[r.requestedBy] ?? null) : null,
    taskTypeName: r.taskTypeId ? (typeMap[r.taskTypeId] ?? null) : r.taskType,
  }));
}

async function logTaskActivity(taskId: number, userId: number | null, changeType: string, field?: string | null, oldValue?: any, newValue?: any, note?: string | null) {
  await db.insert(taskActivityLogTable).values({
    taskId, userId: userId ?? null, changeType,
    field: field ?? null,
    oldValue: oldValue !== undefined && oldValue !== null ? String(oldValue) : null,
    newValue: newValue !== undefined && newValue !== null ? String(newValue) : null,
    note: note ?? null,
  });
}

// أفضل اجتهاد لتسمية العنصر المرتبط — لا يفشل إن لم يوجد الجدول/السجل
const LINKED_ENTITY_QUERIES: Record<string, { table: string; label: string }> = {
  tender: { table: "tenders", label: "tender_number" },
  practice: { table: "practices", label: "practice_number" },
  contract: { table: "contracts", label: "contract_number" },
  governmentEntity: { table: "government_entities", label: "name" },
  supplier: { table: "suppliers", label: "name" },
  project: { table: "projects", label: "name" },
  purchaseOrder: { table: "direct_purchase_orders", label: "order_number" },
  vehicle: { table: "fleet_vehicles", label: "plate_number" },
  correspondence: { table: "correspondence_letters", label: "letter_number" },
  maintenanceWorkOrder: { table: "maintenance_work_orders", label: "order_number" },
  rfq: { table: "rfq_requests", label: "id" },
  bankGuarantee: { table: "bank_guarantees", label: "guarantee_number" },
  governmentRegistration: { table: "government_registrations", label: "id" },
  transportationOrder: { table: "transportation_orders", label: "order_number" },
  company: { table: "companies", label: "name" },
  department: { table: "departments", label: "name" },
};

async function resolveLinkedEntityLabel(type: string | null, id: number | null): Promise<string | null> {
  if (!type || !id) return null;
  const meta = LINKED_ENTITY_QUERIES[type];
  if (!meta) return null;
  try {
    const { rows } = await pool.query(`SELECT ${meta.label} AS label FROM ${meta.table} WHERE id = $1`, [id]);
    return rows[0]?.label ? String(rows[0].label) : null;
  } catch {
    return null;
  }
}

/* ══════════════════════════════════════
   GET /tasks — list (view-aware)
══════════════════════════════════════ */
router.get("/", async (req: Request, res: Response) => {
  try {
    const admin = isAdmin(req);
    const scope = req.session.taskViewScope ?? "own";
    const { status, priority, taskTypeId, linkedEntityType, linkedEntityId, search, today, archived } = req.query as Record<string, string>;

    const conditions: any[] = [];
    // الأرشيف (نسخ الأيام السابقة من المهام الدورية) مستبعد افتراضيًا — يُطلب صراحةً بـ ?archived=1
    if (archived !== "1") conditions.push(eq(tasksTable.isArchived, false));
    else conditions.push(eq(tasksTable.isArchived, true));
    // مهام اليوم فقط: مستحقة اليوم أو أُنشئت اليوم
    if (today === "1") conditions.push(dsql`(${tasksTable.dueDate}::date = CURRENT_DATE OR ${tasksTable.createdAt}::date = CURRENT_DATE)`);
    if (!admin && scope !== "all") {
      // 'department' scope falls back to 'own' pool — لا يوجد مفهوم قسم تنظيمي داخلي حاليًا في النظام
      const collabTaskIds = db.select({ taskId: taskCollaboratorsTable.taskId }).from(taskCollaboratorsTable).where(eq(taskCollaboratorsTable.userId, req.session.userId!));
      conditions.push(or(
        eq(tasksTable.assignedTo, req.session.userId!),
        eq(tasksTable.createdBy, req.session.userId!),
        eq(tasksTable.requestedBy, req.session.userId!),
        inArray(tasksTable.id, collabTaskIds),
      ));
    }
    if (status) conditions.push(eq(tasksTable.status, status));
    if (priority) conditions.push(eq(tasksTable.priority, priority));
    if (taskTypeId) conditions.push(eq(tasksTable.taskTypeId, Number(taskTypeId)));
    if (linkedEntityType) conditions.push(eq(tasksTable.linkedEntityType, linkedEntityType));
    if (linkedEntityId) conditions.push(eq(tasksTable.linkedEntityId, Number(linkedEntityId)));
    if (search) conditions.push(dsql`${tasksTable.title} ILIKE ${`%${search}%`}`);

    let query = db.select(TASK_SELECT).from(tasksTable).$dynamic();
    if (conditions.length) query = query.where(and(...conditions));
    const rows = await query.orderBy(desc(tasksTable.createdAt));
    return res.json(await enrichTasks(rows));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب المهام" });
  }
});

/* ─── GET /tasks/unread-notes ─── admin: count tasks with unread employee notes ── */
router.get("/unread-notes", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "مدير فقط" });
  try {
    const rows = await db.select(TASK_SELECT).from(tasksTable)
      .where(and(eq(tasksTable.notesReadByAdmin, false)))
      .orderBy(desc(tasksTable.notesUpdatedAt));
    const withNotes = rows.filter(r => r.employeeNotes && r.employeeNotes.trim() !== "");
    const enriched = await enrichTasks(withNotes);
    return res.json({ count: enriched.length, tasks: enriched });
  } catch {
    return res.status(500).json({ error: "فشل في جلب الملاحظات" });
  }
});

/* ══════════════════════════════════════
   GET /tasks/stats — لوحة تحكم
══════════════════════════════════════ */
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled'))::int AS "openCount",
        COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled') AND due_date IS NOT NULL AND due_date < now())::int AS "overdueCount",
        COUNT(*) FILTER (WHERE priority IN ('urgent','critical') AND status NOT IN ('completed','cancelled'))::int AS "urgentCount",
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at::date = CURRENT_DATE)::int AS "completedTodayCount",
        COUNT(*) FILTER (WHERE status = 'completed')::int AS "completedTotalCount"
      FROM tasks
    `);
    const { rows: byEmployee } = await pool.query(`
      SELECT u.id, u.full_name AS "fullName", COUNT(t.id)::int AS "openCount"
      FROM users u LEFT JOIN tasks t ON t.assigned_to = u.id AND t.status NOT IN ('completed','cancelled')
      WHERE u.is_active = true GROUP BY u.id, u.full_name ORDER BY "openCount" DESC LIMIT 10
    `);
    const { rows: byDept } = await pool.query(`
      SELECT COALESCE(tt.name, t.task_type, 'أخرى') AS "typeName", COUNT(*)::int AS "count"
      FROM tasks t LEFT JOIN task_types tt ON tt.id = t.task_type_id
      WHERE t.status NOT IN ('completed','cancelled') GROUP BY "typeName" ORDER BY "count" DESC
    `);
    return res.json({ ...rows[0], byEmployee, byType: byDept });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب الإحصائيات" });
  }
});

/* ══════════════════════════════════════
   GET /tasks/performance — أداء الموظفين (شهري/سنوي)
══════════════════════════════════════ */
router.get("/performance", async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const month = req.query.month ? Number(req.query.month) : null;
    const dateFilter = month
      ? dsql`EXTRACT(YEAR FROM t.created_at) = ${year} AND EXTRACT(MONTH FROM t.created_at) = ${month}`
      : dsql`EXTRACT(YEAR FROM t.created_at) = ${year}`;
    const { rows } = await pool.query(`
      SELECT u.id, u.full_name AS "fullName",
        COUNT(*) FILTER (WHERE t.status = 'completed')::int AS "completedCount",
        COUNT(*) FILTER (WHERE t.status NOT IN ('completed','cancelled') AND t.due_date < now())::int AS "overdueCount",
        COALESCE(ROUND(AVG(CASE WHEN t.status='completed' AND t.completed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (t.completed_at::timestamp - t.created_at::timestamp))/3600 END)::numeric, 1), 0) AS "avgCompletionHours",
        COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE t.status='completed' AND (t.due_date IS NULL OR t.completed_at <= t.due_date))
          / NULLIF(COUNT(*) FILTER (WHERE t.status='completed'), 0), 1), 0) AS "onTimePercent",
        COALESCE(ROUND(AVG(t.quality_rating)::numeric, 2), 0) AS "avgQualityRating"
      FROM users u
      LEFT JOIN tasks t ON t.assigned_to = u.id AND EXTRACT(YEAR FROM t.created_at) = $1 ${month ? "AND EXTRACT(MONTH FROM t.created_at) = $2" : ""}
      WHERE u.is_active = true
      GROUP BY u.id, u.full_name
      ORDER BY "completedCount" DESC
    `, month ? [year, month] : [year]);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب لوحة الأداء" });
  }
});

/* ══════════════════════════════════════
   GET /tasks/daily-performance — متابعة الأداء اليومية
   المدير: كل الموظفين + مهامهم اليوم؛ الموظف: صفّه ومهامه فقط
══════════════════════════════════════ */
router.get("/daily-performance", async (req: Request, res: Response) => {
  try {
    const admin = isAdmin(req);
    const userFilter = admin ? "" : `AND t.assigned_to = $1`;
    const params = admin ? [] : [req.session.userId!];

    // مهام اليوم = غير مؤرشفة وغير ملغاة، مستحقة اليوم أو أُنشئت اليوم، ولها مسؤول
    const todayTaskWhere = `
      t.is_archived = false AND t.status != 'cancelled' AND t.assigned_to IS NOT NULL
      AND (t.due_date::date = CURRENT_DATE OR t.created_at::date = CURRENT_DATE)
      ${userFilter}`;

    const { rows: employees } = await pool.query(`
      SELECT u.id AS "userId", u.full_name AS "fullName",
        COUNT(t.id)::int AS "total",
        COUNT(t.id) FILTER (WHERE t.status = 'completed')::int AS "completed",
        COALESCE(ROUND(100.0 * COUNT(t.id) FILTER (WHERE t.status = 'completed') / NULLIF(COUNT(t.id), 0)), 0)::int AS "pct"
      FROM users u
      JOIN tasks t ON t.assigned_to = u.id AND ${todayTaskWhere}
      WHERE u.is_active = true
      GROUP BY u.id, u.full_name
      ORDER BY "pct" DESC, "total" DESC
    `, params);

    const { rows: tasks } = await pool.query(`
      SELECT t.id, t.title, t.status, t.priority, t.assigned_to AS "assignedTo",
        t.due_date AS "dueDate", t.completed_at AS "completedAt",
        t.proof_type AS "proofType", t.recurring_template_id AS "recurringTemplateId",
        t.employee_notes AS "employeeNotes",
        u.full_name AS "assigneeName",
        (SELECT COUNT(*)::int FROM task_attachments ta WHERE ta.task_id = t.id) AS "attachmentCount"
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE ${todayTaskWhere}
      ORDER BY t.status = 'completed', t.priority IN ('urgent','critical') DESC, t.due_date NULLS LAST
    `, params);

    return res.json({ employees, tasks });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب متابعة الأداء اليومية" });
  }
});

/* ══════════════════════════════════════
   GET /tasks/activity-feed — للـTimeline
══════════════════════════════════════ */
router.get("/activity-feed", async (req: Request, res: Response) => {
  try {
    const { linkedEntityType, linkedEntityId, taskId } = req.query as Record<string, string>;
    const params: any[] = [];
    let where = "";
    if (taskId) {
      params.push(Number(taskId));
      where = `WHERE al.task_id = $${params.length}`;
    } else if (linkedEntityType && linkedEntityId) {
      params.push(linkedEntityType, Number(linkedEntityId));
      where = `WHERE t.linked_entity_type = $1 AND t.linked_entity_id = $2`;
    }
    const { rows } = await pool.query(`
      SELECT al.id, al.task_id AS "taskId", t.title AS "taskTitle", al.user_id AS "userId",
             u.full_name AS "userName", al.change_type AS "changeType", al.field, al.old_value AS "oldValue",
             al.new_value AS "newValue", al.note, al.created_at AS "createdAt"
      FROM task_activity_log al
      JOIN tasks t ON t.id = al.task_id
      LEFT JOIN users u ON u.id = al.user_id
      ${where}
      ORDER BY al.created_at DESC LIMIT 200
    `, params);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب سجل النشاط" });
  }
});

/* ══════════════════════════════════════
   GET /tasks/:id — تفاصيل كاملة
══════════════════════════════════════ */
router.get("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [row] = await db.select(TASK_SELECT).from(tasksTable).where(eq(tasksTable.id, id));
    if (!row) return res.status(404).json({ error: "المهمة غير موجودة" });
    const [enriched] = await enrichTasks([row]);

    const [stages, collaborators, comments, attachments, approvals] = await Promise.all([
      db.select().from(taskStagesTable).where(eq(taskStagesTable.taskId, id)).orderBy(taskStagesTable.sortOrder),
      db.select({ userId: taskCollaboratorsTable.userId, fullName: usersTable.fullName })
        .from(taskCollaboratorsTable).innerJoin(usersTable, eq(taskCollaboratorsTable.userId, usersTable.id))
        .where(eq(taskCollaboratorsTable.taskId, id)),
      db.select({ id: taskCommentsTable.id, userId: taskCommentsTable.userId, content: taskCommentsTable.content, createdAt: taskCommentsTable.createdAt, userName: usersTable.fullName })
        .from(taskCommentsTable).innerJoin(usersTable, eq(taskCommentsTable.userId, usersTable.id))
        .where(eq(taskCommentsTable.taskId, id)).orderBy(taskCommentsTable.createdAt),
      db.select().from(taskAttachmentsTable).where(eq(taskAttachmentsTable.taskId, id)).orderBy(desc(taskAttachmentsTable.createdAt)),
      db.select().from(taskApprovalsTable).where(eq(taskApprovalsTable.taskId, id)),
    ]);
    const linkedEntityLabel = await resolveLinkedEntityLabel(row.linkedEntityType, row.linkedEntityId);

    return res.json({ ...enriched, linkedEntityLabel, stages, collaborators, comments, attachments, approvals });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب تفاصيل المهمة" });
  }
});

const VALID_PRIORITIES = ["low", "medium", "high", "urgent", "critical"] as const;
const VALID_STATUSES   = ["pending", "under_review", "in_progress", "awaiting_reply", "awaiting_external", "blocked", "needs_approval", "completed", "cancelled"] as const;

/* ══════════════════════════════════════
   POST /tasks
══════════════════════════════════════ */
router.post("/", async (req: Request, res: Response) => {
  if (!isAdmin(req) && !req.session.canEdit) return res.status(403).json({ error: "ليس لديك صلاحية" });
  try {
    const {
      title, taskType, taskTypeId, description, priority, status, assignedTo, requestedBy,
      linkedEntityType, linkedEntityId, startDate, dueDate, expectedDurationHours, budget,
      collaboratorIds, approvalGates,
    } = req.body as any;

    if (!title?.trim()) return res.status(400).json({ error: "العنوان مطلوب" });
    if (priority && !VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: "قيمة الأولوية غير صالحة" });
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: "قيمة الحالة غير صالحة" });

    const [task] = await db.insert(tasksTable).values({
      title: title.trim(),
      taskType: taskType ? String(taskType).trim() : null,
      taskTypeId: taskTypeId ? Number(taskTypeId) : null,
      description: description ? String(description).trim() || null : null,
      priority: VALID_PRIORITIES.includes(priority) ? priority : "medium",
      status: VALID_STATUSES.includes(status) ? status : "pending",
      assignedTo: assignedTo ? Number(assignedTo) : null,
      requestedBy: requestedBy ? Number(requestedBy) : null,
      createdBy: req.session.userId!,
      linkedEntityType: linkedEntityType || null,
      linkedEntityId: linkedEntityId ? Number(linkedEntityId) : null,
      startDate: startDate || null,
      dueDate: dueDate || null,
      expectedDurationHours: expectedDurationHours != null ? String(expectedDurationHours) : null,
      budget: budget != null ? String(budget) : null,
    }).returning(TASK_SELECT);

    // زرع المراحل الفرعية من قالب نوع المهمة إن وُجد
    if (task.taskTypeId) {
      const [tt] = await db.select({ suggestedSubtasks: taskTypesTable.suggestedSubtasks }).from(taskTypesTable).where(eq(taskTypesTable.id, task.taskTypeId));
      if (tt?.suggestedSubtasks?.length) {
        await db.insert(taskStagesTable).values(
          tt.suggestedSubtasks.map((title: string, i: number) => ({ taskId: task.id, title, sortOrder: i }))
        );
      }
    }

    if (Array.isArray(collaboratorIds) && collaboratorIds.length) {
      await db.insert(taskCollaboratorsTable).values(
        collaboratorIds.map((userId: number) => ({ taskId: task.id, userId: Number(userId) }))
      ).onConflictDoNothing();
    }

    if (Array.isArray(approvalGates) && approvalGates.length) {
      await db.insert(taskApprovalsTable).values(
        approvalGates.map((gate: string) => ({ taskId: task.id, gate }))
      ).onConflictDoNothing();
    }

    await logTaskActivity(task.id, req.session.userId!, "created", null, null, null, "تم إنشاء المهمة");

    if (task.assignedTo && task.assignedTo !== req.session.userId) {
      await createNotification({ recipientUserId: task.assignedTo, type: "task_created", message: `تم إسناد مهمة جديدة إليك: ${task.title}`, link: `/tasks?id=${task.id}` });
    }

    return res.status(201).json(task);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "فشل في إنشاء المهمة" });
  }
});

/* ══════════════════════════════════════
   PATCH /tasks/:id
══════════════════════════════════════ */
router.patch("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "معرّف غير صالح" });

  try {
    const admin = isAdmin(req);
    const [existing] = await db.select(TASK_SELECT).from(tasksTable).where(eq(tasksTable.id, id));
    if (!existing) return res.status(404).json({ error: "المهمة غير موجودة" });

    const now = new Date().toISOString();
    const updates: any = { updatedAt: now };
    const logEntries: { field: string; oldValue: any; newValue: any }[] = [];

    if (admin || req.session.canEdit) {
      const {
        title, taskType, taskTypeId, description, priority, status, assignedTo, requestedBy,
        linkedEntityType, linkedEntityId, startDate, dueDate, expectedDurationHours, actualTimeHours,
        progressPercent, budget, actualCost, qualityRating,
      } = req.body as any;

      if (title !== undefined && title !== existing.title) { updates.title = String(title).trim(); logEntries.push({ field: "title", oldValue: existing.title, newValue: updates.title }); }
      if (taskType !== undefined) updates.taskType = taskType ? String(taskType).trim() : null;
      if (taskTypeId !== undefined) updates.taskTypeId = taskTypeId ? Number(taskTypeId) : null;
      if (description !== undefined) updates.description = description ? String(description).trim() || null : null;
      if (priority !== undefined) {
        if (!VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: "قيمة الأولوية غير صالحة" });
        if (priority !== existing.priority) logEntries.push({ field: "priority", oldValue: existing.priority, newValue: priority });
        updates.priority = priority;
      }
      if (status !== undefined) {
        if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: "قيمة الحالة غير صالحة" });
        if (status !== existing.status) logEntries.push({ field: "status", oldValue: existing.status, newValue: status });
        updates.status = status;
        if (status === "completed" && existing.status !== "completed") updates.completedAt = now;
      }
      if (assignedTo !== undefined) {
        const n = assignedTo ? Number(assignedTo) : null;
        if (n !== existing.assignedTo) {
          logEntries.push({ field: "assignedTo", oldValue: existing.assignedTo, newValue: n });
          if (n) await createNotification({ recipientUserId: n, type: "assignee_changed", message: `تم إسناد مهمة إليك: ${existing.title}`, link: `/tasks?id=${id}` });
        }
        updates.assignedTo = n;
      }
      if (requestedBy !== undefined) updates.requestedBy = requestedBy ? Number(requestedBy) : null;
      if (linkedEntityType !== undefined) updates.linkedEntityType = linkedEntityType || null;
      if (linkedEntityId !== undefined) updates.linkedEntityId = linkedEntityId ? Number(linkedEntityId) : null;
      if (startDate !== undefined) updates.startDate = startDate || null;
      if (dueDate !== undefined) updates.dueDate = dueDate || null;
      if (expectedDurationHours !== undefined) updates.expectedDurationHours = expectedDurationHours != null ? String(expectedDurationHours) : null;
      if (actualTimeHours !== undefined) updates.actualTimeHours = actualTimeHours != null ? String(actualTimeHours) : null;
      if (progressPercent !== undefined) updates.progressPercent = Math.max(0, Math.min(100, Number(progressPercent)));
      if (budget !== undefined) updates.budget = budget != null ? String(budget) : null;
      if (actualCost !== undefined) updates.actualCost = actualCost != null ? String(actualCost) : null;
      if (qualityRating !== undefined) updates.qualityRating = qualityRating != null ? Number(qualityRating) : null;
    } else {
      // موظف: يقدر يعدّل ملاحظاته + الحالة (ضمن آلة حالات محدودة) + نسبة الإنجاز/الوقت الفعلي لمهمته فقط
      if (existing.assignedTo !== req.session.userId) return res.status(403).json({ error: "ليس لديك صلاحية" });
      const { employeeNotes, status, progressPercent, actualTimeHours } = req.body as any;
      if (employeeNotes !== undefined) {
        updates.employeeNotes = employeeNotes?.trim() || null;
        updates.notesUpdatedAt = now;
        updates.notesReadByAdmin = false;
      }
      if (progressPercent !== undefined) updates.progressPercent = Math.max(0, Math.min(100, Number(progressPercent)));
      if (actualTimeHours !== undefined) updates.actualTimeHours = actualTimeHours != null ? String(actualTimeHours) : null;
      if (status !== undefined) {
        const EMPLOYEE_TRANSITIONS: Record<string, string[]> = {
          pending:            ["in_progress", "needs_approval", "awaiting_reply", "awaiting_external", "blocked", "completed"],
          under_review:       [],
          in_progress:        ["pending", "needs_approval", "awaiting_reply", "awaiting_external", "blocked", "completed"],
          awaiting_reply:     ["in_progress"],
          awaiting_external:  ["in_progress"],
          blocked:            ["in_progress"],
          needs_approval:     [],
          completed:          [],
          cancelled:          [],
        };
        const allowed = EMPLOYEE_TRANSITIONS[existing.status] ?? [];
        if (!allowed.includes(status)) return res.status(400).json({ error: "تغيير الحالة غير مسموح به في الوقت الحالي" });
        // إثبات الإنجاز (Proof of Work) — يُفرض من جانب السيرفر قبل السماح بالإكمال
        if (status === "completed") {
          if (existing.proofType === "file") {
            const [att] = await db.select({ id: taskAttachmentsTable.id }).from(taskAttachmentsTable).where(eq(taskAttachmentsTable.taskId, id)).limit(1);
            if (!att) return res.status(400).json({ error: "هذه المهمة تتطلب إرفاق ملف إثبات قبل الإكمال" });
          } else if (existing.proofType === "note") {
            const noteAfterUpdate = updates.employeeNotes !== undefined ? updates.employeeNotes : existing.employeeNotes;
            if (!noteAfterUpdate || !String(noteAfterUpdate).trim()) return res.status(400).json({ error: "هذه المهمة تتطلب كتابة ملاحظة إنجاز قبل الإكمال" });
          }
          updates.completedAt = now;
          updates.progressPercent = 100;
        }
        logEntries.push({ field: "status", oldValue: existing.status, newValue: status });
        updates.status = status;
      }
    }

    const [updated] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, id)).returning(TASK_SELECT);

    for (const entry of logEntries) {
      await logTaskActivity(id, req.session.userId!, entry.field === "status" ? "status_change" : "field_update", entry.field, entry.oldValue, entry.newValue);
    }
    if (updated.status === "completed" && existing.status !== "completed") {
      const notifyId = existing.requestedBy ?? existing.createdBy;
      if (notifyId) await createNotification({ recipientUserId: notifyId, type: "task_completed", message: `اكتملت المهمة: ${existing.title}`, link: `/tasks?id=${id}` });
    }

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في تحديث المهمة" });
  }
});

/* ─── PATCH /tasks/:id/mark-notes-read ─── */
router.patch("/:id/mark-notes-read", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "مدير فقط" });
  const id = Number(req.params.id);
  try {
    await db.update(tasksTable).set({ notesReadByAdmin: true, updatedAt: new Date().toISOString() }).where(eq(tasksTable.id, id));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "فشل" });
  }
});

/* ─── DELETE /tasks/:id ─── admin only ── */
router.delete("/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "مدير فقط" });
  const id = Number(req.params.id);
  try {
    await db.delete(tasksTable).where(eq(tasksTable.id, id));
    return res.status(204).end();
  } catch {
    return res.status(500).json({ error: "فشل في حذف المهمة" });
  }
});

/* ══════════════════════════════════════
   المراحل الفرعية
══════════════════════════════════════ */
router.get("/:id/stages", async (req: Request, res: Response) => {
  const taskId = Number(req.params.id);
  const rows = await db.select().from(taskStagesTable).where(eq(taskStagesTable.taskId, taskId)).orderBy(taskStagesTable.sortOrder);
  return res.json(rows);
});

router.post("/:id/stages", async (req: Request, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    const data = insertTaskStageSchema.parse({ ...req.body, taskId });
    const [row] = await db.insert(taskStagesTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة المرحلة" });
  }
});

router.patch("/:id/stages/:stageId", async (req: Request, res: Response) => {
  try {
    const stageId = Number(req.params.stageId);
    const data = updateTaskStageSchema.parse(req.body);
    if (data.isDone) { (data as any).doneAt = new Date().toISOString(); (data as any).doneByUserId = req.session.userId; }
    const [row] = await db.update(taskStagesTable).set(data).where(eq(taskStagesTable.id, stageId)).returning();
    if (!row) return res.status(404).json({ error: "المرحلة غير موجودة" });
    await logTaskActivity(Number(req.params.id), req.session.userId!, "field_update", "stage", null, row.title, data.isDone ? "تم إنهاء مرحلة" : "تحديث مرحلة");
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث المرحلة" });
  }
});

router.delete("/:id/stages/:stageId", async (req: Request, res: Response) => {
  await db.delete(taskStagesTable).where(eq(taskStagesTable.id, Number(req.params.stageId)));
  return res.status(204).end();
});

/* ══════════════════════════════════════
   التعليقات + الإشارات
══════════════════════════════════════ */
router.get("/:id/comments", async (req: Request, res: Response) => {
  const taskId = Number(req.params.id);
  const rows = await db.select({ id: taskCommentsTable.id, userId: taskCommentsTable.userId, content: taskCommentsTable.content, createdAt: taskCommentsTable.createdAt, userName: usersTable.fullName })
    .from(taskCommentsTable).innerJoin(usersTable, eq(taskCommentsTable.userId, usersTable.id))
    .where(eq(taskCommentsTable.taskId, taskId)).orderBy(taskCommentsTable.createdAt);
  return res.json(rows);
});

router.post("/:id/comments", async (req: Request, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    const data = insertTaskCommentSchema.parse({ taskId, userId: req.session.userId!, content: req.body.content });
    const [comment] = await db.insert(taskCommentsTable).values(data).returning();

    const [task] = await db.select({ title: tasksTable.title, assignedTo: tasksTable.assignedTo }).from(tasksTable).where(eq(tasksTable.id, taskId));
    // إشارات @الاسم الكامل — تُطابق مقابل المسؤول والمساعدين ومُنشئ المهمة
    const mentionMatches = [...(comment.content.match(/@([؀-ۿa-zA-Z\s]+?)(?=\s@|$|\n)/g) ?? [])].map(m => m.slice(1).trim());
    if (mentionMatches.length) {
      const allUsers = await db.select({ id: usersTable.id, fullName: usersTable.fullName }).from(usersTable);
      const mentionedIds = allUsers.filter(u => mentionMatches.some(m => u.fullName.includes(m) || m.includes(u.fullName))).map(u => u.id);
      if (mentionedIds.length) {
        await db.insert(taskCommentMentionsTable).values(mentionedIds.map(mentionedUserId => ({ commentId: comment.id, mentionedUserId })));
        for (const uid of mentionedIds) {
          if (uid !== req.session.userId) await createNotification({ recipientUserId: uid, type: "comment_added", message: `أشار إليك أحد الزملاء في تعليق على مهمة: ${task?.title ?? ""}`, link: `/tasks?id=${taskId}` });
        }
      }
    }
    await logTaskActivity(taskId, req.session.userId!, "comment", null, null, null, comment.content.slice(0, 200));
    if (task?.assignedTo && task.assignedTo !== req.session.userId) {
      await createNotification({ recipientUserId: task.assignedTo, type: "comment_added", message: `تعليق جديد على مهمتك: ${task.title}`, link: `/tasks?id=${taskId}` });
    }
    return res.status(201).json(comment);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة التعليق" });
  }
});

/* ══════════════════════════════════════
   المرفقات
══════════════════════════════════════ */
router.get("/:id/attachments", async (req: Request, res: Response) => {
  const rows = await db.select().from(taskAttachmentsTable).where(eq(taskAttachmentsTable.taskId, Number(req.params.id))).orderBy(desc(taskAttachmentsTable.createdAt));
  return res.json(rows);
});

router.post("/:id/attachments", async (req: Request, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    const data = insertTaskAttachmentSchema.parse({ ...req.body, taskId, uploadedByUserId: req.session.userId });
    const [row] = await db.insert(taskAttachmentsTable).values(data).returning();
    const [task] = await db.select({ title: tasksTable.title, assignedTo: tasksTable.assignedTo }).from(tasksTable).where(eq(tasksTable.id, taskId));
    await logTaskActivity(taskId, req.session.userId!, "attachment", null, null, row.fileName, "تم رفع مرفق");
    if (task?.assignedTo && task.assignedTo !== req.session.userId) {
      await createNotification({ recipientUserId: task.assignedTo, type: "file_uploaded", message: `مرفق جديد على مهمتك: ${task.title}`, link: `/tasks?id=${taskId}` });
    }
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة المرفق" });
  }
});

router.delete("/:id/attachments/:attId", async (req: Request, res: Response) => {
  await db.delete(taskAttachmentsTable).where(eq(taskAttachmentsTable.id, Number(req.params.attId)));
  return res.status(204).end();
});

/* ══════════════════════════════════════
   المساعدون / المتعاونون
══════════════════════════════════════ */
router.get("/:id/collaborators", async (req: Request, res: Response) => {
  const rows = await db.select({ userId: taskCollaboratorsTable.userId, fullName: usersTable.fullName })
    .from(taskCollaboratorsTable).innerJoin(usersTable, eq(taskCollaboratorsTable.userId, usersTable.id))
    .where(eq(taskCollaboratorsTable.taskId, Number(req.params.id)));
  return res.json(rows);
});

router.post("/:id/collaborators", async (req: Request, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    const data = insertTaskCollaboratorSchema.parse({ taskId, userId: Number(req.body.userId) });
    const [row] = await db.insert(taskCollaboratorsTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    if (err?.code === "23505") return res.status(409).json({ error: "مضاف بالفعل" });
    return res.status(500).json({ error: "فشل في إضافة المساعد" });
  }
});

router.delete("/:id/collaborators/:userId", async (req: Request, res: Response) => {
  await db.delete(taskCollaboratorsTable).where(and(eq(taskCollaboratorsTable.taskId, Number(req.params.id)), eq(taskCollaboratorsTable.userId, Number(req.params.userId))));
  return res.status(204).end();
});

/* ══════════════════════════════════════
   الاعتمادات
══════════════════════════════════════ */
router.get("/:id/approvals", async (req: Request, res: Response) => {
  const rows = await db.select().from(taskApprovalsTable).where(eq(taskApprovalsTable.taskId, Number(req.params.id)));
  return res.json(rows);
});

router.patch("/:id/approvals/:gate", async (req: Request, res: Response) => {
  if (!canApprove(req)) return res.status(403).json({ error: "ليس لديك صلاحية الاعتماد" });
  try {
    const taskId = Number(req.params.id);
    const gate = String(req.params.gate);
    const { status, comment } = req.body as { status: "approved" | "rejected"; comment?: string };
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "قيمة غير صالحة" });

    const [row] = await db.update(taskApprovalsTable)
      .set({ status, decidedByUserId: req.session.userId, decidedAt: new Date().toISOString(), comment: comment ?? null })
      .where(and(eq(taskApprovalsTable.taskId, taskId), eq(taskApprovalsTable.gate, gate)))
      .returning();
    if (!row) return res.status(404).json({ error: "بوابة الاعتماد غير موجودة" });

    const [task] = await db.select({ title: tasksTable.title, assignedTo: tasksTable.assignedTo, requestedBy: tasksTable.requestedBy, createdBy: tasksTable.createdBy }).from(tasksTable).where(eq(tasksTable.id, taskId));
    await logTaskActivity(taskId, req.session.userId!, "approval", gate, "pending", status, comment ?? null);

    if (status === "rejected" && task) {
      const notifyId = task.assignedTo ?? task.requestedBy ?? task.createdBy;
      if (notifyId) await createNotification({ recipientUserId: notifyId, type: "task_rejected", message: `تم رفض اعتماد (${gate}) لمهمة: ${task.title}`, link: `/tasks?id=${taskId}` });
    } else if (status === "approved") {
      const allGates = await db.select().from(taskApprovalsTable).where(eq(taskApprovalsTable.taskId, taskId));
      if (allGates.length && allGates.every(g => g.status === "approved")) {
        await db.update(tasksTable).set({ status: "in_progress", updatedAt: new Date().toISOString() }).where(eq(tasksTable.id, taskId));
        await logTaskActivity(taskId, null, "status_change", "status", "needs_approval", "in_progress", "اعتماد كل البوابات — تقدّم تلقائي");
      }
    }
    return res.json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في تحديث الاعتماد" });
  }
});

export default router;
