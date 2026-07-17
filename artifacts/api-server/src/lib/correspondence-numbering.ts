import { sql } from "drizzle-orm";
import { db, governmentEntitiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type LetterSourceType = "tender" | "practice" | "contract" | "purchase_order" | "supplier" | "project" | "government_entity" | null | undefined;

const FIXED_PREFIXES: Record<string, [string, string]> = {
  tender:          ["tenders", "TND"],
  practice:        ["practices", "PRC"],
  contract:        ["contracts", "CON"],
  purchase_order:  ["purchase_orders", "PO"],
  supplier:        ["suppliers", "SUP"],
  project:         ["projects", "PRJ"],
};

/**
 * Generates the next sequential correspondence letter number for a given scope,
 * e.g. "MOE-2026-0001". Must be called inside the same db.transaction that inserts
 * the letter row, so the number and the row commit or roll back together.
 */
export async function generateLetterNumber(
  tx: Pick<typeof db, "select" | "execute">,
  params: { governmentEntityId?: number | null; sourceType?: LetterSourceType },
): Promise<string> {
  const year = new Date().getFullYear();
  let scopeType: string;
  let scopeId: number;
  let prefix: string;

  if (params.governmentEntityId) {
    const [entity] = await tx
      .select({ codePrefix: governmentEntitiesTable.codePrefix })
      .from(governmentEntitiesTable)
      .where(eq(governmentEntitiesTable.id, params.governmentEntityId));
    scopeType = "government_entity";
    scopeId = params.governmentEntityId;
    prefix = entity?.codePrefix || `GEN${params.governmentEntityId}`;
  } else {
    const [fixedScope, fixedPrefix] = (params.sourceType && FIXED_PREFIXES[params.sourceType]) || ["general", "GEN"];
    scopeType = fixedScope;
    scopeId = 0;
    prefix = fixedPrefix;
  }

  // Idempotently create the sequence row if this is the first letter for this scope/year.
  await tx.execute(sql`
    INSERT INTO correspondence_sequences (scope_type, scope_id, prefix, year, last_number)
    VALUES (${scopeType}, ${scopeId}, ${prefix}, ${year}, 0)
    ON CONFLICT (scope_type, scope_id, year) DO NOTHING
  `);

  // Lock the row so concurrent creates for the same scope serialize here instead of racing.
  const lockResult = await tx.execute(sql`
    SELECT id, last_number AS "lastNumber" FROM correspondence_sequences
    WHERE scope_type = ${scopeType} AND scope_id = ${scopeId} AND year = ${year}
    FOR UPDATE
  `);
  const row = (lockResult as any).rows?.[0] ?? (lockResult as any)[0];
  const nextNumber = Number(row.lastNumber) + 1;

  await tx.execute(sql`
    UPDATE correspondence_sequences SET last_number = ${nextNumber}, updated_at = now()
    WHERE id = ${row.id}
  `);

  return `${prefix}-${year}-${String(nextNumber).padStart(4, "0")}`;
}

/**
 * Voids a letter's number when it's cancelled. If the letter holds the LAST
 * number issued for its scope/year, the sequence counter is rolled back so the
 * very next letter created in that scope reuses the number — a true "undo".
 * If other letters were already issued after it, the number can't be safely
 * reclaimed (would risk a future duplicate), so it stays reserved/burnt.
 *
 * Must be called inside the same db.transaction that marks the letter cancelled.
 */
export async function cancelLetterNumber(
  tx: Pick<typeof db, "execute">,
  letterNumber: string,
): Promise<{ reclaimed: boolean }> {
  const match = /^(.+)-(\d{4})-(\d{4,})$/.exec(letterNumber);
  if (!match) return { reclaimed: false };
  const [, prefix, yearStr, seqStr] = match;
  const year = Number(yearStr);
  const seq = Number(seqStr);

  // Lock the sequence row for this prefix/year so a concurrent create can't race the reclaim.
  const lockResult = await tx.execute(sql`
    SELECT id, last_number AS "lastNumber" FROM correspondence_sequences
    WHERE prefix = ${prefix} AND year = ${year}
    FOR UPDATE
  `);
  const row = (lockResult as any).rows?.[0] ?? (lockResult as any)[0];
  if (!row) return { reclaimed: false };

  if (Number(row.lastNumber) === seq) {
    await tx.execute(sql`
      UPDATE correspondence_sequences SET last_number = ${seq - 1}, updated_at = now()
      WHERE id = ${row.id}
    `);
    return { reclaimed: true };
  }
  return { reclaimed: false };
}
