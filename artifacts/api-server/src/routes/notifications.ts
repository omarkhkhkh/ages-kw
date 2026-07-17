import { Router, type Request, type Response } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

/** يُستخدم من tasks.ts وtask-automation.ts لإنشاء إشعار داخل النظام */
export async function createNotification(data: { recipientUserId: number; type: string; message: string; link?: string | null }) {
  try {
    await db.insert(notificationsTable).values({
      recipientUserId: data.recipientUserId,
      type: data.type,
      message: data.message,
      link: data.link ?? null,
    });
  } catch (err) {
    console.error("failed to create notification", err);
  }
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.recipientUserId, req.session.userId!))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الإشعارات" });
  }
});

router.get("/unread-count", async (req: Request, res: Response) => {
  try {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(notificationsTable)
      .where(and(eq(notificationsTable.recipientUserId, req.session.userId!), eq(notificationsTable.isRead, false)));
    return res.json({ count });
  } catch {
    return res.status(500).json({ error: "فشل" });
  }
});

router.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.update(notificationsTable).set({ isRead: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.recipientUserId, req.session.userId!)));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "فشل" });
  }
});

router.patch("/mark-all-read", async (req: Request, res: Response) => {
  try {
    await db.update(notificationsTable).set({ isRead: true })
      .where(and(eq(notificationsTable.recipientUserId, req.session.userId!), eq(notificationsTable.isRead, false)));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "فشل" });
  }
});

export default router;
