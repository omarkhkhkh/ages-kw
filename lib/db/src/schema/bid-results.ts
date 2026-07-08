import { pgTable, serial, text, numeric, timestamp, date, integer, boolean, smallint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tendersTable } from "./tenders";
import { practicesTable } from "./practices";
import { competitorsTable } from "./competitors";

/* ── جلسة فض العطاء ── */
export const bidResultsTable = pgTable("bid_results", {
  id:          serial("id").primaryKey(),
  sourceType:  text("source_type").notNull().default("tender"), // 'tender' | 'practice'
  tenderId:    integer("tender_id").references(() => tendersTable.id,   { onDelete: "cascade" }),
  practiceId:  integer("practice_id").references(() => practicesTable.id, { onDelete: "cascade" }),
  openingDate: date("opening_date"),
  notes:       text("notes"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

/* ── إدخال كل شركة في الجلسة ── */
export const bidEntriesTable = pgTable("bid_entries", {
  id:           serial("id").primaryKey(),
  bidResultId:  integer("bid_result_id").notNull().references(() => bidResultsTable.id, { onDelete: "cascade" }),
  competitorId: integer("competitor_id").references(() => competitorsTable.id, { onDelete: "set null" }),
  companyName:  text("company_name").notNull(),
  totalPrice:   numeric("total_price", { precision: 15, scale: 3 }).notNull(),
  rank:         smallint("rank"),
  isWinner:     boolean("is_winner").notNull().default(false),
  isUs:         boolean("is_us").notNull().default(false),
  notes:        text("notes"),
});

/* ── بنود المناقصة ── */
export const bidItemsTable = pgTable("bid_items", {
  id:           serial("id").primaryKey(),
  bidResultId:  integer("bid_result_id").notNull().references(() => bidResultsTable.id, { onDelete: "cascade" }),
  itemName:     text("item_name").notNull(),
  itemType:     text("item_type"),
  unit:         text("unit"),
  quantity:     numeric("quantity", { precision: 12, scale: 3 }),
  sortOrder:    smallint("sort_order").notNull().default(0),
});

/* ── سعر كل شركة لكل بند ── */
export const bidItemPricesTable = pgTable("bid_item_prices", {
  id:          serial("id").primaryKey(),
  bidItemId:   integer("bid_item_id").notNull().references(() => bidItemsTable.id,  { onDelete: "cascade" }),
  bidEntryId:  integer("bid_entry_id").notNull().references(() => bidEntriesTable.id, { onDelete: "cascade" }),
  unitPrice:   numeric("unit_price", { precision: 15, scale: 3 }).notNull(),
  notes:       text("notes"),
});

export const insertBidResultSchema = createInsertSchema(bidResultsTable).omit({ id: true, createdAt: true });
export const insertBidEntrySchema  = createInsertSchema(bidEntriesTable).omit({ id: true });
export const insertBidItemSchema   = createInsertSchema(bidItemsTable).omit({ id: true });
export const insertBidItemPriceSchema = createInsertSchema(bidItemPricesTable).omit({ id: true });

export type BidResult     = typeof bidResultsTable.$inferSelect;
export type BidEntry      = typeof bidEntriesTable.$inferSelect;
export type BidItem       = typeof bidItemsTable.$inferSelect;
export type BidItemPrice  = typeof bidItemPricesTable.$inferSelect;
