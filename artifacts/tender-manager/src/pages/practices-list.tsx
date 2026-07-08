import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, Download, ClipboardCheck,
  X, ChevronDown, ChevronUp, Pencil, Trash2,
  CheckCircle2, Clock, Target, FileText, TrendingUp,
  UserCog, User2, Loader2,
  BookOpen, Calculator, Users, Package,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { formatCurrency } from "@/lib/utils";
import FileUpload from "@/components/file-upload";
import BidResultPanel from "@/components/bid-result-panel";
import { useToast } from "@/hooks/use-toast";

/* ─── colours ─── */
const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

/* ─── status config ─── */
const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  current:          { label: "جاري",           color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", icon: Clock },
  previous:         { label: "منجز",           color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: CheckCircle2 },
  targeted:         { label: "مستهدف",         color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: Target },
  under_submission: { label: "تحت التقديم",    color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", icon: FileText },
  future:           { label: "مستقبلي",        color: "#64748b", bg: "#f8fafc", border: "#cbd5e1", icon: TrendingUp },
};

const ALL_STATUSES = Object.keys(STATUS_MAP) as (keyof typeof STATUS_MAP)[];

const STATUS_TABS = [
  { id: "all",              label: "الجميع",         color: "#64748b" },
  { id: "current",         label: "جاري",           color: "#2563eb" },
  { id: "previous",        label: "منجز",           color: "#16a34a" },
  { id: "targeted",        label: "مستهدف",         color: "#d97706" },
  { id: "under_submission",label: "تحت التقديم",    color: "#7c3aed" },
];

/* ─── empty form ─── */
const emptyForm = {
  practiceNumber: "", projectName: "", description: "",
  governmentEntity: "", contractValue: "", profitPercentage: "",
  completionPercentage: "", startYear: "", endYear: "",
  status: "current", expectedValue: "", finalBondValue: "", notes: "",
  responsibleEmployee: "",
};

/* ─── api helper ─── */
async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(url, { credentials: "include", ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

/* ─── styles ─── */
const S = {
  label: { fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block" } as any,
  input: {
    width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb",
    fontSize: 13, fontFamily: "inherit", outline: "none", background: "white",
    boxSizing: "border-box",
  } as any,
  select: {
    width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb",
    fontSize: 13, fontFamily: "inherit", outline: "none", background: "white",
    boxSizing: "border-box", cursor: "pointer",
  } as any,
  td: {
    padding: "10px 14px", borderBottom: "1px solid #f3f4f6", fontSize: 13,
    verticalAlign: "middle", textAlign: "right",
  } as any,
};

function pct(v: any) {
  if (v === null || v === undefined || v === "") return null;
  return Math.round(Number(v));
}

/* ═══════════════════════════════════════════════════
   Inline status dropdown
   ═══════════════════════════════════════════════════ */
function PracticeStatusDropdown({ practiceId, currentStatus, onUpdated }: {
  practiceId: number;
  currentStatus: string;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const handleSelect = async (status: string) => {
    if (busy || status === currentStatus) { setOpen(false); return; }
    setOpen(false);
    setBusy(true);
    try {
      await apiFetch(`/api/practices/${practiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onUpdated();
      const prev = STATUS_MAP[currentStatus]?.label ?? currentStatus;
      const next = STATUS_MAP[status]?.label ?? status;
      toast({ title: "✅ تم تحديث الحالة", description: `${prev} ← ${next}` });
    } catch (err: any) {
      toast({ title: "فشل تحديث الحالة", description: err?.message ?? "حاول مجدداً.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const st = STATUS_MAP[currentStatus] ?? STATUS_MAP["future"];

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => !busy && setOpen(o => !o)}
        title="تغيير الحالة"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px 4px 8px", borderRadius: 20, cursor: busy ? "wait" : "pointer",
          fontSize: 11, fontWeight: 700, fontFamily: "inherit",
          background: st.bg, color: st.color,
          border: `1.5px solid ${open ? st.color : st.border}`,
          transition: "border-color 0.15s, box-shadow 0.15s",
          boxShadow: open ? `0 0 0 3px ${st.color}22` : "none",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => { if (!busy) (e.currentTarget.style.borderColor = st.color); }}
        onMouseLeave={e => { if (!open) (e.currentTarget.style.borderColor = st.border); }}
      >
        {busy
          ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
          : <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, flexShrink: 0 }} />
        }
        {st.label}
        {!busy && <ChevronDown size={10} style={{ opacity: 0.6, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s" }} />}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 9999,
          background: "white", borderRadius: 12, border: "1.5px solid #e5e7eb",
          boxShadow: "0 8px 32px rgba(0,0,0,0.13)", padding: 6, minWidth: 180,
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          {ALL_STATUSES.map(s => {
            const opt = STATUS_MAP[s];
            const active = s === currentStatus;
            return (
              <button key={s} onClick={() => handleSelect(s)}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: active ? opt.bg : "transparent",
                  color: active ? opt.color : "#374151",
                  fontFamily: "inherit", fontSize: 12, fontWeight: active ? 700 : 500,
                  textAlign: "right", transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: opt.color, flexShrink: 0 }} />
                {opt.label}
                {active && <span style={{ marginRight: "auto", color: opt.color }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Employee picker — admin only
   ═══════════════════════════════════════════════════ */
function PracticeEmployeeDropdown({ practiceId, currentEmployee, onUpdated }: {
  practiceId: number;
  currentEmployee: string | null;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users", { credentials: "include" }).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const handleSelect = async (fullName: string) => {
    if (busy || fullName === currentEmployee) { setOpen(false); return; }
    setOpen(false);
    setBusy(true);
    try {
      await apiFetch(`/api/practices/${practiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsibleEmployee: fullName }),
      });
      onUpdated();
      toast({ title: "✅ تم تغيير المسؤول", description: fullName });
    } catch (err: any) {
      toast({ title: "فشل تغيير المسؤول", description: err?.message ?? "حاول مجدداً.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#374151" }}>{currentEmployee || "—"}</span>
      <button onClick={() => !busy && setOpen(o => !o)} title="تغيير المسؤول"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 6, border: "1.5px solid #e5e7eb", background: "white", cursor: busy ? "wait" : "pointer", color: "#6b7280", padding: 0, flexShrink: 0 }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = G; (e.currentTarget as HTMLButtonElement).style.color = G; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLButtonElement).style.color = "#6b7280"; }}>
        {busy ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <UserCog size={11} />}
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 9999, background: "white", borderRadius: 12, border: "1.5px solid #e5e7eb", boxShadow: "0 8px 32px rgba(0,0,0,0.13)", padding: 6, minWidth: 180, display: "flex", flexDirection: "column", gap: 2 }}>
          {(users as any[]).filter((u: any) => u.isActive !== false).map((u: any) => {
            const active = u.fullName === currentEmployee;
            return (
              <button key={u.id} onClick={() => handleSelect(u.fullName)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: active ? "#fdf8ec" : "transparent", color: active ? GD : "#374151", fontFamily: "inherit", fontSize: 12, fontWeight: active ? 700 : 500, textAlign: "right", transition: "background 0.1s" }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: active ? "#D4A53420" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <User2 size={12} color={active ? GD : "#9ca3af"} />
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: active ? 700 : 600 }}>{u.fullName}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>{u.role === "admin" ? "مدير" : "موظف"}</div>
                </div>
                {active && <span style={{ marginRight: "auto", color: G }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Expanded row — details + file uploads + bid result
   ═══════════════════════════════════════════════════ */
function PracticeExpandedRow({ practice, canEdit, onUpdated }: {
  practice: any;
  canEdit: boolean;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"docs"|"bid">("docs");
  const [files, setFiles] = useState({
    fileConditions: practice.fileConditions ?? null,
    filePricing:    practice.filePricing    ?? null,
    fileSuppliers:  practice.fileSuppliers  ?? null,
    fileOpening:    practice.fileOpening    ?? null,
  });
  // Per-field in-flight tracking to handle concurrent uploads correctly
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());

  const isFuture = (s: string) => s === "targeted" || s === "under_submission" || s === "future";

  const handleFileChange = async (field: string, path: string | null) => {
    // Capture the previous value before the optimistic update for accurate rollback
    const prevPath = (files as Record<string, string | null>)[field];
    setFiles(prev => ({ ...prev, [field]: path }));
    setSavingFields(prev => new Set(prev).add(field));
    try {
      await apiFetch(`/api/practices/${practice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: path }),
      });
      onUpdated();
    } catch (err: any) {
      toast({ title: "فشل حفظ الملف", description: err?.message ?? "حاول مجدداً.", variant: "destructive" });
      // Rollback to the value that was confirmed before this attempt, not stale props
      setFiles(prev => ({ ...prev, [field]: prevPath }));
    } finally {
      setSavingFields(prev => { const s = new Set(prev); s.delete(field); return s; });
    }
  };

  const DOCS = [
    { field: "fileConditions", label: "الشروط الخاصة",    icon: BookOpen,    color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
    { field: "filePricing",    label: "جداول التسعير",    icon: Calculator,  color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
    { field: "fileSuppliers",  label: "عروض الموردين",    icon: Users,       color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
    { field: "fileOpening",    label: "وثيقة فض الظروف", icon: Package,     color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
  ];

  return (
    <div style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1.5px solid #e5e7eb", padding: "0 24px", background: "white" }}>
        {([["docs","المستندات"],["bid","فض العطاء"]] as const).map(([t,l]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: "10px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: "none", border: "none", fontFamily: "inherit", color: activeTab === t ? G : "#6b7280", borderBottom: `2px solid ${activeTab === t ? G : "transparent"}`, marginBottom: -1 }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px 24px" }}>
      {activeTab === "bid" ? (
        <BidResultPanel
          sourceType="practice"
          sourceId={practice.id}
          ourPrice={practice.contractValue ?? practice.expectedValue}
        />
      ) : (
      <>
      {/* existing info */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14, marginBottom: 20 }}>
        {isFuture(practice.status) && practice.finalBondValue && (
          <div>
            <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, marginBottom: 3 }}>الكفالة النهائية</div>
            <div style={{ fontWeight: 700, color: "#7c3aed" }}>{formatCurrency(Number(practice.finalBondValue))}</div>
          </div>
        )}
        {practice.description && (
          <div style={{ gridColumn: "1/-1" }}>
            <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, marginBottom: 3 }}>الوصف</div>
            <div style={{ fontSize: 13, color: "#374151" }}>{practice.description}</div>
          </div>
        )}
        {practice.notes && (
          <div style={{ gridColumn: "1/-1" }}>
            <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, marginBottom: 3 }}>الملاحظات</div>
            <div style={{ fontSize: 13, color: "#374151" }}>{practice.notes}</div>
          </div>
        )}
      </div>

      {/* file uploads */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <FileText size={14} color={G} /> المستندات المرفقة
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
          {DOCS.map(doc => {
            const Icon = doc.icon;
            return (
              <div key={doc.field}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: doc.bg, border: `1px solid ${doc.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={12} color={doc.color} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{doc.label}</span>
                  {savingFields.has(doc.field) && <Loader2 size={11} color={G} style={{ animation: "spin 1s linear infinite" }} />}
                </div>
                <FileUpload
                  objectPath={(files as any)[doc.field]}
                  onChange={path => handleFileChange(doc.field, path)}
                  label={`رفع ${doc.label}`}
                  disabled={!canEdit || savingFields.size > 0}
                />
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════ */
export default function PracticesList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";
  const canEdit = isAdmin || !!user?.canEdit;
  const canDownload = isAdmin || !!user?.canDownload;

  const [activeTab,  setActiveTab]  = useState("all");
  const [search,     setSearch]     = useState("");
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState<number | null>(null);
  const [form,       setForm]       = useState({ ...emptyForm });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  /* ── data ── */
  const { data: stats } = useQuery<any>({
    queryKey: ["practices-stats"],
    queryFn: () => apiFetch("/api/practices/stats"),
  });

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["practices", activeTab, search],
    queryFn: () => {
      const p = new URLSearchParams();
      if (activeTab !== "all") p.set("status", activeTab);
      if (search) p.set("search", search);
      return apiFetch("/api/practices?" + p.toString());
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["practices"] });
    qc.invalidateQueries({ queryKey: ["practices-stats"] });
  };

  /* ── mutations ── */
  const upsert = useMutation({
    mutationFn: (data: any) =>
      editId
        ? apiFetch(`/api/practices/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        : apiFetch("/api/practices",           { method: "POST",  headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); closeForm(); },
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/practices/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(),
  });

  /* ── form helpers ── */
  const openAdd  = () => { setEditId(null); setForm({ ...emptyForm }); setShowForm(true); };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      practiceNumber: p.practiceNumber || "", projectName: p.projectName || "",
      description: p.description || "", governmentEntity: p.governmentEntity || "",
      contractValue: p.contractValue ?? "", profitPercentage: p.profitPercentage ?? "",
      completionPercentage: p.completionPercentage ?? "", startYear: p.startYear || "",
      endYear: p.endYear || "", status: p.status || "current",
      expectedValue: p.expectedValue ?? "", finalBondValue: p.finalBondValue ?? "",
      notes: p.notes || "", responsibleEmployee: p.responsibleEmployee || "",
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      practiceNumber:       form.practiceNumber,
      projectName:          form.projectName,
      description:          form.description || null,
      governmentEntity:     form.governmentEntity || null,
      status:               form.status,
      startYear:            form.startYear || null,
      endYear:              form.endYear   || null,
      notes:                form.notes     || null,
      responsibleEmployee:  form.responsibleEmployee || null,
      contractValue:        form.contractValue        ? String(form.contractValue)        : null,
      profitPercentage:     form.profitPercentage     ? String(form.profitPercentage)     : null,
      completionPercentage: form.completionPercentage ? String(form.completionPercentage) : null,
      expectedValue:        form.expectedValue        ? String(form.expectedValue)        : null,
      finalBondValue:       form.finalBondValue       ? String(form.finalBondValue)       : null,
    };
    upsert.mutate(payload);
  };

  /* ── export ── */
  const handleExport = () => {
    const lines = [
      ["رقم الممارسة", "اسم المشروع", "الجهة", "المسؤول", "الحالة", "قيمة العقد", "هامش الربح%", "الإنجاز%", "سنة البدء", "سنة الانتهاء", "الملاحظات"],
      ...rows.map(r => [
        r.practiceNumber, r.projectName, r.governmentEntity, r.responsibleEmployee ?? "",
        STATUS_MAP[r.status]?.label ?? r.status,
        r.contractValue ?? "", r.profitPercentage ?? "",
        r.completionPercentage ?? "", r.startYear ?? "", r.endYear ?? "", r.notes ?? "",
      ]),
    ];
    const csv = "\uFEFF" + lines.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = "الممارسات.csv"; a.click();
  };

  /* ── stat cards ── */
  const statCards = [
    { id: "all",              label: "إجمالي الممارسات",  value: stats?.total            ?? "—", color: "#64748b", bg: "#f8fafc" },
    { id: "current",         label: "جاري",              value: stats?.current          ?? "—", color: "#2563eb", bg: "#eff6ff" },
    { id: "previous",        label: "منجز",              value: stats?.previous         ?? "—", color: "#16a34a", bg: "#f0fdf4" },
    { id: "targeted",        label: "مستهدف",            value: stats?.targeted         ?? "—", color: "#d97706", bg: "#fffbeb" },
    { id: "under_submission",label: "تحت التقديم",       value: stats?.underSubmission  ?? "—", color: "#7c3aed", bg: "#f5f3ff" },
  ];

  const isFuture = (s: string) => s === "targeted" || s === "under_submission" || s === "future";
  const canChangeStatus = (p: any) => isAdmin || user?.fullName === p.responsibleEmployee;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>سجل الممارسات</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>جاري · منجز · مستهدف · تحت التقديم</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {canDownload && (
            <button onClick={handleExport} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "white", border: "1.5px solid #e5e7eb", color: "#374151", fontFamily: "inherit" }}>
              <Download size={15} /> تصدير CSV
            </button>
          )}
          {canEdit && (
            <button onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 4px 14px rgba(212,165,52,0.4)` }}>
              <Plus size={15} /> إضافة ممارسة
            </button>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
        {statCards.map(card => (
          <button key={card.id} onClick={() => setActiveTab(card.id)}
            style={{ padding: "16px 18px", borderRadius: 14, border: `2px solid ${activeTab === card.id ? card.color : "transparent"}`, background: activeTab === card.id ? card.bg : "white", cursor: "pointer", textAlign: "right", fontFamily: "inherit", boxShadow: activeTab === card.id ? `0 4px 16px ${card.color}25` : "0 1px 4px rgba(0,0,0,0.06)", transition: "all 0.15s" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginTop: 2 }}>{card.label}</div>
          </button>
        ))}
        <div style={{ padding: "16px 18px", borderRadius: 14, border: "1.5px solid #e5e7eb", background: "white", textAlign: "right", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: G }}>{stats?.totalContractValue ? formatCurrency(Number(stats.totalContractValue)) : "—"}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginTop: 2 }}>إجمالي قيمة العقود</div>
        </div>
      </div>

      {/* ── Search + filter ── */}
      <div style={{ background: "white", borderRadius: 14, padding: "14px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الجهة أو الرقم..." style={{ ...S.input, paddingRight: 36 }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STATUS_TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${activeTab === t.id ? t.color : "#e5e7eb"}`, background: activeTab === t.id ? t.color + "18" : "white", color: activeTab === t.id ? t.color : "#6b7280", transition: "all 0.12s" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ background: "white", borderRadius: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                {["", "رقم الممارسة", "اسم المشروع", "الجهة", "المسؤول", "قيمة العقد", "هامش الربح", "الإنجاز", "الفترة", "الحالة", ""].map((h, i) => (
                  <th key={i} style={{ ...S.td, fontWeight: 800, fontSize: 12, color: "#374151", borderBottom: "none", background: "transparent", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={11} style={{ ...S.td, textAlign: "center", color: "#9ca3af", padding: 40 }}>جاري التحميل...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11} style={{ ...S.td, textAlign: "center", color: "#9ca3af", padding: 40 }}>
                  <ClipboardCheck size={32} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
                  لا توجد ممارسات
                </td></tr>
              ) : rows.map(p => {
                const st = STATUS_MAP[p.status] ?? STATUS_MAP["future"];
                const pctVal = pct(p.completionPercentage);
                const isExp = expandedId === p.id;
                return [
                  <tr key={p.id}
                    onClick={() => setExpandedId(isExp ? null : p.id)}
                    style={{ cursor: "pointer", transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

                    {/* expand toggle */}
                    <td style={{ ...S.td, width: 32, color: "#9ca3af" }}>
                      {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>

                    {/* practice number */}
                    <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700, color: G, whiteSpace: "nowrap" }}>{p.practiceNumber}</td>

                    {/* project name */}
                    <td style={{ ...S.td, fontWeight: 700, color: GR, maxWidth: 260 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.projectName}>{p.projectName}</div>
                      {p.description && (
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.description}>{p.description}</div>
                      )}
                    </td>

                    {/* entity */}
                    <td style={{ ...S.td, color: "#374151", whiteSpace: "nowrap" }}>{p.governmentEntity || "—"}</td>

                    {/* responsible employee */}
                    <td style={{ ...S.td }} onClick={e => e.stopPropagation()}>
                      {isAdmin
                        ? <PracticeEmployeeDropdown practiceId={p.id} currentEmployee={p.responsibleEmployee ?? null} onUpdated={invalidate} />
                        : <span style={{ fontSize: 12, color: "#374151" }}>{p.responsibleEmployee || "—"}</span>
                      }
                    </td>

                    {/* value */}
                    <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700, color: "#374151", whiteSpace: "nowrap" }}>
                      {isFuture(p.status)
                        ? (p.expectedValue ? <span style={{ color: "#d97706" }}>{formatCurrency(Number(p.expectedValue))} <span style={{ fontSize: 10, color: "#9ca3af" }}>متوقع</span></span> : "—")
                        : (p.contractValue ? formatCurrency(Number(p.contractValue)) : "—")}
                    </td>

                    {/* profit */}
                    <td style={{ ...S.td, textAlign: "center" }}>
                      {p.profitPercentage
                        ? <span style={{ padding: "2px 10px", borderRadius: 8, background: "#f0fdf4", color: "#16a34a", fontWeight: 700, fontSize: 12 }}>{Math.round(Number(p.profitPercentage))}%</span>
                        : "—"}
                    </td>

                    {/* completion */}
                    <td style={{ ...S.td, minWidth: 110 }}>
                      {pctVal !== null && !isFuture(p.status) ? (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                            <span style={{ fontWeight: 700, color: pctVal === 100 ? "#16a34a" : "#2563eb" }}>{pctVal}%</span>
                          </div>
                          <div style={{ height: 5, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pctVal}%`, background: pctVal === 100 ? "#16a34a" : G, borderRadius: 3, transition: "width 0.3s" }} />
                          </div>
                        </div>
                      ) : "—"}
                    </td>

                    {/* period */}
                    <td style={{ ...S.td, color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>
                      {p.startYear || p.endYear ? `${p.startYear ?? ""}${p.endYear && p.endYear !== p.startYear ? " – " + p.endYear : ""}` : "—"}
                    </td>

                    {/* status */}
                    <td style={{ ...S.td }} onClick={e => e.stopPropagation()}>
                      {canChangeStatus(p)
                        ? <PracticeStatusDropdown practiceId={p.id} currentStatus={p.status} onUpdated={invalidate} />
                        : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: st.bg, color: st.color }}>
                            <st.icon size={11} /> {st.label}
                          </span>
                      }
                    </td>

                    {/* actions */}
                    <td style={{ ...S.td, whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                      {canEdit && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openEdit(p)} style={{ padding: "5px 10px", borderRadius: 7, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                            <Pencil size={12} /> تعديل
                          </button>
                          {isAdmin && (
                            <button onClick={() => { if (confirm("هل تريد حذف هذه الممارسة؟")) del.mutate(p.id); }}
                              style={{ padding: "5px 10px", borderRadius: 7, border: "1.5px solid #fee2e2", background: "#fff5f5", cursor: "pointer", color: "#dc2626", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>,

                  /* expanded row */
                  isExp && (
                    <tr key={p.id + "-exp"}>
                      <td colSpan={11} style={{ padding: 0 }}>
                        <PracticeExpandedRow
                          practice={p}
                          canEdit={canChangeStatus(p)}
                          onUpdated={invalidate}
                        />
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ background: "#f9fafb", borderTop: "2px solid #e5e7eb" }}>
                  <td colSpan={5} style={{ ...S.td, fontWeight: 800, color: "#374151" }}>المجموع ({rows.length} سجل)</td>
                  <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 900, color: G, whiteSpace: "nowrap" }}>
                    {formatCurrency(rows.reduce((s, r) => s + (Number(r.contractValue || r.expectedValue) || 0), 0))}
                  </td>
                  <td colSpan={5} style={{ ...S.td }}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ════════════ DRAWER FORM ════════════ */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }} dir="rtl">
          <div onClick={closeForm} style={{ flex: 1, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ width: 520, background: "white", overflowY: "auto", boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" }}>
            {/* header */}
            <div style={{ padding: "20px 24px", borderBottom: "1.5px solid #f0ead8", display: "flex", alignItems: "center", justifyContent: "space-between", background: `linear-gradient(135deg,${GR},#1a3a20)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ClipboardCheck size={18} color={G} />
                <span style={{ fontSize: 15, fontWeight: 800, color: "white" }}>{editId ? "تعديل الممارسة" : "إضافة ممارسة جديدة"}</span>
              </div>
              <button onClick={closeForm} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: "white", display: "flex" }}><X size={16} /></button>
            </div>

            {/* body */}
            <form onSubmit={handleSubmit} style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, flex: 1 }}>

              <div>
                <label style={S.label}>رقم الممارسة *</label>
                <input required style={S.input} value={form.practiceNumber}
                  onChange={e => setForm(p => ({ ...p, practiceNumber: e.target.value }))} placeholder="مثال: ممارسة رقم 34" />
              </div>

              <div>
                <label style={S.label}>الحالة *</label>
                <select required style={S.select} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="current">جاري</option>
                  <option value="previous">منجز</option>
                  <option value="targeted">مستهدف</option>
                  <option value="under_submission">تحت التقديم</option>
                  <option value="future">مستقبلي</option>
                </select>
              </div>

              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.label}>اسم المشروع *</label>
                <input required style={S.input} value={form.projectName}
                  onChange={e => setForm(p => ({ ...p, projectName: e.target.value }))} placeholder="اسم الممارسة أو المشروع" />
              </div>

              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.label}>وصف المشروع</label>
                <textarea style={{ ...S.input, height: 72, resize: "vertical" } as any}
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="تفاصيل إضافية عن الممارسة..." />
              </div>

              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.label}>الجهة الحكومية</label>
                <input style={S.input} value={form.governmentEntity}
                  onChange={e => setForm(p => ({ ...p, governmentEntity: e.target.value }))} placeholder="مثال: وزارة التربية" />
              </div>

              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.label}>الموظف المسؤول</label>
                <input style={S.input} value={form.responsibleEmployee}
                  onChange={e => setForm(p => ({ ...p, responsibleEmployee: e.target.value }))} placeholder="اسم الموظف المسؤول عن الممارسة" />
              </div>

              {isFuture(form.status) ? (
                <>
                  <div>
                    <label style={S.label}>القيمة المتوقعة (د.ك)</label>
                    <input type="number" step="0.001" style={S.input} value={form.expectedValue}
                      onChange={e => setForm(p => ({ ...p, expectedValue: e.target.value }))} placeholder="0.000" />
                  </div>
                  <div>
                    <label style={S.label}>قيمة الكفالة النهائية (د.ك)</label>
                    <input type="number" step="0.001" style={S.input} value={form.finalBondValue}
                      onChange={e => setForm(p => ({ ...p, finalBondValue: e.target.value }))} placeholder="0.000" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={S.label}>قيمة العقد (د.ك)</label>
                    <input type="number" step="0.001" style={S.input} value={form.contractValue}
                      onChange={e => setForm(p => ({ ...p, contractValue: e.target.value }))} placeholder="0.000" />
                  </div>
                  <div>
                    <label style={S.label}>هامش الربح (%)</label>
                    <input type="number" step="0.01" min="0" max="100" style={S.input} value={form.profitPercentage}
                      onChange={e => setForm(p => ({ ...p, profitPercentage: e.target.value }))} placeholder="مثال: 18" />
                  </div>
                </>
              )}

              {!isFuture(form.status) && (
                <div>
                  <label style={S.label}>نسبة الإنجاز (%)</label>
                  <input type="number" step="1" min="0" max="100" style={S.input} value={form.completionPercentage}
                    onChange={e => setForm(p => ({ ...p, completionPercentage: e.target.value }))} placeholder="0 – 100" />
                </div>
              )}

              <div>
                <label style={S.label}>سنة البدء</label>
                <input style={S.input} value={form.startYear}
                  onChange={e => setForm(p => ({ ...p, startYear: e.target.value }))} placeholder="2025" />
              </div>
              <div>
                <label style={S.label}>سنة الانتهاء</label>
                <input style={S.input} value={form.endYear}
                  onChange={e => setForm(p => ({ ...p, endYear: e.target.value }))} placeholder="2026" />
              </div>

              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.label}>الملاحظات</label>
                <textarea style={{ ...S.input, height: 72, resize: "vertical" } as any}
                  value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات إضافية..." />
              </div>

              <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 8 }}>
                <button type="button" onClick={closeForm} style={{ padding: "10px 24px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", color: "#374151" }}>إلغاء</button>
                <button type="submit" disabled={upsert.isPending} style={{ padding: "10px 28px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 800, fontFamily: "inherit", boxShadow: `0 4px 14px rgba(212,165,52,0.4)`, opacity: upsert.isPending ? 0.7 : 1 }}>
                  {upsert.isPending ? "جاري الحفظ..." : (editId ? "حفظ التعديلات" : "إضافة الممارسة")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* CSS spin */
if (typeof document !== "undefined" && !document.getElementById("pl-spin")) {
  const s = document.createElement("style");
  s.id = "pl-spin";
  s.textContent = "@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
  document.head.appendChild(s);
}
