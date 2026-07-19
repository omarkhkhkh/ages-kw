import { useState, useRef } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import {
  ArrowRight, Plus, Trash2, Loader2, Star, Send, Calculator, FileText,
  Trophy, XCircle, Clock, Building, User, Package, Paperclip, History,
  HandHelping, CheckCircle2, AlertTriangle, Mail,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { opportunitiesApi, suppliersApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { OPP_STATUS } from "./index";

const G = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 12, background: "white", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 };
const card: React.CSSProperties = { background: "white", borderRadius: 14, border: "1.5px solid #f0ead8", padding: "16px 18px" };
const fmt = (v: any) => Number(v || 0).toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const LOSS_REASONS: Record<string, string> = {
  price: "السعر", quality: "الجودة", delivery_time: "مدة التوريد", specs: "المواصفات", other: "أخرى",
};

/** الترشيح المرجّح: السعر 50% + المدة 20% + الجودة 20% + الضمان 10% */
function scoreQuotes(quotes: any[]) {
  if (!quotes.length) return new Map<number, number>();
  const prices = quotes.map(q => Number(q.price) || Infinity);
  const minPrice = Math.min(...prices);
  const days = quotes.map(q => q.deliveryDays ?? Infinity);
  const minDays = Math.min(...days);
  const scores = new Map<number, number>();
  for (const q of quotes) {
    const priceScore = Number(q.price) > 0 ? (minPrice / Number(q.price)) : 0;
    const daysScore = q.deliveryDays && isFinite(minDays) ? (minDays / q.deliveryDays) : 0.5;
    const qualityScore = q.qualityRating ? q.qualityRating / 5 : 0.5;
    const warrantyScore = q.warranty?.trim() ? 1 : 0;
    scores.set(q.id, priceScore * 0.5 + daysScore * 0.2 + qualityScore * 0.2 + warrantyScore * 0.1);
  }
  return scores;
}

export default function OpportunityDetail() {
  const params = useParams();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";
  const canPrice = isAdmin || !!(user as any)?.opportunityCanPrice;
  const canApprove = isAdmin || !!(user as any)?.opportunityCanApprove;

  const [tab, setTab] = useState<"items" | "pricing" | "quotation" | "result" | "files" | "history">("items");
  const [newItem, setNewItem] = useState({ itemName: "", specifications: "", quantity: "1", unit: "" });
  const [quoteFormItem, setQuoteFormItem] = useState<number | null>(null);
  const [quoteForm, setQuoteForm] = useState<any>({ supplierId: "", supplierName: "", contactPerson: "", phone: "", whatsapp: "", email: "", price: "", deliveryDays: "", qualityRating: "", warranty: "", notes: "" });
  const [resultForm, setResultForm] = useState<any>({ winnerName: "", winnerPrice: "", lossReason: "price", lossNotes: "" });

  const { data: opp, isLoading } = useQuery<any>({ queryKey: ["opportunity", id], queryFn: () => opportunitiesApi.get(id), enabled: !!id });
  const { data: suppliers = [] } = useQuery<any[]>({ queryKey: ["suppliers"], queryFn: () => suppliersApi.list() });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["opportunity", id] }); qc.invalidateQueries({ queryKey: ["opportunities"] }); qc.invalidateQueries({ queryKey: ["opportunities-stats"] }); };
  const onErr = (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" });

  const updateMut = useMutation({ mutationFn: (d: any) => opportunitiesApi.update(id, d), onSuccess: invalidate, onError: onErr });
  const claimMut = useMutation({ mutationFn: () => opportunitiesApi.claim(id), onSuccess: () => { invalidate(); toast({ title: "✅ استلمت المهمة" }); }, onError: onErr });
  const addItemMut = useMutation({
    mutationFn: () => opportunitiesApi.items.create(id, { ...newItem, quantity: newItem.quantity || "1" }),
    onSuccess: () => { invalidate(); setNewItem({ itemName: "", specifications: "", quantity: "1", unit: "" }); }, onError: onErr,
  });
  const delItemMut = useMutation({ mutationFn: (itemId: number) => opportunitiesApi.items.delete(itemId), onSuccess: invalidate, onError: onErr });
  const addQuoteMut = useMutation({
    mutationFn: (itemId: number) => opportunitiesApi.quotes.create(itemId, quoteForm),
    onSuccess: () => { invalidate(); setQuoteFormItem(null); setQuoteForm({ supplierId: "", supplierName: "", contactPerson: "", phone: "", whatsapp: "", email: "", price: "", deliveryDays: "", qualityRating: "", warranty: "", notes: "" }); },
    onError: onErr,
  });
  const chooseQuoteMut = useMutation({ mutationFn: (quoteId: number) => opportunitiesApi.quotes.choose(quoteId), onSuccess: invalidate, onError: onErr });
  const delQuoteMut = useMutation({ mutationFn: (quoteId: number) => opportunitiesApi.quotes.delete(quoteId), onSuccess: invalidate, onError: onErr });
  const createSheetMut = useMutation({
    mutationFn: () => opportunitiesApi.createPricingSheet(id),
    onSuccess: (s: any) => { invalidate(); toast({ title: `✅ أُنشئت ورقة التسعير ${s.sheetNumber}` }); navigate(`/pricing/${s.id}`); }, onError: onErr,
  });
  const buildQuotationMut = useMutation({
    mutationFn: () => opportunitiesApi.buildQuotation(id),
    onSuccess: (r: any) => { invalidate(); toast({ title: `✅ صدر كتاب عرض السعر ${r.letterNumber}` }); }, onError: onErr,
  });

  // رفع مرفق مع الاحتفاظ باسم الملف الأصلي (لاستخراج نص PDF)
  const pendingFileName = useRef<string>("");
  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (res: { objectPath: string }) => {
      await opportunitiesApi.files.create(id, { fileName: pendingFileName.current || "مرفق", fileUrl: res.objectPath });
      invalidate();
      toast({ title: "✅ رُفع الملف" + (pendingFileName.current.toLowerCase().endsWith(".pdf") ? " واستُخرج نصه إن أمكن" : "") });
    },
    onError: (e: Error) => toast({ title: "فشل الرفع", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !opp) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>جارٍ التحميل...</div>;

  const st = OPP_STATUS[opp.status] ?? OPP_STATUS.new;
  const daysToDeadline = opp.submissionDeadline ? Math.ceil((new Date(opp.submissionDeadline).getTime() - Date.now()) / 86_400_000) : null;
  const isMine = opp.claimedByUserId === user?.id;
  const canWork = isAdmin || isMine;

  /* أزرار الانتقال حسب الحالة والصلاحية */
  const ACTIONS: { show: boolean; label: string; icon: any; color: string; onClick: () => void; disabled?: boolean }[] = [
    { show: opp.status === "new", label: "استلام المهمة", icon: HandHelping, color: "#1d4ed8", onClick: () => claimMut.mutate() },
    { show: opp.status === "researching" && canWork, label: "إنهاء البحث → للتسعير", icon: Send, color: "#d97706", onClick: () => updateMut.mutate({ status: "pending_pricing" }) },
    { show: opp.status === "pending_pricing" && canPrice, label: "اكتمل التسعير", icon: Calculator, color: "#0891b2", onClick: () => updateMut.mutate({ status: "priced" }) },
    { show: opp.status === "priced" && canApprove, label: "اعتماد وإرسال العرض", icon: CheckCircle2, color: "#0d9488", onClick: () => updateMut.mutate({ status: "quotation_sent" }) },
    { show: opp.status === "quotation_sent", label: "تحت الدراسة", icon: Clock, color: "#f59e0b", onClick: () => updateMut.mutate({ status: "under_review" }) },
    { show: ["quotation_sent", "under_review"].includes(opp.status), label: "🎉 رست علينا", icon: Trophy, color: "#16a34a", onClick: () => updateMut.mutate({ status: "won" }) },
  ];

  const TABS = [
    { id: "items", label: "البنود والموردون", icon: Package },
    { id: "pricing", label: "التسعير", icon: Calculator },
    { id: "quotation", label: "كتاب العرض", icon: Mail },
    { id: "result", label: "النتيجة", icon: Trophy },
    { id: "files", label: "المرفقات", icon: Paperclip },
    { id: "history", label: "السجل", icon: History },
  ] as const;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", maxWidth: 1100, margin: "0 auto", paddingBottom: 40 }}>
      {/* HERO */}
      <div style={{ background: `linear-gradient(135deg,${GR} 0%,#1e3a22 65%,#0f2014 100%)`, borderRadius: 18, padding: "22px 26px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => navigate("/opportunities")} style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "7px 9px", cursor: "pointer", display: "flex", flexShrink: 0 }}>
              <ArrowRight size={16} color="white" />
            </button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: G, background: "rgba(212,165,52,0.15)", border: "1px solid rgba(212,165,52,0.3)", padding: "2px 10px", borderRadius: 20 }}>{opp.orderNumber}</span>
                <span style={{ fontSize: 11, fontWeight: 800, background: st.bg, color: st.color, padding: "2px 10px", borderRadius: 20 }}>{st.label}</span>
                {opp.isUrgent && <span style={{ fontSize: 11, fontWeight: 800, background: "#ef4444", color: "white", padding: "2px 10px", borderRadius: 20 }}>⚡ مستعجل</span>}
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: "white", margin: 0, lineHeight: 1.3 }}>{opp.title}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, flexWrap: "wrap", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Building size={12} /> {opp.entityName ?? "جهة غير محددة"}{opp.entityType ? ` (${opp.entityType})` : ""}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><User size={12} /> {opp.claimedByName ?? "لم تُستلم بعد"}</span>
                {daysToDeadline !== null && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700, color: daysToDeadline < 0 ? "#fca5a5" : daysToDeadline <= 3 ? "#fde68a" : "rgba(255,255,255,0.6)" }}>
                    <Clock size={12} /> {daysToDeadline < 0 ? `انتهى التسليم منذ ${Math.abs(daysToDeadline)} يوم` : daysToDeadline === 0 ? "آخر يوم للتسليم!" : `${daysToDeadline} يوم للتسليم`}
                  </span>
                )}
                {opp.bondValue && <span>كفالة: {fmt(opp.bondValue)} د.ك</span>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ACTIONS.filter(a => a.show).map(a => (
              <button key={a.label} onClick={a.onClick} disabled={updateMut.isPending || claimMut.isPending}
                style={{ display: "flex", alignItems: "center", gap: 6, background: a.color, color: "white", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                <a.icon size={14} /> {a.label}
              </button>
            ))}
            {["quotation_sent", "under_review"].includes(opp.status) && (
              <button onClick={() => setTab("result")}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#dc2626", color: "white", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                <XCircle size={14} /> رست على منافس
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", background: "white", borderRadius: 12, padding: 5, gap: 4, marginBottom: 16, border: "1px solid #e2e8f0", overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", background: tab === t.id ? `linear-gradient(135deg,${G},${GD})` : "none", border: "none", borderRadius: 9, fontFamily: "inherit", color: tab === t.id ? GR : "#64748b" }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* ══ البنود والموردون ══ */}
      {tab === "items" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {canWork && (
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 800, color: GR, marginBottom: 10 }}>إضافة بند جديد</div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                <div><label style={lbl}>اسم الصنف *</label><input style={inp} value={newItem.itemName} onChange={e => setNewItem(f => ({ ...f, itemName: e.target.value }))} /></div>
                <div><label style={lbl}>المواصفات</label><input style={inp} value={newItem.specifications} onChange={e => setNewItem(f => ({ ...f, specifications: e.target.value }))} /></div>
                <div><label style={lbl}>الكمية</label><input style={inp} type="number" value={newItem.quantity} onChange={e => setNewItem(f => ({ ...f, quantity: e.target.value }))} dir="ltr" /></div>
                <div><label style={lbl}>الوحدة</label><input style={inp} value={newItem.unit} onChange={e => setNewItem(f => ({ ...f, unit: e.target.value }))} placeholder="قطعة" /></div>
                <button onClick={() => newItem.itemName.trim() && addItemMut.mutate()} disabled={addItemMut.isPending}
                  style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  <Plus size={13} />
                </button>
              </div>
            </div>
          )}

          {(opp.items ?? []).length === 0 && <div style={{ ...card, textAlign: "center", color: "#94a3b8" }}>لا توجد بنود بعد — أضف بنود أمر الشراء ثم عروض الموردين لكل بند</div>}

          {(opp.items ?? []).map((item: any) => {
            const scores = scoreQuotes(item.quotes ?? []);
            const bestId = [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
            return (
              <div key={item.id} style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontWeight: 800, color: GR, fontSize: 14 }}>{item.itemName}</span>
                    <span style={{ color: "#64748b", fontSize: 12, marginRight: 10 }}>الكمية: {Number(item.quantity)}{item.unit ? ` ${item.unit}` : ""}</span>
                    {item.specifications && <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>{item.specifications}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {canWork && (
                      <button onClick={() => { setQuoteFormItem(quoteFormItem === item.id ? null : item.id); }}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1.5px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
                        <Plus size={12} /> عرض مورد
                      </button>
                    )}
                    {canWork && (
                      <button onClick={() => { if (confirm("حذف البند وكل عروضه؟")) delItemMut.mutate(item.id); }}
                        style={{ background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}>
                        <Trash2 size={12} color="#dc2626" />
                      </button>
                    )}
                  </div>
                </div>

                {/* نموذج إضافة عرض مورد */}
                {quoteFormItem === item.id && (
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
                    <div><label style={lbl}>المورد من القائمة</label>
                      <select style={{ ...inp, cursor: "pointer" }} value={quoteForm.supplierId} onChange={e => setQuoteForm((f: any) => ({ ...f, supplierId: e.target.value }))}>
                        <option value="">— أو أدخل يدويًا —</option>
                        {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select></div>
                    <div><label style={lbl}>اسم المورد (يدوي)</label><input style={inp} value={quoteForm.supplierName} onChange={e => setQuoteForm((f: any) => ({ ...f, supplierName: e.target.value }))} /></div>
                    <div><label style={lbl}>الشخص المسؤول</label><input style={inp} value={quoteForm.contactPerson} onChange={e => setQuoteForm((f: any) => ({ ...f, contactPerson: e.target.value }))} /></div>
                    <div><label style={lbl}>الهاتف</label><input style={inp} value={quoteForm.phone} onChange={e => setQuoteForm((f: any) => ({ ...f, phone: e.target.value }))} dir="ltr" /></div>
                    <div><label style={lbl}>واتساب</label><input style={inp} value={quoteForm.whatsapp} onChange={e => setQuoteForm((f: any) => ({ ...f, whatsapp: e.target.value }))} dir="ltr" /></div>
                    <div><label style={lbl}>البريد</label><input style={inp} value={quoteForm.email} onChange={e => setQuoteForm((f: any) => ({ ...f, email: e.target.value }))} dir="ltr" /></div>
                    <div><label style={lbl}>سعر الوحدة (د.ك) *</label><input style={inp} type="number" step="0.001" value={quoteForm.price} onChange={e => setQuoteForm((f: any) => ({ ...f, price: e.target.value }))} dir="ltr" /></div>
                    <div><label style={lbl}>مدة التوريد (يوم)</label><input style={inp} type="number" value={quoteForm.deliveryDays} onChange={e => setQuoteForm((f: any) => ({ ...f, deliveryDays: e.target.value }))} dir="ltr" /></div>
                    <div><label style={lbl}>الجودة (1-5)</label><input style={inp} type="number" min={1} max={5} value={quoteForm.qualityRating} onChange={e => setQuoteForm((f: any) => ({ ...f, qualityRating: e.target.value }))} dir="ltr" /></div>
                    <div><label style={lbl}>الضمان</label><input style={inp} value={quoteForm.warranty} onChange={e => setQuoteForm((f: any) => ({ ...f, warranty: e.target.value }))} placeholder="سنة" /></div>
                    <div style={{ gridColumn: "1/-1", display: "flex", gap: 8 }}>
                      <button onClick={() => addQuoteMut.mutate(item.id)} disabled={addQuoteMut.isPending || (!quoteForm.supplierId && !quoteForm.supplierName.trim()) || !quoteForm.price}
                        style={{ padding: "8px 18px", borderRadius: 9, border: "none", background: "#1d4ed8", color: "white", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                        حفظ العرض
                      </button>
                      <button onClick={() => setQuoteFormItem(null)} style={{ padding: "8px 14px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "white", color: "#64748b", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
                    </div>
                  </div>
                )}

                {/* جدول مقارنة الموردين */}
                {(item.quotes ?? []).length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                      <thead><tr style={{ background: "#f8fafc" }}>
                        {["المورد", "السعر (د.ك)", "المدة", "الجودة", "الضمان", "النقاط", "الأفضل", ""].map(h => (
                          <th key={h} style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {(item.quotes ?? []).map((q: any) => {
                          const isBest = q.id === bestId;
                          return (
                            <tr key={q.id} style={{ borderBottom: "1px solid #f1f5f9", background: q.isChosen ? "#f0fdf4" : isBest ? "#fdf8ec" : "white" }}>
                              <td style={{ padding: "7px 10px", fontWeight: 700, color: GR }}>
                                {q.supplierName}
                                {q.contactPerson && <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>{q.contactPerson}{q.phone ? ` · ${q.phone}` : ""}</div>}
                              </td>
                              <td style={{ padding: "7px 10px", fontFamily: "monospace", fontWeight: 700, direction: "ltr" as const, textAlign: "right" }}>{fmt(q.price)}</td>
                              <td style={{ padding: "7px 10px" }}>{q.deliveryDays ? `${q.deliveryDays} يوم` : "—"}</td>
                              <td style={{ padding: "7px 10px" }}>{q.qualityRating ? "★".repeat(q.qualityRating) : "—"}</td>
                              <td style={{ padding: "7px 10px" }}>{q.warranty || "—"}</td>
                              <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "#64748b" }}>{((scores.get(q.id) ?? 0) * 100).toFixed(0)}%</td>
                              <td style={{ padding: "7px 10px" }}>
                                {q.isChosen ? (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#15803d", fontWeight: 800, fontSize: 11 }}><CheckCircle2 size={13} /> مُختار</span>
                                ) : (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    {isBest && <Star size={13} color={G} fill={G} />}
                                    {canWork && (
                                      <button onClick={() => chooseQuoteMut.mutate(q.id)}
                                        style={{ padding: "3px 10px", borderRadius: 7, border: "1.5px dashed #86efac", background: "white", color: "#15803d", fontWeight: 700, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit" }}>
                                        اختيار
                                      </button>
                                    )}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "7px 10px", width: 30 }}>
                                {canWork && <button onClick={() => delQuoteMut.mutate(q.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Trash2 size={11} color="#dc2626" /></button>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p style={{ fontSize: 10, color: "#b7ac8a", margin: "6px 0 0" }}>⭐ ترشيح النظام (السعر 50% + المدة 20% + الجودة 20% + الضمان 10%) — القرار النهائي بيدك عبر زر «اختيار»</p>
                  </div>
                ) : (
                  <p style={{ fontSize: 11.5, color: "#94a3b8", margin: 0 }}>لا توجد عروض موردين لهذا البند بعد</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ التسعير ══ */}
      {tab === "pricing" && (
        <div style={card}>
          {opp.pricingSheetId ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800, color: GR }}>ورقة التسعير: <span style={{ fontFamily: "monospace", color: GD }}>{opp.pricingSheetNumber}</span></div>
                <p style={{ fontSize: 11.5, color: "#94a3b8", margin: "4px 0 0" }}>وضع مبسّط: سعر المنتج + النقل + الربح — اعتمد أسعار البيع فيها ثم أصدر كتاب العرض</p>
              </div>
              <Link href={`/pricing/${opp.pricingSheetId}`}>
                <a style={{ display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg,${G},${GD})`, color: "white", borderRadius: 10, padding: "9px 18px", fontWeight: 800, fontSize: 12.5, textDecoration: "none" }}>
                  <Calculator size={14} /> فتح ورقة التسعير
                </a>
              </Link>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 20 }}>
              <Calculator size={32} color="#e2d5b0" style={{ margin: "0 auto 10px" }} />
              <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 14px" }}>
                أنشئ ورقة تسعير مبسّطة — بنود الفرصة تُنسخ تلقائيًا وسعر المورد المختار لكل بند يصبح تكلفة الوحدة
              </p>
              <button onClick={() => createSheetMut.mutate()} disabled={createSheetMut.isPending || !(opp.items ?? []).length}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: `linear-gradient(135deg,${G},${GD})`, color: "white", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                {createSheetMut.isPending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />} إنشاء ورقة التسعير
              </button>
              {!(opp.items ?? []).length && <p style={{ fontSize: 11, color: "#dc2626", marginTop: 8 }}>أضف البنود أولًا</p>}
            </div>
          )}
        </div>
      )}

      {/* ══ كتاب العرض ══ */}
      {tab === "quotation" && (
        <div style={card}>
          {opp.quotationLetterId ? (
            <div style={{ textAlign: "center", padding: 16 }}>
              <FileText size={32} color="#16a34a" style={{ margin: "0 auto 10px" }} />
              <div style={{ fontWeight: 800, color: GR, fontSize: 15 }}>كتاب عرض السعر: <span style={{ fontFamily: "monospace", color: GD }}>{opp.quotationLetterNumber}</span></div>
              <p style={{ fontSize: 12, color: "#64748b", margin: "6px 0 14px" }}>
                إجمالي العرض: <b style={{ color: "#15803d" }}>{fmt(opp.ourPrice)} د.ك</b> — افتحه من نظام المراسلات للمراجعة والطباعة/PDF ثم اعتمد الإرسال من أعلى الصفحة
              </p>
              <Link href="/correspondence">
                <a style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg,${G},${GD})`, color: "white", borderRadius: 10, padding: "9px 18px", fontWeight: 800, fontSize: 12.5, textDecoration: "none" }}>
                  <Mail size={14} /> فتح في المراسلات
                </a>
              </Link>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 20 }}>
              <Mail size={32} color="#e2d5b0" style={{ margin: "0 auto 10px" }} />
              <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 6px" }}>
                يُنشئ النظام كتابًا رسميًا بقالب الشركة يتضمن <b>جدول (اسم المنتج / الكمية / السعر الفردي / السعر الإجمالي)</b> من بنود الفرصة وأسعار البيع المعتمدة في ورقة التسعير
              </p>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 14px" }}>يتطلب ورقة تسعير مرتبطة بأسعار بيع معتمدة</p>
              <button onClick={() => buildQuotationMut.mutate()} disabled={buildQuotationMut.isPending || !opp.pricingSheetId}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: opp.pricingSheetId ? `linear-gradient(135deg,${G},${GD})` : "#e5e7eb", color: opp.pricingSheetId ? "white" : "#94a3b8", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 800, fontSize: 13, cursor: opp.pricingSheetId ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                {buildQuotationMut.isPending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <FileText size={14} />} إصدار كتاب عرض السعر
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ النتيجة ══ */}
      {tab === "result" && (
        <div style={card}>
          {opp.status === "won" ? (
            <div style={{ textAlign: "center", padding: 20 }}>
              <Trophy size={40} color="#16a34a" style={{ margin: "0 auto 10px" }} />
              <div style={{ fontWeight: 900, color: "#15803d", fontSize: 18 }}>🎉 رست علينا!</div>
              {opp.ourPrice && <p style={{ color: "#64748b", fontSize: 13 }}>بقيمة {fmt(opp.ourPrice)} د.ك</p>}
            </div>
          ) : opp.status === "lost" ? (
            <div>
              <div style={{ fontWeight: 800, color: "#b91c1c", fontSize: 15, marginBottom: 12 }}>رست على منافس</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, fontSize: 12.5 }}>
                <div><span style={{ color: "#94a3b8" }}>الشركة الفائزة: </span><b>{opp.winnerName ?? "—"}</b></div>
                <div><span style={{ color: "#94a3b8" }}>سعرها: </span><b style={{ direction: "ltr" }}>{opp.winnerPrice ? fmt(opp.winnerPrice) : "—"}</b></div>
                <div><span style={{ color: "#94a3b8" }}>سعرنا: </span><b style={{ direction: "ltr" }}>{opp.ourPrice ? fmt(opp.ourPrice) : "—"}</b></div>
                {opp.winnerPrice && opp.ourPrice && (
                  <div><span style={{ color: "#94a3b8" }}>الفرق: </span>
                    <b style={{ color: Number(opp.ourPrice) > Number(opp.winnerPrice) ? "#dc2626" : "#15803d", direction: "ltr" }}>
                      {fmt(Number(opp.ourPrice) - Number(opp.winnerPrice))} ({((Number(opp.ourPrice) - Number(opp.winnerPrice)) / Number(opp.winnerPrice) * 100).toFixed(1)}%)
                    </b></div>
                )}
                <div><span style={{ color: "#94a3b8" }}>سبب الخسارة: </span><b>{LOSS_REASONS[opp.lossReason] ?? "—"}</b></div>
              </div>
              {opp.lossNotes && <p style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>{opp.lossNotes}</p>}
              <p style={{ fontSize: 10.5, color: "#b7ac8a", marginTop: 10 }}>سُجل المنافس تلقائيًا في قاعدة بيانات المنافسين لتحليلات مستقبلية</p>
            </div>
          ) : ["quotation_sent", "under_review"].includes(opp.status) ? (
            <div>
              <div style={{ fontWeight: 800, color: GR, fontSize: 14, marginBottom: 12 }}>تسجيل نتيجة الترسية على منافس</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
                <div><label style={lbl}>اسم الشركة الفائزة *</label><input style={inp} value={resultForm.winnerName} onChange={e => setResultForm((f: any) => ({ ...f, winnerName: e.target.value }))} /></div>
                <div><label style={lbl}>السعر الفائز (د.ك)</label><input style={inp} type="number" step="0.001" value={resultForm.winnerPrice} onChange={e => setResultForm((f: any) => ({ ...f, winnerPrice: e.target.value }))} dir="ltr" /></div>
                <div><label style={lbl}>سبب الخسارة</label>
                  <select style={{ ...inp, cursor: "pointer" }} value={resultForm.lossReason} onChange={e => setResultForm((f: any) => ({ ...f, lossReason: e.target.value }))}>
                    {Object.entries(LOSS_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select></div>
              </div>
              <div style={{ marginTop: 10 }}><label style={lbl}>تفاصيل إضافية</label><textarea style={{ ...inp, resize: "vertical", minHeight: 55 }} value={resultForm.lossNotes} onChange={e => setResultForm((f: any) => ({ ...f, lossNotes: e.target.value }))} /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  onClick={() => resultForm.winnerName.trim() && updateMut.mutate({ status: "lost", winnerName: resultForm.winnerName, winnerPrice: resultForm.winnerPrice ? String(resultForm.winnerPrice) : null, lossReason: resultForm.lossReason, lossNotes: resultForm.lossNotes || null })}
                  disabled={updateMut.isPending || !resultForm.winnerName.trim()}
                  style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#dc2626", color: "white", fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                  تسجيل الخسارة
                </button>
                <button onClick={() => updateMut.mutate({ status: "cancelled" })} style={{ padding: "9px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "white", color: "#6b7280", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>أُلغي الأمر</button>
                <button onClick={() => updateMut.mutate({ status: "retendered" })} style={{ padding: "9px 16px", borderRadius: 10, border: "1.5px solid #e9d5ff", background: "#faf5ff", color: "#9333ea", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>أُعيد الطرح</button>
              </div>
            </div>
          ) : (
            <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, margin: 0 }}>النتيجة تُسجل بعد إرسال عرض السعر</p>
          )}
        </div>
      )}

      {/* ══ المرفقات ══ */}
      {tab === "files" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {canWork && (
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 800, color: GR, marginBottom: 8 }}>رفع مرفق (صورة الأمر / PDF / Word / Excel)</div>
              <label style={{ display: "block", border: "2px dashed #e2d5b0", borderRadius: 12, padding: 22, textAlign: "center", cursor: isUploading ? "wait" : "pointer", color: "#94a3b8", fontSize: 12.5 }}>
                {isUploading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite", margin: "0 auto" }} /> : "اسحب ملفًا هنا أو انقر للاختيار — ملفات PDF الرقمية يُستخرج نصها تلقائيًا"}
                <input type="file" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" style={{ display: "none" }} disabled={isUploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { pendingFileName.current = f.name; uploadFile(f); } e.target.value = ""; }} />
              </label>
            </div>
          )}
          {(opp.files ?? []).map((f: any) => (
            <div key={f.id} style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <a href={`/api/storage${f.fileUrl}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: "#1d4ed8", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                  <Paperclip size={13} /> {f.fileName}
                </a>
                {canWork && <button onClick={() => { if (confirm("حذف الملف؟")) opportunitiesApi.files.delete(f.id).then(invalidate); }} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={13} color="#dc2626" /></button>}
              </div>
              {f.extractedText != null && (
                <div style={{ marginTop: 8 }}>
                  <label style={lbl}>النص المستخرج (قابل للتعديل)</label>
                  <textarea defaultValue={f.extractedText ?? ""} style={{ ...inp, resize: "vertical", minHeight: 90, fontSize: 11.5, lineHeight: 1.7 }}
                    onBlur={e => { if (e.target.value !== (f.extractedText ?? "")) opportunitiesApi.files.updateText(f.id, e.target.value).then(invalidate); }} />
                </div>
              )}
            </div>
          ))}
          {!(opp.files ?? []).length && <div style={{ ...card, textAlign: "center", color: "#94a3b8" }}>لا توجد مرفقات</div>}
        </div>
      )}

      {/* ══ السجل ══ */}
      {tab === "history" && (
        <div style={card}>
          {(opp.history ?? []).length === 0 ? <p style={{ color: "#94a3b8", textAlign: "center", margin: 0 }}>لا يوجد سجل</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(opp.history ?? []).map((h: any, i: number) => {
                const s = OPP_STATUS[h.stage] ?? { label: h.stage, color: "#64748b", bg: "#f8fafc" };
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", borderRadius: 9, background: "#fafaf8", fontSize: 12 }}>
                    <span><span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 10.5, fontWeight: 800, background: s.bg, color: s.color, marginLeft: 8 }}>{s.label}</span>
                      {h.note ?? ""} {h.changedByName ? `— ${h.changedByName}` : ""}</span>
                    <span style={{ color: "#94a3b8", fontSize: 11, whiteSpace: "nowrap" }}>{new Date(h.changedAt).toLocaleString("ar-KW")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
