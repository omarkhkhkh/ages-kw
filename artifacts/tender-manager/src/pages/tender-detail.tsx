import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTender,
  useUpdateTender,
  useDeleteTender,
  getGetTenderQueryKey,
  getListTendersQueryKey,
  getGetTenderStatsQueryKey,
} from "@workspace/api-client-react";
import { TenderStatus } from "@workspace/api-client-react";
import { formatCurrency, formatDate, isUrgent, cn } from "@/lib/utils";
import { STATUS_ARABIC, STATUS_COLORS } from "@/lib/constants";
import {
  ArrowRight, Save, Trash2, Clock, Building, FileText,
  CheckCircle2, AlertTriangle, User, Loader2,
  BookOpen, Calculator, Users, Package, ChevronDown,
  DollarSign, TrendingUp, Trophy, Pencil, X, AlertCircle,
} from "lucide-react";
import FileUpload from "@/components/file-upload";
import BidResultPanel from "@/components/bid-result-panel";
import TenderCompetitorAnalysis from "@/components/tender-competitor-analysis";
import { useAuth } from "@/contexts/auth";

/* ── theme ── */
const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

/* ── Inline styled input helpers ── */
const INP: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box", background: "white",
  transition: "border-color 0.15s, box-shadow 0.15s", color: "#1e293b",
};
const FOCUS: React.CSSProperties = { borderColor: G, boxShadow: `0 0 0 3px ${G}18` };

function SI(props: React.InputHTMLAttributes<HTMLInputElement> & { ltr?: boolean }) {
  const { ltr, style, ...rest } = props;
  const [f, sf] = useState(false);
  return (
    <input
      style={{ ...INP, ...(f ? FOCUS : {}), ...(ltr ? { direction: "ltr", textAlign: "left", fontFamily: "monospace" } : {}), ...style }}
      onFocus={() => sf(true)} onBlur={() => sf(false)} {...rest} />
  );
}
function SS(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [f, sf] = useState(false);
  return (
    <select style={{ ...INP, ...(f ? FOCUS : {}), cursor: "pointer" }}
      onFocus={() => sf(true)} onBlur={() => sf(false)} {...props} />
  );
}
function STA(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [f, sf] = useState(false);
  return (
    <textarea style={{ ...INP, ...(f ? FOCUS : {}), resize: "vertical", minHeight: 80, lineHeight: 1.7 }}
      onFocus={() => sf(true)} onBlur={() => sf(false)} {...props} />
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5 }}>{children}</label>;
}

/* ── Info row for view mode ── */
function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", fontFamily: mono ? "monospace" : undefined }}>
        {value || <span style={{ color: "#cbd5e1" }}>—</span>}
      </span>
    </div>
  );
}

/* ── Card wrapper ── */
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
export default function TenderDetail() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: tender, isLoading } = useGetTender(id, {
    query: { enabled: !!id, queryKey: getGetTenderQueryKey(id) },
  });

  const updateTender = useUpdateTender();
  const deleteTender = useDeleteTender();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"details" | "bid" | "analysis">("details");
  const initialized = useRef(false);

  useEffect(() => {
    if (tender && !initialized.current) {
      setFormData({
        tenderNumber: tender.tenderNumber || "",
        projectName: tender.projectName || "",
        governmentEntity: tender.governmentEntity || "",
        tenderType: tender.tenderType || "",
        announcementDate: tender.announcementDate ? tender.announcementDate.split("T")[0] : "",
        deadline: tender.deadline ? tender.deadline.split("T")[0] : "",
        bondValue: tender.bondValue || "",
        docsValue: tender.docsValue || "",
        responsibleEngineer: tender.responsibleEngineer || "",
        status: tender.status,
        offerValue: tender.offerValue || "",
        profitPercentage: tender.profitPercentage || "",
        winner: tender.winner || "",
        notes: tender.notes || "",
        fileConditions: (tender as any).fileConditions ?? null,
        filePricing:    (tender as any).filePricing    ?? null,
        fileSuppliers:  (tender as any).fileSuppliers  ?? null,
        fileOpening:    (tender as any).fileOpening    ?? null,
      });
      initialized.current = true;
    }
  }, [tender]);

  if (isLoading) {
    return (
      <div style={{ padding: 60, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: G }} />
      </div>
    );
  }
  if (!tender) {
    return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>المناقصة غير موجودة</div>;
  }

  const handleStatusChange = (newStatus: TenderStatus) => {
    updateTender.mutate(
      { id, data: { status: newStatus } as any },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetTenderQueryKey(id), updated);
          queryClient.invalidateQueries({ queryKey: getListTendersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTenderStatsQueryKey() });
        },
      }
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (field: string, path: string | null) => {
    setFormData((prev: any) => ({ ...prev, [field]: path }));
    setSavingFields(prev => new Set(prev).add(field));
    updateTender.mutate(
      { id, data: { [field]: path } as any },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetTenderQueryKey(id), updated);
          queryClient.invalidateQueries({ queryKey: getListTendersQueryKey() });
        },
        onSettled: () => {
          setSavingFields(prev => { const s = new Set(prev); s.delete(field); return s; });
        },
      }
    );
  };

  const handleSave = () => {
    const payload = {
      ...formData,
      bondValue:        formData.bondValue        ? Number(formData.bondValue)        : null,
      docsValue:        formData.docsValue         ? Number(formData.docsValue)        : null,
      offerValue:       formData.offerValue        ? Number(formData.offerValue)       : null,
      profitPercentage: formData.profitPercentage  ? Number(formData.profitPercentage) : null,
    };
    updateTender.mutate(
      { id, data: payload as any },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetTenderQueryKey(id), updated);
          queryClient.invalidateQueries({ queryKey: getListTendersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTenderStatsQueryKey() });
          setIsEditing(false);
        },
      }
    );
  };

  const handleDelete = () => {
    if (confirm("هل أنت متأكد من حذف هذه المناقصة بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.")) {
      deleteTender.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListTendersQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetTenderStatsQueryKey() });
            setLocation("/tenders");
          },
        }
      );
    }
  };

  const urgent  = isUrgent(tender.deadline, tender.status);
  const canEdit = user?.role === "admin" || user?.canEdit || user?.fullName === tender.responsibleEngineer;

  /* computed financial */
  const offerNum  = Number(tender.offerValue)        || 0;
  const profitPct = Number(tender.profitPercentage)  || 0;
  const profitAmt = offerNum && profitPct ? (offerNum * profitPct / 100) : null;
  const costAmt   = profitAmt ? offerNum - profitAmt : null;

  /* deadline countdown */
  const daysLeft = tender.deadline
    ? Math.ceil((new Date(tender.deadline).getTime() - Date.now()) / 86_400_000)
    : null;

  /* ── Tabs ── */
  const TABS: [string, string, any][] = [
    ["details",  "تفاصيل المناقصة", FileText],
    ["bid",      "فض العطاء",       Trophy],
    ["analysis", "تحليل المنافسة",  TrendingUp],
  ];

  /* ── doc cards config ── */
  const DOC_CARDS = [
    { field: "fileConditions", label: "الشروط الخاصة",     icon: BookOpen,    color: "#3b82f6",  bg: "#eff6ff" },
    { field: "filePricing",    label: "جداول التسعير",      icon: Calculator,  color: "#10b981",  bg: "#ecfdf5" },
    { field: "fileSuppliers",  label: "عروض الموردين",      icon: Users,       color: "#8b5cf6",  bg: "#f5f3ff" },
    { field: "fileOpening",    label: "وثيقة فض الظروف",   icon: Package,     color: "#f59e0b",  bg: "#fffbeb" },
  ];

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", maxWidth: 1100, margin: "0 auto", paddingBottom: 40 }}>

      {/* ══ HERO HEADER ══ */}
      <div style={{
        background: `linear-gradient(135deg,${GR} 0%,#1e3a22 65%,#0f2014 100%)`,
        borderRadius: 20, padding: "24px 28px", marginBottom: 24,
        boxShadow: "0 4px 24px rgba(19,42,24,0.22)",
      }}>
        {/* top row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => window.history.back()}
              style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "7px 9px", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}>
              <ArrowRight size={17} color="white" />
            </button>

            <div>
              {/* badges row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: G, background: "rgba(212,165,52,0.15)", border: "1px solid rgba(212,165,52,0.3)", padding: "2px 10px", borderRadius: 20 }}>
                  {tender.tenderNumber}
                </span>
                {tender.tenderType && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.08)", padding: "2px 10px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.12)" }}>
                    {tender.tenderType}
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 800, background: G, color: GR, padding: "2px 10px", borderRadius: 20 }}>
                  {STATUS_ARABIC[tender.status]}
                </span>
                {urgent && (
                  <span style={{ fontSize: 11, fontWeight: 800, background: "#ef4444", color: "white", padding: "2px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4 }}>
                    <AlertTriangle size={10} /> عاجل
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "white", margin: 0, lineHeight: 1.3 }}>
                {tender.projectName}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>
                  <Building size={13} /> {tender.governmentEntity || "جهة غير محددة"}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>
                  <User size={13} /> {tender.responsibleEngineer || "مهندس غير محدد"}
                </span>
                {daysLeft !== null && (
                  <span style={{
                    display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700,
                    color: daysLeft < 0 ? "#fca5a5" : daysLeft < 7 ? "#fde68a" : "rgba(255,255,255,0.6)",
                  }}>
                    <Clock size={13} />
                    {daysLeft < 0 ? `انتهى منذ ${Math.abs(daysLeft)} يوم` : daysLeft === 0 ? "اليوم هو الموعد النهائي" : `${daysLeft} يوم متبقٍ`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* actions */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!isEditing ? (
              <>
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}>
                    <Pencil size={13} /> تعديل
                  </button>
                )}
                <div style={{ position: "relative" }}>
                  <select
                    value={tender.status}
                    onChange={e => handleStatusChange(e.target.value as TenderStatus)}
                    style={{ padding: "8px 32px 8px 14px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: GR, cursor: "pointer", fontSize: 12.5, fontWeight: 800, fontFamily: "inherit", appearance: "none" }}>
                    {Object.entries(STATUS_ARABIC).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} color={GR} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setIsEditing(false); initialized.current = false; }}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                  <X size={13} /> إلغاء
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateTender.isPending}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 20px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: GR, cursor: "pointer", fontSize: 13, fontWeight: 800, fontFamily: "inherit", boxShadow: `0 2px 10px ${G}50`, opacity: updateTender.isPending ? 0.8 : 1 }}>
                  {updateTender.isPending ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
                  حفظ التعديلات
                </button>
              </>
            )}
          </div>
        </div>

        {/* quick stats row */}
        {!isEditing && (
          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            {[
              { label: "قيمة العرض", value: tender.offerValue ? formatCurrency(tender.offerValue) : "—", mono: true, highlight: !!tender.offerValue },
              { label: "نسبة الربح", value: tender.profitPercentage ? `${tender.profitPercentage}%` : "—", mono: true, highlight: false },
              { label: "الضمان الابتدائي", value: tender.bondValue ? formatCurrency(tender.bondValue) : "—", mono: true, highlight: false },
              { label: "قيمة الكراسة", value: tender.docsValue ? formatCurrency(tender.docsValue) : "—", mono: true, highlight: false },
            ].map(stat => (
              <div key={stat.label} style={{ flex: "1 1 140px", background: stat.highlight ? "rgba(212,165,52,0.12)" : "rgba(255,255,255,0.06)", border: `1px solid ${stat.highlight ? "rgba(212,165,52,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", fontWeight: 700, marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: stat.highlight ? 16 : 14, fontWeight: 800, color: stat.highlight ? G : "rgba(255,255,255,0.85)", fontFamily: stat.mono ? "monospace" : undefined }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ TAB BAR ══ */}
      <div style={{ display: "flex", background: "white", borderRadius: 12, padding: 5, gap: 4, marginBottom: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
        {TABS.map(([t, l, Icon]) => {
          const active = activeTab === t;
          return (
            <button key={t} onClick={() => setActiveTab(t as any)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: active ? `linear-gradient(135deg,${G},${GD})` : "none",
                border: "none", borderRadius: 9, fontFamily: "inherit",
                color: active ? GR : "#64748b",
                boxShadow: active ? `0 2px 8px ${G}30` : "none",
                transition: "all 0.15s",
              }}
              onMouseEnter={ev => { if (!active) ev.currentTarget.style.background = "#f8fafc"; }}
              onMouseLeave={ev => { if (!active) ev.currentTarget.style.background = "none"; }}>
              <Icon size={14} /> {l}
            </button>
          );
        })}
      </div>

      {/* ══ BID TAB ══ */}
      {activeTab === "bid" && (
        <div>
          <BidResultPanel sourceType="tender" sourceId={id} ourPrice={(tender as any).offerValue} />
        </div>
      )}

      {/* ══ ANALYSIS TAB ══ */}
      {activeTab === "analysis" && (
        <div>
          <TenderCompetitorAnalysis tenderId={id} />
        </div>
      )}

      {/* ══ DETAILS TAB ══ */}
      {activeTab === "details" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>

          {/* ── MAIN COLUMN ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* ── Basic Info ── */}
            <Panel>
              <PanelHead icon={FileText} label="تفاصيل المناقصة" />
              <div style={{ padding: "20px 22px" }}>
                {isEditing ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div><FieldLabel>رقم المناقصة</FieldLabel><SI ltr name="tenderNumber" value={formData.tenderNumber} onChange={handleChange} /></div>
                    <div><FieldLabel>نوع المناقصة</FieldLabel><SI name="tenderType" value={formData.tenderType} onChange={handleChange} placeholder="عامة / محدودة / ..." /></div>
                    <div style={{ gridColumn: "1/-1" }}><FieldLabel>اسم المشروع</FieldLabel><SI name="projectName" value={formData.projectName} onChange={handleChange} /></div>
                    <div style={{ gridColumn: "1/-1" }}><FieldLabel>الجهة الحكومية</FieldLabel><SI name="governmentEntity" value={formData.governmentEntity} onChange={handleChange} /></div>
                    <div style={{ gridColumn: "1/-1" }}><FieldLabel>المهندس المسؤول</FieldLabel><SI name="responsibleEngineer" value={formData.responsibleEngineer} onChange={handleChange} /></div>
                    <div style={{ gridColumn: "1/-1" }}><FieldLabel>الحالة</FieldLabel>
                      <SS name="status" value={formData.status} onChange={handleChange}>
                        {Object.entries(STATUS_ARABIC).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </SS>
                    </div>
                    <div style={{ gridColumn: "1/-1" }}><FieldLabel>ملاحظات</FieldLabel><STA name="notes" value={formData.notes} onChange={handleChange} placeholder="أي ملاحظات..." rows={4} /></div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <InfoRow label="رقم المناقصة" value={tender.tenderNumber} mono />
                    <InfoRow label="نوع المناقصة" value={tender.tenderType} />
                    <div style={{ gridColumn: "1/-1" }}>
                      <InfoRow label="اسم المشروع" value={<span style={{ fontSize: 15, fontWeight: 700 }}>{tender.projectName}</span>} />
                    </div>
                    <InfoRow label="الجهة الحكومية" value={tender.governmentEntity} />
                    <InfoRow label="المهندس المسؤول" value={tender.responsibleEngineer} />
                    <div style={{ gridColumn: "1/-1" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>حالة التقديم</span>
                      <div style={{ marginTop: 5 }}>
                        {tender.isSubmitted ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#dcfce7", color: "#15803d", padding: "4px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 700 }}>
                            <CheckCircle2 size={13} /> تم التقديم في موعده
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fef9c3", color: "#92400e", padding: "4px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 700 }}>
                            <AlertTriangle size={13} /> لم يتم التقديم بعد
                          </span>
                        )}
                      </div>
                    </div>
                    {tender.notes && (
                      <div style={{ gridColumn: "1/-1" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>ملاحظات</span>
                        <div style={{ marginTop: 6, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 16px", fontSize: 13.5, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                          {tender.notes}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Panel>

            {/* ── Financials ── */}
            <Panel>
              <PanelHead icon={DollarSign} label="البيانات المالية للعرض" color="#10b981" />
              <div style={{ padding: "20px 22px" }}>
                {isEditing ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div><FieldLabel>قيمة العرض (د.ك)</FieldLabel><SI ltr type="number" name="offerValue" value={formData.offerValue} onChange={handleChange} placeholder="0.000" /></div>
                    <div><FieldLabel>نسبة الربح المستهدفة (%)</FieldLabel><SI ltr type="number" step="0.01" name="profitPercentage" value={formData.profitPercentage} onChange={handleChange} placeholder="0.0" /></div>
                    <div style={{ gridColumn: "1/-1" }}><FieldLabel>الشركة الفائزة (في حال الرسو)</FieldLabel><SI name="winner" value={formData.winner} onChange={handleChange} placeholder="اسم الشركة التي رست عليها المناقصة" /></div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* big numbers */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
                      {/* offer value */}
                      <div style={{ background: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: `2px solid ${G}30`, borderRadius: 14, padding: "18px 20px" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: GD, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                          <DollarSign size={12} /> قيمة عرضنا المالي
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", color: GR, letterSpacing: -0.5 }}>
                          {offerNum ? formatCurrency(offerNum) : <span style={{ color: "#d1d5db", fontFamily: "inherit", fontSize: 16 }}>لم تُحدَّد</span>}
                        </div>
                      </div>
                      {/* profit pct */}
                      <div style={{ background: "#f0fdf4", border: "2px solid #bbf7d0", borderRadius: 14, padding: "18px 20px" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#15803d", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                          <TrendingUp size={12} /> نسبة الربح المستهدفة
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", color: "#14532d" }}>
                          {profitPct ? `${profitPct}%` : <span style={{ color: "#d1d5db", fontFamily: "inherit", fontSize: 16 }}>—</span>}
                        </div>
                      </div>
                      {/* profit amount */}
                      {profitAmt && (
                        <div style={{ background: "#eff6ff", border: "2px solid #bfdbfe", borderRadius: 14, padding: "18px 20px" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#1d4ed8", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                            <Calculator size={12} /> مبلغ الربح المحسوب
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", color: "#1e3a8a" }}>
                            {formatCurrency(profitAmt)}
                          </div>
                        </div>
                      )}
                      {/* cost */}
                      {costAmt && (
                        <div style={{ background: "#faf5ff", border: "2px solid #e9d5ff", borderRadius: 14, padding: "18px 20px" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                            <Package size={12} /> التكلفة المقدرة
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", color: "#4c1d95" }}>
                            {formatCurrency(costAmt)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* winner */}
                    {tender.winner && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 12, padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Trophy size={16} color="#dc2626" />
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#991b1b" }}>الشركة الفائزة</span>
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 900, color: "#7f1d1d" }}>{tender.winner}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Panel>

            {/* ── Documents ── */}
            <Panel>
              <PanelHead icon={FileText} label="المستندات المرفقة" color="#6366f1" />
              <div style={{ padding: "20px 22px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {DOC_CARDS.map(({ field, label, icon: Icon, color, bg }) => {
                    const hasFile = !!formData[field];
                    const saving  = savingFields.has(field);
                    return (
                      <div key={field} style={{ background: hasFile ? bg : "#f8fafc", border: `1.5px solid ${hasFile ? color + "30" : "#e2e8f0"}`, borderRadius: 12, padding: "14px 16px", transition: "all 0.2s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: hasFile ? color + "18" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}>
                            <Icon size={14} color={hasFile ? color : "#94a3b8"} />
                          </div>
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: hasFile ? color : "#64748b" }}>{label}</span>
                          {saving && <Loader2 size={12} style={{ animation: "spin 1s linear infinite", color: "#94a3b8", marginRight: "auto" }} />}
                          {hasFile && !saving && (
                            <span style={{ marginRight: "auto", fontSize: 10.5, fontWeight: 700, background: color + "18", color, padding: "2px 8px", borderRadius: 10 }}>مرفق ✓</span>
                          )}
                        </div>
                        <FileUpload
                          objectPath={formData[field]}
                          onChange={(path) => handleFileChange(field, path)}
                          label={`رفع ${label}`}
                          disabled={!canEdit}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
          </div>

          {/* ── SIDEBAR ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Dates */}
            <Panel>
              <PanelHead icon={Clock} label="المواعيد الحرجة" color="#3b82f6" />
              <div style={{ padding: "16px 20px" }}>
                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div><FieldLabel>تاريخ الإعلان</FieldLabel><SI type="date" name="announcementDate" value={formData.announcementDate} onChange={handleChange} /></div>
                    <div><FieldLabel>آخر موعد للتقديم</FieldLabel><SI type="date" name="deadline" value={formData.deadline} onChange={handleChange} /></div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {[
                      { label: "تاريخ الإعلان",       val: tender.announcementDate, urgent: false },
                      { label: "آخر موعد للتقديم",    val: tender.deadline,         urgent },
                    ].map((d, i) => (
                      <div key={d.label} style={{ padding: "12px 0", borderBottom: i === 0 ? "1px solid #f1f5f9" : "none", display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{d.label}</span>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: d.urgent ? "#dc2626" : "#1e293b" }}>
                            {formatDate(d.val)}
                          </span>
                          {d.urgent && (
                            <span style={{ fontSize: 10.5, fontWeight: 800, background: "#fee2e2", color: "#dc2626", padding: "2px 8px", borderRadius: 10 }}>عاجل</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {/* countdown bar */}
                    {daysLeft !== null && daysLeft >= 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>الوقت المتبقي</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: daysLeft < 7 ? "#dc2626" : "#10b981" }}>{daysLeft} يوم</span>
                        </div>
                        <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{
                            height: "100%",
                            width: `${Math.max(5, Math.min(100, (daysLeft / 90) * 100))}%`,
                            background: daysLeft < 7 ? "#ef4444" : daysLeft < 14 ? G : "#10b981",
                            borderRadius: 3, transition: "width 0.4s",
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Panel>

            {/* Financial requirements */}
            <Panel>
              <PanelHead icon={FileText} label="المتطلبات المالية" color="#6b7280" />
              <div style={{ padding: "16px 20px" }}>
                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div><FieldLabel>قيمة الكراسة (د.ك)</FieldLabel><SI ltr type="number" name="docsValue" value={formData.docsValue} onChange={handleChange} placeholder="0.000" /></div>
                    <div><FieldLabel>الضمان الابتدائي (د.ك)</FieldLabel><SI ltr type="number" name="bondValue" value={formData.bondValue} onChange={handleChange} placeholder="0.000" /></div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {[
                      { label: "قيمة الكراسة",     val: tender.docsValue },
                      { label: "الضمان الابتدائي", val: tender.bondValue  },
                    ].map((r, i) => (
                      <div key={r.label} style={{ padding: "11px 0", borderBottom: i === 0 ? "1px solid #f1f5f9" : "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600 }}>{r.label}</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13.5, color: "#1e293b" }}>
                          {r.val ? formatCurrency(r.val) : <span style={{ color: "#cbd5e1", fontFamily: "inherit" }}>—</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>

            {/* Delete zone */}
            {isEditing && user?.role === "admin" && (
              <Panel style={{ border: "1.5px solid #fecaca" }}>
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                    <AlertCircle size={15} color="#dc2626" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#dc2626" }}>منطقة الخطر</span>
                  </div>
                  <button
                    onClick={handleDelete}
                    disabled={deleteTender.isPending}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", borderRadius: 10, border: "none", background: "#dc2626", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 800, fontFamily: "inherit", opacity: deleteTender.isPending ? 0.7 : 1 }}>
                    <Trash2 size={14} /> حذف المناقصة نهائياً
                  </button>
                </div>
              </Panel>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
