import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { nowKuwait, todayKuwait } from "@/lib/timezone";
import { TruckMap } from "@/components/TruckMap";
import {
  Truck, Plus, Search, X, Save, Pencil, Trash2,
  MapPin, Calendar, Package, ChevronDown, ArrowRight,
  DollarSign, FileText, Users, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, AlertCircle, UserPlus, Loader2,
  ClipboardList, Layers, Navigation,
} from "lucide-react";

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
interface Supplier { id: number; name: string; }
interface UserDir  { id: number; fullName: string; username: string; }

interface TransportRow {
  id: number; orderNumber: string | null; supplierId: number | null;
  description: string; origin: string | null; destination: string | null;
  orderDate: string | null; deliveryDate: string | null; value: string | null;
  status: string; vehicleInfo: string | null; notes: string | null;
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
interface Task {
  id: number; teamId: number | null; title: string; description: string | null;
  dueDate: string | null; dueTime: string | null; status: string;
  notes: string | null; assignedTo: number | null; createdBy: number | null;
  createdAt: string; assignedToName: string | null;
  teamName: string | null; teamColor: string | null;
}

const STATUS_ORDER: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:    { label: "قيد الانتظار", color: "#d97706", bg: "#fffbeb", icon: Clock },
  in_transit: { label: "جارٍ النقل",   color: "#2563eb", bg: "#eff6ff", icon: Truck },
  delivered:  { label: "تم التسليم",   color: "#16a34a", bg: "#f0fdf4", icon: CheckCircle2 },
  cancelled:  { label: "ملغي",          color: "#dc2626", bg: "#fff1f2", icon: X },
};
const TASK_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: "قيد الانتظار",  color: "#d97706", bg: "#fffbeb" },
  in_progress: { label: "جارٍ التنفيذ", color: "#2563eb", bg: "#eff6ff" },
  done:        { label: "مكتملة",        color: "#16a34a", bg: "#f0fdf4" },
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
  orderNumber:"",supplierId:"" as string|number,description:"",origin:"",
  destination:"",orderDate:"",deliveryDate:"",value:"",status:"pending",vehicleInfo:"",notes:"",
};

function OrdersTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState<TransportRow | null>(null);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("");
  const [form, setForm]             = useState({ ...emptyOrderForm });

  const { data: rows = [], isLoading } = useQuery<TransportRow[]>({
    queryKey: ["transportation"],
    queryFn: () => apiFetch("/api/transportation"),
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers-simple"],
    queryFn: () => apiFetch("/api/suppliers"),
    select: (d: any[]) => d.map(s => ({ id: s.id, name: s.name })),
  });

  useEffect(() => {
    if (editing) {
      setForm({ orderNumber:editing.orderNumber??"",supplierId:editing.supplierId??"",description:editing.description,origin:editing.origin??"",destination:editing.destination??"",orderDate:editing.orderDate??"",deliveryDate:editing.deliveryDate??"",value:editing.value??"",status:editing.status,vehicleInfo:editing.vehicleInfo??"",notes:editing.notes??"" });
    } else { setForm({ ...emptyOrderForm }); }
  }, [editing, drawerOpen]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const createMut = useMutation({ mutationFn: (d:any) => apiFetch("/api/transportation",{method:"POST",body:JSON.stringify(d)}), onSuccess: ()=>{ qc.invalidateQueries({queryKey:["transportation"]}); setDrawerOpen(false); setEditing(null); } });
  const updateMut = useMutation({ mutationFn: ({id,d}:{id:number,d:any}) => apiFetch(`/api/transportation/${id}`,{method:"PATCH",body:JSON.stringify(d)}), onSuccess: ()=>{ qc.invalidateQueries({queryKey:["transportation"]}); setDrawerOpen(false); setEditing(null); } });
  const deleteMut = useMutation({ mutationFn: (id:number) => apiFetch(`/api/transportation/${id}`,{method:"DELETE"}), onSuccess: ()=> qc.invalidateQueries({queryKey:["transportation"]}) });

  const handleSave = () => {
    const d = { orderNumber:form.orderNumber||null,supplierId:form.supplierId?Number(form.supplierId):null,description:form.description,origin:form.origin||null,destination:form.destination||null,orderDate:form.orderDate||null,deliveryDate:form.deliveryDate||null,value:form.value||null,status:form.status,vehicleInfo:form.vehicleInfo||null,notes:form.notes||null };
    if (editing) updateMut.mutate({ id:editing.id, d });
    else createMut.mutate(d);
  };

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.description.toLowerCase().includes(q)||(r.orderNumber??"").toLowerCase().includes(q)||(r.origin??"").toLowerCase().includes(q)||(r.destination??"").toLowerCase().includes(q)||(r.supplierName??"").toLowerCase().includes(q))
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
          <div><label style={lbl}>شركة النقل</label><select value={form.supplierId} onChange={e=>set("supplierId",e.target.value)} style={{...inp,appearance:"none",cursor:"pointer"}} onFocus={onFocus} onBlur={onBlur}><option value="">— اختر شركة —</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label style={lbl}>القيمة (د.ك)</label><input type="number" min="0" step="0.001" value={form.value} onChange={e=>set("value",e.target.value)} placeholder="0.000" dir="ltr" style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
        </div>
        <div><label style={lbl}>معلومات المركبة / السائق</label><input value={form.vehicleInfo} onChange={e=>set("vehicleInfo",e.target.value)} placeholder="رقم اللوحة، اسم السائق..." style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
        <div><label style={lbl}>ملاحظات</label><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={3} style={{...inp,resize:"vertical"} as any} onFocus={onFocus as any} onBlur={onBlur as any} /></div>
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
                      <button onClick={()=>setEditing(row)} style={{ display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:700,background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0",cursor:"pointer",fontFamily:"inherit" }}><Pencil size={12}/>تعديل</button>
                      <button onClick={()=>{ if(confirm(`حذف أمر النقل؟`)) deleteMut.mutate(row.id); }} style={{ display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:700,background:"#fff1f2",color:"#dc2626",border:"1px solid #fecaca",cursor:"pointer",fontFamily:"inherit" }}><Trash2 size={12}/></button>
                    </div>
                  )}
                </div>
                <div style={{ display:"flex",flexWrap:"wrap",gap:14,paddingTop:8,borderTop:"1px solid #f5f0e6",fontSize:12,color:"#374151" }}>
                  {(row.origin||row.destination) && <span style={{ display:"flex",alignItems:"center",gap:5 }}><MapPin size={12} color={GD}/>{row.origin||"—"} <ArrowRight size={11} color="#9ca3af"/> {row.destination||"—"}</span>}
                  {row.orderDate && <span style={{ display:"flex",alignItems:"center",gap:5 }}><Calendar size={12} color="#7c3aed"/>{row.orderDate}</span>}
                  {row.value && <span style={{ display:"flex",alignItems:"center",gap:5 }}><DollarSign size={12} color={GD}/>{Number(row.value).toLocaleString("ar-KW")} د.ك</span>}
                  {row.supplierName && <span style={{ display:"flex",alignItems:"center",gap:5 }}><Truck size={12} color="#2563eb"/>{row.supplierName}</span>}
                </div>
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
   TAB 3 — CALENDAR (Kuwait time)
═══════════════════════════════════════════════════════ */
const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const DAY_AR   = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

const emptyTaskForm = { teamId:"" as string|number, title:"", description:"", dueDate:"", dueTime:"", status:"pending", notes:"", assignedTo:"" as string|number };

function CalendarTab({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const qc = useQueryClient();
  const now        = nowKuwait();
  const todayStr   = todayKuwait();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string>(todayStr);
  const [taskDrawer, setTaskDrawer]   = useState(false);
  const [editingTask, setEditingTask] = useState<Task|null>(null);
  const [form, setForm] = useState({ ...emptyTaskForm });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["transport-tasks"],
    queryFn: () => apiFetch("/api/transportation/tasks"),
  });
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["transport-teams"],
    queryFn: () => apiFetch("/api/transportation/teams"),
  });
  const { data: users = [] } = useQuery<UserDir[]>({
    queryKey: ["users-directory"],
    queryFn: () => apiFetch("/api/users/directory"),
  });

  useEffect(() => {
    if (editingTask) {
      setForm({ teamId:editingTask.teamId??"",title:editingTask.title,description:editingTask.description??"",dueDate:editingTask.dueDate??"",dueTime:editingTask.dueTime??"",status:editingTask.status,notes:editingTask.notes??"",assignedTo:editingTask.assignedTo??"" });
    } else {
      setForm({ ...emptyTaskForm, dueDate:selectedDay });
    }
  }, [editingTask, taskDrawer, selectedDay]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const createTaskMut = useMutation({ mutationFn: (d:any)=>apiFetch("/api/transportation/tasks",{method:"POST",body:JSON.stringify(d)}), onSuccess:()=>{ qc.invalidateQueries({queryKey:["transport-tasks"]}); setTaskDrawer(false); } });
  const updateTaskMut = useMutation({ mutationFn: ({id,d}:{id:number,d:any})=>apiFetch(`/api/transportation/tasks/${id}`,{method:"PATCH",body:JSON.stringify(d)}), onSuccess:()=>{ qc.invalidateQueries({queryKey:["transport-tasks"]}); setTaskDrawer(false); setEditingTask(null); } });
  const deleteTaskMut = useMutation({ mutationFn: (id:number)=>apiFetch(`/api/transportation/tasks/${id}`,{method:"DELETE"}), onSuccess:()=> qc.invalidateQueries({queryKey:["transport-tasks"]}) });

  const handleSaveTask = () => {
    if (!form.title.trim()) return;
    const d = { teamId:form.teamId?Number(form.teamId):null,title:form.title,description:form.description||null,dueDate:form.dueDate||null,dueTime:form.dueTime||null,status:form.status,notes:form.notes||null,assignedTo:form.assignedTo?Number(form.assignedTo):null };
    if (editingTask) updateTaskMut.mutate({ id:editingTask.id, d });
    else createTaskMut.mutate(d);
  };

  /* Build calendar grid */
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number|null)[] = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];
  while (cells.length % 7) cells.push(null);

  const byDate: Record<string, Task[]> = {};
  tasks.forEach(t => { if(t.dueDate) { (byDate[t.dueDate]??=[]).push(t); } });

  const selectedTasks = byDate[selectedDay] ?? [];

  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  return (
    <>
      {/* Task form drawer */}
      <Drawer open={taskDrawer||!!editingTask} onClose={()=>{setTaskDrawer(false);setEditingTask(null);}} title={editingTask?"تعديل المهمة":"مهمة جديدة"} subtitle="حدد التاريخ والوقت والفريق المسؤول" icon={ClipboardList}
        footer={<><SaveBtn onClick={handleSaveTask} isPending={createTaskMut.isPending||updateTaskMut.isPending} label={editingTask?"حفظ التعديلات":"إضافة المهمة"} /><button onClick={()=>{setTaskDrawer(false);setEditingTask(null);}} style={{ padding:"11px 20px",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",background:"#f9fafb",border:"1.5px solid #e5e7eb",color:"#374151",fontFamily:"inherit" }}><X size={15}/></button></>}>
        <div><label style={lbl}>عنوان المهمة *</label><input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="عنوان واضح للمهمة" style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
        <div><label style={lbl}>الوصف</label><textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={3} placeholder="تفاصيل المهمة..." style={{...inp,resize:"vertical"} as any} onFocus={onFocus as any} onBlur={onBlur as any} /></div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <div><label style={lbl}>التاريخ (بتوقيت الكويت)</label><input type="date" value={form.dueDate} onChange={e=>set("dueDate",e.target.value)} style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
          <div><label style={lbl}>الوقت</label><input type="time" value={form.dueTime} onChange={e=>set("dueTime",e.target.value)} style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <div>
            <label style={lbl}>الفريق المسؤول</label>
            <select value={form.teamId} onChange={e=>set("teamId",e.target.value)} style={{...inp,appearance:"none",cursor:"pointer"}} onFocus={onFocus} onBlur={onBlur}>
              <option value="">— بدون فريق —</option>
              {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>مسؤول المهمة</label>
            <select value={form.assignedTo} onChange={e=>set("assignedTo",e.target.value)} style={{...inp,appearance:"none",cursor:"pointer"}} onFocus={onFocus} onBlur={onBlur}>
              <option value="">— غير محدد —</option>
              {users.map(u=><option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={lbl}>الحالة</label>
          <select value={form.status} onChange={e=>set("status",e.target.value)} style={{...inp,appearance:"none",cursor:"pointer"}} onFocus={onFocus} onBlur={onBlur}>
            {Object.entries(TASK_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        {/* Notes — available to all */}
        <div>
          <label style={lbl}>ملاحظات</label>
          <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={3} placeholder="أضف ملاحظاتك هنا..." style={{...inp,resize:"vertical"} as any} onFocus={onFocus as any} onBlur={onBlur as any} />
        </div>
      </Drawer>

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
              const dayTasks = byDate[ds]??[];
              return (
                <div key={i} onClick={()=>setSelectedDay(ds)}
                  style={{ minHeight:80,borderRight:"1px solid #f0ead8",borderBottom:"1px solid #f0ead8",padding:"6px 5px",cursor:"pointer",background:isSelected?"#fdf4e0":isToday?"#fffbf0":"white",transition:"background 0.15s" }}
                  onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.background=isToday?"#fff8e6":"#fdf8f0"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background=isSelected?"#fdf4e0":isToday?"#fffbf0":"white"; }}>
                  <div style={{ display:"flex",justifyContent:"center",marginBottom:4 }}>
                    <span style={{ width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:isToday?900:600,background:isToday?G:"transparent",color:isToday?"white":isSelected?GD:"#374151",boxShadow:isToday?`0 2px 8px ${G}60`:"none" }}>{day}</span>
                  </div>
                  {dayTasks.slice(0,2).map(t=>{
                    const tc = t.teamColor??G;
                    return (
                      <div key={t.id} style={{ fontSize:10,fontWeight:600,color:"white",background:tc,borderRadius:4,padding:"2px 5px",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={t.title}>
                        {t.dueTime && <span style={{ opacity:0.8 }}>{t.dueTime.slice(0,5)} </span>}{t.title}
                      </div>
                    );
                  })}
                  {dayTasks.length>2 && <div style={{ fontSize:10,color:GD,fontWeight:700,textAlign:"center" }}>+{dayTasks.length-2} أخرى</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          {/* Selected day header */}
          <div style={{ background:"white",borderRadius:16,border:"1.5px solid #f0ead8",padding:"16px 18px" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
              <div>
                <div style={{ fontSize:15,fontWeight:800,color:GR }}>
                  {selectedDay===todayStr && <span style={{ fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:`${G}20`,color:GD,marginLeft:8 }}>اليوم</span>}
                  {new Date(selectedDay).toLocaleDateString("ar-KW",{weekday:"long",day:"numeric",month:"long",timeZone:"Asia/Kuwait"})}
                </div>
                <div style={{ fontSize:12,color:"#9ca3af",marginTop:2 }}>{selectedTasks.length} مهمة</div>
              </div>
              {canEdit && (
                <button onClick={()=>{setEditingTask(null);setTaskDrawer(true);}} style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer",background:`linear-gradient(135deg,${G},${GD})`,border:"none",color:"white",fontFamily:"inherit",boxShadow:`0 3px 10px rgba(212,165,52,0.4)` }}>
                  <Plus size={13}/>مهمة
                </button>
              )}
            </div>
          </div>

          {/* Tasks list */}
          {selectedTasks.length===0 ? (
            <div style={{ background:"white",borderRadius:16,border:"1.5px solid #f0ead8",padding:"32px 18px",textAlign:"center" }}>
              <Calendar size={32} color="#e2d5b0" style={{ margin:"0 auto 8px",display:"block" }} />
              <p style={{ color:"#94a3b8",fontSize:13,fontWeight:600,margin:0 }}>لا توجد مهام في هذا اليوم</p>
              {canEdit && <button onClick={()=>{setEditingTask(null);setTaskDrawer(true);}} style={{ marginTop:12,display:"inline-flex",alignItems:"center",gap:5,padding:"7px 16px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",background:`linear-gradient(135deg,${G},${GD})`,border:"none",color:"white",fontFamily:"inherit" }}><Plus size={12}/>أضف مهمة</button>}
            </div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {selectedTasks.map(t=>{
                const ts = TASK_STATUS[t.status]??TASK_STATUS.pending;
                const tc = t.teamColor??G;
                return (
                  <div key={t.id} style={{ background:"white",borderRadius:14,border:"1.5px solid #f0ead8",overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,0,0.04)" }}>
                    <div style={{ height:4,background:tc }} />
                    <div style={{ padding:"12px 14px" }}>
                      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8 }}>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4 }}>
                            <span style={{ fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:12,background:ts.bg,color:ts.color }}>{ts.label}</span>
                            {t.teamName && <span style={{ fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:12,background:tc+"20",color:tc }}>{t.teamName}</span>}
                          </div>
                          <p style={{ fontSize:13,fontWeight:700,color:GR,margin:"0 0 4px",lineHeight:1.4 }}>{t.title}</p>
                          {t.dueTime && <div style={{ display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#6b7280" }}><Clock size={11}/>{t.dueTime.slice(0,5)} (بتوقيت الكويت)</div>}
                          {t.assignedToName && <div style={{ display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#6b7280",marginTop:2 }}><Users size={11}/>{t.assignedToName}</div>}
                          {t.notes && <div style={{ marginTop:6,padding:"6px 10px",borderRadius:8,background:"#f9fafb",border:"1px solid #e5e7eb",fontSize:11,color:"#374151",lineHeight:1.5 }}><span style={{ fontWeight:700,color:GD }}>ملاحظات: </span>{t.notes}</div>}
                        </div>
                        <div style={{ display:"flex",gap:5,flexShrink:0 }}>
                          {canEdit && <button onClick={()=>{ setEditingTask(t); setTaskDrawer(true); }} style={{ width:26,height:26,borderRadius:7,background:"#f0fdf4",border:"1px solid #bbf7d0",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><Pencil size={11} color="#16a34a"/></button>}
                          {isAdmin && <button onClick={()=>{ if(confirm("حذف المهمة؟")) deleteTaskMut.mutate(t.id); }} style={{ width:26,height:26,borderRadius:7,background:"#fff1f2",border:"1px solid #fecaca",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><Trash2 size={11} color="#dc2626"/></button>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Monthly summary */}
          <div style={{ background:"white",borderRadius:16,border:"1.5px solid #f0ead8",padding:"14px 16px" }}>
            <div style={{ fontSize:12,fontWeight:800,color:"#9ca3af",marginBottom:10 }}>ملخص الشهر</div>
            {Object.entries(TASK_STATUS).map(([k,v])=>{
              const count = tasks.filter(t=>t.status===k && t.dueDate?.startsWith(`${year}-${String(month+1).padStart(2,"0")}`)).length;
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
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB 4 — GPS MAP
═══════════════════════════════════════════════════════ */
function GpsTab({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery<TransportRow[]>({
    queryKey: ["transportation"],
    queryFn: () => apiFetch("/api/transportation"),
  });

  const updateLocMut = useMutation({
    mutationFn: ({ id, lat, lng }: { id: number; lat: number; lng: number }) =>
      apiFetch(`/api/transportation/${id}/location`, {
        method: "PATCH",
        body: JSON.stringify({ lat, lng }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transportation"] }),
  });

  const withLocation = orders.filter(o => o.lat && o.lng);
  const withoutLocation = orders.filter(o => !o.lat || !o.lng);

  const markers = withLocation.map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    description: o.description,
    vehicleInfo: o.vehicleInfo,
    status: o.status,
    lat: Number(o.lat),
    lng: Number(o.lng),
    locationUpdatedAt: o.locationUpdatedAt,
    origin: o.origin,
    destination: o.destination,
  }));

  /* Manual GPS update panel for orders without location */
  const [manualId, setManualId] = useState<number | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [gpsLink, setGpsLink] = useState("");

  const parseGoogleLink = (url: string) => {
    // Handle formats: @lat,lng  or q=lat,lng  or ?ll=lat,lng
    const m = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
           ?? url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
           ?? url.match(/ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (m) { setManualLat(m[1]); setManualLng(m[2]); }
  };

  const handleGetMyLocation = (id: number) => {
    navigator.geolocation.getCurrentPosition(
      pos => updateLocMut.mutate({ id, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => alert("تعذّر تحديد الموقع. تأكد من منح صلاحية الموقع للمتصفح."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleManualSave = () => {
    if (!manualId || !manualLat || !manualLng) return;
    updateLocMut.mutate({ id: manualId, lat: Number(manualLat), lng: Number(manualLng) });
    setManualId(null); setManualLat(""); setManualLng(""); setGpsLink("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stats bar */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { label: "إجمالي الشاحنات", value: orders.length, color: GD, bg: `${G}15` },
          { label: "موقع محدَّد", value: withLocation.length, color: "#16a34a", bg: "#f0fdf4" },
          { label: "بدون موقع", value: withoutLocation.length, color: "#dc2626", bg: "#fff1f2" },
        ].map(s => (
          <div key={s.label} style={{ flex: "1 1 160px", background: s.bg, borderRadius: 14, padding: "14px 18px", border: `1px solid ${s.color}25` }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Map */}
      <div style={{ background: "white", borderRadius: 20, border: "1.5px solid #f0ead8", overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #f5f0e6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Navigation size={16} color={G} />
            <span style={{ fontSize: 14, fontWeight: 800, color: GR }}>خريطة مواقع الشاحنات</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>— توقيت الكويت</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { color: "#d97706", label: "انتظار" },
              { color: "#2563eb", label: "جارٍ" },
              { color: "#16a34a", label: "تسليم" },
              { color: "#dc2626", label: "ملغي" },
            ].map(l => (
              <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#374151" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.color, display: "inline-block" }} />{l.label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ height: 460, position: "relative" }}>
          {isLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94a3b8", fontSize: 14 }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite", marginLeft: 8 }} />جاري التحميل...
            </div>
          ) : markers.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
              <MapPin size={44} color="#e2d5b0" />
              <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>لا توجد شاحنات بمواقع محددة بعد</p>
              <p style={{ color: "#d1d5db", fontSize: 12, margin: 0 }}>أضف موقع GPS للأوامر أدناه</p>
            </div>
          ) : (
            <TruckMap
              markers={markers}
              onUpdateLocation={(id, lat, lng) => updateLocMut.mutate({ id, lat, lng })}
              canEdit={canEdit}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>

      {/* Orders without location */}
      {withoutLocation.length > 0 && canEdit && (
        <div style={{ background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <MapPin size={15} color="#dc2626" />
            <span style={{ fontSize: 14, fontWeight: 800, color: GR }}>أوامر بدون موقع GPS</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {withoutLocation.map(o => {
              const st = STATUS_ORDER[o.status] ?? STATUS_ORDER.pending;
              const isSelected = manualId === o.id;
              return (
                <div key={o.id} style={{ borderRadius: 12, border: `1.5px solid ${isSelected ? G : "#e5e7eb"}`, overflow: "hidden", transition: "border-color 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: isSelected ? "#fdf8ec" : "#fafaf8" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Truck size={16} color={st.color} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: GR }}>{o.description}</div>
                        {o.vehicleInfo && <div style={{ fontSize: 11, color: "#6b7280" }}>{o.vehicleInfo}</div>}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 12, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => handleGetMyLocation(o.id)}
                        disabled={updateLocMut.isPending}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        <Navigation size={12} />موقعي الحالي
                      </button>
                      <button
                        onClick={() => setManualId(isSelected ? null : o.id)}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, fontSize: 12, fontWeight: 700, background: isSelected ? "#fff1f2" : "#f9fafb", border: `1px solid ${isSelected ? "#fecaca" : "#e5e7eb"}`, color: isSelected ? "#dc2626" : "#374151", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        {isSelected ? <X size={12} /> : <MapPin size={12} />}{isSelected ? "إلغاء" : "إدخال يدوي"}
                      </button>
                    </div>
                  </div>

                  {/* Manual entry panel */}
                  {isSelected && (
                    <div style={{ padding: "14px 16px", background: "#fffdf5", borderTop: "1px solid #f0ead8", display: "flex", flexDirection: "column", gap: 12 }}>
                      {/* Paste Google Maps link */}
                      <div>
                        <label style={lbl}>لصق رابط خرائط Google</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            value={gpsLink}
                            onChange={e => { setGpsLink(e.target.value); parseGoogleLink(e.target.value); }}
                            placeholder="https://maps.google.com/?q=29.37,47.98 ..."
                            dir="ltr"
                            style={{ ...inp, flex: 1, fontSize: 12 }}
                            onFocus={onFocus} onBlur={onBlur}
                          />
                        </div>
                      </div>
                      {/* Manual lat/lng */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={lbl}>خط العرض (Latitude)</label>
                          <input value={manualLat} onChange={e => setManualLat(e.target.value)} placeholder="29.3759" dir="ltr" style={{ ...inp, fontFamily: "monospace" }} onFocus={onFocus} onBlur={onBlur} />
                        </div>
                        <div>
                          <label style={lbl}>خط الطول (Longitude)</label>
                          <input value={manualLng} onChange={e => setManualLng(e.target.value)} placeholder="47.9774" dir="ltr" style={{ ...inp, fontFamily: "monospace" }} onFocus={onFocus} onBlur={onBlur} />
                        </div>
                      </div>
                      <button
                        onClick={handleManualSave}
                        disabled={!manualLat || !manualLng || updateLocMut.isPending}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", cursor: "pointer", fontFamily: "inherit", opacity: (!manualLat || !manualLng) ? 0.5 : 1 }}
                      >
                        <Save size={14} />حفظ الموقع
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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

  const [activeTab, setActiveTab] = useState<"orders"|"teams"|"calendar"|"gps">("orders");

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["transport-tasks"],
    queryFn: () => apiFetch("/api/transportation/tasks"),
  });
  const { data: orders = [] } = useQuery<TransportRow[]>({
    queryKey: ["transportation"],
    queryFn: () => apiFetch("/api/transportation"),
  });
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["transport-teams"],
    queryFn: () => apiFetch("/api/transportation/teams"),
  });

  const todayStr   = todayKuwait();
  const todayTasks = allTasks.filter(t => t.dueDate === todayStr).length;
  const withGps    = orders.filter(o => o.lat && o.lng).length;

  const TABS = [
    { key: "orders",   label: "الأوامر",  icon: Truck,      count: orders.length },
    { key: "teams",    label: "الفرق",    icon: Users,      count: teams.length },
    { key: "calendar", label: "التقويم",  icon: Calendar,   count: todayTasks > 0 ? todayTasks : undefined },
    { key: "gps",      label: "الخريطة",  icon: Navigation, count: withGps > 0 ? withGps : undefined },
  ] as const;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>النقل والتوزيع</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>إدارة أوامر النقل · الفرق · جدول المهام · GPS</p>
        </div>
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
      {activeTab === "orders"   && <OrdersTab   canEdit={canEdit} />}
      {activeTab === "teams"    && <TeamsTab    canEdit={canEdit} isAdmin={isAdmin} />}
      {activeTab === "calendar" && <CalendarTab canEdit={canEdit} isAdmin={isAdmin} />}
      {activeTab === "gps"      && <GpsTab      canEdit={canEdit} isAdmin={isAdmin} />}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
