import { pgTable, integer, boolean, primaryKey } from "drizzle-orm/pg-core";
import { tendersTable } from "./tenders";
import { usersTable } from "./users";

export const tenderPermissionsTable = pgTable(
  "tender_permissions",
  {
    tenderId: integer("tender_id").notNull().references(() => tendersTable.id, { onDelete: "cascade" }),
    userId:   integer("user_id").notNull().references(() => usersTable.id,   { onDelete: "cascade" }),
    canView:  boolean("can_view").notNull().default(true),
  },
  (t) => ({ pk: primaryKey({ columns: [t.tenderId, t.userId] }) })
);
