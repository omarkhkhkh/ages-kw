import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contractsApi, companiesApi } from "@/lib/api";
import {
  FileSignature, Plus, Pencil, Trash2, X, Check, Download,
  Building2, Banknote, CalendarDays, CheckCircle2, XCircle, Clock,
  LayoutGrid, Paperclip, Upload, Shield, MessageSquare, ChevronDown,
  AlertTriangle, Eye, EyeOff, Send, FileText, Trash,
  Landmark, Save, Mail, TrendingUp, TrendingDown, Truck, ShoppingCart, Loader2,
  Info, Users, UserCheck, StickyNote, ClipboardList, Calculator,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { exportContractsToExcel } from "@/lib/export";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import CorrespondenceSheet from "@/components/correspondence/correspondence-sheet";
import { useListTenders } from "@workspace/api-client-react";
import EntityDirectoryPicker from "@/components/entity-directory-picker";
import LinkedPricingSheets from "@/components/linked-pricing-sheets";
import LinkedTasks from "@/components/linked-tasks";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  active:     { label: "ساري",    color: "#16a34a", bg: "#f0fdf4", icon: CheckCircle2 },
  completed:  { label: "منتهي",  color: "#2563eb", bg: "#eff6ff", icon: Clock        },
  terminated: { label: "مُفسوخ", color: "#dc2626", bg: "#fff1f2", icon: XCircle      },
};

const STAT_CARDS = [
  { id: "all",        label: "جميع العقود",  icon: LayoutGrid,   color: "#64748b", bg: "#f8fafc" },
  { id: "active",     label: "سارية",         icon: CheckCircle2, color: "#16a34a", bg: "#f0fdf4" },
  { id: "completed",  label: "منتهية",        icon: Clock,        color: "#2563eb", bg: "#eff6ff" },
  { id: "terminated", label: "مُفسوخة",       icon: XCircle,      color: "#dc2626", bg: "#fff1f2" },
];

const emptyForm = {
  tenderId: "", contractNumber: "", governmentEntityId: "" as string | number | null, departmentId: "" as string | number | null, contactId: "" as string | number | null, companyId: "",
  contractValue: "", signDate: "", startDate: "", endDate: "",
  status: "active", notes: "",
  // final bond
  finalBondValue: "", finalBondNumber: "", finalBondBank: "",
  finalBondIssueDate: "", finalBondExpiryDate: "", finalBondStatus: "active",
};

const BOND_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active:      { label: "سارية",    color: "#16a34a", bg: "#f0fdf4" },
  released:    { label: "مُفرج عنها", color: "#2563eb", bg: "#eff6ff" },
  confiscated: { label: "مُصادرة",  color: "#dc2626", bg: "#fff1f2" },
};

function formatBytes(n: number) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/* ─── Contract Form Modal ─── */
function ContractModal({ open, editId, form, setForm, onClose, onSubmit, isPending, tenders, companies }: any) {
  if (!open) return null;
  const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit", transition: "border-color 0.15s,box-shadow 0.15s" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: GR, marginBottom: 5 };
  const focus = (e: any) => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px rgba(212,165,52,0.15)`; };
  const blur  = (e: any) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none"; };
  const f = (field: string) => (e: any) => setForm((p: any) => ({ ...p, [field]: e.target.value }));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(11,26,16,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 700, background: "white", borderRadius: 24, boxShadow: "0 32px 80px rgba(0,0,0,0.3),0 0 0 1px rgba(212,165,52,0.15)", overflow: "hidden", animation: "slideUp 0.25s ease", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 28px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(212,165,52,0.2)", border: "1px solid rgba(212,165,52,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileSignature size={20} color={G} />
            </div>
            <div>
              <h2 style={{ color: "white", fontSize: 17, fontWeight: 800, margin: 0 }}>{editId ? "تعديل بيانات العقد" : "إضافة عقد جديد"}</h2>
              <p style={{ color: "rgba(212,165,52,0.6)", fontSize: 12, margin: "2px 0 0" }}>{editId ? "قم بتعديل البيانات وحفظها" : "أدخل بيانات العقد الجديد"}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.7)" }}><X size={16} /></button>
        </div>

        <form onSubmit={onSubmit} style={{ overflowY: "auto", padding: 28, display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>البيانات الأساسية</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div><label style={lbl}>رقم العقد <span style={{ color: "#dc2626" }}>*</span></label><input value={form.contractNumber} onChange={f("contractNumber")} placeholder="CONT-2025-001" dir="ltr" required style={inp} onFocus={focus} onBlur={blur} /></div>
              <div><label style={lbl}>الحالة</label><select value={form.status} onChange={f("status")} style={{ ...inp, height: 42 }} onFocus={focus} onBlur={blur}>{Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><label style={lbl}>المناقصة المرتبطة</label><select value={form.tenderId} onChange={f("tenderId")} style={{ ...inp, height: 42 }} onFocus={focus} onBlur={blur}><option value="">— اختر المناقصة —</option>{(tenders as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.tenderNumber} · {t.projectName}</option>)}</select></div>
              <div><label style={lbl}>الشركة المشاركة</label><select value={form.companyId} onChange={f("companyId")} style={{ ...inp, height: 42 }} onFocus={focus} onBlur={blur}><option value="">— اختر الشركة —</option>{(companies as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label style={lbl}>قيمة العقد (د.ك)</label><input type="number" value={form.contractValue} onChange={f("contractValue")} min="0" dir="ltr" placeholder="0.000" style={inp} onFocus={focus} onBlur={blur} /></div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>الجهة الحكومية ← الاختصاص ← المسؤول</label>
                <EntityDirectoryPicker
                  value={{ governmentEntityId: form.governmentEntityId, departmentId: form.departmentId, contactId: form.contactId }}
                  onChange={next => setForm((p: any) => ({ ...p, ...next }))}
                />
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: "linear-gradient(90deg,transparent,#f0ead8,transparent)", marginBottom: 22 }} />
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>التواريخ</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div><label style={lbl}>تاريخ التوقيع</label><input type="date" value={form.signDate} onChange={f("signDate")} style={inp} onFocus={focus} onBlur={blur} /></div>
              <div><label style={lbl}>تاريخ البداية</label><input type="date" value={form.startDate} onChange={f("startDate")} style={inp} onFocus={focus} onBlur={blur} /></div>
              <div><label style={lbl}>تاريخ الانتهاء</label><input type="date" value={form.endDate} onChange={f("endDate")} style={inp} onFocus={focus} onBlur={blur} /></div>
            </div>
          </div>
          <div style={{ height: 1, background: "linear-gradient(90deg,transparent,#f0ead8,transparent)", marginBottom: 22 }} />
          {/* ── Final Bond Section ── */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
              <Landmark size={14} color={GD} />
              <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>الكفالة النهائية</span>
              <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>(اختياري)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div><label style={lbl}>قيمة الكفالة (د.ك)</label><input type="number" step="0.001" min="0" value={form.finalBondValue} onChange={f("finalBondValue")} placeholder="0.000" dir="ltr" style={inp} onFocus={focus} onBlur={blur} /></div>
              <div><label style={lbl}>رقم الكفالة</label><input value={form.finalBondNumber} onChange={f("finalBondNumber")} placeholder="رقم وثيقة الكفالة" dir="ltr" style={inp} onFocus={focus} onBlur={blur} /></div>
              <div style={{ gridColumn: "1/-1" }}><label style={lbl}>البنك المُصدر</label><input value={form.finalBondBank} onChange={f("finalBondBank")} placeholder="اسم البنك أو المؤسسة المالية" style={inp} onFocus={focus} onBlur={blur} /></div>
              <div><label style={lbl}>تاريخ الإصدار</label><input type="date" value={form.finalBondIssueDate} onChange={f("finalBondIssueDate")} style={inp} onFocus={focus} onBlur={blur} /></div>
              <div><label style={lbl}>تاريخ الانتهاء</label><input type="date" value={form.finalBondExpiryDate} onChange={f("finalBondExpiryDate")} style={inp} onFocus={focus} onBlur={blur} /></div>
              <div style={{ gridColumn: "1/-1" }}><label style={lbl}>حالة الكفالة</label>
                <select value={form.finalBondStatus} onChange={f("finalBondStatus")} style={{ ...inp, height: 42 }} onFocus={focus} onBlur={blur}>
                  <option value="active">سارية</option>
                  <option value="released">مُفرج عنها</option>
                  <option value="confiscated">مُصادرة</option>
                </select>
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: "linear-gradient(90deg,transparent,#f0ead8,transparent)", marginBottom: 22 }} />
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>ملاحظات</span>
            </div>
            <textarea value={form.notes} onChange={f("notes")} placeholder="أي ملاحظات إضافية..." rows={3} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} onFocus={focus} onBlur={blur} />
          </div>
          <div style={{ display: "flex", gap: 10, paddingTop: 4, borderTop: "1px solid #f5f0e6" }}>
            <button type="submit" disabled={isPending} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 28px", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: isPending ? "not-allowed" : "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 6px 20px rgba(212,165,52,0.4)`, opacity: isPending ? 0.7 : 1 }}>
              <Check size={16} />{isPending ? "جارٍ الحفظ..." : (editId ? "حفظ التعديلات" : "إضافة العقد")}
            </button>
            <button type="button" onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 22px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", background: "#f9fafb", border: "1.5px solid #e5e7eb", color: "#374151", fontFamily: "inherit" }}>
              <X size={15} /> إلغاء
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{transform:translateY(32px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}

/* ─── Profitability tab helpers ─── */
function ProfitStat({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: any }) {
  return (
    <div style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280" }}>{label}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 900, color, direction: "ltr" as const, textAlign: "right" as const }}>{formatCurrency(value)}</div>
    </div>
  );
}

function ProfitSection({ title, icon: Icon, empty, isEmpty, children }: { title: string; icon: any; empty: string; isEmpty: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Icon size={13} color={GD} />
        <span style={{ fontSize: 12, fontWeight: 800, color: "#9ca3af" }}>{title}</span>
      </div>
      {isEmpty ? <div style={{ textAlign: "center", padding: "12px 0", color: "#94a3b8", fontSize: 12 }}>{empty}</div> : children}
    </div>
  );
}

/* ─── Contract Detail Drawer ─── */
function ContractDrawer({ contract, onClose, isAdmin, currentUserId, employees }: {
  contract: any; onClose: () => void; isAdmin: boolean;
  currentUserId: number; employees: any[];
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "profitability" | "bond" | "pricing" | "tasks" | "docs" | "perms" | "comments">("overview");
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(employees[0]?.id ?? "");

  const { data: profitability, isLoading: profitLoading } = useQuery({
    queryKey: ["contract-profitability", contract.id],
    queryFn: () => contractsApi.getProfitability(contract.id),
    enabled: isAdmin,
  });

  const { data: docs = [], isLoading: docsLoading } = useQuery({
    queryKey: ["contract-docs", contract.id],
    queryFn: () => contractsApi.listDocuments(contract.id),
  });

  const { data: perms = [], isLoading: permsLoading } = useQuery({
    queryKey: ["contract-perms", contract.id],
    queryFn: () => contractsApi.getPermissions(contract.id),
    enabled: isAdmin,
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["contract-comments", contract.id],
    queryFn: () => contractsApi.listComments(contract.id),
  });

  // Mark comments read when tab opens
  const markReadM = useMutation({
    mutationFn: () => contractsApi.markCommentsRead(contract.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-comments", contract.id] });
      qc.invalidateQueries({ queryKey: ["unread-comments-count"] });
    },
  });

  const deleteDocM = useMutation({
    mutationFn: (docId: number) => contractsApi.deleteDocument(contract.id, docId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract-docs", contract.id] }); toast({ title: "🗑 تم حذف الملف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const setPermM = useMutation({
    mutationFn: ({ userId, canView }: { userId: number; canView: boolean }) =>
      contractsApi.setPermission(contract.id, userId, canView),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract-perms", contract.id] }),
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const addCommentM = useMutation({
    mutationFn: () => contractsApi.addComment(contract.id, Number(selectedEmployee), commentText),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-comments", contract.id] });
      setCommentText("");
      toast({ title: "✅ تم إرسال التعليق" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteCommentM = useMutation({
    mutationFn: (commentId: number) => contractsApi.deleteComment(contract.id, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract-comments", contract.id] }),
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "خطأ", description: "حجم الملف كبير جداً (الحد الأقصى 5 ميغابايت)", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        await contractsApi.uploadDocument(contract.id, {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          fileData: base64,
        });
        qc.invalidateQueries({ queryKey: ["contract-docs", contract.id] });
        toast({ title: "✅ تم رفع الملف بنجاح" });
        setUploading(false);
      };
      reader.onerror = () => { toast({ title: "خطأ في قراءة الملف", variant: "destructive" }); setUploading(false); };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
      setUploading(false);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const unreadCount = (comments as any[]).filter((c: any) => !c.is_read && c.to_user_id === currentUserId).length;

  const handleCommentsTab = () => {
    setActiveTab("comments");
    if (!isAdmin && unreadCount > 0) {
      markReadM.mutate();
    }
  };

  const TABS = [
    { id: "overview", label: "نظرة عامة",  icon: Info,      badge: 0 },
    ...(isAdmin ? [{ id: "profitability", label: "الربحية", icon: TrendingUp, badge: 0 }] : []),
    { id: "bond",     label: "الكفالة النهائية", icon: Landmark,       badge: 0 },
    { id: "pricing",  label: "التسعير",           icon: Calculator,     badge: 0 },
    { id: "tasks",    label: "المهام",             icon: ClipboardList,  badge: 0 },
    { id: "docs",     label: "المرفقات",         icon: Paperclip,      badge: (docs as any[]).length },
    ...(isAdmin ? [{ id: "perms", label: "الصلاحيات", icon: Shield, badge: 0 }] : []),
    { id: "comments", label: "التعليقات",        icon: MessageSquare, badge: !isAdmin ? unreadCount : (comments as any[]).length },
  ] as const;

  const tabBtn = (t: typeof TABS[number]) => {
    const isActive = activeTab === t.id;
    return (
      <button
        key={t.id}
        onClick={() => t.id === "comments" ? handleCommentsTab() : setActiveTab(t.id as any)}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
          borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
          fontSize: 12, fontWeight: 700, border: "none", position: "relative",
          background: isActive ? `${G}15` : "transparent",
          color: isActive ? GD : "#6b7280",
          borderBottom: isActive ? `2px solid ${G}` : "2px solid transparent",
          transition: "all 0.15s",
        }}
      >
        <t.icon size={14} />
        {t.label}
        {t.badge > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 800, minWidth: 17, height: 17,
            borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "0 4px",
            background: t.id === "comments" && !isAdmin ? "#dc2626" : G,
            color: "white",
          }}>{t.badge}</span>
        )}
      </button>
    );
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 900,
      display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
    }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(11,26,16,0.35)", backdropFilter: "blur(2px)" }} />

      {/* Drawer */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative", zIndex: 1,
          width: 480, height: "100vh",
          background: "white",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column",
          animation: "slideInRight 0.25s ease",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          background: `linear-gradient(135deg,${GR},#1e4028)`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "white" }}>{contract.contractNumber}</div>
            <div style={{ fontSize: 11, color: "rgba(212,165,52,0.6)", marginTop: 2 }}>{contract.entityName || "—"}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.7)" }}>
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "8px 16px", borderBottom: "1.5px solid #f0ead8", flexShrink: 0 }}>
          {TABS.map(tabBtn)}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

          {/* ── Overview Tab (all core contract fields) ── */}
          {activeTab === "overview" && (() => {
            const st = STATUS_MAP[contract.status] || STATUS_MAP.active;
            const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) => (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "1px solid #f9fafb" }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${G}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={14} color={GD} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", wordBreak: "break-word" }}>{value ?? "—"}</div>
                </div>
              </div>
            );
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, background: st.bg, border: `1.5px solid ${st.color}25` }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: st.color, display: "flex", alignItems: "center", gap: 6 }}>
                    <st.icon size={14} />{st.label}
                  </span>
                  {contract.contractValue && (
                    <span style={{ fontSize: 14, fontWeight: 900, color: GR, fontFamily: "monospace" }}>{formatCurrency(contract.contractValue)}</span>
                  )}
                </div>

                <div style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: "4px 14px" }}>
                  <InfoRow icon={Building2}     label="الجهة الحكومية"   value={contract.entityName} />
                  <InfoRow icon={ClipboardList} label="الاختصاص"        value={contract.departmentName} />
                  <InfoRow icon={UserCheck}     label="المسؤول"          value={contract.contactName} />
                  <InfoRow icon={Users}         label="الشركة المشاركة" value={contract.companyName} />
                  <InfoRow icon={FileSignature} label="المناقصة المرتبطة" value={contract.tenderNumber} />
                </div>

                <div style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: "4px 14px" }}>
                  <InfoRow icon={CalendarDays} label="تاريخ التوقيع" value={contract.signDate ? formatDate(contract.signDate) : null} />
                  <InfoRow icon={CalendarDays} label="تاريخ البدء"   value={contract.startDate ? formatDate(contract.startDate) : null} />
                  <InfoRow icon={CalendarDays} label="تاريخ الانتهاء" value={contract.endDate ? formatDate(contract.endDate) : null} />
                </div>

                {contract.notes && (
                  <div style={{ background: "#fdfaf5", border: "1.5px solid #f0ead8", borderRadius: 14, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <StickyNote size={13} color={GD} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af" }}>ملاحظات</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{contract.notes}</div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Profitability Tab (Contract Cost Center) ── */}
          {activeTab === "profitability" && (
            profitLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                <Loader2 size={22} color={G} style={{ animation: "spin 1s linear infinite" }} />
              </div>
            ) : !profitability ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 13 }}>تعذّر تحميل بيانات الربحية</div>
            ) : (() => {
              const p = profitability as any;
              const isProfit = p.profit >= 0;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Stat cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <ProfitStat label="قيمة العقد" value={p.contractValue} color={GR} icon={FileSignature} />
                    <ProfitStat label="المشتريات" value={p.purchases.total} color="#7c3aed" icon={ShoppingCart} />
                    <ProfitStat label="النقل" value={p.transport.total} color="#2563eb" icon={Truck} />
                    <ProfitStat label="المصروفات" value={p.expenses.total} color="#d97706" icon={Banknote} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <ProfitStat label="إجمالي التكلفة" value={p.totalCost} color="#dc2626" icon={TrendingDown} />
                    <div style={{ background: isProfit ? "#f0fdf4" : "#fff1f2", border: `1.5px solid ${isProfit ? "#bbf7d0" : "#fecaca"}`, borderRadius: 14, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        {isProfit ? <TrendingUp size={13} color="#16a34a" /> : <TrendingDown size={13} color="#dc2626" />}
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280" }}>الربح ({p.profitPct.toFixed(1)}%)</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: isProfit ? "#16a34a" : "#dc2626", direction: "ltr" as const, textAlign: "right" as const }}>
                        {formatCurrency(p.profit)}
                      </div>
                    </div>
                  </div>

                  {/* Expense category breakdown */}
                  {p.expenses.byCategory.length > 0 && (
                    <div style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#9ca3af", marginBottom: 8 }}>المصروفات حسب الفئة</div>
                      {p.expenses.byCategory.map((c: any) => (
                        <div key={c.category} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f9fafb", fontSize: 12 }}>
                          <span style={{ color: "#374151" }}>{c.category}</span>
                          <span style={{ fontWeight: 700, color: "#d97706", direction: "ltr" as const }}>{formatCurrency(c.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Linked transport trips */}
                  <ProfitSection title={`رحلات النقل المرتبطة (${p.transport.rows.length})`} icon={Truck} empty="لا توجد رحلات نقل مرتبطة" isEmpty={p.transport.rows.length === 0}>
                    {p.transport.rows.map((r: any) => (
                      <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f9fafb", fontSize: 12 }}>
                        <span style={{ color: "#374151" }}>{r.orderNumber ?? r.description}</span>
                        <span style={{ fontWeight: 700, color: "#2563eb", direction: "ltr" as const }}>{r.value ? formatCurrency(r.value) : "—"}</span>
                      </div>
                    ))}
                  </ProfitSection>

                  {/* Linked expenses */}
                  <ProfitSection title={`المصروفات المرتبطة (${p.expenses.rows.length})`} icon={Banknote} empty="لا توجد مصروفات مرتبطة" isEmpty={p.expenses.rows.length === 0}>
                    {p.expenses.rows.map((r: any) => (
                      <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f9fafb", fontSize: 12 }}>
                        <span style={{ color: "#374151" }}>{r.description}</span>
                        <span style={{ fontWeight: 700, color: "#d97706", direction: "ltr" as const }}>{formatCurrency(r.amount)}</span>
                      </div>
                    ))}
                  </ProfitSection>

                  {/* Linked purchase orders */}
                  <ProfitSection title={`أوامر الشراء المرتبطة (${p.purchases.rows.length})`} icon={ShoppingCart} empty="لا توجد أوامر شراء مرتبطة" isEmpty={p.purchases.rows.length === 0}>
                    {p.purchases.rows.map((r: any) => (
                      <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f9fafb", fontSize: 12 }}>
                        <span style={{ color: "#374151" }}>{r.orderNumber} {r.supplierName ? `— ${r.supplierName}` : ""}</span>
                        <span style={{ fontWeight: 700, color: "#7c3aed", direction: "ltr" as const }}>{r.amount ? formatCurrency(r.amount) : "—"}</span>
                      </div>
                    ))}
                  </ProfitSection>
                </div>
              );
            })()
          )}

          {/* ── Bond Tab ── */}
          {activeTab === "bond" && (() => {
            const bond = contract;
            const bs = BOND_STATUS_MAP[bond.finalBondStatus ?? "active"] ?? BOND_STATUS_MAP.active;
            const hasBond = bond.finalBondValue || bond.finalBondNumber || bond.finalBondBank || bond.finalBondIssueDate || bond.finalBondExpiryDate;

            // Expiry warning
            let expiryWarning: React.ReactNode = null;
            if (bond.finalBondExpiryDate) {
              const diff = Math.ceil((new Date(bond.finalBondExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              if (diff < 0)        expiryWarning = <div style={{ display:"flex",alignItems:"center",gap:6,padding:"10px 14px",borderRadius:10,background:"#fff1f2",border:"1.5px solid #fecaca",fontSize:12,fontWeight:700,color:"#dc2626",marginBottom:12 }}><AlertTriangle size={14}/>انتهت صلاحية الكفالة منذ {Math.abs(diff)} يوم</div>;
              else if (diff <= 30) expiryWarning = <div style={{ display:"flex",alignItems:"center",gap:6,padding:"10px 14px",borderRadius:10,background:"#fffbeb",border:"1.5px solid #fde68a",fontSize:12,fontWeight:700,color:"#d97706",marginBottom:12 }}><AlertTriangle size={14}/>تنتهي الكفالة خلال {diff} يوم</div>;
            }

            return (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {expiryWarning}
                {!hasBond ? (
                  <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>
                    <Landmark size={32} style={{ margin:"0 auto 8px", opacity:0.3 }} />
                    <div style={{ fontSize:13, fontWeight:600 }}>لا توجد بيانات كفالة نهائية</div>
                    <div style={{ fontSize:11, marginTop:4 }}>أضفها من خلال تعديل العقد</div>
                  </div>
                ) : (
                  <>
                    {/* Status badge */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontSize:12, fontWeight:700, color:"#6b7280" }}>حالة الكفالة</span>
                      <span style={{ padding:"4px 14px", borderRadius:20, fontSize:12, fontWeight:700, background:bs.bg, color:bs.color }}>{bs.label}</span>
                    </div>
                    <div style={{ height:1, background:"#f0ead8" }} />
                    {/* Fields grid */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      {bond.finalBondValue && (
                        <div style={{ gridColumn:"1/-1", padding:"12px 16px", borderRadius:12, background:"#fdfaf5", border:"1.5px solid #f0ead8" }}>
                          <div style={{ fontSize:11, color:"#9ca3af", fontWeight:700, marginBottom:3 }}>قيمة الكفالة</div>
                          <div style={{ fontSize:16, fontWeight:900, color:GD, fontFamily:"monospace" }}>{formatCurrency(Number(bond.finalBondValue))}</div>
                        </div>
                      )}
                      {bond.finalBondNumber && (
                        <div style={{ padding:"10px 14px", borderRadius:10, background:"white", border:"1.5px solid #f0ead8" }}>
                          <div style={{ fontSize:10, color:"#9ca3af", fontWeight:700, marginBottom:2 }}>رقم الكفالة</div>
                          <div style={{ fontSize:12, fontWeight:700, color:GR, fontFamily:"monospace" }}>{bond.finalBondNumber}</div>
                        </div>
                      )}
                      {bond.finalBondBank && (
                        <div style={{ padding:"10px 14px", borderRadius:10, background:"white", border:"1.5px solid #f0ead8" }}>
                          <div style={{ fontSize:10, color:"#9ca3af", fontWeight:700, marginBottom:2 }}>البنك المُصدر</div>
                          <div style={{ fontSize:12, fontWeight:700, color:GR }}>{bond.finalBondBank}</div>
                        </div>
                      )}
                      {bond.finalBondIssueDate && (
                        <div style={{ padding:"10px 14px", borderRadius:10, background:"white", border:"1.5px solid #f0ead8" }}>
                          <div style={{ fontSize:10, color:"#9ca3af", fontWeight:700, marginBottom:2 }}>تاريخ الإصدار</div>
                          <div style={{ fontSize:12, fontWeight:700, color:GR }}>{formatDate(bond.finalBondIssueDate)}</div>
                        </div>
                      )}
                      {bond.finalBondExpiryDate && (
                        <div style={{ padding:"10px 14px", borderRadius:10, background:"white", border:"1.5px solid #f0ead8" }}>
                          <div style={{ fontSize:10, color:"#9ca3af", fontWeight:700, marginBottom:2 }}>تاريخ الانتهاء</div>
                          <div style={{ fontSize:12, fontWeight:700, color:GR }}>{formatDate(bond.finalBondExpiryDate)}</div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* ── Pricing Tab ── */}
          {activeTab === "pricing" && (
            <LinkedPricingSheets entityType="contract" entityId={contract.id} />
          )}

          {/* ── Tasks Tab ── */}
          {activeTab === "tasks" && (
            <LinkedTasks entityType="contract" entityId={contract.id} />
          )}

          {/* ── Documents Tab ── */}
          {activeTab === "docs" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Upload button */}
              <div>
                <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileUpload} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "12px 16px", borderRadius: 12, cursor: uploading ? "not-allowed" : "pointer",
                    border: `2px dashed ${G}50`, background: `${G}08`,
                    color: GD, fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    justifyContent: "center", transition: "all 0.15s", opacity: uploading ? 0.6 : 1,
                  }}
                >
                  <Upload size={15} />
                  {uploading ? "جارٍ الرفع..." : "رفع ملف جديد (حد أقصى 5 ميغابايت)"}
                </button>
              </div>

              {docsLoading ? (
                <div style={{ textAlign: "center", padding: 32, color: "#9ca3af", fontSize: 13 }}>جارٍ التحميل...</div>
              ) : !(docs as any[]).length ? (
                <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                  <Paperclip size={32} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
                  <div style={{ fontSize: 13, fontWeight: 600 }}>لا توجد ملفات مرفقة</div>
                  {!isAdmin && <div style={{ fontSize: 11, marginTop: 4 }}>يمكنك رفع الملفات الخاصة بك</div>}
                </div>
              ) : (
                (docs as any[]).map((doc: any) => (
                  <div key={doc.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", borderRadius: 10,
                    border: "1.5px solid #f0ead8", background: "#fdfaf5",
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: `${G}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <FileText size={16} color={GD} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: GR, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.file_name}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                        {isAdmin && doc.uploader_name && <span>{doc.uploader_name} · </span>}
                        {formatBytes(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString("ar-KW")}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <a
                        href={contractsApi.downloadUrl(contract.id, doc.id)}
                        download={doc.file_name}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", textDecoration: "none" }}
                      >
                        <Download size={11} /> تنزيل
                      </a>
                      {(isAdmin || doc.uploaded_by === currentUserId) && (
                        <button
                          onClick={() => { if (confirm("حذف الملف؟")) deleteDocM.mutate(doc.id); }}
                          style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", fontFamily: "inherit" }}
                        >
                          <Trash size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Permissions Tab (admin only) ── */}
          {activeTab === "perms" && isAdmin && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, lineHeight: 1.6 }}>
                حدّد لكل موظف إذا كان بإمكانه رؤية هذا العقد في قائمة العقود.
                المدير دائماً يرى جميع العقود.
              </div>
              {permsLoading ? (
                <div style={{ textAlign: "center", padding: 32, color: "#9ca3af", fontSize: 13 }}>جارٍ التحميل...</div>
              ) : !(perms as any[]).length ? (
                <div style={{ textAlign: "center", padding: 32, color: "#9ca3af", fontSize: 13 }}>لا يوجد موظفون في النظام</div>
              ) : (
                (perms as any[]).map((p: any) => (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 14px", borderRadius: 10,
                    border: `1.5px solid ${p.can_view ? "#f0ead8" : "#fecaca"}`,
                    background: p.can_view ? "white" : "#fff5f5",
                    transition: "all 0.15s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9,
                        background: p.can_view ? `${G}12` : "#fee2e2",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {p.can_view
                          ? <Eye size={15} color={GD} />
                          : <EyeOff size={15} color="#dc2626" />
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: GR }}>{p.full_name}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>@{p.username}</div>
                      </div>
                    </div>
                    {/* Toggle */}
                    <button
                      onClick={() => setPermM.mutate({ userId: p.id, canView: !p.can_view })}
                      style={{
                        width: 48, height: 26, borderRadius: 13, cursor: "pointer", border: "none",
                        background: p.can_view ? "#16a34a" : "#e5e7eb",
                        position: "relative", transition: "background 0.2s",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{
                        position: "absolute", top: 3, width: 20, height: 20, borderRadius: 10,
                        background: "white", transition: "right 0.2s, left 0.2s",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                        right: p.can_view ? 3 : "auto",
                        left: p.can_view ? "auto" : 3,
                      }} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Comments Tab ── */}
          {activeTab === "comments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Add comment (admin only) */}
              {isAdmin && (
                <div style={{ padding: 14, borderRadius: 12, border: "1.5px solid #f0ead8", background: "#fdfaf5", marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: GR, marginBottom: 8 }}>إرسال تعليق لموظف</div>
                  <select
                    value={selectedEmployee}
                    onChange={e => setSelectedEmployee(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12, fontFamily: "inherit", marginBottom: 8, outline: "none", background: "white", color: GR }}
                  >
                    {employees.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>{emp.full_name} (@{emp.username})</option>
                    ))}
                  </select>
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="اكتب ملاحظتك أو التصحيح المطلوب..."
                    rows={3}
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12, fontFamily: "inherit", resize: "vertical", outline: "none", lineHeight: 1.6 }}
                  />
                  <button
                    onClick={() => addCommentM.mutate()}
                    disabled={!commentText.trim() || !selectedEmployee || addCommentM.isPending}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, marginTop: 8,
                      padding: "8px 18px", borderRadius: 9, cursor: "pointer",
                      background: `linear-gradient(135deg,${G},${GD})`,
                      border: "none", color: "white", fontFamily: "inherit",
                      fontSize: 12, fontWeight: 700, opacity: !commentText.trim() || !selectedEmployee ? 0.5 : 1,
                    }}
                  >
                    <Send size={13} />
                    {addCommentM.isPending ? "جارٍ الإرسال..." : "إرسال التعليق"}
                  </button>
                </div>
              )}

              {commentsLoading ? (
                <div style={{ textAlign: "center", padding: 32, color: "#9ca3af", fontSize: 13 }}>جارٍ التحميل...</div>
              ) : !(comments as any[]).length ? (
                <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                  <MessageSquare size={32} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
                  <div style={{ fontSize: 13, fontWeight: 600 }}>لا توجد تعليقات بعد</div>
                </div>
              ) : (
                (comments as any[]).map((c: any) => (
                  <div key={c.id} style={{
                    padding: "12px 14px", borderRadius: 10,
                    border: `1.5px solid ${!c.is_read && !isAdmin ? "#fca5a5" : "#f0ead8"}`,
                    background: !c.is_read && !isAdmin ? "#fff5f5" : "white",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${G}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <MessageSquare size={13} color={GD} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: GR }}>
                            {c.from_name}
                            {isAdmin && <span style={{ fontWeight: 400, color: "#9ca3af" }}> → {c.to_name}</span>}
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af" }}>{new Date(c.created_at).toLocaleString("ar-KW")}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {!c.is_read && !isAdmin && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: "#dc2626", color: "white", borderRadius: 6, padding: "2px 8px" }}>جديد</span>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => deleteCommentM.mutate(c.id)}
                            style={{ width: 26, height: 26, borderRadius: 7, background: "#fff1f2", border: "1px solid #fecaca", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <Trash size={11} color="#dc2626" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{c.content}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ─── Main Page ─── */
export default function ContractsList() {
  const { user }  = useAuth();
  const qc        = useQueryClient();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [showForm,    setShowForm]    = useState(false);
  const [editId,      setEditId]      = useState<number | null>(null);
  const [form,        setForm]        = useState({ ...emptyForm });
  const [tab,         setTab]         = useState("all");
  const [openDrawer,  setOpenDrawer]  = useState<any | null>(null);
  const [correspondenceFor, setCorrespondenceFor] = useState<{ id: number; label: string; governmentEntityId: number | null } | null>(null);

  const { data: allContracts = [] } = useQuery({ queryKey: ["contracts", "all"], queryFn: () => contractsApi.list(undefined) });
  const statusFilter = tab !== "all" ? tab : undefined;
  const { data: contracts = [], isLoading } = useQuery({ queryKey: ["contracts", tab], queryFn: () => contractsApi.list(statusFilter) });
  const { data: companies = [] } = useQuery({ queryKey: ["companies-list"], queryFn: () => companiesApi.list() });
  const { data: tenders   = [] } = useListTenders({});

  // Employees list for permissions & comments (admin fetches all users)
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list"],
    queryFn: () => fetch("/api/admin/users", { credentials: "include" }).then(r => r.json()),
    enabled: isAdmin,
    select: (data: any[]) => data.filter((u: any) => u.role === "employee"),
  });

  // Comments count per contract for badge
  const { data: commentsBadge = {} } = useQuery({
    queryKey: ["contracts-comments-badge"],
    queryFn: async () => {
      if (isAdmin) return {};
      // For employee: fetch unread grouped by contract
      const res = await fetch("/api/contracts/meta/unread-comments", { credentials: "include" });
      return res.json();
    },
    refetchInterval: 30000,
  });

  const getCount = (id: string) => {
    if (id === "all") return (allContracts as any[]).length;
    return (allContracts as any[]).filter((c: any) => c.status === id).length;
  };

  const createM = useMutation({ mutationFn: contractsApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); closeForm(); toast({ title: "✅ تم إضافة العقد بنجاح" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const updateM = useMutation({ mutationFn: ({ id, data }: any) => contractsApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); closeForm(); toast({ title: "✅ تم تحديث العقد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const deleteM = useMutation({ mutationFn: contractsApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); toast({ title: "🗑 تم حذف العقد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const openEdit  = (c: any) => {
    setEditId(c.id);
    setForm({
      tenderId: c.tenderId || "", contractNumber: c.contractNumber,
      governmentEntityId: c.governmentEntityId || "", departmentId: c.departmentId || "", contactId: c.contactId || "",
      companyId: c.companyId || "", contractValue: c.contractValue || "",
      signDate: c.signDate || "", startDate: c.startDate || "", endDate: c.endDate || "",
      status: c.status, notes: c.notes || "",
      finalBondValue: c.finalBondValue || "", finalBondNumber: c.finalBondNumber || "",
      finalBondBank: c.finalBondBank || "", finalBondIssueDate: c.finalBondIssueDate || "",
      finalBondExpiryDate: c.finalBondExpiryDate || "", finalBondStatus: c.finalBondStatus || "active",
    });
    setShowForm(true);
  };
  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.contractNumber) return;
    const data = {
      ...form,
      tenderId:            form.tenderId            ? Number(form.tenderId)            : null,
      governmentEntityId:  form.governmentEntityId  ? Number(form.governmentEntityId)  : null,
      departmentId:        form.departmentId         ? Number(form.departmentId)        : null,
      contactId:           form.contactId            ? Number(form.contactId)           : null,
      companyId:           form.companyId            ? Number(form.companyId)           : null,
      contractValue:       form.contractValue        ? String(form.contractValue)        : null,
      signDate:            form.signDate             || null,
      startDate:           form.startDate            || null,
      endDate:             form.endDate              || null,
      finalBondValue:      form.finalBondValue       ? String(form.finalBondValue)       : null,
      finalBondNumber:     form.finalBondNumber      || null,
      finalBondBank:       form.finalBondBank        || null,
      finalBondIssueDate:  form.finalBondIssueDate   || null,
      finalBondExpiryDate: form.finalBondExpiryDate  || null,
      finalBondStatus:     form.finalBondStatus      || "active",
    };
    editId ? updateM.mutate({ id: editId, data }) : createM.mutate(data);
  };

  const activeCard = STAT_CARDS.find(c => c.id === tab)!;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 22 }}>

      <ContractModal open={showForm} editId={editId} form={form} setForm={setForm} onClose={closeForm} onSubmit={handleSubmit} isPending={createM.isPending || updateM.isPending} tenders={tenders} companies={companies} />

      {correspondenceFor && (
        <CorrespondenceSheet
          open={!!correspondenceFor}
          onOpenChange={(o) => !o && setCorrespondenceFor(null)}
          sourceType="contract"
          sourceId={correspondenceFor.id}
          recordLabel={correspondenceFor.label}
          governmentEntityId={correspondenceFor.governmentEntityId}
        />
      )}

      {openDrawer && (
        <ContractDrawer
          contract={openDrawer}
          onClose={() => setOpenDrawer(null)}
          isAdmin={isAdmin}
          currentUserId={user?.id ?? 0}
          employees={employees}
        />
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>إدارة العقود</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>اختر تصنيفاً أدناه لعرض العقود · انقر على صف لعرض الملفات والتعليقات</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {(isAdmin || user?.canDownload) && (
            <button onClick={() => exportContractsToExcel(contracts as any[])} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "white", border: "1.5px solid #e5e7eb", color: "#374151", fontFamily: "inherit" }}>
              <Download size={15} /> تصدير
            </button>
          )}
          {(isAdmin || user?.canEdit) && (
            <button onClick={() => { closeForm(); setShowForm(true); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 4px 14px rgba(212,165,52,0.4)` }}>
              <Plus size={15} /> عقد جديد
            </button>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
        {STAT_CARDS.map(card => {
          const active = tab === card.id;
          const count  = getCount(card.id);
          return (
            <button key={card.id} onClick={() => setTab(card.id)}
              style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14, padding: "20px 20px 18px", borderRadius: 18, cursor: "pointer", fontFamily: "inherit", textAlign: "right", position: "relative", overflow: "hidden", background: active ? card.bg : "white", border: active ? `2px solid ${card.color}40` : "1.5px solid #f0ead8", boxShadow: active ? `0 6px 24px ${card.color}22` : "0 2px 10px rgba(0,0,0,0.04)", transform: active ? "translateY(-2px)" : "translateY(0)", transition: "all 0.18s ease" }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: active ? `${card.color}18` : `${card.color}0f`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${card.color}${active ? "30" : "18"}` }}>
                <card.icon size={20} color={card.color} strokeWidth={1.8} />
              </div>
              <div style={{ width: "100%" }}>
                <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: active ? card.color : "#1e293b" }}>{count}</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, color: active ? card.color : "#6b7280" }}>{card.label}</div>
              </div>
              {active && <div style={{ position: "absolute", bottom: 0, right: 0, left: 0, height: 3, borderRadius: "0 0 18px 18px", background: `linear-gradient(90deg,${card.color}40,${card.color},${card.color}40)` }} />}
            </button>
          );
        })}
      </div>

      {/* ── Table ── */}
      <div style={{ background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <div style={{ padding: "12px 20px", background: "#fdf8ec", borderBottom: "1.5px solid #f0ead8", display: "flex", alignItems: "center", gap: 8 }}>
          <activeCard.icon size={15} color={activeCard.color} />
          <span style={{ fontSize: 13, fontWeight: 700, color: GR }}>{activeCard.label}</span>
          {!isLoading && <span style={{ marginRight: "auto", fontSize: 11, fontWeight: 700, background: `${activeCard.color}15`, color: activeCard.color, border: `1px solid ${activeCard.color}25`, borderRadius: 20, padding: "2px 10px" }}>{(contracts as any[]).length}</span>}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "right" }}>
            <thead>
              <tr style={{ background: "#fafaf8" }}>
                {[
                  { label: "رقم العقد",      icon: FileSignature },
                  { label: "الجهة الحكومية", icon: Building2     },
                  { label: "المناقصة",        icon: null          },
                  { label: "قيمة العقد",     icon: Banknote      },
                  { label: "تاريخ التوقيع",  icon: CalendarDays  },
                  { label: "تاريخ الانتهاء", icon: CalendarDays  },
                  { label: "الحالة",          icon: null          },
                  { label: "الكفالة النهائية", icon: Landmark      },
                  { label: "إجراءات",         icon: null          },
                ].map((h, i) => (
                  <th key={i} style={{ padding: "12px 16px", fontWeight: 700, fontSize: 11, color: "#6b7280", borderBottom: "1.5px solid #f0ead8", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      {h.icon && <h.icon size={12} color="#9ca3af" />}
                      {h.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f5f0e6" }}>
                    {[...Array(9)].map((_, j) => <td key={j} style={{ padding: 16 }}><div style={{ height: 14, background: "#f1f5f9", borderRadius: 6, width: 80, animation: "pulse 1.5s infinite" }} /></td>)}
                  </tr>
                ))
              ) : !(contracts as any[]).length ? (
                <tr>
                  <td colSpan={9} style={{ padding: "64px 0", textAlign: "center" }}>
                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 72, height: 72, borderRadius: 20, background: "#fdf8ec", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FileSignature size={30} color="#e2d5b0" />
                      </div>
                      <p style={{ color: "#94a3b8", fontSize: 14, margin: 0, fontWeight: 600 }}>لا توجد عقود في هذا التصنيف</p>
                    </div>
                  </td>
                </tr>
              ) : (
                (contracts as any[]).map((c: any, idx: number) => {
                  const st = STATUS_MAP[c.status] || STATUS_MAP.active;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setOpenDrawer(c)}
                      style={{
                        borderBottom: idx < (contracts as any[]).length - 1 ? "1px solid #f5f0e6" : "none",
                        cursor: "pointer", transition: "background 0.1s",
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#fffdf5"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "white"}
                    >
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: GD }}>{c.contractNumber}</span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#374151", fontSize: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><Building2 size={13} color="#9ca3af" />{c.entityName || "—"}</div></td>
                      <td style={{ padding: "14px 16px", fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{c.tenderNumber || "—"}</td>
                      <td style={{ padding: "14px 16px", fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "#374151" }}>{c.contractValue ? formatCurrency(c.contractValue) : "—"}</td>
                      <td style={{ padding: "14px 16px", color: "#6b7280", fontSize: 12 }}>{formatDate(c.signDate)}</td>
                      <td style={{ padding: "14px 16px", color: "#6b7280", fontSize: 12 }}>{formatDate(c.endDate)}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.color}22` }}>
                          <st.icon size={11} />{st.label}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {(() => {
                          if (!c.finalBondValue && !c.finalBondNumber) return <span style={{ color: "#9ca3af", fontSize: 11 }}>—</span>;
                          const bs = BOND_STATUS_MAP[c.finalBondStatus ?? "active"] ?? BOND_STATUS_MAP.active;
                          // Expiry check — distinguish expired vs near-expiry
                          let expiryNote: React.ReactNode = null;
                          if (c.finalBondExpiryDate) {
                            const diff = Math.ceil((new Date(c.finalBondExpiryDate).getTime() - Date.now()) / 86400000);
                            if (diff < 0)        expiryNote = <span style={{ fontSize:10, color:"#dc2626", display:"flex", alignItems:"center", gap:3 }}><AlertTriangle size={9}/>منتهية الصلاحية</span>;
                            else if (diff <= 30) expiryNote = <span style={{ fontSize:10, color:"#d97706", display:"flex", alignItems:"center", gap:3 }}><AlertTriangle size={9}/>قريبة الانتهاء</span>;
                          }
                          return (
                            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                              <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, background:bs.bg, color:bs.color, display:"inline-flex", alignItems:"center", gap:4 }}>
                                <Landmark size={9}/>{bs.label}
                              </span>
                              {c.finalBondValue && <span style={{ fontFamily:"monospace", fontSize:11, color:"#6b7280" }}>{formatCurrency(Number(c.finalBondValue))}</span>}
                              {expiryNote}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "14px 16px" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                          {/* Attachments indicator */}
                          <button onClick={() => { setOpenDrawer(c); }} title="المرفقات والتعليقات" style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", cursor: "pointer", fontFamily: "inherit" }}>
                            <Paperclip size={11} />
                          </button>
                          <button onClick={() => setCorrespondenceFor({ id: c.id, label: c.contractNumber, governmentEntityId: c.governmentEntityId ?? null })} title="المراسلات" style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", cursor: "pointer", fontFamily: "inherit" }}>
                            <Mail size={11} />
                          </button>

                          {(isAdmin || user?.canEdit) && (
                            <>
                              <button onClick={() => openEdit(c)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", cursor: "pointer", fontFamily: "inherit" }}>
                                <Pencil size={11} /> تعديل
                              </button>
                              <button onClick={() => { if (confirm("هل تريد حذف هذا العقد؟")) deleteM.mutate(c.id); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", fontFamily: "inherit" }}>
                                <Trash2 size={11} /> حذف
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}
