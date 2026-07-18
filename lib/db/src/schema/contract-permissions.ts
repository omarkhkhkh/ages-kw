import { pgTable, integer, boolean, primaryKey } from "drizzle-orm/pg-core";
import { contractsTable } from "./contracts";
import { usersTable } from "./users";

/* كان هذا الجدول مستخدمًا في المسارات (إخفاء عقود محددة عن موظفين محددين)
   لكنه لم يكن معرّفًا في الـschema، فلم يُنشأ في قواعد Docker/الإنتاج —
   ما سبّب 500 لكل موظف يفتح قائمة العقود. */
export const contractPermissionsTable = pgTable(
  "contract_permissions",
  {
    contractId: integer("contract_id").notNull().references(() => contractsTable.id, { onDelete: "cascade" }),
    userId:     integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    canView:    boolean("can_view").notNull().default(true),
  },
  (t) => ({ pk: primaryKey({ columns: [t.contractId, t.userId] }) })
);
