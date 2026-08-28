import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pricingBookApi, type PricingBookItem } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { BookMarked, Plus, Trash2, Search } from "lucide-react";

const G = "#D4A534", GD = "#A87C20", GL = "#E8BE55";
const inp: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };

const EMPTY = { itemCode: "", itemName: "", category: "", unit: "", standardCost: "", standardPrice: "" };

export default function AdminPricingBook({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  // ذاكرة الأسعار: التحرير للمدراء الثلاثة — والقراءة لكل من يفتح غرفة التسعير (المستشار يسعّر منها)
  const canEdit = user?.role === "admin" || ["general_manager", "executive_manager", "financial_manager"].some((k) => (((user as any)?.positions) ?? []).includes(k));

  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY);

  const { data: items = [], isLoading } = useQuery({ queryKey: ["pricing-book", search], queryFn: () => pricingBookApi.list(search.trim() || undefined) });
  const inv = () => qc.invalidateQueries({ queryKey: ["pricing-book"] });

  const createM = useMutation({
    mutationFn: () => pricingBookApi.create({
      itemCode: form.itemCode.trim(), itemName: form.itemName.trim(), category: form.category.trim() || null,
      unit: form.unit.trim() || null, standardCost: form.standardCost || "0", standardPrice: form.standardPrice || "0",
    } as any),
    onSuccess: () => { inv(); setForm(EMPTY); toast({ title: "✅ أُضيف الصنف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const delM = useMutation({ mutationFn: (id: number) => pricingBookApi.delete(id), onSuccess: () => { inv(); toast({ title: "🗑 حُذف الصنف" }); } });

  const fmt = (n: any) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 3 });
  const margin = (it: PricingBookItem) => { const c = Number(it.standardCost), p = Number(it.standardPrice); return p > 0 ? ((p - c) / p) * 100 : 0; };

  return (
    <div style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl", maxWidth: 1000, margin: "0 auto", padding: "8px 4px" }}>
      {!embedded && (
      <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})` }} />
        <BookMarked size={22} color={GD} />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#132a18", margin: 0 }}>دفتر التسعير المرجعي</h1>
      </div>
      </>
      )}
      <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px 14px" }}>
        📖 ذاكرة الأسعار — تتغذى تلقائيًا من كل ورقة تسعير تُعتمد{canEdit ? "، والإضافة اليدوية لك" : "؛ اقرأ منها وسعّر — التحرير للمدراء"}.
      </p>

      {/* Add form — للمدراء الثلاثة */}
      {canEdit && (
      <div style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: GD, marginBottom: 12 }}>إضافة صنف جديد</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr 1.4fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          {([["itemCode", "رمز الصنف *"], ["itemName", "اسم الصنف *"], ["category", "التصنيف"], ["unit", "الوحدة"]] as const).map(([k, label]) => (
            <div key={k}>
              <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>{label}</label>
              <input style={inp} value={(form as any)[k]} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
          {([["standardCost", "التكلفة"], ["standardPrice", "سعر البيع"]] as const).map(([k, label]) => (
            <div key={k}>
              <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>{label}</label>
              <input style={inp} type="number" step="0.001" value={(form as any)[k]} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} placeholder="0" />
            </div>
          ))}
          <button type="button" disabled={!form.itemCode.trim() || !form.itemName.trim() || createM.isPending} onClick={() => createM.mutate()}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 14px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${G}, ${GD})`, color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", height: 38, whiteSpace: "nowrap" }}>
            <Plus size={15} /> إضافة
          </button>
        </div>
      </div>
      )}

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 12, maxWidth: 340 }}>
        <Search size={15} color="#9ca3af" style={{ position: "absolute", right: 10, top: 10 }} />
        <input style={{ ...inp, paddingRight: 32 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالرمز/الاسم/التصنيف…" />
      </div>

      {/* Table */}
      <div style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, overflowX: "auto" }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>جاري التحميل…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>لا توجد أصناف بعد</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "right", minWidth: 720 }}>
            <thead style={{ background: "#faf8f2" }}>
              <tr>{["الرمز", "الاسم", "التصنيف", "الوحدة", "التكلفة", "سعر البيع", "الهامش %", ""].map((h) => (
                <th key={h} style={{ padding: "10px 12px", fontWeight: 800, fontSize: 11, color: "#6b7280", borderBottom: "1.5px solid #f0ead8", whiteSpace: "nowrap" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const m = margin(it);
                return (
                  <tr key={it.id} style={{ borderBottom: "1px solid #f5f0e6" }}>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: GD }}>{it.itemCode}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: "#132a18" }}>{it.itemName}</td>
                    <td style={{ padding: "8px 12px", color: "#6b7280" }}>{it.category || "—"}</td>
                    <td style={{ padding: "8px 12px", color: "#6b7280" }}>{it.unit || "—"}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#dc2626" }}>{fmt(it.standardCost)}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#16a34a" }}>{fmt(it.standardPrice)}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: m < 0 ? "#dc2626" : m < 10 ? "#d97706" : "#166534" }}>{m.toFixed(1)}%</td>
                    <td style={{ padding: "8px 12px" }}>
                      {canEdit && (
                        <button onClick={() => { if (confirm(`حذف الصنف "${it.itemName}"؟`)) delM.mutate(it.id); }} style={{ background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 6, padding: 5, cursor: "pointer", display: "flex" }}>
                          <Trash2 size={13} color="#dc2626" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
