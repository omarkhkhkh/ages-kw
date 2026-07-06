---
name: Finance module access control
description: Critical access control rules for the Finance module (finance_income, finance_expenses, employee_sales tables)
---

## Rules

1. **Admin-only endpoints**: GET/POST/PATCH/DELETE `/finance/income` and `/finance/expenses` require `isAdmin(req)` — return 403 for employees.

2. **employee_sales masked fields**: `totalContractAmount` and `profitAmount` are admin-only. Non-admin responses strip these fields via destructuring before `res.json()`. Non-admin POSTs ignore `totalContractAmount` entirely.

3. **PATCH /finance/sales/:id ownership check**: Load the existing record first. If `!admin && existing[0].employeeId !== req.session.userId` → return 403. This prevents IDOR (employee updating another employee's records).

4. **DELETE /finance/sales/:id** — admin only.

5. **GET /finance/sales**: Admin sees all rows + masked fields. Employee sees only own rows, no masked fields (query uses `WHERE employee_id = $1` for non-admins).

**Why:** The profit margin (profitAmount) and total contract value (totalContractAmount) are commercially sensitive. Employees may only enter their own profitPercentage; the monetary result is visible only to the admin.

**How to apply:** Any new PATCH/DELETE route on employee_sales must include the ownership check pattern before allowing the update.
