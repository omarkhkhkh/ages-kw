import { Router, type Request, type Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  bidResultsTable, bidEntriesTable, bidItemsTable, bidItemPricesTable,
  competitorsTable, tendersTable,
  insertBidResultSchema, insertBidEntrySchema, insertBidItemSchema, insertBidItemPriceSchema,
} from "@workspace/db";
import { z } from "zod";

const router = Router();

/* ── helpers ── */
async function loadFull(bidResultId: number) {
  const [result] = await db.select().from(bidResultsTable).where(eq(bidResultsTable.id, bidResultId));
  if (!result) return null;
  const entries = await db
    .select({ id: bidEntriesTable.id, bidResultId: bidEntriesTable.bidResultId,
               competitorId: bidEntriesTable.competitorId, companyName: bidEntriesTable.companyName,
               totalPrice: bidEntriesTable.totalPrice, rank: bidEntriesTable.rank,
               isWinner: bidEntriesTable.isWinner, isUs: bidEntriesTable.isUs, notes: bidEntriesTable.notes,
             })
    .from(bidEntriesTable)
    .where(eq(bidEntriesTable.bidResultId, bidResultId))
    .orderBy(bidEntriesTable.rank);

  const items = await db.select().from(bidItemsTable).where(eq(bidItemsTable.bidResultId, bidResultId)).orderBy(bidItemsTable.sortOrder);
  const itemPrices = items.length
    ? await db.select().from(bidItemPricesTable).where(
        sql`${bidItemPricesTable.bidItemId} IN (${sql.join(items.map(i => sql`${i.id}`), sql`, `)})`
      )
    : [];

  return {
    ...result,
    entries,
    items: items.map(item => ({
      ...item,
      prices: itemPrices.filter(p => p.bidItemId === item.id),
    })),
  };
}

/* ── recalculate ranks ── */
async function recalcRanks(bidResultId: number) {
  // Rank by total_price ascending (excluding is_us for ranking logic, but including in numbering)
  await db.execute(sql`
    UPDATE bid_entries
    SET rank = sub.rn
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY total_price ASC) AS rn
      FROM bid_entries
      WHERE bid_result_id = ${bidResultId}
    ) sub
    WHERE bid_entries.id = sub.id
  `);
}

/* ── update tender winner/status ── */
async function syncTenderResult(bidResultId: number) {
  const result = await db.select().from(bidResultsTable).where(eq(bidResultsTable.id, bidResultId)).limit(1);
  if (!result[0] || result[0].sourceType !== "tender" || !result[0].tenderId) return;

  const winner = await db.select().from(bidEntriesTable)
    .where(and(eq(bidEntriesTable.bidResultId, bidResultId), eq(bidEntriesTable.isWinner, true)))
    .limit(1);

  if (!winner[0]) return;

  if (winner[0].isUs) {
    await db.update(tendersTable).set({ status: "won" }).where(eq(tendersTable.id, result[0].tenderId!));
  } else {
    await db.update(tendersTable)
      .set({ status: "lost", winner: winner[0].companyName })
      .where(eq(tendersTable.id, result[0].tenderId!));
  }
}

/* GET ?tender_id=X or ?practice_id=X */
router.get("/", async (req: Request, res: Response) => {
  try {
    const tenderId   = req.query.tender_id   ? Number(req.query.tender_id)   : null;
    const practiceId = req.query.practice_id ? Number(req.query.practice_id) : null;

    if (!tenderId && !practiceId) return res.status(400).json({ error: "يجب تحديد tender_id أو practice_id" });

    const cond = tenderId
      ? eq(bidResultsTable.tenderId, tenderId)
      : eq(bidResultsTable.practiceId, practiceId!);

    const results = await db.select().from(bidResultsTable).where(cond);
    if (!results.length) return res.json(null);

    const full = await loadFull(results[0].id);
    return res.json(full);
  } catch {
    return res.status(500).json({ error: "فشل في جلب بيانات الجلسة" });
  }
});

/* POST / — create full session in one transaction */
const createSchema = z.object({
  sourceType:  z.enum(["tender", "practice"]).default("tender"),
  tenderId:    z.number().int().optional().nullable(),
  practiceId:  z.number().int().optional().nullable(),
  openingDate: z.string().optional().nullable(),
  notes:       z.string().optional().nullable(),
  entries: z.array(z.object({
    competitorId: z.number().int().optional().nullable(),
    companyName:  z.string().min(1),
    totalPrice:   z.string().or(z.number()).transform(String),
    isWinner:     z.boolean().default(false),
    isUs:         z.boolean().default(false),
    notes:        z.string().optional().nullable(),
  })).min(1),
  items: z.array(z.object({
    itemName:  z.string().min(1),
    itemType:  z.string().optional().nullable(),
    unit:      z.string().optional().nullable(),
    quantity:  z.string().or(z.number()).transform(String).optional().nullable(),
    sortOrder: z.number().int().default(0),
    prices: z.array(z.object({
      entryIndex: z.number().int(),   // index into entries array
      unitPrice:  z.string().or(z.number()).transform(String),
    })).optional().default([]),
  })).optional().default([]),
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = createSchema.parse(req.body);

    // Check uniqueness before transaction
    if (body.tenderId) {
      const existing = await db.select({ id: bidResultsTable.id }).from(bidResultsTable)
        .where(eq(bidResultsTable.tenderId, body.tenderId)).limit(1);
      if (existing.length) return res.status(409).json({ error: "يوجد جلسة فض مسجلة لهذه المناقصة مسبقاً" });
    }
    if (body.practiceId) {
      const existing = await db.select({ id: bidResultsTable.id }).from(bidResultsTable)
        .where(eq(bidResultsTable.practiceId, body.practiceId)).limit(1);
      if (existing.length) return res.status(409).json({ error: "يوجد جلسة فض مسجلة لهذه الممارسة مسبقاً" });
    }

    const bidResultId = await db.transaction(async (tx) => {
      const [bidResult] = await tx.insert(bidResultsTable).values({
        sourceType:  body.sourceType,
        tenderId:    body.tenderId   ?? null,
        practiceId:  body.practiceId ?? null,
        openingDate: body.openingDate ?? null,
        notes:       body.notes ?? null,
      }).returning();

      const insertedEntries: { id: number }[] = [];
      for (const e of body.entries) {
        const [entry] = await tx.insert(bidEntriesTable).values({
          bidResultId:  bidResult.id,
          competitorId: e.competitorId ?? null,
          companyName:  e.companyName,
          totalPrice:   e.totalPrice,
          isWinner:     e.isWinner,
          isUs:         e.isUs,
          notes:        e.notes ?? null,
        }).returning({ id: bidEntriesTable.id });
        insertedEntries.push(entry);
      }

      for (const item of body.items) {
        const [insertedItem] = await tx.insert(bidItemsTable).values({
          bidResultId: bidResult.id,
          itemName:    item.itemName,
          itemType:    item.itemType ?? null,
          unit:        item.unit ?? null,
          quantity:    item.quantity ?? null,
          sortOrder:   item.sortOrder,
        }).returning({ id: bidItemsTable.id });

        for (const price of item.prices ?? []) {
          const entry = insertedEntries[price.entryIndex];
          if (!entry) continue;
          await tx.insert(bidItemPricesTable).values({
            bidItemId:  insertedItem.id,
            bidEntryId: entry.id,
            unitPrice:  price.unitPrice,
          });
        }
      }
      return bidResult.id;
    });

    await recalcRanks(bidResultId);
    await syncTenderResult(bidResultId);
    const full = await loadFull(bidResultId);
    return res.status(201).json(full);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في حفظ جلسة الفض" });
  }
});

/* PUT /:id — replace full session */
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id   = Number(req.params.id);
    const body = createSchema.parse(req.body);

    const [existing] = await db.select().from(bidResultsTable).where(eq(bidResultsTable.id, id));
    if (!existing) return res.status(404).json({ error: "الجلسة غير موجودة" });

    await db.transaction(async (tx) => {
      await tx.delete(bidEntriesTable).where(eq(bidEntriesTable.bidResultId, id));
      await tx.delete(bidItemsTable).where(eq(bidItemsTable.bidResultId, id));

      await tx.update(bidResultsTable).set({
        openingDate: body.openingDate ?? null,
        notes:       body.notes ?? null,
      }).where(eq(bidResultsTable.id, id));

      const insertedEntries: { id: number }[] = [];
      for (const e of body.entries) {
        const [entry] = await tx.insert(bidEntriesTable).values({
          bidResultId:  id,
          competitorId: e.competitorId ?? null,
          companyName:  e.companyName,
          totalPrice:   e.totalPrice,
          isWinner:     e.isWinner,
          isUs:         e.isUs,
          notes:        e.notes ?? null,
        }).returning({ id: bidEntriesTable.id });
        insertedEntries.push(entry);
      }

      for (const item of body.items) {
        const [insertedItem] = await tx.insert(bidItemsTable).values({
          bidResultId: id,
          itemName:    item.itemName,
          itemType:    item.itemType ?? null,
          unit:        item.unit ?? null,
          quantity:    item.quantity ?? null,
          sortOrder:   item.sortOrder,
        }).returning({ id: bidItemsTable.id });

        for (const price of item.prices ?? []) {
          const entry = insertedEntries[price.entryIndex];
          if (!entry) continue;
          await tx.insert(bidItemPricesTable).values({
            bidItemId:  insertedItem.id,
            bidEntryId: entry.id,
            unitPrice:  price.unitPrice,
          });
        }
      }
    });

    await recalcRanks(id);
    await syncTenderResult(id);
    const full = await loadFull(id);
    return res.json(full);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث جلسة الفض" });
  }
});

/* DELETE /:id */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(bidResultsTable).where(eq(bidResultsTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الجلسة" });
  }
});

export default router;
