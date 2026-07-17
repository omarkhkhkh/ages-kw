import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch, researchApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import FileUpload from "@/components/file-upload";
import {
  Search, Plus, X, Save, Trash2, Send,
  LayoutDashboard, BookOpen, KanbanSquare, MessageSquare, TrendingUp,
  Building2, Trophy, FileText, ClipboardList, Paperclip, Play, CheckCircle2,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

const G = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: GR, marginBottom: 5 };
const cardStyle: React.CSSProperties = { background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "16px 18px" };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 };

const OUTCOME_MAP: Record<string, { label: string; color: string; bg: string }> = {
  won: { label: "فوز", color: "#16a34a", bg: "#f0fdf4" },
  lost: { label: "خسارة", color: "#dc2626", bg: "#fff1f2" },
  ongoing: { label: "جاري", color: "#2563eb", bg: "#eff6ff" },
  other: { label: "أخرى", color: "#6b7280", bg: "#f3f4f6" },
};
const SEARCH_TYPE_MAP: Record<string, { label: string; icon: any; color: string }> = {
  supplier: { label: "مورد", icon: Building2, color: "#d97706" },
  competitor: { label: "منافس", icon: Trophy, color: "#dc2626" },
  tender: { label: "مناقصة", icon: FileText, color: "#2563eb" },
  knowledge: { label: "درس مستفاد", icon: BookOpen, color: "#16a34a" },
  spec: { label: "مواصفة", icon: Paperclip, color: "#7c3aed" },
};
const LINKED_ENTITY_LABELS: Record<string, string> = { tender: "مناقصة", practice: "ممارسة", rfq: "طلب عرض سعر" };
const ASSIGNMENT_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "بانتظار البدء", color: "#d97706", bg: "#fffbeb" },
  in_progress: { label: "قيد العمل", color: "#2563eb", bg: "#eff6ff" },
  completed: { label: "مكتملة", color: "#16a34a", bg: "#f0fdf4" },
};
function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ background: "white", borderRadius: 14, border: "1.5px solid #f0ead8", padding: "12px 14px" }}>
      <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
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
   HOME TAB
═══════════════════════════════════════════════════════ */
const emptyAssignmentForm = { title: "", description: "", assignedToUserId: "", linkedEntityType: "", linkedEntityId: "" };

function ManagerAssignmentBox() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...emptyAssignmentForm });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["users-directory"], queryFn: () => apiFetch("/api/users/directory") });
  const { data: tenders = [] } = useQuery<any[]>({ queryKey: ["tenders"], queryFn: () => apiFetch("/api/tenders") });
  const { data: practices = [] } = useQuery<any[]>({ queryKey: ["practices"], queryFn: () => apiFetch("/api/practices") });
  const { data: allAssignments = [] } = useQuery<any[]>({ queryKey: ["research-assignments", "all"], queryFn: () => researchApi.assignments.list() });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v, ...(k === "linkedEntityType" ? { linkedEntityId: "" } : {}) }));

  const createMut = useMutation({
    mutationFn: (d: any) => researchApi.assignments.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["research-assignments"] }); setForm({ ...emptyAssignmentForm }); },
  });

  const handleSend = () => {
    if (!form.title.trim() || !form.assignedToUserId) return;
    createMut.mutate({
      title: form.title, description: form.description || null,
      assignedToUserId: Number(form.assignedToUserId),
      linkedEntityType: form.linkedEntityType || null,
      linkedEntityId: form.linkedEntityId ? Number(form.linkedEntityId) : null,
    });
  };

  const linkOptions = form.linkedEntityType === "tender" ? tenders.map((t: any) => ({ id: t.id, label: `${t.tenderNumber} — ${t.projectName}` }))
    : form.linkedEntityType === "practice" ? practices.map((p: any) => ({ id: p.id, label: p.practiceNumber ?? p.title }))
    : [];

  return (
    <div style={cardStyle}>
      <div style={sectionTitle}>إرسال مهمة وتوجيه مواصفة لموظف</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div><label style={lbl}>العنوان *</label><input value={form.title} onChange={(e) => set("title", e.target.value)} style={inp} /></div>
        <div><label style={lbl}>الموظف المكلَّف *</label><select value={form.assignedToUserId} onChange={(e) => set("assignedToUserId", e.target.value)} style={inp}><option value="">— اختر —</option>{employees.map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></div>
      </div>
      <div style={{ marginBottom: 10 }}><label style={lbl}>التفاصيل</label><textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" } as any} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div><label style={lbl}>مرتبط بـ</label><select value={form.linkedEntityType} onChange={(e) => set("linkedEntityType", e.target.value)} style={inp}><option value="">— بدون —</option><option value="tender">مناقصة</option><option value="practice">ممارسة</option></select></div>
        {form.linkedEntityType && (
          <div><label style={lbl}>{LINKED_ENTITY_LABELS[form.linkedEntityType]}</label><select value={form.linkedEntityId} onChange={(e) => set("linkedEntityId", e.target.value)} style={inp}><option value="">— اختر —</option>{linkOptions.map((o: any) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
        )}
      </div>
      <button onClick={handleSend} disabled={createMut.isPending || !form.title.trim() || !form.assignedToUserId} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit" }}>
        <Send size={14} /> إرسال التكليف
      </button>

      {allAssignments.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #f0ead8", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ ...sectionTitle, marginBottom: 4 }}>آخر التكليفات المرسلة ({allAssignments.length})</div>
          {allAssignments.slice(0, 6).map((a: any) => {
            const st = ASSIGNMENT_STATUS_MAP[a.status] ?? ASSIGNMENT_STATUS_MAP.pending;
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 8, background: "#fafaf8", border: "1px solid #f0ead8" }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: GR }}>{a.title}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}> — {a.assignedToName}</span>
                </div>
                <span style={{ padding: "2px 9px", borderRadius: 20, background: st.bg, color: st.color, fontSize: 10.5, fontWeight: 700 }}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmployeeAssignmentsBox() {
  const qc = useQueryClient();
  const { data: myAssignments = [] } = useQuery<any[]>({ queryKey: ["research-assignments", "mine"], queryFn: () => researchApi.assignments.list() });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => researchApi.assignments.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["research-assignments"] }),
  });

  return (
    <div style={cardStyle}>
      <div style={sectionTitle}>المهام الواردة من الإدارة ({myAssignments.length})</div>
      {myAssignments.length === 0 ? (
        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 12.5, margin: "16px 0" }}>لا توجد تكليفات موجّهة إليك حاليًا</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {myAssignments.map((a: any) => {
            const st = ASSIGNMENT_STATUS_MAP[a.status] ?? ASSIGNMENT_STATUS_MAP.pending;
            return (
              <div key={a.id} style={{ padding: "10px 12px", borderRadius: 10, background: "#fafaf8", border: "1px solid #f0ead8" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: GR }}>{a.title}</div>
                    {a.description && <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 3 }}>{a.description}</div>}
                    {a.assignedByName && <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 3 }}>من: {a.assignedByName}</div>}
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 20, background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{st.label}</span>
                </div>
                {a.status !== "completed" && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    {a.status === "pending" && (
                      <button onClick={() => updateMut.mutate({ id: a.id, status: "in_progress" })} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", cursor: "pointer", fontFamily: "inherit" }}>
                        <Play size={11} /> بدء العمل
                      </button>
                    )}
                    <button onClick={() => updateMut.mutate({ id: a.id, status: "completed" })} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", cursor: "pointer", fontFamily: "inherit" }}>
                      <CheckCircle2 size={11} /> إنهاء
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HomeTab({ isAdmin }: { isAdmin: boolean }) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const { data: stats } = useQuery<any>({ queryKey: ["research-stats"], queryFn: () => researchApi.stats() });
  const { data: results = [] } = useQuery<any[]>({
    queryKey: ["research-search", submittedQuery],
    queryFn: () => researchApi.search(submittedQuery),
    enabled: !!submittedQuery,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          {isAdmin ? (
            <>
              <StatCard label="الموردون/المصانع" value={stats.totalSuppliers} color={GD} />
              <StatCard label="موردون بانتظار الاعتماد" value={stats.pendingSuppliers} color="#d97706" />
              <StatCard label="المنافسون" value={stats.totalCompetitors} color="#dc2626" />
              <StatCard label="دروس المعرفة المسجّلة" value={stats.totalKnowledgeEntries} color="#16a34a" />
              <StatCard label="المواصفات المرفوعة" value={stats.totalSpecs} color="#7c3aed" />
              <StatCard label="تكليفات مفتوحة" value={stats.openAssignments} color="#2563eb" />
            </>
          ) : (
            <>
              <StatCard label="الموردون الذين سجّلتهم" value={stats.mySuppliers} color={GD} />
              <StatCard label="دروس المعرفة الخاصة بي" value={stats.myKnowledgeEntries} color="#16a34a" />
              <StatCard label="مواصفاتي المرفوعة" value={stats.mySpecs} color="#7c3aed" />
              <StatCard label="تكليفاتي المفتوحة" value={stats.myOpenAssignments} color="#2563eb" />
            </>
          )}
        </div>
      )}

      {isAdmin ? <ManagerAssignmentBox /> : <EmployeeAssignmentsBox />}

      <div style={cardStyle}>
        <div style={sectionTitle}>بحث موحّد عبر كل البيانات</div>
        <form onSubmit={(e) => { e.preventDefault(); setSubmittedQuery(query.trim()); }} style={{ position: "relative" }}>
          <Search size={15} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث في الموردين، المنافسين، المناقصات، ودروس المعرفة والمواصفات..." style={{ ...inp, paddingRight: 36 }} />
        </form>
        {!isAdmin && submittedQuery && (
          <p style={{ fontSize: 10.5, color: "#9ca3af", margin: "8px 0 0" }}>* نتائج المواصفات ودروس المعرفة تقتصر على ما رفعته أنت فقط</p>
        )}
        {submittedQuery && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            {results.length === 0 ? (
              <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 12.5, margin: "10px 0" }}>لا توجد نتائج لـ "{submittedQuery}"</p>
            ) : results.map((r: any, i: number) => {
              const t = SEARCH_TYPE_MAP[r.type] ?? SEARCH_TYPE_MAP.knowledge;
              const Icon = t.icon;
              return (
                <div key={`${r.type}-${r.id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "#fafaf8", border: "1px solid #f0ead8" }}>
                  <Icon size={14} color={t.color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: GR }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{t.label} {r.subtitle ? `· ${r.type === "knowledge" ? (OUTCOME_MAP[r.subtitle]?.label ?? r.subtitle) : r.subtitle}` : ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SPECS SECTION (مركز المواصفات — ملفات مرتبطة بصنف/مناقصة/ممارسة/طلب عرض سعر)
═══════════════════════════════════════════════════════ */
const emptySpecForm = { itemName: "", fileUrl: null as string | null, linkedEntityType: "", linkedEntityId: "", notes: "" };

function SpecsSection({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({ ...emptySpecForm });

  const { data: specs = [], isLoading } = useQuery<any[]>({ queryKey: ["research-specs"], queryFn: () => researchApi.specs.list() });
  const { data: tenders = [] } = useQuery<any[]>({ queryKey: ["tenders"], queryFn: () => apiFetch("/api/tenders") });
  const { data: practices = [] } = useQuery<any[]>({ queryKey: ["practices"], queryFn: () => apiFetch("/api/practices") });
  const { data: rfqs = [] } = useQuery<any[]>({ queryKey: ["rfq-requests"], queryFn: () => apiFetch("/api/rfq-requests") });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v, ...(k === "linkedEntityType" ? { linkedEntityId: "" } : {}) }));

  const createMut = useMutation({
    mutationFn: (d: any) => researchApi.specs.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["research-specs"] }); qc.invalidateQueries({ queryKey: ["research-stats"] }); setDrawerOpen(false); setForm({ ...emptySpecForm }); },
  });
  const deleteMut = useMutation({ mutationFn: (id: number) => researchApi.specs.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["research-specs"] }); qc.invalidateQueries({ queryKey: ["research-stats"] }); } });

  const handleSave = () => {
    if (!form.itemName.trim()) return;
    createMut.mutate({
      itemName: form.itemName, fileUrl: form.fileUrl,
      linkedEntityType: form.linkedEntityType || null,
      linkedEntityId: form.linkedEntityId ? Number(form.linkedEntityId) : null,
      notes: form.notes || null,
    });
  };

  const linkOptions = form.linkedEntityType === "tender" ? tenders.map((t: any) => ({ id: t.id, label: `${t.tenderNumber} — ${t.projectName}` }))
    : form.linkedEntityType === "practice" ? practices.map((p: any) => ({ id: p.id, label: p.practiceNumber ?? p.title }))
    : form.linkedEntityType === "rfq" ? rfqs.map((r: any) => ({ id: r.id, label: r.rfqNumber ?? `#${r.id}` }))
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={sectionTitle}>المواصفات {isAdmin ? "(كل الموظفين)" : "(الخاصة بي فقط)"}</div>
        {canEdit && (
          <button onClick={() => { setForm({ ...emptySpecForm }); setDrawerOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,#7c3aed,#5b21b6)`, border: "none", color: "white", fontFamily: "inherit" }}>
            <Plus size={13} /> رفع مواصفة جديدة
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>جارِ التحميل...</div>
      ) : specs.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 24 }}>
          <Paperclip size={28} color="#e2d5b0" style={{ margin: "0 auto 8px", display: "block" }} />
          <p style={{ color: "#94a3b8", fontSize: 12.5, margin: 0 }}>لا توجد مواصفات مرفوعة بعد</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {specs.map((s: any) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "#faf9ff", border: "1px solid #ede9fe" }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: GR }}>{s.itemName}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                  {isAdmin && s.createdByName ? `${s.createdByName} · ` : ""}
                  {s.linkedEntityType ? `${LINKED_ENTITY_LABELS[s.linkedEntityType] ?? s.linkedEntityType} #${s.linkedEntityId}` : "بدون ربط"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {s.fileUrl && <a href={s.fileUrl} target="_blank" rel="noreferrer" style={{ color: "#7c3aed" }}><Paperclip size={13} /></a>}
                {canEdit && <button onClick={() => { if (confirm(`حذف مواصفة "${s.itemName}"؟`)) deleteMut.mutate(s.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}><Trash2 size={13} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={drawerOpen} onClose={() => setDrawerOpen(false)} title="رفع مواصفة جديدة" icon={Paperclip}
        footer={<>
          <button onClick={() => setDrawerOpen(false)} style={{ padding: "10px 20px", borderRadius: 10, background: "white", color: "#6b7280", border: "1.5px solid #e5e7eb", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
          <button onClick={handleSave} disabled={createMut.isPending} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 10, background: `linear-gradient(135deg,#7c3aed,#5b21b6)`, color: "white", fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            <Save size={14} /> حفظ
          </button>
        </>}>
        <div><label style={lbl}>اسم الصنف *</label><input value={form.itemName} onChange={(e) => set("itemName", e.target.value)} style={inp} /></div>
        <div><label style={lbl}>ملف المواصفة</label><FileUpload objectPath={form.fileUrl} onChange={(p) => set("fileUrl", p)} accept=".pdf,.doc,.docx" label="رفع ملف" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={lbl}>مرتبط بـ</label><select value={form.linkedEntityType} onChange={(e) => set("linkedEntityType", e.target.value)} style={inp}><option value="">— بدون —</option><option value="tender">مناقصة</option><option value="practice">ممارسة</option><option value="rfq">طلب عرض سعر</option></select></div>
          {form.linkedEntityType && (
            <div><label style={lbl}>{LINKED_ENTITY_LABELS[form.linkedEntityType]}</label><select value={form.linkedEntityId} onChange={(e) => set("linkedEntityId", e.target.value)} style={inp}><option value="">— اختر —</option>{linkOptions.map((o: any) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
          )}
        </div>
        <div><label style={lbl}>ملاحظات</label><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" } as any} /></div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   KNOWLEDGE CENTER TAB
═══════════════════════════════════════════════════════ */
const emptyKnowledgeForm = { tenderId: "", title: "", outcome: "other", reasons: "", lessonsLearned: "", competitorNames: "", tags: "" };

function KnowledgeTab({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyKnowledgeForm });

  const { data: entries = [], isLoading } = useQuery<any[]>({
    queryKey: ["research-knowledge", outcomeFilter],
    queryFn: () => researchApi.knowledge.list({ outcome: outcomeFilter || undefined }),
  });
  const { data: tenders = [] } = useQuery<any[]>({ queryKey: ["tenders"], queryFn: () => apiFetch("/api/tenders") });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const createMut = useMutation({
    mutationFn: (d: any) => researchApi.knowledge.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["research-knowledge"] }); qc.invalidateQueries({ queryKey: ["research-stats"] }); setDrawerOpen(false); setForm({ ...emptyKnowledgeForm }); },
  });
  const deleteMut = useMutation({ mutationFn: (id: number) => researchApi.knowledge.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["research-knowledge"] }); qc.invalidateQueries({ queryKey: ["research-stats"] }); } });

  const handleSave = () => {
    if (!form.title.trim()) return;
    createMut.mutate({
      ...form,
      tenderId: form.tenderId || null,
      reasons: form.reasons || null,
      lessonsLearned: form.lessonsLearned || null,
      competitorNames: form.competitorNames || null,
      tags: form.tags || null,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SpecsSection canEdit={canEdit} isAdmin={isAdmin} />

      <div style={{ borderTop: "1px solid #f0ead8", paddingTop: 16 }}>
        <div style={{ ...sectionTitle, marginBottom: 10 }}>الدروس المستفادة {isAdmin ? "(كل الموظفين)" : "(الخاصة بي فقط)"}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <select value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)} style={{ ...inp, width: "auto" }}>
            <option value="">كل النتائج</option>
            {Object.entries(OUTCOME_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {canEdit && (
            <button onClick={() => { setForm({ ...emptyKnowledgeForm }); setDrawerOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit" }}>
              <Plus size={14} /> درس مستفاد جديد
            </button>
          )}
        </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>جارِ التحميل...</div>
        ) : entries.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
            <BookOpen size={36} color="#e2d5b0" style={{ margin: "0 auto 10px", display: "block" }} />
            <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>لا توجد دروس مستفادة مسجّلة بعد</p>
          </div>
        ) : entries.map((e: any) => {
          const o = OUTCOME_MAP[e.outcome] ?? OUTCOME_MAP.other;
          return (
            <div key={e.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: GR }}>{e.title}</div>
                  {e.tenderNumber && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>مناقصة: {e.tenderNumber}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ padding: "3px 10px", borderRadius: 20, background: o.bg, color: o.color, fontSize: 11, fontWeight: 700 }}>{o.label}</span>
                  {canEdit && <button onClick={() => { if (confirm(`حذف "${e.title}"؟`)) deleteMut.mutate(e.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}><Trash2 size={13} /></button>}
                </div>
              </div>
              {e.reasons && <div style={{ fontSize: 12, color: "#4b5563", marginTop: 6 }}><b style={{ color: GR }}>الأسباب:</b> {e.reasons}</div>}
              {e.lessonsLearned && <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}><b style={{ color: GR }}>الدروس المستفادة:</b> {e.lessonsLearned}</div>}
              {e.competitorNames && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>المنافسون: {e.competitorNames}</div>}
            </div>
          );
        })}
        </div>
      </div>

      <Modal open={drawerOpen} onClose={() => setDrawerOpen(false)} title="درس مستفاد جديد" icon={BookOpen}
        footer={<>
          <button onClick={() => setDrawerOpen(false)} style={{ padding: "10px 20px", borderRadius: 10, background: "white", color: "#6b7280", border: "1.5px solid #e5e7eb", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
          <button onClick={handleSave} disabled={createMut.isPending} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 10, background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            <Save size={14} /> حفظ
          </button>
        </>}>
        <div><label style={lbl}>العنوان *</label><input value={form.title} onChange={(e) => set("title", e.target.value)} style={inp} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={lbl}>المناقصة المرتبطة</label><select value={form.tenderId} onChange={(e) => set("tenderId", e.target.value)} style={inp}><option value="">— بدون —</option>{tenders.map((t: any) => <option key={t.id} value={t.id}>{t.tenderNumber} — {t.projectName}</option>)}</select></div>
          <div><label style={lbl}>النتيجة</label><select value={form.outcome} onChange={(e) => set("outcome", e.target.value)} style={inp}>{Object.entries(OUTCOME_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        </div>
        <div><label style={lbl}>الأسباب</label><textarea value={form.reasons} onChange={(e) => set("reasons", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" } as any} /></div>
        <div><label style={lbl}>الدروس المستفادة</label><textarea value={form.lessonsLearned} onChange={(e) => set("lessonsLearned", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" } as any} /></div>
        <div><label style={lbl}>المنافسون المتضمَّنون</label><input value={form.competitorNames} onChange={(e) => set("competitorNames", e.target.value)} placeholder="أسماء مفصولة بفاصلة" style={inp} /></div>
        <div><label style={lbl}>وسوم</label><input value={form.tags} onChange={(e) => set("tags", e.target.value)} style={inp} /></div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TEAM CHAT TAB
═══════════════════════════════════════════════════════ */
function ChatTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState("");

  const { data: messages = [] } = useQuery<any[]>({
    queryKey: ["research-messages"],
    queryFn: () => researchApi.messages.list(),
    refetchInterval: 5000,
  });

  const sendMut = useMutation({
    mutationFn: (content: string) => researchApi.messages.send(content),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["research-messages"] }); },
  });

  return (
    <div style={{ ...cardStyle, display: "flex", flexDirection: "column", height: 480 }}>
      <div style={sectionTitle}>قناة الفريق</div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {messages.length === 0 ? (
          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 12.5, margin: "auto" }}>لا توجد رسائل بعد — ابدأ المحادثة</p>
        ) : messages.map((m: any) => {
          const mine = m.userId === user?.id;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-start" : "flex-end", maxWidth: "70%" }}>
              <div style={{ background: mine ? `${G}20` : "#f3f4f6", borderRadius: 12, padding: "8px 12px", fontSize: 12.5, color: GR }}>{m.content}</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, textAlign: mine ? "left" as const : "right" as const }}>{m.userName ?? ""} · {new Date(m.createdAt).toLocaleTimeString("ar-KW", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          );
        })}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) sendMut.mutate(text.trim()); }} style={{ display: "flex", gap: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب رسالة..." style={inp} />
        <button type="submit" disabled={!text.trim() || sendMut.isPending} style={{ padding: "0 16px", borderRadius: 9, background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center" }}><Send size={14} /></button>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PERFORMANCE ANALYTICS TAB
═══════════════════════════════════════════════════════ */
function PerformanceTab() {
  const { data } = useQuery<any>({ queryKey: ["research-performance"], queryFn: () => researchApi.performance() });
  const byType = (data?.byType ?? []).map((r: any) => ({ name: r.taskType, overdue: r.overdueCount }));
  const admin = data?.scope === "admin";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={cardStyle}>
        <div style={sectionTitle}>{admin ? "الإنجاز حسب الموظف (مقارنة الفريق)" : "إنجازي الشخصي"}</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#f9f6ee" }}>
                {["الموظف", "مكتملة", "مفتوحة", "متأخرة", "متوسط الإنجاز (ساعة)"].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#4a3f1a" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.byEmployee ?? []).map((e: any) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #f5f0e6" }}>
                  <td style={{ padding: "6px 10px", fontWeight: 700, color: GR }}>{e.fullName}</td>
                  <td style={{ padding: "6px 10px", color: "#16a34a", fontWeight: 700 }}>{e.completedCount}</td>
                  <td style={{ padding: "6px 10px" }}>{e.openCount}</td>
                  <td style={{ padding: "6px 10px", color: e.overdueCount > 0 ? "#dc2626" : "#9ca3af", fontWeight: e.overdueCount > 0 ? 700 : 400 }}>{e.overdueCount}</td>
                  <td style={{ padding: "6px 10px" }}>{e.avgCompletionHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={cardStyle}>
        <div style={sectionTitle}>{admin ? "أنواع المهام الأكثر تأخرًا" : "أنواع المهام التي تأخرت فيها"}</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byType}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
            <Bar dataKey="overdue" fill="#dc2626" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════ */
export default function ResearchIndex() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canEdit = isAdmin || !!user?.canEdit;
  const [, navigate] = useLocation();

  const [activeTab, setActiveTab] = useState<"home" | "knowledge" | "chat" | "performance">("home");

  const TABS = [
    { key: "home", label: "الرئيسية", icon: LayoutDashboard },
    { key: "knowledge", label: "المواصفات والمعرفة", icon: ClipboardList },
    { key: "chat", label: "التواصل", icon: MessageSquare },
    { key: "performance", label: "تحليل الإنجاز", icon: TrendingUp },
  ] as const;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>البحث والتطوير</h1>
        </div>
        <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>
          الرئيسية · المواصفات والمعرفة · التواصل · تحليل الإنجاز
          {!isAdmin && <span style={{ color: "#7c3aed", fontWeight: 700 }}> — وضع الموظف: تظهر لك بياناتك الخاصة فقط</span>}
        </p>
      </div>

      <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: 6, alignSelf: "flex-start", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", border: "none", background: activeTab === t.key ? `linear-gradient(135deg,${G},${GD})` : "transparent", color: activeTab === t.key ? "white" : "#374151", boxShadow: activeTab === t.key ? `0 3px 12px rgba(212,165,52,0.4)` : undefined }}>
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
        <button onClick={() => navigate("/tasks?view=kanban")} title="فتح لوحة المهام في مركز إدارة العمليات"
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "none", background: "transparent", color: "#374151" }}>
          <KanbanSquare size={15} />
          لوحة المهام (مركز العمليات)
        </button>
      </div>

      {activeTab === "home" && <HomeTab isAdmin={isAdmin} />}
      {activeTab === "knowledge" && <KnowledgeTab canEdit={canEdit} isAdmin={isAdmin} />}
      {activeTab === "chat" && <ChatTab />}
      {activeTab === "performance" && <PerformanceTab />}
    </div>
  );
}
