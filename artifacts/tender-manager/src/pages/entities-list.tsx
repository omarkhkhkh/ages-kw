import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entitiesApi } from "@/lib/api";
import {
  Building2, Plus, Pencil, Trash2, X, Check, Download, Search,
  Phone, Mail, MapPin, User, Globe, LayoutGrid, List,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { exportEntitiesToExcel } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";

const G  = "#D4A534";
const GL = "#E8BE55";
const GD = "#A87C20";
const GR = "#132a18";

const ENTITY_TYPES = ["وزارة", "هيئة", "مؤسسة", "شركة حكومية", "جامعة", "أخرى"];

const emptyForm = {
  name: "", type: "", contactPerson: "",
  phone: "", email: "", website: "", address: "", notes: "",
};

const TYPE_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  "وزارة":       { color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  "هيئة":        { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  "مؤسسة":       { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
  "شركة حكومية": { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
  "جامعة":       { color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  "أخرى":        { color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
};

function getTypeStyle(type: string) {
  return TYPE_COLORS[type] ?? TYPE_COLORS["أخرى"];
}

const S = {
  page:        { fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", direction: "rtl" as const },
  th:          { padding: "14px 18px", fontWeight: 700, color: "#4a3f1a", fontSize: 12, whiteSpace: "nowrap" as const, textAlign: "right" as const },
  td:          { padding: "13px 18px", fontSize: 13, textAlign: "right" as const, verticalAlign: "middle" as const },
  label:       { display: "block", fontSize: 12, fontWeight: 700, color: "#4a3f1a", marginBottom: 5 },
  input:       { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 13, background: "white", boxSizing: "border-box" as const, outline: "none", color: "#1e2a1e" },
  select:      { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 13, background: "white", boxSizing: "border-box" as const, outline: "none", color: "#1e2a1e", height: 38 },
  fieldGrid:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 },
  saveBtn:     { background: `linear-gradient(135deg, ${GL}, ${GD})`, color: "white", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
  cancelBtn:   { background: "transparent", color: "#6b7280", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  iconBtn:     { background: "transparent", border: "none", cursor: "pointer", padding: "6px 8px", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" },
};

/* ── ContactRow: icon + text ── */
function ContactRow({ icon: Icon, text, href, color = "#6b7280" }: { icon: any; text: string; href?: string; color?: string }) {
  if (!text) return null;
  const content = (
    <div style={{ display: "flex", alignItems: "center", gap: 7, color, fontSize: 12 }}>
      <Icon size={12} color={color} strokeWidth={2} style={{ flexShrink: 0 }} />
      <span style={{ direction: "ltr", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
    </div>
  );
  if (href) return <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>{content}</a>;
  return content;
}

/* ── Entity Card ── */
function EntityCard({ entity, canEdit, onEdit, onDelete }: {
  entity: any; canEdit: boolean;
  onEdit: (e: any) => void; onDelete: (id: number) => void;
}) {
  const ts = getTypeStyle(entity.type);
  const website = entity.website
    ? (entity.website.startsWith("http") ? entity.website : `https://${entity.website}`)
    : null;

  return (
    <div style={{
      background: "white", borderRadius: 16, border: `1.5px solid ${ts.border}`,
      boxShadow: "0 2px 12px rgba(0,0,0,0.05)", padding: 20,
      display: "flex", flexDirection: "column", gap: 12,
      transition: "box-shadow 0.15s, transform 0.15s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(0,0,0,0.10)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.05)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: ts.bg, border: `1.5px solid ${ts.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Building2 size={18} color={ts.color} strokeWidth={1.8} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: GR, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{entity.name}</div>
            {entity.type && (
              <span style={{ display: "inline-block", marginTop: 4, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}>{entity.type}</span>
            )}
          </div>
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            <button style={S.iconBtn} onClick={() => onEdit(entity)} title="تعديل"
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = `${G}18`}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
              <Pencil size={13} color={GD} />
            </button>
            <button style={S.iconBtn} onClick={() => { if (confirm("هل تريد حذف هذه الجهة؟")) onDelete(entity.id); }} title="حذف"
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#fee2e2"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
              <Trash2 size={13} color="#dc2626" />
            </button>
          </div>
        )}
      </div>

      {/* Contact info */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: `1px solid ${ts.border}`, paddingTop: 12 }}>
        {entity.contactPerson && (
          <ContactRow icon={User} text={entity.contactPerson} color="#374151" />
        )}
        {entity.phone && (
          <ContactRow icon={Phone} text={entity.phone} href={`tel:${entity.phone}`} color="#059669" />
        )}
        {entity.email && (
          <ContactRow icon={Mail} text={entity.email} href={`mailto:${entity.email}`} color="#2563eb" />
        )}
        {website && (
          <ContactRow icon={Globe} text={entity.website} href={website} color="#7c3aed" />
        )}
        {entity.address && (
          <ContactRow icon={MapPin} text={entity.address} color="#6b7280" />
        )}
        {!entity.phone && !entity.email && !entity.website && !entity.address && !entity.contactPerson && (
          <span style={{ fontSize: 12, color: "#d1d5db", fontStyle: "italic" }}>لم تُضف بيانات الاتصال بعد</span>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" as const }}>
        {entity.phone && (
          <a href={`tel:${entity.phone}`} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", fontSize: 12, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}>
            <Phone size={11} /> اتصال
          </a>
        )}
        {website && (
          <a href={website} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, background: "#f5f3ff", border: "1px solid #ddd6fe", color: "#6d28d9", fontSize: 12, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}>
            <ExternalLink size={11} /> الموقع
          </a>
        )}
        {entity.email && (
          <a href={`mailto:${entity.email}`} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", fontSize: 12, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}>
            <Mail size={11} /> مراسلة
          </a>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */

export default function EntitiesList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<number | null>(null);
  const [form,     setForm]     = useState({ ...emptyForm });
  const [search,   setSearch]   = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [filterType, setFilterType] = useState("");

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ["government-entities"],
    queryFn: () => entitiesApi.list(),
  });

  const isAdmin = user?.role === "admin";
  const canEdit    = isAdmin || !!user?.canEdit;
  const canDownload = isAdmin || !!user?.canDownload;

  const createM = useMutation({
    mutationFn: (d: any) => entitiesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["government-entities"] }); closeForm(); toast({ title: "✅ تم إضافة الجهة" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const updateM = useMutation({
    mutationFn: ({ id, data }: any) => entitiesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["government-entities"] }); closeForm(); toast({ title: "✅ تم تحديث الجهة" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => entitiesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["government-entities"] }); toast({ title: "تم حذف الجهة" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const openEdit  = (e: any) => {
    setEditId(e.id);
    setForm({ name: e.name, type: e.type || "", contactPerson: e.contactPerson || "", phone: e.phone || "", email: e.email || "", website: e.website || "", address: e.address || "", notes: e.notes || "" });
    setShowForm(true);
  };
  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.name.trim()) return;
    editId ? updateM.mutate({ id: editId, data: form }) : createM.mutate(form);
  };

  const filtered = (entities as any[]).filter((e: any) => {
    const q = search.toLowerCase();
    const matchQ = !q || e.name?.toLowerCase().includes(q) || e.type?.toLowerCase().includes(q) || e.contactPerson?.toLowerCase().includes(q) || e.phone?.includes(q);
    const matchT = !filterType || e.type === filterType;
    return matchQ && matchT;
  });

  /* stats */
  const total     = (entities as any[]).length;
  const withPhone = (entities as any[]).filter((e: any) => e.phone).length;
  const withSite  = (entities as any[]).filter((e: any) => e.website).length;
  const typeCounts = ENTITY_TYPES.map(t => ({ type: t, count: (entities as any[]).filter((e: any) => e.type === t).length })).filter(x => x.count > 0);

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" as const }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg,${GL},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>الجهات الحكومية</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0 14px" }}>دليل الاتصال بالجهات الحكومية المتعاملة معها</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const }}>
          {/* view toggle */}
          <div style={{ display: "flex", borderRadius: 10, border: "1.5px solid #e5e7eb", overflow: "hidden" }}>
            {(["cards", "table"] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                style={{ padding: "7px 14px", background: viewMode === mode ? `linear-gradient(135deg,${GL},${GD})` : "white", color: viewMode === mode ? "white" : "#6b7280", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, fontFamily: "inherit", transition: "all 0.15s" }}>
                {mode === "cards" ? <><LayoutGrid size={13} /> بطاقات</> : <><List size={13} /> جدول</>}
              </button>
            ))}
          </div>
          {canDownload && (
            <button style={{ display: "flex", alignItems: "center", gap: 6, background: "white", color: GD, border: `1.5px solid ${G}66`, borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }} onClick={() => exportEntitiesToExcel(entities)}>
              <Download size={15} /> تصدير
            </button>
          )}
          {canEdit && (
            <button style={{ display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg,${GL},${GD})`, color: "white", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: `0 4px 14px ${G}44`, fontFamily: "inherit" }} onClick={() => { closeForm(); setShowForm(true); }}>
              <Plus size={15} /> إضافة جهة
            </button>
          )}
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" as const }}>
        {[
          { label: "إجمالي الجهات",    value: total,     color: G,        icon: Building2 },
          { label: "لديها هاتف",       value: withPhone, color: "#059669", icon: Phone },
          { label: "لديها موقع",       value: withSite,  color: "#7c3aed", icon: Globe },
        ].map(s => (
          <div key={s.label} style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.04)", flex: "0 0 auto" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <s.icon size={18} color={s.color} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: GR, lineHeight: 1 }}>{isLoading ? "—" : s.value}</div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}

        {/* type pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const, marginRight: "auto" }}>
          {typeCounts.map(({ type, count }) => {
            const ts = getTypeStyle(type);
            return (
              <button key={type}
                onClick={() => setFilterType(filterType === type ? "" : type)}
                style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: filterType === type ? ts.color : ts.bg, color: filterType === type ? "white" : ts.color, border: `1.5px solid ${ts.border}`, cursor: "pointer", fontFamily: "inherit" }}>
                {type} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Search ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "white", border: "1.5px solid #e5dfc8", borderRadius: 12, padding: "8px 14px", marginBottom: 20, maxWidth: 400 }}>
        <Search size={15} color="#9ca3af" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهاتف أو المسؤول..." style={{ border: "none", outline: "none", fontSize: 13, color: "#1e2a1e", background: "transparent", flex: 1, fontFamily: "inherit" }} />
        {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={13} /></button>}
      </div>

      {/* ══════════════ CARDS VIEW ══════════════ */}
      {viewMode === "cards" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {isLoading
            ? [...Array(6)].map((_, i) => (
              <div key={i} style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: 20, height: 180, animation: "pulse 1.5s infinite" }} />
            ))
            : filtered.length === 0
              ? (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: "#9ca3af" }}>
                  <Building2 size={40} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                  {search || filterType ? "لا توجد نتائج تطابق المعايير المحددة" : "لا توجد جهات حكومية مسجلة"}
                </div>
              )
              : filtered.map((e: any) => (
                <EntityCard key={e.id} entity={e} canEdit={canEdit} onEdit={openEdit} onDelete={id => deleteM.mutate(id)} />
              ))}
        </div>
      )}

      {/* ══════════════ TABLE VIEW ══════════════ */}
      {viewMode === "table" && (
        <div style={{ background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" as const }}>
            <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 13, textAlign: "right" as const }}>
              <thead style={{ background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" }}>
                <tr>
                  {["اسم الجهة", "النوع", "المسؤول", "الهاتف", "البريد", "الموقع", ""].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? [...Array(4)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(7)].map((_, j) => (
                        <td key={j} style={S.td}><div style={{ height: 14, background: "#f3f0e6", borderRadius: 4, width: j === 0 ? 140 : 90 }} /></td>
                      ))}
                    </tr>
                  ))
                  : filtered.length === 0
                    ? (
                      <tr><td colSpan={7} style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                        <Building2 size={40} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
                        {search || filterType ? "لا توجد نتائج تطابق المعايير المحددة" : "لا توجد جهات حكومية مسجلة"}
                      </td></tr>
                    )
                    : filtered.map((e: any, idx: number) => {
                      const ts = getTypeStyle(e.type);
                      const website = e.website ? (e.website.startsWith("http") ? e.website : `https://${e.website}`) : null;
                      return (
                        <tr key={e.id} style={{ borderBottom: idx < filtered.length - 1 ? "1px solid #f5f0e6" : "none", background: "white", transition: "background 0.1s" }}
                          onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = "#fffdf5"}
                          onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "white"}>
                          <td style={{ ...S.td, fontWeight: 700, color: GR }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 30, height: 30, borderRadius: 8, background: ts.bg, border: `1.5px solid ${ts.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Building2 size={13} color={ts.color} />
                              </div>
                              {e.name}
                            </div>
                          </td>
                          <td style={S.td}>
                            {e.type
                              ? <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}>{e.type}</span>
                              : <span style={{ color: "#d1d5db" }}>—</span>}
                          </td>
                          <td style={{ ...S.td, color: "#4b5563" }}>
                            {e.contactPerson
                              ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}><User size={12} color="#9ca3af" />{e.contactPerson}</div>
                              : <span style={{ color: "#d1d5db" }}>—</span>}
                          </td>
                          <td style={{ ...S.td, color: "#059669", direction: "ltr", textAlign: "right" as const }}>
                            {e.phone
                              ? <a href={`tel:${e.phone}`} style={{ display: "flex", alignItems: "center", gap: 5, color: "#059669", textDecoration: "none" }}><Phone size={12} />{e.phone}</a>
                              : <span style={{ color: "#d1d5db" }}>—</span>}
                          </td>
                          <td style={{ ...S.td, color: "#2563eb", fontSize: 12, direction: "ltr", textAlign: "right" as const }}>
                            {e.email
                              ? <a href={`mailto:${e.email}`} style={{ display: "flex", alignItems: "center", gap: 5, color: "#2563eb", textDecoration: "none" }}><Mail size={12} />{e.email}</a>
                              : <span style={{ color: "#d1d5db" }}>—</span>}
                          </td>
                          <td style={{ ...S.td, color: "#7c3aed", fontSize: 12, direction: "ltr", textAlign: "right" as const }}>
                            {website
                              ? <a href={website} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, color: "#7c3aed", textDecoration: "none" }}><Globe size={12} />{e.website}</a>
                              : <span style={{ color: "#d1d5db" }}>—</span>}
                          </td>
                          <td style={{ ...S.td, textAlign: "left" as const }}>
                            {canEdit && (
                              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                <button style={S.iconBtn} onClick={() => openEdit(e)} title="تعديل"
                                  onMouseEnter={ev => (ev.currentTarget as HTMLButtonElement).style.background = `${G}18`}
                                  onMouseLeave={ev => (ev.currentTarget as HTMLButtonElement).style.background = "transparent"}>
                                  <Pencil size={14} color={GD} />
                                </button>
                                <button style={S.iconBtn} onClick={() => { if (confirm("هل تريد حذف هذه الجهة؟")) deleteM.mutate(e.id); }} title="حذف"
                                  onMouseEnter={ev => (ev.currentTarget as HTMLButtonElement).style.background = "#fee2e2"}
                                  onMouseLeave={ev => (ev.currentTarget as HTMLButtonElement).style.background = "transparent"}>
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
      )}

      {/* ══════════════ DRAWER ══════════════ */}
      {showForm && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40, backdropFilter: "blur(2px)" }} onClick={closeForm} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 480, background: "white", zIndex: 50, boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" as const, overflowY: "auto" as const }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0ead8", background: `linear-gradient(135deg,#fffdf5,#fef9ec)`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: GR }}>{editId ? "✏️ تعديل الجهة" : "🏛️ جهة حكومية جديدة"}</span>
              <button onClick={closeForm} style={{ ...S.iconBtn, color: "#6b7280" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 24, flex: 1 }}>
              <form onSubmit={handleSubmit}>
                <div style={S.fieldGrid}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>اسم الجهة *</label>
                    <input style={S.input} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم الجهة الحكومية" required />
                  </div>
                  <div>
                    <label style={S.label}>نوع الجهة</label>
                    <select style={S.select} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                      <option value="">اختر النوع</option>
                      {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>الشخص المسؤول</label>
                    <input style={S.input} value={form.contactPerson} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} placeholder="اسم المسؤول" />
                  </div>
                  <div>
                    <label style={S.label}><Phone size={10} style={{ display: "inline", marginLeft: 4 }} />الهاتف</label>
                    <input style={S.input} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+965 XXXX XXXX" dir="ltr" />
                  </div>
                  <div>
                    <label style={S.label}><Mail size={10} style={{ display: "inline", marginLeft: 4 }} />البريد الإلكتروني</label>
                    <input style={S.input} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="example@gov.kw" dir="ltr" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}><Globe size={10} style={{ display: "inline", marginLeft: 4 }} />الموقع الإلكتروني</label>
                    <input style={S.input} value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="www.example.gov.kw" dir="ltr" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}><MapPin size={10} style={{ display: "inline", marginLeft: 4 }} />العنوان</label>
                    <input style={S.input} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="العنوان" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>ملاحظات</label>
                    <textarea style={{ ...S.input, height: 72, resize: "vertical" as const }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات إضافية" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button type="submit" style={S.saveBtn} disabled={createM.isPending || updateM.isPending}>
                    <Check size={15} />{editId ? "حفظ التعديلات" : "إضافة الجهة"}
                  </button>
                  <button type="button" style={S.cancelBtn} onClick={closeForm}>إلغاء</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
