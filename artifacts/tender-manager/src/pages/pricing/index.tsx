import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { pricingApi } from "@/lib/api";
import { Calculator, Plus, Search, X, FileSignature, ClipboardList, ShoppingCart, Users, Landmark, Trash2 } from "lucide-react";

const G  = "#D4A534";
const GL = "#E8BE55";
const GD = "#A87C20";

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  draft:    { label: "مسودة",  bg: "#f1f5f9", text: "#475569" },
  approved: { label: "معتمد", bg: "#dcfce7", text: "#166534" },
};

const LINK_ICONS: { key: string; label: string; icon: any }[] = [
  { key: "tenderNumber", label: "مناقصة", icon: FileSignature },
  { key: "practiceNumber", label: "ممارسة", icon: ClipboardList },
  { key: "purchaseOrderNumber", label: "أمر شراء", icon: ShoppingCart },
  { key: "supplierName", label: "مورد", icon: Users },
  { key: "contractNumber", label: "عقد", icon: Landmark },
];

const S = {
  page: { fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl" as const },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 },
  accentBar: { width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})`, flexShrink: 0 },
  titleRow: { display: "flex", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontWeight: 800, color: "#132a18", margin: 0 },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  btnPrimary: { display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg, ${GL}, ${GD})`, color: "white", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: `0 4px 14px ${G}44` },
  searchBar: { display: "flex", alignItems: "center", gap: 10, background: "white", border: "1.5px solid #e5dfc8", borderRadius: 12, padding: "8px 14px", width: 280 },
  tableCard: { background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", overflow: "hidden" },
  thead: { background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" },
  th: { padding: "14px 18px", fontWeight: 700, color: "#4a3f1a", fontSize: 12, whiteSpace: "nowrap" as const, textAlign: "right" as const },
  td: { padding: "13px 18px", fontSize: 13, textAlign: "right" as const, verticalAlign: "middle" as const },
  iconBtn: { background: "transparent", border: "none", cursor: "pointer", padding: "6px 8px", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" },
};

export default function PricingList() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ["pricing-sheets", status, search],
    queryFn: () => pricingApi.sheets.list({ status: status !== "all" ? status : undefined, search: search || undefined }),
  });

  const createM = useMutation({
    mutationFn: () => pricingApi.sheets.create({ sheetNumber: `TSA-${Date.now().toString().slice(-6)}` }),
    onSuccess: (sheet: any) => { qc.invalidateQueries({ queryKey: ["pricing-sheets"] }); navigate(`/pricing/${sheet.id}`); },
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => pricingApi.sheets.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing-sheets"] }),
  });

  const tabs = [{ id: "all", label: "الجميع" }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ id: k, label: v.label }))];

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.titleRow}>
            <div style={S.accentBar} />
            <h1 style={S.title}>التسعير</h1>
          </div>
          <p style={S.subtitle}>حاسبة تسعير احترافية بديلة لملف Excel — شحن، تخليص، جمرك، وتوزيع مصاريف تلقائي</p>
        </div>
        <button style={S.btnPrimary} onClick={() => createM.mutate()} disabled={createM.isPending}>
          <Plus size={15} /> تسعير جديد
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" as const, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "white", border: "1.5px solid #f0ead8", borderRadius: 12, padding: "5px 6px" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setStatus(t.id)} style={{ padding: "6px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", transition: "all 0.15s", background: status === t.id ? `linear-gradient(135deg, ${GL}55, ${GD}44)` : "transparent", color: status === t.id ? GD : "#6b7280" }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={S.searchBar}>
          <Search size={15} color="#9ca3af" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الورقة أو العنوان..." style={{ border: "none", outline: "none", fontSize: 13, color: "#1e2a1e", background: "transparent", flex: 1 }} />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={13} /></button>}
        </div>
      </div>

      <div style={S.tableCard}>
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 13, textAlign: "right" as const }}>
            <thead style={S.thead}>
              <tr>
                {["رقم الورقة", "العنوان", "مرتبطة بـ", "عدد الأصناف", "الحالة", "تاريخ الإنشاء", ""].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? [...Array(3)].map((_, i) => (
                <tr key={i}>{[...Array(7)].map((_, j) => <td key={j} style={S.td}><div style={{ height: 14, background: "#f3f0e6", borderRadius: 4, width: 80, animation: "pulse 1.5s infinite" }} /></td>)}</tr>
              )) : (sheets as any[]).length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 48, textAlign: "center" as const, color: "#94a3b8" }}>
                  <Calculator size={40} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
                  <p style={{ margin: 0 }}>لا توجد أوراق تسعير</p>
                </td></tr>
              ) : (sheets as any[]).map((s: any, idx: number) => {
                const st = STATUS_MAP[s.status] || STATUS_MAP.draft;
                const links = LINK_ICONS.filter(l => s[l.key]);
                return (
                  <tr key={s.id} onClick={() => navigate(`/pricing/${s.id}`)} style={{ borderBottom: idx < (sheets as any[]).length - 1 ? "1px solid #f5f0e6" : "none", background: "white", transition: "background 0.1s", cursor: "pointer" }}
                    onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = "#fffdf5"}
                    onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "white"}
                  >
                    <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700, color: GD }}>{s.sheetNumber}</td>
                    <td style={{ ...S.td, color: "#132a18" }}>{s.title || "—"}</td>
                    <td style={S.td}>
                      {links.length === 0 ? <span style={{ color: "#9ca3af" }}>—</span> : (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                          {links.map(l => (
                            <span key={l.key} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: `${G}15`, color: GD }}>
                              <l.icon size={10} />{s[l.key]}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ ...S.td, fontFamily: "monospace" }}>{s.itemCount}</td>
                    <td style={S.td}>
                      <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.text }}>{st.label}</span>
                    </td>
                    <td style={{ ...S.td, color: "#6b7280", fontSize: 12 }}>{new Date(s.createdAt).toLocaleDateString("ar-KW")}</td>
                    <td style={{ ...S.td, textAlign: "left" as const }} onClick={ev => ev.stopPropagation()}>
                      <button style={S.iconBtn} onClick={() => { if (confirm("حذف ورقة التسعير؟")) deleteM.mutate(s.id); }}
                        onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = "#fee2e2"}
                        onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}>
                        <Trash2 size={14} color="#dc2626" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
