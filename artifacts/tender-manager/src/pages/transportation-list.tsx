import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, vehiclesApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { nowKuwait, todayKuwait } from "@/lib/timezone";
import {
  Truck, Plus, Search, X, Save, Pencil, Trash2,
  MapPin, Calendar, Package, ChevronDown, ArrowRight,
  DollarSign, FileText, Users, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, AlertCircle, UserPlus, Loader2,
  Car, ShieldCheck,
  AlertTriangle, Satellite, ExternalLink, Wallet, Fuel, Wrench, ChevronUp,
  TrendingUp,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

/* ── brand ── */
const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

/* ── shared input styles ── */
const inp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "10px 14px",
  borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13,
  color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit",
};
const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: GR, marginBottom: 5 };
const onFocus = (e: React.FocusEvent<any>) => {
  e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px rgba(212,165,52,0.15)`;
};
const onBlur = (e: React.FocusEvent<any>) => {
  e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none";
};

/* ── Types ── */
interface ContractOpt { id: number; contractNumber: string; entityName: string | null; }
interface UserDir  { id: number; fullName: string; username: string; }

interface TransportRow {
  id: number; orderNumber: string | null; supplierId: number | null;
  contractId: number | null; contractNumber: string | null;
  description: string; origin: string | null; destination: string | null;
  orderDate: string | null; deliveryDate: string | null; value: string | null;
  status: string; vehicleInfo: string | null; notes: string | null;
  actualDeliveryDate: string | null; completionNotes: string | null;
  createdAt: string; supplierName: string | null;
  lat: string | null; lng: string | null; locationUpdatedAt: string | null;
}
interface Team {
  id: number; name: string; description: string | null;
  color: string; createdAt: string; memberCount: number;
}
interface TeamMember {
  id: number; userId: number; fullName: string; username: string; joinedAt: string;
}
const STATUS_ORDER: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:    { label: "قيد الانتظار", color: "#d97706", bg: "#fffbeb", icon: Clock },
  in_transit: { label: "جارٍ النقل",   color: "#2563eb", bg: "#eff6ff", icon: Truck },
  delivered:  { label: "تم التسليم",   color: "#16a34a", bg: "#f0fdf4", icon: CheckCircle2 },
  cancelled:  { label: "ملغي",          color: "#dc2626", bg: "#fff1f2", icon: X },
};

const TEAM_COLORS = ["#D4A534","#2563eb","#16a34a","#7c3aed","#dc2626","#0891b2","#db2777","#ea580c"];

/* ═══════════════════════════════════════════════════════
   SHARED DRAWER SHELL
═══════════════════════════════════════════════════════ */
function Drawer({ open, onClose, title, subtitle, icon: Icon, children, footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  icon: any; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position:"fixed",inset:0,zIndex:40,background:"rgba(11,26,16,0.45)",backdropFilter:"blur(3px)",opacity:open?1:0,pointerEvents:open?"auto":"none",transition:"opacity 0.25s" }} />
      <div style={{ position:"fixed",top:0,left:0,bottom:0,zIndex:50,width:480,maxWidth:"95vw",background:"white",boxShadow:"4px 0 40px rgba(0,0,0,0.18)",transform:open?"translateX(0)":"translateX(-100%)",transition:"transform 0.3s cubic-bezier(.4,0,.2,1)",display:"flex",flexDirection:"column" }}>
        <div style={{ padding:"20px 24px",background:`linear-gradient(135deg,${GR},#1e4028)`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:42,height:42,borderRadius:12,background:"rgba(212,165,52,0.2)",border:"1px solid rgba(212,165,52,0.3)",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <Icon size={20} color={G} />
            </div>
            <div>
              <h2 style={{ color:"white",fontSize:16,fontWeight:800,margin:0 }}>{title}</h2>
              {subtitle && <p style={{ color:"rgba(212,165,52,0.55)",fontSize:11,margin:"2px 0 0" }}>{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} style={{ width:34,height:34,borderRadius:8,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.18)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.7)" }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ overflowY:"auto",padding:24,flex:1,display:"flex",flexDirection:"column",gap:16 }}>{children}</div>
        <div style={{ padding:"16px 24px",borderTop:"1px solid #f0ead8",display:"flex",gap:10,flexShrink:0,background:"#fdfbf7" }}>{footer}</div>
      </div>
    </>
  );
}

function SaveBtn({ onClick, isPending, label }: { onClick: () => void; isPending: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={isPending} style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"11px 0",borderRadius:12,fontSize:14,fontWeight:800,cursor:"pointer",background:`linear-gradient(135deg,${G},${GD})`,border:"none",color:"white",fontFamily:"inherit",boxShadow:`0 6px 20px rgba(212,165,52,0.4)`,opacity:isPending?0.65:1 }}>
      {isPending ? <Loader2 size={16} style={{ animation:"spin 1s linear infinite" }} /> : <Save size={16} />}
      {isPending ? "جارٍ الحفظ..." : (label ?? "حفظ")}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB 1 — TRANSPORTATION ORDERS
═══════════════════════════════════════════════════════ */
const emptyOrderForm = {
  orderNumber:"",contractId:"" as string|number,description:"",origin:"",
  destination:"",orderDate:"",deliveryDate:"",value:"",status:"pending",vehicleInfo:"",notes:"",
};
const emptyCompleteForm = { actualDeliveryDate: todayKuwait(), completionNotes: "" };

function OrdersTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState<TransportRow | null>(null);
  const [completing, setCompleting] = useState<TransportRow | null>(null);
  const [completeForm, setCompleteForm] = useState({ ...emptyCompleteForm });
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("");
  const [form, setForm]             = useState({ ...emptyOrderForm });

  const { data: rows = [], isLoading } = useQuery<TransportRow[]>({
    queryKey: ["transportation"],
    queryFn: () => apiFetch("/api/transportation"),
  });
  const { data: contracts = [] } = useQuery<ContractOpt[]>({
    queryKey: ["contracts", "all"],
    queryFn: () => apiFetch("/api/contracts"),
    select: (d: any[]) => d.map(c => ({ id: c.id, contractNumber: c.contractNumber, entityName: c.entityName ?? null })),
  });

  useEffect(() => {
    if (editing) {
      setForm({ orderNumber:editing.orderNumber??"",contractId:editing.contractId??"",description:editing.description,origin:editing.origin??"",destination:editing.destination??"",orderDate:editing.orderDate??"",deliveryDate:editing.deliveryDate??"",value:editing.value??"",status:editing.status,vehicleInfo:editing.vehicleInfo??"",notes:editing.notes??"" });
    } else { setForm({ ...emptyOrderForm }); }
  }, [editing, drawerOpen]);

  useEffect(() => {
    setCompleteForm({ ...emptyCompleteForm });
  }, [completing]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const createMut = useMutation({ mutationFn: (d:any) => apiFetch("/api/transportation",{method:"POST",body:JSON.stringify(d)}), onSuccess: ()=>{ qc.invalidateQueries({queryKey:["transportation"]}); setDrawerOpen(false); setEditing(null); } });
  const updateMut = useMutation({ mutationFn: ({id,d}:{id:number,d:any}) => apiFetch(`/api/transportation/${id}`,{method:"PATCH",body:JSON.stringify(d)}), onSuccess: ()=>{ qc.invalidateQueries({queryKey:["transportation"]}); setDrawerOpen(false); setEditing(null); } });
  const deleteMut = useMutation({ mutationFn: (id:number) => apiFetch(`/api/transportation/${id}`,{method:"DELETE"}), onSuccess: ()=> qc.invalidateQueries({queryKey:["transportation"]}) });
  const completeMut = useMutation({
    mutationFn: ({id,d}:{id:number,d:any}) => apiFetch(`/api/transportation/${id}/complete`,{method:"PATCH",body:JSON.stringify(d)}),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:["transportation"]}); setCompleting(null); },
  });
  const logIncomeMut = useMutation({
    mutationFn: (id:number) => apiFetch(`/api/transportation/${id}/log-income`,{method:"POST"}),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:["transportation"]}); qc.invalidateQueries({queryKey:["transportation-budget-summary"]}); },
  });
  const { data: orderIncome = [] } = useQuery<any[]>({
    queryKey: ["transportation-order-income", editing?.id],
    queryFn: () => apiFetch(`/api/finance/income?transportationOrderId=${editing!.id}`),
    enabled: !!editing,
  });

  const handleSave = () => {
    const d = { orderNumber:form.orderNumber||null,contractId:form.contractId?Number(form.contractId):null,description:form.description,origin:form.origin||null,destination:form.destination||null,orderDate:form.orderDate||null,deliveryDate:form.deliveryDate||null,value:form.value||null,status:form.status,vehicleInfo:form.vehicleInfo||null,notes:form.notes||null };
    if (editing) updateMut.mutate({ id:editing.id, d });
    else createMut.mutate(d);
  };

  const handleComplete = () => {
    if (!completing || !completeForm.actualDeliveryDate) return;
    completeMut.mutate({ id: completing.id, d: { actualDeliveryDate: completeForm.actualDeliveryDate, completionNotes: completeForm.completionNotes || null } });
  };

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.description.toLowerCase().includes(q)||(r.orderNumber??"").toLowerCase().includes(q)||(r.origin??"").toLowerCase().includes(q)||(r.destination??"").toLowerCase().includes(q)||(r.contractNumber??"").toLowerCase().includes(q))
      && (!statusFilter || r.status===statusFilter);
  });

  return (
    <>
      <Drawer open={drawerOpen||!!editing} onClose={()=>{setDrawerOpen(false);setEditing(null);}} title={editing?"تعديل أمر النقل":"أمر نقل جديد"} subtitle="أدخل تفاصيل عملية النقل والتوزيع" icon={Truck}
        footer={<><SaveBtn onClick={handleSave} isPending={createMut.isPending||updateMut.isPending} label={editing?"حفظ التعديلات":"إضافة الأمر"} /><button onClick={()=>{setDrawerOpen(false);setEditing(null);}} style={{ padding:"11px 20px",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",background:"#f9fafb",border:"1.5px solid #e5e7eb",color:"#374151",fontFamily:"inherit" }}><X size={15} /></button></>}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <div><label style={lbl}>رقم الأمر</label><input value={form.orderNumber} onChange={e=>set("orderNumber",e.target.value)} placeholder="TRN-001" dir="ltr" style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
          <div><label style={lbl}>الحالة</label><select value={form.status} onChange={e=>set("status",e.target.value)} style={{...inp,appearance:"none",cursor:"pointer"}} onFocus={onFocus} onBlur={onBlur}>{Object.entries(STATUS_ORDER).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
        </div>
        <div><label style={lbl}>وصف البضاعة / الخدمة *</label><input value={form.description} onChange={e=>set("description",e.target.value)} placeholder="وصف تفصيلي" style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"end" }}>
          <div><label style={lbl}>من (المنشأ)</label><input value={form.origin} onChange={e=>set("origin",e.target.value)} placeholder="موقع الشحن" style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
          <div style={{ paddingBottom:2 }}><ArrowRight size={18} color="#9ca3af" /></div>
          <div><label style={lbl}>إلى (الوجهة)</label><input value={form.destination} onChange={e=>set("destination",e.target.value)} placeholder="موقع التسليم" style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <div><label style={lbl}>تاريخ الأمر</label><input type="date" value={form.orderDate} onChange={e=>set("orderDate",e.target.value)} style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
          <div><label style={lbl}>تاريخ التسليم</label><input type="date" value={form.deliveryDate} onChange={e=>set("deliveryDate",e.target.value)} style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <div><label style={lbl}>رقم العقد</label><select value={form.contractId} onChange={e=>set("contractId",e.target.value)} style={{...inp,appearance:"none",cursor:"pointer"}} onFocus={onFocus} onBlur={onBlur}><option value="">— اختر عقداً —</option>{contracts.map(c=><option key={c.id} value={c.id}>{c.contractNumber}{c.entityName?` — ${c.entityName}`:""}</option>)}</select></div>
          <div>
            <label style={lbl}>القيمة (د.ك)</label>
            <div style={{ display:"flex", gap:8 }}>
              <input type="number" min="0" step="0.001" value={form.value} onChange={e=>set("value",e.target.value)} placeholder="0.000" dir="ltr" style={inp} onFocus={onFocus} onBlur={onBlur} />
              {editing && form.value && (
                <button type="button" onClick={()=>logIncomeMut.mutate(editing.id)} disabled={logIncomeMut.isPending} title="تسجيل كإيراد" style={{ display:"flex",alignItems:"center",gap:5,padding:"0 12px",borderRadius:10,fontSize:11,fontWeight:700,background:"#f0fdf4",border:"1.5px solid #bbf7d0",color:"#16a34a",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" }}>
                  <TrendingUp size={12} /> تسجيل كإيراد
                </button>
              )}
            </div>
          </div>
        </div>
        {editing && orderIncome.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <span style={{ ...lbl, marginBottom:0 }}>الإيراد المسجّل ({orderIncome.length}) — الإجمالي: {fmtKwd(orderIncome.reduce((s:number,r:any)=>s+Number(r.amount||0),0))}</span>
            {orderIncome.map((r:any) => (
              <div key={r.id} style={{ display:"flex", justifyContent:"space-between", padding:"6px 10px", borderRadius:8, background:"#f0fdf4", border:"1px solid #bbf7d0", fontSize:11.5 }}>
                <span>{r.description} <span style={{ color:"#9ca3af" }}>({new Date(r.date).toLocaleDateString("ar-KW")})</span></span>
                <span style={{ fontWeight:700, color:"#16a34a", direction:"ltr" as const }}>{fmtKwd(r.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <div><label style={lbl}>معلومات المركبة / السائق</label><input value={form.vehicleInfo} onChange={e=>set("vehicleInfo",e.target.value)} placeholder="رقم اللوحة، اسم السائق..." style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
        <div><label style={lbl}>ملاحظات</label><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={3} style={{...inp,resize:"vertical"} as any} onFocus={onFocus as any} onBlur={onBlur as any} /></div>
      </Drawer>

      {/* Complete-order drawer */}
      <Drawer open={!!completing} onClose={()=>setCompleting(null)} title="إتمام الأمر" subtitle={completing?.orderNumber ? `أمر رقم ${completing.orderNumber}` : "تأكيد تسليم أمر النقل"} icon={CheckCircle2}
        footer={<><SaveBtn onClick={handleComplete} isPending={completeMut.isPending} label="تأكيد الإتمام" /><button onClick={()=>setCompleting(null)} style={{ padding:"11px 20px",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",background:"#f9fafb",border:"1.5px solid #e5e7eb",color:"#374151",fontFamily:"inherit" }}><X size={15} /></button></>}>
        <div><label style={lbl}>تاريخ التسليم الفعلي *</label><input type="date" value={completeForm.actualDeliveryDate} onChange={e=>setCompleteForm(f=>({...f,actualDeliveryDate:e.target.value}))} style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
        <div><label style={lbl}>ملاحظات الإتمام</label><textarea value={completeForm.completionNotes} onChange={e=>setCompleteForm(f=>({...f,completionNotes:e.target.value}))} rows={3} placeholder="أي ملاحظات على عملية التسليم..." style={{...inp,resize:"vertical"} as any} onFocus={onFocus as any} onBlur={onBlur as any} /></div>
      </Drawer>

      {/* Filters */}
      <div style={{ background:"white",borderRadius:16,border:"1.5px solid #f0ead8",padding:"16px 20px",display:"flex",gap:12,flexWrap:"wrap",alignItems:"center" }}>
        <div style={{ position:"relative",flex:"1 1 220px",minWidth:200 }}>
          <Search size={15} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none" }} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث..." style={{...inp,paddingRight:36}} />
        </div>
        <div style={{ position:"relative",minWidth:160 }}>
          <select value={statusFilter} onChange={e=>setStatus(e.target.value)} style={{...inp,appearance:"none",paddingLeft:32,cursor:"pointer",minWidth:160}}>
            <option value="">جميع الحالات</option>
            {Object.entries(STATUS_ORDER).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <ChevronDown size={14} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none" }} />
        </div>
        {canEdit && <button onClick={()=>{setEditing(null);setDrawerOpen(true);}} style={{ display:"flex",alignItems:"center",gap:7,padding:"9px 18px",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",background:`linear-gradient(135deg,${G},${GD})`,border:"none",color:"white",fontFamily:"inherit",boxShadow:`0 4px 14px rgba(212,165,52,0.4)` }}><Plus size={14} />أمر جديد</button>}
        {(search||statusFilter) && <button onClick={()=>{setSearch("");setStatus("");}} style={{ display:"flex",alignItems:"center",gap:5,padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:600,background:"#fff1f2",color:"#dc2626",border:"1px solid #fecaca",cursor:"pointer",fontFamily:"inherit" }}><X size={13}/>إلغاء</button>}
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>{[...Array(3)].map((_,i)=><div key={i} style={{ background:"white",borderRadius:16,height:110,animation:"pulse 1.5s infinite",border:"1.5px solid #f0ead8" }} />)}</div>
      ) : filtered.length===0 ? (
        <div style={{ background:"white",borderRadius:20,border:"1.5px solid #f0ead8",padding:"64px 0",textAlign:"center" }}>
          <Truck size={44} color="#e2d5b0" style={{ margin:"0 auto 12px",display:"block" }} />
          <p style={{ color:"#94a3b8",fontSize:14,fontWeight:600,margin:0 }}>{search||statusFilter?"لا توجد نتائج مطابقة":"لا توجد أوامر نقل بعد"}</p>
        </div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {filtered.map(row => {
            const st = STATUS_ORDER[row.status] ?? STATUS_ORDER.pending;
            return (
              <div key={row.id} style={{ background:"white",borderRadius:16,border:"1.5px solid #f0ead8",padding:"16px 20px",display:"flex",flexDirection:"column",gap:10 }}>
                <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12 }}>
                  <div style={{ display:"flex",alignItems:"flex-start",gap:12 }}>
                    <div style={{ width:42,height:42,borderRadius:12,background:`${G}15`,border:`1px solid ${G}25`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Truck size={18} color={G} /></div>
                    <div>
                      <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
                        {row.orderNumber && <span style={{ fontSize:11,fontWeight:700,color:"#6b7280",background:"#f9fafb",border:"1px solid #e5e7eb",padding:"2px 8px",borderRadius:6,fontFamily:"monospace" }}>{row.orderNumber}</span>}
                        <span style={{ fontSize:11,fontWeight:700,padding:"3px 12px",borderRadius:20,background:st.bg,color:st.color,border:`1px solid ${st.color}30` }}>{st.label}</span>
                      </div>
                      <p style={{ fontSize:14,fontWeight:700,color:GR,margin:"6px 0 0" }}>{row.description}</p>
                    </div>
                  </div>
                  {canEdit && (
                    <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                      {row.status!=="delivered" && row.status!=="cancelled" && (
                        <button onClick={()=>setCompleting(row)} style={{ display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:700,background:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",cursor:"pointer",fontFamily:"inherit" }}><CheckCircle2 size={12}/>إتمام الأمر</button>
                      )}
                      <button onClick={()=>setEditing(row)} style={{ display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:700,background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0",cursor:"pointer",fontFamily:"inherit" }}><Pencil size={12}/>تعديل</button>
                      <button onClick={()=>{ if(confirm(`حذف أمر النقل؟`)) deleteMut.mutate(row.id); }} style={{ display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:700,background:"#fff1f2",color:"#dc2626",border:"1px solid #fecaca",cursor:"pointer",fontFamily:"inherit" }}><Trash2 size={12}/></button>
                    </div>
                  )}
                </div>
                <div style={{ display:"flex",flexWrap:"wrap",gap:14,paddingTop:8,borderTop:"1px solid #f5f0e6",fontSize:12,color:"#374151" }}>
                  {(row.origin||row.destination) && <span style={{ display:"flex",alignItems:"center",gap:5 }}><MapPin size={12} color={GD}/>{row.origin||"—"} <ArrowRight size={11} color="#9ca3af"/> {row.destination||"—"}</span>}
                  {row.orderDate && <span style={{ display:"flex",alignItems:"center",gap:5 }}><Calendar size={12} color="#7c3aed"/>{row.orderDate}</span>}
                  {row.value && <span style={{ display:"flex",alignItems:"center",gap:5 }}><DollarSign size={12} color={GD}/>{Number(row.value).toLocaleString("ar-KW")} د.ك</span>}
                  {row.contractNumber && <span style={{ display:"flex",alignItems:"center",gap:5 }}><FileText size={12} color="#2563eb"/>عقد: {row.contractNumber}</span>}
                  {row.actualDeliveryDate && <span style={{ display:"flex",alignItems:"center",gap:5,color:"#16a34a",fontWeight:700 }}><CheckCircle2 size={12} color="#16a34a"/>تم التسليم فعليًا: {row.actualDeliveryDate}</span>}
                </div>
                {row.completionNotes && <p style={{ fontSize:11.5,color:"#6b7280",margin:0,paddingTop:2 }}>ملاحظات الإتمام: {row.completionNotes}</p>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB 2 — TEAMS
═══════════════════════════════════════════════════════ */
const emptyTeamForm = { name:"", description:"", color:"#D4A534" };

function TeamsTab({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team|null>(null);
  const [membersTeam, setMembersTeam] = useState<Team|null>(null);
  const [form, setForm] = useState({ ...emptyTeamForm });

  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ["transport-teams"],
    queryFn: () => apiFetch("/api/transportation/teams"),
  });
  const { data: users = [] } = useQuery<UserDir[]>({
    queryKey: ["users-directory"],
    queryFn: () => apiFetch("/api/users/directory"),
  });
  const { data: members = [] } = useQuery<TeamMember[]>({
    queryKey: ["team-members", membersTeam?.id],
    queryFn: () => apiFetch(`/api/transportation/teams/${membersTeam!.id}/members`),
    enabled: !!membersTeam,
  });

  useEffect(() => {
    if (editingTeam) setForm({ name:editingTeam.name, description:editingTeam.description??"", color:editingTeam.color });
    else setForm({ ...emptyTeamForm });
  }, [editingTeam, drawerOpen]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const createMut = useMutation({ mutationFn: (d:any)=>apiFetch("/api/transportation/teams",{method:"POST",body:JSON.stringify(d)}), onSuccess:()=>{ qc.invalidateQueries({queryKey:["transport-teams"]}); setDrawerOpen(false); } });
  const updateMut = useMutation({ mutationFn: ({id,d}:{id:number,d:any})=>apiFetch(`/api/transportation/teams/${id}`,{method:"PATCH",body:JSON.stringify(d)}), onSuccess:()=>{ qc.invalidateQueries({queryKey:["transport-teams"]}); setDrawerOpen(false); setEditingTeam(null); } });
  const deleteMut = useMutation({ mutationFn: (id:number)=>apiFetch(`/api/transportation/teams/${id}`,{method:"DELETE"}), onSuccess:()=> qc.invalidateQueries({queryKey:["transport-teams"]}) });
  const addMemberMut = useMutation({ mutationFn: ({tid,uid}:{tid:number,uid:number})=>apiFetch(`/api/transportation/teams/${tid}/members`,{method:"POST",body:JSON.stringify({userId:uid})}), onSuccess:()=> qc.invalidateQueries({queryKey:["team-members",membersTeam?.id]}) });
  const removeMemberMut = useMutation({ mutationFn: ({tid,uid}:{tid:number,uid:number})=>apiFetch(`/api/transportation/teams/${tid}/members/${uid}`,{method:"DELETE"}), onSuccess:()=>{ qc.invalidateQueries({queryKey:["team-members",membersTeam?.id]}); qc.invalidateQueries({queryKey:["transport-teams"]}); } });

  const handleSaveTeam = () => {
    if (!form.name.trim()) return;
    if (editingTeam) updateMut.mutate({ id:editingTeam.id, d:form });
    else createMut.mutate(form);
  };

  const memberIds = new Set(members.map(m=>m.userId));

  return (
    <>
      {/* Team form drawer */}
      <Drawer open={drawerOpen||!!editingTeam} onClose={()=>{setDrawerOpen(false);setEditingTeam(null);}} title={editingTeam?"تعديل الفريق":"فريق جديد"} subtitle="أدخل اسم الفريق ووصفه" icon={Users}
        footer={<><SaveBtn onClick={handleSaveTeam} isPending={createMut.isPending||updateMut.isPending} label={editingTeam?"حفظ التعديلات":"إنشاء الفريق"} /><button onClick={()=>{setDrawerOpen(false);setEditingTeam(null);}} style={{ padding:"11px 20px",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",background:"#f9fafb",border:"1.5px solid #e5e7eb",color:"#374151",fontFamily:"inherit" }}><X size={15}/></button></>}>
        <div><label style={lbl}>اسم الفريق *</label><input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="مثال: فريق التوصيل الشمالي" style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
        <div><label style={lbl}>وصف الفريق</label><textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={3} placeholder="نبذة عن مهام هذا الفريق..." style={{...inp,resize:"vertical"} as any} onFocus={onFocus as any} onBlur={onBlur as any} /></div>
        <div>
          <label style={lbl}>لون الفريق</label>
          <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginTop:4 }}>
            {TEAM_COLORS.map(c=>(
              <button key={c} type="button" onClick={()=>set("color",c)} style={{ width:32,height:32,borderRadius:8,background:c,border:`3px solid ${form.color===c?"#1a1a1a":"transparent"}`,cursor:"pointer",transition:"transform 0.1s",transform:form.color===c?"scale(1.15)":"scale(1)" }} />
            ))}
          </div>
        </div>
      </Drawer>

      {/* Members management panel */}
      {membersTeam && (
        <>
          <div onClick={()=>setMembersTeam(null)} style={{ position:"fixed",inset:0,zIndex:40,background:"rgba(11,26,16,0.45)",backdropFilter:"blur(3px)" }} />
          <div style={{ position:"fixed",top:0,right:0,bottom:0,zIndex:50,width:420,maxWidth:"95vw",background:"white",boxShadow:"-4px 0 40px rgba(0,0,0,0.18)",display:"flex",flexDirection:"column" }}>
            {/* Header */}
            <div style={{ padding:"20px 24px",background:`linear-gradient(135deg,${GR},#1e4028)`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
              <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ width:36,height:36,borderRadius:10,background:membersTeam.color+"33",border:`1px solid ${membersTeam.color}55`,display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <Users size={18} color={membersTeam.color} />
                </div>
                <div>
                  <h2 style={{ color:"white",fontSize:15,fontWeight:800,margin:0 }}>أعضاء {membersTeam.name}</h2>
                  <p style={{ color:"rgba(212,165,52,0.55)",fontSize:11,margin:"2px 0 0" }}>{members.length} عضو</p>
                </div>
              </div>
              <button onClick={()=>setMembersTeam(null)} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.18)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.7)" }}><X size={15}/></button>
            </div>
            <div style={{ flex:1,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:16 }}>
              {/* Current members */}
              <div>
                <div style={{ fontSize:12,fontWeight:800,color:"#9ca3af",letterSpacing:0.5,textTransform:"uppercase",marginBottom:10 }}>الأعضاء الحاليون</div>
                {members.length===0 ? (
                  <div style={{ textAlign:"center",padding:"24px 0",color:"#94a3b8",fontSize:13 }}>لا يوجد أعضاء بعد</div>
                ) : (
                  <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                    {members.map(m=>(
                      <div key={m.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderRadius:12,background:"#f9fafb",border:"1px solid #e5e7eb" }}>
                        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                          <div style={{ width:34,height:34,borderRadius:10,background:`${G}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:GD }}>{m.fullName.charAt(0)}</div>
                          <div>
                            <div style={{ fontSize:13,fontWeight:700,color:GR }}>{m.fullName}</div>
                            <div style={{ fontSize:11,color:"#9ca3af" }}>@{m.username}</div>
                          </div>
                        </div>
                        {isAdmin && <button onClick={()=>{ if(confirm(`إزالة ${m.fullName}؟`)) removeMemberMut.mutate({tid:membersTeam.id,uid:m.userId}); }} style={{ display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:700,background:"#fff1f2",color:"#dc2626",border:"1px solid #fecaca",cursor:"pointer",fontFamily:"inherit" }}><X size={11}/>إزالة</button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Add member */}
              {canEdit && (
                <div>
                  <div style={{ fontSize:12,fontWeight:800,color:"#9ca3af",letterSpacing:0.5,textTransform:"uppercase",marginBottom:10 }}>إضافة عضو</div>
                  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                    {users.filter(u=>!memberIds.has(u.id)).map(u=>(
                      <button key={u.id} onClick={()=>addMemberMut.mutate({tid:membersTeam.id,uid:u.id})} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderRadius:12,background:"white",border:"1.5px solid #e5e7eb",cursor:"pointer",fontFamily:"inherit",transition:"border-color 0.15s" }}
                        onMouseEnter={e=>(e.currentTarget.style.borderColor=G)} onMouseLeave={e=>(e.currentTarget.style.borderColor="#e5e7eb")}>
                        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                          <div style={{ width:30,height:30,borderRadius:8,background:"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#6b7280" }}>{u.fullName.charAt(0)}</div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:13,fontWeight:600,color:GR }}>{u.fullName}</div>
                            <div style={{ fontSize:11,color:"#9ca3af" }}>@{u.username}</div>
                          </div>
                        </div>
                        <UserPlus size={14} color={G} />
                      </button>
                    ))}
                    {users.filter(u=>!memberIds.has(u.id)).length===0 && <p style={{ textAlign:"center",color:"#94a3b8",fontSize:13,padding:"12px 0" }}>جميع المستخدمين أعضاء بالفعل</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Header row */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div style={{ fontSize:13,color:"#6b7280",fontWeight:600 }}>{teams.length} فريق مسجّل</div>
        {canEdit && <button onClick={()=>{setEditingTeam(null);setDrawerOpen(true);}} style={{ display:"flex",alignItems:"center",gap:7,padding:"9px 18px",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",background:`linear-gradient(135deg,${G},${GD})`,border:"none",color:"white",fontFamily:"inherit",boxShadow:`0 4px 14px rgba(212,165,52,0.4)` }}><Plus size={14}/>فريق جديد</button>}
      </div>

      {/* Teams grid */}
      {isLoading ? (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14 }}>{[...Array(3)].map((_,i)=><div key={i} style={{ background:"white",borderRadius:18,height:160,animation:"pulse 1.5s infinite",border:"1.5px solid #f0ead8" }} />)}</div>
      ) : teams.length===0 ? (
        <div style={{ background:"white",borderRadius:20,border:"1.5px solid #f0ead8",padding:"64px 0",textAlign:"center" }}>
          <Users size={44} color="#e2d5b0" style={{ margin:"0 auto 12px",display:"block" }} />
          <p style={{ color:"#94a3b8",fontSize:14,fontWeight:600,margin:"0 0 4px" }}>لا توجد فرق بعد</p>
          {canEdit && <button onClick={()=>setDrawerOpen(true)} style={{ marginTop:16,display:"inline-flex",alignItems:"center",gap:7,padding:"9px 20px",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",background:`linear-gradient(135deg,${G},${GD})`,border:"none",color:"white",fontFamily:"inherit" }}><Plus size={14}/>إنشاء أول فريق</button>}
        </div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14 }}>
          {teams.map(team=>(
            <div key={team.id} style={{ background:"white",borderRadius:18,border:"1.5px solid #f0ead8",overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.05)",transition:"box-shadow 0.2s" }}>
              {/* Color bar */}
              <div style={{ height:6,background:team.color }} />
              <div style={{ padding:"16px 18px",display:"flex",flexDirection:"column",gap:12 }}>
                <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                    <div style={{ width:42,height:42,borderRadius:12,background:team.color+"20",border:`1.5px solid ${team.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:team.color }}>
                      {team.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize:15,fontWeight:800,color:GR }}>{team.name}</div>
                      {team.description && <div style={{ fontSize:12,color:"#6b7280",marginTop:2 }}>{team.description}</div>}
                    </div>
                  </div>
                  {isAdmin && (
                    <div style={{ display:"flex",gap:5 }}>
                      <button onClick={()=>setEditingTeam(team)} style={{ width:28,height:28,borderRadius:7,background:"#f0fdf4",border:"1px solid #bbf7d0",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><Pencil size={12} color="#16a34a"/></button>
                      <button onClick={()=>{ if(confirm(`حذف فريق "${team.name}"؟`)) deleteMut.mutate(team.id); }} style={{ width:28,height:28,borderRadius:7,background:"#fff1f2",border:"1px solid #fecaca",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><Trash2 size={12} color="#dc2626"/></button>
                    </div>
                  )}
                </div>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid #f5f0e6" }}>
                  <span style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:"#374151" }}>
                    <Users size={13} color={team.color}/>{team.memberCount} عضو
                  </span>
                  <button onClick={()=>setMembersTeam(team)} style={{ display:"flex",alignItems:"center",gap:5,padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:700,background:team.color+"15",color:team.color,border:`1px solid ${team.color}30`,cursor:"pointer",fontFamily:"inherit" }}>
                    <UserPlus size={12}/>إدارة الأعضاء
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB 3 — CALENDAR (Kuwait time) — driven by transportation orders'
   delivery dates rather than the separate transport_tasks system.
═══════════════════════════════════════════════════════ */
const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const DAY_AR   = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

function CalendarTab() {
  const now        = nowKuwait();
  const todayStr   = todayKuwait();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string>(todayStr);

  const { data: orders = [] } = useQuery<TransportRow[]>({
    queryKey: ["transportation"],
    queryFn: () => apiFetch("/api/transportation"),
  });

  /* Build calendar grid */
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number|null)[] = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];
  while (cells.length % 7) cells.push(null);

  const byDate: Record<string, TransportRow[]> = {};
  orders.forEach(o => { if(o.deliveryDate) { (byDate[o.deliveryDate]??=[]).push(o); } });

  const selectedOrders = byDate[selectedDay] ?? [];

  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  return (
    <div style={{ display:"grid",gridTemplateColumns:"1fr 340px",gap:18,alignItems:"start" }}>
      {/* Calendar */}
      <div style={{ background:"white",borderRadius:20,border:"1.5px solid #f0ead8",overflow:"hidden",boxShadow:"0 2px 16px rgba(0,0,0,0.06)" }}>
        {/* Month nav */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 22px",borderBottom:"1.5px solid #f5f0e6" }}>
          <button onClick={prevMonth} style={{ width:36,height:36,borderRadius:10,background:"#f9f5ec",border:"1px solid #e5dcc8",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><ChevronRight size={17} color={GD}/></button>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:18,fontWeight:900,color:GR }}>{MONTH_AR[month]}</div>
            <div style={{ fontSize:12,color:"#9ca3af" }}>{year} — توقيت الكويت</div>
          </div>
          <button onClick={nextMonth} style={{ width:36,height:36,borderRadius:10,background:"#f9f5ec",border:"1px solid #e5dcc8",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><ChevronLeft size={17} color={GD}/></button>
        </div>
        {/* Days header */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:"#fdf8ec" }}>
          {DAY_AR.map(d=><div key={d} style={{ textAlign:"center",padding:"10px 4px",fontSize:11,fontWeight:800,color:GD }}>{d.slice(0,3)}</div>)}
        </div>
        {/* Cells */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:0 }}>
          {cells.map((day,i)=>{
            if (!day) return <div key={i} style={{ minHeight:80,background:"#fafaf8",borderRight:"1px solid #f5f0e6",borderBottom:"1px solid #f5f0e6" }} />;
            const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const isToday = ds===todayStr;
            const isSelected = ds===selectedDay;
            const dayOrders = byDate[ds]??[];
            return (
              <div key={i} onClick={()=>setSelectedDay(ds)}
                style={{ minHeight:80,borderRight:"1px solid #f0ead8",borderBottom:"1px solid #f0ead8",padding:"6px 5px",cursor:"pointer",background:isSelected?"#fdf4e0":isToday?"#fffbf0":"white",transition:"background 0.15s" }}
                onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.background=isToday?"#fff8e6":"#fdf8f0"; }}
                onMouseLeave={e=>{ e.currentTarget.style.background=isSelected?"#fdf4e0":isToday?"#fffbf0":"white"; }}>
                <div style={{ display:"flex",justifyContent:"center",marginBottom:4 }}>
                  <span style={{ width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:isToday?900:600,background:isToday?G:"transparent",color:isToday?"white":isSelected?GD:"#374151",boxShadow:isToday?`0 2px 8px ${G}60`:"none" }}>{day}</span>
                </div>
                {dayOrders.slice(0,2).map(o=>{
                  const sc = (STATUS_ORDER[o.status]??STATUS_ORDER.pending).color;
                  return (
                    <div key={o.id} style={{ fontSize:10,fontWeight:600,color:"white",background:sc,borderRadius:4,padding:"2px 5px",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={o.description}>
                      {o.orderNumber && <span style={{ opacity:0.8 }}>{o.orderNumber} </span>}{o.description}
                    </div>
                  );
                })}
                {dayOrders.length>2 && <div style={{ fontSize:10,color:GD,fontWeight:700,textAlign:"center" }}>+{dayOrders.length-2} أخرى</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Side panel */}
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        {/* Selected day header */}
        <div style={{ background:"white",borderRadius:16,border:"1.5px solid #f0ead8",padding:"16px 18px" }}>
          <div style={{ fontSize:15,fontWeight:800,color:GR }}>
            {selectedDay===todayStr && <span style={{ fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:`${G}20`,color:GD,marginLeft:8 }}>اليوم</span>}
            {new Date(selectedDay).toLocaleDateString("ar-KW",{weekday:"long",day:"numeric",month:"long",timeZone:"Asia/Kuwait"})}
          </div>
          <div style={{ fontSize:12,color:"#9ca3af",marginTop:2 }}>{selectedOrders.length} أمر نقل مجدول للتسليم</div>
        </div>

        {/* Orders list */}
        {selectedOrders.length===0 ? (
          <div style={{ background:"white",borderRadius:16,border:"1.5px solid #f0ead8",padding:"32px 18px",textAlign:"center" }}>
            <Calendar size={32} color="#e2d5b0" style={{ margin:"0 auto 8px",display:"block" }} />
            <p style={{ color:"#94a3b8",fontSize:13,fontWeight:600,margin:0 }}>لا توجد أوامر نقل مجدولة في هذا اليوم</p>
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {selectedOrders.map(o=>{
              const st = STATUS_ORDER[o.status]??STATUS_ORDER.pending;
              return (
                <div key={o.id} style={{ background:"white",borderRadius:14,border:"1.5px solid #f0ead8",overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,0,0.04)" }}>
                  <div style={{ height:4,background:st.color }} />
                  <div style={{ padding:"12px 14px" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4 }}>
                      {o.orderNumber && <span style={{ fontSize:10,fontWeight:700,color:"#6b7280",background:"#f9fafb",border:"1px solid #e5e7eb",padding:"2px 8px",borderRadius:6,fontFamily:"monospace" }}>{o.orderNumber}</span>}
                      <span style={{ fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:12,background:st.bg,color:st.color }}>{st.label}</span>
                    </div>
                    <p style={{ fontSize:13,fontWeight:700,color:GR,margin:"0 0 4px",lineHeight:1.4 }}>{o.description}</p>
                    {(o.origin||o.destination) && <div style={{ display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#6b7280" }}><MapPin size={11}/>{o.origin||"—"} <ArrowRight size={10} color="#9ca3af"/> {o.destination||"—"}</div>}
                    {o.contractNumber && <div style={{ display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#6b7280",marginTop:2 }}><FileText size={11}/>عقد: {o.contractNumber}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Monthly summary */}
        <div style={{ background:"white",borderRadius:16,border:"1.5px solid #f0ead8",padding:"14px 16px" }}>
          <div style={{ fontSize:12,fontWeight:800,color:"#9ca3af",marginBottom:10 }}>ملخص الشهر</div>
          {Object.entries(STATUS_ORDER).map(([k,v])=>{
            const count = orders.filter(o=>o.status===k && o.deliveryDate?.startsWith(`${year}-${String(month+1).padStart(2,"0")}`)).length;
            return (
              <div key={k} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f9fafb" }}>
                <span style={{ fontSize:12,color:v.color,fontWeight:600 }}>{v.label}</span>
                <span style={{ fontSize:13,fontWeight:800,color:v.color }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB 0 — FLEET (سجل المركبات)
═══════════════════════════════════════════════════════ */
interface VehicleRow {
  id: number; plateNumber: string; vehicleType: string | null; makeModel: string | null;
  year: number | null; color: string | null; ownership: string; status: string;
  driverName: string | null; driverPhone: string | null;
  registrationExpiry: string | null; insuranceExpiry: string | null;
  purchaseDate: string | null; purchaseValue: string | null;
  notes: string | null; createdAt: string;
}
interface VehicleStats {
  total: number; active: number; maintenance: number; outOfService: number;
  expiring30: number; expired: number;
}

const VEHICLE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  active:         { label: "نشطة",        color: "#16a34a", bg: "#f0fdf4" },
  maintenance:    { label: "في الصيانة",  color: "#d97706", bg: "#fffbeb" },
  out_of_service: { label: "خارج الخدمة", color: "#dc2626", bg: "#fff1f2" },
};
const VEHICLE_TYPES = ["سيارة صغيرة", "شاحنة", "باص", "معدة ثقيلة", "أخرى"];
const emptyVehicleForm = {
  plateNumber: "", vehicleType: "سيارة صغيرة", makeModel: "", year: "", color: "",
  ownership: "owned", status: "active", driverName: "", driverPhone: "",
  registrationExpiry: "", insuranceExpiry: "", purchaseDate: "", purchaseValue: "", notes: "",
};

function expiryInfo(dateStr: string | null): { label: string; color: string; bg: string } | null {
  if (!dateStr) return null;
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `منتهي منذ ${Math.abs(days)} يوم`, color: "#dc2626", bg: "#fff1f2" };
  if (days <= 30) return { label: `ينتهي خلال ${days} يوم`, color: "#d97706", bg: "#fffbeb" };
  return { label: dateStr, color: "#6b7280", bg: "#f9fafb" };
}

function StatCard({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: any }) {
  return (
    <div style={{ background:"white",borderRadius:14,border:"1.5px solid #f0ead8",padding:"12px 14px",display:"flex",alignItems:"center",gap:10 }}>
      <div style={{ width:34,height:34,borderRadius:10,background:`${color}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Icon size={16} color={color} /></div>
      <div>
        <div style={{ fontSize:17,fontWeight:800,color:GR,lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:10.5,color:"#9ca3af",marginTop:3 }}>{label}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   VEHICLE COST LOGS — fuel + service (+ parts from inventory)
═══════════════════════════════════════════════════════ */
const SERVICE_TYPES: Record<string, string> = { oil_change: "تغيير زيت", tires: "إطارات", brakes: "فرامل", general: "عام", other: "أخرى" };
const emptyFuelForm = { date: "", liters: "", pricePerLiter: "", odometerReading: "", notes: "" };
const emptyServiceForm = { serviceDate: "", serviceType: "general", workshopName: "", description: "", cost: "", odometerReading: "", notes: "" };
const emptyPartForm = { inventoryItemId: "", partName: "", quantity: "1", unitCost: "" };

function VehicleCostLogs({ vehicleId, canEdit }: { vehicleId: number; canEdit: boolean }) {
  const qc = useQueryClient();
  const [openSection, setOpenSection] = useState<"fuel" | "service" | null>(null);
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [fuelForm, setFuelForm] = useState({ ...emptyFuelForm });
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState({ ...emptyServiceForm });
  const [addingPartTo, setAddingPartTo] = useState<number | null>(null);
  const [partForm, setPartForm] = useState({ ...emptyPartForm });

  const { data: fuelLogs = [] } = useQuery<any[]>({
    queryKey: ["vehicle-fuel-logs", vehicleId],
    queryFn: () => vehiclesApi.fuelLogs.list(vehicleId),
    enabled: openSection === "fuel",
  });
  const { data: serviceLogs = [] } = useQuery<any[]>({
    queryKey: ["vehicle-service-logs", vehicleId],
    queryFn: () => vehiclesApi.serviceLogs.list(vehicleId),
    enabled: openSection === "service",
  });
  const { data: inventory = [] } = useQuery<any[]>({
    queryKey: ["maintenance-inventory", "all"],
    queryFn: () => apiFetch("/api/maintenance/inventory"),
    enabled: openSection === "service",
  });
  const { data: partsByLog = {} } = useQuery<Record<number, any[]>>({
    queryKey: ["vehicle-service-parts", vehicleId, serviceLogs.map((l: any) => l.id).join(",")],
    queryFn: async () => {
      const entries = await Promise.all(serviceLogs.map(async (l: any) => [l.id, await vehiclesApi.serviceParts.list(l.id)] as const));
      return Object.fromEntries(entries);
    },
    enabled: openSection === "service" && serviceLogs.length > 0,
  });

  const invFuel = () => { qc.invalidateQueries({ queryKey: ["vehicle-fuel-logs", vehicleId] }); qc.invalidateQueries({ queryKey: ["finance-expenses"] }); qc.invalidateQueries({ queryKey: ["finance-expenses-by-module"] }); };
  const invService = () => { qc.invalidateQueries({ queryKey: ["vehicle-service-logs", vehicleId] }); qc.invalidateQueries({ queryKey: ["finance-expenses"] }); qc.invalidateQueries({ queryKey: ["finance-expenses-by-module"] }); };

  const createFuelMut = useMutation({
    mutationFn: (d: any) => vehiclesApi.fuelLogs.create(vehicleId, d),
    onSuccess: () => { invFuel(); setShowFuelForm(false); setFuelForm({ ...emptyFuelForm }); },
  });
  const deleteFuelMut = useMutation({ mutationFn: (id: number) => vehiclesApi.fuelLogs.delete(id), onSuccess: invFuel });
  const createServiceMut = useMutation({
    mutationFn: (d: any) => vehiclesApi.serviceLogs.create(vehicleId, d),
    onSuccess: () => { invService(); setShowServiceForm(false); setServiceForm({ ...emptyServiceForm }); },
  });
  const deleteServiceMut = useMutation({ mutationFn: (id: number) => vehiclesApi.serviceLogs.delete(id), onSuccess: invService });
  const addPartMut = useMutation({
    mutationFn: ({ logId, d }: { logId: number; d: any }) => vehiclesApi.serviceParts.create(logId, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle-service-parts", vehicleId] }); qc.invalidateQueries({ queryKey: ["maintenance-inventory", "all"] }); setAddingPartTo(null); setPartForm({ ...emptyPartForm }); },
  });

  const saveFuel = () => {
    if (!fuelForm.date || !fuelForm.liters || !fuelForm.pricePerLiter) return;
    createFuelMut.mutate({
      date: fuelForm.date, liters: fuelForm.liters, pricePerLiter: fuelForm.pricePerLiter,
      odometerReading: fuelForm.odometerReading ? Number(fuelForm.odometerReading) : null,
      notes: fuelForm.notes || null,
    });
  };
  const saveService = () => {
    if (!serviceForm.serviceDate || !serviceForm.cost) return;
    createServiceMut.mutate({
      serviceDate: serviceForm.serviceDate, serviceType: serviceForm.serviceType,
      workshopName: serviceForm.workshopName || null, description: serviceForm.description || null,
      cost: serviceForm.cost, odometerReading: serviceForm.odometerReading ? Number(serviceForm.odometerReading) : null,
      notes: serviceForm.notes || null,
    });
  };
  const savePart = (logId: number) => {
    if (!partForm.partName.trim()) return;
    addPartMut.mutate({ logId, d: {
      inventoryItemId: partForm.inventoryItemId || null, partName: partForm.partName.trim(),
      quantity: partForm.quantity || "1", unitCost: partForm.unitCost || null,
    } });
  };

  const sectionHeader = (key: "fuel" | "service", icon: any, label: string) => {
    const Icon = icon;
    return (
      <button onClick={() => setOpenSection(o => o === key ? null : key)}
        style={{ width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderRadius:10,background:"#fdf8ec",border:"1px solid #f0ead8",cursor:"pointer",fontFamily:"inherit" }}>
        <span style={{ display:"flex",alignItems:"center",gap:8,fontSize:12.5,fontWeight:800,color:GR }}><Icon size={14} color={GD} />{label}</span>
        {openSection === key ? <ChevronUp size={14} color={GD} /> : <ChevronDown size={14} color={GD} />}
      </button>
    );
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:10,marginTop:6 }}>
      <div style={{ fontSize:11,fontWeight:800,color:"#9ca3af",letterSpacing:0.5,textTransform:"uppercase" }}>التكاليف المرتبطة</div>

      {/* الوقود */}
      {sectionHeader("fuel", Fuel, "سجل الوقود")}
      {openSection === "fuel" && (
        <div style={{ display:"flex",flexDirection:"column",gap:8,padding:"0 4px" }}>
          {fuelLogs.map((l: any) => (
            <div key={l.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",borderRadius:8,background:"#fafaf8",border:"1px solid #f5f0e6",fontSize:12 }}>
              <span>{l.date} · {Number(l.liters).toFixed(2)} لتر × {fmtKwd(Number(l.pricePerLiter))}</span>
              <span style={{ display:"flex",alignItems:"center",gap:8 }}>
                <b style={{ direction:"ltr" as const }}>{fmtKwd(Number(l.totalCost))}</b>
                {canEdit && <button onClick={() => deleteFuelMut.mutate(l.id)} style={{ background:"none",border:"none",cursor:"pointer",color:"#dc2626" }}><Trash2 size={12} /></button>}
              </span>
            </div>
          ))}
          {fuelLogs.length === 0 && <div style={{ fontSize:11.5,color:"#9ca3af",textAlign:"center",padding:6 }}>لا يوجد سجل تعبئة</div>}
          {canEdit && !showFuelForm && (
            <button onClick={() => setShowFuelForm(true)} style={{ alignSelf:"flex-start",display:"flex",alignItems:"center",gap:5,fontSize:11.5,fontWeight:700,color:GD,background:"none",border:"none",cursor:"pointer" }}><Plus size={12}/>إضافة تعبئة</button>
          )}
          {canEdit && showFuelForm && (
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"10px",borderRadius:10,background:"#fafaf8",border:"1px dashed #e5e7eb" }}>
              <div><label style={lbl}>التاريخ</label><input type="date" value={fuelForm.date} onChange={e=>setFuelForm(f=>({...f,date:e.target.value}))} style={inp} /></div>
              <div><label style={lbl}>عدد اللترات</label><input type="number" value={fuelForm.liters} onChange={e=>setFuelForm(f=>({...f,liters:e.target.value}))} dir="ltr" style={inp} /></div>
              <div><label style={lbl}>سعر اللتر (د.ك)</label><input type="number" step="0.001" value={fuelForm.pricePerLiter} onChange={e=>setFuelForm(f=>({...f,pricePerLiter:e.target.value}))} dir="ltr" style={inp} /></div>
              <div><label style={lbl}>قراءة العداد</label><input type="number" value={fuelForm.odometerReading} onChange={e=>setFuelForm(f=>({...f,odometerReading:e.target.value}))} dir="ltr" style={inp} /></div>
              <div style={{ gridColumn:"1/-1",display:"flex",gap:8,marginTop:4 }}>
                <button onClick={saveFuel} disabled={createFuelMut.isPending} style={{ padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:700,background:`linear-gradient(135deg,${G},${GD})`,border:"none",color:"white",cursor:"pointer",fontFamily:"inherit" }}>حفظ</button>
                <button onClick={() => { setShowFuelForm(false); setFuelForm({ ...emptyFuelForm }); }} style={{ padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:700,background:"#f9fafb",border:"1px solid #e5e7eb",color:"#374151",cursor:"pointer",fontFamily:"inherit" }}>إلغاء</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* السيرفس */}
      {sectionHeader("service", Wrench, "سجل السيرفس")}
      {openSection === "service" && (
        <div style={{ display:"flex",flexDirection:"column",gap:8,padding:"0 4px" }}>
          {serviceLogs.map((l: any) => (
            <div key={l.id} style={{ padding:"8px 10px",borderRadius:8,background:"#fafaf8",border:"1px solid #f5f0e6",fontSize:12 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                <span>{l.serviceDate} · {SERVICE_TYPES[l.serviceType] ?? l.serviceType}{l.workshopName ? ` · ${l.workshopName}` : ""}</span>
                <span style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <b style={{ direction:"ltr" as const }}>{fmtKwd(Number(l.cost))}</b>
                  {canEdit && <button onClick={() => deleteServiceMut.mutate(l.id)} style={{ background:"none",border:"none",cursor:"pointer",color:"#dc2626" }}><Trash2 size={12} /></button>}
                </span>
              </div>
              {(partsByLog[l.id] ?? []).length > 0 && (
                <div style={{ marginTop:6,paddingTop:6,borderTop:"1px dashed #e5e7eb",display:"flex",flexDirection:"column",gap:3 }}>
                  {(partsByLog[l.id] ?? []).map((p: any) => (
                    <div key={p.id} style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:"#6b7280" }}>
                      <span>{p.partName} × {p.quantity}</span>
                      {p.unitCost && <span style={{ direction:"ltr" as const }}>{fmtKwd(Number(p.unitCost) * Number(p.quantity))}</span>}
                    </div>
                  ))}
                </div>
              )}
              {canEdit && addingPartTo !== l.id && (
                <button onClick={() => setAddingPartTo(l.id)} style={{ marginTop:6,display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,color:GD,background:"none",border:"none",cursor:"pointer" }}><Plus size={11}/>إضافة قطعة غيار</button>
              )}
              {canEdit && addingPartTo === l.id && (
                <div style={{ marginTop:8,display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
                  <div style={{ gridColumn:"1/-1" }}>
                    <select value={partForm.inventoryItemId} onChange={e => {
                      const item = inventory.find((i: any) => String(i.id) === e.target.value);
                      setPartForm(f => ({ ...f, inventoryItemId: e.target.value, partName: item?.partName ?? f.partName, unitCost: item?.unitCost ?? f.unitCost }));
                    }} style={inp}>
                      <option value="">— اختر من المخزون (اختياري) —</option>
                      {inventory.map((i: any) => <option key={i.id} value={i.id}>{i.partName} (متوفر: {i.quantityOnHand})</option>)}
                    </select>
                  </div>
                  <div><input placeholder="اسم القطعة" value={partForm.partName} onChange={e=>setPartForm(f=>({...f,partName:e.target.value}))} style={inp} /></div>
                  <div><input type="number" placeholder="الكمية" value={partForm.quantity} onChange={e=>setPartForm(f=>({...f,quantity:e.target.value}))} dir="ltr" style={inp} /></div>
                  <div style={{ gridColumn:"1/-1" }}><input type="number" step="0.001" placeholder="تكلفة الوحدة (د.ك)" value={partForm.unitCost} onChange={e=>setPartForm(f=>({...f,unitCost:e.target.value}))} dir="ltr" style={inp} /></div>
                  <div style={{ gridColumn:"1/-1",display:"flex",gap:8 }}>
                    <button onClick={() => savePart(l.id)} disabled={addPartMut.isPending} style={{ padding:"6px 12px",borderRadius:8,fontSize:11.5,fontWeight:700,background:`linear-gradient(135deg,${G},${GD})`,border:"none",color:"white",cursor:"pointer",fontFamily:"inherit" }}>حفظ</button>
                    <button onClick={() => { setAddingPartTo(null); setPartForm({ ...emptyPartForm }); }} style={{ padding:"6px 12px",borderRadius:8,fontSize:11.5,fontWeight:700,background:"#f9fafb",border:"1px solid #e5e7eb",color:"#374151",cursor:"pointer",fontFamily:"inherit" }}>إلغاء</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {serviceLogs.length === 0 && <div style={{ fontSize:11.5,color:"#9ca3af",textAlign:"center",padding:6 }}>لا يوجد سجل سيرفس</div>}
          {canEdit && !showServiceForm && (
            <button onClick={() => setShowServiceForm(true)} style={{ alignSelf:"flex-start",display:"flex",alignItems:"center",gap:5,fontSize:11.5,fontWeight:700,color:GD,background:"none",border:"none",cursor:"pointer" }}><Plus size={12}/>إضافة سيرفس</button>
          )}
          {canEdit && showServiceForm && (
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"10px",borderRadius:10,background:"#fafaf8",border:"1px dashed #e5e7eb" }}>
              <div><label style={lbl}>التاريخ</label><input type="date" value={serviceForm.serviceDate} onChange={e=>setServiceForm(f=>({...f,serviceDate:e.target.value}))} style={inp} /></div>
              <div><label style={lbl}>النوع</label><select value={serviceForm.serviceType} onChange={e=>setServiceForm(f=>({...f,serviceType:e.target.value}))} style={inp}>{Object.entries(SERVICE_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
              <div><label style={lbl}>الورشة</label><input value={serviceForm.workshopName} onChange={e=>setServiceForm(f=>({...f,workshopName:e.target.value}))} style={inp} /></div>
              <div><label style={lbl}>التكلفة (د.ك)</label><input type="number" step="0.001" value={serviceForm.cost} onChange={e=>setServiceForm(f=>({...f,cost:e.target.value}))} dir="ltr" style={inp} /></div>
              <div><label style={lbl}>قراءة العداد</label><input type="number" value={serviceForm.odometerReading} onChange={e=>setServiceForm(f=>({...f,odometerReading:e.target.value}))} dir="ltr" style={inp} /></div>
              <div style={{ gridColumn:"1/-1" }}><label style={lbl}>وصف</label><input value={serviceForm.description} onChange={e=>setServiceForm(f=>({...f,description:e.target.value}))} style={inp} /></div>
              <div style={{ gridColumn:"1/-1",display:"flex",gap:8,marginTop:4 }}>
                <button onClick={saveService} disabled={createServiceMut.isPending} style={{ padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:700,background:`linear-gradient(135deg,${G},${GD})`,border:"none",color:"white",cursor:"pointer",fontFamily:"inherit" }}>حفظ</button>
                <button onClick={() => { setShowServiceForm(false); setServiceForm({ ...emptyServiceForm }); }} style={{ padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:700,background:"#f9fafb",border:"1px solid #e5e7eb",color:"#374151",cursor:"pointer",fontFamily:"inherit" }}>إلغاء</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FleetTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState<VehicleRow | null>(null);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("");
  const [form, setForm]             = useState({ ...emptyVehicleForm });

  const { data: rows = [], isLoading } = useQuery<VehicleRow[]>({
    queryKey: ["vehicles"],
    queryFn: () => vehiclesApi.list(),
  });
  const { data: stats } = useQuery<VehicleStats>({
    queryKey: ["vehicles-stats"],
    queryFn: () => vehiclesApi.stats(),
  });

  useEffect(() => {
    if (editing) {
      setForm({
        plateNumber: editing.plateNumber, vehicleType: editing.vehicleType ?? "سيارة صغيرة",
        makeModel: editing.makeModel ?? "", year: editing.year ? String(editing.year) : "",
        color: editing.color ?? "", ownership: editing.ownership, status: editing.status,
        driverName: editing.driverName ?? "", driverPhone: editing.driverPhone ?? "",
        registrationExpiry: editing.registrationExpiry ?? "", insuranceExpiry: editing.insuranceExpiry ?? "",
        purchaseDate: editing.purchaseDate ?? "", purchaseValue: editing.purchaseValue ?? "",
        notes: editing.notes ?? "",
      });
    } else { setForm({ ...emptyVehicleForm }); }
  }, [editing, drawerOpen]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["vehicles"] }); qc.invalidateQueries({ queryKey: ["vehicles-stats"] }); };
  const createMut = useMutation({ mutationFn: (d: any) => vehiclesApi.create(d), onSuccess: () => { invalidate(); setDrawerOpen(false); setEditing(null); } });
  const updateMut = useMutation({ mutationFn: ({ id, d }: { id: number; d: any }) => vehiclesApi.update(id, d), onSuccess: () => { invalidate(); setDrawerOpen(false); setEditing(null); } });
  const deleteMut = useMutation({ mutationFn: (id: number) => vehiclesApi.delete(id), onSuccess: invalidate });

  const handleSave = () => {
    if (!form.plateNumber.trim()) return;
    const d = {
      plateNumber: form.plateNumber, vehicleType: form.vehicleType || null, makeModel: form.makeModel || null,
      year: form.year ? Number(form.year) : null, color: form.color || null, ownership: form.ownership,
      status: form.status, driverName: form.driverName || null, driverPhone: form.driverPhone || null,
      registrationExpiry: form.registrationExpiry || null, insuranceExpiry: form.insuranceExpiry || null,
      purchaseDate: form.purchaseDate || null, purchaseValue: form.purchaseValue || null,
      notes: form.notes || null,
    };
    if (editing) updateMut.mutate({ id: editing.id, d });
    else createMut.mutate(d);
  };

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.plateNumber.toLowerCase().includes(q) || (r.makeModel ?? "").toLowerCase().includes(q) || (r.driverName ?? "").toLowerCase().includes(q))
      && (!statusFilter || r.status === statusFilter);
  });

  return (
    <>
      <Drawer open={drawerOpen || !!editing} onClose={() => { setDrawerOpen(false); setEditing(null); }} title={editing ? "تعديل المركبة" : "مركبة جديدة"} subtitle="بيانات المركبة والسائق والوثائق" icon={Car}
        footer={<><SaveBtn onClick={handleSave} isPending={createMut.isPending || updateMut.isPending} label={editing ? "حفظ التعديلات" : "إضافة المركبة"} /><button onClick={() => { setDrawerOpen(false); setEditing(null); }} style={{ padding:"11px 20px",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",background:"#f9fafb",border:"1.5px solid #e5e7eb",color:"#374151",fontFamily:"inherit" }}><X size={15} /></button></>}>

        <div style={{ fontSize:11,fontWeight:800,color:"#9ca3af",letterSpacing:0.5,textTransform:"uppercase" }}>بيانات المركبة</div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <div><label style={lbl}>رقم اللوحة *</label><input value={form.plateNumber} onChange={e=>set("plateNumber",e.target.value)} placeholder="123 س ن ص" dir="ltr" style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
          <div><label style={lbl}>نوع المركبة</label><select value={form.vehicleType} onChange={e=>set("vehicleType",e.target.value)} style={{...inp,appearance:"none",cursor:"pointer"}} onFocus={onFocus} onBlur={onBlur}>{VEHICLE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <div><label style={lbl}>الموديل</label><input value={form.makeModel} onChange={e=>set("makeModel",e.target.value)} placeholder="تويوتا هايلوكس" style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
          <div><label style={lbl}>سنة الصنع</label><input type="number" value={form.year} onChange={e=>set("year",e.target.value)} placeholder="2022" dir="ltr" style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <div><label style={lbl}>اللون</label><input value={form.color} onChange={e=>set("color",e.target.value)} placeholder="أبيض" style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
          <div><label style={lbl}>حالة الملكية</label><select value={form.ownership} onChange={e=>set("ownership",e.target.value)} style={{...inp,appearance:"none",cursor:"pointer"}} onFocus={onFocus} onBlur={onBlur}><option value="owned">مملوكة</option><option value="rented">مستأجرة</option></select></div>
        </div>

        <div style={{ fontSize:11,fontWeight:800,color:"#9ca3af",letterSpacing:0.5,textTransform:"uppercase",marginTop:6 }}>السائق</div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <div><label style={lbl}>اسم السائق</label><input value={form.driverName} onChange={e=>set("driverName",e.target.value)} placeholder="اسم السائق المسؤول" style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
          <div><label style={lbl}>رقم هاتف السائق</label><input value={form.driverPhone} onChange={e=>set("driverPhone",e.target.value)} placeholder="+965 ...." dir="ltr" style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
        </div>

        <div style={{ fontSize:11,fontWeight:800,color:"#9ca3af",letterSpacing:0.5,textTransform:"uppercase",marginTop:6 }}>الحالة والوثائق</div>
        <div><label style={lbl}>حالة المركبة</label><select value={form.status} onChange={e=>set("status",e.target.value)} style={{...inp,appearance:"none",cursor:"pointer"}} onFocus={onFocus} onBlur={onBlur}>{Object.entries(VEHICLE_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <div><label style={lbl}>انتهاء الفحص الدوري</label><input type="date" value={form.registrationExpiry} onChange={e=>set("registrationExpiry",e.target.value)} style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
          <div><label style={lbl}>انتهاء التأمين</label><input type="date" value={form.insuranceExpiry} onChange={e=>set("insuranceExpiry",e.target.value)} style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
        </div>

        <div style={{ fontSize:11,fontWeight:800,color:"#9ca3af",letterSpacing:0.5,textTransform:"uppercase",marginTop:6 }}>الشراء (استثمار رأسمالي)</div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <div><label style={lbl}>تاريخ الشراء</label><input type="date" value={form.purchaseDate} onChange={e=>set("purchaseDate",e.target.value)} style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
          <div><label style={lbl}>قيمة الشراء (د.ك)</label><input type="number" step="0.001" value={form.purchaseValue} onChange={e=>set("purchaseValue",e.target.value)} dir="ltr" placeholder="0.000" style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
        </div>

        <div><label style={lbl}>ملاحظات</label><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={3} style={{...inp,resize:"vertical"} as any} onFocus={onFocus as any} onBlur={onBlur as any} /></div>

        {editing && <VehicleCostLogs vehicleId={editing.id} canEdit={canEdit} />}
      </Drawer>

      {/* Stats bar */}
      {stats && (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10 }}>
          <StatCard label="إجمالي المركبات" value={stats.total} color={GD} icon={Car} />
          <StatCard label="نشطة" value={stats.active} color="#16a34a" icon={CheckCircle2} />
          <StatCard label="في الصيانة / خارج الخدمة" value={stats.maintenance + stats.outOfService} color="#d97706" icon={Clock} />
          <StatCard label="وثائق تنتهي خلال 30 يوم" value={stats.expiring30} color="#d97706" icon={AlertTriangle} />
          <StatCard label="وثائق منتهية" value={stats.expired} color="#dc2626" icon={AlertTriangle} />
        </div>
      )}

      {/* Filters */}
      <div style={{ background:"white",borderRadius:16,border:"1.5px solid #f0ead8",padding:"16px 20px",display:"flex",gap:12,flexWrap:"wrap",alignItems:"center" }}>
        <div style={{ position:"relative",flex:"1 1 220px",minWidth:200 }}>
          <Search size={15} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none" }} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث برقم اللوحة، الموديل، السائق..." style={{...inp,paddingRight:36}} />
        </div>
        <div style={{ position:"relative",minWidth:160 }}>
          <select value={statusFilter} onChange={e=>setStatus(e.target.value)} style={{...inp,appearance:"none",paddingLeft:32,cursor:"pointer",minWidth:160}}>
            <option value="">جميع الحالات</option>
            {Object.entries(VEHICLE_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <ChevronDown size={14} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none" }} />
        </div>
        {canEdit && <button onClick={()=>{setEditing(null);setDrawerOpen(true);}} style={{ display:"flex",alignItems:"center",gap:7,padding:"9px 18px",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",background:`linear-gradient(135deg,${G},${GD})`,border:"none",color:"white",fontFamily:"inherit",boxShadow:`0 4px 14px rgba(212,165,52,0.4)` }}><Plus size={14} />مركبة جديدة</button>}
        {(search||statusFilter) && <button onClick={()=>{setSearch("");setStatus("");}} style={{ display:"flex",alignItems:"center",gap:5,padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:600,background:"#fff1f2",color:"#dc2626",border:"1px solid #fecaca",cursor:"pointer",fontFamily:"inherit" }}><X size={13}/>إلغاء</button>}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12 }}>{[...Array(3)].map((_,i)=><div key={i} style={{ background:"white",borderRadius:16,height:150,animation:"pulse 1.5s infinite",border:"1.5px solid #f0ead8" }} />)}</div>
      ) : filtered.length===0 ? (
        <div style={{ background:"white",borderRadius:20,border:"1.5px solid #f0ead8",padding:"64px 0",textAlign:"center" }}>
          <Car size={44} color="#e2d5b0" style={{ margin:"0 auto 12px",display:"block" }} />
          <p style={{ color:"#94a3b8",fontSize:14,fontWeight:600,margin:0 }}>{search||statusFilter?"لا توجد نتائج مطابقة":"لا توجد مركبات مسجّلة بعد"}</p>
        </div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12 }}>
          {filtered.map(row => {
            const st = VEHICLE_STATUS[row.status] ?? VEHICLE_STATUS.active;
            const regExp = expiryInfo(row.registrationExpiry);
            const insExp = expiryInfo(row.insuranceExpiry);
            return (
              <div key={row.id} style={{ background:"white",borderRadius:16,border:"1.5px solid #f0ead8",padding:"16px 18px",display:"flex",flexDirection:"column",gap:10 }}>
                <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <div style={{ width:40,height:40,borderRadius:12,background:`${G}15`,border:`1px solid ${G}25`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Car size={17} color={G} /></div>
                    <div>
                      <div style={{ fontSize:14,fontWeight:800,color:GR,fontFamily:"monospace" }}>{row.plateNumber}</div>
                      <div style={{ fontSize:11,color:"#9ca3af",marginTop:2 }}>{row.makeModel || row.vehicleType || "—"}{row.year?` · ${row.year}`:""}</div>
                    </div>
                  </div>
                  {canEdit && (
                    <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                      <button onClick={()=>setEditing(row)} style={{ display:"flex",alignItems:"center",padding:"5px 8px",borderRadius:8,background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0",cursor:"pointer" }}><Pencil size={12}/></button>
                      <button onClick={()=>{ if(confirm(`حذف المركبة ${row.plateNumber}؟`)) deleteMut.mutate(row.id); }} style={{ display:"flex",alignItems:"center",padding:"5px 8px",borderRadius:8,background:"#fff1f2",color:"#dc2626",border:"1px solid #fecaca",cursor:"pointer" }}><Trash2 size={12}/></button>
                    </div>
                  )}
                </div>
                <span style={{ alignSelf:"flex-start",fontSize:11,fontWeight:700,padding:"3px 12px",borderRadius:20,background:st.bg,color:st.color,border:`1px solid ${st.color}30` }}>{st.label}</span>
                {row.driverName && <div style={{ display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#374151" }}><Users size={12} color={GD}/>{row.driverName}{row.driverPhone && <span dir="ltr" style={{ color:"#9ca3af" }}>· {row.driverPhone}</span>}</div>}
                {(regExp || insExp) && (
                  <div style={{ display:"flex",flexWrap:"wrap",gap:8,paddingTop:8,borderTop:"1px solid #f5f0e6" }}>
                    {regExp && <span style={{ display:"flex",alignItems:"center",gap:4,fontSize:10.5,fontWeight:700,padding:"3px 9px",borderRadius:8,background:regExp.bg,color:regExp.color }}><FileText size={11}/>فحص: {regExp.label}</span>}
                    {insExp && <span style={{ display:"flex",alignItems:"center",gap:4,fontSize:10.5,fontWeight:700,padding:"3px 9px",borderRadius:8,background:insExp.bg,color:insExp.color }}><ShieldCheck size={11}/>تأمين: {insExp.label}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB — BUDGET
═══════════════════════════════════════════════════════ */
function fmtKwd(v: number) { return `${Number(v || 0).toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} د.ك`; }

function MoneyStatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background:"white",borderRadius:14,border:"1.5px solid #f0ead8",padding:"12px 14px" }}>
      <div style={{ fontSize:15,fontWeight:900,color,direction:"ltr" as const,textAlign:"right" as const,lineHeight:1.1 }}>{fmtKwd(value)}</div>
      <div style={{ fontSize:10.5,color:"#9ca3af",marginTop:5 }}>{label}</div>
    </div>
  );
}

function BudgetTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: summary } = useQuery<any>({
    queryKey: ["transportation-budget-summary", year],
    queryFn: () => apiFetch(`/api/transportation/budgets/summary?year=${year}`),
  });

  const upsertMut = useMutation({
    mutationFn: (d: any) => apiFetch("/api/transportation/budgets", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportation-budget-summary", year] }); },
  });

  const byMonth: Record<number, any> = {};
  (summary?.monthly ?? []).forEach((r: any) => { byMonth[r.month] = r; });

  const byTypeData = (summary?.byType ?? []).map((r: any) => ({ name: r.label ?? "غير محدد", value: Number(r.total) }));
  const byVehicleData = (summary?.byVehicle ?? []).map((r: any) => ({ name: r.label ?? "غير محدد", value: Number(r.total) }));
  const byWorkerCostData = (summary?.byWorkerCost ?? []).map((r: any) => ({ name: r.label ?? "غير محدد", value: Number(r.total) }));
  const incomeVsSpentData = MONTH_AR.map((label, i) => {
    const row = byMonth[i + 1];
    return { name: label, دخل: row ? Number(row.income ?? 0) : 0, مصروف: row ? Number(row.spent ?? 0) : 0 };
  });
  const capexList = summary?.capexList ?? [];
  const annualNet = summary?.annualNet ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ ...lbl, marginBottom: 0 }}>السنة</label>
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())} dir="ltr" style={{ ...inp, width: 110 }} />
      </div>

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
          <MoneyStatCard label="الدخل السنوي" value={summary.annualIncome} color="#16a34a" />
          <MoneyStatCard label="المصروف التشغيلي السنوي" value={summary.annualSpent} color="#dc2626" />
          <MoneyStatCard label="صافي الربح/الخسارة" value={annualNet} color={annualNet >= 0 ? "#16a34a" : "#dc2626"} />
          <MoneyStatCard label="الميزانية السنوية" value={summary.annualBudget} color={GD} />
          <MoneyStatCard label="المتبقي من الميزانية" value={summary.annualRemaining} color={summary.annualRemaining >= 0 ? "#16a34a" : "#dc2626"} />
          <MoneyStatCard label="الاستثمارات الرأسمالية" value={summary.annualCapex} color="#7c3aed" />
        </div>
      )}

      <div style={{ background:"white",borderRadius:16,border:"1.5px solid #f0ead8",padding:"16px 18px" }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: GR, margin: "0 0 10px" }}>الدخل مقابل المصروف شهريًا</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={incomeVsSpentData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
            <Bar dataKey="دخل" fill="#16a34a" radius={[5, 5, 0, 0]} />
            <Bar dataKey="مصروف" fill="#dc2626" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background:"white",borderRadius:16,border:"1.5px solid #f0ead8",padding:"16px 18px" }}>
        <div style={{ fontSize:11,fontWeight:800,color:"#9ca3af",letterSpacing:0.5,textTransform:"uppercase",marginBottom:10 }}>الميزانية الشهرية</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#f9f6ee" }}>
                {["الشهر", "الميزانية (د.ك)", "الدخل", "المصروف", "الصافي", "المتبقي من الميزانية"].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#4a3f1a" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MONTH_AR.map((label, i) => {
                const m = i + 1;
                const row = byMonth[m];
                const budget = row ? Number(row.budget) : 0;
                const spent = row ? Number(row.spent) : 0;
                const income = row ? Number(row.income ?? 0) : 0;
                const net = income - spent;
                const remaining = budget - spent;
                return (
                  <tr key={m} style={{ borderBottom: "1px solid #f5f0e6" }}>
                    <td style={{ padding: "6px 10px", fontWeight: 700, color: GR }}>{label}</td>
                    <td style={{ padding: "6px 10px" }}>
                      {canEdit ? (
                        <input type="number" defaultValue={row?.budget ?? ""} placeholder="0.000" dir="ltr"
                          onBlur={(e) => { const v = e.target.value; if (v) upsertMut.mutate({ year, month: m, amount: v }); }}
                          style={{ ...inp, width: 110, padding: "5px 8px" }} />
                      ) : fmtKwd(budget)}
                    </td>
                    <td style={{ padding: "6px 10px", color: "#16a34a", direction: "ltr" as const }}>{fmtKwd(income)}</td>
                    <td style={{ padding: "6px 10px", color: "#dc2626", direction: "ltr" as const }}>{fmtKwd(spent)}</td>
                    <td style={{ padding: "6px 10px", color: net >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700, direction: "ltr" as const }}>{fmtKwd(net)}</td>
                    <td style={{ padding: "6px 10px", color: remaining >= 0 ? "#16a34a" : "#dc2626", direction: "ltr" as const }}>{fmtKwd(remaining)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background:"#faf9ff",borderRadius:16,border:"1.5px solid #ede9fe",padding:"16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: "#6d28d9", margin: 0 }}>الاستثمارات الرأسمالية — {year}</p>
          <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700 }}>الإجمالي: {fmtKwd(summary?.annualCapex ?? 0)}</span>
        </div>
        <p style={{ fontSize: 10.5, color: "#9ca3af", margin: "0 0 10px" }}>لا تُحتسب ضمن المصروف التشغيلي الشهري — نفقات شراء مركبات لمرة واحدة</p>
        {capexList.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {capexList.map((c: any) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: "white", border: "1px solid #ede9fe", fontSize: 11.5 }}>
                <span>{c.plateNumber}{c.makeModel ? ` — ${c.makeModel}` : ""} <span style={{ color: "#9ca3af" }}>({new Date(c.purchaseDate).toLocaleDateString("ar-KW")})</span></span>
                <span style={{ fontWeight: 700, color: "#7c3aed", direction: "ltr" as const }}>{fmtKwd(c.purchaseValue)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 11.5, margin: "4px 0" }}>لا توجد عمليات شراء مركبات مسجّلة في هذه السنة</p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background:"white",borderRadius:16,border:"1.5px solid #f0ead8",padding:"16px 18px" }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: GR, margin: "0 0 10px" }}>توزيع التكلفة حسب النوع</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byTypeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
              <Bar dataKey="value" fill={G} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background:"white",borderRadius:16,border:"1.5px solid #f0ead8",padding:"16px 18px" }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: GR, margin: "0 0 10px" }}>أعلى 10 مركبات حسب التكلفة</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byVehicleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
              <Bar dataKey="value" fill="#2563eb" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {byWorkerCostData.length > 0 && (
        <div style={{ background:"white",borderRadius:16,border:"1.5px solid #f0ead8",padding:"16px 18px" }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: GR, margin: "0 0 10px" }}>تكلفة العمال حسب الاسم</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byWorkerCostData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, fontFamily: "Cairo,sans-serif" }} />
              <Bar dataKey="value" fill="#7c3aed" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════ */
export default function TransportationList() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || !!user?.canEdit;
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState<"fleet"|"orders"|"teams"|"calendar"|"budget">("fleet");

  const { data: orders = [] } = useQuery<TransportRow[]>({
    queryKey: ["transportation"],
    queryFn: () => apiFetch("/api/transportation"),
  });
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["transport-teams"],
    queryFn: () => apiFetch("/api/transportation/teams"),
  });
  const { data: vehicles = [] } = useQuery<VehicleRow[]>({
    queryKey: ["vehicles"],
    queryFn: () => vehiclesApi.list(),
  });

  const todayStr    = todayKuwait();
  const todayOrders = orders.filter(o => o.deliveryDate === todayStr).length;

  const TABS = [
    { key: "fleet",    label: "الأسطول",  icon: Car,        count: vehicles.length },
    { key: "orders",   label: "الأوامر",  icon: Truck,      count: orders.length },
    { key: "teams",    label: "الفرق",    icon: Users,      count: teams.length },
    { key: "calendar", label: "التقويم",  icon: Calendar,   count: todayOrders > 0 ? todayOrders : undefined },
    { key: "budget",   label: "الميزانية", icon: Wallet,    count: undefined },
  ] as const;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>المركبات والنقل</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>الأسطول · أوامر النقل · الفرق · جدول المهام · الميزانية</p>
        </div>
        <a
          href="https://lightbug.cloud"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12,
            fontSize: 13, fontWeight: 800, textDecoration: "none", fontFamily: "inherit",
            background: `linear-gradient(135deg,${GR},#1e4028)`, color: "white",
            boxShadow: "0 4px 14px rgba(19,42,24,0.3)",
          }}
        >
          <Satellite size={15} color={G} /> موقع التتبع المباشر (LightBug) <ExternalLink size={13} />
        </a>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: 6, alignSelf: "flex-start", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", border: "none", background: activeTab === t.key ? `linear-gradient(135deg,${G},${GD})` : "transparent", color: activeTab === t.key ? "white" : "#374151", boxShadow: activeTab === t.key ? `0 3px 12px rgba(212,165,52,0.4)` : undefined }}>
            <t.icon size={15} />
            {t.label}
            {t.count !== undefined && <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: activeTab === t.key ? "rgba(255,255,255,0.25)" : "#f3f4f6", color: activeTab === t.key ? "white" : "#6b7280", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "fleet"    && <FleetTab    canEdit={canEdit} />}
      {activeTab === "orders"   && <OrdersTab   canEdit={canEdit} />}
      {activeTab === "teams"    && <TeamsTab    canEdit={canEdit} isAdmin={isAdmin} />}
      {activeTab === "calendar" && <CalendarTab />}
      {activeTab === "budget"   && <BudgetTab   canEdit={canEdit} />}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
