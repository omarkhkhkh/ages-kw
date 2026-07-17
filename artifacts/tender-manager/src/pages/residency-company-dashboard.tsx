import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { residencyApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { exportWorkersToExcel } from "@/lib/export";
import { printWorkersReport } from "@/lib/print-workers-report";
import FileUpload, { objectPathToUrl } from "@/components/file-upload";
import {
  ArrowRight, Plus, Search, X, Save, Users, UserRound, IdCard,
  AlertTriangle, FileDown, Printer,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: GR, marginBottom: 5 };
const cardStyle: React.CSSProperties = { background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "16px 18px" };

interface Worker {
  id: number; companyId: number; photoUrl: string | null;
  fullName: string; nationality: string | null; civilId: string | null;
  jobTitle: string | null; department: string | null; assignedModule: string | null; salary: string | null;
  hireDate: string | null; sponsor: string | null; status: string;
  residencyNumber: string | null; residencyExpiry: string | null;
  passportNumber: string | null; passportExpiry: string | null;
  healthInsuranceNumber: string | null; healthInsuranceExpiry: string | null;
  workPermitNumber: string | null; workPermitExpiry: string | null;
  notes: string | null;
}

const emptyForm = {
  photoUrl: null as string | null, fullName: "", nationality: "", civilId: "", jobTitle: "", department: "",
  assignedModule: "", salary: "", hireDate: "", sponsor: "", status: "active",
  residencyNumber: "", residencyExpiry: "", passportNumber: "", passportExpiry: "",
  healthInsuranceNumber: "", healthInsuranceExpiry: "", workPermitNumber: "", workPermitExpiry: "",
  notes: "",
};

const STATUS_LABELS: Record<string, string> = { active: "نشط", inactive: "غير نشط", terminated: "منتهي الخدمة" };

/** 🟢 >60 يوم | 🟡 0-60 يوم | 🔴 منتهية */
function residencyBadge(dateStr: string | null): { emoji: string; color: string; bg: string; label: string } {
  if (!dateStr) return { emoji: "⚪", color: "#6b7280", bg: "#f3f4f6", label: "—" };
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (days < 0) return { emoji: "🔴", color: "#dc2626", bg: "#fff1f2", label: `منتهية منذ ${Math.abs(days)} يوم` };
  if (days <= 60) return { emoji: "🟡", color: "#d97706", bg: "#fffbeb", label: `${days} يوم متبقي` };
  return { emoji: "🟢", color: "#16a34a", bg: "#f0fdf4", label: dateStr };
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "white", borderRadius: 14, border: "1.5px solid #f0ead8", padding: "12px 14px" }}>
      <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 5 }}>{label}</div>
    </div>
  );
}

export default function ResidencyCompanyDashboard() {
  const params = useParams();
  const companyId = Number(params.companyId);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || !!user?.canEdit;
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [nationalityFilter, setNationalityFilter] = useState("");
  const [showAlerts, setShowAlerts] = useState(false);
  const [alertDays, setAlertDays] = useState(30);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: companies = [] } = useQuery<any[]>({ queryKey: ["residency-companies"], queryFn: () => residencyApi.companies.list() });
  const company = companies.find((c) => c.id === companyId);

  const { data: stats } = useQuery<any>({
    queryKey: ["residency-company-stats", companyId],
    queryFn: () => residencyApi.companies.stats(companyId),
    enabled: !!companyId,
  });

  const { data: workers = [], isLoading } = useQuery<Worker[]>({
    queryKey: ["residency-workers", companyId],
    queryFn: () => residencyApi.workers.list({ companyId }),
    enabled: !!companyId,
  });

  const { data: alerts = [] } = useQuery<any[]>({
    queryKey: ["residency-alerts", companyId, alertDays],
    queryFn: () => residencyApi.alerts({ companyId, days: alertDays }),
    enabled: !!companyId && showAlerts,
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const createMut = useMutation({
    mutationFn: (d: any) => residencyApi.workers.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["residency-workers", companyId] });
      qc.invalidateQueries({ queryKey: ["residency-company-stats", companyId] });
      qc.invalidateQueries({ queryKey: ["residency-companies"] });
      setDrawerOpen(false);
    },
  });

  const handleSave = () => {
    if (!form.fullName.trim()) return;
    createMut.mutate({
      companyId,
      photoUrl: form.photoUrl,
      fullName: form.fullName.trim(),
      nationality: form.nationality || null,
      civilId: form.civilId || null,
      jobTitle: form.jobTitle || null,
      department: form.department || null,
      assignedModule: form.assignedModule || null,
      salary: form.salary || null,
      hireDate: form.hireDate || null,
      sponsor: form.sponsor || null,
      status: form.status,
      residencyNumber: form.residencyNumber || null,
      residencyExpiry: form.residencyExpiry || null,
      passportNumber: form.passportNumber || null,
      passportExpiry: form.passportExpiry || null,
      healthInsuranceNumber: form.healthInsuranceNumber || null,
      healthInsuranceExpiry: form.healthInsuranceExpiry || null,
      workPermitNumber: form.workPermitNumber || null,
      workPermitExpiry: form.workPermitExpiry || null,
      notes: form.notes || null,
    });
  };

  const filtered = workers.filter((w) => {
    const q = search.toLowerCase();
    const matchQ = !q || w.fullName.toLowerCase().includes(q) || (w.residencyNumber ?? "").toLowerCase().includes(q) ||
      (w.civilId ?? "").toLowerCase().includes(q) || (w.passportNumber ?? "").toLowerCase().includes(q);
    return matchQ && (!statusFilter || w.status === statusFilter) && (!nationalityFilter || w.nationality === nationalityFilter);
  });

  const nationalities = Array.from(new Set(workers.map((w) => w.nationality).filter(Boolean))) as string[];

  const natChartData = (stats?.byNationality ?? []).slice(0, 8).map((r: any) => ({ name: r.nationality, value: r.count }));
  const deptChartData = (stats?.byDepartment ?? []).slice(0, 8).map((r: any) => ({ name: r.department, value: r.count }));
  const statusColors: Record<string, string> = { green: "#16a34a", yellow: "#d97706", red: "#dc2626" };
  const statusChartData = (stats?.byResidencyStatus ?? []).map((r: any) => ({ name: r.label, value: r.count, fill: statusColors[r.status] }));

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <button onClick={() => navigate("/residency")} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: 0, marginBottom: 8 }}>
            <ArrowRight size={13} /> الشركات الكفيلة
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: GR, margin: 0 }}>{company?.name ?? "..."}</h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowAlerts((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: showAlerts ? "#fff1f2" : "white", border: `1.5px solid ${showAlerts ? "#fecaca" : "#e5e7eb"}`, color: showAlerts ? "#dc2626" : "#374151", cursor: "pointer", fontFamily: "inherit" }}>
            <AlertTriangle size={13} /> التنبيهات
          </button>
          <button onClick={() => exportWorkersToExcel(filtered)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "white", border: "1.5px solid #e5e7eb", color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>
            <FileDown size={13} /> Excel
          </button>
          <button onClick={() => printWorkersReport(company?.name ?? "", filtered)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "white", border: "1.5px solid #e5e7eb", color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>
            <Printer size={13} /> PDF
          </button>
          {canEdit && (
            <button onClick={() => { setForm({ ...emptyForm }); setDrawerOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit" }}>
              <Plus size={14} /> عامل جديد
            </button>
          )}
        </div>
      </div>

      {/* Alerts panel */}
      {showAlerts && (
        <div style={{ ...cardStyle, borderColor: "#fecaca" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={15} color="#dc2626" />
              <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>مستندات تنتهي خلال</span>
            </div>
            <select value={alertDays} onChange={(e) => setAlertDays(Number(e.target.value))} style={{ ...inp, width: "auto", padding: "6px 10px" }}>
              {[7, 15, 30, 60, 90].map((d) => <option key={d} value={d}>{d} يوم</option>)}
            </select>
          </div>
          {alerts.length === 0 ? (
            <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 12.5, padding: "16px 0", margin: 0 }}>لا توجد تنبيهات خلال {alertDays} يوم</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {alerts.map((a: any) => (
                <div key={a.id} onClick={() => navigate(`/residency/${companyId}/workers/${a.id}`)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: "#fff1f2", border: "1px solid #fecaca", cursor: "pointer", fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: GR }}>{a.fullName}</span>
                  <span style={{ color: "#dc2626", fontSize: 11 }}>
                    {[
                      a.residencyExpiry && `إقامة: ${a.residencyExpiry}`,
                      a.passportExpiry && `جواز: ${a.passportExpiry}`,
                      a.healthInsuranceExpiry && `تأمين: ${a.healthInsuranceExpiry}`,
                      a.workPermitExpiry && `إذن عمل: ${a.workPermitExpiry}`,
                    ].filter(Boolean).join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stat cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
          <StatCard label="عدد العمال" value={stats.total} color={GD} />
          <StatCard label="الإقامات المنتهية" value={stats.residencyExpired} color="#dc2626" />
          <StatCard label="تنتهي خلال 30 يوم" value={stats.residencyExpiring30} color="#d97706" />
          <StatCard label="الجوازات المنتهية" value={stats.passportExpired} color="#dc2626" />
          <StatCard label="التأمين الصحي منتهي" value={stats.insuranceExpired} color="#dc2626" />
          <StatCard label="أذونات العمل منتهية" value={stats.workPermitExpired} color="#dc2626" />
        </div>
      )}

      {/* Charts */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 800, color: GR, margin: "0 0 10px" }}>العمال حسب الجنسية</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={natChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
                <Bar dataKey="value" fill={G} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 800, color: GR, margin: "0 0 10px" }}>العمال حسب القسم</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={deptChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
                <Bar dataKey="value" fill="#2563eb" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 800, color: GR, margin: "0 0 10px" }}>العمال حسب حالة الإقامة</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={statusChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
                <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                  {statusChartData.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "14px 18px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم، رقم الإقامة، المدني، الجواز..." style={{ ...inp, paddingRight: 36 }} />
        </div>
        <select value={nationalityFilter} onChange={(e) => setNationalityFilter(e.target.value)} style={{ ...inp, width: "auto" }}>
          <option value="">كل الجنسيات</option>
          {nationalities.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inp, width: "auto" }}>
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Worker table */}
      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>جارِ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Users size={40} color="#e2d5b0" style={{ margin: "0 auto 10px", display: "block" }} />
            <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>لا يوجد عمال مطابقون</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" }}>
                <tr>
                  {["", "الاسم", "الجنسية", "المسمى", "رقم الإقامة", "انتهاء الإقامة", "الحالة"].map((h) => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: "#4a3f1a", fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => {
                  const b = residencyBadge(w.residencyExpiry);
                  const photoUrl = objectPathToUrl(w.photoUrl);
                  return (
                    <tr key={w.id} onClick={() => navigate(`/residency/${companyId}/workers/${w.id}`)} style={{ borderBottom: "1px solid #f5f0e6", cursor: "pointer" }}>
                      <td style={{ padding: "10px 14px", width: 40 }}>
                        {photoUrl ? <img src={photoUrl} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} /> : <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}><UserRound size={14} color="#9ca3af" /></div>}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: GR }}>{w.fullName}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{w.nationality ?? "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{w.jobTitle ?? "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563", fontFamily: "monospace" }}>{w.residencyNumber ?? "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#4b5563" }}>{w.residencyExpiry ?? "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span title={b.label} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, background: b.bg, color: b.color, fontSize: 11, fontWeight: 700 }}>
                          {b.emoji} {b.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add worker drawer */}
      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(11,26,16,0.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(6px)" }}>
          <div onClick={(e) => e.stopPropagation()} dir="rtl" style={{ width: "100%", maxWidth: 640, maxHeight: "92vh", background: "white", borderRadius: 22, boxShadow: "0 40px 100px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 22px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <IdCard size={16} color={G} />
                <h2 style={{ color: "white", fontSize: 14.5, fontWeight: 800, margin: 0 }}>عامل جديد</h2>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={15} color="white" />
              </button>
            </div>
            <div style={{ overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={lbl}>الصورة الشخصية</label><FileUpload objectPath={form.photoUrl} onChange={(p) => set("photoUrl", p)} accept="image/*" label="رفع صورة" /></div>

              <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase" }}>بيانات أساسية</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lbl}>الاسم الكامل *</label><input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} style={inp} /></div>
                <div><label style={lbl}>الجنسية</label><input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} style={inp} /></div>
                <div><label style={lbl}>رقم المدني</label><input value={form.civilId} onChange={(e) => set("civilId", e.target.value)} dir="ltr" style={inp} /></div>
                <div><label style={lbl}>المسمى الوظيفي</label><input value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} style={inp} /></div>
                <div><label style={lbl}>القسم</label><input value={form.department} onChange={(e) => set("department", e.target.value)} style={inp} /></div>
                <div><label style={lbl}>القسم المرتبط (للربط المالي)</label>
                  <select value={form.assignedModule} onChange={(e) => set("assignedModule", e.target.value)} style={inp}>
                    <option value="">— بدون —</option>
                    <option value="maintenance">الصيانة</option>
                    <option value="transportation">النقل والمركبات</option>
                  </select>
                </div>
                <div><label style={lbl}>الراتب (د.ك)</label><input type="number" value={form.salary} onChange={(e) => set("salary", e.target.value)} dir="ltr" style={inp} /></div>
                <div><label style={lbl}>تاريخ التعيين</label><input type="date" value={form.hireDate} onChange={(e) => set("hireDate", e.target.value)} style={inp} /></div>
                <div><label style={lbl}>الكفيل</label><input value={form.sponsor} onChange={(e) => set("sponsor", e.target.value)} style={inp} /></div>
                <div><label style={lbl}>الحالة</label><select value={form.status} onChange={(e) => set("status", e.target.value)} style={inp}>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 6 }}>الإقامة والجواز</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lbl}>رقم الإقامة</label><input value={form.residencyNumber} onChange={(e) => set("residencyNumber", e.target.value)} dir="ltr" style={inp} /></div>
                <div><label style={lbl}>تاريخ انتهاء الإقامة</label><input type="date" value={form.residencyExpiry} onChange={(e) => set("residencyExpiry", e.target.value)} style={inp} /></div>
                <div><label style={lbl}>رقم الجواز</label><input value={form.passportNumber} onChange={(e) => set("passportNumber", e.target.value)} dir="ltr" style={inp} /></div>
                <div><label style={lbl}>تاريخ انتهاء الجواز</label><input type="date" value={form.passportExpiry} onChange={(e) => set("passportExpiry", e.target.value)} style={inp} /></div>
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 6 }}>التأمين وإذن العمل</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lbl}>رقم التأمين الصحي</label><input value={form.healthInsuranceNumber} onChange={(e) => set("healthInsuranceNumber", e.target.value)} dir="ltr" style={inp} /></div>
                <div><label style={lbl}>تاريخ انتهاء التأمين</label><input type="date" value={form.healthInsuranceExpiry} onChange={(e) => set("healthInsuranceExpiry", e.target.value)} style={inp} /></div>
                <div><label style={lbl}>رقم إذن العمل</label><input value={form.workPermitNumber} onChange={(e) => set("workPermitNumber", e.target.value)} dir="ltr" style={inp} /></div>
                <div><label style={lbl}>تاريخ انتهاء إذن العمل</label><input type="date" value={form.workPermitExpiry} onChange={(e) => set("workPermitExpiry", e.target.value)} style={inp} /></div>
              </div>

              <div><label style={lbl}>ملاحظات</label><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} style={{ ...inp, resize: "vertical" } as any} /></div>
            </div>
            <div style={{ padding: "16px 22px", borderTop: "1px solid #f0ead8", display: "flex", gap: 10, flexShrink: 0, background: "#fdfbf7" }}>
              <button onClick={() => setDrawerOpen(false)} style={{ padding: "10px 20px", borderRadius: 10, background: "white", color: "#6b7280", border: "1.5px solid #e5e7eb", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
              <button onClick={handleSave} disabled={createMut.isPending} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 10, background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                <Save size={14} /> إضافة العامل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
