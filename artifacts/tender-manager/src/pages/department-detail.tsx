import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useUpload } from "@workspace/object-storage-web";
import { entitiesApi, entityDirectoryApi } from "@/lib/api";
import { objectPathToUrl } from "@/components/file-upload";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight, Folder, Info, Users, Tags, Paperclip, History,
  Plus, Trash2, X, Check, ChevronDown, ChevronLeft, Phone, Star,
  FileText, Download, Search, ClipboardList, FileCheck, FileSignature,
  ShoppingCart, Mail, MailOpen, Wrench, Building2, Loader2, ListChecks,
} from "lucide-react";
import LinkedTasks from "@/components/linked-tasks";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const SPECIALIZATION_OPTIONS = [
  "إدارة المشتريات", "إدارة المخازن", "إدارة الشؤون المالية", "إدارة العقود",
  "إدارة المناقصات", "إدارة المشاريع", "إدارة التجهيزات", "إدارة المختبرات", "أخرى",
];
const GOVERNORATES = ["العاصمة", "حولي", "الفروانية", "مبارك الكبير", "الأحمدي", "الجهراء", "أخرى"];
const CONTACT_ROLES = [
  "مدير", "رئيس قسم", "موظف", "مهندس", "محاسب", "سكرتير", "أمين مخزن",
  "مسؤول استلام", "مسؤول تسليم عينات", "مسؤول العقود", "مسؤول الفواتير",
  "مسؤول أوامر الشراء", "مسؤول المناقصات", "مسؤول الممارسات", "أخرى",
];
const METHOD_TYPES = [
  "هاتف المكتب", "هاتف مباشر", "تحويلة", "فاكس", "هاتف الطوارئ",
  "جوال شخصي", "جوال العمل", "واتساب", "بريد إلكتروني", "Microsoft Teams", "أخرى",
];
const CONTACT_STATUSES: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "نشط", color: "#15803d", bg: "#f0fdf4" },
  retired: { label: "متقاعد", color: "#6b7280", bg: "#f9fafb" },
  transferred: { label: "منقول", color: "#b45309", bg: "#fffbeb" },
};
const DOCUMENT_CATEGORIES = ["نماذج كتب", "كتب رسمية", "عقود", "تعليمات", "خرائط الوصول", "مستندات داخلية", "تعاميم", "أخرى"];

const TIMELINE_META: Record<string, { label: string; icon: any; color: string }> = {
  tender: { label: "مناقصة", icon: ClipboardList, color: "#2563eb" },
  practice: { label: "ممارسة", icon: FileCheck, color: "#7c3aed" },
  contract: { label: "عقد", icon: FileSignature, color: "#059669" },
  project: { label: "مشروع", icon: Building2, color: "#0891b2" },
  purchase_order: { label: "أمر شراء", icon: ShoppingCart, color: "#d97706" },
  correspondence_out: { label: "خطاب صادر", icon: Mail, color: "#dc2626" },
  correspondence_in: { label: "خطاب وارد", icon: MailOpen, color: "#16a34a" },
  maintenance: { label: "أمر صيانة", icon: Wrench, color: "#9333ea" },
};

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "8px 11px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "white", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: GR, marginBottom: 5 };
const cardStyle: React.CSSProperties = { background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px" };
const smallBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: `1.5px dashed ${G}88`, background: "white", color: GD, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" };
const iconBtn: React.CSSProperties = { background: "transparent", border: "none", cursor: "pointer", padding: 5, borderRadius: 6, display: "flex", alignItems: "center" };

function PickOrCustom({ options, value, onChange, placeholder }: { options: string[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [custom, setCustom] = useState(!!value && !options.includes(value));
  if (custom) {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <input autoFocus style={{ ...inp, flex: 1 }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        <button type="button" onClick={() => { setCustom(false); onChange(""); }} style={{ padding: "0 8px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 10.5, color: "#6b7280", fontFamily: "inherit" }}>قائمة</button>
      </div>
    );
  }
  return (
    <select style={inp} value={value} onChange={e => { if (e.target.value === "أخرى") { setCustom(true); onChange(""); } else onChange(e.target.value); }}>
      <option value="">— اختر —</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/* ══════════════════════════════════════
   معلومات الإدارة
══════════════════════════════════════ */
function InfoTab({ department, canEdit }: { department: any; canEdit: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(department);
  const updateMut = useMutation({
    mutationFn: (d: any) => entityDirectoryApi.updateDepartment(department.id, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entity-directory"] }),
  });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const save = (k: string) => updateMut.mutate({ [k]: form[k] || null });

  return (
    <div style={cardStyle}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label style={lbl}>اسم الإدارة</label>
          <input style={inp} value={form.name || ""} onChange={e => set("name", e.target.value)} onBlur={() => save("name")} disabled={!canEdit} />
        </div>
        <div>
          <label style={lbl}>نوع التخصص</label>
          <PickOrCustom options={SPECIALIZATION_OPTIONS} value={form.specializationType || ""} onChange={v => { set("specializationType", v); updateMut.mutate({ specializationType: v || null }); }} placeholder="نوع تخصص مخصص" />
        </div>
        <div>
          <label style={lbl}>الفرع أو الموقع</label>
          <input style={inp} value={form.branch || ""} onChange={e => set("branch", e.target.value)} onBlur={() => save("branch")} disabled={!canEdit} />
        </div>
        <div>
          <label style={lbl}>المحافظة</label>
          <PickOrCustom options={GOVERNORATES} value={form.governorate || ""} onChange={v => { set("governorate", v); updateMut.mutate({ governorate: v || null }); }} placeholder="محافظة مخصصة" />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>العنوان</label>
          <input style={inp} value={form.address || ""} onChange={e => set("address", e.target.value)} onBlur={() => save("address")} disabled={!canEdit} />
        </div>
        <div>
          <label style={lbl}>رقم المبنى</label>
          <input style={inp} value={form.buildingNumber || ""} onChange={e => set("buildingNumber", e.target.value)} onBlur={() => save("buildingNumber")} disabled={!canEdit} />
        </div>
        <div>
          <label style={lbl}>الدور</label>
          <input style={inp} value={form.floor || ""} onChange={e => set("floor", e.target.value)} onBlur={() => save("floor")} disabled={!canEdit} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>وصف الإدارة</label>
          <textarea style={{ ...inp, height: 60, resize: "vertical" }} value={form.description || ""} onChange={e => set("description", e.target.value)} onBlur={() => save("description")} disabled={!canEdit} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>ملاحظات</label>
          <textarea style={{ ...inp, height: 60, resize: "vertical" }} value={form.notes || ""} onChange={e => set("notes", e.target.value)} onBlur={() => save("notes")} disabled={!canEdit} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   وسائل التواصل لمسؤول واحد
══════════════════════════════════════ */
function ContactMethods({ contact, canEdit }: { contact: any; canEdit: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState("");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");

  const inv = () => qc.invalidateQueries({ queryKey: ["entity-directory"] });
  const addM = useMutation({
    mutationFn: () => entityDirectoryApi.createMethod(contact.id, { type, value, label: label || null }),
    onSuccess: () => { inv(); setAdding(false); setType(""); setValue(""); setLabel(""); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const delM = useMutation({ mutationFn: (id: number) => entityDirectoryApi.deleteMethod(id), onSuccess: inv });
  const togglePrimaryM = useMutation({ mutationFn: (id: number) => entityDirectoryApi.updateMethod(id, { isPrimary: true }), onSuccess: inv });

  return (
    <div style={{ padding: "8px 12px 10px 32px", background: "#fbfaf6" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
        {contact.methods.length === 0 && !adding && (
          <span style={{ fontSize: 11.5, color: "#9ca3af", fontStyle: "italic" }}>لا توجد وسائل تواصل مضافة</span>
        )}
        {contact.methods.map((m: any) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 10px", borderRadius: 7, background: "white", border: "1px solid #eee" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <button title="تعيين كوسيلة أساسية" style={{ ...iconBtn, padding: 2 }} onClick={() => canEdit && togglePrimaryM.mutate(m.id)}>
                <Star size={12} color={m.isPrimary ? "#d97706" : "#d1d5db"} fill={m.isPrimary ? "#d97706" : "none"} />
              </button>
              <Phone size={11} color={GD} />
              <span style={{ fontWeight: 700, color: "#374151" }}>{m.type}</span>
              <span dir="ltr" style={{ color: "#059669" }}>{m.value}</span>
              {m.label && <span style={{ color: "#9ca3af", fontSize: 11 }}>({m.label})</span>}
            </div>
            {canEdit && <button style={iconBtn} onClick={() => delM.mutate(m.id)} title="حذف"><Trash2 size={11} color="#dc2626" /></button>}
          </div>
        ))}
      </div>
      {canEdit && (adding ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 6, alignItems: "start" }}>
          <PickOrCustom options={METHOD_TYPES} value={type} onChange={setType} placeholder="نوع مخصص" />
          <input style={inp} value={value} onChange={e => setValue(e.target.value)} placeholder="القيمة" dir="ltr" />
          <input style={inp} value={label} onChange={e => setLabel(e.target.value)} placeholder="ملاحظة (اختياري)" />
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => type && value && addM.mutate()} disabled={!type || !value || addM.isPending} style={{ ...iconBtn, background: G, color: "white", borderRadius: 6 }}><Check size={13} /></button>
            <button onClick={() => setAdding(false)} style={{ ...iconBtn, background: "#f3f4f6", borderRadius: 6 }}><X size={13} /></button>
          </div>
        </div>
      ) : (
        <button style={smallBtn} onClick={() => setAdding(true)}><Plus size={11} /> إضافة رقم جديد</button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════
   المسؤولون
══════════════════════════════════════ */
function ContactsTab({ department, canEdit }: { department: any; canEdit: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expandedContactId, setExpandedContactId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [section, setSection] = useState("");

  const inv = () => qc.invalidateQueries({ queryKey: ["entity-directory"] });
  const addM = useMutation({
    mutationFn: () => entityDirectoryApi.createContact(department.id, { name, role: role || null, section: section || null }),
    onSuccess: () => { inv(); setAdding(false); setName(""); setRole(""); setSection(""); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const delM = useMutation({ mutationFn: (id: number) => entityDirectoryApi.deleteContact(id), onSuccess: inv });
  const setStatusM = useMutation({ mutationFn: ({ id, status }: any) => entityDirectoryApi.updateContact(id, { status }), onSuccess: inv });

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {department.contacts.length === 0 && !adding && (
          <span style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic", padding: "4px 0" }}>لا يوجد مسؤولون في هذه الإدارة</span>
        )}
        {department.contacts.map((c: any) => {
          const open = expandedContactId === c.id;
          const statusInfo = CONTACT_STATUSES[c.status] ?? CONTACT_STATUSES.active;
          return (
            <div key={c.id} style={{ borderRadius: 9, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: "white", cursor: "pointer" }}
                onClick={() => setExpandedContactId(open ? null : c.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {open ? <ChevronDown size={13} color="#9ca3af" /> : <ChevronLeft size={13} color="#9ca3af" />}
                  <Users size={12} color={GD} />
                  <span style={{ fontWeight: 700, fontSize: 12.5, color: "#374151" }}>{c.name}</span>
                  {c.role && <span style={{ fontSize: 10.5, fontWeight: 700, color: GD, background: `${G}18`, borderRadius: 10, padding: "1px 8px" }}>{c.role}</span>}
                  {c.section && <span style={{ fontSize: 10.5, color: "#6b7280" }}>({c.section})</span>}
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: statusInfo.color, background: statusInfo.bg, borderRadius: 10, padding: "1px 8px" }}>{statusInfo.label}</span>
                  <span style={{ fontSize: 10.5, color: "#9ca3af" }}>({c.methods.length} وسيلة تواصل)</span>
                </div>
                {canEdit && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={ev => ev.stopPropagation()}>
                    <select value={c.status} onChange={e => setStatusM.mutate({ id: c.id, status: e.target.value })} style={{ ...inp, padding: "3px 6px", fontSize: 10.5, width: "auto" }}>
                      {Object.entries(CONTACT_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <button style={iconBtn} onClick={() => { if (confirm(`حذف المسؤول "${c.name}"؟`)) delM.mutate(c.id); }}><Trash2 size={12} color="#dc2626" /></button>
                  </div>
                )}
              </div>
              {open && <ContactMethods contact={c} canEdit={canEdit} />}
            </div>
          );
        })}
      </div>
      {canEdit && (adding ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 6, marginTop: 10 }}>
          <input autoFocus style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="اسم المسؤول" />
          <PickOrCustom options={CONTACT_ROLES} value={role} onChange={setRole} placeholder="تصنيف مخصص" />
          <input style={inp} value={section} onChange={e => setSection(e.target.value)} placeholder="القسم الفرعي (اختياري)" />
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => name.trim() && addM.mutate()} disabled={!name.trim() || addM.isPending} style={{ ...iconBtn, background: G, color: "white", borderRadius: 6 }}><Check size={13} /></button>
            <button onClick={() => setAdding(false)} style={{ ...iconBtn, background: "#f3f4f6", borderRadius: 6 }}><X size={13} /></button>
          </div>
        </div>
      ) : (
        <button style={{ ...smallBtn, marginTop: 10 }} onClick={() => setAdding(true)}><Plus size={11} /> إضافة مسؤول</button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════
   أنواع التعامل
══════════════════════════════════════ */
function ServiceTypesTab({ departmentId, canEdit, isAdmin }: { departmentId: number; canEdit: boolean; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { data: allTypes = [] } = useQuery<any[]>({ queryKey: ["service-types"], queryFn: () => entityDirectoryApi.serviceTypes.list() });
  const { data: activeTypes = [] } = useQuery<any[]>({ queryKey: ["department-service-types", departmentId], queryFn: () => entityDirectoryApi.departmentServiceTypes.list(departmentId) });

  const activeIds = new Set(activeTypes.map((t: any) => t.id));
  const toggleMut = useMutation({
    mutationFn: (nextIds: number[]) => entityDirectoryApi.departmentServiceTypes.set(departmentId, nextIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["department-service-types", departmentId] }),
  });

  const toggle = (id: number) => {
    if (!canEdit) return;
    const next = activeIds.has(id) ? [...activeIds].filter(x => x !== id) : [...activeIds, id];
    toggleMut.mutate(next);
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, color: "#6b7280" }}>حدد أنواع التعامل المتاحة لهذه الإدارة</span>
        {isAdmin && <button onClick={() => navigate("/admin/service-types")} style={{ ...smallBtn, borderStyle: "solid" }}><Tags size={12} /> إدارة الأنواع</button>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {allTypes.map((t: any) => {
          const active = activeIds.has(t.id);
          return (
            <button key={t.id} onClick={() => toggle(t.id)} disabled={!canEdit}
              style={{
                padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: canEdit ? "pointer" : "default",
                border: `1.5px solid ${active ? GD : "#e5e7eb"}`, background: active ? `linear-gradient(135deg,${G}22,${GD}18)` : "white",
                color: active ? GD : "#6b7280", fontFamily: "inherit",
              }}>
              {t.name}
            </button>
          );
        })}
        {allTypes.length === 0 && <span style={{ fontSize: 12.5, color: "#9ca3af" }}>لا توجد أنواع تعامل مُعرّفة بعد</span>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   المستندات
══════════════════════════════════════ */
function DocumentsTab({ departmentId, canEdit }: { departmentId: number; canEdit: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [category, setCategory] = useState("");
  const { data: docs = [] } = useQuery<any[]>({ queryKey: ["department-documents", departmentId], queryFn: () => entityDirectoryApi.departmentDocuments.list(departmentId) });

  const addMut = useMutation({
    mutationFn: (d: any) => entityDirectoryApi.departmentDocuments.upload(departmentId, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["department-documents", departmentId] }); toast({ title: "✅ تم رفع المستند" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => entityDirectoryApi.departmentDocuments.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["department-documents", departmentId] }),
  });

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res: any) => addMut.mutate({ category: category || "أخرى", fileName: res.metadata.name, fileUrl: res.objectPath }),
    onError: (err: Error) => toast({ title: "فشل رفع الملف", description: err.message, variant: "destructive" }),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadFile(f);
    e.target.value = "";
  };

  return (
    <div style={cardStyle}>
      {canEdit && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <select style={{ ...inp, width: "auto" }} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">فئة المستند...</option>
            {DOCUMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, border: `1.5px dashed ${G}88`, background: "white", color: GD, cursor: isUploading ? "not-allowed" : "pointer", fontSize: 12.5, fontWeight: 700 }}>
            {isUploading ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> جاري الرفع {progress}%</> : <><Paperclip size={13} /> رفع مستند</>}
            <input type="file" style={{ display: "none" }} onChange={handleFile} disabled={isUploading} />
          </label>
        </div>
      )}
      {docs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
          <FileText size={30} style={{ margin: "0 auto 10px", display: "block", opacity: 0.3 }} />
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>لا توجد مستندات مرفوعة بعد</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {docs.map((d: any) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 9, border: "1px solid #f0ead8", background: "#fdfcf8" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={14} color={GD} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>{d.fileName}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: GD, background: `${G}18`, borderRadius: 10, padding: "1px 8px" }}>{d.category}</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <a href={objectPathToUrl(d.fileUrl) ?? "#"} target="_blank" rel="noreferrer" style={{ ...iconBtn }}><Download size={13} color={GD} /></a>
                {canEdit && <button style={iconBtn} onClick={() => delMut.mutate(d.id)}><Trash2 size={13} color="#dc2626" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   سجل التعاملات
══════════════════════════════════════ */
function TimelineTab({ departmentId }: { departmentId: number }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const { data: timeline = [], isLoading } = useQuery<any[]>({
    queryKey: ["department-timeline", departmentId, search, type],
    queryFn: () => entityDirectoryApi.departmentTimeline(departmentId, { search: search || undefined, type: type || undefined }),
  });

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1.5px solid #e5dfc8", borderRadius: 9, padding: "6px 12px", flex: 1, minWidth: 200 }}>
          <Search size={13} color="#9ca3af" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم السجل..." style={{ border: "none", outline: "none", fontSize: 12.5, background: "transparent", flex: 1, fontFamily: "inherit" }} />
        </div>
        <select style={{ ...inp, width: "auto" }} value={type} onChange={e => setType(e.target.value)}>
          <option value="">كل الأنواع</option>
          {Object.entries(TIMELINE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>جاري التحميل...</div>
      ) : timeline.length === 0 ? (
        <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
          <History size={30} style={{ margin: "0 auto 10px", display: "block", opacity: 0.3 }} />
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>لا توجد تعاملات مسجلة بعد</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {timeline.map((t: any) => {
            const meta = TIMELINE_META[t.type] ?? { label: t.type, icon: FileText, color: "#6b7280" };
            const Icon = meta.icon;
            return (
              <div key={`${t.type}-${t.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 9, border: "1px solid #f0ead8", background: "#fdfcf8" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={13} color={meta.color} />
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: meta.color, background: `${meta.color}15`, borderRadius: 10, padding: "1px 8px" }}>{meta.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>{t.label || "—"}</span>
                  {t.status && <span style={{ fontSize: 11, color: "#9ca3af" }}>({t.status})</span>}
                </div>
                <span style={{ fontSize: 11.5, color: "#9ca3af" }}>{t.date ? new Date(t.date).toLocaleDateString("en-GB") : "—"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   لوحة الإحصائيات
══════════════════════════════════════ */
function StatsBar({ departmentId }: { departmentId: number }) {
  const { data: stats } = useQuery<any>({ queryKey: ["department-stats", departmentId], queryFn: () => entityDirectoryApi.departmentStats(departmentId) });
  if (!stats) return null;
  const items = [
    { label: "المناقصات", value: stats.tendersCount, color: "#2563eb" },
    { label: "العقود", value: stats.contractsCount, color: "#059669" },
    { label: "أوامر الشراء", value: stats.purchaseOrdersCount, color: "#d97706" },
    { label: "كتب صادرة", value: stats.outgoingLettersCount, color: "#dc2626" },
    { label: "كتب واردة", value: stats.incomingLettersCount, color: "#16a34a" },
    { label: "المسؤولون", value: stats.contactsCount, color: GD },
    { label: "المستندات", value: stats.documentsCount, color: "#7c3aed" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginBottom: 18 }}>
      {items.map(s => (
        <div key={s.label} style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value ?? 0}</div>
          <div style={{ fontSize: 10.5, color: "#9ca3af", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
      {stats.lastContactDate && (
        <div style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: GR }}>{new Date(stats.lastContactDate).toLocaleDateString("en-GB")}</div>
          <div style={{ fontSize: 10.5, color: "#9ca3af", fontWeight: 600, marginTop: 2 }}>آخر تواصل</div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function DepartmentDetail() {
  const params = useParams();
  const entityId = Number(params.id);
  const deptId = Number(params.deptId);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || !!user?.canEdit;
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState<"info" | "contacts" | "serviceTypes" | "documents" | "timeline" | "tasks">("info");

  const { data: entity } = useQuery<any>({ queryKey: ["government-entity", entityId], queryFn: () => entitiesApi.get(entityId), enabled: !!entityId });
  const { data: directory, isLoading } = useQuery<{ departments: any[] }>({
    queryKey: ["entity-directory", entityId],
    queryFn: () => entityDirectoryApi.getDirectory(entityId),
    enabled: !!entityId,
  });

  const department = (directory?.departments ?? []).find((d: any) => d.id === deptId);

  const TABS = [
    { key: "info", label: "معلومات الإدارة", icon: Info },
    { key: "contacts", label: "المسؤولون", icon: Users },
    { key: "serviceTypes", label: "أنواع التعامل", icon: Tags },
    { key: "documents", label: "المستندات", icon: Paperclip },
    { key: "timeline", label: "سجل التعاملات", icon: History },
    { key: "tasks", label: "المهام المرتبطة", icon: ListChecks },
  ] as const;

  if (isLoading || !department) {
    return <div style={{ padding: 60, textAlign: "center", color: "#9ca3af" }}>{isLoading ? "جاري التحميل..." : "الإدارة غير موجودة"}</div>;
  }

  return (
    <div style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", direction: "rtl" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <button onClick={() => navigate(`/entities/${entityId}`)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 10, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer" }}>
          <ArrowRight size={16} color={GD} />
        </button>
        <Folder size={20} color={GD} />
        <h1 style={{ fontSize: 19, fontWeight: 800, color: GR, margin: 0 }}>{department.name}</h1>
      </div>
      {entity?.name && <p style={{ color: "#9ca3af", fontSize: 12.5, margin: "0 0 16px 52px" }}>{entity.name}</p>}

      <StatsBar departmentId={deptId} />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: 6, alignSelf: "flex-start", flexWrap: "wrap", marginBottom: 18, width: "fit-content" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 11, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", border: "none", background: activeTab === t.key ? `linear-gradient(135deg,${G},${GD})` : "transparent", color: activeTab === t.key ? "white" : "#374151", boxShadow: activeTab === t.key ? `0 3px 12px rgba(212,165,52,0.4)` : undefined }}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "info" && <InfoTab department={department} canEdit={canEdit} />}
      {activeTab === "contacts" && <ContactsTab department={department} canEdit={canEdit} />}
      {activeTab === "serviceTypes" && <ServiceTypesTab departmentId={deptId} canEdit={canEdit} isAdmin={isAdmin} />}
      {activeTab === "documents" && <DocumentsTab departmentId={deptId} canEdit={canEdit} />}
      {activeTab === "timeline" && <TimelineTab departmentId={deptId} />}
      {activeTab === "tasks" && <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: 20 }}><LinkedTasks entityType="department" entityId={deptId} /></div>}
    </div>
  );
}
