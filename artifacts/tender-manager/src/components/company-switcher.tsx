import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Pencil, X, Save } from "lucide-react";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(url, { credentials: "include", ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

const S = {
  label: { fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block" } as any,
  input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none", background: "white", boxSizing: "border-box" } as any,
};

/* ── Add/edit company modal ── */
export function CompanyModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: { id: number; name: string; notes: string | null } | null }) {
  const qc = useQueryClient();
  const [name, setName] = useState(editing?.name ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  useEffect(() => { setName(editing?.name ?? ""); setNotes(editing?.notes ?? ""); }, [editing, open]);

  const saveMut = useMutation({
    mutationFn: () => editing
      ? apiFetch(`/api/company-documents/companies/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), notes: notes.trim() || null }) })
      : apiFetch("/api/company-documents/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), notes: notes.trim() || null }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["companies-list"] }); onClose(); },
  });

  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(11,26,16,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{ width: "100%", maxWidth: 420, background: "white", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.3)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", background: `linear-gradient(135deg,${GR},#1a3a20)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Building2 size={16} color={G} />
            <span style={{ fontSize: 14, fontWeight: 800, color: "white" }}>{editing ? "تعديل الشركة" : "إضافة شركة جديدة"}</span>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: "white", display: "flex" }}><X size={15} /></button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={S.label}>اسم الشركة *</label>
            <input autoFocus style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="اسم الشركة" />
          </div>
          <div>
            <label style={S.label}>ملاحظات</label>
            <textarea style={{ ...S.input, height: 60, resize: "vertical" } as any} value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", color: "#374151" }}>إلغاء</button>
            <button onClick={() => name.trim() && saveMut.mutate()} disabled={!name.trim() || saveMut.isPending} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", cursor: "pointer", fontSize: 12.5, fontWeight: 800, fontFamily: "inherit" }}>
              <Save size={13} /> حفظ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Companies chip row ── */
export function CompanyChips({ activeId, onSelect, canEdit, isAdmin, showDocCount = true, hideAddButton = false }: {
  activeId: number | null; onSelect: (id: number) => void; canEdit: boolean; isAdmin: boolean; showDocCount?: boolean; hideAddButton?: boolean;
}) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: number; name: string; notes: string | null } | null>(null);

  const { data: companies = [] } = useQuery<any[]>({ queryKey: ["companies-list"], queryFn: () => apiFetch("/api/company-documents/companies") });

  const delMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/company-documents/companies/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies-list"] }),
  });

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {companies.map((c: any) => (
          <div key={c.id} onClick={() => onSelect(c.id)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12.5, fontWeight: 700, border: `1.5px solid ${activeId === c.id ? GD : "#e5e7eb"}`, background: activeId === c.id ? `linear-gradient(135deg,${G}22,${GD}18)` : "white", color: activeId === c.id ? GD : "#6b7280", transition: "all 0.15s" }}>
            <Building2 size={12} />
            {c.name}
            {showDocCount && c.documentCount !== undefined && (
              <span style={{ fontSize: 10.5, color: activeId === c.id ? GD : "#9ca3af", background: activeId === c.id ? "white" : "#f3f4f6", borderRadius: 10, padding: "1px 6px" }}>{c.documentCount}</span>
            )}
            {canEdit && (
              <span onClick={(e) => { e.stopPropagation(); setEditing({ id: c.id, name: c.name, notes: c.notes }); setModalOpen(true); }} style={{ display: "flex", padding: 2, borderRadius: 5 }}>
                <Pencil size={10} />
              </span>
            )}
            {isAdmin && (
              <span onClick={(e) => { e.stopPropagation(); if (confirm(`حذف شركة "${c.name}"؟`)) delMut.mutate(c.id); }} style={{ display: "flex", padding: 2, borderRadius: 5, color: "#dc2626" }}>
                <X size={11} />
              </span>
            )}
          </div>
        ))}
        {canEdit && !hideAddButton && (
          <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12.5, fontWeight: 700, border: `1.5px dashed ${G}88`, background: "white", color: GD, fontFamily: "inherit" }}>
            <Plus size={12} /> إضافة شركة
          </button>
        )}
      </div>
      <CompanyModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </>
  );
}
