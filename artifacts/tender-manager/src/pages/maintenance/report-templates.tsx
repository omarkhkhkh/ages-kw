import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEditor, EditorContent } from "@tiptap/react";
import { maintenanceApi, contractsApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import FileUpload from "@/components/file-upload";
import { tiptapExtensions, FONT_FAMILIES, FONT_SIZES } from "@/lib/tiptap-extensions";
import {
  ArrowRight, FileText, Trash2, Star, Save, Upload, PenSquare, X, Settings,
  Search, Download, MapPin, Wrench, FileBox, ChevronDown,
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, AlignRight, AlignCenter,
} from "lucide-react";

const G = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: GR, marginBottom: 5 };
const cardStyle: React.CSSProperties = { background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px" };

const REPORT_TYPES: Record<string, string> = {
  visit_report: "تقرير زيارة صيانة",
  inspection_report: "تقرير فحص",
  installation_report: "تقرير تركيب",
};

const TOKENS = [
  "{{ReportNumber}}", "{{Date}}", "{{EquipmentName}}", "{{AssetNumber}}", "{{SerialNumber}}", "{{Model}}",
  "{{Location}}", "{{Customer}}", "{{Technician}}", "{{Supervisor}}", "{{MaintenanceType}}",
  "{{WorkDetails}}", "{{Recommendations}}", "{{PartsUsed}}", "{{TotalCost}}",
];

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

const emptyForm = { name: "", reportType: "visit_report", fileUrl: null as string | null, isDefault: false };

const toolbarBtn = (active: boolean, onClick: () => void, icon: React.ReactNode, title: string) => (
  <button
    type="button" title={title} onClick={onClick}
    style={{
      display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6,
      border: `1px solid ${active ? G : "#e5e7eb"}`, background: active ? "#fdf8ec" : "white", color: active ? GD : "#6b7280",
      cursor: "pointer",
    }}
  >
    {icon}
  </button>
);

/* ═══════════════════════════════════════════════════════
   TEMPLATE MANAGEMENT MODAL (رفع/تصميم/حذف القوالب)
═══════════════════════════════════════════════════════ */
function TemplatesModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"upload" | "compose">("upload");
  const [form, setForm] = useState({ ...emptyForm });
  const editor = useEditor({ extensions: tiptapExtensions, content: EMPTY_DOC });

  const { data: templates = [], isLoading } = useQuery<any[]>({ queryKey: ["maintenance-report-templates"], queryFn: () => maintenanceApi.reportTemplates.list() });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const createMut = useMutation({
    mutationFn: (d: any) => maintenanceApi.reportTemplates.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance-report-templates"] });
      setForm({ ...emptyForm });
      editor?.commands.setContent(EMPTY_DOC);
    },
  });
  const deleteMut = useMutation({ mutationFn: (id: number) => maintenanceApi.reportTemplates.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-report-templates"] }) });

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (mode === "upload") {
      if (!form.fileUrl) return;
      createMut.mutate({ name: form.name, reportType: form.reportType, fileUrl: form.fileUrl, isDefault: form.isDefault });
    } else {
      if (!editor || editor.isEmpty) return;
      createMut.mutate({ name: form.name, reportType: form.reportType, bodyJson: JSON.stringify(editor.getJSON()), isDefault: form.isDefault });
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(19,42,24,0.45)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fdfbf6", borderRadius: 18, width: "100%", maxWidth: 960, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: GR, margin: 0 }}>إدارة قوالب التقارير</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><X size={18} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>قالب جديد</div>

            <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "#f9f6ee", borderRadius: 10, padding: 4 }}>
              <button type="button" onClick={() => setMode("upload")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, background: mode === "upload" ? "white" : "transparent", color: mode === "upload" ? GD : "#6b7280", boxShadow: mode === "upload" ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
                <Upload size={13} /> رفع ملف Word
              </button>
              <button type="button" onClick={() => setMode("compose")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, background: mode === "compose" ? "white" : "transparent", color: mode === "compose" ? GD : "#6b7280", boxShadow: mode === "compose" ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
                <PenSquare size={13} /> تصميم داخل الموقع
              </button>
            </div>

            <div style={{ marginBottom: 12 }}><label style={lbl}>اسم القالب *</label><input value={form.name} onChange={(e) => set("name", e.target.value)} style={inp} /></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>نوع التقرير</label><select value={form.reportType} onChange={(e) => set("reportType", e.target.value)} style={inp}>{Object.entries(REPORT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>

            {mode === "upload" ? (
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>ملف القالب (Word .docx) *</label>
                <FileUpload objectPath={form.fileUrl} onChange={(p) => set("fileUrl", p)} accept=".doc,.docx" label="رفع ملف Word" />
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "6px 0 0" }}>يجب أن يحتوي الملف على حقول {"{{Token}}"} من القائمة أدناه.</p>
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                  <label style={lbl}>محتوى القالب *</label>
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) editor?.chain().focus().insertReportToken(e.target.value).run(); }}
                    style={{ ...inp, width: "auto", height: 30, padding: "2px 8px", fontSize: 11.5 }}
                    title="إدراج حقل دمج"
                  >
                    <option value="">+ إدراج حقل</option>
                    {TOKENS.map((t) => {
                      const name = t.replace(/[{}]/g, "");
                      return <option key={name} value={name}>{name}</option>;
                    })}
                  </select>
                </div>
                {editor && (
                  <div style={{ display: "flex", gap: 6, padding: "6px 8px", border: "1px solid #e5e7eb", borderBottom: "none", borderRadius: "10px 10px 0 0", background: "#fafafa", flexWrap: "wrap" as const }}>
                    {toolbarBtn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <Bold size={13} />, "غامق")}
                    {toolbarBtn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <Italic size={13} />, "مائل")}
                    {toolbarBtn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon size={13} />, "تحته خط")}
                    <div style={{ width: 1, background: "#e5e7eb", margin: "2px 4px" }} />
                    <select
                      title="نوع الخط"
                      value={editor.getAttributes("textStyle").fontFamily ?? ""}
                      onChange={(e) => { const v = e.target.value; if (v) editor.chain().focus().setFontFamily(v).run(); else editor.chain().focus().unsetFontFamily().run(); }}
                      style={{ height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontSize: 11, padding: "0 4px", cursor: "pointer" }}
                    >
                      {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
                    </select>
                    <select
                      title="حجم الخط"
                      value={editor.getAttributes("textStyle").fontSize ?? ""}
                      onChange={(e) => { const v = e.target.value; if (v) editor.chain().focus().setFontSize(v).run(); else editor.chain().focus().unsetFontSize().run(); }}
                      style={{ height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontSize: 11, padding: "0 4px", cursor: "pointer" }}
                    >
                      <option value="">الحجم الافتراضي</option>
                      {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div style={{ width: 1, background: "#e5e7eb", margin: "2px 4px" }} />
                    {toolbarBtn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), <List size={13} />, "قائمة نقطية")}
                    {toolbarBtn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={13} />, "قائمة مرقمة")}
                    <div style={{ width: 1, background: "#e5e7eb", margin: "2px 4px" }} />
                    {toolbarBtn(editor.isActive({ textAlign: "right" }), () => editor.chain().focus().setTextAlign("right").run(), <AlignRight size={13} />, "محاذاة يمين")}
                    {toolbarBtn(editor.isActive({ textAlign: "center" }), () => editor.chain().focus().setTextAlign("center").run(), <AlignCenter size={13} />, "توسيط")}
                  </div>
                )}
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "0 0 10px 10px", padding: "12px 14px", minHeight: 200, background: "#fdfbf6" }}>
                  <EditorContent editor={editor} />
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <input type="checkbox" checked={form.isDefault} onChange={(e) => set("isDefault", e.target.checked)} id="isDefault" />
              <label htmlFor="isDefault" style={{ fontSize: 12, color: GR, fontWeight: 700, cursor: "pointer" }}>اجعله القالب الافتراضي</label>
            </div>
            <button onClick={handleSave} disabled={createMut.isPending} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", width: "100%", borderRadius: 10, background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <Save size={14} /> {createMut.isPending ? "جارٍ الحفظ..." : "حفظ القالب"}
            </button>

            {mode === "upload" && (
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #f0ead8" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>الحقول المتاحة داخل القالب</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TOKENS.map((t) => (
                    <span key={t} style={{ padding: "3px 8px", borderRadius: 6, background: "#f9f6ee", border: "1px solid #f0ead8", fontSize: 11, fontFamily: "monospace", color: GD }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>القوالب الموجودة ({templates.length})</div>
            {isLoading ? (
              <div style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>جارِ التحميل...</div>
            ) : templates.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center" }}>
                <FileText size={32} color="#e2d5b0" style={{ margin: "0 auto 8px", display: "block" }} />
                <p style={{ color: "#94a3b8", fontSize: 12.5, margin: 0 }}>لا توجد قوالب مرفوعة بعد</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {templates.map((t: any) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "#fafaf8", border: "1px solid #f0ead8" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span title={t.bodyJson ? "مُصمَّم داخل الموقع" : "ملف مرفوع"}>{t.bodyJson ? <PenSquare size={12} color={GD} /> : <Upload size={12} color={GD} />}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: GR }}>{t.name}</span>
                        {t.isDefault && <Star size={12} color={G} fill={G} />}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{REPORT_TYPES[t.reportType] ?? t.reportType}</div>
                    </div>
                    <button onClick={() => { if (confirm(`حذف قالب ${t.name}؟`)) deleteMut.mutate(t.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE — سجل تقارير الصيانة الصادرة
═══════════════════════════════════════════════════════ */
export default function MaintenanceReportTemplates() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [search, setSearch] = useState("");
  const [contractId, setContractId] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: ["maintenance-reports", search, contractId, equipmentType, dateFrom, dateTo],
    queryFn: () => maintenanceApi.reports.list({
      search: search || undefined,
      contractId: contractId ? Number(contractId) : undefined,
      equipmentType: equipmentType || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
  });

  const { data: contracts = [] } = useQuery<any[]>({ queryKey: ["contracts", "all"], queryFn: () => contractsApi.list() });
  const { data: equipment = [] } = useQuery<any[]>({ queryKey: ["maintenance-equipment", "all"], queryFn: () => maintenanceApi.equipment.list() });
  const equipmentTypes = Array.from(new Set(equipment.map((e: any) => e.category).filter(Boolean))) as string[];

  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const handleDownload = async (r: any) => {
    setDownloadingId(r.id);
    try { await maintenanceApi.reports.download(r.id, r.reportNumber); } finally { setDownloadingId(null); }
  };

  const clearFilters = () => { setSearch(""); setContractId(""); setEquipmentType(""); setDateFrom(""); setDateTo(""); };
  const hasFilters = !!(search || contractId || equipmentType || dateFrom || dateTo);

  // الموظفون بصلاحية الصيانة يرون سجل التقارير ويحمّلونها؛ إدارة القوالب تبقى للمدير فقط
  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      {showTemplatesModal && <TemplatesModal onClose={() => setShowTemplatesModal(false)} />}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <button onClick={() => navigate("/maintenance")} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: 0, marginBottom: 8 }}>
            <ArrowRight size={13} /> إدارة الصيانة
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: GR, margin: 0 }}>تقارير الصيانة ({reports.length})</h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>سجل كل تقارير الزيارة الصادرة، مرتبطة بالجهاز والعقد/أمر الصيانة — تصدر من داخل أمر الصيانة نفسه.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowTemplatesModal(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "white", border: "1.5px solid #e5e7eb", color: GR, fontFamily: "inherit" }}>
            <Settings size={14} color={GD} /> إدارة القوالب
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "16px 20px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث برقم التقرير، الجهاز، العقد، أمر الصيانة..." style={{ ...inp, paddingRight: 36 }} />
        </div>
        <div style={{ position: "relative", minWidth: 170 }}>
          <select value={contractId} onChange={(e) => setContractId(e.target.value)} style={{ ...inp, appearance: "none", paddingLeft: 32, cursor: "pointer" }}>
            <option value="">كل العقود</option>
            {contracts.map((c: any) => <option key={c.id} value={c.id}>{c.contractNumber}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
        </div>
        <div style={{ position: "relative", minWidth: 160 }}>
          <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} style={{ ...inp, appearance: "none", paddingLeft: 32, cursor: "pointer" }}>
            <option value="">كل أنواع الأجهزة</option>
            {equipmentTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
        </div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...inp, width: 145 }} title="من تاريخ" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...inp, width: 145 }} title="إلى تاريخ" />
        {hasFilters && (
          <button onClick={clearFilters} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", fontFamily: "inherit" }}>
            <X size={13} /> إلغاء الفلاتر
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>جارِ التحميل...</div>
        ) : reports.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <FileBox size={40} color="#e2d5b0" style={{ margin: "0 auto 10px", display: "block" }} />
            <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>{hasFilters ? "لا توجد نتائج مطابقة" : "لا توجد تقارير صادرة بعد — يمكن إصدار تقرير من داخل صفحة أمر الصيانة"}</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#f9f6ee" }}>
                  {["رقم التقرير", "التاريخ", "الجهاز", "النوع", "الموقع", "العقد / أمر الصيانة", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#4a3f1a" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r: any) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f5f0e6" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: GR, fontFamily: "monospace" }}>{r.reportNumber}</td>
                    <td style={{ padding: "10px 14px", color: "#6b7280" }}>{new Date(r.generatedAt).toLocaleDateString("ar-KW")}</td>
                    <td style={{ padding: "10px 14px" }}>{r.equipmentName}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {r.equipmentCategory && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: "#f9f6ee", border: "1px solid #f0ead8", fontSize: 11, color: GD }}><Wrench size={10} />{r.equipmentCategory}</span>}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#6b7280" }}>
                      {r.equipmentLocation && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} color="#9ca3af" />{r.equipmentLocation}</span>}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {r.workOrderNumber && <span style={{ fontSize: 11.5, fontFamily: "monospace", color: "#374151" }}>{r.workOrderNumber}</span>}
                        {r.contractNumber && <span style={{ fontSize: 11, color: "#9ca3af" }}>{r.contractNumber}</span>}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => handleDownload(r)} disabled={downloadingId === r.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", cursor: "pointer", fontFamily: "inherit" }}>
                        <Download size={12} /> {downloadingId === r.id ? "..." : "تنزيل"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
