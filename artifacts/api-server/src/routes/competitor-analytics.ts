import { Router, type Request, type Response } from "express";
import { sql, eq, and, gte, lte, isNotNull, isNull, ne } from "drizzle-orm";
import { db, bidResultsTable, bidEntriesTable, bidItemsTable, bidItemPricesTable, competitorsTable, tendersTable } from "@workspace/db";

const router = Router();

/* ═══════════════════════════════════════════════════════
   GET /summary — leaderboard جدول ترتيب المنافسين
   params: source_type?, tender_type?, date_from?, date_to?
   ═══════════════════════════════════════════════════════ */
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const { source_type, tender_type, date_from, date_to } = req.query as Record<string, string>;

    const rows = await db.execute(sql`
      WITH us_prices AS (
        SELECT be_us.bid_result_id, be_us.total_price AS our_price
        FROM bid_entries be_us
        WHERE be_us.is_us = true
      ),
      competitor_bids AS (
        SELECT
          be.competitor_id,
          be.company_name,
          be.bid_result_id,
          be.total_price,
          be.is_winner,
          be.rank,
          up.our_price,
          br.source_type,
          br.opening_date,
          t.tender_type,
          t.government_entity_id
        FROM bid_entries be
        JOIN bid_results br ON br.id = be.bid_result_id
        LEFT JOIN us_prices up ON up.bid_result_id = be.bid_result_id
        LEFT JOIN tenders t ON t.id = br.tender_id
        WHERE be.is_us = false
          ${source_type && source_type !== "all" ? sql`AND br.source_type = ${source_type}` : sql``}
          ${tender_type ? sql`AND t.tender_type = ${tender_type}` : sql``}
          ${date_from ? sql`AND br.opening_date >= ${date_from}` : sql``}
          ${date_to   ? sql`AND br.opening_date <= ${date_to}`   : sql``}
      )
      SELECT
        competitor_id,
        MAX(company_name) AS company_name,
        COUNT(*)::int AS total_bids,
        SUM(CASE WHEN is_winner THEN 1 ELSE 0 END)::int AS wins,
        ROUND(AVG(
          CASE WHEN our_price IS NOT NULL AND our_price::numeric > 0
               THEN (total_price::numeric / our_price::numeric - 1) * 100
               ELSE NULL END
        ), 2) AS avg_diff_pct,
        MAX(opening_date) AS last_seen
      FROM competitor_bids
      WHERE competitor_id IS NOT NULL
      GROUP BY competitor_id
      ORDER BY total_bids DESC, wins DESC
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب ملخص المنافسين" });
  }
});

/* /:id handler is declared at the END of the file — after all static paths */

/* ═══════════════════════════════════════════════════════
   GET /gap-analysis — إحصاءات الفارق 1st-2nd
   ═══════════════════════════════════════════════════════ */
router.get("/gap-analysis", async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      WITH ranked AS (
        SELECT
          br.id AS session_id,
          br.opening_date,
          MIN(CASE WHEN be.rank = 1 THEN be.total_price::numeric END) AS first_price,
          MIN(CASE WHEN be.rank = 2 THEN be.total_price::numeric END) AS second_price
        FROM bid_results br
        JOIN bid_entries be ON be.bid_result_id = br.id
        GROUP BY br.id, br.opening_date
        HAVING MIN(CASE WHEN be.rank = 1 THEN be.total_price::numeric END) IS NOT NULL
           AND MIN(CASE WHEN be.rank = 2 THEN be.total_price::numeric END) IS NOT NULL
      )
      SELECT
        COUNT(*)::int AS total_sessions,
        ROUND(AVG((second_price - first_price) / NULLIF(first_price,0) * 100), 2) AS avg_gap_pct,
        ROUND(MAX((second_price - first_price) / NULLIF(first_price,0) * 100), 2) AS max_gap_pct,
        ROUND(MIN((second_price - first_price) / NULLIF(first_price,0) * 100), 2) AS min_gap_pct,
        SUM(CASE WHEN (second_price - first_price) / NULLIF(first_price,0) * 100 < 1 THEN 1 ELSE 0 END)::int AS gap_lt_1pct,
        SUM(CASE WHEN (second_price - first_price) / NULLIF(first_price,0) * 100 BETWEEN 1 AND 2 THEN 1 ELSE 0 END)::int AS gap_1_to_2pct,
        SUM(CASE WHEN (second_price - first_price) / NULLIF(first_price,0) * 100 BETWEEN 2 AND 5 THEN 1 ELSE 0 END)::int AS gap_2_to_5pct,
        SUM(CASE WHEN (second_price - first_price) / NULLIF(first_price,0) * 100 > 5 THEN 1 ELSE 0 END)::int AS gap_gt_5pct
      FROM ranked
    `);
    return res.json(result.rows[0] ?? {});
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب تحليل الفجوة" });
  }
});

/* ═══════════════════════════════════════════════════════
   GET /tender-comparison/:tender_id
   جدول مقارنة المناقصة الحالية بالمناقصات المشابهة
   ═══════════════════════════════════════════════════════ */
router.get("/tender-comparison/:tender_id", async (req: Request, res: Response) => {
  try {
    const tenderId = Number(req.params.tender_id);

    // Get current tender info
    const [tender] = await db.select().from(tendersTable).where(eq(tendersTable.id, tenderId));
    if (!tender) return res.status(404).json({ error: "المناقصة غير موجودة" });

    // Find similar tenders that have bid results
    const ourValue = tender.offerValue ? Number(tender.offerValue) : tender.estimatedCost ? Number(tender.estimatedCost) : null;
    const refValue = ourValue ?? 0;
    const minVal = refValue * 0.5;
    const maxVal = refValue > 0 ? refValue * 1.5 : 999999999999;

    const similarTenders = await db.execute(sql`
      SELECT DISTINCT
        t.id, t.project_name, t.tender_type, t.government_entity, t.government_entity_id,
        br.id AS bid_result_id, br.opening_date,
        (SELECT be_us.total_price FROM bid_entries be_us
         WHERE be_us.bid_result_id = br.id AND be_us.is_us = true LIMIT 1) AS our_price,
        (SELECT be_w.company_name FROM bid_entries be_w
         WHERE be_w.bid_result_id = br.id AND be_w.is_winner = true AND be_w.is_us = false LIMIT 1) AS winner_name
      FROM tenders t
      JOIN bid_results br ON br.tender_id = t.id
      WHERE t.id != ${tenderId}
        AND (
          ${tender.governmentEntityId ? sql`t.government_entity_id = ${tender.governmentEntityId}` : sql`t.government_entity = ${tender.governmentEntity ?? ""}`}
          OR t.tender_type = ${tender.tenderType ?? ""}
        )
        ${refValue > 0 ? sql`AND (
          (t.offer_value IS NOT NULL AND t.offer_value::numeric BETWEEN ${minVal} AND ${maxVal})
          OR (t.estimated_cost IS NOT NULL AND t.estimated_cost::numeric BETWEEN ${minVal} AND ${maxVal})
        )` : sql``}
      ORDER BY br.opening_date DESC NULLS LAST
      LIMIT 20
    `);

    if (!similarTenders.rows.length) {
      return res.json({ currentTender: tender, similarTenders: [], competitorMatrix: [] });
    }

    // Load entries for each similar tender's bid result
    const bidResultIds = similarTenders.rows.map((r: any) => r.bid_result_id).filter(Boolean);
    const allEntries = bidResultIds.length ? await db.execute(sql`
      SELECT
        be.bid_result_id, be.competitor_id, be.company_name,
        be.total_price, be.rank, be.is_winner, be.is_us
      FROM bid_entries be
      WHERE be.bid_result_id IN (${sql.join(bidResultIds.map((id: number) => sql`${id}`), sql`, `)})
      ORDER BY be.rank ASC
    `) : { rows: [] };

    // Build competitor matrix
    const competitorMap = new Map<number, any>();
    for (const entry of allEntries.rows as any[]) {
      if (entry.is_us || !entry.competitor_id) continue;
      if (!competitorMap.has(entry.competitor_id)) {
        competitorMap.set(entry.competitor_id, {
          competitor_id: entry.competitor_id,
          company_name:  entry.company_name,
          appearances:   0,
          wins_over_us:  0,
          diffs:         [] as number[],
          per_tender:    [] as any[],
        });
      }
      const c = competitorMap.get(entry.competitor_id)!;
      const similar = (similarTenders.rows as any[]).find(s => s.bid_result_id === entry.bid_result_id);
      if (!similar) continue;

      const ourPrice = similar.our_price ? Number(similar.our_price) : null;
      const theirPrice = Number(entry.total_price);
      const diffPct = ourPrice ? Math.round((theirPrice / ourPrice - 1) * 1000) / 10 : null;

      c.appearances++;
      if (entry.is_winner) c.wins_over_us++;
      if (diffPct !== null) c.diffs.push(diffPct);
      c.per_tender.push({
        bid_result_id: entry.bid_result_id,
        tender_id:     similar.id,
        tender_name:   similar.project_name,
        opening_date:  similar.opening_date,
        total_price:   theirPrice,
        diff_pct:      diffPct,
        rank:          entry.rank,
        is_winner:     entry.is_winner,
      });
    }

    const competitorMatrix = Array.from(competitorMap.values()).map(c => ({
      ...c,
      avg_diff_pct: c.diffs.length ? Math.round(c.diffs.reduce((a: number, b: number) => a + b, 0) / c.diffs.length * 10) / 10 : null,
      min_diff_pct: c.diffs.length ? Math.min(...c.diffs) : null,
      max_diff_pct: c.diffs.length ? Math.max(...c.diffs) : null,
    })).sort((a, b) => b.appearances - a.appearances);

    // Attach entries to similar tenders
    const similarWithEntries = (similarTenders.rows as any[]).map(s => ({
      ...s,
      entries: (allEntries.rows as any[]).filter((e: any) => e.bid_result_id === s.bid_result_id),
    }));

    return res.json({
      currentTender: tender,
      similarTenders: similarWithEntries,
      competitorMatrix,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب تحليل المقارنة" });
  }
});

/* ═══════════════════════════════════════════════════════
   GET /predict?source_type=tender&source_id=X
   تنبؤ إحصائي بأسعار المنافسين
   ═══════════════════════════════════════════════════════ */
router.get("/predict", async (req: Request, res: Response) => {
  try {
    const { source_type, source_id } = req.query as Record<string, string>;
    if (!source_id) return res.status(400).json({ error: "يجب تحديد source_id" });

    const id = Number(source_id);
    let entityId: number | null = null;
    let tenderType: string | null = null;
    let refValue: number = 0;

    if (source_type === "tender" || !source_type) {
      const [t] = await db.select().from(tendersTable).where(eq(tendersTable.id, id));
      if (!t) return res.status(404).json({ error: "المناقصة غير موجودة" });
      entityId  = t.governmentEntityId ?? null;
      tenderType = t.tenderType ?? null;
      refValue  = Number(t.offerValue ?? t.estimatedCost ?? 0);
    }

    const minVal = refValue * 0.6;
    const maxVal = refValue > 0 ? refValue * 1.4 : 999999999999;

    // Find similar sessions
    const similar = await db.execute(sql`
      WITH us_prices AS (
        SELECT be_us.bid_result_id, be_us.total_price::numeric AS our_price
        FROM bid_entries be_us WHERE be_us.is_us = true
      )
      SELECT
        br.id AS bid_result_id,
        be.competitor_id, be.company_name, be.total_price::numeric AS price,
        br.opening_date, up.our_price
      FROM bid_results br
      JOIN bid_entries be ON be.bid_result_id = br.id AND be.is_us = false AND be.competitor_id IS NOT NULL
      JOIN tenders t ON t.id = br.tender_id
      LEFT JOIN us_prices up ON up.bid_result_id = br.id
      WHERE br.source_type = 'tender'
        ${entityId ? sql`AND t.government_entity_id = ${entityId}` : sql``}
        ${tenderType ? sql`AND t.tender_type = ${tenderType}` : sql``}
        ${refValue > 0 ? sql`AND up.our_price BETWEEN ${minVal} AND ${maxVal}` : sql``}
        AND br.opening_date >= NOW() - INTERVAL '4 years'
      ORDER BY br.opening_date DESC
    `);

    // also select br.id for counting unique sessions
    const sessionIds = new Set<number>();
    for (const r of similar.rows as any[]) {
      // Extract session count from a separate map
      if (r.bid_result_id) sessionIds.add(r.bid_result_id);
    }

    // Group by competitor and compute stats
    const compMap = new Map<number, { name: string; prices: number[] }>();
    for (const r of similar.rows as any[]) {
      if (!compMap.has(r.competitor_id)) {
        compMap.set(r.competitor_id, { name: r.company_name, prices: [] });
      }
      compMap.get(r.competitor_id)!.prices.push(Number(r.price));
    }

    const predictions = Array.from(compMap.entries())
      .filter(([, c]) => c.prices.length >= 1)
      .map(([cid, c]) => {
        const mean = c.prices.reduce((a, b) => a + b, 0) / c.prices.length;
        const std  = Math.sqrt(c.prices.reduce((a, b) => a + (b - mean) ** 2, 0) / c.prices.length);
        return {
          competitor_id: cid,
          company_name:  c.name,
          appearances:   c.prices.length,
          mean:          Math.round(mean * 1000) / 1000,
          std:           Math.round(std * 1000) / 1000,
          range_low:     Math.round((mean - std) * 1000) / 1000,
          range_high:    Math.round((mean + std) * 1000) / 1000,
          confidence:    Math.min(95, c.prices.length * 15),
        };
      })
      .sort((a, b) => b.appearances - a.appearances);

    const totalSimilar = sessionIds.size;

    return res.json({
      similar_sessions: totalSimilar,
      can_use_ai:       totalSimilar >= 10,
      predictions,
      ref_value:        refValue,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في حساب التنبؤ" });
  }
});

/* ═══════════════════════════════════════════════════════
   GET /:id — تفاصيل شركة واحدة (MUST be after all static paths)
   ═══════════════════════════════════════════════════════ */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const competitorId = Number(req.params.id);
    if (isNaN(competitorId)) return res.status(400).json({ error: "معرّف غير صالح" });

    const [competitor] = await db.select().from(competitorsTable).where(eq(competitorsTable.id, competitorId));
    if (!competitor) return res.status(404).json({ error: "الشركة غير موجودة" });

    const history = await db.execute(sql`
      WITH us_prices AS (
        SELECT be_us.bid_result_id, be_us.total_price AS our_price
        FROM bid_entries be_us WHERE be_us.is_us = true
      )
      SELECT
        be.id, be.total_price, be.is_winner, be.rank,
        br.id AS bid_result_id, br.source_type, br.opening_date,
        up.our_price,
        ROUND(
          (be.total_price::numeric / NULLIF(up.our_price::numeric,0) - 1) * 100, 2
        ) AS diff_pct,
        t.project_name AS tender_name, t.tender_type,
        t.government_entity AS tender_entity,
        p.project_name AS practice_name, p.government_entity AS practice_entity
      FROM bid_entries be
      JOIN bid_results br ON br.id = be.bid_result_id
      LEFT JOIN us_prices up ON up.bid_result_id = br.id
      LEFT JOIN tenders t ON t.id = br.tender_id
      LEFT JOIN practices p ON p.id = br.practice_id
      WHERE be.competitor_id = ${competitorId}
      ORDER BY br.opening_date DESC NULLS LAST
    `);

    const entityBreakdown = await db.execute(sql`
      WITH us_prices AS (
        SELECT be_us.bid_result_id, be_us.total_price AS our_price
        FROM bid_entries be_us WHERE be_us.is_us = true
      )
      SELECT
        COALESCE(t.government_entity, p.government_entity, 'غير محدد') AS entity,
        COUNT(*)::int AS total,
        SUM(CASE WHEN be.is_winner THEN 1 ELSE 0 END)::int AS their_wins,
        ROUND(AVG(
          CASE WHEN up.our_price IS NOT NULL AND up.our_price::numeric > 0
               THEN (be.total_price::numeric / up.our_price::numeric - 1) * 100
               ELSE NULL END
        ), 2) AS avg_diff_pct
      FROM bid_entries be
      JOIN bid_results br ON br.id = be.bid_result_id
      LEFT JOIN us_prices up ON up.bid_result_id = br.id
      LEFT JOIN tenders t ON t.id = br.tender_id
      LEFT JOIN practices p ON p.id = br.practice_id
      WHERE be.competitor_id = ${competitorId}
      GROUP BY COALESCE(t.government_entity, p.government_entity, 'غير محدد')
      ORDER BY total DESC
    `);

    const itemBreakdown = await db.execute(sql`
      WITH us_entry AS (
        SELECT be_us.id AS entry_id, be_us.bid_result_id
        FROM bid_entries be_us WHERE be_us.is_us = true
      ),
      us_item_prices AS (
        SELECT bip.bid_item_id, bip.unit_price AS our_unit_price
        FROM bid_item_prices bip
        JOIN us_entry ue ON ue.entry_id = bip.bid_entry_id
      )
      SELECT
        bi.item_name,
        COUNT(*)::int AS appearances,
        ROUND(AVG(bip.unit_price::numeric), 3) AS avg_their_price,
        ROUND(AVG(uip.our_unit_price::numeric), 3) AS avg_our_price,
        ROUND(AVG(
          CASE WHEN uip.our_unit_price IS NOT NULL AND uip.our_unit_price::numeric > 0
               THEN (bip.unit_price::numeric / uip.our_unit_price::numeric - 1) * 100
               ELSE NULL END
        ), 2) AS avg_diff_pct
      FROM bid_entries be
      JOIN bid_item_prices bip ON bip.bid_entry_id = be.id
      JOIN bid_items bi ON bi.id = bip.bid_item_id
      LEFT JOIN us_item_prices uip ON uip.bid_item_id = bi.id
      WHERE be.competitor_id = ${competitorId}
      GROUP BY bi.item_name
      ORDER BY appearances DESC
    `);

    return res.json({
      competitor,
      history: history.rows,
      entityBreakdown: entityBreakdown.rows,
      itemBreakdown: itemBreakdown.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب تفاصيل الشركة" });
  }
});

export default router;
