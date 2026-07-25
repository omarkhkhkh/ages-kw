import { pool } from "@workspace/db";

/**
 * مزامنة لحظية لجدول الأصول الموحّد (assets) من الجدولين التشغيليين.
 * كل دالة مُغلّفة بـ try/catch: فشل المزامنة لا يكسر أبدًا العملية التشغيلية الأصلية
 * (المرآة ثانوية؛ الجدول التشغيلي يبقى مصدر الحقيقة). التصنيف للقسم يُحلّ بالاسم،
 * ولا يُلمس cost_center_id عند التحديث حتى لا يُلغى أي إعادة تعيين يدوية للأصل.
 */

export async function upsertAssetFromEquipment(eq: any): Promise<void> {
  if (!eq?.id) return;
  try {
    await pool.query(
      `INSERT INTO assets (cost_center_id, asset_type, name, code, category, status, location, branch, purchase_value, purchase_date, legacy_source, legacy_id, notes)
       VALUES ((SELECT id FROM cost_centers WHERE name='الصيانة'), 'equipment', $1, $2, $3, $4, $5, $6, $7, $8, 'maintenance_equipment', $9, $10)
       ON CONFLICT (legacy_source, legacy_id) DO UPDATE SET name=EXCLUDED.name, code=EXCLUDED.code, category=EXCLUDED.category,
         status=EXCLUDED.status, location=EXCLUDED.location, branch=EXCLUDED.branch, purchase_value=EXCLUDED.purchase_value,
         purchase_date=EXCLUDED.purchase_date, notes=EXCLUDED.notes, updated_at=now()`,
      [eq.name, eq.assetNumber ?? null, eq.category ?? null, eq.status ?? null, eq.location ?? null, eq.branch ?? null,
       eq.purchaseValue ?? null, eq.purchaseDate ?? null, eq.id, eq.notes ?? null]
    );
  } catch (err) { console.error("asset-sync (equipment) failed", err); }
}

export async function upsertAssetFromVehicle(v: any): Promise<void> {
  if (!v?.id) return;
  const name = (v.makeModel && String(v.makeModel).trim()) || v.plateNumber || `مركبة ${v.id}`;
  try {
    await pool.query(
      `INSERT INTO assets (cost_center_id, asset_type, name, code, category, status, purchase_value, purchase_date, legacy_source, legacy_id, notes)
       VALUES ((SELECT id FROM cost_centers WHERE name='النقل'), 'vehicle', $1, $2, $3, $4, $5, $6, 'fleet_vehicles', $7, $8)
       ON CONFLICT (legacy_source, legacy_id) DO UPDATE SET name=EXCLUDED.name, code=EXCLUDED.code, category=EXCLUDED.category,
         status=EXCLUDED.status, purchase_value=EXCLUDED.purchase_value, purchase_date=EXCLUDED.purchase_date, notes=EXCLUDED.notes, updated_at=now()`,
      [name, v.plateNumber ?? null, v.vehicleType ?? null, v.status ?? null, v.purchaseValue ?? null, v.purchaseDate ?? null, v.id, v.notes ?? null]
    );
  } catch (err) { console.error("asset-sync (vehicle) failed", err); }
}

export async function deleteAssetByLegacy(source: "maintenance_equipment" | "fleet_vehicles", legacyId: number): Promise<void> {
  if (!legacyId) return;
  try {
    await pool.query(`DELETE FROM assets WHERE legacy_source=$1 AND legacy_id=$2`, [source, legacyId]);
  } catch (err) { console.error("asset-sync (delete) failed", err); }
}
