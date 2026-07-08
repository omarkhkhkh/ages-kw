import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateTender, getListTendersQueryKey, getGetTenderStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { TenderStatus } from "@workspace/api-client-react";
import { STATUS_ARABIC } from "@/lib/constants";
import {
  ArrowRight, FileText, Calendar, Users,
  Building2, Hash, Briefcase, AlertCircle,
  ChevronDown, Loader2, CheckCircle2,
} from "lucide-react";

/* ── theme ── */
const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

async function apiFetch(url: string) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ── Tender types ── */
const TENDER_TYPES = [
  { value: "عامة",            label: "عامة",            icon: "🏛️", desc: "مناقصة مفتوحة لجميع المتقدمين" },
  { value: "محدودة",          label: "محدودة",          icon: "🔒", desc: "مقتصرة على موردين مختارين" },
  { value: "دعوة مباشرة",     label: "دعوة مباشرة",     icon: "✉️", desc: "دعوة لشركة بعينها" },
  { value: "ممارسة سعرية",    label: "ممارسة سعرية",    icon: "💰", desc: "مقارنة أسعار محدودة" },
];

/* ── Initial statuses for a new tender ── */
const INITIAL_STATUSES = [
  TenderStatus.new,
  TenderStatus.studying,
  TenderStatus.requesting_quotes,
  TenderStatus.preparing_technical,
];

/* ── Section badge ── */
function SectionBadge({ n, label, icon: Icon }: { n: number; label: string; icon: any }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `linear-gradient(135deg,${G},${GD})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, boxShadow: `0 2px 8px ${G}40`,
      }}>
        <Icon size={16} color="white" />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: GD, letterSpacing: 0.5 }}>القسم {n}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: GR, marginTop: 1 }}>{label}</div>
      </div>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(to left,transparent,#e2e8f0)", marginRight: 8 }} />
    </div>
  );
}

/* ── Styled Input ── */
function Field({
  label, required, error, children, hint, col,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode; hint?: string; col?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: col ? "1/-1" : undefined }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
        {label}
        {required && <span style={{ color: "#ef4444", fontSize: 13, lineHeight: 1 }}>*</span>}
      </label>
      {children}
      {hint && !error && <span style={{ fontSize: 11, color: "#94a3b8" }}>{hint}</span>}
      {error && (
        <span style={{ fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={11} /> {error}
        </span>
      )}
    </div>
  );
}

const INP: React.CSSProperties = {
  width: "100%", padding: "10px 13px", borderRadius: 9,
  border: "1.5px solid #e2e8f0", fontSize: 13.5, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box", background: "white",
  transition: "border-color 0.15s, box-shadow 0.15s", color: "#1e293b",
};
const INP_FOCUS: React.CSSProperties = { borderColor: G, boxShadow: `0 0 0 3px ${G}18` };

function StyledInput({ type = "text", dir: d, style, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      dir={d}
      style={{ ...INP, ...(focused ? INP_FOCUS : {}), ...(d === "ltr" ? { textAlign: "left" } : {}), ...style }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...rest}
    />
  );
}

function StyledSelect({ children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      style={{ ...INP, ...(focused ? INP_FOCUS : {}), cursor: "pointer", appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat", backgroundPosition: "left 12px center" }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...rest}
    >
      {children}
    </select>
  );
}

function StyledTextarea({ ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      style={{ ...INP, ...(focused ? INP_FOCUS : {}), resize: "vertical", minHeight: 90, lineHeight: 1.7 }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...rest}
    />
  );
}

/* ── Government entity autocomplete ── */
function EntityInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: entities = [] } = useQuery<any[]>({
    queryKey: ["government-entities"],
    queryFn: () => apiFetch("/api/government-entities"),
    staleTime: 5 * 60_000,
  });

  const filtered = q.trim().length >= 1
    ? entities.filter((e: any) => e.name?.includes(q) || e.shortName?.includes(q))
    : entities.slice(0, 8);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Building2 size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
        <input
          style={{ ...INP, ...(focused ? INP_FOCUS : {}), paddingRight: 34 }}
          value={q}
          onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onBlur={() => setFocused(false)}
          placeholder="ابحث عن الجهة الحكومية..."
          dir="rtl"
        />
      </div>
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0, left: 0,
          background: "white", border: "1.5px solid #e2e8f0", borderRadius: 10,
          zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: 220, overflowY: "auto",
        }}>
          {filtered.map((e: any) => (
            <div key={e.id}
              style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}
              onMouseDown={() => { setQ(e.name); onChange(e.name); setOpen(false); }}
              onMouseEnter={ev => (ev.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}>
              <Building2 size={13} color={G} />
              <span style={{ fontWeight: 600, color: GR }}>{e.name}</span>
              {e.shortName && <span style={{ fontSize: 11, color: "#94a3b8" }}>({e.shortName})</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
export default function TenderNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createTender = useCreateTender();

  const [form, setForm] = useState({
    tenderNumber: "",
    projectName: "",
    governmentEntity: "",
    tenderType: "",
    announcementDate: "",
    deadline: "",
    bondValue: "",
    docsValue: "",
    responsibleEngineer: "",
    status: TenderStatus.new as string,
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const set = (field: string, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.tenderNumber.trim()) e.tenderNumber = "رقم المناقصة مطلوب";
    if (!form.projectName.trim())  e.projectName  = "اسم المشروع مطلوب";
    if (form.deadline && form.announcementDate && form.deadline < form.announcementDate)
      e.deadline = "آخر موعد للتقديم لا يمكن أن يكون قبل تاريخ الإعلان";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    createTender.mutate(
      {
        data: {
          ...form,
          bondValue: form.bondValue ? Number(form.bondValue) : undefined,
          docsValue: form.docsValue ? Number(form.docsValue) : undefined,
        } as any,
      },
      {
        onSuccess: (data) => {
          setSuccess(true);
          queryClient.invalidateQueries({ queryKey: getListTendersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTenderStatsQueryKey() });
          setTimeout(() => setLocation(`/tenders/${data.id}`), 400);
        },
        onError: () => {
          setErrors({ _global: "حدث خطأ أثناء الحفظ، حاول مجدداً" });
        },
      }
    );
  };

  /* ── card style ── */
  const card: React.CSSProperties = {
    background: "white", borderRadius: 16, padding: "28px 30px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0",
    marginBottom: 20,
  };
  const grid2: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 20,
  };

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", maxWidth: 860, margin: "0 auto", paddingBottom: 100 }}>

      {/* ── Hero Header ── */}
      <div style={{
        background: `linear-gradient(135deg,${GR} 0%,#1e3a22 60%,#0f2014 100%)`,
        borderRadius: 20, padding: "28px 32px", marginBottom: 28,
        display: "flex", alignItems: "center", gap: 20,
        boxShadow: "0 4px 24px rgba(19,42,24,0.25)",
      }}>
        <button
          type="button"
          onClick={() => window.history.back()}
          style={{
            background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)",
            borderRadius: 12, padding: "8px 10px", cursor: "pointer",
            display: "flex", alignItems: "center", flexShrink: 0,
            transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}>
          <ArrowRight size={18} color="white" />
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `linear-gradient(135deg,${G},${GD})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 3px 12px ${G}50`,
            }}>
              <FileText size={22} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "white", margin: 0, letterSpacing: -0.3 }}>
                مناقصة جديدة
              </h1>
              <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", margin: "2px 0 0" }}>
                أدخل تفاصيل المناقصة لإضافتها إلى السجل
              </p>
            </div>
          </div>
        </div>

        {/* step indicators */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {["المعلومات", "التواريخ", "المتابعة"].map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: `linear-gradient(135deg,${G},${GD})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 900, color: "white",
              }}>{i + 1}</div>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{s}</span>
              {i < 2 && <div style={{ width: 16, height: 1, background: "rgba(255,255,255,0.2)" }} />}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ══ Section 1: Basic Info ══ */}
        <div style={card}>
          <SectionBadge n={1} label="المعلومات الأساسية" icon={Hash} />
          <div style={grid2}>

            <Field label="رقم المناقصة" required error={errors.tenderNumber}>
              <StyledInput
                dir="ltr"
                value={form.tenderNumber}
                onChange={e => set("tenderNumber", e.target.value)}
                placeholder="مثال: 1446/05/20"
              />
            </Field>

            <Field label="اسم المشروع" required error={errors.projectName} col>
              <StyledInput
                value={form.projectName}
                onChange={e => set("projectName", e.target.value)}
                placeholder="اسم المشروع كما ورد في كراسة الشروط"
              />
            </Field>

            <Field label="الجهة الحكومية">
              <EntityInput value={form.governmentEntity} onChange={v => set("governmentEntity", v)} />
            </Field>

          </div>

          {/* Tender type cards */}
          <div style={{ marginTop: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 10 }}>
              نوع المناقصة
            </label>
            {/* whether the current value matches a preset card */}
          {(() => {
            const isPreset = TENDER_TYPES.some(t => t.value === form.tenderType);
            return (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
                  {TENDER_TYPES.map(t => {
                    const active = form.tenderType === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => set("tenderType", active ? "" : t.value)}
                        style={{
                          position: "relative",
                          padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                          border: active ? `2px solid ${G}` : "2px solid #e2e8f0",
                          background: active ? "#fffbeb" : "white",
                          textAlign: "right", fontFamily: "inherit",
                          transition: "all 0.15s", boxShadow: active ? `0 0 0 3px ${G}18` : "none",
                        }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = "#d4a53460"; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = active ? G : "#e2e8f0"; }}>
                        <div style={{ fontSize: 20, marginBottom: 5 }}>{t.icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: active ? GD : GR }}>{t.label}</div>
                        <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 2, lineHeight: 1.4 }}>{t.desc}</div>
                        {active && (
                          <CheckCircle2 size={14} color={G} style={{ position: "absolute", top: 8, left: 8 }} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* custom type input — always visible when no preset is selected */}
                {!isPreset && (
                  <div style={{ marginTop: 10 }}>
                    <StyledInput
                      value={form.tenderType}
                      onChange={e => set("tenderType", e.target.value)}
                      placeholder="أو اكتب نوعاً مخصصاً..."
                      style={{ fontSize: 13 }}
                    />
                  </div>
                )}
              </>
            );
          })()}
          </div>
        </div>

        {/* ══ Section 2: Dates & Amounts ══ */}
        <div style={card}>
          <SectionBadge n={2} label="التواريخ والمبالغ" icon={Calendar} />
          <div style={grid2}>

            <Field label="تاريخ الإعلان">
              <StyledInput
                type="date"
                value={form.announcementDate}
                onChange={e => set("announcementDate", e.target.value)}
              />
            </Field>

            <Field label="آخر موعد للتقديم" error={errors.deadline}>
              <StyledInput
                type="date"
                value={form.deadline}
                onChange={e => { set("deadline", e.target.value); setErrors(er => { const n = {...er}; delete n.deadline; return n; }); }}
                style={errors.deadline ? { borderColor: "#ef4444" } : {}}
              />
            </Field>

            <Field label="قيمة الكراسة (د.ك)" hint="اتركه فارغاً إن لم تُحدَّد">
              <div style={{ position: "relative" }}>
                <StyledInput
                  type="number" dir="ltr" min="0" step="0.001"
                  value={form.docsValue}
                  onChange={e => set("docsValue", e.target.value)}
                  placeholder="0.000"
                />
              </div>
            </Field>

            <Field label="الضمان الابتدائي (د.ك)" hint="اتركه فارغاً إن لم يُطلَب">
              <StyledInput
                type="number" dir="ltr" min="0" step="0.001"
                value={form.bondValue}
                onChange={e => set("bondValue", e.target.value)}
                placeholder="0.000"
              />
            </Field>

          </div>
        </div>

        {/* ══ Section 3: Follow-up & Status ══ */}
        <div style={card}>
          <SectionBadge n={3} label="المتابعة والحالة" icon={Users} />
          <div style={grid2}>

            <Field label="المهندس المسؤول">
              <div style={{ position: "relative" }}>
                <Users size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                <StyledInput
                  value={form.responsibleEngineer}
                  onChange={e => set("responsibleEngineer", e.target.value)}
                  placeholder="اسم المهندس المكلف بالمناقصة"
                  style={{ paddingRight: 34 }}
                />
              </div>
            </Field>

            <Field label="الحالة المبدئية">
              <StyledSelect value={form.status} onChange={e => set("status", e.target.value)}>
                {INITIAL_STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_ARABIC[s]}</option>
                ))}
              </StyledSelect>
            </Field>

            <Field label="ملاحظات إضافية" col>
              <StyledTextarea
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
                placeholder="أي ملاحظات أو متطلبات خاصة بالمناقصة..."
                rows={4}
              />
            </Field>

          </div>
        </div>

        {/* global error */}
        {errors._global && (
          <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
            <AlertCircle size={16} /> {errors._global}
          </div>
        )}

        {/* ── Sticky Action Bar ── */}
        <div style={{
          position: "sticky", bottom: 16, zIndex: 50,
          background: "white", borderRadius: 16,
          boxShadow: "0 -2px 20px rgba(0,0,0,0.1), 0 4px 20px rgba(0,0,0,0.08)",
          border: "1px solid #e2e8f0",
          padding: "16px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
        }}>
          <div style={{ fontSize: 12.5, color: "#64748b" }}>
            <span style={{ fontWeight: 700, color: GR }}>
              {[form.tenderNumber, form.projectName].filter(Boolean).join(" — ") || "مناقصة جديدة"}
            </span>
            {form.tenderType && (
              <span style={{ marginRight: 8, background: "#fffbeb", color: GD, border: `1.5px solid ${G}40`, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                {form.tenderType}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => window.history.back()}
              style={{
                padding: "10px 22px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                background: "white", cursor: "pointer", fontSize: 13.5, fontWeight: 700,
                color: "#475569", fontFamily: "inherit", transition: "all 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={e => (e.currentTarget.style.background = "white")}>
              إلغاء
            </button>

            <button
              type="submit"
              disabled={createTender.isPending || success}
              style={{
                padding: "10px 28px", borderRadius: 10, border: "none",
                background: success
                  ? "linear-gradient(135deg,#16a34a,#15803d)"
                  : `linear-gradient(135deg,${G},${GD})`,
                cursor: createTender.isPending ? "default" : "pointer",
                fontSize: 13.5, fontWeight: 800, color: "white", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 8,
                boxShadow: `0 3px 12px ${success ? "#16a34a" : G}40`,
                opacity: createTender.isPending ? 0.85 : 1,
                transition: "all 0.2s",
                minWidth: 140,
              }}>
              {createTender.isPending
                ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> جاري الحفظ...</>
                : success
                ? <><CheckCircle2 size={15} /> تم الحفظ!</>
                : <><Briefcase size={15} /> حفظ المناقصة</>
              }
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
