import { useMemo, useRef, useState } from "react";
import { Search, Table2, LayoutList } from "lucide-react";
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

const SETTINGS_FIELDS: { key: keyof PricingSettings; label: string; integer?: boolean; sharedOnly?: boolean }[] = [
  { key: "containerShippingCost", label: "تكلفة شحن الحاوية ($)" },
  { key: "containerCount", label: "عدد الحاويات (المشترك)", integer: true, sharedOnly: true },
  { key: "unloadingCost", label: "تكلفة التنزيل (د.ك)" },
  { key: "clearanceCost", label: "تكلفة تخليص الحاوية (د.ك)" },
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
  const [focused, setFocused] = useState(false);
  return (
    <input
      value={local}
      disabled={disabled}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); if (local !== value) onCommit(local); }}
      style={{
        width: width ?? 90, boxSizing: "border-box", padding: "5px 7px", borderRadius: 6,
        border: `1.5px solid ${focused ? G : "#eadfba"}`,
        boxShadow: focused ? `0 0 0 3px ${G}22` : "none",
        fontSize: 12, background: disabled ? "#f9fafb" : "#fffdf5",
        fontFamily: mono ? "monospace" : "inherit", outline: "none",
        textAlign: mono ? "left" : "right", transition: "border-color 0.1s, box-shadow 0.1s",
      }}
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
  const [detailed, setDetailed] = useState(() => localStorage.getItem("pricing-table-view") !== "simple");
  const [itemSearch, setItemSearch] = useState("");
  const toggleView = () => {
    setDetailed(d => { localStorage.setItem("pricing-table-view", d ? "simple" : "detailed"); return !d; });
  };

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
    containerMode: sheet.containerMode ?? "shared",
  } : null;
  const perItemMode = settings?.containerMode === "per_item";

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
            { label: "عدد الحاويات", value: String(summary.totalContainers), color: "#0891b2" },
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
            {/* نظام الحاويات — مشترك لكل البنود أو لكل بند حاوياته الخاصة */}
            <div>
              <label style={lbl}>نظام الحاويات</label>
              <select
                value={sheet.containerMode ?? "shared"}
                disabled={isApproved}
                style={{ ...inp, cursor: "pointer", borderColor: perItemMode ? "#7c3aed" : "#e5e7eb" }}
                onChange={e => updateSheetMut.mutate({ containerMode: e.target.value })}
              >
                <option value="shared">حاويات مشتركة لكل البنود</option>
                <option value="per_item">لكل بند عدد حاوياته</option>
              </select>
            </div>
            {SETTINGS_FIELDS.filter(f => !f.sharedOnly || !perItemMode).map(f => (
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

      {/* Items table — رأس مجمّع + إجماليات + بحث + وضع مبسّط/مفصّل */}
      {(() => {
        const filtered = itemSearch.trim()
          ? items.filter((it: any) =>
              (it.itemName ?? "").includes(itemSearch.trim()) || (it.itemNumber ?? "").includes(itemSearch.trim()))
          : items;
        const computed = filtered.map((item: any) => ({ item, c: computeItemRow(item, settings, totalQty) }));
        const sumQty   = computed.reduce((s, r) => s + Number(r.item.quantity || 0), 0);
        const sumUsd   = computed.reduce((s, r) => s + r.c.totalItemCostUsd, 0);
        const sumKwd   = computed.reduce((s, r) => s + r.c.totalItemCostKwd, 0);
        const sumSales = computed.reduce((s, r) => s + r.c.totalSales, 0);
        const sumProfit = sumSales - sumKwd;
        const sumPct = sumSales > 0 ? (sumProfit / sumSales) * 100 : 0;

        // تعريف الأعمدة بمجموعات ملونة — العمود يظهر إن كان أساسيًا أو الوضع مفصّلاً
        const GROUPS: { label: string; bg: string; fg: string; cols: { h: string; tip?: string; detailedOnly?: boolean }[] }[] = [
          { label: "بيانات الصنف", bg: "#fdf6e3", fg: "#8a6d1a", cols: [
            { h: "" }, { h: "#" }, { h: "رقم البند" }, { h: "اسم الصنف" }, { h: "الكمية" },
            ...(perItemMode ? [{ h: "الحاويات", tip: "عدد حاويات هذا البند — الشحن والتخليص يُحسبان عليه" }] : []),
          ]},
          { label: "تكاليف الاستيراد ($)", bg: "#eff6ff", fg: "#1d4ed8", cols: [
            { h: "تكلفة الوحدة $" },
            { h: "شحن/وحدة", tip: perItemMode ? "شحن الحاوية $ × حاويات البند ÷ كمية البند" : "شحن الحاوية $ × عدد الحاويات ÷ إجمالي الكمية", detailedOnly: true },
            { h: "تخليص/وحدة", tip: perItemMode ? "تخليص الحاوية د.ك × حاويات البند ÷ كمية البند ÷ سعر الصرف" : "تخليص الحاوية د.ك × عدد الحاويات ÷ إجمالي الكمية ÷ سعر الصرف", detailedOnly: true },
            { h: "جمرك", tip: "تكلفة الوحدة $ × نسبة الجمرك", detailedOnly: true },
            { h: "إجمالي الوحدة $", tip: "التكلفة + الشحن + التخليص + الجمرك", detailedOnly: true },
            { h: "إجمالي الصنف $", detailedOnly: true },
          ]},
          { label: "التكاليف المحلية (د.ك)", bg: "#f5f3ff", fg: "#6d28d9", cols: [
            { h: "تكلفة الوحدة د.ك", tip: "إجمالي الوحدة $ × سعر الصرف", detailedOnly: true },
            { h: "خدمات/وحدة", tip: "تكلفة الخدمات ÷ إجمالي الكمية", detailedOnly: true },
            { h: "تنزيل/وحدة", detailedOnly: true },
            { h: "بنك/وحدة", detailedOnly: true },
            { h: "النهائية/وحدة", tip: "تكلفة د.ك + الخدمات + التنزيل + البنك" },
            { h: "إجمالي التكلفة", tip: "التكلفة النهائية × الكمية" },
          ]},
          { label: "البيع والربح (د.ك)", bg: "#f0fdf4", fg: "#15803d", cols: [
            { h: "سعر البيع" }, { h: "المبيعات" }, { h: "الربح" }, { h: "النسبة %" },
          ]},
          { label: "", bg: "transparent", fg: "#6b7280", cols: [{ h: "" }] },
        ];
        const visibleCols = (g: typeof GROUPS[number]) => g.cols.filter(col => detailed || !col.detailedOnly);
        const totalColCount = GROUPS.reduce((s, g) => s + visibleCols(g).length, 0);

        const roCell: React.CSSProperties = { padding: "7px 8px", color: "#4b5563", whiteSpace: "nowrap", direction: "ltr", textAlign: "right", fontFamily: "monospace", fontSize: 11.5 };
        const pill = (pct: number, tier: string) => (
          <span style={{
            display: "inline-block", padding: "2px 10px", borderRadius: 999, fontWeight: 800, fontSize: 11, direction: "ltr",
            background: tier === "excellent" ? "#dcfce7" : tier === "medium" ? "#fef9c3" : "#fee2e2",
            color: tier === "excellent" ? "#15803d" : tier === "medium" ? "#a16207" : "#b91c1c",
          }}>{pct.toFixed(1)}%</span>
        );

        return (
          <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "14px 20px", borderBottom: "1.5px solid #f0ead8" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>
                جدول الأصناف <span style={{ color: "#9ca3af", fontWeight: 600 }}>({filtered.length}{itemSearch ? ` من ${items.length}` : ""})</span>
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fafaf8", border: "1.5px solid #e5dfc8", borderRadius: 9, padding: "6px 10px" }}>
                  <Search size={13} color="#9ca3af" />
                  <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="بحث باسم/رقم الصنف"
                    style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, width: 130 }} />
                </div>
                <button style={btn} onClick={toggleView} title={detailed ? "إخفاء أعمدة التوزيع التفصيلية" : "إظهار كل أعمدة الحساب"}>
                  {detailed ? <LayoutList size={14} /> : <Table2 size={14} />} {detailed ? "عرض مبسّط" : "عرض مفصّل"}
                </button>
                <button style={btnPrimary} onClick={() => addItemMut.mutate()} disabled={isApproved}><Plus size={14} /> إضافة صنف</button>
              </div>
            </div>
            <div style={{ overflow: "auto", maxHeight: "62vh" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11.5 }}>
                <thead>
                  {/* صف المجموعات */}
                  <tr>
                    {GROUPS.map((g, gi) => {
                      const span = visibleCols(g).length;
                      if (!span) return null;
                      return (
                        <th key={gi} colSpan={span} style={{
                          position: "sticky", top: 0, zIndex: 3, background: g.bg, color: g.fg,
                          padding: "6px 8px", fontSize: 10.5, fontWeight: 800, whiteSpace: "nowrap",
                          borderBottom: `2px solid ${g.fg}22`, textAlign: "center",
                        }}>{g.label}</th>
                      );
                    })}
                  </tr>
                  {/* صف العناوين */}
                  <tr>
                    {GROUPS.flatMap((g, gi) => visibleCols(g).map((col, ci) => (
                      <th key={`${gi}-${ci}`} title={col.tip} style={{
                        position: "sticky", top: 29, zIndex: 3, background: "#f9f6ee",
                        padding: "8px 8px", fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap",
                        textAlign: "right", borderBottom: "1.5px solid #f0ead8",
                        cursor: col.tip ? "help" : "default",
                        textDecoration: col.tip ? "underline dotted #d1c9a8" : "none", textUnderlineOffset: 3,
                      }}>{col.h}</th>
                    )))}
                  </tr>
                </thead>
                <tbody>
                  {computed.length === 0 ? (
                    <tr><td colSpan={totalColCount} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
                      <Package size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                      {itemSearch ? "لا توجد أصناف مطابقة للبحث" : "لا توجد أصناف بعد"}
                    </td></tr>
                  ) : computed.map(({ item, c }: any, idx: number) => {
                    const tier = getProfitTier(c.profitPercent, settings);
                    const zebra = idx % 2 === 1 ? "#fdfcf7" : "white";
                    const ro = { ...roCell, background: zebra };
                    return (
                      <tr key={item.id}
                        style={{ borderBottom: "1px solid #f5f0e6", background: zebra }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#fdf8ec")}
                        onMouseLeave={e => (e.currentTarget.style.background = zebra)}
                      >
                        <td style={{ padding: "6px", textAlign: "center", background: "inherit" }} title={PROFIT_TIER_LABEL[tier]}>{PROFIT_TIER_ICON[tier]}</td>
                        <td style={{ padding: "6px 8px", color: "#b7ac8a", fontWeight: 700, fontFamily: "monospace", background: "inherit" }}>{idx + 1}</td>
                        <td style={{ padding: "6px", background: "inherit" }}><EditableCell value={item.itemNumber ?? ""} disabled={isApproved} width={70} onCommit={v => updateItemMut.mutate({ id: item.id, d: { itemNumber: v } })} /></td>
                        <td style={{ padding: "6px", background: "inherit" }}><EditableCell value={item.itemName ?? ""} disabled={isApproved} width={150} onCommit={v => updateItemMut.mutate({ id: item.id, d: { itemName: v } })} /></td>
                        <td style={{ padding: "6px", background: "inherit" }}><EditableCell value={String(item.quantity ?? "0")} disabled={isApproved} width={65} mono onCommit={v => updateItemMut.mutate({ id: item.id, d: { quantity: v } })} /></td>
                        {perItemMode && <td style={{ padding: "6px", background: "inherit" }}><EditableCell value={String((item as any).containers ?? "0")} disabled={isApproved} width={60} mono onCommit={v => updateItemMut.mutate({ id: item.id, d: { containers: v } })} /></td>}
                        <td style={{ padding: "6px", background: "inherit" }}><EditableCell value={String(item.unitCostUsd ?? "0")} disabled={isApproved} width={85} mono onCommit={v => updateItemMut.mutate({ id: item.id, d: { unitCostUsd: v } })} /></td>
                        {detailed && <td style={ro}>{fmt(c.shippingPerUnitUsd)}</td>}
                        {detailed && <td style={ro}>{fmt(c.clearancePerUnitUsd)}</td>}
                        {detailed && <td style={ro}>{fmt(c.customsValueUsd)}</td>}
                        {detailed && <td style={ro}>{fmt(c.totalUnitCostUsd)}</td>}
                        {detailed && <td style={ro}>{fmt(c.totalItemCostUsd)}</td>}
                        {detailed && <td style={ro}>{fmt(c.unitCostKwd)}</td>}
                        {detailed && <td style={ro}>{fmt(c.serviceCostPerUnitKwd)}</td>}
                        {detailed && <td style={ro}>{fmt(c.unloadingCostPerUnitKwd)}</td>}
                        {detailed && <td style={ro}>{fmt(c.bankFeesPerUnitKwd)}</td>}
                        <td style={{ ...ro, fontWeight: 700, color: "#6d28d9" }}>{fmt(c.finalUnitCost)}</td>
                        <td style={{ ...ro, fontWeight: 700, color: "#6d28d9" }}>{fmt(c.totalItemCostKwd)}</td>
                        <td style={{ padding: "6px", background: "inherit" }}><EditableCell value={String(item.sellPriceUnit ?? "0")} disabled={isApproved} width={85} mono onCommit={v => updateItemMut.mutate({ id: item.id, d: { sellPriceUnit: v } })} /></td>
                        <td style={ro}>{fmt(c.totalSales)}</td>
                        <td style={{ ...ro, fontWeight: 800, color: c.totalProfit >= 0 ? "#16a34a" : "#dc2626" }}>{fmt(c.totalProfit)}</td>
                        <td style={{ padding: "6px 8px", background: "inherit", whiteSpace: "nowrap" }}>{pill(c.profitPercent, tier)}</td>
                        <td style={{ padding: "6px", background: "inherit" }} onClick={ev => ev.stopPropagation()}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button title="نسخ الصنف" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} disabled={isApproved} onClick={() => duplicateItemMut.mutate(item.id)}><Copy size={13} color={GD} /></button>
                            <button title="حذف الصنف" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} disabled={isApproved} onClick={() => { if (confirm("حذف الصنف؟")) deleteItemMut.mutate(item.id); }}><Trash2 size={13} color="#dc2626" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {computed.length > 0 && (
                  <tfoot>
                    <tr>
                      {/* الإجماليات — تلتصق بأسفل الجدول */}
                      <td colSpan={4} style={{ position: "sticky", bottom: 0, background: GR, color: "white", padding: "10px 12px", fontWeight: 800, fontSize: 12 }}>
                        الإجمالي {itemSearch ? "(المعروض)" : ""}
                      </td>
                      <td style={{ position: "sticky", bottom: 0, background: GR, color: "#E8BE55", padding: "10px 8px", fontWeight: 800, direction: "ltr", textAlign: "right", fontFamily: "monospace" }}>{sumQty.toLocaleString()}</td>
                      {perItemMode && <td style={{ position: "sticky", bottom: 0, background: GR, color: "#E8BE55", padding: "10px 8px", fontWeight: 800, direction: "ltr", textAlign: "right", fontFamily: "monospace" }}>{computed.reduce((s, r) => s + Number((r.item as any).containers || 0), 0).toLocaleString()}</td>}
                      <td style={{ position: "sticky", bottom: 0, background: GR }} />
                      {detailed && <td colSpan={4} style={{ position: "sticky", bottom: 0, background: GR }} />}
                      {detailed && <td style={{ position: "sticky", bottom: 0, background: GR, color: "#93c5fd", padding: "10px 8px", fontWeight: 800, direction: "ltr", textAlign: "right", fontFamily: "monospace" }}>{fmt(sumUsd)}</td>}
                      {detailed && <td colSpan={4} style={{ position: "sticky", bottom: 0, background: GR }} />}
                      <td style={{ position: "sticky", bottom: 0, background: GR }} />
                      <td style={{ position: "sticky", bottom: 0, background: GR, color: "#c4b5fd", padding: "10px 8px", fontWeight: 800, direction: "ltr", textAlign: "right", fontFamily: "monospace" }}>{fmt(sumKwd)}</td>
                      <td style={{ position: "sticky", bottom: 0, background: GR }} />
                      <td style={{ position: "sticky", bottom: 0, background: GR, color: "#86efac", padding: "10px 8px", fontWeight: 800, direction: "ltr", textAlign: "right", fontFamily: "monospace" }}>{fmt(sumSales)}</td>
                      <td style={{ position: "sticky", bottom: 0, background: GR, color: sumProfit >= 0 ? "#86efac" : "#fca5a5", padding: "10px 8px", fontWeight: 800, direction: "ltr", textAlign: "right", fontFamily: "monospace" }}>{fmt(sumProfit)}</td>
                      <td style={{ position: "sticky", bottom: 0, background: GR, padding: "10px 8px", whiteSpace: "nowrap" }}>{pill(sumPct, getProfitTier(sumPct, settings))}</td>
                      <td style={{ position: "sticky", bottom: 0, background: GR }} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
