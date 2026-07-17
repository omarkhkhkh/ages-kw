import { pgTable, serial, text, numeric, integer, timestamp, date, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { contractsTable } from "./contracts";
import { directPurchaseOrdersTable } from "./direct-purchase-orders";
import { maintenanceWorkOrdersTable } from "./maintenance";
import { transportationTable } from "./transportation";
import { vehiclesTable } from "./vehicles";
import { workersTable } from "./residency";

export const financeIncomeTable = pgTable("finance_income", {
  id:          serial("id").primaryKey(),
  contractId:  integer("contract_id").references(() => contractsTable.id, { onDelete: "set null" }),
  employeeId:  integer("employee_id").references(() => usersTable.id, { onDelete: "set null" }),
  maintenanceWorkOrderId: integer("maintenance_work_order_id").references(() => maintenanceWorkOrdersTable.id, { onDelete: "set null" }),
  transportationOrderId: integer("transportation_order_id").references(() => transportationTable.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  amount:      numeric("amount", { precision: 15, scale: 3 }).notNull(),
  date:        date("date").notNull(),
  category:    text("category").notNull().default("contract"),
  notes:       text("notes"),
  createdBy:   integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

export const financeExpensesTable = pgTable("finance_expenses", {
  id:          serial("id").primaryKey(),
  contractId:  integer("contract_id").references(() => contractsTable.id, { onDelete: "set null" }),
  purchaseOrderId: integer("purchase_order_id").references(() => directPurchaseOrdersTable.id, { onDelete: "set null" }),
  maintenanceWorkOrderId: integer("maintenance_work_order_id").references(() => maintenanceWorkOrdersTable.id, { onDelete: "set null" }),
  transportationOrderId: integer("transportation_order_id").references(() => transportationTable.id, { onDelete: "set null" }),
  vehicleId:   integer("vehicle_id").references(() => vehiclesTable.id, { onDelete: "set null" }),
  workerId:    integer("worker_id").references(() => workersTable.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  amount:      numeric("amount", { precision: 15, scale: 3 }).notNull(),
  dueDate:     date("due_date"),
  paidDate:    date("paid_date"),
  status:      text("status").notNull().default("pending"), // pending | paid | overdue
  category:    text("category").notNull().default("general"),
  vendor:      text("vendor"),
  notes:       text("notes"),
  createdBy:   integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

export const employeeSalesTable = pgTable("employee_sales", {
  id:                  serial("id").primaryKey(),
  employeeId:          integer("employee_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  contractId:          integer("contract_id").references(() => contractsTable.id, { onDelete: "set null" }),
  description:         text("description").notNull(),
  totalContractAmount: numeric("total_contract_amount", { precision: 15, scale: 3 }), // admin-only
  profitPercentage:    numeric("profit_percentage", { precision: 5, scale: 2 }),       // employee can enter
  profitAmount:        numeric("profit_amount", { precision: 15, scale: 3 }),           // admin-only (computed)
  saleDate:            date("sale_date").notNull(),
  notes:               text("notes"),
  createdBy:           integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt:           timestamp("created_at").notNull().defaultNow(),
  updatedAt:           timestamp("updated_at").notNull().defaultNow(),
});

export type FinanceIncome   = typeof financeIncomeTable.$inferSelect;
export type FinanceExpense  = typeof financeExpensesTable.$inferSelect;
export type EmployeeSale    = typeof employeeSalesTable.$inferSelect;
