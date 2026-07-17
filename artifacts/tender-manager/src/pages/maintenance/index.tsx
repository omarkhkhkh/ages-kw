import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { maintenanceApi, apiFetch, projectsApi, contractsApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { QRCodeSVG } from "qrcode.react";
import {
  Wrench, Plus, X, Save, Trash2, QrCode, ClipboardList,
  Package, Wallet, CalendarClock, LayoutDashboard, AlertTriangle,
  TrendingUp, TrendingDown, Boxes, PlayCircle,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie } from "recharts";

const G = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: GR, marginBottom: 5 };
const cardStyle: React.CSSProperties = { background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "16px 18px" };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 };

export const EQUIPMENT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  operational: { label: "تعمل", color: "#16a34a", bg: "#f0fdf4" },
  needs_maintenance: { label: "تحتاج صيانة", color: "#d97706", bg: "#fffbeb" },
  stopped: { label: "متوقفة", color: "#dc2626", bg: "#fff1f2" },
  out_of_service: { label: "خارج الخدمة", color: "#6b7280", bg: "#f3f4f6" },
  under_repair: { label: "تحت الإصلاح", color: "#2563eb", bg: "#eff6ff" },
};
export const MAINTENANCE_TYPE_LABELS: Record<string, string> = { preventive: "وقائية", corrective: "تصحيحية", emergency: "طارئة", periodic: "دورية" };
export const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: "منخفضة", color: "#6b7280" },
  medium: { label: "متوسطة", color: "#d97706" },
  high: { label: "عالية", color: "#dc2626" },
  critical: { label: "حرجة", color: "#7c3aed" },
};
export const STAGES = [
  { key: "reported", label: "إنشاء البلاغ" },
  { key: "manager_approval", label: "اعتماد المسؤول" },
  { key: "technician_assigned", label: "تعيين الفني" },
  { key: "in_progress", label: "بدء العمل" },
  { key: "parts_requested", label: "طلب قطع غيار" },
  { key: "completed", label: "إنهاء العمل" },
  { key: "manager_review", label: "مراجعة المدير" },
  { key: "closed", label: "إغلاق" },
];
export const STAGE_LABELS: Record<string, string> = Object.fromEntries(STAGES.map(s => [s.key, s.label]));
const FREQ_LABELS: Record<string, string> = {
  daily: "يومية", weekly: "أسبوعية", monthly: "شهرية", quarterly: "ربع سنوية",
  semi_annual: "نصف سنوية", annual: "سنوية", meter_based: "حسب العداد",
};

export function fmt(v: number) { return `${Number(v || 0).toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} د.ك`; }

export function StatCard({ label, value, color, isMoney }: { label: string; value: number | string; color: string; isMoney?: boolean }) {
  return (
    <div style={{ background: "white", borderRadius: 14, border: "1.5px solid #f0ead8", padding: "12px 14px" }}>
      <div style={{ fontSize: isMoney ? 15 : 18, fontWeight: 900, color, direction: isMoney ? "ltr" as const : undefined, textAlign: isMoney ? "right" as const : undefined, lineHeight: 1.1 }}>
        {isMoney ? fmt(Number(value)) : value}
      </div>
      <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 5 }}>{label}</div>
    </div>
  );
}

function Modal({ open, onClose, title, icon: Icon, children, footer, width = 560 }: {
  open: boolean; onClose: () => void; title: string; icon: any; children: React.ReactNode; footer: React.ReactNode; width?: number;
}) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(11,26,16,0.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(6px)" }}>
      <div onClick={(e) => e.stopPropagation()} dir="rtl" style={{ width: "100%", maxWidth: width, maxHeight: "92vh", background: "white", borderRadius: 22, boxShadow: "0 40px 100px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon size={16} color={G} />
            <h2 style={{ color: "white", fontSize: 14.5, fontWeight: 800, margin: 0 }}>{title}</h2>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="white" />
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
        <div style={{ padding: "16px 22px", borderTop: "1px solid #f0ead8", display: "flex", gap: 10, flexShrink: 0, background: "#fdfbf7" }}>{footer}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   DASHBOARD TAB
═══════════════════════════════════════════════════════ */
function DashboardTab() {
  const { data: stats } = useQuery<any>({ queryKey: ["maintenance-stats"], queryFn: () => maintenanceApi.stats() });
  const { data: charts } = useQuery<any>({ queryKey: ["maintenance-charts"], queryFn: () => maintenanceApi.charts() });
  const { data: alerts } = useQuery<any>({ queryKey: ["maintenance-alerts"], queryFn: () => maintenanceApi.alerts() });

  const typeChartData = (charts?.typeComparison ?? []).map((r: any) => ({ name: MAINTENANCE_TYPE_LABELS[r.label] ?? r.label, value: r.count }));
  const PIE_COLORS = [G, "#2563eb", "#dc2626", "#7c3aed"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          <StatCard label="إجمالي المعدات" value={stats.totalEquipment} color={GD} />
          <StatCard label="المعدات العاملة" value={stats.workingEquipment} color="#16a34a" />
          <StatCard label="المعدات المتوقفة" value={stats.stoppedEquipment} color="#dc2626" />
          <StatCard label="الصيانات المجدولة اليوم" value={stats.scheduledToday} color="#2563eb" />
          <StatCard label="الصيانات المتأخرة" value={stats.overdueOrders} color="#dc2626" />
          <StatCard label="عدد البلاغات المفتوحة" value={stats.openTickets} color="#d97706" />
          <StatCard label="تكلفة الصيانة الشهرية" value={stats.monthlyCost} isMoney color="#dc2626" />
          <StatCard label="الميزانية المتبقية" value={stats.remainingBudget} isMoney color={stats.remainingBudget >= 0 ? "#16a34a" : "#dc2626"} />
          <StatCard label="نسبة إنجاز الفريق" value={`${stats.completionRatePct}%`} color="#16a34a" />
          <StatCard label="متوسط زمن الإصلاح (ساعة)" value={stats.mttrHours} color={GD} />
        </div>
      )}

      {alerts && (alerts.upcomingPreventive?.length || alerts.overdueOrders?.length || alerts.lowStock?.length || alerts.recurringFailures?.length || alerts.budgetExceeded) ? (
        <div style={{ ...cardStyle, borderColor: "#fecaca" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={15} color="#dc2626" />
            <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>تنبيهات ذكية</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {alerts.budgetExceeded && (
              <div style={{ padding: "8px 12px", borderRadius: 10, background: "#fff1f2", border: "1px solid #fecaca", fontSize: 12 }}>
                تجاوز الميزانية الشهرية: صُرف {fmt(alerts.budgetExceeded.spent)} من أصل {fmt(alerts.budgetExceeded.budget)}
              </div>
            )}
            {(alerts.overdueOrders ?? []).map((o: any) => (
              <div key={`o${o.id}`} style={{ padding: "8px 12px", borderRadius: 10, background: "#fff1f2", border: "1px solid #fecaca", fontSize: 12 }}>
                أمر صيانة متأخر: {o.orderNumber} — {o.equipmentName} ({STAGE_LABELS[o.stage] ?? o.stage})
              </div>
            ))}
            {(alerts.upcomingPreventive ?? []).map((p: any) => (
              <div key={`p${p.id}`} style={{ padding: "8px 12px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 12 }}>
                صيانة وقائية قريبة: {p.planName} — {p.equipmentName} بتاريخ {p.nextDueDate}
              </div>
            ))}
            {(alerts.lowStock ?? []).map((i: any) => (
              <div key={`i${i.id}`} style={{ padding: "8px 12px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 12 }}>
                مخزون منخفض: {i.partName} ({i.quantityOnHand} متبقي من حد {i.reorderLevel})
              </div>
            ))}
            {(alerts.recurringFailures ?? []).map((f: any) => (
              <div key={`f${f.id}`} style={{ padding: "8px 12px", borderRadius: 10, background: "#fff1f2", border: "1px solid #fecaca", fontSize: 12 }}>
                عطل متكرر: {f.equipmentName} ({f.failureCount} أعطال خلال 90 يوم)
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {charts && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 800, color: GR, margin: "0 0 10px" }}>تكاليف الصيانة شهرياً</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={charts.monthlyCosts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
                <Bar dataKey="total" fill={G} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 800, color: GR, margin: "0 0 10px" }}>أكثر المعدات تعطلًا</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={charts.topFailingEquipment}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
                <Bar dataKey="count" fill="#dc2626" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 800, color: GR, margin: "0 0 10px" }}>أداء الفنيين</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={charts.technicianPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
                <Bar dataKey="count" fill="#2563eb" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 800, color: GR, margin: "0 0 10px" }}>الصيانة الوقائية مقابل التصحيحية</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={typeChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {typeChartData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   EQUIPMENT TAB
═══════════════════════════════════════════════════════ */
const emptyEquipmentForm = {
  assetNumber: "", name: "", category: "", manufacturer: "", model: "", serialNumber: "",
  yearOfManufacture: "", purchaseDate: "", purchaseValue: "", usefulLifeYears: "", warrantyExpiry: "",
  location: "", department: "", branch: "", responsibleUserId: "", status: "operational", notes: "",
};

function EquipmentTab({ canEdit }: { canEdit: boolean }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyEquipmentForm });
  const [qrEquipment, setQrEquipment] = useState<any>(null);

  const { data: equipment = [], isLoading } = useQuery<any[]>({ queryKey: ["maintenance-equipment"], queryFn: () => maintenanceApi.equipment.list() });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["users-directory"], queryFn: () => apiFetch("/api/users/directory") });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const createMut = useMutation({
    mutationFn: (d: any) => maintenanceApi.equipment.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maintenance-equipment"] }); setDrawerOpen(false); setForm({ ...emptyEquipmentForm }); },
  });

  const handleSave = () => {
    if (!form.assetNumber.trim() || !form.name.trim()) return;
    createMut.mutate({
      ...form,
      assetNumber: form.assetNumber.trim(),
      name: form.name.trim(),
      yearOfManufacture: form.yearOfManufacture || null,
      purchaseDate: form.purchaseDate || null,
      purchaseValue: form.purchaseValue || null,
      usefulLifeYears: form.usefulLifeYears || null,
      warrantyExpiry: form.warrantyExpiry || null,
      responsibleUserId: form.responsibleUserId || null,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {canEdit && (
          <button onClick={() => { setForm({ ...emptyEquipmentForm }); setDrawerOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit" }}>
            <Plus size={14} /> معدة جديدة
          </button>
        )}
      </div>

      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>جارِ التحميل...</div>
        ) : equipment.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Boxes size={40} color="#e2d5b0" style={{ margin: "0 auto 10px", display: "block" }} />
            <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>لا توجد معدات مسجّلة</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" }}>
                <tr>
                  {["رقم الأصل", "الاسم", "الفئة", "الموقع", "المسؤول", "الحالة", "QR"].map((h) => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: "#4a3f1a", fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {equipment.map((eq: any) => {
                  const st = EQUIPMENT_STATUS[eq.status] ?? EQUIPMENT_STATUS.operational;
                  return (
                    <tr key={eq.id} onClick={() => navigate(`/maintenance/equipment/${eq.id}`)} style={{ borderBottom: "1px solid #f5f0e6", cursor: "pointer" }}>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#4b5563" }}>{eq.assetNumber}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: GR }}>{eq.name}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{eq.category ?? "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{eq.location ?? "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{eq.responsibleName ?? "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, background: st.bg, color: st.color, fontSize: 11, fontWeight: 700 }}>{st.label}</span>
                      </td>
                      <td style={{ padding: "10px 14px" }} onClick={(e) => { e.stopPropagation(); setQrEquipment(eq); }}>
                        <QrCode size={16} color={GD} style={{ cursor: "pointer" }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={drawerOpen} onClose={() => setDrawerOpen(false)} title="معدة جديدة" icon={Boxes}
        footer={<>
          <button onClick={() => setDrawerOpen(false)} style={{ padding: "10px 20px", borderRadius: 10, background: "white", color: "#6b7280", border: "1.5px solid #e5e7eb", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
          <button onClick={handleSave} disabled={createMut.isPending} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 10, background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            <Save size={14} /> إضافة المعدة
          </button>
        </>}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={lbl}>رقم الأصل *</label><input value={form.assetNumber} onChange={(e) => set("assetNumber", e.target.value)} dir="ltr" style={inp} /></div>
          <div><label style={lbl}>اسم المعدة *</label><input value={form.name} onChange={(e) => set("name", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>الفئة</label><input value={form.category} onChange={(e) => set("category", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>الشركة المصنّعة</label><input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>الموديل</label><input value={form.model} onChange={(e) => set("model", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>الرقم التسلسلي</label><input value={form.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} dir="ltr" style={inp} /></div>
          <div><label style={lbl}>سنة الصنع</label><input type="number" value={form.yearOfManufacture} onChange={(e) => set("yearOfManufacture", e.target.value)} dir="ltr" style={inp} /></div>
          <div><label style={lbl}>تاريخ الشراء</label><input type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>قيمة الشراء (د.ك)</label><input type="number" value={form.purchaseValue} onChange={(e) => set("purchaseValue", e.target.value)} dir="ltr" style={inp} /></div>
          <div><label style={lbl}>العمر الافتراضي (سنوات)</label><input type="number" value={form.usefulLifeYears} onChange={(e) => set("usefulLifeYears", e.target.value)} dir="ltr" style={inp} /></div>
          <div><label style={lbl}>انتهاء الضمان</label><input type="date" value={form.warrantyExpiry} onChange={(e) => set("warrantyExpiry", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>الحالة</label><select value={form.status} onChange={(e) => set("status", e.target.value)} style={inp}>{Object.entries(EQUIPMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div><label style={lbl}>الموقع</label><input value={form.location} onChange={(e) => set("location", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>القسم</label><input value={form.department} onChange={(e) => set("department", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>الفرع</label><input value={form.branch} onChange={(e) => set("branch", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>المسؤول</label><select value={form.responsibleUserId} onChange={(e) => set("responsibleUserId", e.target.value)} style={inp}><option value="">— غير محدد —</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></div>
        </div>
        <div><label style={lbl}>ملاحظات</label><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" } as any} /></div>
      </Modal>

      <Modal open={!!qrEquipment} onClose={() => setQrEquipment(null)} title={`QR — ${qrEquipment?.assetNumber ?? ""}`} icon={QrCode} width={320}
        footer={<button onClick={() => setQrEquipment(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "white", color: "#6b7280", border: "1.5px solid #e5e7eb", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إغلاق</button>}>
        {qrEquipment && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 10 }}>
            <QRCodeSVG value={qrEquipment.assetNumber} size={180} />
            <div style={{ fontSize: 13, fontWeight: 800, color: GR }}>{qrEquipment.name}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{qrEquipment.assetNumber}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   WORK ORDERS TAB
═══════════════════════════════════════════════════════ */
const emptyWoForm = {
  equipmentId: "", maintenanceType: "corrective", reportReason: "", priority: "medium",
  location: "", assignedTechnicianId: "", projectId: "", contractId: "", notes: "",
};

function WorkOrdersTab({ canEdit }: { canEdit: boolean }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyWoForm });

  const { data: workOrders = [], isLoading } = useQuery<any[]>({ queryKey: ["maintenance-work-orders"], queryFn: () => maintenanceApi.workOrders.list() });
  const { data: equipment = [] } = useQuery<any[]>({ queryKey: ["maintenance-equipment"], queryFn: () => maintenanceApi.equipment.list() });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["users-directory"], queryFn: () => apiFetch("/api/users/directory") });
  const { data: projects = [] } = useQuery<any[]>({ queryKey: ["projects"], queryFn: () => projectsApi.list() });
  const { data: contracts = [] } = useQuery<any[]>({ queryKey: ["contracts", "all"], queryFn: () => contractsApi.list() });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const createMut = useMutation({
    mutationFn: (d: any) => maintenanceApi.workOrders.create(d),
    onSuccess: (row: any) => { qc.invalidateQueries({ queryKey: ["maintenance-work-orders"] }); setDrawerOpen(false); setForm({ ...emptyWoForm }); navigate(`/maintenance/work-orders/${row.id}`); },
  });

  const handleSave = () => {
    if (!form.equipmentId || !form.reportReason.trim()) return;
    createMut.mutate({
      ...form,
      equipmentId: Number(form.equipmentId),
      assignedTechnicianId: form.assignedTechnicianId ? Number(form.assignedTechnicianId) : null,
      projectId: form.projectId ? Number(form.projectId) : null,
      contractId: form.contractId ? Number(form.contractId) : null,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {canEdit && (
          <button onClick={() => { setForm({ ...emptyWoForm }); setDrawerOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit" }}>
            <Plus size={14} /> أمر صيانة جديد
          </button>
        )}
      </div>

      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>جارِ التحميل...</div>
        ) : workOrders.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <ClipboardList size={40} color="#e2d5b0" style={{ margin: "0 auto 10px", display: "block" }} />
            <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>لا توجد أوامر صيانة</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" }}>
                <tr>
                  {["رقم الأمر", "المعدة", "النوع", "الأولوية", "المرحلة", "الفني", "تاريخ البلاغ"].map((h) => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: "#4a3f1a", fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo: any) => {
                  const pr = PRIORITY_MAP[wo.priority] ?? PRIORITY_MAP.medium;
                  return (
                    <tr key={wo.id} onClick={() => navigate(`/maintenance/work-orders/${wo.id}`)} style={{ borderBottom: "1px solid #f5f0e6", cursor: "pointer" }}>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 700, color: GR }}>{wo.orderNumber}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{wo.equipmentName ?? "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{MAINTENANCE_TYPE_LABELS[wo.maintenanceType] ?? wo.maintenanceType}</td>
                      <td style={{ padding: "10px 14px" }}><span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${pr.color}15`, color: pr.color }}>{pr.label}</span></td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{STAGE_LABELS[wo.stage] ?? wo.stage}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{wo.technicianName ?? "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{wo.reportDate ? new Date(wo.reportDate).toLocaleDateString("ar-KW") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={drawerOpen} onClose={() => setDrawerOpen(false)} title="أمر صيانة جديد" icon={ClipboardList}
        footer={<>
          <button onClick={() => setDrawerOpen(false)} style={{ padding: "10px 20px", borderRadius: 10, background: "white", color: "#6b7280", border: "1.5px solid #e5e7eb", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
          <button onClick={handleSave} disabled={createMut.isPending} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 10, background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            <Save size={14} /> إنشاء الأمر
          </button>
        </>}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={lbl}>المعدة *</label><select value={form.equipmentId} onChange={(e) => set("equipmentId", e.target.value)} style={inp}><option value="">— اختر —</option>{equipment.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.name} ({eq.assetNumber})</option>)}</select></div>
          <div><label style={lbl}>نوع الصيانة</label><select value={form.maintenanceType} onChange={(e) => set("maintenanceType", e.target.value)} style={inp}>{Object.entries(MAINTENANCE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label style={lbl}>الأولوية</label><select value={form.priority} onChange={(e) => set("priority", e.target.value)} style={inp}>{Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div><label style={lbl}>الموقع</label><input value={form.location} onChange={(e) => set("location", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>الفني المعيّن</label><select value={form.assignedTechnicianId} onChange={(e) => set("assignedTechnicianId", e.target.value)} style={inp}><option value="">— غير محدد —</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></div>
          <div><label style={lbl}>المشروع</label><select value={form.projectId} onChange={(e) => set("projectId", e.target.value)} style={inp}><option value="">— بدون —</option>{projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label style={lbl}>العقد</label><select value={form.contractId} onChange={(e) => set("contractId", e.target.value)} style={inp}><option value="">— بدون —</option>{contracts.map((c: any) => <option key={c.id} value={c.id}>{c.contractNumber}</option>)}</select></div>
        </div>
        <div><label style={lbl}>سبب البلاغ *</label><textarea value={form.reportReason} onChange={(e) => set("reportReason", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" } as any} /></div>
        <div><label style={lbl}>ملاحظات</label><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" } as any} /></div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PREVENTIVE TAB
═══════════════════════════════════════════════════════ */
const emptyPlanForm = { equipmentId: "", planName: "", frequencyType: "monthly", intervalValue: "1", meterIntervalValue: "", nextDueDate: "", checklistText: "", active: true };

function dueBadge(dateStr: string | null): { label: string; color: string; bg: string } {
  if (!dateStr) return { label: "—", color: "#6b7280", bg: "#f3f4f6" };
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `متأخرة ${Math.abs(days)} يوم`, color: "#dc2626", bg: "#fff1f2" };
  if (days <= 14) return { label: `خلال ${days} يوم`, color: "#d97706", bg: "#fffbeb" };
  return { label: dateStr, color: "#16a34a", bg: "#f0fdf4" };
}

function PreventiveTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyPlanForm });

  const { data: plans = [], isLoading } = useQuery<any[]>({ queryKey: ["maintenance-preventive-plans"], queryFn: () => maintenanceApi.preventivePlans.list() });
  const { data: equipment = [] } = useQuery<any[]>({ queryKey: ["maintenance-equipment"], queryFn: () => maintenanceApi.equipment.list() });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["maintenance-preventive-plans"] }); qc.invalidateQueries({ queryKey: ["maintenance-work-orders"] }); qc.invalidateQueries({ queryKey: ["maintenance-alerts"] }); };

  const createMut = useMutation({ mutationFn: (d: any) => maintenanceApi.preventivePlans.create(d), onSuccess: () => { invalidate(); setDrawerOpen(false); setForm({ ...emptyPlanForm }); } });
  const deleteMut = useMutation({ mutationFn: (id: number) => maintenanceApi.preventivePlans.delete(id), onSuccess: invalidate });
  const generateMut = useMutation({ mutationFn: (id: number) => maintenanceApi.preventivePlans.generateOrder(id), onSuccess: invalidate });

  const handleSave = () => {
    if (!form.equipmentId || !form.planName.trim()) return;
    createMut.mutate({
      equipmentId: Number(form.equipmentId),
      planName: form.planName.trim(),
      frequencyType: form.frequencyType,
      intervalValue: Number(form.intervalValue) || 1,
      meterIntervalValue: form.meterIntervalValue || null,
      nextDueDate: form.nextDueDate || null,
      checklistItems: form.checklistText.split("\n").map((s) => s.trim()).filter(Boolean),
      active: form.active,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {canEdit && (
          <button onClick={() => { setForm({ ...emptyPlanForm }); setDrawerOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit" }}>
            <Plus size={14} /> خطة صيانة وقائية جديدة
          </button>
        )}
      </div>

      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>جارِ التحميل...</div>
        ) : plans.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <CalendarClock size={40} color="#e2d5b0" style={{ margin: "0 auto 10px", display: "block" }} />
            <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>لا توجد خطط صيانة وقائية</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" }}>
                <tr>
                  {["الخطة", "المعدة", "التكرار", "الاستحقاق القادم", ""].map((h) => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: "#4a3f1a", fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.map((p: any) => {
                  const badge = dueBadge(p.nextDueDate);
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f5f0e6" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: GR }}>{p.planName}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{p.equipmentName} ({p.assetNumber})</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{FREQ_LABELS[p.frequencyType] ?? p.frequencyType}</td>
                      <td style={{ padding: "10px 14px" }}><span style={{ padding: "3px 10px", borderRadius: 20, background: badge.bg, color: badge.color, fontSize: 11, fontWeight: 700 }}>{badge.label}</span></td>
                      <td style={{ padding: "10px 14px", display: "flex", gap: 8 }}>
                        {canEdit && (
                          <>
                            <button onClick={() => generateMut.mutate(p.id)} title="توليد أمر صيانة الآن" style={{ background: "none", border: "none", cursor: "pointer", color: GD }}><PlayCircle size={16} /></button>
                            <button onClick={() => { if (confirm(`حذف خطة ${p.planName}؟`)) deleteMut.mutate(p.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}><Trash2 size={14} /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={drawerOpen} onClose={() => setDrawerOpen(false)} title="خطة صيانة وقائية جديدة" icon={CalendarClock}
        footer={<>
          <button onClick={() => setDrawerOpen(false)} style={{ padding: "10px 20px", borderRadius: 10, background: "white", color: "#6b7280", border: "1.5px solid #e5e7eb", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
          <button onClick={handleSave} disabled={createMut.isPending} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 10, background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            <Save size={14} /> إضافة الخطة
          </button>
        </>}>
        <div><label style={lbl}>المعدة *</label><select value={form.equipmentId} onChange={(e) => set("equipmentId", e.target.value)} style={inp}><option value="">— اختر —</option>{equipment.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.name} ({eq.assetNumber})</option>)}</select></div>
        <div><label style={lbl}>اسم الخطة *</label><input value={form.planName} onChange={(e) => set("planName", e.target.value)} placeholder="مثال: تغيير زيت وفلتر" style={inp} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={lbl}>التكرار</label><select value={form.frequencyType} onChange={(e) => set("frequencyType", e.target.value)} style={inp}>{Object.entries(FREQ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label style={lbl}>كل عدد وحدات</label><input type="number" value={form.intervalValue} onChange={(e) => set("intervalValue", e.target.value)} dir="ltr" style={inp} disabled={form.frequencyType === "meter_based"} /></div>
        </div>
        {form.frequencyType === "meter_based" && (
          <div><label style={lbl}>كل عدد ساعات تشغيل</label><input type="number" value={form.meterIntervalValue} onChange={(e) => set("meterIntervalValue", e.target.value)} dir="ltr" style={inp} /></div>
        )}
        <div><label style={lbl}>تاريخ الاستحقاق القادم</label><input type="date" value={form.nextDueDate} onChange={(e) => set("nextDueDate", e.target.value)} style={inp} /></div>
        <div><label style={lbl}>خطوات الصيانة (سطر لكل خطوة)</label><textarea value={form.checklistText} onChange={(e) => set("checklistText", e.target.value)} rows={4} placeholder={"تغيير زيت\nتغيير فلتر\nفحص البطارية"} style={{ ...inp, resize: "vertical" } as any} /></div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   INVENTORY TAB
═══════════════════════════════════════════════════════ */
const emptyPartForm = { partNumber: "", partName: "", category: "", unit: "", reorderLevel: "", unitCost: "", location: "", notes: "" };

function InventoryTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyPartForm });

  const { data: items = [], isLoading } = useQuery<any[]>({ queryKey: ["maintenance-inventory"], queryFn: () => maintenanceApi.inventory.list() });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["maintenance-inventory"] }); qc.invalidateQueries({ queryKey: ["maintenance-alerts"] }); };

  const createMut = useMutation({ mutationFn: (d: any) => maintenanceApi.inventory.create(d), onSuccess: () => { invalidate(); setDrawerOpen(false); setForm({ ...emptyPartForm }); } });
  const receiveMut = useMutation({ mutationFn: ({ id, quantity }: any) => maintenanceApi.inventory.receive(id, { quantity }), onSuccess: invalidate });

  const handleSave = () => {
    if (!form.partNumber.trim() || !form.partName.trim()) return;
    createMut.mutate({ ...form, reorderLevel: form.reorderLevel || null, unitCost: form.unitCost || null });
  };

  const handleReceive = (item: any) => {
    const qty = prompt(`كمية الاستلام لـ ${item.partName}:`);
    const n = Number(qty);
    if (qty && n > 0) receiveMut.mutate({ id: item.id, quantity: n });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {canEdit && (
          <button onClick={() => { setForm({ ...emptyPartForm }); setDrawerOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit" }}>
            <Plus size={14} /> صنف جديد
          </button>
        )}
      </div>

      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>جارِ التحميل...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Package size={40} color="#e2d5b0" style={{ margin: "0 auto 10px", display: "block" }} />
            <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>المستودع فارغ</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" }}>
                <tr>
                  {["رقم القطعة", "الاسم", "الفئة", "الرصيد", "حد إعادة الطلب", "تكلفة الوحدة", ""].map((h) => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: "#4a3f1a", fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it: any) => {
                  const low = it.reorderLevel != null && Number(it.quantityOnHand) <= Number(it.reorderLevel);
                  return (
                    <tr key={it.id} style={{ borderBottom: "1px solid #f5f0e6", background: low ? "#fffbeb" : undefined }}>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#4b5563" }}>{it.partNumber}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: GR }}>{it.partName}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{it.category ?? "—"}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: low ? "#d97706" : "#4b5563" }}>{it.quantityOnHand} {it.unit ?? ""}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{it.reorderLevel ?? "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563", direction: "ltr" as const }}>{it.unitCost ? fmt(it.unitCost) : "—"}</td>
                      <td style={{ padding: "10px 14px" }}>{canEdit && <button onClick={() => handleReceive(it)} style={{ padding: "5px 10px", borderRadius: 8, background: "white", border: `1px solid ${G}88`, color: GD, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>استلام</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={drawerOpen} onClose={() => setDrawerOpen(false)} title="صنف مستودع جديد" icon={Package}
        footer={<>
          <button onClick={() => setDrawerOpen(false)} style={{ padding: "10px 20px", borderRadius: 10, background: "white", color: "#6b7280", border: "1.5px solid #e5e7eb", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
          <button onClick={handleSave} disabled={createMut.isPending} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 10, background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            <Save size={14} /> إضافة الصنف
          </button>
        </>}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={lbl}>رقم القطعة *</label><input value={form.partNumber} onChange={(e) => set("partNumber", e.target.value)} dir="ltr" style={inp} /></div>
          <div><label style={lbl}>اسم القطعة *</label><input value={form.partName} onChange={(e) => set("partName", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>الفئة</label><input value={form.category} onChange={(e) => set("category", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>وحدة القياس</label><input value={form.unit} onChange={(e) => set("unit", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>حد إعادة الطلب</label><input type="number" value={form.reorderLevel} onChange={(e) => set("reorderLevel", e.target.value)} dir="ltr" style={inp} /></div>
          <div><label style={lbl}>تكلفة الوحدة (د.ك)</label><input type="number" value={form.unitCost} onChange={(e) => set("unitCost", e.target.value)} dir="ltr" style={inp} /></div>
          <div><label style={lbl}>الموقع بالمستودع</label><input value={form.location} onChange={(e) => set("location", e.target.value)} style={inp} /></div>
        </div>
        <div><label style={lbl}>ملاحظات</label><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" } as any} /></div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   BUDGET TAB
═══════════════════════════════════════════════════════ */
const MONTH_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function BudgetTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [amounts, setAmounts] = useState<Record<number, string>>({});

  const { data: summary } = useQuery<any>({ queryKey: ["maintenance-budget-summary", year], queryFn: () => maintenanceApi.budgets.summary(year) });

  const upsertMut = useMutation({
    mutationFn: (d: any) => maintenanceApi.budgets.upsert(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maintenance-budget-summary", year] }); qc.invalidateQueries({ queryKey: ["maintenance-stats"] }); qc.invalidateQueries({ queryKey: ["maintenance-alerts"] }); },
  });

  const byMonth: Record<number, any> = {};
  (summary?.monthly ?? []).forEach((r: any) => { byMonth[r.month] = r; });

  const byTypeData = (summary?.byType ?? []).map((r: any) => ({ name: MAINTENANCE_TYPE_LABELS[r.label] ?? r.label ?? "غير محدد", value: Number(r.total) }));
  const byEquipmentData = (summary?.byEquipment ?? []).map((r: any) => ({ name: r.label ?? "غير محدد", value: Number(r.total) }));
  const byWorkerCostData = (summary?.byWorkerCost ?? []).map((r: any) => ({ name: r.label ?? "غير محدد", value: Number(r.total) }));
  const incomeVsSpentData = MONTH_AR.map((label, i) => {
    const row = byMonth[i + 1];
    return { name: label, دخل: row ? Number(row.income ?? 0) : 0, مصروف: row ? Number(row.spent ?? 0) : 0 };
  });
  const capexList = summary?.capexList ?? [];
  const annualNet = summary?.annualNet ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ ...lbl, marginBottom: 0 }}>السنة</label>
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())} dir="ltr" style={{ ...inp, width: 110 }} />
      </div>

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
          <StatCard label="الدخل السنوي" value={summary.annualIncome} isMoney color="#16a34a" />
          <StatCard label="المصروف التشغيلي السنوي" value={summary.annualSpent} isMoney color="#dc2626" />
          <StatCard label="صافي الربح/الخسارة" value={annualNet} isMoney color={annualNet >= 0 ? "#16a34a" : "#dc2626"} />
          <StatCard label="الميزانية السنوية" value={summary.annualBudget} isMoney color={GD} />
          <StatCard label="المتبقي من الميزانية" value={summary.annualRemaining} isMoney color={summary.annualRemaining >= 0 ? "#16a34a" : "#dc2626"} />
          <StatCard label="الاستثمارات الرأسمالية" value={summary.annualCapex} isMoney color="#7c3aed" />
        </div>
      )}

      <div style={cardStyle}>
        <p style={{ fontSize: 12, fontWeight: 800, color: GR, margin: "0 0 10px" }}>الدخل مقابل المصروف شهريًا</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={incomeVsSpentData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
            <Bar dataKey="دخل" fill="#16a34a" radius={[5, 5, 0, 0]} />
            <Bar dataKey="مصروف" fill="#dc2626" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={cardStyle}>
        <div style={sectionTitle}>الميزانية الشهرية</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#f9f6ee" }}>
                {["الشهر", "الميزانية (د.ك)", "الدخل", "المصروف", "الصافي", "المتبقي من الميزانية"].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#4a3f1a" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MONTH_AR.map((label, i) => {
                const m = i + 1;
                const row = byMonth[m];
                const budget = row ? Number(row.budget) : 0;
                const spent = row ? Number(row.spent) : 0;
                const income = row ? Number(row.income ?? 0) : 0;
                const net = income - spent;
                const remaining = budget - spent;
                return (
                  <tr key={m} style={{ borderBottom: "1px solid #f5f0e6" }}>
                    <td style={{ padding: "6px 10px", fontWeight: 700, color: GR }}>{label}</td>
                    <td style={{ padding: "6px 10px" }}>
                      {canEdit ? (
                        <input type="number" defaultValue={row?.budget ?? ""} placeholder="0.000" dir="ltr"
                          onChange={(e) => setAmounts((a) => ({ ...a, [m]: e.target.value }))}
                          onBlur={(e) => { const v = e.target.value; if (v) upsertMut.mutate({ year, month: m, amount: v }); }}
                          style={{ ...inp, width: 110, padding: "5px 8px" }} />
                      ) : fmt(budget)}
                    </td>
                    <td style={{ padding: "6px 10px", color: "#16a34a", direction: "ltr" as const }}>{fmt(income)}</td>
                    <td style={{ padding: "6px 10px", color: "#dc2626", direction: "ltr" as const }}>{fmt(spent)}</td>
                    <td style={{ padding: "6px 10px", color: net >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700, direction: "ltr" as const }}>{fmt(net)}</td>
                    <td style={{ padding: "6px 10px", color: remaining >= 0 ? "#16a34a" : "#dc2626", direction: "ltr" as const }}>{fmt(remaining)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...cardStyle, border: "1.5px solid #ede9fe", background: "#faf9ff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: "#6d28d9", margin: 0 }}>الاستثمارات الرأسمالية — {year}</p>
          <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700 }}>الإجمالي: {fmt(summary?.annualCapex ?? 0)}</span>
        </div>
        <p style={{ fontSize: 10.5, color: "#9ca3af", margin: "0 0 10px" }}>لا تُحتسب ضمن المصروف التشغيلي الشهري — نفقات شراء معدات لمرة واحدة</p>
        {capexList.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {capexList.map((c: any) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: "white", border: "1px solid #ede9fe", fontSize: 11.5 }}>
                <span>{c.name} <span style={{ color: "#9ca3af" }}>({new Date(c.purchaseDate).toLocaleDateString("ar-KW")})</span></span>
                <span style={{ fontWeight: 700, color: "#7c3aed", direction: "ltr" as const }}>{fmt(c.purchaseValue)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 11.5, margin: "4px 0" }}>لا توجد عمليات شراء معدات مسجّلة في هذه السنة</p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={cardStyle}>
          <p style={{ fontSize: 12, fontWeight: 800, color: GR, margin: "0 0 10px" }}>توزيع التكلفة حسب نوع الصيانة</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byTypeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
              <Bar dataKey="value" fill={G} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={cardStyle}>
          <p style={{ fontSize: 12, fontWeight: 800, color: GR, margin: "0 0 10px" }}>توزيع التكلفة حسب المعدة</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byEquipmentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
              <Bar dataKey="value" fill="#2563eb" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {byWorkerCostData.length > 0 && (
        <div style={cardStyle}>
          <p style={{ fontSize: 12, fontWeight: 800, color: GR, margin: "0 0 10px" }}>تكلفة العمال حسب الاسم</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byWorkerCostData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
              <Bar dataKey="value" fill="#7c3aed" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════ */
export default function MaintenanceIndex() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || !!user?.canEdit;

  const [activeTab, setActiveTab] = useState<"dashboard" | "equipment" | "workOrders" | "preventive" | "inventory" | "budget">("dashboard");

  const TABS = [
    { key: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
    { key: "equipment", label: "المعدات", icon: Boxes },
    { key: "workOrders", label: "أوامر الصيانة", icon: ClipboardList },
    { key: "preventive", label: "الصيانة الوقائية", icon: CalendarClock },
    { key: "inventory", label: "المستودع", icon: Package },
    { key: "budget", label: "الميزانية", icon: Wallet },
  ] as const;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>إدارة الصيانة</h1>
        </div>
        <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>المعدات · أوامر الصيانة · الصيانة الوقائية · المستودع · الميزانية</p>
      </div>

      <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: 6, alignSelf: "flex-start", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", border: "none", background: activeTab === t.key ? `linear-gradient(135deg,${G},${GD})` : "transparent", color: activeTab === t.key ? "white" : "#374151", boxShadow: activeTab === t.key ? `0 3px 12px rgba(212,165,52,0.4)` : undefined }}>
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && <DashboardTab />}
      {activeTab === "equipment" && <EquipmentTab canEdit={canEdit} />}
      {activeTab === "workOrders" && <WorkOrdersTab canEdit={canEdit} />}
      {activeTab === "preventive" && <PreventiveTab canEdit={canEdit} />}
      {activeTab === "inventory" && <InventoryTab canEdit={canEdit} />}
      {activeTab === "budget" && <BudgetTab canEdit={canEdit} />}
    </div>
  );
}
