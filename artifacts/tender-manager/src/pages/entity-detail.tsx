import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { entitiesApi, entityDirectoryApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import FileUpload, { objectPathToUrl } from "@/components/file-upload";
import LinkedTasks from "@/components/linked-tasks";
import {
  ArrowRight, Building2, Globe, Mail, Phone, MapPin, Save, Plus, Users,
  Folder, Search, X, ChevronLeft, Trash2,
} from "lucide-react";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const ENTITY_TYPES = ["وزارة", "هيئة", "مؤسسة", "شركة حكومية", "جامعة", "أخرى"];

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: GR, marginBottom: 5 };
const cardStyle: React.CSSProperties = { background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px" };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 };

const SEARCH_TYPE_LABELS: Record<string, string> = {
  entity: "جهة", department: "إدارة", contact: "مسؤول", contact_method: "وسيلة تواصل", letter: "خطاب", contract: "عقد",
};

export default function EntityDetail() {
  const params = useParams();
  const entityId = Number(params.id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || !!user?.canEdit;
  const qc = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<any>(null);
  const [addingDept, setAddingDept] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const { data: entity } = useQuery<any>({ queryKey: ["government-entity", entityId], queryFn: () => entitiesApi.get(entityId), enabled: !!entityId });
  const { data: directory, isLoading: dirLoading } = useQuery<{ departments: any[] }>({
    queryKey: ["entity-directory", entityId],
    queryFn: () => entityDirectoryApi.getDirectory(entityId),
    enabled: !!entityId,
  });
  const { data: searchResults } = useQuery<any[]>({
    queryKey: ["entities-search", searchQ],
    queryFn: () => entitiesApi.search(searchQ),
    enabled: searchQ.trim().length >= 2,
  });

  useEffect(() => { if (entity) setForm({ ...entity }); }, [entity]);

  const updateMut = useMutation({
    mutationFn: (d: any) => entitiesApi.update(entityId, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["government-entity", entityId] }); toast({ title: "✅ تم الحفظ" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const addDeptMut = useMutation({
    mutationFn: () => entityDirectoryApi.createDepartment(entityId, { name: deptName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["entity-directory", entityId] }); setAddingDept(false); setDeptName(""); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const deleteDeptMut = useMutation({
    mutationFn: (id: number) => entityDirectoryApi.deleteDepartment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entity-directory", entityId] }),
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const saveField = (k: string) => { if (form) updateMut.mutate({ [k]: form[k] || null }); };

  const departments = directory?.departments ?? [];

  const searchResultLink = (r: any) => {
    if (r.type === "entity") return `/entities/${r.id}`;
    if (r.departmentId) return `/entities/${r.entityId}/departments/${r.departmentId}`;
    return `/entities/${r.entityId}`;
  };

  if (!entity || !form) {
    return <div style={{ padding: 60, textAlign: "center", color: "#9ca3af" }}>جاري التحميل...</div>;
  }

  return (
    <div style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", direction: "rtl" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={() => navigate("/entities")} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 10, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer" }}>
          <ArrowRight size={16} color={GD} />
        </button>
        <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,#E8BE55,${GD})` }} />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: GR, margin: 0 }}>{entity.name}</h1>
      </div>

      {/* ── Smart search ── */}
      <div style={{ ...cardStyle, marginBottom: 18, position: "relative" }}>
        <div style={sectionTitle}>البحث الذكي</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1.5px solid #e5dfc8", borderRadius: 10, padding: "8px 14px" }}>
          <Search size={15} color="#9ca3af" />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="بحث باسم الإدارة، المسؤول، الهاتف، رقم الكتاب، رقم العقد..." style={{ border: "none", outline: "none", fontSize: 13, background: "transparent", flex: 1, fontFamily: "inherit" }} />
          {searchQ && <button onClick={() => setSearchQ("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={13} /></button>}
        </div>
        {searchQ.trim().length >= 2 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
            {(searchResults ?? []).length === 0 ? (
              <div style={{ padding: 12, color: "#9ca3af", fontSize: 12.5, textAlign: "center" }}>لا توجد نتائج</div>
            ) : (searchResults ?? []).map((r: any, i: number) => (
              <div key={`${r.type}-${r.id}-${i}`} onClick={() => navigate(searchResultLink(r))}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "#fbfaf6", cursor: "pointer", border: "1px solid #f0ead8" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: GD, background: `${G}18`, borderRadius: 6, padding: "2px 7px" }}>{SEARCH_TYPE_LABELS[r.type] ?? r.type}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>{r.title}</span>
                  {r.subtitle && <span style={{ fontSize: 11, color: "#9ca3af" }}>{r.subtitle}</span>}
                </div>
                <ChevronLeft size={13} color="#9ca3af" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Entity info ── */}
      <div style={{ ...cardStyle, marginBottom: 18, display: "grid", gridTemplateColumns: "160px 1fr", gap: 20 }}>
        <div>
          <div style={sectionTitle}>الشعار</div>
          <FileUpload objectPath={form.logoUrl} onChange={p => { set("logoUrl", p); updateMut.mutate({ logoUrl: p }); }} accept="image/*" disabled={!canEdit} label="رفع شعار" />
          {form.logoUrl && (
            <img src={objectPathToUrl(form.logoUrl) ?? ""} alt="شعار" style={{ marginTop: 10, maxWidth: 130, maxHeight: 90, objectFit: "contain", borderRadius: 8, border: "1px solid #f0ead8" }} />
          )}
        </div>
        <div>
          <div style={sectionTitle}>بيانات الجهة</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>اسم الجهة</label>
              <input style={inp} value={form.name || ""} onChange={e => set("name", e.target.value)} onBlur={() => saveField("name")} disabled={!canEdit} />
            </div>
            <div>
              <label style={lbl}>نوع الجهة</label>
              <select style={inp} value={form.type || ""} onChange={e => { set("type", e.target.value); updateMut.mutate({ type: e.target.value || null }); }} disabled={!canEdit}>
                <option value="">اختر النوع</option>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}><Globe size={10} style={{ display: "inline", marginLeft: 4 }} />الموقع الإلكتروني</label>
              <input style={{ ...inp, direction: "ltr" }} value={form.website || ""} onChange={e => set("website", e.target.value)} onBlur={() => saveField("website")} disabled={!canEdit} />
            </div>
            <div>
              <label style={lbl}><Mail size={10} style={{ display: "inline", marginLeft: 4 }} />البريد الإلكتروني العام</label>
              <input style={{ ...inp, direction: "ltr" }} value={form.email || ""} onChange={e => set("email", e.target.value)} onBlur={() => saveField("email")} disabled={!canEdit} />
            </div>
            <div>
              <label style={lbl}><Phone size={10} style={{ display: "inline", marginLeft: 4 }} />الرقم الرئيسي</label>
              <input style={{ ...inp, direction: "ltr" }} value={form.phone || ""} onChange={e => set("phone", e.target.value)} onBlur={() => saveField("phone")} disabled={!canEdit} />
            </div>
            <div>
              <label style={lbl}>بادئة ترقيم المراسلات</label>
              <input style={{ ...inp, direction: "ltr" }} value={form.codePrefix || ""} onChange={e => set("codePrefix", e.target.value.toUpperCase())} onBlur={() => saveField("codePrefix")} disabled={!canEdit} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={lbl}><MapPin size={10} style={{ display: "inline", marginLeft: 4 }} />العنوان الرئيسي</label>
              <input style={inp} value={form.address || ""} onChange={e => set("address", e.target.value)} onBlur={() => saveField("address")} disabled={!canEdit} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={lbl}>الملاحظات</label>
              <textarea style={{ ...inp, height: 60, resize: "vertical" }} value={form.notes || ""} onChange={e => set("notes", e.target.value)} onBlur={() => saveField("notes")} disabled={!canEdit} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Departments ── */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={sectionTitle}>الإدارات والاختصاصات ({departments.length})</div>
          {canEdit && !addingDept && (
            <button onClick={() => setAddingDept(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, border: `1.5px dashed ${G}88`, background: "white", color: GD, cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit" }}>
              <Plus size={13} /> إضافة إدارة
            </button>
          )}
        </div>

        {addingDept && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input autoFocus style={inp} value={deptName} onChange={e => setDeptName(e.target.value)} placeholder="اسم الإدارة، مثال: إدارة المشتريات" />
            <button onClick={() => deptName.trim() && addDeptMut.mutate()} disabled={!deptName.trim() || addDeptMut.isPending} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 16px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit" }}>
              <Save size={13} /> حفظ
            </button>
            <button onClick={() => { setAddingDept(false); setDeptName(""); }} style={{ padding: "8px 16px", borderRadius: 9, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 12.5, fontFamily: "inherit", color: "#6b7280" }}>إلغاء</button>
          </div>
        )}

        {dirLoading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>جاري التحميل...</div>
        ) : departments.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
            <Folder size={32} style={{ margin: "0 auto 10px", display: "block", opacity: 0.3 }} />
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>لا توجد إدارات مضافة بعد</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {departments.map((d: any) => (
              <div key={d.id} onClick={() => navigate(`/entities/${entityId}/departments/${d.id}`)}
                style={{ borderRadius: 13, border: "1.5px solid #f0ead8", padding: "14px 16px", cursor: "pointer", background: "#fdfcf8", transition: "box-shadow 0.15s, transform 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.08)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Folder size={16} color={GD} />
                    <span style={{ fontWeight: 800, fontSize: 13.5, color: GR }}>{d.name}</span>
                  </div>
                  {canEdit && (
                    <button onClick={ev => { ev.stopPropagation(); if (confirm(`حذف إدارة "${d.name}" وكل بياناتها؟`)) deleteDeptMut.mutate(d.id); }}
                      style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", flexShrink: 0 }}>
                      <Trash2 size={13} color="#dc2626" />
                    </button>
                  )}
                </div>
                {d.specializationType && (
                  <span style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, color: GD, background: `${G}18`, borderRadius: 20, padding: "2px 9px", marginBottom: 6 }}>{d.specializationType}</span>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#6b7280" }}>
                  <Users size={11} /> {d.contacts?.length ?? 0} مسؤول
                  {d.governorate && <><span>•</span><MapPin size={11} />{d.governorate}</>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Linked tasks ── */}
      <div style={cardStyle}>
        <LinkedTasks entityType="governmentEntity" entityId={entityId} />
      </div>
    </div>
  );
}
