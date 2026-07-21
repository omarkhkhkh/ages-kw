import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { suppliersApi, researchApi, companiesApi } from "@/lib/api";
import { Users, Plus, Pencil, Trash2, X, Check, Download, Search, Phone, Mail, Briefcase, Hash, Star, ShieldCheck, Clock } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { exportSuppliersToExcel } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";
import CorrespondenceSheet from "@/components/correspondence/correspondence-sheet";
import LinkedPricingSheets from "@/components/linked-pricing-sheets";
import LinkedTasks from "@/components/linked-tasks";

const G  = "#D4A534";
const GL = "#E8BE55";
const GD = "#A87C20";

// احتياطي يُعرض ريثما تُحمَّل القائمة المركزية من الخادم
const FALLBACK_TYPES = ["مقاول", "مورد", "استشاري", "مصنّع"];
// قيمة خاصة في القائمة المنسدلة تفتح إدخال "إضافة تصنيف جديد" (للمدير فقط)
const ADD_NEW = "__add_new__";
const emptyForm = { name: "", type: "", contactPerson: "", phone: "", email: "", address: "", specialization: "", commercialRegNo: "", notes: "", companyId: "" };

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  "مقاول":    { bg: "#fef3c7", text: "#92400e" },
  "مورد":     { bg: "#dbeafe", text: "#1e40af" },
  "استشاري":  { bg: "#f3e8ff", text: "#6b21a8" },
  "مصنّع":    { bg: "#dcfce7", text: "#166534" },
  "أخرى":    { bg: "#f3f4f6", text: "#374151" },
};

const S = {
  page: { fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl" as const },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 },
  accentBar: { width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})`, flexShrink: 0 },
  titleRow: { display: "flex", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontWeight: 800, color: "#132a18", margin: 0 },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  btnPrimary: { display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg, ${GL}, ${GD})`, color: "white", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: `0 4px 14px ${G}44` },
  btnOutline: { display: "flex", alignItems: "center", gap: 6, background: "white", color: GD, border: `1.5px solid ${G}66`, borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  searchBar: { display: "flex", alignItems: "center", gap: 10, background: "white", border: "1.5px solid #e5dfc8", borderRadius: 12, padding: "8px 14px", width: 300 },
  tableCard: { background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", overflow: "hidden" },
  thead: { background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" },
  th: { padding: "14px 18px", fontWeight: 700, color: "#4a3f1a", fontSize: 12, whiteSpace: "nowrap" as const, textAlign: "right" as const },
  td: { padding: "13px 18px", fontSize: 13, textAlign: "right" as const, verticalAlign: "middle" as const },
  overlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40, backdropFilter: "blur(2px)" },
  drawer: { position: "fixed" as const, top: 0, right: 0, bottom: 0, width: 500, background: "white", zIndex: 50, boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" as const, overflowY: "auto" as const },
  drawerHeader: { padding: "20px 24px", borderBottom: "1px solid #f0ead8", background: "linear-gradient(135deg, #fffdf5, #fef9ec)", display: "flex", justifyContent: "space-between", alignItems: "center" },
  drawerTitle: { fontSize: 17, fontWeight: 800, color: "#132a18" },
  drawerBody: { padding: 24, flex: 1 },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#4a3f1a", marginBottom: 5 },
  input: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 13, background: "white", boxSizing: "border-box" as const, outline: "none", color: "#1e2a1e" },
  select: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 13, background: "white", boxSizing: "border-box" as const, outline: "none", color: "#1e2a1e", height: 38 },
  fieldGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 },
  saveBtn: { background: `linear-gradient(135deg, ${GL}, ${GD})`, color: "white", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
  cancelBtn: { background: "transparent", color: "#6b7280", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  iconBtn: { background: "transparent", border: "none", cursor: "pointer", padding: "6px 8px", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" },
};

function StarsDisplay({ value, size = 13 }: { value: number; size?: number }) {
  const rounded = Math.round(value);
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} color={i <= rounded ? "#f59e0b" : "#e5e7eb"} fill={i <= rounded ? "#f59e0b" : "none"} />
      ))}
    </span>
  );
}

function SupplierStars({ supplierId }: { supplierId: number }) {
  const { data } = useQuery<any>({ queryKey: ["supplier-eval-summary", supplierId], queryFn: () => researchApi.evaluations.summary(supplierId) });
  if (!data || !data.count) return <span style={{ color: "#d1d5db", fontSize: 11 }}>بدون تقييم</span>;
  return <StarsDisplay value={Number(data.overallStars)} />;
}

const emptyEvalForm = { qualityScore: "5", priceScore: "5", commitmentScore: "5", notes: "" };

function SupplierEvaluationSection({ supplierId }: { supplierId: number }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...emptyEvalForm });
  const { data: summary } = useQuery<any>({ queryKey: ["supplier-eval-summary", supplierId], queryFn: () => researchApi.evaluations.summary(supplierId) });
  const { data: history = [] } = useQuery<any[]>({ queryKey: ["supplier-evaluations", supplierId], queryFn: () => researchApi.evaluations.list(supplierId) });

  const createMut = useMutation({
    mutationFn: (d: any) => researchApi.evaluations.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-eval-summary", supplierId] });
      qc.invalidateQueries({ queryKey: ["supplier-evaluations", supplierId] });
      setForm({ ...emptyEvalForm });
    },
  });

  return (
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid #f0ead8" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#132a18" }}>التقييم</span>
        {summary && summary.count > 0 && <StarsDisplay value={Number(summary.overallStars)} size={16} />}
      </div>
      {summary && summary.count > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
          <div style={{ background: "#fafaf8", borderRadius: 8, padding: "8px 10px", textAlign: "center" as const }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#132a18" }}>{summary.avgQuality}</div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>الجودة</div>
          </div>
          <div style={{ background: "#fafaf8", borderRadius: 8, padding: "8px 10px", textAlign: "center" as const }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#132a18" }}>{summary.avgPrice}</div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>السعر</div>
          </div>
          <div style={{ background: "#fafaf8", borderRadius: 8, padding: "8px 10px", textAlign: "center" as const }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#132a18" }}>{summary.avgCommitment}</div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>الالتزام</div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, marginBottom: 12, maxHeight: 140, overflowY: "auto" as const }}>
        {history.map((h: any) => (
          <div key={h.id} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 8, background: "#fafaf8", border: "1px solid #f0ead8" }}>
            <span style={{ fontWeight: 700 }}>جودة {h.qualityScore} · سعر {h.priceScore} · التزام {h.commitmentScore}</span>
            <span style={{ color: "#9ca3af" }}> — {h.evaluatedByName ?? ""} — {new Date(h.evaluatedAt).toLocaleDateString("ar-KW")}</span>
            {h.notes && <div style={{ color: "#6b7280", marginTop: 2 }}>{h.notes}</div>}
          </div>
        ))}
        {history.length === 0 && <p style={{ fontSize: 11.5, color: "#9ca3af", margin: 0 }}>لا توجد تقييمات بعد</p>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div><label style={{ fontSize: 10.5, color: "#6b7280", display: "block", marginBottom: 3 }}>الجودة</label>
          <select value={form.qualityScore} onChange={(e) => setForm((f) => ({ ...f, qualityScore: e.target.value }))} style={{ ...S.input, height: 32, fontSize: 12 }}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </div>
        <div><label style={{ fontSize: 10.5, color: "#6b7280", display: "block", marginBottom: 3 }}>السعر</label>
          <select value={form.priceScore} onChange={(e) => setForm((f) => ({ ...f, priceScore: e.target.value }))} style={{ ...S.input, height: 32, fontSize: 12 }}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </div>
        <div><label style={{ fontSize: 10.5, color: "#6b7280", display: "block", marginBottom: 3 }}>الالتزام</label>
          <select value={form.commitmentScore} onChange={(e) => setForm((f) => ({ ...f, commitmentScore: e.target.value }))} style={{ ...S.input, height: 32, fontSize: 12 }}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </div>
      </div>
      <input placeholder="ملاحظات (اختياري)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={{ ...S.input, marginBottom: 8 }} />
      <button type="button" onClick={() => createMut.mutate({ supplierId, qualityScore: Number(form.qualityScore), priceScore: Number(form.priceScore), commitmentScore: Number(form.commitmentScore), notes: form.notes || null })} disabled={createMut.isPending} style={{ ...S.saveBtn, width: "100%", justifyContent: "center" as const }}>
        <Star size={13} /> إضافة تقييم
      </button>
    </div>
  );
}

export default function SuppliersList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [correspondenceFor, setCorrespondenceFor] = useState<{ id: number; label: string } | null>(null);

  const isAdmin = user?.role === "admin";
  const canEdit = isAdmin || !!user?.canEdit;
  const canDownload = isAdmin || !!user?.canDownload;

  const { data: suppliers = [], isLoading } = useQuery({ queryKey: ["suppliers", pendingOnly ? "draft" : "all"], queryFn: () => suppliersApi.list(isAdmin && pendingOnly ? "draft" : undefined) });
  const { data: companies = [] } = useQuery<any[]>({ queryKey: ["companies-list"], queryFn: () => companiesApi.list() });
  const { data: dbTypes = [] } = useQuery({ queryKey: ["supplier-types"], queryFn: () => suppliersApi.types.list() });

  const [newTypeName, setNewTypeName] = useState("");
  const [showTypeManager, setShowTypeManager] = useState(false);
  const typeNames = (dbTypes as { name: string }[]).length ? (dbTypes as { name: string }[]).map(t => t.name) : FALLBACK_TYPES;
  const addTypeM = useMutation({
    mutationFn: (name: string) => suppliersApi.types.create(name),
    onSuccess: (row: any) => { qc.invalidateQueries({ queryKey: ["supplier-types"] }); setForm(p => ({ ...p, type: row.name })); setNewTypeName(""); toast({ title: "✅ تم إضافة التصنيف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const delTypeM = useMutation({
    mutationFn: (id: number) => suppliersApi.types.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["supplier-types"] }); toast({ title: "🗑 تم حذف التصنيف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const createM = useMutation({ mutationFn: suppliersApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); closeForm(); toast({ title: "✅ تم إضافة المورد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const updateM = useMutation({ mutationFn: ({ id, data }: any) => suppliersApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); closeForm(); toast({ title: "✅ تم تحديث المورد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const deleteM = useMutation({ mutationFn: suppliersApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast({ title: "تم حذف المورد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const approveM = useMutation({ mutationFn: suppliersApi.approve, onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast({ title: "✅ تم اعتماد المورد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const openEdit = (s: any) => { setEditId(s.id); setForm({ name: s.name, type: s.type || "", contactPerson: s.contactPerson || "", phone: s.phone || "", email: s.email || "", address: s.address || "", specialization: s.specialization || "", commercialRegNo: s.commercialRegNo || "", notes: s.notes || "", companyId: s.companyId || "" }); setShowForm(true); };
  const handleSubmit = (ev: React.FormEvent) => { ev.preventDefault(); if (!form.name.trim()) return; const data = { ...form, type: form.type === ADD_NEW ? "" : form.type, companyId: form.companyId ? Number(form.companyId) : null }; editId ? updateM.mutate({ id: editId, data }) : createM.mutate(data); };

  const filtered = (suppliers as any[]).filter((s: any) => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.specialization || "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || s.type === typeFilter;
    return matchSearch && matchType;
  });

  const typeCounts = typeNames.reduce((acc, t) => { acc[t] = (suppliers as any[]).filter((s: any) => s.type === t).length; return acc; }, {} as Record<string, number>);

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.titleRow}>
            <div style={S.accentBar} />
            <h1 style={S.title}>الموردون والمقاولون</h1>
          </div>
          <p style={S.subtitle}>إدارة الموردين والمقاولين المشاركين في المناقصات</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {canDownload && (
            <button style={S.btnOutline} onClick={() => exportSuppliersToExcel(suppliers)}>
              <Download size={15} /> تصدير
            </button>
          )}
          {canEdit && (
            <button style={S.btnPrimary} onClick={() => { closeForm(); setShowForm(true); }}>
              <Plus size={15} /> إضافة مورد
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" as const }}>
        {[
          { label: "إجمالي الموردين", value: suppliers.length, color: G },
          ...typeNames.slice(0, 3).map((t, i) => ({ label: t, value: typeCounts[t] || 0, color: ["#1d4ed8", "#7c3aed", "#059669"][i] })),
        ].map(s => (
          <div key={s.label} style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={17} color={s.color} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#132a18" }}>{isLoading ? "—" : s.value}</div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" as const, alignItems: "center" }}>
        <div style={S.searchBar}>
          <Search size={15} color="#9ca3af" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو التخصص..." style={{ border: "none", outline: "none", fontSize: 13, color: "#1e2a1e", background: "transparent", flex: 1 }} />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={13} /></button>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
          {["all", ...typeNames].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "1.5px solid", cursor: "pointer", transition: "all 0.15s", borderColor: typeFilter === t ? GD : "#e5dfc8", background: typeFilter === t ? `linear-gradient(135deg, ${GL}33, ${GD}22)` : "white", color: typeFilter === t ? GD : "#6b7280" }}>
              {t === "all" ? "الجميع" : t}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button onClick={() => setPendingOnly(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, border: "1.5px solid", cursor: "pointer", borderColor: pendingOnly ? "#d97706" : "#e5dfc8", background: pendingOnly ? "#fffbeb" : "white", color: pendingOnly ? "#d97706" : "#6b7280" }}>
            <Clock size={12} /> بانتظار الاعتماد
          </button>
        )}
      </div>

      {/* Table */}
      <div style={S.tableCard}>
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 13, textAlign: "right" as const }}>
            <thead style={S.thead}>
              <tr>
                {["اسم المورد", "النوع", "التخصص", "المسؤول", "الهاتف", "الإيميل", "التقييم", "الحالة", ""].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? [...Array(4)].map((_, i) => (
                <tr key={i}>{[...Array(8)].map((_, j) => <td key={j} style={S.td}><div style={{ height: 14, background: "#f3f0e6", borderRadius: 4, width: j === 0 ? 150 : 90, animation: "pulse 1.5s infinite" }} /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: "center" as const, color: "#94a3b8", fontSize: 14 }}>
                  <Users size={40} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
                  <p style={{ margin: 0 }}>{search ? "لا نتائج للبحث" : "لا يوجد موردون مسجلون"}</p>
                </td></tr>
              ) : filtered.map((s: any, idx: number) => {
                const tc = TYPE_COLORS[s.type] || { bg: "#f3f4f6", text: "#374151" };
                return (
                  <tr key={s.id} style={{ borderBottom: idx < filtered.length - 1 ? "1px solid #f5f0e6" : "none", background: "white", transition: "background 0.1s" }}
                    onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = "#fffdf5"}
                    onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "white"}
                  >
                    <td style={{ ...S.td, fontWeight: 700, color: "#132a18" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${G}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Users size={15} color={GD} />
                        </div>
                        <div>
                          <div>{s.name}</div>
                          {s.commercialRegNo && <div style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace", fontWeight: 400 }}>{s.commercialRegNo}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>
                      {s.type ? <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: tc.bg, color: tc.text }}>{s.type}</span> : <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td style={{ ...S.td, color: "#4b5563" }}>
                      {s.specialization ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Briefcase size={12} color="#9ca3af" />{s.specialization}</div> : <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td style={{ ...S.td, color: "#4b5563" }}>{s.contactPerson || <span style={{ color: "#d1d5db" }}>—</span>}</td>
                    <td style={{ ...S.td, color: "#4b5563", direction: "ltr", textAlign: "right" as const }}>
                      {s.phone ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Phone size={12} color="#9ca3af" />{s.phone}</div> : <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td style={{ ...S.td, color: "#4b5563", direction: "ltr", textAlign: "right" as const }}>
                      {s.email ? (
                        <a href={`mailto:${s.email}`} style={{ display: "flex", alignItems: "center", gap: 5, color: "#2563eb", textDecoration: "none" }}
                          onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.textDecoration = "underline"}
                          onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.textDecoration = "none"}>
                          <Mail size={12} color="#9ca3af" />{s.email}
                        </a>
                      ) : <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td style={S.td}><SupplierStars supplierId={s.id} /></td>
                    <td style={S.td}>
                      {s.status === "draft" ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#fffbeb", color: "#d97706" }}><Clock size={11} /> مسودة{s.createdByName ? ` — ${s.createdByName}` : ""}</span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#f0fdf4", color: "#16a34a" }}><ShieldCheck size={11} /> معتمد</span>
                      )}
                    </td>
                    <td style={{ ...S.td, textAlign: "left" as const }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        {isAdmin && s.status === "draft" && (
                          <button style={S.iconBtn} onClick={() => approveM.mutate(s.id)} title="اعتماد المورد"
                            onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = "#f0fdf4"}
                            onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}>
                            <ShieldCheck size={14} color="#16a34a" />
                          </button>
                        )}
                        <button style={S.iconBtn} onClick={() => setCorrespondenceFor({ id: s.id, label: s.name })}
                          onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = `${G}18`}
                          onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}>
                          <Mail size={14} color={GD} />
                        </button>
                      </div>
                      {canEdit && (
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <button style={S.iconBtn} onClick={() => openEdit(s)}
                            onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = `${G}18`}
                            onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}>
                            <Pencil size={14} color={GD} />
                          </button>
                          <button style={S.iconBtn} onClick={() => { if (confirm("هل تريد حذف هذا المورد؟")) deleteM.mutate(s.id); }}
                            onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = "#fee2e2"}
                            onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}>
                            <Trash2 size={14} color="#dc2626" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      {showForm && (
        <>
          <div style={S.overlay} onClick={closeForm} />
          <div style={S.drawer}>
            <div style={S.drawerHeader}>
              <span style={S.drawerTitle}>{editId ? "✏️ تعديل المورد" : "🏢 مورد جديد"}</span>
              <button onClick={closeForm} style={S.iconBtn}><X size={18} color="#6b7280" /></button>
            </div>
            <div style={S.drawerBody}>
              <form onSubmit={handleSubmit}>
                <div style={S.fieldGrid}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>اسم المورد / الشركة *</label>
                    <input style={S.input} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم الشركة أو المورد" required />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <label style={S.label}>النوع / التصنيف</label>
                      {isAdmin && (
                        <button type="button" onClick={() => setShowTypeManager(v => !v)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: GD, fontSize: 11, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 3, padding: 0 }}>
                          <Trash2 size={12} /> إدارة التصنيفات
                        </button>
                      )}
                    </div>
                    <select style={S.select} value={form.type === ADD_NEW ? ADD_NEW : form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                      <option value="">اختر النوع</option>
                      {typeNames.map(t => <option key={t} value={t}>{t}</option>)}
                      {/* نوع محفوظ سابقًا غير موجود في القائمة المركزية — يبقى ظاهرًا */}
                      {form.type && form.type !== ADD_NEW && !typeNames.includes(form.type) && <option value={form.type}>{form.type}</option>}
                      {isAdmin && <option value={ADD_NEW}>➕ أخرى (إضافة تصنيف جديد)…</option>}
                    </select>
                    {isAdmin && form.type === ADD_NEW && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <input
                          autoFocus
                          style={{ ...S.input, flex: 1 }}
                          value={newTypeName}
                          onChange={e => setNewTypeName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (newTypeName.trim()) addTypeM.mutate(newTypeName.trim()); } }}
                          placeholder="اسم التصنيف الجديد"
                        />
                        <button type="button" disabled={!newTypeName.trim() || addTypeM.isPending}
                          onClick={() => newTypeName.trim() && addTypeM.mutate(newTypeName.trim())}
                          style={{ ...S.saveBtn, padding: "0 16px", whiteSpace: "nowrap" as const }}>
                          <Plus size={14} /> إضافة
                        </button>
                      </div>
                    )}
                    {isAdmin && showTypeManager && (
                      <div style={{ marginTop: 8, border: "1.5px solid #f0ead8", borderRadius: 10, padding: 10, background: "#fdfcf8" }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 6 }}>
                          حذف تصنيف (لا يؤثّر على الموردين المسجّلين به مسبقًا)
                        </div>
                        {(dbTypes as { id: number; name: string }[]).length === 0 ? (
                          <div style={{ fontSize: 12, color: "#9ca3af" }}>لا توجد تصنيفات مضافة</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {(dbTypes as { id: number; name: string }[]).map(t => (
                              <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", background: "white", border: "1px solid #eee7d3", borderRadius: 7 }}>
                                <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{t.name}</span>
                                <button type="button" disabled={delTypeM.isPending}
                                  onClick={() => { if (confirm(`حذف التصنيف "${t.name}"؟`)) delTypeM.mutate(t.id); }}
                                  title="حذف"
                                  style={{ background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 6, padding: 4, cursor: "pointer", display: "flex", alignItems: "center" }}>
                                  <Trash2 size={13} color="#dc2626" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={S.label}>التخصص</label>
                    <input style={S.input} value={form.specialization} onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))} placeholder="مجال العمل" />
                  </div>
                  <div>
                    <label style={S.label}>السجل التجاري</label>
                    <input style={S.input} value={form.commercialRegNo} onChange={e => setForm(p => ({ ...p, commercialRegNo: e.target.value }))} placeholder="رقم السجل" dir="ltr" />
                  </div>
                  <div>
                    <label style={S.label}>الشركة المشاركة</label>
                    <select style={S.select} value={form.companyId} onChange={e => setForm(p => ({ ...p, companyId: e.target.value }))}>
                      <option value="">— اختر الشركة —</option>
                      {(companies as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>الشخص المسؤول</label>
                    <input style={S.input} value={form.contactPerson} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} placeholder="اسم المسؤول" />
                  </div>
                  <div>
                    <label style={S.label}>الهاتف</label>
                    <input style={S.input} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+965 XXXX XXXX" dir="ltr" />
                  </div>
                  <div>
                    <label style={S.label}>البريد الإلكتروني</label>
                    <input style={S.input} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" dir="ltr" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>العنوان</label>
                    <input style={S.input} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="العنوان" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>ملاحظات</label>
                    <textarea style={{ ...S.input, height: 70, resize: "vertical" as const }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات إضافية" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button type="submit" style={S.saveBtn} disabled={createM.isPending || updateM.isPending}>
                    <Check size={15} />{editId ? "حفظ التعديلات" : "إضافة المورد"}
                  </button>
                  <button type="button" style={S.cancelBtn} onClick={closeForm}>إلغاء</button>
                </div>
              </form>
              {editId && <SupplierEvaluationSection supplierId={editId} />}
              {editId && (
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1.5px solid #f0ead8" }}>
                  <LinkedPricingSheets entityType="supplier" entityId={editId} />
                </div>
              )}
              {editId && (
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1.5px solid #f0ead8" }}>
                  <LinkedTasks entityType="supplier" entityId={editId} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {correspondenceFor && (
        <CorrespondenceSheet
          open={!!correspondenceFor}
          onOpenChange={(o) => !o && setCorrespondenceFor(null)}
          sourceType="supplier"
          sourceId={correspondenceFor.id}
          recordLabel={correspondenceFor.label}
        />
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
