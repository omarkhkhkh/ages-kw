import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { pricingApi, apiFetch, suppliersApi, contractsApi } from "@/lib/api";
import {
  ArrowRight, Plus, Trash2, Copy, Upload, Download, Printer, CheckCircle2,
  RotateCcw, FilePlus2, ChevronDown, ChevronUp, AlertTriangle, Package,
} from "lucide-react";
import {
  computeItemRow, computeSheetSummary, getProfitTier, getTotalQuantity,
  PROFIT_TIER_ICON, PROFIT_TIER_LABEL, type PricingItemRaw, type PricingSettings,
} from "@/lib/pricing-calc";
import { importPricingItemsFromExcel, exportPricingSheetToExcel } from "@/lib/pricing-excel";
import { printPricingSheet } from "@/lib/print-pricing-sheet";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

function fmt(v: number) { return Number(v || 0).toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }

const SETTINGS_FIELDS: { key: keyof PricingSettings; label: string; integer?: boolean }[] = [
  { key: "containerShippingCost", label: "تكلفة شحن الحاوية (د.ك)" },
  { key: "containerCount", label: "عدد الحاويات", integer: true },
  { key: "unloadingCost", label: "تكلفة التنزيل (د.ك)" },
  { key: "clearanceCost", label: "تكلفة التخليص (د.ك)" },
  { key: "maintenanceCost", label: "تكلفة الصيانة / الخدمات (د.ك)" },
  { key: "bankFees", label: "المصاريف البنكية (د.ك)" },
  { key: "exchangeRate", label: "سعر صرف الدولار (د.ك)" },
  { key: "customsPercent", label: "نسبة الجمرك %" },
  { key: "minProfitPercent", label: "الحد الأدنى لنسبة الربح %" },
  { key: "goodProfitPercent", label: "حد الربح الممتاز %" },
];

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "white", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: GR, marginBottom: 4 };
const cardStyle: React.CSSProperties = { background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px" };
const btn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, border: "1.5px solid #e5dfc8", background: "white", color: GR, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { ...btn, background: `linear-gradient(135deg, #E8BE55, ${GD})`, color: "white", border: "none" };

function EditableCell({ value, onCommit, disabled, width, mono }: { value: string; onCommit: (v: string) => void; disabled?: boolean; width?: number; mono?: boolean }) {
  const [local, setLocal] = useState(value);
  return (
    <input
      value={local}
      disabled={disabled}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onCommit(local); }}
      style={{ width: width ?? 90, boxSizing: "border-box", padding: "5px 7px", borderRadius: 6, border: "1.5px solid #e5e7eb", fontSize: 12, background: disabled ? "#f9fafb" : "white", fontFamily: mono ? "monospace" : "inherit", outline: "none", textAlign: mono ? "left" : "right" }}
    />
  );
}

export default function PricingSheetDetail() {
  const params = useParams();
  const sheetId = Number(params.id);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(true);

  const { data: sheet } = useQuery<any>({ queryKey: ["pricing-sheet", sheetId], queryFn: () => pricingApi.sheets.get(sheetId), enabled: !!sheetId });
  const { data: tenders = [] } = useQuery<any[]>({ queryKey: ["tenders"], queryFn: () => apiFetch("/api/tenders") });
  const { data: practices = [] } = useQuery<any[]>({ queryKey: ["practices"], queryFn: () => apiFetch("/api/practices") });
  const { data: purchaseOrders = [] } = useQuery<any[]>({ queryKey: ["direct-purchase-orders"], queryFn: () => apiFetch("/api/direct-purchase-orders") });
  const { data: suppliers = [] } = useQuery<any[]>({ queryKey: ["suppliers"], queryFn: () => suppliersApi.list() });
  const { data: contracts = [] } = useQuery<any[]>({ queryKey: ["contracts", "all"], queryFn: () => contractsApi.list() });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pricing-sheet", sheetId] });

  const updateSheetMut = useMutation({ mutationFn: (d: any) => pricingApi.sheets.update(sheetId, d), onSuccess: invalidate });
  const duplicateMut = useMutation({ mutationFn: () => pricingApi.sheets.duplicate(sheetId), onSuccess: (copy: any) => navigate(`/pricing/${copy.id}`) });
  const addItemMut = useMutation({ mutationFn: () => pricingApi.items.create(sheetId, { itemName: "صنف جديد", quantity: "1", unitCostUsd: "0", sellPriceUnit: "0" }), onSuccess: invalidate });
  const updateItemMut = useMutation({ mutationFn: ({ id, d }: any) => pricingApi.items.update(id, d), onSuccess: invalidate });
  const deleteItemMut = useMutation({ mutationFn: (id: number) => pricingApi.items.delete(id), onSuccess: invalidate });
  const duplicateItemMut = useMutation({ mutationFn: (id: number) => pricingApi.items.duplicate(id), onSuccess: invalidate });
  const bulkImportMut = useMutation({ mutationFn: (items: any[]) => pricingApi.items.bulkCreate(sheetId, items), onSuccess: invalidate });

  const items: PricingItemRaw[] = sheet?.items ?? [];
  const settings: PricingSettings | null = sheet ? {
    containerShippingCost: sheet.containerShippingCost, containerCount: sheet.containerCount,
    unloadingCost: sheet.unloadingCost, clearanceCost: sheet.clearanceCost,
    maintenanceCost: sheet.maintenanceCost, bankFees: sheet.bankFees,
    exchangeRate: sheet.exchangeRate, customsPercent: sheet.customsPercent,
    minProfitPercent: sheet.minProfitPercent, goodProfitPercent: sheet.goodProfitPercent,
  } : null;

  const totalQty = useMemo(() => getTotalQuantity(items), [items]);
  const summary = useMemo(() => settings ? computeSheetSummary(items, settings) : null, [items, settings]);
  const isApproved = sheet?.status === "approved";

  if (!sheet || !settings) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>جارٍ التحميل...</div>;

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await importPricingItemsFromExcel(file);
      if (parsed.length) bulkImportMut.mutate(parsed);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const lowProfitAlert = summary && summary.avgProfitPercent < Number(settings.minProfitPercent);

  return (
    <div style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/pricing")} style={{ ...btn, padding: "8px 10px" }}><ArrowRight size={15} /></button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 19, fontWeight: 800, color: GR, margin: 0, fontFamily: "monospace" }}>{sheet.sheetNumber}</h1>
              <span style={{ padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: isApproved ? "#dcfce7" : "#f1f5f9", color: isApproved ? "#166534" : "#475569" }}>
                {isApproved ? "معتمد" : "مسودة"}
              </span>
            </div>
            <input
              placeholder="عنوان ورقة التسعير (اختياري)"
              defaultValue={sheet.title ?? ""}
              disabled={isApproved}
              onBlur={e => e.target.value !== (sheet.title ?? "") && updateSheetMut.mutate({ title: e.target.value })}
              style={{ border: "none", outline: "none", fontSize: 12.5, color: "#6b7280", background: "transparent", marginTop: 4, width: 320 }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />
          <button style={btn} onClick={() => fileInputRef.current?.click()} disabled={isApproved}><Upload size={14} /> استيراد Excel</button>
          <button style={btn} onClick={() => exportPricingSheetToExcel(sheet.sheetNumber, items, settings)}><Download size={14} /> تصدير Excel</button>
          <button style={btn} onClick={() => printPricingSheet(sheet.sheetNumber, sheet.title, items, settings)}><Printer size={14} /> طباعة / PDF</button>
          <button style={btn} onClick={() => duplicateMut.mutate()} disabled={duplicateMut.isPending}><FilePlus2 size={14} /> نسخة جديدة</button>
          {isApproved ? (
            <button style={btn} onClick={() => updateSheetMut.mutate({ status: "draft" })}><RotateCcw size={14} /> حفظ كمسودة</button>
          ) : (
            <button style={{ ...btnPrimary }} onClick={() => updateSheetMut.mutate({ status: "approved" })}><CheckCircle2 size={14} /> اعتماد التسعير</button>
          )}
        </div>
      </div>

      {lowProfitAlert && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, background: "#fff1f2", border: "1.5px solid #fecaca", color: "#dc2626", fontSize: 12.5, fontWeight: 700, marginBottom: 16 }}>
          <AlertTriangle size={15} /> متوسط نسبة الربح ({summary!.avgProfitPercent.toFixed(1)}%) أقل من الحد الأدنى المحدد ({Number(settings.minProfitPercent)}%)
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 18 }}>
          {[
            { label: "إجمالي الشحن (د.ك)", value: fmt(summary.totalShipping), color: "#2563eb" },
            { label: "إجمالي التخليص (د.ك)", value: fmt(summary.totalClearance), color: "#7c3aed" },
            { label: "إجمالي الجمرك ($)", value: fmt(summary.totalCustoms), color: "#d97706" },
            { label: "إجمالي المصاريف (د.ك)", value: fmt(summary.totalExpenses), color: "#0891b2" },
            { label: "إجمالي التكلفة (د.ك)", value: fmt(summary.totalCost), color: "#dc2626" },
            { label: "إجمالي المبيعات (د.ك)", value: fmt(summary.totalSales), color: "#16a34a" },
            { label: "إجمالي الربح (د.ك)", value: fmt(summary.totalProfit), color: summary.totalProfit >= 0 ? "#16a34a" : "#dc2626" },
            { label: "متوسط نسبة الربح", value: `${summary.avgProfitPercent.toFixed(1)}%`, color: G },
          ].map(c => (
            <div key={c.label} style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: c.color, direction: "ltr", textAlign: "right" }}>{c.value}</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Settings panel */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setSettingsOpen(o => !o)}>
          <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>الإعدادات العامة</span>
          {settingsOpen ? <ChevronUp size={16} color="#9ca3af" /> : <ChevronDown size={16} color="#9ca3af" />}
        </div>
        {settingsOpen && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginTop: 14 }}>
            {SETTINGS_FIELDS.map(f => (
              <div key={f.key}>
                <label style={lbl}>{f.label}</label>
                <input
                  type="number" step="any" dir="ltr"
                  defaultValue={String(sheet[f.key] ?? "")}
                  disabled={isApproved}
                  style={inp}
                  onBlur={e => {
                    const v = e.target.value;
                    if (v === String(sheet[f.key] ?? "")) return;
                    updateSheetMut.mutate({ [f.key]: f.integer ? Number(v || 0) : v });
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linking */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: GR, marginBottom: 12 }}>الربط بالوحدات</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <label style={lbl}>المناقصة</label>
            <select style={inp} defaultValue={sheet.tenderId ?? ""} disabled={isApproved} onChange={e => updateSheetMut.mutate({ tenderId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">— بدون —</option>
              {tenders.map((t: any) => <option key={t.id} value={t.id}>{t.tenderNumber}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>الممارسة</label>
            <select style={inp} defaultValue={sheet.practiceId ?? ""} disabled={isApproved} onChange={e => updateSheetMut.mutate({ practiceId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">— بدون —</option>
              {practices.map((p: any) => <option key={p.id} value={p.id}>{p.practiceNumber}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>أمر الشراء</label>
            <select style={inp} defaultValue={sheet.purchaseOrderId ?? ""} disabled={isApproved} onChange={e => updateSheetMut.mutate({ purchaseOrderId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">— بدون —</option>
              {purchaseOrders.map((p: any) => <option key={p.id} value={p.id}>{p.orderNumber}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>المورد</label>
            <select style={inp} defaultValue={sheet.supplierId ?? ""} disabled={isApproved} onChange={e => updateSheetMut.mutate({ supplierId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">— بدون —</option>
              {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>العقد</label>
            <select style={inp} defaultValue={sheet.contractId ?? ""} disabled={isApproved} onChange={e => updateSheetMut.mutate({ contractId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">— بدون —</option>
              {contracts.map((c: any) => <option key={c.id} value={c.id}>{c.contractNumber}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Items table */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>جدول الأصناف ({items.length})</span>
          <button style={btnPrimary} onClick={() => addItemMut.mutate()} disabled={isApproved}><Plus size={14} /> إضافة صنف</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead>
              <tr style={{ background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" }}>
                {[
                  "", "رقم البند", "اسم الصنف", "الكمية", "تكلفة الوحدة $", "شحن الوحدة $", "تخليص الوحدة $",
                  "الجمرك $", "إجمالي الوحدة $", "إجمالي الصنف $", "تكلفة الوحدة د.ك", "خدمات/وحدة",
                  "تنزيل/وحدة", "بنك/وحدة", "التكلفة النهائية/وحدة", "إجمالي التكلفة", "سعر البيع",
                  "إجمالي المبيعات", "إجمالي الربح", "نسبة الربح", "",
                ].map((h, i) => <th key={i} style={{ padding: "8px 6px", fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap", textAlign: "right" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={21} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
                  <Package size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                  لا توجد أصناف بعد
                </td></tr>
              ) : items.map((item: any) => {
                const c = computeItemRow(item, settings, totalQty);
                const tier = getProfitTier(c.profitPercent, settings);
                const readOnlyCell = { padding: "6px", background: "#fafafa", color: "#4b5563", whiteSpace: "nowrap" as const, direction: "ltr" as const, textAlign: "right" as const };
                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f5f0e6" }}>
                    <td style={{ padding: "6px", textAlign: "center" }} title={PROFIT_TIER_LABEL[tier]}>{PROFIT_TIER_ICON[tier]}</td>
                    <td style={{ padding: "6px" }}><EditableCell value={item.itemNumber ?? ""} disabled={isApproved} width={70} onCommit={v => updateItemMut.mutate({ id: item.id, d: { itemNumber: v } })} /></td>
                    <td style={{ padding: "6px" }}><EditableCell value={item.itemName ?? ""} disabled={isApproved} width={140} onCommit={v => updateItemMut.mutate({ id: item.id, d: { itemName: v } })} /></td>
                    <td style={{ padding: "6px" }}><EditableCell value={String(item.quantity ?? "0")} disabled={isApproved} width={70} mono onCommit={v => updateItemMut.mutate({ id: item.id, d: { quantity: v } })} /></td>
                    <td style={{ padding: "6px" }}><EditableCell value={String(item.unitCostUsd ?? "0")} disabled={isApproved} width={90} mono onCommit={v => updateItemMut.mutate({ id: item.id, d: { unitCostUsd: v } })} /></td>
                    <td style={readOnlyCell}>{fmt(c.shippingPerUnitUsd)}</td>
                    <td style={readOnlyCell}>{fmt(c.clearancePerUnitUsd)}</td>
                    <td style={readOnlyCell}>{fmt(c.customsValueUsd)}</td>
                    <td style={readOnlyCell}>{fmt(c.totalUnitCostUsd)}</td>
                    <td style={readOnlyCell}>{fmt(c.totalItemCostUsd)}</td>
                    <td style={readOnlyCell}>{fmt(c.unitCostKwd)}</td>
                    <td style={readOnlyCell}>{fmt(c.serviceCostPerUnitKwd)}</td>
                    <td style={readOnlyCell}>{fmt(c.unloadingCostPerUnitKwd)}</td>
                    <td style={readOnlyCell}>{fmt(c.bankFeesPerUnitKwd)}</td>
                    <td style={{ ...readOnlyCell, fontWeight: 700 }}>{fmt(c.finalUnitCost)}</td>
                    <td style={{ ...readOnlyCell, fontWeight: 700 }}>{fmt(c.totalItemCostKwd)}</td>
                    <td style={{ padding: "6px" }}><EditableCell value={String(item.sellPriceUnit ?? "0")} disabled={isApproved} width={90} mono onCommit={v => updateItemMut.mutate({ id: item.id, d: { sellPriceUnit: v } })} /></td>
                    <td style={readOnlyCell}>{fmt(c.totalSales)}</td>
                    <td style={{ ...readOnlyCell, fontWeight: 700, color: c.totalProfit >= 0 ? "#16a34a" : "#dc2626" }}>{fmt(c.totalProfit)}</td>
                    <td style={{ ...readOnlyCell, fontWeight: 700, color: c.totalProfit >= 0 ? "#16a34a" : "#dc2626" }}>{c.profitPercent.toFixed(1)}%</td>
                    <td style={{ padding: "6px" }} onClick={ev => ev.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} disabled={isApproved} onClick={() => duplicateItemMut.mutate(item.id)}><Copy size={13} color={GD} /></button>
                        <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} disabled={isApproved} onClick={() => { if (confirm("حذف الصنف؟")) deleteItemMut.mutate(item.id); }}><Trash2 size={13} color="#dc2626" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
