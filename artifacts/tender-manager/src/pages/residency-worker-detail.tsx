import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { residencyApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import FileUpload, { objectPathToUrl } from "@/components/file-upload";
import { ArrowRight, Save, Trash2, UserRound, Plus, X, Clock } from "lucide-react";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: GR, marginBottom: 5 };
const cardStyle: React.CSSProperties = { background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px" };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 };

const STATUS_LABELS: Record<string, string> = { active: "نشط", inactive: "غير نشط", terminated: "منتهي الخدمة" };

const DOC_TYPES = [
  { key: "passport_photo", label: "صورة الجواز" },
  { key: "residency_photo", label: "صورة الإقامة" },
  { key: "work_permit", label: "إذن العمل" },
  { key: "civil_id", label: "البطاقة المدنية" },
  { key: "health_insurance", label: "التأمين الصحي" },
  { key: "employment_contract", label: "عقد العمل" },
  { key: "personal_photo", label: "صورة شخصية" },
  { key: "driving_license", label: "شهادة القيادة (إن وجدت)" },
];

export default function ResidencyWorkerDetail() {
  const params = useParams();
  const companyId = Number(params.companyId);
  const workerId = Number(params.workerId);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || !!user?.canEdit;
  const qc = useQueryClient();

  const [form, setForm] = useState<any>(null);
  const [historyForm, setHistoryForm] = useState({ operationType: "", oldValue: "", newValue: "", effectiveDate: "", notes: "" });
  const [showHistoryForm, setShowHistoryForm] = useState(false);

  const { data: worker } = useQuery<any>({
    queryKey: ["residency-worker", workerId],
    queryFn: () => residencyApi.workers.get(workerId),
    enabled: !!workerId,
  });
  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["residency-worker-docs", workerId],
    queryFn: () => residencyApi.documents.list(workerId),
    enabled: !!workerId,
  });
  const { data: history = [] } = useQuery<any[]>({
    queryKey: ["residency-worker-history", workerId],
    queryFn: () => residencyApi.history.list(workerId),
    enabled: !!workerId,
  });

  useEffect(() => {
    if (worker) setForm({ ...worker, salary: worker.salary ?? "" });
  }, [worker]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const updateMut = useMutation({
    mutationFn: (d: any) => residencyApi.workers.update(workerId, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["residency-worker", workerId] });
      qc.invalidateQueries({ queryKey: ["residency-worker-history", workerId] });
      qc.invalidateQueries({ queryKey: ["residency-workers", companyId] });
      qc.invalidateQueries({ queryKey: ["residency-company-stats", companyId] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: () => residencyApi.workers.delete(workerId),
    onSuccess: () => navigate(`/residency/${companyId}`),
  });
  const docUpsertMut = useMutation({
    mutationFn: ({ type, path }: { type: string; path: string }) => residencyApi.documents.upsert(workerId, type, { fileUrl: path }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["residency-worker-docs", workerId] }),
  });
  const docDeleteMut = useMutation({
    mutationFn: (type: string) => residencyApi.documents.delete(workerId, type),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["residency-worker-docs", workerId] }),
  });
  const historyAddMut = useMutation({
    mutationFn: (d: any) => residencyApi.history.add(workerId, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["residency-worker-history", workerId] });
      setShowHistoryForm(false);
      setHistoryForm({ operationType: "", oldValue: "", newValue: "", effectiveDate: "", notes: "" });
    },
  });

  const handleSaveInfo = () => {
    if (!form?.fullName?.trim()) return;
    updateMut.mutate({
      photoUrl: form.photoUrl || null,
      fullName: form.fullName.trim(),
      nationality: form.nationality || null,
      civilId: form.civilId || null,
      jobTitle: form.jobTitle || null,
      department: form.department || null,
      assignedModule: form.assignedModule || null,
      salary: form.salary || null,
      hireDate: form.hireDate || null,
      sponsor: form.sponsor || null,
      status: form.status || "active",
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

  const handlePhotoChange = (path: string | null) => {
    set("photoUrl", path);
    updateMut.mutate({ photoUrl: path });
  };

  if (!worker || !form) {
    return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>جارِ التحميل...</div>;
  }

  const photoUrl = objectPathToUrl(form.photoUrl);

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <button onClick={() => navigate(`/residency/${companyId}`)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: 0, marginBottom: 8 }}>
            <ArrowRight size={13} /> رجوع لقائمة العمال
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {photoUrl ? <img src={photoUrl} style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover" }} /> : <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}><UserRound size={22} color="#9ca3af" /></div>}
            <div>
              <h1 style={{ fontSize: 19, fontWeight: 800, color: GR, margin: 0 }}>{worker.fullName}</h1>
              <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>{worker.jobTitle ?? "—"} · {worker.nationality ?? "—"}</p>
            </div>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => { if (confirm(`حذف العامل ${worker.fullName}؟`)) deleteMut.mutate(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#fff1f2", border: "1.5px solid #fecaca", color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}>
            <Trash2 size={13} /> حذف العامل
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        {/* Left: worker info */}
        <div style={cardStyle}>
          <div style={sectionTitle}>الصورة الشخصية</div>
          <div style={{ marginBottom: 16 }}>
            <FileUpload objectPath={form.photoUrl} onChange={handlePhotoChange} accept="image/*" label="رفع صورة" disabled={!canEdit} />
          </div>

          <div style={sectionTitle}>بيانات أساسية</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div><label style={lbl}>الاسم الكامل *</label><input value={form.fullName ?? ""} onChange={(e) => set("fullName", e.target.value)} style={inp} disabled={!canEdit} /></div>
            <div><label style={lbl}>الجنسية</label><input value={form.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} style={inp} disabled={!canEdit} /></div>
            <div><label style={lbl}>رقم المدني</label><input value={form.civilId ?? ""} onChange={(e) => set("civilId", e.target.value)} dir="ltr" style={inp} disabled={!canEdit} /></div>
            <div><label style={lbl}>المسمى الوظيفي</label><input value={form.jobTitle ?? ""} onChange={(e) => set("jobTitle", e.target.value)} style={inp} disabled={!canEdit} /></div>
            <div><label style={lbl}>القسم</label><input value={form.department ?? ""} onChange={(e) => set("department", e.target.value)} style={inp} disabled={!canEdit} /></div>
            <div><label style={lbl}>القسم المرتبط (للربط المالي)</label>
              <select value={form.assignedModule ?? ""} onChange={(e) => set("assignedModule", e.target.value)} style={inp} disabled={!canEdit}>
                <option value="">— بدون —</option>
                <option value="maintenance">الصيانة</option>
                <option value="transportation">النقل والمركبات</option>
              </select>
            </div>
            <div><label style={lbl}>الراتب (د.ك)</label><input type="number" value={form.salary ?? ""} onChange={(e) => set("salary", e.target.value)} dir="ltr" style={inp} disabled={!canEdit} /></div>
            <div><label style={lbl}>تاريخ التعيين</label><input type="date" value={form.hireDate ?? ""} onChange={(e) => set("hireDate", e.target.value)} style={inp} disabled={!canEdit} /></div>
            <div><label style={lbl}>الكفيل</label><input value={form.sponsor ?? ""} onChange={(e) => set("sponsor", e.target.value)} style={inp} disabled={!canEdit} /></div>
            <div><label style={lbl}>الحالة</label><select value={form.status ?? "active"} onChange={(e) => set("status", e.target.value)} style={inp} disabled={!canEdit}>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>

          <div style={sectionTitle}>الإقامة والجواز</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div><label style={lbl}>رقم الإقامة</label><input value={form.residencyNumber ?? ""} onChange={(e) => set("residencyNumber", e.target.value)} dir="ltr" style={inp} disabled={!canEdit} /></div>
            <div><label style={lbl}>تاريخ انتهاء الإقامة</label><input type="date" value={form.residencyExpiry ?? ""} onChange={(e) => set("residencyExpiry", e.target.value)} style={inp} disabled={!canEdit} /></div>
            <div><label style={lbl}>رقم الجواز</label><input value={form.passportNumber ?? ""} onChange={(e) => set("passportNumber", e.target.value)} dir="ltr" style={inp} disabled={!canEdit} /></div>
            <div><label style={lbl}>تاريخ انتهاء الجواز</label><input type="date" value={form.passportExpiry ?? ""} onChange={(e) => set("passportExpiry", e.target.value)} style={inp} disabled={!canEdit} /></div>
          </div>

          <div style={sectionTitle}>التأمين وإذن العمل</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div><label style={lbl}>رقم التأمين الصحي</label><input value={form.healthInsuranceNumber ?? ""} onChange={(e) => set("healthInsuranceNumber", e.target.value)} dir="ltr" style={inp} disabled={!canEdit} /></div>
            <div><label style={lbl}>تاريخ انتهاء التأمين</label><input type="date" value={form.healthInsuranceExpiry ?? ""} onChange={(e) => set("healthInsuranceExpiry", e.target.value)} style={inp} disabled={!canEdit} /></div>
            <div><label style={lbl}>رقم إذن العمل</label><input value={form.workPermitNumber ?? ""} onChange={(e) => set("workPermitNumber", e.target.value)} dir="ltr" style={inp} disabled={!canEdit} /></div>
            <div><label style={lbl}>تاريخ انتهاء إذن العمل</label><input type="date" value={form.workPermitExpiry ?? ""} onChange={(e) => set("workPermitExpiry", e.target.value)} style={inp} disabled={!canEdit} /></div>
          </div>

          <div style={{ marginBottom: 16 }}><label style={lbl}>ملاحظات</label><textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} style={{ ...inp, resize: "vertical" } as any} disabled={!canEdit} /></div>

          {canEdit && (
            <button onClick={handleSaveInfo} disabled={updateMut.isPending} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", width: "100%", borderRadius: 10, background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <Save size={14} /> {updateMut.isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </button>
          )}
        </div>

        {/* Right: documents + history */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={cardStyle}>
            <div style={sectionTitle}>المستندات</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {DOC_TYPES.map((dt) => {
                const doc = documents.find((d) => d.documentType === dt.key);
                return (
                  <div key={dt.key}>
                    <label style={lbl}>{dt.label}</label>
                    <FileUpload
                      objectPath={doc?.fileUrl ?? null}
                      onChange={(path) => { if (path) docUpsertMut.mutate({ type: dt.key, path }); else docDeleteMut.mutate(dt.key); }}
                      label={`رفع ${dt.label}`}
                      disabled={!canEdit}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={sectionTitle}>سجل التجديد</div>
              {canEdit && (
                <button onClick={() => setShowHistoryForm((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, background: "white", border: `1px solid ${G}88`, color: GD, cursor: "pointer", fontFamily: "inherit" }}>
                  <Plus size={12} /> إضافة قيد
                </button>
              )}
            </div>

            {showHistoryForm && (
              <div style={{ padding: "12px", borderRadius: 10, border: "1.5px solid #e5e7eb", marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <input value={historyForm.operationType} onChange={(e) => setHistoryForm((f) => ({ ...f, operationType: e.target.value }))} placeholder="نوع العملية (مثال: تعديل مهنة)" style={inp} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input value={historyForm.oldValue} onChange={(e) => setHistoryForm((f) => ({ ...f, oldValue: e.target.value }))} placeholder="القيمة القديمة" style={inp} />
                  <input value={historyForm.newValue} onChange={(e) => setHistoryForm((f) => ({ ...f, newValue: e.target.value }))} placeholder="القيمة الجديدة" style={inp} />
                </div>
                <input type="date" value={historyForm.effectiveDate} onChange={(e) => setHistoryForm((f) => ({ ...f, effectiveDate: e.target.value }))} style={inp} />
                <textarea value={historyForm.notes} onChange={(e) => setHistoryForm((f) => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات" rows={2} style={{ ...inp, resize: "vertical" } as any} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowHistoryForm(false)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "white", color: "#6b7280", border: "1.5px solid #e5e7eb", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
                  <button onClick={() => historyAddMut.mutate(historyForm)} disabled={!historyForm.operationType.trim() || historyAddMut.isPending} style={{ flex: 2, padding: "8px 0", borderRadius: 8, background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit" }}>حفظ</button>
                </div>
              </div>
            )}

            {history.length === 0 ? (
              <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 12.5, padding: "16px 0", margin: 0 }}>لا يوجد سجل تجديد بعد</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map((h) => (
                  <div key={h.id} style={{ padding: "10px 12px", borderRadius: 10, background: "#fafaf8", border: "1px solid #f0ead8" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: GR }}>{h.operationType}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#9ca3af" }}><Clock size={10} />{new Date(h.createdAt).toLocaleDateString("ar-KW")}</span>
                    </div>
                    {(h.oldValue || h.newValue) && (
                      <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 3 }}>{h.oldValue ?? "—"} ← {h.newValue ?? "—"}</div>
                    )}
                    {h.createdByName && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>بواسطة: {h.createdByName}</div>}
                    {h.notes && <div style={{ fontSize: 11.5, color: "#374151", marginTop: 4 }}>{h.notes}</div>}
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
