import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import {
  Truck, Plus, Search, X, Save, Pencil, Trash2,
  MapPin, Calendar, Package, ChevronDown, ArrowRight,
  DollarSign, FileText,
} from "lucide-react";

/* ── brand ── */
const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

interface Supplier { id: number; name: string; }
interface TransportRow {
  id: number;
  orderNumber: string | null;
  supplierId: number | null;
  description: string;
  origin: string | null;
  destination: string | null;
  orderDate: string | null;
  deliveryDate: string | null;
  value: string | null;
  status: string;
  vehicleInfo: string | null;
  notes: string | null;
  createdAt: string;
  supplierName: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: "قيد الانتظار", color: "#d97706", bg: "#fffbeb" },
  in_transit: { label: "جارٍ النقل",   color: "#2563eb", bg: "#eff6ff" },
  delivered:  { label: "تم التسليم",   color: "#16a34a", bg: "#f0fdf4" },
  cancelled:  { label: "ملغي",          color: "#dc2626", bg: "#fff1f2" },
};

const emptyForm = {
  orderNumber: "", supplierId: "" as string | number,
  description: "", origin: "", destination: "",
  orderDate: "", deliveryDate: "", value: "",
  status: "pending", vehicleInfo: "", notes: "",
};

/* ── Input styles ── */
const inp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "10px 14px",
  borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13,
  color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit",
};
const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: GR, marginBottom: 5 };
const focus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px rgba(212,165,52,0.15)`;
};
const blur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none";
};

/* ── Stat Card ── */
function StatCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <div style={{ background: bg, borderRadius: 18, border: `1.5px solid ${color}18`, padding: "18px 20px", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}15`, border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Icon size={20} color={color} strokeWidth={1.8} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color, marginTop: 4, opacity: 0.8 }}>{label}</div>
    </div>
  );
}

/* ── Drawer Form ── */
function TransportDrawer({ open, editing, onClose, onSave, isPending, suppliers }: {
  open: boolean; editing: TransportRow | null;
  onClose: () => void; onSave: (data: any) => void; isPending: boolean;
  suppliers: Supplier[];
}) {
  const isEdit = !!editing;
  const [form, setForm] = useState({ ...emptyForm });

  // Sync form when editing changes
  useEffect(() => {
    if (editing) {
      setForm({
        orderNumber: editing.orderNumber ?? "",
        supplierId: editing.supplierId ?? "",
        description: editing.description,
        origin: editing.origin ?? "",
        destination: editing.destination ?? "",
        orderDate: editing.orderDate ?? "",
        deliveryDate: editing.deliveryDate ?? "",
        value: editing.value ?? "",
        status: editing.status,
        vehicleInfo: editing.vehicleInfo ?? "",
        notes: editing.notes ?? "",
      });
    } else {
      setForm({ ...emptyForm });
    }
  }, [editing, open]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.description.trim()) return;
    onSave({
      orderNumber: form.orderNumber || null,
      supplierId: form.supplierId ? Number(form.supplierId) : null,
      description: form.description,
      origin: form.origin || null,
      destination: form.destination || null,
      orderDate: form.orderDate || null,
      deliveryDate: form.deliveryDate || null,
      value: form.value || null,
      status: form.status,
      vehicleInfo: form.vehicleInfo || null,
      notes: form.notes || null,
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 40,
        background: "rgba(11,26,16,0.45)",
        backdropFilter: "blur(3px)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.25s",
      }} />
      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50,
        width: 480, maxWidth: "95vw",
        background: "white",
        boxShadow: "4px 0 40px rgba(0,0,0,0.18)",
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(.4,0,.2,1)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", background: `linear-gradient(135deg,${GR},#1e4028)`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(212,165,52,0.2)", border: "1px solid rgba(212,165,52,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Truck size={20} color={G} />
            </div>
            <div>
              <h2 style={{ color: "white", fontSize: 16, fontWeight: 800, margin: 0 }}>{isEdit ? "تعديل أمر النقل" : "أمر نقل جديد"}</h2>
              <p style={{ color: "rgba(212,165,52,0.55)", fontSize: 11, margin: "2px 0 0" }}>أدخل تفاصيل عملية النقل والتوزيع</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.7)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: 24, flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Order number + status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>رقم الأمر</label>
              <input value={form.orderNumber} onChange={e => set("orderNumber", e.target.value)} placeholder="TRN-001" dir="ltr" style={inp} onFocus={focus} onBlur={blur} />
            </div>
            <div>
              <label style={lbl}>الحالة</label>
              <select value={form.status} onChange={e => set("status", e.target.value)} style={{ ...inp, appearance: "none", cursor: "pointer" }} onFocus={focus} onBlur={blur}>
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={lbl}>وصف البضاعة / الخدمة *</label>
            <input value={form.description} onChange={e => set("description", e.target.value)} placeholder="وصف تفصيلي للبضاعة أو الخدمة المنقولة" style={inp} onFocus={focus} onBlur={blur} />
          </div>

          {/* Origin + Destination */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "end" }}>
            <div>
              <label style={lbl}>من (المنشأ)</label>
              <input value={form.origin} onChange={e => set("origin", e.target.value)} placeholder="موقع الشحن" style={inp} onFocus={focus} onBlur={blur} />
            </div>
            <div style={{ paddingBottom: 2 }}>
              <ArrowRight size={18} color="#9ca3af" />
            </div>
            <div>
              <label style={lbl}>إلى (الوجهة)</label>
              <input value={form.destination} onChange={e => set("destination", e.target.value)} placeholder="موقع التسليم" style={inp} onFocus={focus} onBlur={blur} />
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>تاريخ الأمر</label>
              <input type="date" value={form.orderDate} onChange={e => set("orderDate", e.target.value)} style={inp} onFocus={focus} onBlur={blur} />
            </div>
            <div>
              <label style={lbl}>تاريخ التسليم المتوقع</label>
              <input type="date" value={form.deliveryDate} onChange={e => set("deliveryDate", e.target.value)} style={inp} onFocus={focus} onBlur={blur} />
            </div>
          </div>

          {/* Supplier + Value */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>شركة النقل</label>
              <select value={form.supplierId} onChange={e => set("supplierId", e.target.value)} style={{ ...inp, appearance: "none", cursor: "pointer" }} onFocus={focus} onBlur={blur}>
                <option value="">— اختر شركة —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>القيمة (د.ك)</label>
              <input type="number" min="0" step="0.001" value={form.value} onChange={e => set("value", e.target.value)} placeholder="0.000" dir="ltr" style={inp} onFocus={focus} onBlur={blur} />
            </div>
          </div>

          {/* Vehicle info */}
          <div>
            <label style={lbl}>معلومات المركبة / السائق</label>
            <input value={form.vehicleInfo} onChange={e => set("vehicleInfo", e.target.value)} placeholder="رقم اللوحة، اسم السائق..." style={inp} onFocus={focus} onBlur={blur} />
          </div>

          {/* Notes */}
          <div>
            <label style={lbl}>ملاحظات</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="أي تفاصيل إضافية..." rows={3}
              style={{ ...inp, resize: "vertical" } as React.CSSProperties}
              onFocus={focus as any} onBlur={blur as any} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #f0ead8", display: "flex", gap: 10, flexShrink: 0, background: "#fdfbf7" }}>
          <button onClick={handleSave} disabled={isPending || !form.description.trim()} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "11px 0", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer",
            background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white",
            fontFamily: "inherit", boxShadow: `0 6px 20px rgba(212,165,52,0.4)`,
            opacity: isPending || !form.description.trim() ? 0.65 : 1,
          }}>
            <Save size={16} /> {isPending ? "جارٍ الحفظ..." : (isEdit ? "حفظ التعديلات" : "إضافة الأمر")}
          </button>
          <button onClick={onClose} style={{ padding: "11px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", background: "#f9fafb", border: "1.5px solid #e5e7eb", color: "#374151", fontFamily: "inherit" }}>
            <X size={15} />
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Row Card ── */
function TransportCard({ row, onEdit, onDelete, canEdit }: { row: TransportRow; onEdit: () => void; onDelete: () => void; canEdit: boolean }) {
  const st = STATUS_MAP[row.status] ?? STATUS_MAP.pending;
  return (
    <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${G}15`, border: `1px solid ${G}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Truck size={20} color={G} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {row.orderNumber && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", background: "#f9fafb", border: "1px solid #e5e7eb", padding: "2px 8px", borderRadius: 6, fontFamily: "monospace" }}>
                  {row.orderNumber}
                </span>
              )}
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 20, background: st.bg, color: st.color, border: `1px solid ${st.color}30` }}>
                {st.label}
              </span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: GR, margin: "6px 0 0", lineHeight: 1.4 }}>{row.description}</p>
          </div>
        </div>

        {canEdit && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={onEdit} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", cursor: "pointer", fontFamily: "inherit" }}>
              <Pencil size={12} /> تعديل
            </button>
            <button onClick={onDelete} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", fontFamily: "inherit" }}>
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Details row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, paddingTop: 10, borderTop: "1px solid #f5f0e6" }}>
        {(row.origin || row.destination) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
            <MapPin size={13} color={GD} />
            <span>{row.origin || "—"}</span>
            <ArrowRight size={12} color="#9ca3af" />
            <span>{row.destination || "—"}</span>
          </div>
        )}
        {row.orderDate && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#374151" }}>
            <Calendar size={13} color="#7c3aed" />
            <span>{row.orderDate}</span>
          </div>
        )}
        {row.deliveryDate && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#374151" }}>
            <Package size={13} color="#16a34a" />
            <span>تسليم: {row.deliveryDate}</span>
          </div>
        )}
        {row.value && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#374151" }}>
            <DollarSign size={13} color={GD} />
            <span>{Number(row.value).toLocaleString("ar-KW")} د.ك</span>
          </div>
        )}
        {row.supplierName && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#374151" }}>
            <Truck size={13} color="#2563eb" />
            <span>{row.supplierName}</span>
          </div>
        )}
        {row.vehicleInfo && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6b7280" }}>
            <FileText size={13} color="#9ca3af" />
            <span>{row.vehicleInfo}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function TransportationList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = user?.role === "admin" || !!user?.canEdit;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState<TransportRow | null>(null);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("");

  const { data: rows = [], isLoading } = useQuery<TransportRow[]>({
    queryKey: ["transportation"],
    queryFn: () => apiFetch("/api/transportation"),
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers-simple"],
    queryFn: () => apiFetch("/api/suppliers"),
    select: (d: any[]) => d.map(s => ({ id: s.id, name: s.name })),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/transportation", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportation"] }); closeDrawer(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiFetch(`/api/transportation/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportation"] }); closeDrawer(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/transportation/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transportation"] }),
  });

  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); };
  const openNew     = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit    = (row: TransportRow) => { setEditing(row); setDrawerOpen(true); };

  const handleSave = (data: any) => {
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.description.toLowerCase().includes(q)
      || (r.orderNumber ?? "").toLowerCase().includes(q)
      || (r.origin ?? "").toLowerCase().includes(q)
      || (r.destination ?? "").toLowerCase().includes(q)
      || (r.supplierName ?? "").toLowerCase().includes(q);
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Stats
  const stats = {
    total:      rows.length,
    pending:    rows.filter(r => r.status === "pending").length,
    in_transit: rows.filter(r => r.status === "in_transit").length,
    delivered:  rows.filter(r => r.status === "delivered").length,
  };

  const totalValue = rows.reduce((acc, r) => acc + (r.value ? Number(r.value) : 0), 0);

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Drawer */}
      <TransportDrawer
        open={drawerOpen} editing={editing}
        onClose={closeDrawer} onSave={handleSave}
        isPending={createMut.isPending || updateMut.isPending}
        suppliers={suppliers}
      />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>النقل والتوزيع</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>
            إدارة أوامر النقل وعمليات التوزيع
          </p>
        </div>
        {canEdit && (
          <button onClick={openNew} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 4px 14px rgba(212,165,52,0.4)`, transition: "transform 0.1s" }}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}>
            <Plus size={15} /> أمر نقل جديد
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
        <StatCard label="إجمالي الأوامر"  value={stats.total}      icon={Truck}    color="#64748b" bg="#f8fafc" />
        <StatCard label="قيد الانتظار"    value={stats.pending}    icon={Package}  color="#d97706" bg="#fffbeb" />
        <StatCard label="جارٍ النقل"       value={stats.in_transit} icon={ArrowRight} color="#2563eb" bg="#eff6ff" />
        <StatCard label="تم التسليم"       value={stats.delivered}  icon={Truck}    color="#16a34a" bg="#f0fdf4" />
        <StatCard
          label="إجمالي القيمة"
          value={`${totalValue.toLocaleString("ar-KW", { minimumFractionDigits: 3 })} د.ك`}
          icon={DollarSign}
          color={GD}
          bg="#fffbeb"
        />
      </div>

      {/* Filters */}
      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "16px 20px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث في الأوامر..."
            style={{ ...inp, paddingRight: 36 }}
          />
        </div>

        {/* Status filter */}
        <div style={{ position: "relative", minWidth: 160 }}>
          <select value={statusFilter} onChange={e => setStatus(e.target.value)}
            style={{ ...inp, appearance: "none", paddingLeft: 32, cursor: "pointer", minWidth: 160 }}>
            <option value="">جميع الحالات</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
        </div>

        {(search || statusFilter) && (
          <button onClick={() => { setSearch(""); setStatus(""); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", fontFamily: "inherit" }}>
            <X size={13} /> إلغاء الفلتر
          </button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", height: 110, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "white", borderRadius: 20, border: "1.5px solid #f0ead8", padding: "64px 0", textAlign: "center" }}>
          <Truck size={44} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
          <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>
            {search || statusFilter ? "لا توجد نتائج مطابقة" : "لا توجد أوامر نقل بعد"}
          </p>
          {canEdit && !search && !statusFilter && (
            <button onClick={openNew} style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit" }}>
              <Plus size={14} /> إضافة أول أمر نقل
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(row => (
            <TransportCard key={row.id} row={row} canEdit={canEdit}
              onEdit={() => openEdit(row)}
              onDelete={() => { if (confirm(`حذف أمر النقل "${row.description}"؟`)) deleteMut.mutate(row.id); }}
            />
          ))}
        </div>
      )}

      {/* Count */}
      {filtered.length > 0 && (
        <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
          عرض {filtered.length} من {rows.length} أمر نقل
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
