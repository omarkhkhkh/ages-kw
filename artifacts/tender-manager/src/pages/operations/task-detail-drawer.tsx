import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useUpload } from "@workspace/object-storage-web";
import { tasksApi } from "@/lib/api";
import { objectPathToUrl } from "@/components/file-upload";
import { useToast } from "@/hooks/use-toast";
import {
  X, Info, ListChecks, MessageSquare, Paperclip, ThumbsUp, History,
  Check, Plus, Trash2, Download, Loader2, ExternalLink, Star,
} from "lucide-react";
import { PRIORITY_MAP, STATUS_MAP, STATUS_ORDER, LINKED_ENTITY_LABELS, fmtDate, GR, GD, G } from "./shared";
import TimelineView from "./timeline-view";

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "8px 11px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "white", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: GR, marginBottom: 5 };
const tabBtn = (active: boolean): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit", border: "none",
  background: active ? `linear-gradient(135deg,${G},${GD})` : "transparent", color: active ? "white" : "#6b7280",
});

const LINKED_ENTITY_ROUTES: Record<string, string> = {
  tender: "/tenders", contract: "/contracts", purchaseOrder: "/purchase-orders",
  project: "/projects", governmentEntity: "/entities", supplier: "/suppliers",
};

export default function TaskDetailDrawer({ taskId, isAdmin, canApprove, currentUserId, onClose }: {
  taskId: number; isAdmin: boolean; canApprove: boolean; currentUserId: number | null; onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"info" | "stages" | "comments" | "attachments" | "approvals" | "activity">("info");
  const [newStage, setNewStage] = useState("");
  const [commentText, setCommentText] = useState("");

  const { data: task, isLoading } = useQuery<any>({ queryKey: ["op-task-detail", taskId], queryFn: () => tasksApi.get(taskId) });
  const { data: employees = [] } = useQuery<{ id: number; fullName: string }[]>({ queryKey: ["users-directory"], queryFn: () => fetch("/api/users/directory", { credentials: "include" }).then(r => r.json()) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["op-task-detail", taskId] });
    qc.invalidateQueries({ queryKey: ["op-tasks"] });
  };

  const updateMut = useMutation({ mutationFn: (data: any) => tasksApi.update(taskId, data), onSuccess: invalidate });
  const deleteMut = useMutation({ mutationFn: () => tasksApi.delete(taskId), onSuccess: () => { invalidate(); onClose(); } });

  const addStageMut = useMutation({ mutationFn: (title: string) => tasksApi.stages.create(taskId, { title }), onSuccess: () => { setNewStage(""); invalidate(); } });
  const toggleStageMut = useMutation({ mutationFn: ({ id, isDone }: any) => tasksApi.stages.update(taskId, id, { isDone }), onSuccess: invalidate });
  const deleteStageMut = useMutation({ mutationFn: (id: number) => tasksApi.stages.delete(taskId, id), onSuccess: invalidate });

  const addCommentMut = useMutation({ mutationFn: (content: string) => tasksApi.comments.create(taskId, content), onSuccess: () => { setCommentText(""); invalidate(); } });

  const deleteAttMut = useMutation({ mutationFn: (attId: number) => tasksApi.attachments.delete(taskId, attId), onSuccess: invalidate });
  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res: any) => tasksApi.attachments.create(taskId, { fileName: res.metadata.name, objectPath: res.objectPath }).then(invalidate),
    onError: (err: Error) => toast({ title: "فشل رفع الملف", description: err.message, variant: "destructive" }),
  });

  const decideApprovalMut = useMutation({ mutationFn: ({ gate, status }: any) => tasksApi.approvals.decide(taskId, gate, status), onSuccess: invalidate });

  if (isLoading || !task) return null;

  const pri = PRIORITY_MAP[task.priority] ?? PRIORITY_MAP.medium;
  const sta = STATUS_MAP[task.status] ?? STATUS_MAP.pending;
  const isOwnTask = task.assignedTo === currentUserId;
  const canEditFull = isAdmin;

  const TABS: { key: "info" | "stages" | "comments" | "attachments" | "approvals" | "activity"; label: string; icon: any; count?: number }[] = [
    { key: "info", label: "المعلومات", icon: Info },
    { key: "stages", label: "المراحل", icon: ListChecks, count: task.stages?.length },
    { key: "comments", label: "التعليقات", icon: MessageSquare, count: task.comments?.length },
    { key: "attachments", label: "المرفقات", icon: Paperclip, count: task.attachments?.length },
    { key: "approvals", label: "الاعتمادات", icon: ThumbsUp, count: task.approvals?.length },
    { key: "activity", label: "سجل النشاط", icon: History },
  ];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(11,26,16,0.55)", display: "flex", justifyContent: "flex-end", backdropFilter: "blur(3px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, background: "white", height: "100%", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.2)" }}>
        {/* Header */}
        <div style={{ padding: "18px 22px", background: `linear-gradient(135deg,${GR},#1e4028)`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ color: "white", fontSize: 16, fontWeight: 800, margin: 0 }}>{task.title}</h2>
              {task.linkedEntityType && (
                <button onClick={() => navigate(LINKED_ENTITY_ROUTES[task.linkedEntityType] ? `${LINKED_ENTITY_ROUTES[task.linkedEntityType]}/${task.linkedEntityId}` : "#")}
                  style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: G, fontSize: 11.5, marginTop: 4, padding: 0, fontFamily: "inherit" }}>
                  <ExternalLink size={11} /> {LINKED_ENTITY_LABELS[task.linkedEntityType] ?? task.linkedEntityType} {task.linkedEntityLabel ? `— ${task.linkedEntityLabel}` : ""}
                </button>
              )}
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <X size={15} color="rgba(255,255,255,0.7)" />
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ padding: "3px 10px", borderRadius: 10, background: sta.bg, color: sta.color, fontSize: 11, fontWeight: 700 }}>{sta.label}</span>
            <span style={{ padding: "3px 10px", borderRadius: 10, background: pri.bg, color: pri.color, fontSize: 11, fontWeight: 700 }}>{pri.label}</span>
            {task.progressPercent > 0 && <span style={{ padding: "3px 10px", borderRadius: 10, background: "rgba(255,255,255,0.12)", color: "white", fontSize: 11, fontWeight: 700 }}>{task.progressPercent}%</span>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 3, padding: "10px 14px", borderBottom: "1.5px solid #f0ead8", overflowX: "auto", flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={tabBtn(tab === t.key)}>
              <t.icon size={13} /> {t.label}{t.count ? ` (${t.count})` : ""}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          {tab === "info" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {canEditFull ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lbl}>الحالة</label>
                      <select style={inp} value={task.status} onChange={e => updateMut.mutate({ status: e.target.value })}>
                        {STATUS_ORDER.map(k => <option key={k} value={k}>{STATUS_MAP[k].label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>الأولوية</label>
                      <select style={inp} value={task.priority} onChange={e => updateMut.mutate({ priority: e.target.value })}>
                        {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>المسؤول الرئيسي</label>
                      <select style={inp} value={task.assignedTo ?? ""} onChange={e => updateMut.mutate({ assignedTo: e.target.value || null })}>
                        <option value="">غير مُسندة</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>مقدّم المهمة</label>
                      <select style={inp} value={task.requestedBy ?? ""} onChange={e => updateMut.mutate({ requestedBy: e.target.value || null })}>
                        <option value="">—</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>تاريخ البداية</label>
                      <input type="date" style={{ ...inp, direction: "ltr" }} value={task.startDate?.slice(0, 10) ?? ""} onChange={e => updateMut.mutate({ startDate: e.target.value || null })} />
                    </div>
                    <div>
                      <label style={lbl}>تاريخ الاستحقاق</label>
                      <input type="date" style={{ ...inp, direction: "ltr" }} value={task.dueDate?.slice(0, 10) ?? ""} onChange={e => updateMut.mutate({ dueDate: e.target.value || null })} />
                    </div>
                    <div>
                      <label style={lbl}>نسبة الإنجاز %</label>
                      <input type="number" min={0} max={100} style={inp} defaultValue={task.progressPercent} onBlur={e => updateMut.mutate({ progressPercent: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label style={lbl}>الوقت الفعلي المستغرق (ساعة)</label>
                      <input type="number" step="0.5" style={inp} defaultValue={task.actualTimeHours ?? ""} onBlur={e => updateMut.mutate({ actualTimeHours: e.target.value || null })} />
                    </div>
                    <div>
                      <label style={lbl}>الميزانية (د.ك)</label>
                      <input type="number" step="0.001" style={inp} defaultValue={task.budget ?? ""} onBlur={e => updateMut.mutate({ budget: e.target.value || null })} />
                    </div>
                    <div>
                      <label style={lbl}>التكلفة الفعلية (د.ك)</label>
                      <input type="number" step="0.001" style={inp} defaultValue={task.actualCost ?? ""} onBlur={e => updateMut.mutate({ actualCost: e.target.value || null })} />
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>تقييم الجودة (عند الإغلاق)</label>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => updateMut.mutate({ qualityRating: n })} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                          <Star size={18} color={n <= (task.qualityRating ?? 0) ? "#d97706" : "#e5e7eb"} fill={n <= (task.qualityRating ?? 0) ? "#d97706" : "none"} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>الوصف</label>
                    <textarea style={{ ...inp, height: 70, resize: "vertical" }} defaultValue={task.description ?? ""} onBlur={e => updateMut.mutate({ description: e.target.value })} />
                  </div>
                  <button onClick={() => { if (confirm("حذف هذه المهمة نهائيًا؟")) deleteMut.mutate(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1.5px solid #fecaca", background: "#fff1f2", color: "#dc2626", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", alignSelf: "flex-start" }}>
                    <Trash2 size={13} /> حذف المهمة
                  </button>
                </>
              ) : (
                <>
                  {task.description && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#f9f7f2", border: "1px solid #f0ead8", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{task.description}</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12.5 }}>
                    <div><span style={{ color: "#9ca3af" }}>المسؤول: </span>{task.assigneeName ?? "—"}</div>
                    <div><span style={{ color: "#9ca3af" }}>تاريخ الاستحقاق: </span>{fmtDate(task.dueDate)}</div>
                  </div>
                  {isOwnTask && (
                    <>
                      <div>
                        <label style={lbl}>نسبة الإنجاز %</label>
                        <input type="number" min={0} max={100} style={inp} defaultValue={task.progressPercent} onBlur={e => updateMut.mutate({ progressPercent: Number(e.target.value) })} />
                      </div>
                      <div>
                        <label style={lbl}>الوقت الفعلي المستغرق (ساعة)</label>
                        <input type="number" step="0.5" style={inp} defaultValue={task.actualTimeHours ?? ""} onBlur={e => updateMut.mutate({ actualTimeHours: e.target.value || null })} />
                      </div>
                      <div>
                        <label style={lbl}>ملاحظاتي</label>
                        <textarea style={{ ...inp, height: 70, resize: "vertical" }} defaultValue={task.employeeNotes ?? ""} onBlur={e => updateMut.mutate({ employeeNotes: e.target.value })} />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "stages" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(task.stages ?? []).length === 0 && <p style={{ color: "#9ca3af", fontSize: 12.5 }}>لا توجد مراحل فرعية</p>}
              {(task.stages ?? []).map((s: any) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 9, border: "1px solid #eee", background: s.isDone ? "#f0fdf4" : "white" }}>
                  <button onClick={() => toggleStageMut.mutate({ id: s.id, isDone: !s.isDone })} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                    <Check size={16} color={s.isDone ? "#16a34a" : "#d1d5db"} />
                  </button>
                  <span style={{ flex: 1, fontSize: 12.5, textDecoration: s.isDone ? "line-through" : "none", color: s.isDone ? "#6b7280" : "#374151" }}>{s.title}</span>
                  {canEditFull && <button onClick={() => deleteStageMut.mutate(s.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><Trash2 size={13} color="#dc2626" /></button>}
                </div>
              ))}
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input style={inp} value={newStage} onChange={e => setNewStage(e.target.value)} placeholder="مرحلة جديدة" />
                <button onClick={() => newStage.trim() && addStageMut.mutate(newStage.trim())} style={{ padding: "0 14px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700 }}><Plus size={13} /></button>
              </div>
            </div>
          )}

          {tab === "comments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(task.comments ?? []).map((c: any) => (
                <div key={c.id} style={{ padding: "9px 12px", borderRadius: 10, background: "#fbfaf6", border: "1px solid #f0ead8" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: GR }}>{c.userName}</span>
                    <span style={{ fontSize: 10.5, color: "#9ca3af" }}>{fmtDate(c.createdAt)}</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#374151", margin: 0, whiteSpace: "pre-wrap" }}>{c.content}</p>
                </div>
              ))}
              <div style={{ display: "flex", gap: 6 }}>
                <textarea style={{ ...inp, height: 50, resize: "vertical" }} value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="اكتب تعليقًا... استخدم @الاسم للإشارة" />
                <button onClick={() => commentText.trim() && addCommentMut.mutate(commentText.trim())} style={{ padding: "0 14px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700 }}><Plus size={13} /></button>
              </div>
            </div>
          )}

          {tab === "attachments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, border: `1.5px dashed ${G}88`, background: "white", color: GD, cursor: isUploading ? "not-allowed" : "pointer", fontSize: 12.5, fontWeight: 700, alignSelf: "flex-start" }}>
                {isUploading ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> جاري الرفع {progress}%</> : <><Paperclip size={13} /> رفع ملف/صورة/PDF</>}
                <input type="file" style={{ display: "none" }} disabled={isUploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
              </label>
              {(task.attachments ?? []).length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: 12.5 }}>لا توجد مرفقات</p>
              ) : (task.attachments ?? []).map((a: any) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 9, border: "1px solid #f0ead8", background: "#fdfcf8" }}>
                  <span style={{ fontSize: 12.5, color: "#374151" }}>{a.fileName}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <a href={objectPathToUrl(a.objectPath) ?? "#"} target="_blank" rel="noreferrer" style={{ display: "flex" }}><Download size={13} color={GD} /></a>
                    <button onClick={() => deleteAttMut.mutate(a.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><Trash2 size={13} color="#dc2626" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "approvals" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(task.approvals ?? []).length === 0 && <p style={{ color: "#9ca3af", fontSize: 12.5 }}>لا توجد بوابات اعتماد على هذه المهمة</p>}
              {(task.approvals ?? []).map((a: any) => (
                <div key={a.gate} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 9, border: "1px solid #eee" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: GR }}>{a.gate}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 10, background: a.status === "approved" ? "#f0fdf4" : a.status === "rejected" ? "#fff1f2" : "#fffbeb", color: a.status === "approved" ? "#16a34a" : a.status === "rejected" ? "#dc2626" : "#d97706" }}>{a.status === "approved" ? "معتمد" : a.status === "rejected" ? "مرفوض" : "قيد الانتظار"}</span>
                    {canApprove && a.status === "pending" && (
                      <>
                        <button onClick={() => decideApprovalMut.mutate({ gate: a.gate, status: "approved" })} style={{ background: "#16a34a", border: "none", borderRadius: 6, padding: "3px 8px", color: "white", cursor: "pointer", fontSize: 10.5 }}>اعتماد</button>
                        <button onClick={() => decideApprovalMut.mutate({ gate: a.gate, status: "rejected" })} style={{ background: "#dc2626", border: "none", borderRadius: 6, padding: "3px 8px", color: "white", cursor: "pointer", fontSize: 10.5 }}>رفض</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "activity" && <TimelineView taskId={taskId} />}
        </div>
      </div>
    </div>
  );
}
