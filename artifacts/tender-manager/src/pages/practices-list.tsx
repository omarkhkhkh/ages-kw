import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, Download, ClipboardCheck,
  X, ChevronDown, ChevronUp, Pencil, Trash2,
  CheckCircle2, Clock, Target, FileText, TrendingUp,
  UserCog, User2, Loader2,
  BookOpen, Calculator, Users, Package, Mail,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { formatCurrency } from "@/lib/utils";
import FileUpload from "@/components/file-upload";
import BidResultPanel from "@/components/bid-result-panel";
import CorrespondenceSheet from "@/components/correspondence/correspondence-sheet";
import { useToast } from "@/hooks/use-toast";
import EntityDirectoryPicker from "@/components/entity-directory-picker";
import LinkedPricingSheets from "@/components/linked-pricing-sheets";
import LinkedTasks from "@/components/linked-tasks";

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
  governmentEntity: "", governmentEntityId: "" as string | number | null,
  departmentId: "" as string | number | null, contactId: "" as string | number | null,
  contractValue: "", profitPercentage: "",
  completionPercentage: "", startYear: "", endYear: "",
  preliminaryMeetingHeld: false as boolean, preliminaryMeetingDate: "",
  status: "current", expectedValue: "", finalBondValue: "", notes: "",
  responsibleEmployee: "", companyId: "",
};

/* ─── api helper ─── */
async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(url, { credentials: "include", ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

/* ─── styles ─── */
const S = {
  label: { fontSize: 11.5, fontWeight: 700, color: "#64748b", marginBottom: 5, display: "block" } as any,
  input: {
    width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e2e8f0",
    fontSize: 13, fontFamily: "inherit", outline: "none", background: "white",
    boxSizing: "border-box", transition: "border-color 0.15s, box-shadow 0.15s",
  } as any,
  select: {
    width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e2e8f0",
    fontSize: 13, fontFamily: "inherit", outline: "none", background: "white",
    boxSizing: "border-box", cursor: "pointer", transition: "border-color 0.15s",
  } as any,
  td: {
    padding: "11px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 13,
    verticalAlign: "middle", textAlign: "right",
  } as any,
  th: {
    padding: "11px 14px", fontWeight: 800, fontSize: 11, color: "#64748b", textAlign: "right",
    background: "linear-gradient(to bottom,#f8fafc,#f1f5f9)", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap",
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
  const [activeTab, setActiveTab] = useState<"docs"|"bid"|"pricing"|"tasks">("docs");
  const [files, setFiles] = useState({
    fileConditions: practice.fileConditions ?? null,
    filePricing:    practice.filePricing    ?? null,
    fileSuppliers:  practice.fileSuppliers  ?? null,
    fileOpening:    practice.fileOpening    ?? null,
  });
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());

  const isFutureStatus = (s: string) => s === "targeted" || s === "under_submission" || s === "future";
  const pctCompletion = pct(practice.completionPercentage);

  const handleFileChange = async (field: string, path: string | null) => {
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

  const stConfig = STATUS_MAP[practice.status] ?? STATUS_MAP["future"];

  return (
    <div style={{ background: "#f4f6f9", borderBottom: "2px solid #e2e8f0" }} dir="rtl">

      {/* ── Mini hero bar ── */}
      <div style={{ background: `linear-gradient(135deg,${GR},#1e3a22)`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        {/* status badge */}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, background: stConfig.bg, color: stConfig.color }}>
          <stConfig.icon size={11} /> {stConfig.label}
        </span>

        {/* divider */}
        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.15)" }} />

        {/* quick stats */}
        {[
          {
            label: isFutureStatus(practice.status) ? "القيمة المتوقعة" : "قيمة العقد",
            value: isFutureStatus(practice.status)
              ? (practice.expectedValue ? formatCurrency(Number(practice.expectedValue)) : "—")
              : (practice.contractValue ? formatCurrency(Number(practice.contractValue)) : "—"),
            mono: true,
          },
          practice.profitPercentage && !isFutureStatus(practice.status)
            ? { label: "هامش الربح", value: `${Math.round(Number(practice.profitPercentage))}%`, mono: false }
            : practice.finalBondValue && isFutureStatus(practice.status)
            ? { label: "الكفالة النهائية", value: formatCurrency(Number(practice.finalBondValue)), mono: true }
            : null,
          practice.startYear || practice.endYear
            ? { label: "الفترة", value: `${practice.startYear ?? ""}${practice.endYear && practice.endYear !== practice.startYear ? " – " + practice.endYear : ""}`, mono: false }
            : null,
          practice.responsibleEmployee
            ? { label: "المسؤول", value: practice.responsibleEmployee, mono: false }
            : null,
        ].filter(Boolean).map((s: any, i) => (
          <div key={i}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 700, marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "white", fontFamily: s.mono ? "monospace" : undefined }}>{s.value}</div>
          </div>
        ))}

        {/* completion bar */}
        {pctCompletion !== null && !isFutureStatus(practice.status) && (
          <div style={{ marginRight: "auto", minWidth: 140 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 5 }}>
              <span>الإنجاز</span>
              <span style={{ fontWeight: 800, color: pctCompletion === 100 ? "#86efac" : G }}>{pctCompletion}%</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pctCompletion}%`, background: pctCompletion === 100 ? "#22c55e" : `linear-gradient(90deg,${G},${GD})`, borderRadius: 3, transition: "width 0.4s" }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div style={{ padding: "0 24px", background: "white", borderBottom: "1.5px solid #e2e8f0", display: "flex", gap: 4, alignItems: "center" }}>
        {([["docs", "📄 المستندات"], ["bid", "🏆 فض العطاء"], ["pricing", "🧮 التسعير"], ["tasks", "☑️ المهام"]] as const).map(([t, l]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{
              padding: "11px 20px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              background: activeTab === t ? `linear-gradient(135deg,${G},${GD})` : "none",
              border: "none", fontFamily: "inherit",
              color: activeTab === t ? "white" : "#64748b",
              borderRadius: activeTab === t ? "0 0 8px 8px" : 0,
              boxShadow: activeTab === t ? `0 2px 10px ${G}40` : "none",
              transition: "all 0.15s",
            }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ padding: "20px 24px" }}>
        {activeTab === "bid" ? (
          <BidResultPanel
            sourceType="practice"
            sourceId={practice.id}
            ourPrice={practice.contractValue ?? practice.expectedValue}
          />
        ) : activeTab === "pricing" ? (
          <LinkedPricingSheets entityType="practice" entityId={practice.id} />
        ) : activeTab === "tasks" ? (
          <LinkedTasks entityType="practice" entityId={practice.id} />
        ) : (
          <>
            {/* description + notes */}
            {(practice.description || practice.notes) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                {practice.description && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "white", border: "1px solid #e2e8f0", padding: "12px 16px", borderRadius: 12 }}>
                    <FileText size={14} color={G} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94a3b8", marginBottom: 4 }}>الوصف</div>
                      <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{practice.description}</div>
                    </div>
                  </div>
                )}
                {practice.notes && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#fffbeb", border: "1px solid #fde68a", padding: "12px 16px", borderRadius: 12 }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>📝</span>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 800, color: "#92400e", marginBottom: 4 }}>الملاحظات</div>
                      <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.7 }}>{practice.notes}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* file upload cards */}
            <div style={{ fontSize: 12.5, fontWeight: 800, color: GR, marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
              <FileText size={14} color={G} /> المستندات المرفقة
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>
                ({DOCS.filter(d => (files as any)[d.field]).length} من {DOCS.length} مرفق)
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 14 }}>
              {DOCS.map(doc => {
                const Icon = doc.icon;
                const hasFile = !!(files as any)[doc.field];
                const isSaving = savingFields.has(doc.field);
                return (
                  <div key={doc.field}
                    style={{ background: "white", borderRadius: 14, border: `1.5px solid ${hasFile ? doc.border : "#e2e8f0"}`, padding: "14px 16px", boxShadow: hasFile ? `0 2px 10px ${doc.color}15` : "0 1px 4px rgba(0,0,0,0.04)", transition: "all 0.2s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: hasFile ? doc.bg : "#f8fafc", border: `1.5px solid ${hasFile ? doc.border : "#e2e8f0"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                        <Icon size={15} color={hasFile ? doc.color : "#94a3b8"} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: hasFile ? GR : "#64748b" }}>{doc.label}</div>
                        {hasFile && (
                          <span style={{ fontSize: 10.5, background: doc.bg, color: doc.color, padding: "1px 8px", borderRadius: 10, fontWeight: 700 }}>
                            مرفق ✓
                          </span>
                        )}
                      </div>
                      {isSaving && <Loader2 size={13} color={G} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />}
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
  const [correspondenceFor, setCorrespondenceFor] = useState<{ id: number; label: string } | null>(null);

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

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["companies-list"],
    queryFn: () => apiFetch("/api/company-documents/companies"),
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
      governmentEntityId: p.governmentEntityId || "", departmentId: p.departmentId || "", contactId: p.contactId || "",
      contractValue: p.contractValue ?? "", profitPercentage: p.profitPercentage ?? "",
      completionPercentage: p.completionPercentage ?? "", startYear: p.startYear || "",
      endYear: p.endYear || "",
      preliminaryMeetingHeld: p.preliminaryMeetingHeld ?? false,
      preliminaryMeetingDate: p.preliminaryMeetingDate || "",
      status: p.status || "current",
      expectedValue: p.expectedValue ?? "", finalBondValue: p.finalBondValue ?? "",
      notes: p.notes || "", responsibleEmployee: p.responsibleEmployee || "",
      companyId: p.companyId || "",
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
      governmentEntityId:   form.governmentEntityId ? Number(form.governmentEntityId) : null,
      departmentId:         form.departmentId ? Number(form.departmentId) : null,
      contactId:            form.contactId ? Number(form.contactId) : null,
      status:               form.status,
      startYear:            form.startYear || null,
      endYear:              form.endYear   || null,
      preliminaryMeetingHeld: Boolean(form.preliminaryMeetingHeld),
      preliminaryMeetingDate: form.preliminaryMeetingHeld ? (form.preliminaryMeetingDate || null) : null,
      notes:                form.notes     || null,
      responsibleEmployee:  form.responsibleEmployee || null,
      companyId:            form.companyId ? Number(form.companyId) : null,
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
      <div style={{ background: "white", borderRadius: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.07)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
        {/* table header bar */}
        <div style={{ padding: "14px 20px", borderBottom: "1.5px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8, background: "#fafbfc" }}>
          <ClipboardCheck size={15} color={G} />
          <span style={{ fontSize: 13.5, fontWeight: 800, color: GR }}>قائمة الممارسات</span>
          <span style={{ marginRight: "auto", fontSize: 11.5, color: "#94a3b8", background: "#f1f5f9", padding: "2px 10px", borderRadius: 20, fontWeight: 700 }}>
            {rows.length} سجل
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
            <thead>
              <tr>
                {["", "رقم الممارسة", "اسم المشروع", "الجهة", "المسؤول", "قيمة العقد", "هامش الربح", "الإنجاز", "الفترة", "الحالة", ""].map((h, i) => (
                  <th key={i} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={11} style={{ ...S.td, textAlign: "center", padding: 48 }}>
                  <Loader2 size={22} style={{ animation: "spin 1s linear infinite", color: G, display: "inline-block" }} />
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11} style={{ ...S.td, textAlign: "center", padding: 52 }}>
                  <ClipboardCheck size={32} style={{ margin: "0 auto 10px", display: "block", color: "#cbd5e1" }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8" }}>لا توجد ممارسات</div>
                  <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>جرّب تغيير الفلتر أو البحث</div>
                </td></tr>
              ) : rows.map(p => {
                const st = STATUS_MAP[p.status] ?? STATUS_MAP["future"];
                const pctVal = pct(p.completionPercentage);
                const isExp = expandedId === p.id;
                const rowBg = isExp ? "#fffdf0" : "white";
                return [
                  <tr key={p.id}
                    onClick={() => setExpandedId(isExp ? null : p.id)}
                    style={{ cursor: "pointer", background: rowBg, borderRight: isExp ? `3px solid ${G}` : "3px solid transparent", transition: "background 0.1s" }}
                    onMouseEnter={e => { if (!isExp) e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}>

                    {/* expand toggle */}
                    <td style={{ ...S.td, width: 36, textAlign: "center" }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: isExp ? `linear-gradient(135deg,${G},${GD})` : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", transition: "all 0.15s" }}>
                        {isExp ? <ChevronUp size={13} color="white" /> : <ChevronDown size={13} color="#64748b" />}
                      </div>
                    </td>

                    {/* practice number */}
                    <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 800, color: G, whiteSpace: "nowrap" }}>{p.practiceNumber}</td>

                    {/* project name */}
                    <td style={{ ...S.td, fontWeight: 700, color: GR, maxWidth: 260 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.projectName}>{p.projectName}</div>
                      {p.description && (
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.description}>{p.description}</div>
                      )}
                    </td>

                    {/* entity */}
                    <td style={{ ...S.td, color: "#475569", whiteSpace: "nowrap", fontSize: 12.5 }}>{p.governmentEntity || "—"}</td>

                    {/* responsible employee */}
                    <td style={{ ...S.td }} onClick={e => e.stopPropagation()}>
                      {isAdmin
                        ? <PracticeEmployeeDropdown practiceId={p.id} currentEmployee={p.responsibleEmployee ?? null} onUpdated={invalidate} />
                        : <span style={{ fontSize: 12.5, color: "#475569" }}>{p.responsibleEmployee || "—"}</span>
                      }
                    </td>

                    {/* value */}
                    <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700, color: "#374151", whiteSpace: "nowrap" }}>
                      {isFuture(p.status)
                        ? (p.expectedValue
                          ? <span style={{ color: "#d97706" }}>{formatCurrency(Number(p.expectedValue))} <span style={{ fontSize: 10, background: "#fef9c3", color: "#92400e", padding: "1px 5px", borderRadius: 5, fontFamily: "inherit" }}>متوقع</span></span>
                          : "—")
                        : (p.contractValue ? formatCurrency(Number(p.contractValue)) : "—")}
                    </td>

                    {/* profit */}
                    <td style={{ ...S.td, textAlign: "center" }}>
                      {p.profitPercentage
                        ? <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: "#f0fdf4", color: "#16a34a", fontWeight: 800, fontSize: 12 }}>{Math.round(Number(p.profitPercentage))}%</span>
                        : <span style={{ color: "#cbd5e1" }}>—</span>}
                    </td>

                    {/* completion */}
                    <td style={{ ...S.td, minWidth: 120 }}>
                      {pctVal !== null && !isFuture(p.status) ? (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                            <span style={{ fontWeight: 800, color: pctVal === 100 ? "#16a34a" : GD }}>{pctVal}%</span>
                          </div>
                          <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pctVal}%`, background: pctVal === 100 ? "#22c55e" : `linear-gradient(90deg,${G},${GD})`, borderRadius: 3, transition: "width 0.4s" }} />
                          </div>
                        </div>
                      ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                    </td>

                    {/* period */}
                    <td style={{ ...S.td, color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>
                      {p.startYear || p.endYear
                        ? <span style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
                            {p.startYear ?? ""}
                            {p.endYear && p.endYear !== p.startYear ? ` – ${p.endYear}` : ""}
                          </span>
                        : <span style={{ color: "#cbd5e1" }}>—</span>}
                    </td>

                    {/* status */}
                    <td style={{ ...S.td }} onClick={e => e.stopPropagation()}>
                      {canChangeStatus(p)
                        ? <PracticeStatusDropdown practiceId={p.id} currentStatus={p.status} onUpdated={invalidate} />
                        : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, background: st.bg, color: st.color }}>
                            <st.icon size={11} /> {st.label}
                          </span>
                      }
                    </td>

                    {/* actions */}
                    <td style={{ ...S.td, whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setCorrespondenceFor({ id: p.id, label: p.practiceNumber })}
                          style={{ padding: "5px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "white", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
                          <Mail size={12} /> المراسلات
                        </button>
                      </div>
                      {canEdit && (
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button onClick={() => openEdit(p)}
                            style={{ padding: "5px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "white", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}
                            onMouseEnter={ev => { ev.currentTarget.style.borderColor = G; ev.currentTarget.style.color = GD; }}
                            onMouseLeave={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.color = "#475569"; }}>
                            <Pencil size={12} /> تعديل
                          </button>
                          {isAdmin && (
                            <button onClick={() => { if (confirm("هل تريد حذف هذه الممارسة؟")) del.mutate(p.id); }}
                              style={{ padding: "5px 10px", borderRadius: 8, border: "1.5px solid #fecaca", background: "#fff5f5", cursor: "pointer", color: "#dc2626", display: "flex", alignItems: "center", fontSize: 12, fontFamily: "inherit" }}>
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
                <tr style={{ background: "linear-gradient(to bottom,#f8fafc,#f1f5f9)", borderTop: "2px solid #e2e8f0" }}>
                  <td colSpan={5} style={{ ...S.td, fontWeight: 800, color: GR }}>المجموع ({rows.length} سجل)</td>
                  <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 900, color: G, whiteSpace: "nowrap", fontSize: 14 }}>
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
          {/* overlay */}
          <div onClick={closeForm} style={{ flex: 1, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }} />

          {/* panel */}
          <div style={{ width: 540, background: "#f8fafc", overflowY: "auto", boxShadow: "-12px 0 48px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>

            {/* ── Header ── */}
            <div style={{ padding: "0 24px 0", background: `linear-gradient(135deg,${GR},#1e3a22)`, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg,${G},${GD})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ClipboardCheck size={18} color="white" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "white" }}>{editId ? "تعديل الممارسة" : "إضافة ممارسة جديدة"}</div>
                    <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>أدخل بيانات الممارسة أدناه</div>
                  </div>
                </div>
                <button onClick={closeForm}
                  style={{ background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: 9, padding: 7, cursor: "pointer", color: "white", display: "flex", alignItems: "center" }}>
                  <X size={15} />
                </button>
              </div>

              {/* status selector */}
              <div style={{ paddingBottom: 16 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>الحالة</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(["current","previous","targeted","under_submission","future"] as const).map(s => {
                    const opt = STATUS_MAP[s];
                    const active = form.status === s;
                    return (
                      <button key={s} type="button" onClick={() => setForm(p => ({ ...p, status: s }))}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${active ? opt.color : "rgba(255,255,255,0.15)"}`, background: active ? opt.bg : "rgba(255,255,255,0.08)", color: active ? opt.color : "rgba(255,255,255,0.6)", transition: "all 0.15s" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? opt.color : "rgba(255,255,255,0.4)", flexShrink: 0 }} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Body ── */}
            <form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>

              {/* Section 1: معلومات أساسية */}
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px" }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                  <ClipboardCheck size={13} color={G} /> المعلومات الأساسية
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
                  <div>
                    <label style={S.label}>رقم الممارسة *</label>
                    <input required style={S.input} value={form.practiceNumber}
                      onChange={e => setForm(p => ({ ...p, practiceNumber: e.target.value }))} placeholder="مثال: ممارسة رقم 34"
                      onFocus={ev => { ev.currentTarget.style.borderColor = G; ev.currentTarget.style.boxShadow = `0 0 0 3px ${G}18`; }}
                      onBlur={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.boxShadow = "none"; }} />
                  </div>
                  <div>
                    <label style={S.label}>اسم المشروع *</label>
                    <input required style={S.input} value={form.projectName}
                      onChange={e => setForm(p => ({ ...p, projectName: e.target.value }))} placeholder="اسم الممارسة أو المشروع"
                      onFocus={ev => { ev.currentTarget.style.borderColor = G; ev.currentTarget.style.boxShadow = `0 0 0 3px ${G}18`; }}
                      onBlur={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.boxShadow = "none"; }} />
                  </div>
                  <div>
                    <label style={S.label}>وصف المشروع</label>
                    <textarea style={{ ...S.input, height: 72, resize: "vertical" } as any}
                      value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="تفاصيل إضافية عن الممارسة..."
                      onFocus={ev => { ev.currentTarget.style.borderColor = G; ev.currentTarget.style.boxShadow = `0 0 0 3px ${G}18`; }}
                      onBlur={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.boxShadow = "none"; }} />
                  </div>
                  <div>
                    <label style={S.label}>الجهة الحكومية ← الاختصاص ← المسؤول</label>
                    <EntityDirectoryPicker
                      value={{ governmentEntityId: form.governmentEntityId, departmentId: form.departmentId, contactId: form.contactId }}
                      onChange={next => setForm(p => ({ ...p, ...next }))}
                    />
                  </div>
                  <div>
                    <label style={S.label}>الموظف المسؤول</label>
                    <input style={S.input} value={form.responsibleEmployee}
                      onChange={e => setForm(p => ({ ...p, responsibleEmployee: e.target.value }))} placeholder="اسم الموظف..."
                      onFocus={ev => { ev.currentTarget.style.borderColor = G; ev.currentTarget.style.boxShadow = `0 0 0 3px ${G}18`; }}
                      onBlur={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.boxShadow = "none"; }} />
                  </div>
                  <div>
                    <label style={S.label}>الشركة المشاركة</label>
                    <select style={S.input} value={form.companyId}
                      onChange={e => setForm(p => ({ ...p, companyId: e.target.value }))}
                      onFocus={ev => { ev.currentTarget.style.borderColor = G; ev.currentTarget.style.boxShadow = `0 0 0 3px ${G}18`; }}
                      onBlur={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.boxShadow = "none"; }}>
                      <option value="">— اختر الشركة —</option>
                      {companies.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: البيانات المالية */}
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px" }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                  <TrendingUp size={13} color={G} /> البيانات المالية
                  {isFuture(form.status) && <span style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 500 }}>— حالة مستقبلية</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {isFuture(form.status) ? (
                    <>
                      <div>
                        <label style={S.label}>القيمة المتوقعة (د.ك)</label>
                        <input type="number" step="0.001" style={{ ...S.input, direction: "ltr", textAlign: "left", fontFamily: "monospace" }} value={form.expectedValue}
                          onChange={e => setForm(p => ({ ...p, expectedValue: e.target.value }))} placeholder="0.000"
                          onFocus={ev => { ev.currentTarget.style.borderColor = G; ev.currentTarget.style.boxShadow = `0 0 0 3px ${G}18`; }}
                          onBlur={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.boxShadow = "none"; }} />
                      </div>
                      <div>
                        <label style={S.label}>قيمة الكفالة الأولية (د.ك)</label>
                        <input type="number" step="0.001" style={{ ...S.input, direction: "ltr", textAlign: "left", fontFamily: "monospace" }} value={form.finalBondValue}
                          onChange={e => setForm(p => ({ ...p, finalBondValue: e.target.value }))} placeholder="0.000"
                          onFocus={ev => { ev.currentTarget.style.borderColor = G; ev.currentTarget.style.boxShadow = `0 0 0 3px ${G}18`; }}
                          onBlur={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.boxShadow = "none"; }} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label style={S.label}>قيمة العقد (د.ك)</label>
                        <input type="number" step="0.001" style={{ ...S.input, direction: "ltr", textAlign: "left", fontFamily: "monospace" }} value={form.contractValue}
                          onChange={e => setForm(p => ({ ...p, contractValue: e.target.value }))} placeholder="0.000"
                          onFocus={ev => { ev.currentTarget.style.borderColor = G; ev.currentTarget.style.boxShadow = `0 0 0 3px ${G}18`; }}
                          onBlur={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.boxShadow = "none"; }} />
                      </div>
                      <div>
                        <label style={S.label}>هامش الربح (%)</label>
                        <input type="number" step="0.01" min="0" max="100" style={{ ...S.input, direction: "ltr", textAlign: "left", fontFamily: "monospace" }} value={form.profitPercentage}
                          onChange={e => setForm(p => ({ ...p, profitPercentage: e.target.value }))} placeholder="18"
                          onFocus={ev => { ev.currentTarget.style.borderColor = G; ev.currentTarget.style.boxShadow = `0 0 0 3px ${G}18`; }}
                          onBlur={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.boxShadow = "none"; }} />
                      </div>
                    </>
                  )}
                  {!isFuture(form.status) && (
                    <div>
                      <label style={S.label}>نسبة الإنجاز (%)</label>
                      <input type="number" step="1" min="0" max="100" style={{ ...S.input, direction: "ltr", textAlign: "left", fontFamily: "monospace" }} value={form.completionPercentage}
                        onChange={e => setForm(p => ({ ...p, completionPercentage: e.target.value }))} placeholder="0 – 100"
                        onFocus={ev => { ev.currentTarget.style.borderColor = G; ev.currentTarget.style.boxShadow = `0 0 0 3px ${G}18`; }}
                        onBlur={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.boxShadow = "none"; }} />
                    </div>
                  )}
                  <div>
                    <label style={S.label}>سنة البدء</label>
                    <input style={{ ...S.input, direction: "ltr", textAlign: "left" }} value={form.startYear}
                      onChange={e => setForm(p => ({ ...p, startYear: e.target.value }))} placeholder="2025"
                      onFocus={ev => { ev.currentTarget.style.borderColor = G; ev.currentTarget.style.boxShadow = `0 0 0 3px ${G}18`; }}
                      onBlur={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.boxShadow = "none"; }} />
                  </div>
                  <div>
                    <label style={S.label}>سنة الانتهاء</label>
                    <input style={{ ...S.input, direction: "ltr", textAlign: "left" }} value={form.endYear}
                      onChange={e => setForm(p => ({ ...p, endYear: e.target.value }))} placeholder="2026"
                      onFocus={ev => { ev.currentTarget.style.borderColor = G; ev.currentTarget.style.boxShadow = `0 0 0 3px ${G}18`; }}
                      onBlur={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.boxShadow = "none"; }} />
                  </div>
                  <div>
                    <label style={S.label}>الاجتماع التمهيدي</label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151", cursor: "pointer", height: 38 }}>
                      <input
                        type="checkbox"
                        checked={form.preliminaryMeetingHeld}
                        onChange={e => setForm(p => ({ ...p, preliminaryMeetingHeld: e.target.checked, preliminaryMeetingDate: e.target.checked ? p.preliminaryMeetingDate : "" }))}
                        style={{ width: 16, height: 16, accentColor: G, cursor: "pointer" }}
                      />
                      هل عُقد الاجتماع التمهيدي؟
                    </label>
                  </div>
                  {form.preliminaryMeetingHeld && (
                    <div>
                      <label style={S.label}>تاريخ الاجتماع التمهيدي</label>
                      <input type="date" style={{ ...S.input, direction: "ltr", textAlign: "left" }} value={form.preliminaryMeetingDate}
                        onChange={e => setForm(p => ({ ...p, preliminaryMeetingDate: e.target.value }))}
                        onFocus={ev => { ev.currentTarget.style.borderColor = G; ev.currentTarget.style.boxShadow = `0 0 0 3px ${G}18`; }}
                        onBlur={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.boxShadow = "none"; }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: الملاحظات */}
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px" }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <FileText size={13} color={G} /> الملاحظات
                </div>
                <textarea style={{ ...S.input, height: 80, resize: "vertical" } as any}
                  value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات إضافية عن الممارسة..."
                  onFocus={ev => { ev.currentTarget.style.borderColor = G; ev.currentTarget.style.boxShadow = `0 0 0 3px ${G}18`; }}
                  onBlur={ev => { ev.currentTarget.style.borderColor = "#e2e8f0"; ev.currentTarget.style.boxShadow = "none"; }} />
              </div>

              {/* ── Action bar ── */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingBottom: 8 }}>
                <button type="button" onClick={closeForm}
                  style={{ padding: "10px 22px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", color: "#475569" }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={ev => (ev.currentTarget.style.background = "white")}>
                  إلغاء
                </button>
                <button type="submit" disabled={upsert.isPending}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 28px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", cursor: "pointer", fontSize: 13.5, fontWeight: 800, fontFamily: "inherit", boxShadow: `0 4px 14px ${G}40`, opacity: upsert.isPending ? 0.8 : 1, minWidth: 150 }}>
                  {upsert.isPending
                    ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> جاري الحفظ...</>
                    : <><ClipboardCheck size={14} /> {editId ? "حفظ التعديلات" : "إضافة الممارسة"}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {correspondenceFor && (
        <CorrespondenceSheet
          open={!!correspondenceFor}
          onOpenChange={(o) => !o && setCorrespondenceFor(null)}
          sourceType="practice"
          sourceId={correspondenceFor.id}
          recordLabel={correspondenceFor.label}
        />
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
