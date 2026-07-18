import { useState, useRef, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_ARABIC } from "@/lib/constants";
import {
  ArrowRight, Save, Trash2, Clock, Building, FileText,
  User, Loader2, BookOpen, Calculator, Users, Package, ChevronDown,
  Trophy, Pencil, X, AlertTriangle, Mail, ListChecks,
} from "lucide-react";
import FileUpload from "@/components/file-upload";
import BidResultPanel from "@/components/bid-result-panel";
import CorrespondenceListPanel from "@/components/correspondence/correspondence-list-panel";
import { useAuth } from "@/contexts/auth";
import EntityDirectoryPicker from "@/components/entity-directory-picker";
import LinkedPricingSheets from "@/components/linked-pricing-sheets";
import LinkedTasks from "@/components/linked-tasks";
import { useToast } from "@/hooks/use-toast";

/* ── theme (مطابق لصفحة المناقصة) ── */
const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const ACTIVE_STATUSES = ["new", "studying", "requesting_quotes", "preparing_technical", "preparing_financial", "management_review", "ready_to_submit", "under_evaluation"];

async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(url, { credentials: "include", headers: opts?.body ? { "Content-Type": "application/json" } : undefined, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

const INP: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box", background: "white", color: "#1e293b",
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5 }}>{children}</label>;
}
function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", fontFamily: mono ? "monospace" : undefined }}>
        {value || <span style={{ color: "#cbd5e1" }}>—</span>}
      </span>
    </div>
  );
}
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "white", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}
function PanelHead({ icon: Icon, label, color = G }: { icon: any; label: string; color?: string }) {
  return (
    <div style={{ padding: "14px 20px", borderBottom: "1.5px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg,${color},${color}cc)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} color="white" />
      </div>
      <span style={{ fontSize: 14, fontWeight: 800, color: GR }}>{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
export default function PracticeDetail() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: practice, isLoading } = useQuery<any>({
    queryKey: ["practice", id],
    queryFn: () => apiFetch(`/api/practices/${id}`),
    enabled: !!id,
  });
  const { data: companies = [] } = useQuery<any[]>({ queryKey: ["companies"], queryFn: () => companiesApi.list() });

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [activeTab, setActiveTab] = useState<"details" | "bid" | "pricing" | "tasks" | "correspondence">("details");
  const initialized = useRef(false);

  useEffect(() => {
    if (practice && (!initialized.current || !isEditing)) {
      setForm({ ...practice });
      initialized.current = true;
    }
  }, [practice, isEditing]);

  const updateM = useMutation({
    mutationFn: (data: any) => apiFetch(`/api/practices/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["practice", id] });
      qc.invalidateQueries({ queryKey: ["practices"] });
      qc.invalidateQueries({ queryKey: ["practices-stats"] });
      setIsEditing(false);
      toast({ title: "✅ تم حفظ التعديلات" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const deleteM = useMutation({
    mutationFn: () => apiFetch(`/api/practices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["practices"] });
      setLocation("/practices");
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  // بانر المنافسين الخطرين — نفس منطق صفحة المناقصة (جهة حكومية + ممارسة حية)
  const isLive = practice && ACTIVE_STATUSES.includes(practice.status);
  const { data: entityCompetitors = [] } = useQuery<any[]>({
    queryKey: ["entity-competitors", practice?.governmentEntityId],
    queryFn: () => apiFetch(`/api/analytics/competitors/by-entity/${practice!.governmentEntityId}`),
    enabled: !!practice?.governmentEntityId && !!isLive,
    staleTime: 5 * 60_000,
  });
  const threatCompetitors = (entityCompetitors as any[]).filter(
    (c) => Number(c.wins) >= 2 || (Number(c.wins) >= 1 && Number(c.wins) / Math.max(1, Number(c.total_bids)) >= 0.3),
  );

  if (isLoading || !practice) {
    return (
      <div dir="rtl" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <Loader2 size={28} color={G} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleSave = () => {
    const num = (v: any) => (v === "" || v === null || v === undefined ? null : String(v));
    updateM.mutate({
      practiceNumber: form.practiceNumber,
      projectName: form.projectName,
      description: form.description || null,
      governmentEntity: form.governmentEntity || null,
      governmentEntityId: form.governmentEntityId || null,
      departmentId: form.departmentId || null,
      contactId: form.contactId || null,
      companyId: form.companyId ? Number(form.companyId) : null,
      announcementDate: form.announcementDate || null,
      deadline: form.deadline || null,
      offerValue: num(form.offerValue),
      isSubmitted: !!form.isSubmitted,
      winner: form.winner || null,
      contractValue: num(form.contractValue),
      expectedValue: num(form.expectedValue),
      profitPercentage: num(form.profitPercentage),
      completionPercentage: num(form.completionPercentage),
      startYear: form.startYear ? Number(form.startYear) : null,
      endYear: form.endYear ? Number(form.endYear) : null,
      preliminaryMeetingHeld: !!form.preliminaryMeetingHeld,
      preliminaryMeetingDate: form.preliminaryMeetingDate || null,
      finalBondValue: num(form.finalBondValue),
      responsibleEmployee: form.responsibleEmployee || null,
      notes: form.notes || null,
    });
  };

  const handleStatusChange = (status: string) => updateM.mutate({ status });
  const handleFileChange = (field: string, objectPath: string | null) => updateM.mutate({ [field]: objectPath });

  const canEdit = user?.role === "admin" || user?.canEdit || user?.fullName === practice.responsibleEmployee;
  const isAdmin = user?.role === "admin";

  const daysLeft = practice.deadline
    ? Math.ceil((new Date(practice.deadline).getTime() - Date.now()) / 86_400_000)
    : null;
  const urgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && ACTIVE_STATUSES.includes(practice.status);

  const TABS: [string, string, any][] = [
    ["details", "تفاصيل الممارسة", FileText],
    ["bid", "فض الظروف", Trophy],
    ["pricing", "التسعير", Calculator],
    ["correspondence", "المراسلات", Mail],
    ["tasks", "المهام المرتبطة", ListChecks],
  ];

  const DOC_CARDS = [
    { field: "fileConditions", label: "الشروط الخاصة",   icon: BookOpen,   color: "#3b82f6", bg: "#eff6ff" },
    { field: "filePricing",    label: "جداول التسعير",    icon: Calculator, color: "#10b981", bg: "#ecfdf5" },
    { field: "fileSuppliers",  label: "عروض الموردين",    icon: Users,      color: "#8b5cf6", bg: "#f5f3ff" },
    { field: "fileOpening",    label: "وثيقة فض الظروف", icon: Package,    color: "#f59e0b", bg: "#fffbeb" },
  ];

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", maxWidth: 1100, margin: "0 auto", paddingBottom: 40 }}>

      {/* ══ HERO HEADER ══ */}
      <div style={{
        background: `linear-gradient(135deg,${GR} 0%,#1e3a22 65%,#0f2014 100%)`,
        borderRadius: 20, padding: "24px 28px", marginBottom: 24,
        boxShadow: "0 4px 24px rgba(19,42,24,0.22)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => setLocation("/practices")}
              style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "7px 9px", cursor: "pointer", display: "flex", flexShrink: 0 }}>
              <ArrowRight size={17} color="white" />
            </button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: G, background: "rgba(212,165,52,0.15)", border: "1px solid rgba(212,165,52,0.3)", padding: "2px 10px", borderRadius: 20 }}>
                  {practice.practiceNumber}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.08)", padding: "2px 10px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.12)" }}>
                  ممارسة
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, background: G, color: GR, padding: "2px 10px", borderRadius: 20 }}>
                  {STATUS_ARABIC[practice.status] ?? practice.status}
                </span>
                {urgent && (
                  <span style={{ fontSize: 11, fontWeight: 800, background: "#ef4444", color: "white", padding: "2px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4 }}>
                    <AlertTriangle size={10} /> عاجل
                  </span>
                )}
                {practice.isSubmitted && (
                  <span style={{ fontSize: 11, fontWeight: 800, background: "#16a34a", color: "white", padding: "2px 10px", borderRadius: 20 }}>
                    تم التقديم
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "white", margin: 0, lineHeight: 1.3 }}>
                {practice.projectName}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>
                  <Building size={13} /> {practice.governmentEntity || "جهة غير محددة"}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>
                  <User size={13} /> {practice.responsibleEmployee || "موظف غير محدد"}
                </span>
                {daysLeft !== null && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: daysLeft < 0 ? "#fca5a5" : daysLeft < 7 ? "#fde68a" : "rgba(255,255,255,0.6)" }}>
                    <Clock size={13} />
                    {daysLeft < 0 ? `انتهى منذ ${Math.abs(daysLeft)} يوم` : daysLeft === 0 ? "اليوم هو الموعد النهائي" : `${daysLeft} يوم متبقٍ`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!isEditing ? (
              <>
                {canEdit && (
                  <button onClick={() => setIsEditing(true)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                    <Pencil size={13} /> تعديل
                  </button>
                )}
                <div style={{ position: "relative" }}>
                  <select value={practice.status} onChange={(e) => handleStatusChange(e.target.value)}
                    style={{ padding: "8px 32px 8px 14px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: GR, cursor: "pointer", fontSize: 12.5, fontWeight: 800, fontFamily: "inherit", appearance: "none" }}>
                    {Object.entries(STATUS_ARABIC).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} color={GR} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                </div>
                {isAdmin && (
                  <button onClick={() => { if (confirm("حذف هذه الممارسة نهائيًا؟")) deleteM.mutate(); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, border: "1.5px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.12)", color: "#fca5a5", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </>
            ) : (
              <>
                <button onClick={() => { setIsEditing(false); initialized.current = false; }}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                  <X size={13} /> إلغاء
                </button>
                <button onClick={handleSave} disabled={updateM.isPending}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 20px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: GR, cursor: "pointer", fontSize: 13, fontWeight: 800, fontFamily: "inherit", boxShadow: `0 2px 10px ${G}50`, opacity: updateM.isPending ? 0.8 : 1 }}>
                  {updateM.isPending ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
                  حفظ التعديلات
                </button>
              </>
            )}
          </div>
        </div>

        {/* quick stats */}
        {!isEditing && (
          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            {[
              { label: "قيمة العرض المقدَّم", value: practice.offerValue ? formatCurrency(practice.offerValue) : "—", highlight: !!practice.offerValue },
              { label: "القيمة المتوقعة", value: practice.expectedValue ? formatCurrency(practice.expectedValue) : "—", highlight: false },
              { label: "قيمة العقد", value: practice.contractValue ? formatCurrency(practice.contractValue) : "—", highlight: false },
              { label: "نسبة الربح", value: practice.profitPercentage ? `${practice.profitPercentage}%` : "—", highlight: false },
            ].map((stat) => (
              <div key={stat.label} style={{ flex: "1 1 140px", background: stat.highlight ? "rgba(212,165,52,0.12)" : "rgba(255,255,255,0.06)", border: `1px solid ${stat.highlight ? "rgba(212,165,52,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", fontWeight: 700, marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: stat.highlight ? 16 : 14, fontWeight: 800, color: stat.highlight ? G : "rgba(255,255,255,0.85)", fontFamily: "monospace" }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ TAB BAR ══ */}
      <div style={{ display: "flex", background: "white", borderRadius: 12, padding: 5, gap: 4, marginBottom: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", overflowX: "auto" }}>
        {TABS.map(([t, l, Icon]) => {
          const active = activeTab === t;
          return (
            <button key={t} onClick={() => setActiveTab(t as any)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                background: active ? `linear-gradient(135deg,${G},${GD})` : "none",
                border: "none", borderRadius: 9, fontFamily: "inherit",
                color: active ? GR : "#64748b",
                boxShadow: active ? `0 2px 8px ${G}30` : "none",
              }}>
              <Icon size={14} /> {l}
            </button>
          );
        })}
      </div>

      {/* ══ بانر المنافسين الخطرين ══ */}
      {threatCompetitors.length > 0 && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 18px", background: "#fffbeb", border: "1.5px solid #fbbf24", borderRadius: 14, marginBottom: 18 }}>
          <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, color: "#92400e", fontSize: 14 }}>⚠️ منافسون خطرون متوقعون لهذه الجهة الحكومية</div>
            <div style={{ fontSize: 12, color: "#a16207", marginTop: 4, display: "flex", flexWrap: "wrap", gap: "4px 6px" }}>
              {threatCompetitors.map((c: any, i: number) => (
                <span key={c.competitor_id}>
                  <Link href={`/competitor-intelligence/c/${c.competitor_id}`} style={{ color: "#92400e", fontWeight: 800, textDecoration: "underline" }}>
                    {c.company_name}
                  </Link>
                  {" "}(فاز {c.wins} من {c.total_bids})
                  {i < threatCompetitors.length - 1 && <span style={{ color: "#d6b25e", margin: "0 2px" }}> · </span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ BID TAB ══ */}
      {activeTab === "bid" && <BidResultPanel sourceType="practice" sourceId={id} ourPrice={practice.offerValue} />}

      {/* ══ PRICING TAB ══ */}
      {activeTab === "pricing" && (
        <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px" }}>
          <LinkedPricingSheets entityType="practice" entityId={id} />
        </div>
      )}

      {/* ══ TASKS TAB ══ */}
      {activeTab === "tasks" && (
        <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px" }}>
          <LinkedTasks entityType="practice" entityId={id} />
        </div>
      )}

      {/* ══ CORRESPONDENCE TAB ══ */}
      {activeTab === "correspondence" && (
        <CorrespondenceListPanel sourceType="practice" sourceId={id} governmentEntityId={practice.governmentEntityId ?? null} />
      )}

      {/* ══ DETAILS TAB ══ */}
      {activeTab === "details" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>

          {/* MAIN COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Panel>
              <PanelHead icon={FileText} label="البيانات الأساسية" />
              <div style={{ padding: 20 }}>
                {isEditing ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div><FieldLabel>رقم الممارسة *</FieldLabel><input style={INP} value={form.practiceNumber ?? ""} onChange={(e) => set("practiceNumber", e.target.value)} dir="ltr" /></div>
                    <div><FieldLabel>اسم المشروع *</FieldLabel><input style={INP} value={form.projectName ?? ""} onChange={(e) => set("projectName", e.target.value)} /></div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <FieldLabel>الجهة الحكومية / الاختصاص / المسؤول</FieldLabel>
                      <EntityDirectoryPicker
                        value={{ governmentEntityId: form.governmentEntityId ?? null, departmentId: form.departmentId ?? null, contactId: form.contactId ?? null }}
                        onChange={(v) => setForm((f: any) => ({ ...f, ...v }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>الشركة المشاركة</FieldLabel>
                      <select style={{ ...INP, cursor: "pointer" }} value={form.companyId ?? ""} onChange={(e) => set("companyId", e.target.value)}>
                        <option value="">— بدون —</option>
                        {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div><FieldLabel>الموظف المسؤول</FieldLabel><input style={INP} value={form.responsibleEmployee ?? ""} onChange={(e) => set("responsibleEmployee", e.target.value)} /></div>
                    <div><FieldLabel>تاريخ الإعلان</FieldLabel><input style={INP} type="date" value={form.announcementDate ?? ""} onChange={(e) => set("announcementDate", e.target.value)} /></div>
                    <div><FieldLabel>آخر موعد للتقديم</FieldLabel><input style={INP} type="date" value={form.deadline ?? ""} onChange={(e) => set("deadline", e.target.value)} /></div>
                    <div><FieldLabel>اجتماع تمهيدي؟</FieldLabel>
                      <select style={{ ...INP, cursor: "pointer" }} value={form.preliminaryMeetingHeld ? "1" : "0"} onChange={(e) => set("preliminaryMeetingHeld", e.target.value === "1")}>
                        <option value="0">لا</option><option value="1">نعم</option>
                      </select>
                    </div>
                    <div><FieldLabel>تاريخ الاجتماع التمهيدي</FieldLabel><input style={INP} type="date" value={form.preliminaryMeetingDate ?? ""} onChange={(e) => set("preliminaryMeetingDate", e.target.value)} /></div>
                    <div style={{ gridColumn: "1 / -1" }}><FieldLabel>الوصف</FieldLabel>
                      <textarea style={{ ...INP, resize: "vertical", minHeight: 70 }} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}><FieldLabel>ملاحظات</FieldLabel>
                      <textarea style={{ ...INP, resize: "vertical", minHeight: 60 }} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
                    <InfoRow label="رقم الممارسة" value={practice.practiceNumber} mono />
                    <InfoRow label="الجهة الحكومية" value={practice.governmentEntity} />
                    <InfoRow label="الموظف المسؤول" value={practice.responsibleEmployee} />
                    <InfoRow label="تاريخ الإعلان" value={practice.announcementDate ? formatDate(practice.announcementDate) : null} />
                    <InfoRow label="آخر موعد للتقديم" value={practice.deadline ? formatDate(practice.deadline) : null} />
                    <InfoRow label="اجتماع تمهيدي" value={practice.preliminaryMeetingHeld ? `نعم${practice.preliminaryMeetingDate ? ` — ${formatDate(practice.preliminaryMeetingDate)}` : ""}` : "لا"} />
                    <div style={{ gridColumn: "1 / -1" }}><InfoRow label="الوصف" value={practice.description} /></div>
                    {practice.notes && <div style={{ gridColumn: "1 / -1" }}><InfoRow label="ملاحظات" value={practice.notes} /></div>}
                  </div>
                )}
              </div>
            </Panel>

            {/* المالية والتقديم */}
            <Panel>
              <PanelHead icon={Calculator} label="العرض والمالية" color="#10b981" />
              <div style={{ padding: 20 }}>
                {isEditing ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div><FieldLabel>قيمة العرض المقدَّم (د.ك)</FieldLabel><input style={INP} type="number" step="0.001" value={form.offerValue ?? ""} onChange={(e) => set("offerValue", e.target.value)} dir="ltr" /></div>
                    <div><FieldLabel>تم التقديم؟</FieldLabel>
                      <select style={{ ...INP, cursor: "pointer" }} value={form.isSubmitted ? "1" : "0"} onChange={(e) => set("isSubmitted", e.target.value === "1")}>
                        <option value="0">لا</option><option value="1">نعم</option>
                      </select>
                    </div>
                    <div><FieldLabel>القيمة المتوقعة (د.ك)</FieldLabel><input style={INP} type="number" step="0.001" value={form.expectedValue ?? ""} onChange={(e) => set("expectedValue", e.target.value)} dir="ltr" /></div>
                    <div><FieldLabel>قيمة العقد (د.ك)</FieldLabel><input style={INP} type="number" step="0.001" value={form.contractValue ?? ""} onChange={(e) => set("contractValue", e.target.value)} dir="ltr" /></div>
                    <div><FieldLabel>نسبة الربح %</FieldLabel><input style={INP} type="number" step="0.01" value={form.profitPercentage ?? ""} onChange={(e) => set("profitPercentage", e.target.value)} dir="ltr" /></div>
                    <div><FieldLabel>نسبة الإنجاز %</FieldLabel><input style={INP} type="number" value={form.completionPercentage ?? ""} onChange={(e) => set("completionPercentage", e.target.value)} dir="ltr" /></div>
                    <div><FieldLabel>الضمان النهائي (د.ك)</FieldLabel><input style={INP} type="number" step="0.001" value={form.finalBondValue ?? ""} onChange={(e) => set("finalBondValue", e.target.value)} dir="ltr" /></div>
                    <div><FieldLabel>الفائز (عند الحسم)</FieldLabel><input style={INP} value={form.winner ?? ""} onChange={(e) => set("winner", e.target.value)} /></div>
                    <div><FieldLabel>سنة البدء</FieldLabel><input style={INP} type="number" value={form.startYear ?? ""} onChange={(e) => set("startYear", e.target.value)} dir="ltr" /></div>
                    <div><FieldLabel>سنة الانتهاء</FieldLabel><input style={INP} type="number" value={form.endYear ?? ""} onChange={(e) => set("endYear", e.target.value)} dir="ltr" /></div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
                    <InfoRow label="قيمة العرض المقدَّم" value={practice.offerValue ? formatCurrency(practice.offerValue) : null} mono />
                    <InfoRow label="القيمة المتوقعة" value={practice.expectedValue ? formatCurrency(practice.expectedValue) : null} mono />
                    <InfoRow label="قيمة العقد" value={practice.contractValue ? formatCurrency(practice.contractValue) : null} mono />
                    <InfoRow label="نسبة الربح" value={practice.profitPercentage ? `${practice.profitPercentage}%` : null} mono />
                    <InfoRow label="نسبة الإنجاز" value={practice.completionPercentage ? `${Math.round(Number(practice.completionPercentage))}%` : null} mono />
                    <InfoRow label="الضمان النهائي" value={practice.finalBondValue ? formatCurrency(practice.finalBondValue) : null} mono />
                    <InfoRow label="الفائز" value={practice.winner} />
                    <InfoRow label="سنة البدء" value={practice.startYear} mono />
                    <InfoRow label="سنة الانتهاء" value={practice.endYear} mono />
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* SIDE COLUMN — المستندات */}
          <Panel>
            <PanelHead icon={Package} label="المستندات" color="#8b5cf6" />
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {DOC_CARDS.map((doc) => (
                <div key={doc.field} style={{ border: `1.5px solid ${practice[doc.field] ? doc.color + "44" : "#e2e8f0"}`, background: practice[doc.field] ? doc.bg : "#fafafa", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <doc.icon size={15} color={doc.color} />
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: "#1e293b" }}>{doc.label}</span>
                  </div>
                  <FileUpload objectPath={practice[doc.field]} onChange={(p) => handleFileChange(doc.field, p)} label={`رفع ${doc.label}`} disabled={!canEdit} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
