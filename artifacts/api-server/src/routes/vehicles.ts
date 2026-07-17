import { Router, type Request, type Response } from "express";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  pool,
  vehiclesTable,
  insertVehicleSchema,
  updateVehicleSchema,
  vehicleFuelLogsTable,
  insertVehicleFuelLogSchema,
  vehicleServiceLogsTable,
  insertVehicleServiceLogSchema,
  vehicleServicePartsTable,
  insertVehicleServicePartSchema,
  financeExpensesTable,
} from "@workspace/db";

const router = Router();

/* ══════════════════════════════════════════════════════════════════
   IMPORTANT: static routes (/stats) MUST be registered before /:id
══════════════════════════════════════════════════════════════════ */

// GET /vehicles/ — list, optional ?status= and ?search=
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query as Record<string, string>;
    const conditions: SQL[] = [];
    if (status) conditions.push(eq(vehiclesTable.status, status));
    if (search) {
      conditions.push(or(
        ilike(vehiclesTable.plateNumber, `%${search}%`),
        ilike(vehiclesTable.makeModel, `%${search}%`),
        ilike(vehiclesTable.driverName, `%${search}%`),
      )!);
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await db.select().from(vehiclesTable).where(where).orderBy(desc(vehiclesTable.createdAt));
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب المركبات" });
  }
});

// GET /vehicles/stats — dashboard counters
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [row] = await db.select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where status = 'active')::int`,
      maintenance: sql<number>`count(*) filter (where status = 'maintenance')::int`,
      outOfService: sql<number>`count(*) filter (where status = 'out_of_service')::int`,
      expiring30: sql<number>`count(*) filter (
        where (registration_expiry between current_date and current_date + interval '30 days')
           or (insurance_expiry between current_date and current_date + interval '30 days')
      )::int`,
      expired: sql<number>`count(*) filter (
        where registration_expiry < current_date or insurance_expiry < current_date
      )::int`,
    }).from(vehiclesTable);
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في جلب إحصائيات المركبات" });
  }
});

/* ══════════════════════════════════════
   FUEL LOGS (سجل الوقود) — static paths before /:id
══════════════════════════════════════ */

// GET /vehicles/:id/fuel-logs
router.get("/:id/fuel-logs", async (req: Request, res: Response) => {
  try {
    const vehicleId = Number(req.params.id);
    const rows = await db.select().from(vehicleFuelLogsTable)
      .where(eq(vehicleFuelLogsTable.vehicleId, vehicleId))
      .orderBy(desc(vehicleFuelLogsTable.date));
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب سجل الوقود" });
  }
});

// POST /vehicles/:id/fuel-logs — creates a fuel log + a linked finance_expense
router.post("/:id/fuel-logs", async (req: Request, res: Response) => {
  try {
    const vehicleId = Number(req.params.id);
    const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicleId));
    if (!vehicle) return res.status(404).json({ error: "المركبة غير موجودة" });

    const liters = Number(req.body.liters);
    const pricePerLiter = Number(req.body.pricePerLiter);
    const totalCost = req.body.totalCost != null && req.body.totalCost !== ""
      ? Number(req.body.totalCost)
      : liters * pricePerLiter;

    const data = insertVehicleFuelLogSchema.parse({
      ...req.body,
      vehicleId,
      liters: String(liters),
      pricePerLiter: String(pricePerLiter),
      totalCost: String(totalCost.toFixed(3)),
    });

    const [log] = await db.insert(vehicleFuelLogsTable).values({ ...data, createdBy: req.session.userId! }).returning();

    await db.insert(financeExpensesTable).values({
      vehicleId,
      description: `تعبئة وقود - ${vehicle.plateNumber}`,
      amount: data.totalCost,
      category: "fuel",
      status: "paid",
      dueDate: data.date,
      paidDate: data.date,
      createdBy: req.session.userId!,
    });

    return res.status(201).json(log);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة سجل الوقود" });
  }
});

// DELETE /vehicles/fuel-logs/:logId
router.delete("/fuel-logs/:logId", async (req: Request, res: Response) => {
  try {
    await db.delete(vehicleFuelLogsTable).where(eq(vehicleFuelLogsTable.id, Number(req.params.logId)));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف سجل الوقود" });
  }
});

/* ══════════════════════════════════════
   SERVICE LOGS (سجل السيرفس) — static paths before /:id
══════════════════════════════════════ */

// GET /vehicles/:id/service-logs
router.get("/:id/service-logs", async (req: Request, res: Response) => {
  try {
    const vehicleId = Number(req.params.id);
    const rows = await db.select().from(vehicleServiceLogsTable)
      .where(eq(vehicleServiceLogsTable.vehicleId, vehicleId))
      .orderBy(desc(vehicleServiceLogsTable.serviceDate));
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب سجل السيرفس" });
  }
});

// POST /vehicles/:id/service-logs — creates a service log + a linked finance_expense
router.post("/:id/service-logs", async (req: Request, res: Response) => {
  try {
    const vehicleId = Number(req.params.id);
    const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicleId));
    if (!vehicle) return res.status(404).json({ error: "المركبة غير موجودة" });

    const data = insertVehicleServiceLogSchema.parse({
      ...req.body,
      vehicleId,
      cost: String(Number(req.body.cost)),
    });

    const [log] = await db.insert(vehicleServiceLogsTable).values({ ...data, createdBy: req.session.userId! }).returning();

    await db.insert(financeExpensesTable).values({
      vehicleId,
      description: `سيرفس - ${vehicle.plateNumber}${data.workshopName ? ` (${data.workshopName})` : ""}`,
      amount: data.cost,
      category: "vehicle_service",
      status: "paid",
      dueDate: data.serviceDate,
      paidDate: data.serviceDate,
      createdBy: req.session.userId!,
    });

    return res.status(201).json(log);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة سجل السيرفس" });
  }
});

// DELETE /vehicles/service-logs/:logId
router.delete("/service-logs/:logId", async (req: Request, res: Response) => {
  try {
    await db.delete(vehicleServiceLogsTable).where(eq(vehicleServiceLogsTable.id, Number(req.params.logId)));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف سجل السيرفس" });
  }
});

/* ══════════════════════════════════════
   SERVICE PARTS (قطع غيار مرتبطة بالمخزون) — static paths before /:id
══════════════════════════════════════ */

// GET /vehicles/service-logs/:id/parts
router.get("/service-logs/:id/parts", async (req: Request, res: Response) => {
  try {
    const serviceLogId = Number(req.params.id);
    const rows = await db.select().from(vehicleServicePartsTable)
      .where(eq(vehicleServicePartsTable.serviceLogId, serviceLogId));
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب قطع الغيار" });
  }
});

// POST /vehicles/service-logs/:id/parts — decrements maintenance inventory stock if linked
router.post("/service-logs/:id/parts", async (req: Request, res: Response) => {
  try {
    const serviceLogId = Number(req.params.id);
    const data = insertVehicleServicePartSchema.parse({
      ...req.body,
      serviceLogId,
      inventoryItemId: req.body.inventoryItemId ? Number(req.body.inventoryItemId) : null,
      quantity: req.body.quantity != null && req.body.quantity !== "" ? String(req.body.quantity) : "1",
      unitCost: req.body.unitCost != null && req.body.unitCost !== "" ? String(req.body.unitCost) : null,
    });

    const [part] = await db.insert(vehicleServicePartsTable).values(data).returning();

    if (part.inventoryItemId) {
      await pool.query(
        `UPDATE maintenance_inventory SET quantity_on_hand = quantity_on_hand - $1, updated_at = now() WHERE id = $2`,
        [part.quantity, part.inventoryItemId]
      );
    }

    return res.status(201).json(part);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة القطعة" });
  }
});

// DELETE /vehicles/service-parts/:id — restores inventory stock if linked
router.delete("/service-parts/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [part] = await db.select().from(vehicleServicePartsTable).where(eq(vehicleServicePartsTable.id, id));
    if (!part) return res.status(404).json({ error: "القطعة غير موجودة" });

    if (part.inventoryItemId) {
      await pool.query(
        `UPDATE maintenance_inventory SET quantity_on_hand = quantity_on_hand + $1, updated_at = now() WHERE id = $2`,
        [part.quantity, part.inventoryItemId]
      );
    }

    await db.delete(vehicleServicePartsTable).where(eq(vehicleServicePartsTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف القطعة" });
  }
});

// GET /vehicles/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, id));
    if (!row) return res.status(404).json({ error: "المركبة غير موجودة" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في جلب المركبة" });
  }
});

// POST /vehicles/
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertVehicleSchema.parse(req.body);
    const [row] = await db.insert(vehiclesTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? "بيانات غير صالحة" });
  }
});

// PATCH /vehicles/:id
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateVehicleSchema.parse(req.body);
    const [row] = await db.update(vehiclesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vehiclesTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "المركبة غير موجودة" });
    return res.json(row);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? "بيانات غير صالحة" });
  }
});

// DELETE /vehicles/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(vehiclesTable).where(eq(vehiclesTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف المركبة" });
  }
});

export default router;
