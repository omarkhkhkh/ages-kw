import { Router, type Request, type Response } from "express";
import { db, tasksTable, usersTable } from "@workspace/db";
import { eq, and, desc, or } from "drizzle-orm";

const router = Router();

const isAdmin = (req: Request) => req.session.role === "admin";

/* ─── helpers ─── */
const TASK_SELECT = {
  id:               tasksTable.id,
  title:            tasksTable.title,
  taskType:         tasksTable.taskType,
  description:      tasksTable.description,
  priority:         tasksTable.priority,
  status:           tasksTable.status,
  assignedTo:       tasksTable.assignedTo,
  createdBy:        tasksTable.createdBy,
  dueDate:          tasksTable.dueDate,
  completedAt:      tasksTable.completedAt,
  employeeNotes:    tasksTable.employeeNotes,
  notesUpdatedAt:   tasksTable.notesUpdatedAt,
  notesReadByAdmin: tasksTable.notesReadByAdmin,
  createdAt:        tasksTable.createdAt,
  updatedAt:        tasksTable.updatedAt,
};

// Enrich rows with assignee and creator names
async function enrichTasks(rows: any[]) {
  if (!rows.length) return [];
  const userIds = [...new Set([
    ...rows.map(r => r.assignedTo),
    ...rows.map(r => r.createdBy),
  ].filter(Boolean))];
  const users = await db
    .select({ id: usersTable.id, fullName: usersTable.fullName })
    .from(usersTable)
    .where(or(...userIds.map(id => eq(usersTable.id, id))));
  const userMap: Record<number, string> = {};
  users.forEach(u => { userMap[u.id] = u.fullName; });
  return rows.map(r => ({
    ...r,
    assigneeName: userMap[r.assignedTo] ?? null,
    creatorName:  userMap[r.createdBy]  ?? null,
  }));
}

/* ─── GET /tasks ─── */
router.get("/", async (req: Request, res: Response) => {
  try {
    const admin = isAdmin(req);
    const rows = admin
      ? await db.select(TASK_SELECT).from(tasksTable).orderBy(desc(tasksTable.createdAt))
      : await db.select(TASK_SELECT).from(tasksTable)
          .where(eq(tasksTable.assignedTo, req.session.userId!))
          .orderBy(desc(tasksTable.createdAt));
    return res.json(await enrichTasks(rows));
  } catch {
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

const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const VALID_STATUSES   = ["pending", "in_progress", "completed", "cancelled"] as const;

/* ─── POST /tasks ─── admin only ── */
router.post("/", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "مدير فقط" });
  try {
    const { title, taskType, description, priority, status, assignedTo, dueDate } = req.body as any;
    if (!title?.trim())    return res.status(400).json({ error: "العنوان مطلوب" });
    if (!taskType?.trim()) return res.status(400).json({ error: "نوع المهمة مطلوب" });
    if (!assignedTo)       return res.status(400).json({ error: "يجب تحديد الموظف" });
    const assignedToNum = Number(assignedTo);
    if (!Number.isInteger(assignedToNum) || assignedToNum <= 0) return res.status(400).json({ error: "معرّف الموظف غير صالح" });
    if (priority && !VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: "قيمة الأولوية غير صالحة" });
    if (status   && !VALID_STATUSES.includes(status))    return res.status(400).json({ error: "قيمة الحالة غير صالحة" });
    if (dueDate  && isNaN(Date.parse(dueDate)))           return res.status(400).json({ error: "تاريخ الاستحقاق غير صالح" });

    const [task] = await db.insert(tasksTable).values({
      title:       title.trim(),
      taskType:    taskType.trim(),
      description: description ? String(description).trim() || null : null,
      priority:    VALID_PRIORITIES.includes(priority) ? priority : "medium",
      status:      VALID_STATUSES.includes(status)     ? status   : "pending",
      assignedTo:  assignedToNum,
      createdBy:   req.session.userId!,
      dueDate:     dueDate || null,
    }).returning(TASK_SELECT);
    return res.status(201).json(task);
  } catch {
    return res.status(500).json({ error: "فشل في إنشاء المهمة" });
  }
});

/* ─── PATCH /tasks/:id ─── */
router.patch("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "معرّف غير صالح" });

  try {
    const admin = isAdmin(req);
    const [existing] = await db.select(TASK_SELECT).from(tasksTable).where(eq(tasksTable.id, id));
    if (!existing) return res.status(404).json({ error: "المهمة غير موجودة" });

    const now = new Date().toISOString();

    if (admin) {
      // Admin can update everything
      const { title, taskType, description, priority, status, assignedTo, dueDate } = req.body as any;
      const updates: any = { updatedAt: now };
      if (title       !== undefined) updates.title       = String(title).trim();
      if (taskType    !== undefined) updates.taskType    = String(taskType).trim();
      if (description !== undefined) updates.description = description ? String(description).trim() || null : null;
      if (priority    !== undefined) {
        if (!VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: "قيمة الأولوية غير صالحة" });
        updates.priority = priority;
      }
      if (status !== undefined) {
        if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: "قيمة الحالة غير صالحة" });
        updates.status = status;
        if (status === "completed" && existing.status !== "completed") updates.completedAt = now;
      }
      if (assignedTo !== undefined) {
        const n = Number(assignedTo);
        if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ error: "معرّف الموظف غير صالح" });
        updates.assignedTo = n;
      }
      if (dueDate !== undefined) {
        if (dueDate && isNaN(Date.parse(dueDate))) return res.status(400).json({ error: "تاريخ الاستحقاق غير صالح" });
        updates.dueDate = dueDate || null;
      }
      const [updated] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, id)).returning(TASK_SELECT);
      return res.json(updated);
    } else {
      // Employee: can only update their own task notes + status (pending↔in_progress)
      if (existing.assignedTo !== req.session.userId) return res.status(403).json({ error: "ليس لديك صلاحية" });
      const { employeeNotes, status } = req.body as any;
      const updates: any = { updatedAt: now };
      if (employeeNotes !== undefined) {
        updates.employeeNotes    = employeeNotes?.trim() || null;
        updates.notesUpdatedAt   = now;
        updates.notesReadByAdmin = false;   // mark unread for admin
      }
      if (status !== undefined && ["pending", "in_progress"].includes(status)) {
        updates.status = status;
      }
      const [updated] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, id)).returning(TASK_SELECT);
      return res.json(updated);
    }
  } catch {
    return res.status(500).json({ error: "فشل في تحديث المهمة" });
  }
});

/* ─── PATCH /tasks/:id/mark-notes-read ─── admin marks notes as read ── */
router.patch("/:id/mark-notes-read", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "مدير فقط" });
  const id = Number(req.params.id);
  try {
    await db.update(tasksTable)
      .set({ notesReadByAdmin: true, updatedAt: new Date().toISOString() })
      .where(eq(tasksTable.id, id));
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

export default router;
